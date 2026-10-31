// شرائح الحفل الجاهزة: «التعريف بالبرنامج» (11 شريحة بنصوص ملف «صقل 7 — اللقاء الافتتاحي» وتسلسله،
// معاد تصميمها بهوية المنصة: ألوان وخطوط ملف الهوية فقط، لا ألوان الملف الأصلي ولا خطوطه ولا صوره)،
// وقوالب فقرات الحفل: الترحيب، القرآن، كلمة الجمعية، الكيكة، الختام. كلها شرائح حرة قابلة للتعديل في المحرّر.
import { CANVAS, LOGOS, SAFE_MARGIN, TYPE_SCALE } from '../brand/brand';
import { QURAN_FONT } from '../brand/brand';
import type { MediaRef, Section, SlideSegment } from '../model';
import { LOGO_RATIO, makeElement, type AnimType, type ColorRef, type Fill, type SlideElement, type SlideSettings } from '../slides/model';

const W = CANVAS.w;
const H = CANVAS.h;
const M = SAFE_MARGIN;

type Ctx = { id: (n: number) => string; n: number };
const ctx = (base: string): Ctx => ({ id: (n) => `${base}_e${n}`, n: 0 });

interface TextOpt {
  x?: number;
  y: number;
  w?: number;
  h: number;
  size: number;
  weight?: number;
  color?: ColorRef;
  align?: 'start' | 'center' | 'end';
  line?: number;
  step?: number;
  until?: number;
  anim?: AnimType;
  delay?: number;
  dur?: number;
  font?: string;
  name?: string;
}
function T(c: Ctx, text: string, o: TextOpt): SlideElement {
  return makeElement('text', c.id(++c.n), {
    x: o.x ?? M,
    y: o.y,
    w: o.w ?? W - (o.x ?? M) * 2,
    h: o.h,
    step: o.step ?? 0,
    ...(o.until !== undefined ? { until: o.until } : {}),
    ...(o.name ? { name: o.name } : {}),
    anim: { type: o.anim ?? 'up', delay: o.delay ?? 0, duration: o.dur ?? 1000 },
    props: { text, size: o.size, weight: o.weight ?? 700, color: o.color ?? 'fg', align: o.align ?? 'center', line: o.line ?? (o.size >= 60 ? 1.2 : 1.5), ...(o.font ? { font: o.font } : {}) },
  });
}
interface ShapeOpt {
  x: number;
  y: number;
  w: number;
  h: number;
  fill?: Fill;
  stroke?: ColorRef | 'none';
  sw?: number;
  radius?: number;
  opacity?: number;
  step?: number;
  anim?: AnimType;
  delay?: number;
  dur?: number;
  shape?: 'rect' | 'circle' | 'line';
}
function S(c: Ctx, o: ShapeOpt): SlideElement {
  return makeElement('shape', c.id(++c.n), {
    x: o.x,
    y: o.y,
    w: o.w,
    h: o.h,
    opacity: o.opacity ?? 1,
    step: o.step ?? 0,
    anim: { type: o.anim ?? 'fade', delay: o.delay ?? 0, duration: o.dur ?? 900 },
    props: { shape: o.shape ?? 'rect', fill: o.fill ?? 'primary', stroke: o.stroke ?? 'none', strokeWidth: o.sw ?? 4, radius: o.radius ?? 32 },
  });
}
/** الخط الذهبي الفاصل */
const rule = (c: Ctx, y: number, w = 160, delay = 300, step = 0, x = (W - w) / 2) => S(c, { x, y, w, h: 8, fill: 'gradGold', radius: 999, anim: 'wipe', delay, step });
/** تذييل الشرائح الداخلية */
const footer = (c: Ctx) => T(c, 'صقل 7 · اللقاء الافتتاحي', { x: W - M - 700, y: H - 92, w: 700, h: 46, size: 30, weight: 500, align: 'start', anim: 'fade', delay: 900, color: 'fg' });
/** تمهيد العنوان (ذهبي) والعنوان */
function heading(c: Ctx, kicker: string, title: string, y = 70) {
  return [
    T(c, kicker, { y, h: 60, size: 40, weight: 700, color: 'em' }),
    T(c, title, { y: y + 62, h: 130, size: 96, weight: 900, color: 'head', delay: 150 }),
  ];
}
const slide = (elements: SlideElement[], over: Partial<SlideSettings> = {}): SlideSettings => ({ bg: { kind: 'theme', glow: true }, mark: true, elements, ...over });
const seg = (id: string, title: string, settings: SlideSettings, section?: Section): SlideSegment => ({ id, type: 'slide', title, order: 0, settings, ...(section ? { section } : {}) });

