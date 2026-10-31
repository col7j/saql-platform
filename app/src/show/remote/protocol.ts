// بروتوكول الربط والتحكم من الجوال. الجلسة يُنشئها المحرّر وحده، وشاشة العرض لا تعرض أي رمز.
// منطق نقي فوق واجهة Backend صغيرة: Firebase في التشغيل (firebase.ts)، والخادم المحلي في الاختبارات (loopback.ts).
//
// /sessions/{key}                 key: 128 بت عشوائي، هو اسم الجلسة ولا يمكن استعراض الجلسات
//   owner, createdAt, expiresAt   ← المحرّر (المالك)
//   online, state                 ← شاشة العرض (الحالة: الفقرة، الخطوة، الجولة، الشاشة السوداء، قائمة الفقرات)
//   displays/{uid}: { at, via }   ← شاشة عرض سجّلت نفسها بمفتاح العرض
//   remotes/{uid}: { at, code }   ← جوال سجّل نفسه بالرمز القصير
//   commands/{id}: { uid, type, …, at }  ← أوامر الجوال، تنفّذها شاشة العرض ثم تحذفها
// /displayKeys/{dk}: { session, owner }  dk في رابط شاشة العرض فقط، لا يصل للجوال: الجوال لا يصير شاشة عرض
// /codes/{6 أرقام}: { session, owner, createdAt, expiresAt }  تُقرأ بعد مطالبة صحيحة فقط
// /attempts/{uid}: { count, windowStart, code }  حد المحاولات: 5 لكل جهاز في 10 دقائق
// /claims/{code}/{uid}: { at }    مطالبة بالرمز بعد تسجيل محاولة، تُقبل فقط إن كان الرمز نشطاً
// قواعد الأمان في firebase/database.rules.json تفرض كل ذلك على الخادم.

export const CODE_RE = /^[0-9]{6}$/;
export const KEY_RE = /^[A-Za-z0-9_-]{22}$/;
/** مدة الجلسة: تكفي حفلاً طويلاً، وتمدّها شاشة العرض ما دامت تعمل */
export const SESSION_MS = 12 * 60 * 60 * 1000;
/** صلاحية الرمز القصير، ويجدّده المحرّر */
export const CODE_MS = 10 * 60 * 1000;
export const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
export const MAX_ATTEMPTS = 5;
const EXTEND_BEFORE_MS = 60 * 60 * 1000;

export interface Backend {
  uid: string;
  now(): number;
  get(path: string): Promise<unknown>;
  set(path: string, value: unknown): Promise<void>;
  update(path: string, value: Record<string, unknown>): Promise<void>;
  remove(path: string): Promise<void>;
  push(path: string, value: unknown): Promise<string>;
  /** يعيد committed=false إن أعادت fn قيمة undefined (إلغاء) */
  transaction(path: string, fn: (current: any) => unknown): Promise<{ committed: boolean }>;
  /** null عند الحذف أو فقد صلاحية القراءة */
  onValue(path: string, cb: (value: any) => void): () => void;
  onChildAdded(path: string, cb: (key: string, value: any) => void): () => void;
  onConnected(cb: (on: boolean) => void): () => void;
  /** قيمة تُكتب تلقائياً إن انقطع هذا الجهاز */
  onDisconnectSet(path: string, value: unknown): void;
}

export const CUE_COMMANDS = ['hint', 'reveal', 'skip', 'launch', 'photo', 'skipVideo'] as const;
export type RemoteCommand =
  | { type: 'next' }
  | { type: 'prev' }
  | { type: 'tour' }
  | { type: 'blackout' }
  | { type: (typeof CUE_COMMANDS)[number] }
  | { type: 'goto'; seg: number };

export interface RemoteState {
  seg: number;
  step: number;
  steps: number;
  started: boolean;
  paused: boolean;
  blackout: boolean;
  title: string;
  /** عنوان كل فقرة ونوعها، لقائمة «انتقل إلى» في الجوال */
  outline: { title: string; type: import('../model').SegmentType }[];
  live?: import('../sync').LiveInfo;
}

