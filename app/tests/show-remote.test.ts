/// <reference types="vite/client" />
// التحكم من الجوال: بروتوكول الجلسة فوق خادم وهمي يحاكي قواعد الأمان، وتحويل الأوامر والحالة، وضم القنوات.
import { describe, expect, it } from 'vitest';
import { ATTEMPT_WINDOW_MS, CODE_MS, CODE_RE, KEY_RE, MAX_ATTEMPTS, SESSION_MS, createSession, joinWithCode, openDisplay, parseCommand, randomCode, randomKey, rejoin, resumeSession, type RemoteState } from '@/show/remote/protocol';
import { displayUrl } from '@/show/remote/host';
import { takeDisplayKey } from '@/show/remote/display';
import { commandToMessage, createRemoteSync, messageToState } from '@/show/remote/display';
import { combineSync, type ShowMessage, type ShowSync } from '@/show/sync';
import { isShowHash } from '@/show/guard';
import { LoopbackDB } from '@/show/remote/loopback';

/** قاعدة بيانات في الذاكرة يتشاركها عدة «أجهزة»، بقواعد مطابقة لـ database.rules.json في جوهرها (نفس الخادم المحلي للتجربة) */
class FakeDB extends LoopbackDB {
  get clock() {
    return this.now();
  }
  set clock(v: number) {
    this.offset += v - this.now();
  }
}

const tick = () => new Promise((r) => setTimeout(r, 0));
const state = (seg = 0): RemoteState => ({ seg, step: 0, steps: 1, started: true, paused: false, blackout: false, title: 'الافتتاح', outline: [{ title: 'الافتتاح', type: 'slide' }, { title: 'الديمو', type: 'demo' }] });

const fresh = async () => {
  const db = new FakeDB();
  const host = await createSession(db.client('admin'));
  const display = await openDisplay(db.client('screen'), host.link().displayKey);
  return { db, host, display };
};

describe('الجلسة من المحرّر', () => {
  it('مفتاح جلسة 128 بت، ومفتاح عرض مستقل، ورمز من 6 أرقام بصلاحية', async () => {
    const { db, host } = await fresh();
    const l = host.link();
    expect(l.key).toMatch(KEY_RE);
    expect(l.displayKey).toMatch(KEY_RE);
    expect(l.displayKey).not.toBe(l.key);
    expect(l.code).toMatch(CODE_RE);
    expect(l.codeExpiresAt - db.clock).toBeGreaterThan(CODE_MS - 1000);
    expect(db.session(l.key).owner).toBe('admin');
    expect(db.session(l.key).displays.screen.via).toBe(l.displayKey);
  });
  it('لا قراءة ولا كتابة بلا مفتاح: لا استعراض للجلسات ولا للرموز', async () => {
    const { db, host } = await fresh();
    const x = db.client('stranger');
    await expect(x.get('sessions')).rejects.toThrow(/PERMISSION/);
    await expect(x.get(`sessions/${host.link().key}`)).rejects.toThrow(/PERMISSION/);
    await expect(x.get('codes')).rejects.toThrow(/PERMISSION/);
    await expect(x.get(`codes/${host.link().code}`)).rejects.toThrow(/PERMISSION/);
    await expect(x.set(`sessions/${host.link().key}/state`, state())).rejects.toThrow(/PERMISSION/);
  });
  it('استئناف الجلسة بعد إعادة تحميل المحرّر، ولغير المالك لا', async () => {
    const { db, host } = await fresh();
    expect(await resumeSession(db.client('admin'), host.link())).not.toBeNull();
    expect(await resumeSession(db.client('other'), host.link())).toBeNull();
    await host.end();
    expect(await resumeSession(db.client('admin'), host.link())).toBeNull();
  });
  it('مفاتيح ورموز عشوائية بلا انحياز', () => {
    expect(randomKey(() => new Uint8Array(16).fill(255))).toBe('_____________________w');
    const seq = [0xffffffff, 42];
    expect(randomCode(() => new Uint32Array([seq.shift()!]))).toBe('000042');
  });
});

describe('شاشة العرض', () => {
  it('تتصل بمفتاح العرض فقط، والمفتاح الخاطئ أو المنتهي يُرفض', async () => {
    const { db, host } = await fresh();
    await expect(openDisplay(db.client('s2'), host.link().key)).rejects.toMatchObject({ code: 'ended' });
    await expect(openDisplay(db.client('s2'), 'short')).rejects.toMatchObject({ code: 'invalid' });
    await host.end();
    await expect(openDisplay(db.client('s3'), host.link().displayKey)).rejects.toMatchObject({ code: 'ended' });
  });
  it('إنهاء الجلسة من المحرّر يبلغ شاشة العرض', async () => {
    const { host, display } = await fresh();
    let ended = 0;
    display.onEnded(() => ended++);
    await host.end();
    await tick();
    expect(ended).toBe(1);
  });
});

