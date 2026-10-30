// محرّر الشرائح: نموذج العناصر وخطواتها، التحويل من الإصدار 1، رفض ما هو خارج الهوية، حسابات السحب والمحاذاة، والتراجع.
import { describe, expect, it } from 'vitest';
import { LOGOS } from '@/show/brand/brand';
import { LOGO_RATIO, isVisibleAt, makeElement, slideStepCount, type SlideElement } from '@/show/slides/model';
import { slideSettings } from '@/show/slides/sanitize';
import { migrateLegacy, templateSettings, TEMPLATES, type TemplateKey } from '@/show/slides/templates';
import { parseConfig, exportConfig } from '@/show/storage';
import { align, bounds, distribute, reorder, resize, resizeElement, rotation, snapMove, snapResize, snapTargets } from '@/show/editor/geometry';
import { COALESCE_MS, HISTORY_LIMIT, external, initHistory, record, redo, undo } from '@/show/editor/history';

const box = (id: string, x: number, y: number, w = 100, h = 100, extra: Partial<SlideElement> = {}) => ({ ...makeElement('shape', id), x, y, w, h, ...extra }) as SlideElement;

describe('خطوات الشريحة', () => {
  it('نقرة لكل عنصر يظهر لاحقاً، وقائمة الأسماء نقرة لكل دفعة', () => {
    expect(slideStepCount({ bg: { kind: 'black' }, mark: false, elements: [] })).toBe(1);
    const els = [makeElement('text', 'a'), makeElement('text', 'b', { step: 2 }), makeElement('names', 'n', { step: 1, props: { names: ['1', '2', '3', '4', '5'], perStep: 2 } })];
    // الأسماء من النقرة 1: ثلاث دفعات (1، 2، 3)، والنص عند 2 → آخر نقرة 3
    expect(slideStepCount({ bg: { kind: 'black' }, mark: false, elements: els })).toBe(4);
  });
  it('الظهور والاختفاء بالنقرات', () => {
    const el = makeElement('text', 'a', { step: 1, until: 3 });
    expect([0, 1, 2, 3].map((s) => isVisibleAt(el, s))).toEqual([false, true, true, false]);
  });
});

describe('القوالب والتحويل من الإصدار 1', () => {
  it('كل قالب ينشئ شريحة صالحة تمر بالتحقق كما هي', () => {
    for (const k of Object.keys(TEMPLATES) as TemplateKey[]) {
      const s = templateSettings(k, 't_' + k, { title: 'عنوان', names: ['أ', 'ب'] });
      expect(slideSettings(JSON.parse(JSON.stringify(s)), 't_' + k), k).toEqual(s);
    }
  });
  it('الأسماء: العنوان أولاً ثم اسم مع كل نقرة، كما في الإصدار 1', () => {
    const [s] = migrateLegacy({ id: 'n', type: 'names', title: 'المكرمون', order: 0, settings: { names: ['أ', 'ب', 'ج'], perStep: 1, columns: 2 } });
    expect(slideStepCount(s.settings)).toBe(1 + 3);
    const title = s.settings.elements.find((e) => e.type === 'text' && e.props.text === 'المكرمون' && e.until === 1);
    expect(title).toBeTruthy();
  });
  it('الصور: شريحة لكل صورة بنفس الترتيب، والشاشة السوداء بلا شعار زاوية', () => {
    const imgs = migrateLegacy({ id: 's', type: 'slides', title: 'صور', order: 3, settings: { fit: 'cover', slides: [{ kind: 'url', src: 'a.png' }, { kind: 'url', src: 'b.png' }] } });
    expect(imgs.map((x) => x.id)).toEqual(['s', 's_2']);
    expect(imgs[1].settings.elements[0]).toMatchObject({ type: 'image', w: 1920, h: 1080, props: { fit: 'cover', media: { src: 'b.png' } } });
    const [black] = migrateLegacy({ id: 'b', type: 'blank', title: 'كلمة', order: 0, settings: { variant: 'black' } });
    expect(black.settings).toMatchObject({ bg: { kind: 'black' }, mark: false, elements: [] });
  });
  it('ملف الإصدار 1 كاملاً يتحول ويُصدَّر ويُستورد بلا فقد', () => {
    const v1 = { schemaVersion: 1, title: 'حفل', segments: [
      { id: 'o', type: 'blank', title: 'الافتتاح', order: 0, settings: { variant: 'logo', caption: 'حفل' } },
      { id: 'v', type: 'video', title: 'فيديو', order: 1, settings: {} },
      { id: 's', type: 'slides', title: 'صور', order: 2, settings: { slides: ['a.png', 'b.png'] } },
      { id: 'd', type: 'demo', title: 'ديمو', order: 3, settings: { scenes: ['plan'] } },
    ] };
    const c = parseConfig(v1);
    expect(c.schemaVersion).toBe(2);
    expect(c.segments.map((s) => s.id)).toEqual(['o', 'v', 's', 's_2', 'd']);
    expect(c.segments.map((s) => s.order)).toEqual([0, 1, 2, 3, 4]);
    expect(parseConfig(exportConfig(c)).segments).toEqual(c.segments);
  });
});