// ───────────── التعريف بالبرنامج ─────────────

function s1(id: string): SlideSettings {
  const c = ctx(id);
  return slide(
    [
      T(c, 'هلا بك في', { y: 230, h: 90, size: 64, weight: 500, delay: 100 }),
      T(c, 'صقل', { x: 760, y: 320, w: 900, h: 330, size: 300, weight: 900, color: 'head', anim: 'scale', delay: 450, dur: 1400, line: 1, align: 'end' }),
      T(c, '7', { x: 520, y: 320, w: 220, h: 330, size: 300, weight: 900, color: 'em', anim: 'scale', delay: 1100, dur: 1300, line: 1 }),
      rule(c, 700, 260, 1600),
      T(c, 'اللقاء الافتتاحي · برنامج التأهيل القيادي', { y: 740, h: 90, size: 52, weight: 500, delay: 1800 }),
    ],
    { mark: true },
  );
}

function s2(id: string): SlideSettings {
  const c = ctx(id);
  return slide([
    T(c, 'في اللغة', { y: 200, h: 70, size: 44, weight: 700, color: 'em' }),
    T(c, 'صَقَلَ', { y: 290, h: 300, size: 260, weight: 900, color: 'head', anim: 'scale', delay: 250, dur: 1400, line: 1.05 }),
    rule(c, 640, 200, 900),
    T(c, 'الشيءَ: جَلّاه، وأزال عنه الصدأَ والكَدَر', { y: 690, h: 110, size: 64, weight: 500, delay: 1100 }),
  ]);
}

function s3(id: string): SlideSettings {
  const c = ctx(id);
  return slide([
    T(c, 'ولهذا كانت المقابلات الشخصية', { y: 210, h: 70, size: 44, weight: 700, color: 'em' }),
    T(c, '«انتقينا معادنَ نفيسة»', { y: 320, h: 170, size: 128, weight: 900, color: 'head', anim: 'scale', delay: 250, dur: 1300 }),
    rule(c, 540, 200, 700),
    T(c, 'وجاء صقل ليجلوها؛\nفتزداد المهاراتُ إتقانًا، والشخصياتُ صفاءً', { x: 260, y: 600, w: W - 520, h: 220, size: 58, weight: 500, line: 1.55, step: 1 }),
  ]);
}

function s4(id: string): SlideSettings {
  const c = ctx(id);
  const pillars: [string, string][] = [['مهارات', 'عملية'], ['علاقات', 'مميزة وقوية'], ['معرفة', 'نظرية'], ['قيادة', 'إيجابية']];
  const cw = 360;
  const gap = 44;
  const total = cw * 4 + gap * 3;
  const els: SlideElement[] = [...heading(c, 'أربع ركائز', 'ما صقل؟')];
  pillars.forEach(([word, sub], i) => {
    // من اليمين إلى اليسار
    const x = W - (W - total) / 2 - cw - i * (cw + gap);
    const d = 500 + i * 220;
    els.push(
      S(c, { x, y: 380, w: cw, h: 420, fill: 'primary', opacity: 0.22, radius: 44, anim: 'up', delay: d }),
      S(c, { x: x + 40, y: 420, w: 80, h: 10, fill: 'gradGold', radius: 999, anim: 'wipe', delay: d + 250 }),
      T(c, word, { x: x + 30, y: 500, w: cw - 60, h: 120, size: 88, weight: 900, color: 'head', delay: d + 150 }),
      T(c, sub, { x: x + 30, y: 640, w: cw - 60, h: 70, size: 44, weight: 500, delay: d + 300 }),
    );
  });
  els.push(footer(c));
  return slide(els);
}