const sp = (key: string, ...rest: string[]) => ['sessions', key, ...rest].join('/');
/** طوابع تتحقق منها القواعد بأنها «ليست في المستقبل»: ثانيتان احتياطاً لفرق ساعة الجهاز عن الخادم */
const stamp = (b: Backend) => b.now() - 2000;
const denied = (e: unknown) => /permission|denied/i.test(String((e as Error)?.message ?? e));

/** مفتاح 128 بت بصيغة base64url (22 حرفاً) */
export function randomKey(bytes = (n: number) => crypto.getRandomValues(new Uint8Array(n))): string {
  const b = bytes(16);
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** رمز من 6 أرقام بلا انحياز */
export function randomCode(words = (n: number) => crypto.getRandomValues(new Uint32Array(n))): string {
  const limit = Math.floor(0x100000000 / 1_000_000) * 1_000_000;
  for (;;) {
    const [x] = words(1);
    if (x < limit) return String(x % 1_000_000).padStart(6, '0');
  }
}

/** يحوّل أمراً مخزّناً إلى أمر معروف، ويرفض غيره */
export function parseCommand(v: any): RemoteCommand | null {
  if (!v || typeof v !== 'object') return null;
  if (v.type === 'next' || v.type === 'prev' || v.type === 'tour' || v.type === 'blackout') return { type: v.type };
  if ((CUE_COMMANDS as readonly string[]).includes(v.type)) return { type: v.type };
  if (v.type === 'goto' && Number.isInteger(v.seg) && v.seg >= 0 && v.seg < 1000) return { type: 'goto', seg: v.seg };
  return null;
}

export type LinkErrorCode = 'invalid' | 'limited' | 'ended' | 'network';
const fail = (code: LinkErrorCode, message: string) => Object.assign(new Error(message), { code });

/** يسجّل محاولة (حد المحاولات على الخادم). يرمي limited إن تجاوز الجهاز الحد */
async function attempt(b: Backend, code: string) {
  const now = b.now();
  let cur: any = null;
  try {
    cur = await b.get(`attempts/${b.uid}`);
  } catch (e) {
    if (!denied(e)) throw fail('network', 'تعذّر الاتصال');
  }
  const fresh = !cur || cur.windowStart < now - ATTEMPT_WINDOW_MS;
  const next = fresh ? { count: 1, windowStart: stamp(b), code } : { count: cur.count + 1, windowStart: cur.windowStart, code };
  if (!fresh && next.count > MAX_ATTEMPTS) throw fail('limited', 'محاولات كثيرة، انتظر بضع دقائق ثم حاول');
  try {
    await b.set(`attempts/${b.uid}`, next);
  } catch (e) {
    throw denied(e) ? fail('limited', 'محاولات كثيرة، انتظر بضع دقائق ثم حاول') : fail('network', 'تعذّر الاتصال');
  }
}

// ───────────── المحرّر: صاحب الجلسة ─────────────

export interface HostLink {
  key: string;
  displayKey: string;
  code: string;
  codeExpiresAt: number;
}

export interface HostStatus {
  remotes: number;
  displays: number;
  /** شاشة عرض متصلة الآن */
  online: boolean;
}

export interface HostSession {
  link(): HostLink;
  /** رمز جديد (والقديم يتوقف فوراً)، والأجوال المتصلة تبقى */
  renewCode(): Promise<HostLink>;
  /** يفصل كل الأجوال ويجدّد الرمز. شاشة العرض تبقى متصلة */
  disconnectAll(): Promise<HostLink>;
  onStatus(cb: (s: HostStatus) => void): () => void;
  /** ينهي الجلسة: تنفصل شاشة العرض والأجوال، ويُحذف كل شيء */
  end(): Promise<void>;
}

async function newCode(b: Backend, key: string, old?: string): Promise<{ code: string; codeExpiresAt: number }> {
  if (old) await b.remove(`codes/${old}`).catch(() => undefined);
  for (let i = 0; i < 3; i++) {
    const code = randomCode();
    await attempt(b, code);
    const codeExpiresAt = b.now() + CODE_MS;
    try {
      await b.set(`codes/${code}`, { session: key, owner: b.uid, createdAt: stamp(b), expiresAt: codeExpiresAt });
      return { code, codeExpiresAt };
    } catch (e) {
      // الرمز مستخدم في جلسة نشطة أخرى (نادر جداً): رمز آخر
      if (!denied(e)) throw fail('network', 'تعذّر الاتصال');
    }
  }
  throw fail('limited', 'تعذّر حجز رمز، حاول بعد دقائق');
}

function hostSession(b: Backend, initial: HostLink): HostSession {
  let link = initial;
  return {
    link: () => link,
    async renewCode() {
      link = { ...link, ...(await newCode(b, link.key, link.code)) };
      return link;
    },
    async disconnectAll() {
      await b.remove(sp(link.key, 'remotes'));
      link = { ...link, ...(await newCode(b, link.key, link.code)) };
      return link;
    },
    onStatus(cb) {
      return b.onValue(sp(link.key), (s) => {
        const count = (v: unknown) => (v && typeof v === 'object' ? Object.keys(v).length : 0);
        cb({ remotes: count(s?.remotes), displays: count(s?.displays), online: !!s?.online && count(s?.displays) > 0 });
      });
    },
    async end() {
      await b.remove(`codes/${link.code}`).catch(() => undefined);
      await b.remove(`displayKeys/${link.displayKey}`).catch(() => undefined);
      await b.remove(sp(link.key));
    },
  };
}

/** المحرّر ينشئ جلسة: مفتاح الجلسة، ومفتاح شاشة العرض، ورمز الجوال */
export async function createSession(b: Backend): Promise<HostSession> {
  const key = randomKey();
  const displayKey = randomKey();
  const now = b.now();
  await b.set(sp(key), { owner: b.uid, createdAt: now, expiresAt: now + SESSION_MS });
  await b.set(`displayKeys/${displayKey}`, { session: key, owner: b.uid });
  const c = await newCode(b, key);
  return hostSession(b, { key, displayKey, ...c });
}

/** بعد إعادة تحميل المحرّر: الجلسة المحفوظة إن كانت ما زالت قائمة ولهذا المالك */
export async function resumeSession(b: Backend, saved: HostLink): Promise<HostSession | null> {
  if (!KEY_RE.test(saved.key) || !KEY_RE.test(saved.displayKey)) return null;
  let s: any;
  try {
    s = await b.get(sp(saved.key));
  } catch (e) {
    if (denied(e)) return null;
    throw e;
  }
  if (!s || s.owner !== b.uid || s.expiresAt < b.now()) return null;
  return hostSession(b, saved);
}

// ───────────── شاشة العرض ─────────────

export interface DisplaySession {
  publish(state: RemoteState): Promise<void>;
  onCommand(cb: (c: RemoteCommand) => void): () => void;
  onRemotes(cb: (count: number) => void): () => void;
  /** أنهى المحرّر الجلسة */
  onEnded(cb: () => void): () => void;
  close(): Promise<void>;
}

/** شاشة العرض تتصل بالجلسة بمفتاح العرض (من الرابط). ended: المفتاح لم يعد صالحاً */
export async function openDisplay(b: Backend, displayKey: string): Promise<DisplaySession> {
  if (!KEY_RE.test(displayKey)) throw fail('invalid', 'رابط شاشة العرض غير صالح');
  let dk: any;
  try {
    dk = await b.get(`displayKeys/${displayKey}`);
  } catch (e) {
    throw denied(e) ? fail('invalid', 'رابط شاشة العرض غير صالح') : fail('network', 'تعذّر الاتصال');
  }
  if (!dk?.session) throw fail('ended', 'انتهت جلسة الربط');
  const key: string = dk.session;
  try {
    await b.set(sp(key, 'displays', b.uid), { at: b.now(), via: displayKey });
    await b.set(sp(key, 'online'), true);
  } catch (e) {
    throw denied(e) ? fail('ended', 'انتهت جلسة الربط') : fail('network', 'تعذّر الاتصال');
  }
  b.onDisconnectSet(sp(key, 'online'), false);
  let expiresAt = 0;
  return {
    async publish(state) {
      await b.set(sp(key, 'state'), state);
      // الجلسة تبقى ما دام العرض يعمل
      if (expiresAt - b.now() < EXTEND_BEFORE_MS) {
        expiresAt = b.now() + SESSION_MS;
        await b.update(sp(key), { expiresAt, online: true });
      }
    },
    onCommand(cb) {
      return b.onChildAdded(sp(key, 'commands'), (k, v) => {
        // التنفيذ قبل الحذف: الحذف يطلق المستمعين فوراً (كتابة محلية)، فلو سبق لنُفّذ الأمر التالي قبل هذا
        const c = parseCommand(v);
        if (c) cb(c);
        b.remove(sp(key, 'commands', k)).catch(() => undefined);
      });
    },
    onRemotes(cb) {
      return b.onValue(sp(key, 'remotes'), (v) => cb(v && typeof v === 'object' ? Object.keys(v).length : 0));
    },
    onEnded(cb) {
      let seen = false;
      return b.onValue(sp(key, 'owner'), (o) => (o ? (seen = true) : seen && cb()));
    },
    close: () => b.remove(sp(key, 'displays', b.uid)).catch(() => undefined),
  };
}

// ───────────── الجوال ─────────────

export interface RemoteSession {
  key: string;
  send(c: RemoteCommand): Promise<void>;
  /** الحالة، وnull إذا انتهت الجلسة أو فُصل هذا الجوال */
  onState(cb: (s: RemoteState | null) => void): () => void;
  /** هل شاشة العرض متصلة الآن */
  onDisplayOnline(cb: (on: boolean) => void): () => void;
  leave(): Promise<void>;
}

function remoteSession(b: Backend, key: string): RemoteSession {
  return {
    key,
    send: (c) => b.push(sp(key, 'commands'), { ...c, uid: b.uid, at: b.now() }).then(() => undefined),
    onState(cb) {
      let alive = true;
      // التسجيل يُحذف عند «فصل كل الأجهزة» أو إنهاء الجلسة: تنتهي صلاحية القراءة فيصل null
      const offMe = b.onValue(sp(key, 'remotes', b.uid), (r) => alive && r == null && cb(null));
      const offState = b.onValue(sp(key, 'state'), (s) => alive && s && cb(s as RemoteState));
      return () => ((alive = false), offMe(), offState());
    },
    onDisplayOnline: (cb) => b.onValue(sp(key, 'online'), (v) => cb(v === true)),
    leave: () => b.remove(sp(key, 'remotes', b.uid)).catch(() => undefined),
  };
}

/** الجوال يدخل بالرمز: محاولة محسوبة، ثم مطالبة، ثم قراءة مفتاح الجلسة والتسجيل فيها */
export async function joinWithCode(b: Backend, code: string): Promise<RemoteSession> {
  if (!CODE_RE.test(code)) throw fail('invalid', 'الرمز 6 أرقام');
  await attempt(b, code);
  const wrong = () => fail('invalid', 'الرمز غير صحيح أو انتهت صلاحيته');
  try {
    await b.set(`claims/${code}/${b.uid}`, { at: stamp(b) });
  } catch (e) {
    throw denied(e) ? wrong() : fail('network', 'تعذّر الاتصال');
  }
  let c: any;
  try {
    c = await b.get(`codes/${code}`);
    if (!c?.session) throw wrong();
    await b.set(sp(c.session, 'remotes', b.uid), { at: b.now(), code });
  } catch (e) {
    if ((e as { code?: string }).code) throw e;
    throw denied(e) ? wrong() : fail('network', 'تعذّر الاتصال');
  }
  return remoteSession(b, c.session);
}

/** بعد إعادة تحميل الجوال: يعود للجلسة بالمفتاح المحفوظ إن كان ما زال مسجّلاً فيها */
export async function rejoin(b: Backend, key: string): Promise<RemoteSession> {
  if (!KEY_RE.test(key)) throw fail('ended', 'انتهت الجلسة');
  try {
    const me = await b.get(sp(key, 'remotes', b.uid));
    if (!me) throw fail('ended', 'انتهت الجلسة');
  } catch (e) {
    if ((e as { code?: string }).code) throw e;
    throw denied(e) ? fail('ended', 'انتهت الجلسة أو فُصل هذا الجهاز') : fail('network', 'تعذّر الاتصال');
  }
  return remoteSession(b, key);
}