describe('التحقق يرفض ما هو خارج الهوية', () => {
  it('لون أو خط أو وزن غير معتمد يُستبدل بالافتراضي', () => {
    const s = slideSettings({ elements: [{ type: 'text', props: { text: 'x', color: '#ff00ff', font: 'Comic Sans MS', weight: 650 } }, { type: 'shape', props: { fill: 'red', stroke: 'gold' } }], bg: { kind: 'color', color: 'pink' } }, 'z');
    const t = s.elements[0];
    expect(t.type === 'text' && t.props).toMatchObject({ color: 'fg', font: 'Thmanyah Sans', weight: 900 });
    const sh = s.elements[1];
    expect(sh.type === 'shape' && sh.props).toMatchObject({ fill: 'primary', stroke: 'gold' });
    expect(s.bg).toEqual({ kind: 'color', color: 'night' });
  });
  it('الشعار يُعاد إلى قواعده: بلا دوران ولا شفافية ولا ظل وبنسبته', () => {
    const s = slideSettings({ elements: [{ type: 'logo', w: 300, h: 50, rot: 20, opacity: 0.4, shadow: 'lift', props: { kind: 'horizontal' } }] }, 'z');
    expect(s.elements[0]).toMatchObject({ rot: 0, opacity: 1, shadow: 'none', h: 300 / LOGO_RATIO.horizontal });
  });
  it('العناصر غير المعروفة تُهمل والمعرّفات المكررة تُفصل', () => {
    const s = slideSettings({ elements: [{ type: 'iframe' }, { id: 'a', type: 'text' }, { id: 'a', type: 'text' }] }, 'z');
    expect(s.elements.map((e) => e.id)).toEqual(['a', 'a_1']);
  });
});

describe('تغيير الحجم والدوران', () => {
  it('المقبض يحرك جهته وتبقى المقابلة ثابتة', () => {
    expect(resize({ x: 100, y: 100, w: 200, h: 100, rot: 0 }, 'e', 50, 0)).toEqual({ x: 100, y: 100, w: 250, h: 100 });
    expect(resize({ x: 100, y: 100, w: 200, h: 100, rot: 0 }, 'nw', 20, 10)).toEqual({ x: 120, y: 110, w: 180, h: 90 });
  });
  it('مع الدوران تبقى الزاوية المقابلة في مكانها على الشاشة', () => {
    const r = { x: 0, y: 0, w: 200, h: 100, rot: 90 };
    const corner = (q: { x: number; y: number; w: number; h: number }) => {
      // الزاوية العلوية اليسرى المحلية (nw) بعد الدوران 90°
      const cx = q.x + q.w / 2, cy = q.y + q.h / 2;
      return { x: Math.round(cx + q.h / 2), y: Math.round(cy - q.w / 2) };
    };
    const out = resize(r, 'se', 0, 40); // السحب للأسفل يكبّر العرض المحلي عند 90°
    expect(out.w).toBeCloseTo(240);
    expect(corner(out)).toEqual(corner(r));
  });
  it('النسبة ثابتة للشعار، ولا يصغر عن حده الأدنى', () => {
    const logo = { ...makeElement('logo', 'l', { props: { kind: 'horizontal' } }), x: 0, y: 0, w: 400, h: 400 / LOGO_RATIO.horizontal } as SlideElement;
    const r = resizeElement(logo, 'se', 100, 0, false);
    expect(r.w / r.h).toBeCloseTo(LOGO_RATIO.horizontal);
    expect(resizeElement(logo, 'se', -390, 0, false, LOGOS.horizontal.minWidth).w).toBe(400);
  });
  it('الدوران من المركز، مع التقاط 15° وصفر', () => {
    const r = { x: 0, y: 0, w: 100, h: 100 };
    expect(rotation(r, 50, -100, false)).toBe(0);
    expect(rotation(r, 200, 50, false)).toBe(90);
    expect(rotation(r, 150, -40, true) % 15).toBe(0);
  });
  it('المستطيل المحيط بعنصر مدوّر', () => {
    const b = bounds({ x: 0, y: 0, w: 200, h: 100, rot: 90 });
    expect(b.w).toBeCloseTo(100);
    expect(b.h).toBeCloseTo(200);
  });
});