function s5(id: string): SlideSettings {
  const c = ctx(id);
  return slide([
    T(c, 'في صقل، لا نصنع', { y: 220, h: 90, size: 60, weight: 500 }),
    T(c, 'القائدَ الوظيفي', { y: 320, h: 160, size: 120, weight: 900, color: 'head', delay: 250 }),
    S(c, { x: 560, y: 400, w: 800, h: 12, fill: 'em2', radius: 999, anim: 'wipe', step: 1, dur: 700 }),
    T(c, 'بل نصنع', { y: 560, h: 90, size: 60, weight: 500, step: 2 }),
    T(c, 'القائدَ الإنسان', { y: 660, h: 190, size: 150, weight: 900, color: 'em', step: 3, anim: 'scale', dur: 1300 }),
  ]);
}

function s6(id: string): SlideSettings {
  const c = ctx(id);
  // دائرة كبرى (المركز 960،640) وثلاث دوائر داخلها، تظهر واحدة واحدة
  const R = 400;
  const r = 165;
  const cx = 960;
  const cy = 650;
  const at = (deg: number) => ({ x: cx + 200 * Math.cos((deg * Math.PI) / 180), y: cy + 200 * Math.sin((deg * Math.PI) / 180) });
  const circles: [string, number][] = [['مع النفس', -90], ['مع الفريق', 30], ['مع الناس', 150]];
  const els: SlideElement[] = [
    T(c, 'حيث ينمو القائد', { y: 50, h: 60, size: 40, weight: 700, color: 'em' }),
    T(c, 'دوائر النمو', { y: 110, h: 120, size: 88, weight: 900, color: 'head', delay: 150 }),
    S(c, { shape: 'circle', x: cx - R, y: cy - R, w: R * 2, h: R * 2, fill: 'primary', opacity: 0.16, stroke: 'em', sw: 6, anim: 'scale', delay: 300, dur: 1200 }),
  ];
  circles.forEach(([label, deg], i) => {
    const p = at(deg);
    els.push(
      S(c, { shape: 'circle', x: p.x - r, y: p.y - r, w: r * 2, h: r * 2, fill: i === 0 ? 'gradGold' : i === 1 ? 'gradTeal' : 'em2', opacity: 0.92, step: i + 1, anim: 'scale', dur: 1000 }),
      T(c, label, { x: p.x - r, y: p.y - 45, w: r * 2, h: 90, size: 50, weight: 900, color: i === 0 ? 'ink' : 'white', step: i + 1, delay: 250 }),
    );
  });
  return slide(els);
}

function s7(id: string): SlideSettings {
  const c = ctx(id);
  const cx = 960;
  const cy = 680;
  const R = 270;
  const r = 130;
  const nodes: [string, number][] = [['تعلُّم', -90], ['تجربة', 30], ['تقييم', 150]];
  const pt = (deg: number, rad = R) => ({ x: cx + rad * Math.cos((deg * Math.PI) / 180), y: cy + rad * Math.sin((deg * Math.PI) / 180) });
  const els: SlideElement[] = [
    T(c, 'كيف نتعلّم القيادة', { y: 50, h: 60, size: 40, weight: 700, color: 'em' }),
    T(c, 'رحلة القائد في صقل', { y: 110, h: 120, size: 88, weight: 900, color: 'head', delay: 150 }),
    // الحلقة المتصلة
    S(c, { shape: 'circle', x: cx - R, y: cy - R, w: R * 2, h: R * 2, fill: 'none', stroke: 'em', sw: 8, anim: 'scale', delay: 300, dur: 1200 }),
  ];
  nodes.forEach(([label, deg], i) => {
    const p = pt(deg);
    els.push(
      S(c, { shape: 'circle', x: p.x - r, y: p.y - r, w: r * 2, h: r * 2, fill: 'gradTeal', step: i + 1, anim: 'scale', dur: 900 }),
      T(c, label, { x: p.x - r, y: p.y - 45, w: r * 2, h: 90, size: 56, weight: 900, color: 'white', step: i + 1, delay: 200 }),
    );
    // نقطة اتجاه بين كل عقدتين على الحلقة
    const m = pt(deg + 60);
    els.push(S(c, { shape: 'circle', x: m.x - 18, y: m.y - 18, w: 36, h: 36, fill: 'gradGold', step: i + 1, anim: 'scale', delay: 450 }));
  });
  els.push(footer(c));
  return slide(els);
}