describe('الجوال', () => {
  it('الرمز الصحيح يتصل ويرى الحالة، والخاطئ يُرفض', async () => {
    const { db, host, display } = await fresh();
    await expect(joinWithCode(db.client('phone'), '12')).rejects.toMatchObject({ code: 'invalid' });
    const wrong = host.link().code === '000000' ? '000001' : '000000';
    await expect(joinWithCode(db.client('phone'), wrong)).rejects.toMatchObject({ code: 'invalid' });
    const r = await joinWithCode(db.client('phone'), host.link().code);
    expect(r.key).toBe(host.link().key);
    const seen: (RemoteState | null)[] = [];
    r.onState((s) => seen.push(s));
    await display.publish(state(1));
    await tick();
    expect(seen[seen.length - 1]).toMatchObject({ seg: 1 });
  });
  it('الرمز المنتهي يُرفض، والجوال المتصل يبقى بعد انتهائه', async () => {
    const { db, host } = await fresh();
    const r = await joinWithCode(db.client('phone'), host.link().code);
    db.clock += CODE_MS + 1;
    await expect(joinWithCode(db.client('late'), host.link().code)).rejects.toMatchObject({ code: 'invalid' });
    await expect(r.send({ type: 'next' })).resolves.toBeUndefined();
    expect((await rejoin(db.client('phone'), r.key)).key).toBe(r.key);
  });
  it('حد المحاولات: 5 لكل جهاز في 10 دقائق، ثم يُرفض حتى الرمز الصحيح', async () => {
    const { db, host } = await fresh();
    const p = db.client('guesser');
    const wrong = host.link().code === '000000' ? '000001' : '000000';
    for (let i = 0; i < MAX_ATTEMPTS; i++) await expect(joinWithCode(p, wrong)).rejects.toMatchObject({ code: 'invalid' });
    await expect(joinWithCode(p, host.link().code)).rejects.toMatchObject({ code: 'limited' });
    // التحايل بكتابة العدّاد مباشرة أو حذفه يُرفض من الخادم
    const now = db.clock;
    await expect(p.set('attempts/guesser', { count: 1, windowStart: now, code: host.link().code })).rejects.toThrow(/PERMISSION/);
    await expect(p.remove('attempts/guesser')).rejects.toThrow(/PERMISSION/);
    await expect(p.set(`claims/${host.link().code}/guesser`, { at: now })).rejects.toThrow(/PERMISSION/);
    // بعد النافذة تعود المحاولات (والرمز نفسه انتهى أيضاً، فيُجدَّد)
    db.clock += ATTEMPT_WINDOW_MS + 1;
    const l = await host.renewCode();
    await expect(joinWithCode(p, l.code)).resolves.toBeTruthy();
  });
  it('مطالبة قديمة برمز لا تصلح لجلسة جديدة تأخذ نفس الرمز', async () => {
    const { db, host } = await fresh();
    const code = host.link().code;
    await joinWithCode(db.client('old'), code);
    db.clock += CODE_MS + 1;
    // جلسة أخرى تحجز نفس الرقم بعد انتهائه
    const other = db.client('admin2');
    const now = db.clock;
    await other.set('sessions/BBBBBBBBBBBBBBBBBBBBBB', { owner: 'admin2', createdAt: now, expiresAt: now + SESSION_MS });
    await other.set('attempts/admin2', { count: 1, windowStart: now, code });
    db.clock += 5;
    await other.set(`codes/${code}`, { session: 'BBBBBBBBBBBBBBBBBBBBBB', owner: 'admin2', createdAt: db.clock, expiresAt: db.clock + CODE_MS });
    await expect(db.client('old').get(`codes/${code}`)).rejects.toThrow(/PERMISSION/);
    await expect(db.client('old').set('sessions/BBBBBBBBBBBBBBBBBBBBBB/remotes/old', { at: db.clock, code })).rejects.toThrow(/PERMISSION/);
  });
  it('الجوال لا يصير شاشة عرض ولا يكتب الحالة ولا يحذف الجلسة', async () => {
    const { db, host } = await fresh();
    const phone = db.client('phone');
    const r = await joinWithCode(phone, host.link().code);
    await expect(phone.set(`sessions/${r.key}/state`, state())).rejects.toThrow(/PERMISSION/);
    await expect(phone.set(`sessions/${r.key}/displays/phone`, { at: 1, via: r.key })).rejects.toThrow(/PERMISSION/);
    await expect(phone.set(`displayKeys/${'A'.repeat(22)}`, { session: r.key, owner: 'phone' })).rejects.toThrow(/PERMISSION/);
    await expect(phone.remove(`sessions/${r.key}`)).rejects.toThrow(/PERMISSION/);
  });
  it('الأوامر تصل لشاشة العرض مرة واحدة ثم تُحذف، وغير المسجّل لا يرسل', async () => {
    const { db, host, display } = await fresh();
    const got: unknown[] = [];
    display.onCommand((c) => got.push(c));
    const r = await joinWithCode(db.client('phone'), host.link().code);
    await r.send({ type: 'next' });
    await r.send({ type: 'goto', seg: 3 });
    await tick();
    expect(got).toEqual([{ type: 'next' }, { type: 'goto', seg: 3 }]);
    expect(db.session(r.key).commands ?? {}).toEqual({});
    await expect(db.client('stranger').push(`sessions/${r.key}/commands`, { type: 'next', uid: 'stranger', at: 1 })).rejects.toThrow(/PERMISSION/);
  });
  it('أوامر متتالية تُنفّذ بترتيب إرسالها حتى لو وصلت معاً', async () => {
    const { db, host, display } = await fresh();
    await joinWithCode(db.client('phone'), host.link().code);
    const got: unknown[] = [];
    display.onCommand((c) => got.push(c.type));
    const data = db.data;
    data.sessions[host.link().key].commands = {
      a: { type: 'blackout', uid: 'phone', at: 1 },
      b: { type: 'goto', seg: 2, uid: 'phone', at: 2 },
      c: { type: 'next', uid: 'phone', at: 3 },
    };
    db.store.write(data);
    await tick();
    expect(got).toEqual(['blackout', 'goto', 'next']);
  });
  it('«فصل كل الأجهزة»: الجوال يفقد القراءة والأوامر ولا يعود إلا بالرمز الجديد، وشاشة العرض تبقى', async () => {
    const { db, host, display } = await fresh();
    const counts: number[] = [];
    display.onRemotes((n) => counts.push(n));
    const old = host.link().code;
    const r = await joinWithCode(db.client('p1'), old);
    await joinWithCode(db.client('p2'), old);
    expect(counts[counts.length - 1]).toBe(2);
    const seen: unknown[] = [];
    r.onState((s) => seen.push(s));
    const l = await host.disconnectAll();
    await tick();
    expect(l.code).not.toBe(old);
    expect(counts[counts.length - 1]).toBe(0);
    expect(seen[seen.length - 1]).toBeNull();
    await expect(r.send({ type: 'next' })).rejects.toThrow(/PERMISSION/);
    await expect(rejoin(db.client('p1'), r.key)).rejects.toMatchObject({ code: 'ended' });
    await expect(joinWithCode(db.client('p1'), old)).rejects.toMatchObject({ code: 'invalid' });
    await expect(joinWithCode(db.client('p1'), l.code)).resolves.toBeTruthy();
    await expect(display.publish(state(2))).resolves.toBeUndefined();
  });
  it('تجديد الرمز يوقف القديم ويبقي الأجوال المتصلة', async () => {
    const { db, host } = await fresh();
    const old = host.link().code;
    const r = await joinWithCode(db.client('p1'), old);
    const l = await host.renewCode();
    expect(l.code).not.toBe(old);
    await expect(joinWithCode(db.client('p2'), old)).rejects.toMatchObject({ code: 'invalid' });
    await expect(r.send({ type: 'next' })).resolves.toBeUndefined();
  });
});

