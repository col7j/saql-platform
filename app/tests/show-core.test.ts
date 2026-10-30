// وضع «عرض الحفل»: ترتيب الفقرات، التنقل، التخزين المنفصل، حارس القراءة فقط، والتزامن
import { describe, expect, it } from 'vitest';
import { DB_VERSION } from '@/data/seed';
import { DEFAULT_CONFIG, DEMO_SCENES, type Segment, type ShowConfig } from '@/show/model';
import { addSegment, clampPos, followSegment, isEnd, moveSegment, next, normalize, prev, removeSegment, skipSegment, sortSegments, stepCount, updateSegment } from '@/show/nav';
import { SHOW_KEY, clearSavedConfig, exportConfig, loadInitialConfig, loadSavedConfig, parseConfig, saveConfig } from '@/show/storage';
import { guardPlatformWrites, isShowHash } from '@/show/guard';
import { createLocalSync, type ShowMessage } from '@/show/sync';

class MemStorage {
  m = new Map<string, string>();
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
}

const seg = (id: string, order: number, extra: Partial<Segment> = {}): Segment => ({ id, type: 'blank', title: id, order, settings: { variant: 'black' }, ...extra }) as Segment;
const cfgOf = (segments: Segment[]): ShowConfig => ({ ...DEFAULT_CONFIG, segments });
const slides = (id: string, order: number, n: number): Segment => ({ id, type: 'slides', title: id, order, settings: { fit: 'contain', slides: Array.from({ length: n }, (_, i) => ({ kind: 'url' as const, src: `s${i}.png` })) } });
const names = (id: string, order: number, list: string[], perStep: number): Segment => ({ id, type: 'names', title: id, order, settings: { heading: '', names: list, perStep, columns: 2 } });

describe('ترتيب الفقرات', () => {
  it('يرتّب حسب order ويثبّت المتساوي بترتيب الإدخال', () => {
    expect(sortSegments([seg('c', 2), seg('a', 0), seg('b1', 1), seg('b2', 1)]).map((s) => s.id)).toEqual(['a', 'b1', 'b2', 'c']);
  });
  it('normalize يعيد الترقيم بلا فجوات', () => {
    expect(normalize([seg('a', 5), seg('b', 10)]).map((s) => s.order)).toEqual([0, 1]);
  });
  it('النقل للأعلى والأسفل وخارج الحدود', () => {
    const list = [seg('a', 0), seg('b', 1), seg('c', 2)];
    expect(sortSegments(moveSegment(list, 'c', 0)).map((s) => s.id)).toEqual(['c', 'a', 'b']);
    expect(sortSegments(moveSegment(list, 'a', 99)).map((s) => s.id)).toEqual(['b', 'c', 'a']);
    expect(sortSegments(moveSegment(list, 'b', -3)).map((s) => s.id)).toEqual(['b', 'a', 'c']);
    expect(moveSegment(list, 'zz', 0).map((s) => s.id)).toEqual(['a', 'b', 'c']);
  });
  it('الإضافة في الآخر بإعدادات افتراضية، والحذف يعيد الترقيم', () => {
    const added = addSegment([seg('a', 0), seg('b', 3)], 'demo', 'ديمو', 'd');
    expect(added[added.length - 1]).toMatchObject({ id: 'd', order: 2, settings: { scenes: [...DEMO_SCENES] } });
    expect(removeSegment(added, 'b').map((s) => [s.id, s.order])).toEqual([['a', 0], ['d', 1]]);
  });
  it('تعديل الاسم والإعدادات لا يمس بقية الفقرات', () => {
    const out = updateSegment([seg('a', 0), seg('b', 1)], 'b', { title: 'جديد', settings: { caption: 'كلمة' } });
    expect(out[1]).toMatchObject({ title: 'جديد', settings: { variant: 'black', caption: 'كلمة' } });
    expect(out[0].title).toBe('a');
  });
});