function s8(id: string): SlideSettings {
  const c = ctx(id);
  const steps: [string, string][] = [
    ['الخطة الشخصية\nوالميسّر', 'توجيهٌ شخصي،\nوتخطيطٌ متوازن'],
    ['لقاءات\nالتركيز', 'لبناتٌ معرفية\nومهارية شاملة'],
    ['ورشٌ ودورات\nتأسيسية', 'تأسيسٌ نظريّ\nللقيادة'],
    ['رحلات داخل\nالمدينة', 'تقودها المجموعات:\nتجربةٌ قيادية أولى مع الفريق'],
    ['سفرتان خارج\nالمدينة', 'تقودها المجموعات:\nتجربةٌ قيادية فعلية'],
  ];
  const cw = 318;
  const gap = 26;
  const total = cw * 5 + gap * 4;
  const base = 960;
  const els: SlideElement[] = [...heading(c, 'مراحل البرنامج', 'خطواتٌ متدرّجة', 50)];
  steps.forEach(([title, sub], i) => {
    // درج تصاعدي من اليمين: كل مرحلة أعلى من سابقتها
    const x = W - (W - total) / 2 - cw - i * (cw + gap);
    const h = 330 + i * 75;
    const y = base - h;
    els.push(
      S(c, { x, y, w: cw, h, fill: i === 4 ? 'gradTeal' : 'primary', opacity: i === 4 ? 1 : 0.24 + i * 0.1, radius: 36, step: i + 1, anim: 'up', dur: 900 }),
      T(c, ['١', '٢', '٣', '٤', '٥'][i], { x: x + 24, y: y + 26, w: 90, h: 90, size: 72, weight: 900, color: 'em', align: 'start', step: i + 1, delay: 200 }),
      T(c, title, { x: x + 24, y: y + 126, w: cw - 48, h: 110, size: 40, weight: 900, color: 'head', align: 'start', line: 1.3, step: i + 1, delay: 300 }),
      T(c, sub, { x: x + 24, y: y + 240, w: cw - 48, h: 140, size: 30, weight: 500, align: 'start', line: 1.45, step: i + 1, delay: 420 }),
    );
  });
  els.push(footer(c));
  return slide(els);
}