describe('الأوامر والحالة كرسائل ShowSync', () => {
  it('الأوامر المعروفة فقط', () => {
    expect(parseCommand({ type: 'next', uid: 'x' })).toEqual({ type: 'next' });
    expect(parseCommand({ type: 'goto', seg: 2 })).toEqual({ type: 'goto', seg: 2 });
    expect(parseCommand({ type: 'goto', seg: -1 })).toBeNull();
    expect(parseCommand({ type: 'config' })).toBeNull();
    expect(parseCommand('next')).toBeNull();
  });
  it('أمر الجوال يصير رسالة يفهمها العرض', () => {
    expect(commandToMessage({ type: 'next' })).toEqual({ type: 'nav', dir: 'next' });
    expect(commandToMessage({ type: 'tour' })).toEqual({ type: 'tour', action: 'toggle' });
    expect(commandToMessage({ type: 'goto', seg: 4 })).toEqual({ type: 'goto', pos: { seg: 4, step: 0 } });
  });
  it('لا يُنشر للخادم إلا الحالة (لا إعدادات ولا ملفات)، ومرة واحدة لكل تغيير', async () => {
    const published: RemoteState[] = [];
    const sync = createRemoteSync({ publish: async (s) => void published.push(s), onCommand: () => () => undefined });
    const st: ShowMessage = { type: 'state', pos: { seg: 1, step: 0 }, started: true, outline: state().outline, steps: 3 };
    sync.send(st);
    sync.send(st);
    sync.send({ type: 'config', config: {} as never });
    expect(published).toHaveLength(1);
    expect(published[0]).toMatchObject({ seg: 1, steps: 3, title: 'الديمو' });
    expect(messageToState({ type: 'hello' })).toBeNull();
  });
  it('ضم القناة المحلية والجوال: الإرسال لكلتيهما والاستقبال من أي منهما', () => {
    const mk = () => {
      const subs = new Set<(m: ShowMessage) => void>();
      const sent: ShowMessage[] = [];
      const s: ShowSync = { send: (m) => void sent.push(m), subscribe: (cb) => (subs.add(cb), () => subs.delete(cb)), close: () => undefined };
      return { s, sent, emit: (m: ShowMessage) => subs.forEach((cb) => cb(m)) };
    };
    const a = mk();
    const b = mk();
    const both = combineSync(a.s, b.s);
    const got: ShowMessage[] = [];
    const off = both.subscribe((m) => got.push(m));
    both.send({ type: 'hello' });
    b.emit({ type: 'blackout' });
    a.emit({ type: 'nav', dir: 'next' });
    off();
    b.emit({ type: 'blackout' });
    expect(a.sent).toHaveLength(1);
    expect(b.sent).toHaveLength(1);
    expect(got).toEqual([{ type: 'blackout' }, { type: 'nav', dir: 'next' }]);
  });
});

