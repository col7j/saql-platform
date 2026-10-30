// القوالب الجاهزة: كل قالب ينشئ شريحة عادية قابلة للتعديل بالكامل. أنواع فقرات الإصدار 1
// (فيديو، صور، أسماء، شاشة المتحدث) تتحول إلى هذه القوالب نفسها عند قراءة إعدادات قديمة.
import { CANVAS, SAFE_MARGIN, TYPE_SCALE } from '../brand/brand';
import type { LegacySegment, MediaRef, SlideSegment } from '../model';
import { LOGO_RATIO, makeElement, noAnim, type SlideElement, type SlideSettings } from './model';

let counter = 0;
/** معرّف عنصر جديد فريد في الجلسة */
export const newId = (prefix = 'el') => `${prefix}_${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

type IdFn = (n: number) => string;
const ids = (base: string): IdFn => (n) => `${base}_e${n}`;

const W = CANVAS.w;
const H = CANVAS.h;
/** الإطار الداخلي للوسائط: 16:9 بارتفاع 82% من الشاشة في المنتصف، فلا أشرطة حول الفيديو */
const FRAME = { w: 1584, h: 891 };
const frameRect = () => ({ x: (W - FRAME.w) / 2, y: (H - FRAME.h) / 2, w: FRAME.w, h: FRAME.h });

const slide = (elements: SlideElement[], over: Partial<SlideSettings> = {}): SlideSettings => ({ bg: { kind: 'theme', glow: true }, mark: true, elements, ...over });

/** عنوان كبير في المنتصف مع خط ذهبي، ونص فرعي اختياري */
function titleBlock(id: IdFn, title: string, sub?: string, from = 0): SlideElement[] {
  const t = TYPE_SCALE.title;
  const els: SlideElement[] = [
    makeElement('text', id(from + 1), { x: SAFE_MARGIN, y: sub ? 360 : 400, w: W - SAFE_MARGIN * 2, h: 150, anim: { type: 'up', delay: 0, duration: 1000 }, props: { text: title, size: t.size, weight: t.weight, line: t.line, color: 'head' } }),
    makeElement('shape', id(from + 2), { x: (W - 140) / 2, y: sub ? 545 : 590, w: 140, h: 7, anim: { type: 'wipe', delay: 250, duration: 900 }, props: { shape: 'rect', fill: 'gradGold', radius: 999 } }),
  ];
  if (sub) {
    const b = TYPE_SCALE.body;
    els.push(makeElement('text', id(from + 3), { x: SAFE_MARGIN * 2, y: 600, w: W - SAFE_MARGIN * 4, h: 150, anim: { type: 'up', delay: 320, duration: 1000 }, props: { text: sub, size: b.size, weight: b.weight, line: b.line } }));
  }
  return els;
}

export const TEMPLATES = {
  blank: { label: 'فارغة', hint: 'خلفية القالب فقط' },
  title: { label: 'عنوان', hint: 'عنوان كبير مع خط ذهبي ونص فرعي' },
  logo: { label: 'الشعار', hint: 'شعار البرنامج الكبير مع عبارة' },
  image: { label: 'صورة', hint: 'صورة واحدة بإطار أو بملء الشاشة' },
  video: { label: 'فيديو', hint: 'يعمل تلقائياً مع زر تخطٍّ' },
  names: { label: 'أسماء', hint: 'عنوان ثم اسم ضخم مع كل نقرة' },
  opening: { label: 'الافتتاح', hint: 'شعار الجمعية واسمها وعنوان الحفل بدخول سينمائي' },
  partners: { label: 'شركاء النجاح', hint: 'شبكة شعارات بفئات تُرتَّب تلقائياً' },
  counters: { label: 'أرقام', hint: 'عدّادان كبيران مع وصف' },
  black: { label: 'شاشة سوداء', hint: 'لفقرة المتحدث' },
} as const;
export type TemplateKey = keyof typeof TEMPLATES;

export interface TemplateInput {
  title?: string;
  sub?: string;
  media?: MediaRef;
  cover?: boolean;
  names?: string[];
  perStep?: number;
  video?: { muted?: boolean; autoAdvance?: boolean; showSkip?: boolean };
  /** شركاء النجاح: الفئات */
  tiers?: import('./model').LogoTier[];
  /** الافتتاح: اسم الجمعية وشعارها */
  org?: string;
  orgLogo?: MediaRef;
}

/** إعدادات شريحة من قالب. base يميّز معرّفات العناصر */
export function templateSettings(key: TemplateKey, base: string, input: TemplateInput = {}): SlideSettings {
  const id = ids(base);
  const title = input.title ?? '';
  switch (key) {
    case 'blank':
      return slide([]);
    case 'title':
      return slide(titleBlock(id, title || 'العنوان', input.sub ?? 'نص فرعي يوضح الفكرة'));
    case 'logo': {
      const h = 380;
      const els: SlideElement[] = [makeElement('logo', id(1), { x: (W - h * LOGO_RATIO.vertical) / 2, y: title ? 230 : 350, w: Math.round(h * LOGO_RATIO.vertical), h, props: { kind: 'vertical', variant: 'auto' } })];
      if (title) {
        const s = TYPE_SCALE.subtitle;
        els.push(makeElement('text', id(2), { x: SAFE_MARGIN, y: 680, w: W - SAFE_MARGIN * 2, h: 100, anim: { type: 'up', delay: 260, duration: 1000 }, props: { text: title, size: s.size, weight: s.weight, line: s.line, color: 'head' } }));
      }
      return slide(els, { mark: false });
    }
    case 'image': {
      if (input.cover) return slide([makeElement('image', id(1), { x: 0, y: 0, w: W, h: H, anim: { type: 'fade', delay: 0, duration: 900 }, props: { media: input.media, fit: 'cover', radius: 0 } })], { bg: { kind: 'theme', glow: false } });
      return slide([makeElement('image', id(1), { ...frameRect(), props: { media: input.media, fit: 'contain', radius: 24 }, shadow: 'lift' })]);
    }
    case 'video': {
      // العنوان تحت الفيديو: يظهر وحده إن لم يُحدَّد ملف
      const els = titleBlock(id, title || 'فيديو');
      els.push(makeElement('video', id(9), { ...frameRect(), anim: { type: 'fade', delay: 0, duration: 900 }, shadow: 'lift', props: { media: input.media, fit: 'contain', radius: 24, muted: input.video?.muted ?? false, autoAdvance: input.video?.autoAdvance ?? true, showSkip: input.video?.showSkip ?? true } }));
      return slide(els);
    }
    case 'names': {
      const names = input.names ?? [];
      const head: SlideElement[] = titleBlock(id, title || 'المكرَّمون').map((e) => ({ ...e, until: 1 }));
      const c = TYPE_SCALE.caption;
      if (names.length) head.push(makeElement('text', id(3), { x: SAFE_MARGIN, y: 640, w: W - SAFE_MARGIN * 2, h: 60, until: 1, anim: { type: 'up', delay: 320, duration: 1000 }, props: { text: `${names.length} ${names.length > 10 ? 'اسماً' : 'أسماء'}`, size: c.size, weight: 500, line: c.line } }));
      // بعد العنوان: اسم القائمة صغيراً في الأعلى، والاسم الضخم في المنتصف مع عدّاد
      head.push(makeElement('text', id(4), { x: SAFE_MARGIN, y: 60, w: W - SAFE_MARGIN * 2, h: 60, step: 1, anim: { type: 'fade', delay: 0, duration: 800 }, props: { text: title || 'المكرَّمون', size: c.size, weight: 500, line: c.line } }));
      head.push(makeElement('names', id(5), { x: SAFE_MARGIN, y: 200, w: W - SAFE_MARGIN * 2, h: 820, step: 1, anim: { type: 'scale', delay: 0, duration: 1300 }, props: { names, perStep: Math.max(1, input.perStep ?? 1), color: 'head' } }));
      return slide(head);
    }
    case 'black':
      return slide([], { bg: { kind: 'black' }, mark: false });
    case 'opening': {
      // تتابع سينمائي: الشعار يتضح من الضبابية، ثم اسم الجمعية، ثم الخط الذهبي يُرسم، ثم عنوان الحفل
      const s = TYPE_SCALE.subtitle;
      const d = TYPE_SCALE.display;
      return slide([
        makeElement('image', id(1), { x: (W - 560) / 2, y: 120, w: 560, h: 360, anim: { type: 'scale', delay: 200, duration: 1800 }, name: 'شعار الجمعية', props: { media: input.orgLogo, fit: 'contain', radius: 0 } }),
        makeElement('text', id(2), { x: SAFE_MARGIN, y: 520, w: W - SAFE_MARGIN * 2, h: 90, anim: { type: 'up', delay: 1100, duration: 1100 }, name: 'اسم الجمعية', props: { text: input.org || 'اسم الجمعية', size: s.size, weight: s.weight, line: s.line, color: 'fg' } }),
        makeElement('shape', id(3), { x: (W - 220) / 2, y: 650, w: 220, h: 8, anim: { type: 'wipe', delay: 1700, duration: 1000 }, props: { shape: 'rect', fill: 'gradGold', radius: 999 } }),
        makeElement('text', id(4), { x: SAFE_MARGIN, y: 700, w: W - SAFE_MARGIN * 2, h: 150, anim: { type: 'up', delay: 2000, duration: 1300 }, name: 'عنوان الحفل', props: { text: title || 'حفل برنامج صقل', size: d.size, weight: d.weight, line: d.line, color: 'head' } }),
      ]);
    }
    case 'partners': {
      const t = TYPE_SCALE.title;
      return slide([
        makeElement('text', id(1), { x: SAFE_MARGIN, y: 70, w: W - SAFE_MARGIN * 2, h: 130, anim: { type: 'up', delay: 0, duration: 1000 }, props: { text: title || 'شركاء النجاح', size: t.size, weight: t.weight, line: t.line, color: 'head' } }),
        makeElement('shape', id(2), { x: (W - 140) / 2, y: 215, w: 140, h: 7, anim: { type: 'wipe', delay: 250, duration: 900 }, props: { shape: 'rect', fill: 'gradGold', radius: 999 } }),
        makeElement('logoGrid', id(3), { x: SAFE_MARGIN, y: 270, w: W - SAFE_MARGIN * 2, h: H - 270 - SAFE_MARGIN * 0.75, anim: { type: 'fade', delay: 300, duration: 600 }, props: { tiers: input.tiers ?? [{ title: 'الشريك الذهبي', size: 'lg', logos: [] }, { title: 'الشركاء', size: 'md', logos: [] }, { title: 'الداعمون', size: 'sm', logos: [] }] } }),
      ]);
    }
    case 'counters': {
      const t = TYPE_SCALE.title;
      const b = TYPE_SCALE.body;
      const col = (x: number, n: number, label: string, i: number, color: 'em' | 'glow') => [
        makeElement('counter', id(10 + i * 2), { x, y: 380, w: 760, h: 240, anim: { type: 'up', delay: 300 + i * 250, duration: 900 }, props: { from: 0, to: n, size: 200, color } }),
        makeElement('text', id(11 + i * 2), { x, y: 640, w: 760, h: 80, anim: { type: 'up', delay: 600 + i * 250, duration: 900 }, props: { text: label, size: b.size, weight: 500, line: 1.3 } }),
      ];
      return slide([
        makeElement('text', id(1), { x: SAFE_MARGIN, y: 150, w: W - SAFE_MARGIN * 2, h: 130, props: { text: title || 'أثر البرنامج بالأرقام', size: t.size, weight: t.weight, line: t.line, color: 'head' } }),
        ...col(1060, 120, 'مشاركاً', 0, 'em'),
        ...col(100, 36, 'رحلة ولقاء', 1, 'glow'),
      ]);
    }
  }
}

export function templateSegment(key: TemplateKey, segId: string, order: number, input: TemplateInput = {}): SlideSegment {
  return { id: segId, type: 'slide', title: input.title || TEMPLATES[key].label, order, settings: templateSettings(key, segId, input) };
}

/** تحويل فقرة من الإصدار 1 إلى شريحة (أو شرائح للصور) بنفس مظهرها */
export function migrateLegacy(seg: LegacySegment): SlideSegment[] {
  const base = { order: seg.order };
  switch (seg.type) {
    case 'video':
      return [{ ...templateSegment('video', seg.id, base.order, { title: seg.title, media: seg.settings.media, video: seg.settings }), title: seg.title }];
    case 'slides':
      if (!seg.settings.slides.length) return [{ ...templateSegment('title', seg.id, base.order, { title: seg.title, sub: '' }), title: seg.title }];
      return seg.settings.slides.map((m, i) => ({
        ...templateSegment('image', i ? `${seg.id}_${i + 1}` : seg.id, base.order + i / 1000, { media: m, cover: seg.settings.fit === 'cover' }),
        title: seg.settings.slides.length > 1 ? `${seg.title} ${i + 1}` : seg.title,
      }));
    case 'names':
      return [{ ...templateSegment('names', seg.id, base.order, { title: seg.settings.heading || seg.title, names: seg.settings.names, perStep: seg.settings.perStep }), title: seg.title }];
    case 'blank':
      return [{ ...templateSegment(seg.settings.variant === 'black' ? 'black' : 'logo', seg.id, base.order, { title: seg.settings.caption }), title: seg.title }];
  }
}

/** نسخة من شريحة بمعرّفات جديدة لكل العناصر */
export function cloneElements(els: SlideElement[]): SlideElement[] {
  return els.map((e) => ({ ...structuredClone(e), id: newId() }));
}

export { noAnim };