function s9(id: string): SlideSettings {
  const c = ctx(id);
  // الأشهر من اليمين: لكل شهر موعد وعنوان، وملاحظة الإجازات تحت اسم الشهر
  const months: { name: string; note?: string; items: [string, string][] }[] = [
    { name: 'أكتوبر', items: [['31', 'اللقاء الافتتاحي']] },
    { name: 'نوفمبر', items: [['7 · لقاء', 'عجلة الحياة والتخطيط الشخصي'], ['14 · لقاء', 'كيف تخطط لرحلة، وزاد السفر'], ['19–21 · رحلة القيادة', 'ينبع: القيادة والمهارات'], ['28', 'رحلة المجموعة 1']] },
    { name: 'ديسمبر', items: [['5', 'رحلة المجموعة 2'], ['12', 'رحلة المجموعة 3'], ['19', 'رحلة المجموعة 4'], ['26 · توقّف', 'اختبارات نهائية']] },
    { name: 'يناير', note: 'إجازة 7–17', items: [['2 · توقّف', 'اختبارات نهائية'], ['7–10', 'الرحلة الخارجية الأولى']] },
    { name: 'فبراير', note: 'رمضان 8', items: [['4–7 · قبل رمضان', 'الرحلة الخارجية الثانية'], ['13', 'رمضانية لكل مجموعة'], ['20', 'رمضانية لكل مجموعة'], ['27', 'العشر الأواخر']] },
    { name: 'مارس', note: 'العيد 9', items: [['6', 'العشر الأواخر'], ['13', 'إجازة العيد'], ['20', 'حفل الختام وحصاد الرحلة']] },
  ];
  const gap = 18;
  const cw = (W - 2 * 72 - gap * 5) / 6;
  const els: SlideElement[] = [
    T(c, 'من أكتوبر إلى مارس', { y: 36, h: 56, size: 38, weight: 700, color: 'em' }),
    T(c, 'جدول الرحلة', { y: 90, h: 110, size: 84, weight: 900, color: 'head', delay: 150 }),
  ];
  months.forEach((m, i) => {
    const x = W - 72 - cw - i * (cw + gap);
    const d = 300 + i * 160;
    els.push(
      S(c, { x, y: 225, w: cw, h: 790, fill: 'primary', opacity: 0.16, radius: 30, anim: 'up', delay: d }),
      S(c, { x: x + 18, y: 243, w: cw - 36, h: 74, fill: 'gradTeal', radius: 999, anim: 'fade', delay: d + 100 }),
      T(c, m.name, { x: x + 18, y: 249, w: cw - 36, h: 62, size: 40, weight: 900, color: 'white', delay: d + 150 }),
    );
    let y = 335;
    if (m.note) {
      els.push(T(c, m.note, { x: x + 18, y, w: cw - 36, h: 46, size: 30, weight: 700, color: 'em2', delay: d + 200 }));
      y += 54;
    }
    // ارتفاع كل سطر بحسب طول نصه (تقدير عرض الحرف بنصف حجم الخط)، فلا يتراكب موعد طويل مع ما تحته
    const lines = (t: string, size: number) => Math.max(1, Math.ceil((t.length * size * 0.5) / (cw - 40)));
    const slot = (1035 - y) / m.items.length;
    for (const [when, what] of m.items) {
      const hw = lines(when, 32) * 44;
      const hd = lines(what, 30) * 41;
      els.push(
        T(c, when, { x: x + 20, y, w: cw - 40, h: hw, size: 32, weight: 900, color: 'em', align: 'start', line: 1.3, delay: d + 250 }),
        T(c, what, { x: x + 20, y: y + hw, w: cw - 40, h: hd, size: 30, weight: 500, align: 'start', line: 1.35, delay: d + 300 }),
      );
      y += Math.min(Math.max(hw + hd + 26, 150), Math.max(hw + hd + 14, slot));
    }
  });
  return slide(els, { mark: false });
}

function s10(id: string): SlideSettings {
  const c = ctx(id);
  const roles: [string, string][] = [
    ['يتأمَّل', 'تجاربه وتجارب الآخرين، ويفيد منها'],
    ['يتعاوَن', 'ويبني علاقاتٍ عميقة'],
    ['يُبادِر', 'ويشارك، ويجرّب نفسه'],
    ['يُكوِّن', 'معرفةً تأسيسية'],
  ];
  const cw = 780;
  const ch = 280;
  const gx = 40;
  const gy = 36;
  const x0 = (W - (cw * 2 + gx)) / 2;
  const els: SlideElement[] = [...heading(c, 'الأدوار المطلوبة', 'القائد في صقل', 50)];
  roles.forEach(([verb, desc], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    // الأول في اليمين
    const x = x0 + (1 - col) * (cw + gx);
    const y = 300 + row * (ch + gy);
    const d = 400 + i * 200;
    els.push(
      S(c, { x, y, w: cw, h: ch, fill: 'primary', opacity: 0.2, radius: 40, anim: 'up', delay: d }),
      S(c, { x: x + cw - 16, y: y + 40, w: 10, h: ch - 80, fill: 'gradGold', radius: 999, anim: 'fade', delay: d + 200 }),
      T(c, verb, { x: x + 50, y: y + 46, w: cw - 110, h: 110, size: 84, weight: 900, color: 'head', align: 'start', delay: d + 150 }),
      T(c, desc, { x: x + 50, y: y + 166, w: cw - 110, h: 80, size: 42, weight: 500, align: 'start', delay: d + 300 }),
    );
  });
  els.push(footer(c));
  return slide(els);
}