describe('الروابط وقواعد الأمان', () => {
  it('#/show-remote من شاشات العرض (حارس القراءة فقط)', () => {
    expect(isShowHash('#/show-remote')).toBe(true);
    expect(isShowHash('#/show-remotes')).toBe(false);
  });
  it('القواعد: لا استعراض ولا مسارات أخرى، والأوامر معروفة، والرمز 6 أرقام بحد محاولات', () => {
    const raw = Object.values(import.meta.glob('../firebase/database.rules.json', { query: '?raw', import: 'default', eager: true }))[0] as string;
    const rules = JSON.parse(raw).rules;
    for (const k of ['sessions', 'displayKeys', 'codes', 'attempts', 'claims']) expect(rules[k]['.read']).toBeUndefined();
    expect(rules.sessions.$key['.read']).toContain('[A-Za-z0-9_-]{22}');
    expect(rules.sessions.$key.commands.$cmd['.validate']).toContain('next|prev|tour|blackout|goto');
    expect(rules.sessions.$key.$other['.validate']).toBe(false);
    expect(rules.codes.$code['.write']).toContain('^[0-9]{6}$');
    expect(rules.attempts.$uid['.validate']).toContain('<= 5');
    expect(rules.$other).toEqual({ '.read': false, '.write': false });
  });
  it('رابط شاشة العرض يحمل مفتاح العرض فقط، وتحذفه الشاشة من العنوان فور فتحها', () => {
    const dk = 'A'.repeat(22);
    const url = displayUrl(dk, { origin: 'https://x.io', pathname: '/saql-platform/', search: '' });
    expect(url).toBe(`https://x.io/saql-platform/#/show?link=${dk}`);
    const m = new Map<string, string>();
    (globalThis as any).localStorage = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => m.set(k, v), removeItem: (k: string) => m.delete(k) };
    let replaced = '';
    expect(takeDisplayKey({ hash: `#/show?link=${dk}`, pathname: '/p/', search: '' }, (u) => (replaced = u))).toBe(dk);
    expect(replaced).toBe('/p/#/show');
    expect(m.get('show-display-link')).toBe(dk);
    takeDisplayKey({ hash: `#/show?link=${dk}&x=1`, pathname: '/p/', search: '?remote=loopback' }, (u) => (replaced = u));
    expect(replaced).toBe('/p/?remote=loopback#/show?x=1');
    expect(takeDisplayKey({ hash: '#/show', pathname: '/', search: '' }, () => undefined)).toBeNull();
  });
});
