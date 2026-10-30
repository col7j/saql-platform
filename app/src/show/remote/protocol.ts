// بروتوكول التحكم من الجوال: جلسة برمز من 4 أرقام تفتحها شاشة العرض، ويدخلها الجوال بالرمز.
// منطق نقي فوق واجهة Backend صغيرة: Firebase في التشغيل (firebase.ts)، وذاكرة في الاختبارات.
//
// /sessions/{code}
//   owner, createdAt, expiresAt, online      ← تكتبها شاشة العرض وحدها
//   state                                    ← حالة العرض (الفقرة، الخطوة، الجولة، الشاشة السوداء، قائمة الفقرات)
//   remotes/{uid}: { at }                    ← كل جوال يسجّل نفسه بالرمز
//   commands/{id}: { uid, type, …, at }      ← أوامر الجوال، تنفّذها شاشة العرض ثم تحذفها
// قواعد الأمان (database.rules.json) تحصر الكتابة في صاحب الجلسة والأجهزة المسجّلة فيها.

export const CODE_RE = /^[0-9]{4}$/;
/** مدة الجلسة: تكفي حفلاً طويلاً، وتُمدَّد ما دامت شاشة العرض تعمل */
export const SESSION_MS = 12 * 60 * 60 * 1000;
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
  onValue(path: string, cb: (value: any) => void): () => void;
  onChildAdded(path: string, cb: (key: string, value: any) => void): () => void;
  onConnected(cb: (on: boolean) => void): () => void;
  /** قيمة تُكتب تلقائياً إن انقطع هذا الجهاز */
  onDisconnectSet(path: string, value: unknown): void;
}

export type RemoteCommand =
  | { type: 'next' }
  | { type: 'prev' }
  | { type: 'tour' }
  | { type: 'blackout' }
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
  outline: { title: string; type: 'slide' | 'demo' }[];
}

const path = (code: string, ...rest: string[]) => ['sessions', code, ...rest].join('/');
export const randomCode = (rnd = Math.random) => String(Math.floor(rnd() * 10000)).padStart(4, '0');

/** يحوّل أمراً مخزّناً إلى أمر معروف، ويرفض غيره */
export function parseCommand(v: any): RemoteCommand | null {
  if (!v || typeof v !== 'object') return null;
  if (v.type === 'next' || v.type === 'prev' || v.type === 'tour' || v.type === 'blackout') return { type: v.type };
  if (v.type === 'goto' && Number.isInteger(v.seg) && v.seg >= 0 && v.seg < 1000) return { type: 'goto', seg: v.seg };
  return null;
}

export interface DisplaySession {
  code: string;
  publish(state: RemoteState): Promise<void>;
  onCommand(cb: (c: RemoteCommand) => void): () => void;
  onRemotes(cb: (count: number) => void): () => void;
  close(): Promise<void>;
}

/** شاشة العرض تفتح جلسة برمز غير مستخدم (أو منتهٍ) */
export async function openSession(b: Backend, rnd = Math.random, tries = 30): Promise<DisplaySession> {
  for (let i = 0; i < tries; i++) {
    const code = randomCode(rnd);
    const now = b.now();
    let committed = false;
    try {
      ({ committed } = await b.transaction(path(code), (cur) => {
        if (cur && cur.expiresAt > now && cur.owner !== b.uid) return undefined;
        return { owner: b.uid, createdAt: now, expiresAt: now + SESSION_MS, online: true };
      }));
    } catch (e) {
      // جلسة نشطة لغيرنا: القواعد تمنع قراءتها، فنجرب رمزاً آخر. وغير ذلك (انقطاع) يُرفع
      if (!/permission|denied/i.test(String((e as Error)?.message ?? e))) throw e;
    }
    if (!committed) continue;
    b.onDisconnectSet(path(code, 'online'), false);
    let expiresAt = now + SESSION_MS;
    return {
      code,
      async publish(state) {
        await b.set(path(code, 'state'), state);
        // الجلسة تبقى ما دام العرض يعمل
        if (expiresAt - b.now() < EXTEND_BEFORE_MS) {
          expiresAt = b.now() + SESSION_MS;
          await b.update(path(code), { expiresAt, online: true });
        }
      },
      onCommand(cb) {
        return b.onChildAdded(path(code, 'commands'), (key, v) => {
          // التنفيذ قبل الحذف: الحذف يطلق المستمعين فوراً (كتابة محلية)، فلو سبق لنُفّذ الأمر التالي قبل هذا
          const c = parseCommand(v);
          if (c) cb(c);
          b.remove(path(code, 'commands', key)).catch(() => undefined);
        });
      },
      onRemotes(cb) {
        return b.onValue(path(code, 'remotes'), (v) => cb(v && typeof v === 'object' ? Object.keys(v).length : 0));
      },
      close: () => b.remove(path(code)),
    };
  }
  throw new Error('تعذّر حجز رمز للجلسة');
}

export type JoinError = 'invalid' | 'network';

export interface RemoteSession {
  code: string;
  send(c: RemoteCommand): Promise<void>;
  /** الحالة، وnull إذا انتهت الجلسة (رمز جديد أو أُغلقت) */
  onState(cb: (s: RemoteState | null) => void): () => void;
  /** هل شاشة العرض متصلة الآن */
  onDisplayOnline(cb: (on: boolean) => void): () => void;
  leave(): Promise<void>;
}

/** الجوال يدخل الجلسة بالرمز. الرمز الخاطئ أو المنتهي يرفضه الخادم (قواعد الأمان) */
export async function joinSession(b: Backend, code: string): Promise<RemoteSession> {
  if (!CODE_RE.test(code)) throw Object.assign(new Error('الرمز 4 أرقام'), { code: 'invalid' as JoinError });
  try {
    await b.set(path(code, 'remotes', b.uid), { at: b.now() });
  } catch (e) {
    const denied = /permission|denied/i.test(String((e as Error)?.message ?? e));
    throw Object.assign(new Error(denied ? 'الرمز غير صحيح أو انتهت الجلسة' : 'تعذّر الاتصال'), { code: (denied ? 'invalid' : 'network') as JoinError });
  }
  return {
    code,
    send: (c) => b.push(path(code, 'commands'), { ...c, uid: b.uid, at: b.now() }).then(() => undefined),
    onState(cb) {
      let alive = true;
      const offOwner = b.onValue(path(code, 'owner'), (o) => alive && o == null && cb(null));
      const offState = b.onValue(path(code, 'state'), (s) => alive && s && cb(s as RemoteState));
      return () => ((alive = false), offOwner(), offState());
    },
    onDisplayOnline: (cb) => b.onValue(path(code, 'online'), (v) => cb(v !== false)),
    leave: () => b.remove(path(code, 'remotes', b.uid)).catch(() => undefined),
  };
}