describe('التنقل بين الفقرات والخطوات', () => {
  const cfg = cfgOf([seg('open', 0), slides('sl', 1, 3), names('nm', 2, ['أ', 'ب', 'ج', 'د', 'هـ'], 2), seg('end', 3)]);
  it('عدد الخطوات لكل نوع', () => {
    expect(stepCount(slides('x', 0, 0))).toBe(1);
    expect(stepCount(slides('x', 0, 3))).toBe(3);
    expect(stepCount(names('x', 0, ['أ', 'ب', 'ج', 'د', 'هـ'], 2))).toBe(4); // العنوان ثم 2+2+1
    expect(stepCount({ ...seg('d', 0), type: 'demo', settings: { scenes: ['calendar', 'plan'] } } as Segment)).toBe(3 + 2);
  });
  it('التالي يمر على كل الخطوات ثم يقف في الآخر', () => {
    let p = { seg: 0, step: 0 };
    const seen = [];
    while (!isEnd(cfg, p)) seen.push((p = next(cfg, p)));
    expect(seen.length).toBe(1 + 3 + 4 + 1 - 1);
    expect(p).toEqual({ seg: 3, step: 0 });
    expect(next(cfg, p)).toEqual(p);
  });
  it('السابق يرجع لآخر خطوة في الفقرة السابقة، ولا ينزل تحت البداية', () => {
    expect(prev(cfg, { seg: 2, step: 0 })).toEqual({ seg: 1, step: 2 });
    expect(prev(cfg, { seg: 0, step: 0 })).toEqual({ seg: 0, step: 0 });
  });
  it('التخطي ينتقل لأول الفقرة التالية', () => {
    expect(skipSegment(cfg, { seg: 1, step: 0 })).toEqual({ seg: 2, step: 0 });
  });
  it('الموضع خارج الحدود يُضبط، والعرض الفارغ لا ينهار', () => {
    expect(clampPos(cfg, { seg: 9, step: 9 })).toEqual({ seg: 3, step: 0 });
    expect(next(cfgOf([]), { seg: 0, step: 0 })).toEqual({ seg: 0, step: 0 });
  });
  it('بعد إعادة الترتيب يبقى العرض على نفس الفقرة', () => {
    const after = { ...cfg, segments: moveSegment(cfg.segments, 'nm', 0) };
    expect(followSegment(cfg, after, { seg: 2, step: 1 })).toEqual({ seg: 0, step: 1 });
    const removed = { ...cfg, segments: removeSegment(cfg.segments, 'nm') };
    expect(followSegment(cfg, removed, { seg: 2, step: 3 })).toEqual({ seg: 2, step: 0 });
  });
});

describe('التخزين المنفصل عن المنصة', () => {
  it('مفتاح خاص لا يبدأ بمفتاح المنصة ولا يعتمد على DB_VERSION', () => {
    expect(SHOW_KEY).toBe('show-config');
    expect(SHOW_KEY.startsWith('saql.')).toBe(false);
    expect(SHOW_KEY).not.toContain(String(DB_VERSION));
  });
  it('الحفظ والقراءة لا يمسان مفاتيح المنصة', () => {
    const s = new MemStorage();
    s.setItem('saql.db.v' + DB_VERSION, '{"x":1}');
    saveConfig(cfgOf([seg('a', 0)]), s);
    expect(loadSavedConfig(s)?.segments.map((x) => x.id)).toEqual(['a']);
    expect(s.getItem('saql.db.v' + DB_VERSION)).toBe('{"x":1}');
    clearSavedConfig(s);
    expect(s.getItem('saql.db.v' + DB_VERSION)).toBe('{"x":1}');
    expect(loadSavedConfig(s)).toBeNull();
  });
  it('إعدادات العرض تبقى بعد رفع نسخة بيانات المنصة', () => {
    const s = new MemStorage();
    saveConfig(cfgOf([seg('keep', 0)]), s);
    s.removeItem('saql.db.v' + DB_VERSION); // ما تفعله المنصة عند رفع النسخة أو إعادة البيانات
    s.setItem('saql.db.v' + (DB_VERSION + 1), '{}');
    expect(loadSavedConfig(s)?.segments[0].id).toBe('keep');
  });
  it('التصدير ثم الاستيراد يعيد نفس الإعدادات', () => {
    const cfg = cfgOf([seg('a', 0), slides('b', 1, 2), names('c', 2, ['سارة', 'محمد'], 1)]);
    expect(parseConfig(exportConfig(cfg)).segments).toEqual(cfg.segments);
  });
  it('الاستيراد يكمل الناقص ويرفض غير الصالح', () => {
    const c = parseConfig({ segments: [{ type: 'video', title: 'مقدمة', settings: { media: 'show-media/intro.mp4' } }, { type: 'names', settings: { names: [' أ ', '', 'ب'], perStep: 0 } }] });
    expect(c.segments[0].settings).toMatchObject({ media: { kind: 'url', src: 'show-media/intro.mp4' }, showSkip: true, autoAdvance: true });
    expect(c.segments[1].settings).toMatchObject({ names: ['أ', 'ب'], perStep: 1 });
    expect(() => parseConfig({ foo: 1 })).toThrow(/segments/);
    expect(() => parseConfig({ segments: [{ type: 'x' }] })).toThrow(/غير معروف/);
    expect(() => parseConfig({ schemaVersion: 99, segments: [] })).toThrow(/أحدث/);
    expect(() => parseConfig('{not json')).toThrow();
  });
  it('المعرّفات المكررة تُفصل', () => {
    const c = parseConfig({ segments: [seg('a', 0), seg('a', 1)] });
    expect(new Set(c.segments.map((s) => s.id)).size).toBe(2);
  });
  it('المحفوظ أولاً، ثم show.json، ثم المدمج', async () => {
    const repo = cfgOf([seg('repo', 0)]);
    const okFetch = (async () => ({ ok: true, json: async () => repo })) as unknown as typeof fetch;
    const badFetch = (async () => { throw new Error('offline'); }) as unknown as typeof fetch;
    const s = new MemStorage();
    expect((await loadInitialConfig(s, okFetch)).segments[0].id).toBe('repo');
    expect((await loadInitialConfig(s, badFetch)).segments).toEqual(DEFAULT_CONFIG.segments);
    saveConfig(cfgOf([seg('saved', 0)]), s);
    expect((await loadInitialConfig(s, okFetch)).segments[0].id).toBe('saved');
    s.setItem(SHOW_KEY, 'تالف');
    expect((await loadInitialConfig(s, okFetch)).segments[0].id).toBe('repo');
  });
});