function s11(id: string): SlideSettings {
  const c = ctx(id);
  return slide([
    T(c, 'لا نطمح أن تتشابه النهايات', { y: 250, h: 100, size: 66, weight: 500 }),
    T(c, 'بل أن يخرج كلُّ مشارك', { y: 360, h: 100, size: 66, weight: 500, delay: 500 }),
    rule(c, 500, 200, 1000),
    T(c, 'بنسخةٍ أفضلَ من نفسه', { y: 560, h: 200, size: 150, weight: 900, color: 'em', anim: 'scale', delay: 1200, dur: 1500 }),
  ]);
}

export const PROGRAM_SLIDES: [string, (id: string) => SlideSettings][] = [
  ['صقل 7', s1],
  ['في اللغة', s2],
  ['المقابلات الشخصية', s3],
  ['ما صقل؟', s4],
  ['الفلسفة', s5],
  ['دوائر النمو', s6],
  ['رحلة القائد', s7],
  ['خطوات متدرّجة', s8],
  ['جدول الرحلة', s9],
  ['القائد في صقل', s10],
  ['الختام', s11],
];

/** الشرائح الإحدى عشرة لفقرة «التعريف بالبرنامج»، والأولى تبدأ الفقرة في جدول الحفل */
export function programSegments(base: string, section?: Section): SlideSegment[] {
  return PROGRAM_SLIDES.map(([title, fn], i) => seg(`${base}_${i + 1}`, title, fn(`${base}_${i + 1}`), i === 0 ? section : undefined));
}

// ───────────── قوالب فقرات الحفل ─────────────

export interface CeremonyInput {
  org?: string;
  orgLogo?: MediaRef;
  title?: string;
  speaker?: string;
  role?: string;
  verse?: string;
  reader?: string;
}

/** الترحيب: شعار الجمعية الكبير واسمها وعنوان الحفل بدخول سينمائي */
export function welcomeSettings(id: string, i: CeremonyInput = {}): SlideSettings {
  const c = ctx(id);
  return slide([
    i.orgLogo
      ? makeElement('image', c.id(++c.n), { x: (W - 560) / 2, y: 110, w: 560, h: 360, anim: { type: 'scale', delay: 200, duration: 1800 }, name: 'شعار الجمعية', props: { media: i.orgLogo, fit: 'contain', radius: 0 } })
      : makeElement('logo', c.id(++c.n), { x: (W - 340 * LOGO_RATIO.vertical) / 2, y: 120, w: Math.round(340 * LOGO_RATIO.vertical), h: 340, anim: { type: 'scale', delay: 200, duration: 1800 }, name: 'الشعار (استبدله بشعار الجمعية)', props: { kind: 'vertical', variant: 'auto' } }),
    T(c, i.org || 'اسم الجمعية', { y: 500, h: 90, size: 60, weight: 700, delay: 1100, name: 'اسم الجمعية' }),
    rule(c, 630, 220, 1700),
    T(c, i.title || 'اللقاء الافتتاحي · صقل 7', { y: 680, h: 150, size: 110, weight: 900, color: 'head', delay: 2000, dur: 1300, name: 'عنوان الحفل' }),
    T(c, 'أهلاً وسهلاً بكم', { y: 860, h: 80, size: 48, weight: 500, delay: 2600, name: 'الترحيب' }),
  ]);
}

