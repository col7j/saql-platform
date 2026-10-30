/// <reference types="vite/client" />
// التحكم من الجوال: بروتوكول الجلسة فوق خادم وهمي يحاكي قواعد الأمان، وتحويل الأوامر والحالة، وضم القنوات.
import { describe, expect, it } from 'vitest';
import { CODE_RE, SESSION_MS, joinSession, openSession, parseCommand, type RemoteState } from '@/show/remote/protocol';
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

describe('الجلسة والرمز', () => {
  it('شاشة العرض تحجز رمزاً من 4 أرقام', async () => {
    const db = new FakeDB();
    const s = await openSession(db.client('display'));
    expect(s.code).toMatch(CODE_RE);
    expect(db.session(s.code).owner).toBe('display');
    expect(db.session(s.code).expiresAt - db.clock).toBeGreaterThan(SESSION_MS - 1000);
  });
  it('رمز مستخدم في جلسة نشطة لا يُحجز مرة ثانية، والمنتهي يُعاد استخدامه', async () => {
    const db = new FakeDB();
    const seq = (vals: number[]) => () => vals.shift() ?? 0.9;
    const a = await openSession(db.client('A'), seq([0.1234]));
    const b = await openSession(db.client('B'), seq([0.1234, 0.5678]));
    expect([a.code, b.code]).toEqual(['1234', '5678']);
    db.clock += SESSION_MS + 1;
    const c = await openSession(db.client('C'), seq([0.1234]));
    expect(c.code).toBe('1234');
    expect(db.session('1234').owner).toBe('C');
  });
});

describe('الجوال', () => {
  it('الرمز الخاطئ أو المنتهي يُرفض، والصحيح يتصل ويرى الحالة', async () => {
    const db = new FakeDB();
    const d = await openSession(db.client('display'));
    await expect(joinSession(db.client('phone'), '12')).rejects.toMatchObject({ code: 'invalid' });
    const wrong = d.code === '0000' ? '0001' : '0000';
    await expect(joinSession(db.client('phone'), wrong)).rejects.toMatchObject({ code: 'invalid' });
    const r = await joinSession(db.client('phone'), d.code);
    const seen: (RemoteState | null)[] = [];
    r.onState((s) => seen.push(s));
    await d.publish(state(1));
    await tick();
    expect(seen[seen.length - 1]).toMatchObject({ seg: 1, title: 'الافتتاح' });
    db.clock += SESSION_MS + 1;
    await expect(joinSession(db.client('late'), d.code)).rejects.toMatchObject({ code: 'invalid' });
  });
  it('الأوامر تصل لشاشة العرض مرة واحدة ثم تُحذف، وغير المسجّل لا يرسل', async () => {
    const db = new FakeDB();
    const d = await openSession(db.client('display'));
    const got: unknown[] = [];
    d.onCommand((c) => got.push(c));
    const r = await joinSession(db.client('phone'), d.code);
    await r.send({ type: 'next' });
    await r.send({ type: 'goto', seg: 3 });
    await tick();
    expect(got).toEqual([{ type: 'next' }, { type: 'goto', seg: 3 }]);
    expect(db.session(d.code).commands ?? {}).toEqual({});
    const stranger = db.client('stranger');
    await expect(stranger.push(`sessions/${d.code}/commands`, { type: 'next', uid: 'stranger', at: 1 })).rejects.toThrow(/PERMISSION/);
  });
  it('أوامر متتالية تُنفّذ بترتيب إرسالها حتى لو وصلت معاً (الحذف لا يسبق التنفيذ)', async () => {
    const db = new FakeDB();
    const d = await openSession(db.client('display'));
    await joinSession(db.client('phone'), d.code);
    const got: unknown[] = [];
    d.onCommand((c) => got.push(c.type));
    // ثلاثة أوامر تصل في كتابة واحدة (كما بين تبويبين أو من Firebase)
    const data = db.data;
    data.sessions[d.code].commands = {
      a: { type: 'blackout', uid: 'phone', at: 1 },
      b: { type: 'goto', seg: 2, uid: 'phone', at: 2 },
      c: { type: 'next', uid: 'phone', at: 3 },
    };
    db.store.write(data);
    await tick();
    expect(got).toEqual(['blackout', 'goto', 'next']);
    expect(db.session(d.code).commands ?? {}).toEqual({});
  });
  it('عدد الأجوال المتصلة، ورمز جديد يفصلها كلها', async () => {
    const db = new FakeDB();
    const d = await openSession(db.client('display'));
    const counts: number[] = [];
    d.onRemotes((n) => counts.push(n));
    const r1 = await joinSession(db.client('p1'), d.code);
    await joinSession(db.client('p2'), d.code);
    expect(counts[counts.length - 1]).toBe(2);
    const ended: unknown[] = [];
    r1.onState((s) => ended.push(s));
    await d.close();
    await tick();
    expect(ended[ended.length - 1]).toBeNull();
    await expect(r1.send({ type: 'next' })).rejects.toThrow(/PERMISSION/);
  });
  it('غير صاحب الجلسة لا يغيّر حالتها ولا يحذفها', async () => {
    const db = new FakeDB();
    const d = await openSession(db.client('display'));
    const phone = db.client('phone');
    await joinSession(phone, d.code);
    await expect(phone.set(`sessions/${d.code}/state`, state())).rejects.toThrow(/PERMISSION/);
    await expect(phone.remove(`sessions/${d.code}`)).rejects.toThrow(/PERMISSION/);
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
    const sync = createRemoteSync({ code: '1111', publish: async (s) => void published.push(s), onCommand: () => () => undefined, onRemotes: () => () => undefined, close: async () => undefined });
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
  it('القواعد تحصر الأوامر في الأنواع المعروفة والرمز في 4 أرقام، وترفض أي مسار آخر', () => {
    const raw = Object.values(import.meta.glob('../firebase/database.rules.json', { query: '?raw', import: 'default', eager: true }))[0] as string;
    const rules = JSON.parse(raw).rules;
    const s = rules.sessions.$code;
    expect(s['.write']).toContain("matches(/^[0-9]{4}$/)");
    expect(s.commands.$cmd['.validate']).toContain('next|prev|tour|blackout|goto');
    expect(s.$other['.validate']).toBe(false);
    expect(rules.$other).toEqual({ '.read': false, '.write': false });
    for (const t of ['next', 'prev', 'tour', 'blackout']) expect(parseCommand({ type: t })).not.toBeNull();
  });
});