describe('خطوط الإرشاد', () => {
  const t = snapTargets([{ x: 500, y: 300, w: 200, h: 100 }]);
  it('يلتقط منتصف اللوحة وحواف العناصر ضمن المسافة فقط', () => {
    const near = snapMove({ x: 905, y: 20, w: 100, h: 50 }, t, 8); // المنتصف 955 قريب من 960
    expect(near.dx).toBe(5);
    expect(near.guides).toContainEqual({ axis: 'x', at: 960 });
    expect(snapMove({ x: 703, y: 600, w: 10, h: 10 }, t, 8).dx).toBe(-3); // حافة العنصر 700
    expect(snapMove({ x: 300, y: 600, w: 10, h: 10 }, t, 8)).toEqual({ dx: 0, dy: 0, guides: [] });
  });
  it('الهامش الآمن (96) من الخطوط', () => {
    expect(snapMove({ x: 100, y: 500, w: 10, h: 10 }, t, 8).dx).toBe(-4);
  });
  it('تغيير الحجم يلتقط حافة المقبض فقط', () => {
    const r = snapResize({ x: 100, y: 100, w: 857, h: 50 }, 'e', t, 8);
    expect(r.rect.w).toBe(860);
    expect(r.rect.x).toBe(100);
  });
});

describe('المحاذاة والتوزيع والطبقات', () => {
  it('عنصر واحد إلى اللوحة، و«البداية» يمين بالعربية', () => {
    expect(align([box('a', 10, 10)], 'start')[0].x).toBe(1820);
    expect(align([box('a', 10, 10)], 'centerX')[0].x).toBe(910);
    expect(align([box('a', 10, 10)], 'bottom')[0].y).toBe(980);
  });
  it('عدة عناصر إلى مستطيلها الجامع', () => {
    const out = align([box('a', 0, 0), box('b', 300, 50, 50, 50)], 'top');
    expect(out.map((e) => e.y)).toEqual([0, 0]);
  });
  it('التوزيع يساوي المسافات', () => {
    const out = distribute([box('a', 0, 0), box('b', 130, 0), box('c', 400, 0)], 'x');
    expect(out.map((e) => e.x)).toEqual([0, 200, 400]);
  });
  it('ترتيب الطبقات', () => {
    const els = ['a', 'b', 'c', 'd'].map((id) => box(id, 0, 0));
    expect(reorder(els, new Set(['b']), 'front').map((e) => e.id)).toEqual(['a', 'c', 'd', 'b']);
    expect(reorder(els, new Set(['c']), 'back').map((e) => e.id)).toEqual(['c', 'a', 'b', 'd']);
    expect(reorder(els, new Set(['a']), 'up').map((e) => e.id)).toEqual(['b', 'a', 'c', 'd']);
    expect(reorder(els, new Set(['a']), 'down').map((e) => e.id)).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('التراجع والإعادة', () => {
  it('خطوة لكل تعديل، والتعديلات المتتالية على نفس الحقل تُدمج', () => {
    let h = initHistory(0);
    h = record(h, 1, 'x', 1000);
    h = record(h, 2, 'x', 1000 + COALESCE_MS / 2);
    h = record(h, 3, 'y', 1000 + COALESCE_MS);
    expect(h.past).toEqual([0, 2]);
    h = undo(h);
    expect(h.present).toBe(2);
    h = undo(h);
    expect(h.present).toBe(0);
    h = redo(redo(h));
    expect(h.present).toBe(3);
    expect(undo(initHistory(5))).toEqual(initHistory(5));
  });
  it('تعديل جديد بعد التراجع يمسح الإعادة، والسجل محدود', () => {
    let h = record(record(initHistory(0), 1), 2);
    h = record(undo(h), 9);
    expect(h.future).toEqual([]);
    for (let i = 0; i < HISTORY_LIMIT + 20; i++) h = record(h, 100 + i);
    expect(h.past.length).toBe(HISTORY_LIMIT);
  });
  it('تعديل من نافذة أخرى يصبح الحاضر ويبقى السجل', () => {
    const h = external(record(initHistory(0), 1), 7);
    expect(h.present).toBe(7);
    expect(h.past).toEqual([0]);
  });
});