/** القرآن الكريم: شاشة هادئة، والآية بخط المصحف مع اسم القارئ */
export function quranSettings(id: string, i: CeremonyInput = {}): SlideSettings {
  const c = ctx(id);
  return slide(
    [
      T(c, 'تلاوة آيات من القرآن الكريم', { y: 170, h: 70, size: 44, weight: 700, color: 'em', anim: 'fade', dur: 1600 }),
      T(c, i.verse || 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ', { x: 200, y: 330, w: W - 400, h: 360, size: 104, weight: 400, color: 'head', anim: 'fade', delay: 500, dur: 2200, line: 1.7, font: QURAN_FONT, name: 'الآية' }),
      rule(c, 760, 120, 1500),
      T(c, i.reader ? `القارئ: ${i.reader}` : 'القارئ', { y: 800, h: 80, size: 46, weight: 500, anim: 'fade', delay: 1800, dur: 1400, name: 'اسم القارئ' }),
    ],
    { bg: { kind: 'theme', glow: false } },
  );
}

/** كلمة الجمعية: الشعار واسم المتحدث وصفته */
export function speakerSettings(id: string, i: CeremonyInput = {}): SlideSettings {
  const c = ctx(id);
  return slide([
    i.orgLogo
      ? makeElement('image', c.id(++c.n), { x: (W - 460) / 2, y: 150, w: 460, h: 300, anim: { type: 'scale', delay: 100, duration: 1500 }, name: 'شعار الجمعية', props: { media: i.orgLogo, fit: 'contain', radius: 0 } })
      : makeElement('logo', c.id(++c.n), { x: (W - 290 * LOGO_RATIO.vertical) / 2, y: 160, w: Math.round(290 * LOGO_RATIO.vertical), h: 290, anim: { type: 'scale', delay: 100, duration: 1500 }, name: 'الشعار (استبدله بشعار الجمعية)', props: { kind: 'vertical', variant: 'auto' } }),
    T(c, 'كلمة الجمعية', { y: 500, h: 70, size: 44, weight: 700, color: 'em', delay: 600 }),
    T(c, i.speaker || 'اسم المتحدث', { y: 580, h: 150, size: 110, weight: 900, color: 'head', delay: 800, name: 'اسم المتحدث' }),
    rule(c, 750, 160, 1200),
    T(c, i.role || 'صفة المتحدث', { y: 790, h: 90, size: 52, weight: 500, delay: 1400, name: 'صفة المتحدث' }),
  ]);
}

/** كيكة التدشين: قصاصات احتفالية وتوهّج، ورقم النسخة يعدّ حتى 7 */
export function celebrationSettings(id: string): SlideSettings {
  const c = ctx(id);
  return slide(
    [
      T(c, 'صقل', { y: 130, h: 90, size: 60, weight: 700, color: 'em' }),
      makeElement('counter', c.id(++c.n), { x: (W - 600) / 2, y: 210, w: 600, h: 420, anim: { type: 'scale', delay: 300, duration: 1200 }, props: { from: 1, to: 7, duration: 2200, size: 400, color: 'em', weight: 900 } }),
      T(c, 'النسخة السابعة', { y: 640, h: 160, size: 130, weight: 900, color: 'head', delay: 2400, anim: 'scale', dur: 1300 }),
      T(c, 'نحتفل معاً بانطلاقتها', { y: 820, h: 80, size: 50, weight: 500, delay: 2900 }),
    ],
    { fx: 'confetti' },
  );
}

/** الختام والشكر: الشعار، وعبارة الختام، وشعارات الشركاء */
export function closingSettings(id: string): SlideSettings {
  const c = ctx(id);
  const h = 230;
  return slide(
    [
      makeElement('logo', c.id(++c.n), { x: (W - h * LOGO_RATIO.vertical) / 2, y: 110, w: Math.round(h * LOGO_RATIO.vertical), h, props: { kind: 'vertical', variant: 'auto' } }),
      T(c, 'شكراً لحضوركم', { y: 380, h: 140, size: 110, weight: 900, color: 'head', delay: 300 }),
      rule(c, 530, 180, 700),
      T(c, 'ونلتقي في رحلة صقل 7', { y: 560, h: 80, size: 52, weight: 500, delay: 900 }),
      makeElement('logoGrid', c.id(++c.n), { x: M * 2, y: 690, w: W - M * 4, h: 330, anim: { type: 'fade', delay: 1200, duration: 800 }, name: 'شعارات الشركاء', props: { tiers: [{ title: 'شركاء النجاح', size: 'md', logos: [] }] } }),
    ],
    { mark: false },
  );
}

export const LOGO_SRC = LOGOS;
export const TYPE = TYPE_SCALE;