describe('حارس القراءة فقط في نوافذ العرض', () => {
  it('يتعرف على مسارات العرض فقط', () => {
    expect(isShowHash('#/show')).toBe(true);
    expect(isShowHash('#/show-admin')).toBe(true);
    expect(isShowHash('#/show?x=1')).toBe(true);
    expect(isShowHash('#/showcase')).toBe(false);
    expect(isShowHash('#/app/trips')).toBe(false);
    expect(isShowHash('')).toBe(false);
  });
  it('يمنع الكتابة والحذف والمسح لمفاتيح المنصة ويسمح بمفاتيح العرض', () => {
    class Guarded extends MemStorage {}
    guardPlatformWrites(Guarded.prototype);
    const s = new Guarded();
    s.m.set('saql.db.v12', 'original');
    s.setItem('saql.db.v12', 'changed');
    s.setItem('saql.viewAs', 'x');
    s.removeItem('saql.db.v12');
    s.clear();
    s.setItem(SHOW_KEY, 'ok');
    expect(s.m.get('saql.db.v12')).toBe('original');
    expect(s.m.has('saql.viewAs')).toBe(false);
    expect(s.getItem(SHOW_KEY)).toBe('ok');
  });
});

describe('طبقة التزامن', () => {
  it('رسالة من نافذة تصل للأخرى على نفس القناة', async () => {
    const a = createLocalSync('test-ch');
    const b = createLocalSync('test-ch');
    const got = new Promise<ShowMessage>((r) => b.subscribe(r));
    a.send({ type: 'goto', pos: { seg: 2, step: 1 } });
    expect(await got).toEqual({ type: 'goto', pos: { seg: 2, step: 1 } });
    a.close();
    b.close();
  });
});

describe('مفاتيح الكليكر واللمس', () => {
  it('التالي والسابق بمفاتيح الكليكر والأسهم', async () => {
    const { keyAction } = await import('@/show/keys');
    for (const key of ['PageDown', 'ArrowRight', 'ArrowDown', ' ', 'Enter']) expect(keyAction({ key })).toBe('next');
    for (const key of ['PageUp', 'ArrowLeft', 'ArrowUp', 'Backspace']) expect(keyAction({ key })).toBe('prev');
    expect(keyAction({ key: 'ب', code: 'KeyF' })).toBe('fullscreen'); // F على اللوحة العربية
    expect(keyAction({ key: 'b', code: 'KeyB' })).toBe('blackout');
    expect(keyAction({ key: 'ArrowRight', metaKey: true })).toBeNull();
    expect(keyAction({ key: 'x', code: 'KeyX' })).toBeNull();
  });
  it('السحب يميناً أو النقر يسار الشاشة للتالي', async () => {
    const { touchAction } = await import('@/show/keys');
    expect(touchAction(120, 5, 500, 1000)).toBe('next');
    expect(touchAction(-120, 5, 500, 1000)).toBe('prev');
    expect(touchAction(2, 2, 100, 1000)).toBe('next');
    expect(touchAction(2, 2, 900, 1000)).toBe('prev');
    expect(touchAction(20, 200, 500, 1000)).toBeNull();
  });
});

describe('أدوات الشرائح', () => {
  it('ترتيب طبيعي لملفات PowerPoint ومسارات بنمط مرقّم', async () => {
    const { naturalCompare, expandPattern } = await import('@/show/nav');
    expect(['Slide10.PNG', 'Slide2.PNG', 'Slide1.PNG'].sort(naturalCompare)).toEqual(['Slide1.PNG', 'Slide2.PNG', 'Slide10.PNG']);
    expect(expandPattern('show-media/slides/Slide{n}.PNG', 3)).toEqual(['show-media/slides/Slide1.PNG', 'show-media/slides/Slide2.PNG', 'show-media/slides/Slide3.PNG']);
    expect(expandPattern('show-media/a.png', 9)).toEqual(['show-media/a.png']);
    expect(expandPattern('x{n}', -2)).toEqual([]);
  });
});

describe('مشاهد الديمو', () => {
  it('الخطوات بترتيب المشاهد، وأول كل مشهد معلَّم لعنوانه', async () => {
    const { demoSteps } = await import('@/show/model');
    const steps = demoSteps({ scenes: ['calendar', 'trips', 'focus', 'plan'] });
    expect(steps.map((s) => s.key)).toEqual(['calendar.month', 'calendar.day', 'calendar.event', 'trips.trip', 'trips.docs', 'trips.plans', 'trips.attendance', 'trips.evaluation', 'focus.list', 'focus.detail', 'focus.evaluation', 'plan.wheel', 'plan.goals']);
    expect(steps.filter((s) => s.first).map((s) => s.scene)).toEqual(['calendar', 'trips', 'focus', 'plan']);
  });
  it('القفز بالأرقام إلى أول المشهد، وخارج المشاهد لا شيء', async () => {
    const { sceneStart } = await import('@/show/model');
    const all = { scenes: [...DEMO_SCENES] };
    expect([0, 1, 2, 3].map((n) => sceneStart(all, n))).toEqual([0, 3, 8, 11]);
    expect(sceneStart({ scenes: ['focus', 'plan'] }, 1)).toBe(3);
    expect(sceneStart({ scenes: ['focus', 'plan'] }, 2)).toBeNull();
  });
  it('الإعدادات القديمة (خطوات القائد) تتحول إلى المشاهد الأربعة، والمكرر يُحذف', () => {
    const old = parseConfig({ segments: [{ type: 'demo', title: 'ديمو', settings: { tripId: 't4', steps: ['list', 'focusTrip', 'budget'] } }] });
    expect(old.segments[0].settings).toEqual({ scenes: [...DEMO_SCENES] });
    const picked = parseConfig({ segments: [{ type: 'demo', settings: { scenes: ['plan', 'calendar', 'plan', 'x'] } }] });
    expect(picked.segments[0].settings).toEqual({ scenes: ['plan', 'calendar'] });
  });
  it('الأرقام 1–4 بلوحتي المفاتيح العربية والإنجليزية', async () => {
    const { sceneKey } = await import('@/show/keys');
    expect(sceneKey({ key: '1', code: 'Digit1' })).toBe(0);
    expect(sceneKey({ key: '٤', code: 'Digit4' })).toBe(3);
    expect(sceneKey({ key: '3', code: 'Numpad3' })).toBe(2);
    expect(sceneKey({ key: '5', code: 'Digit5' })).toBeNull();
    expect(sceneKey({ key: '1', code: 'Digit1', metaKey: true })).toBeNull();
  });
});
