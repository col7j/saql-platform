// نموذج الشريحة: لوحة 1920×1080 فيها عناصر حرّة. كل لون وخط يُخزَّن كاسم من الهوية لا كقيمة،
// فتبديل القالب (المرحلة 2) يغيّر كل الشرائح، ولا يدخل العرض لون أو خط من خارج ملف الهوية.
import { BRAND_COLORS, BRAND_FONTS, CANVAS, LOGOS, TYPE_SCALE, type BrandColorKey, type LogoKind } from '../brand/brand';
import type { MediaRef } from '../model';

export { CANVAS };

/** أدوار القالب (تتبدل مع الغامق والفاتح) وألوان الهوية الثابتة */
export const THEME_ROLES = {
  head: 'عناوين القالب',
  fg: 'نص القالب',
  em: 'توكيد القالب',
  em2: 'توكيد ثانٍ',
  primary: 'أساسي القالب',
  glow: 'توهّج القالب',
} as const;
export type ThemeRole = keyof typeof THEME_ROLES;
export type ColorRef = ThemeRole | BrandColorKey;
export const COLOR_REFS = [...Object.keys(THEME_ROLES), ...Object.keys(BRAND_COLORS)] as ColorRef[];
export const colorLabel = (c: ColorRef) => (c in THEME_ROLES ? THEME_ROLES[c as ThemeRole] : BRAND_COLORS[c as BrandColorKey].label);

export type Fill = ColorRef | 'gradTeal' | 'gradGold' | 'none';
export const GRADIENT_FILLS = { gradTeal: 'تدرّج التيل', gradGold: 'تدرّج الذهبي' } as const;

export const SHADOWS = { none: 'بلا ظل', soft: 'ناعم', lift: 'مرتفع', glow: 'توهّج' } as const;
export type Shadow = keyof typeof SHADOWS;

export const ANIMS = { none: 'بلا حركة', fade: 'تلاشٍ', up: 'صعود', down: 'نزول', start: 'من اليمين', end: 'من اليسار', scale: 'تكبير', wipe: 'رسم من المنتصف' } as const;
export type AnimType = keyof typeof ANIMS;
export interface Anim {
  type: AnimType;
  /** بالملّي ثانية من ظهور العنصر */
  delay: number;
  duration: number;
}

export const ELEMENT_TYPES = ['text', 'image', 'logo', 'video', 'shape', 'logoGrid', 'counter', 'names'] as const;
export type ElementType = (typeof ELEMENT_TYPES)[number];
export const ELEMENT_LABELS: Record<ElementType, string> = {
  text: 'نص',
  image: 'صورة',
  logo: 'شعار البرنامج',
  video: 'فيديو',
  shape: 'شكل',
  logoGrid: 'شبكة شعارات',
  counter: 'عدّاد',
  names: 'قائمة أسماء',
};

export interface TextProps {
  text: string;
  font: string;
  weight: number;
  size: number;
  color: ColorRef;
  align: 'start' | 'center' | 'end';
  line: number;
}
export interface ImageProps {
  media?: MediaRef;
  fit: 'contain' | 'cover';
  radius: number;
}
export interface LogoProps {
  kind: LogoKind;
  /** auto: البيضاء على القالب الغامق والملونة على الفاتح */
  variant: 'auto' | 'color' | 'white';
}
export interface VideoProps {
  media?: MediaRef;
  fit: 'contain' | 'cover';
  radius: number;
  muted: boolean;
  /** ينتقل للفقرة التالية عند انتهائه */
  autoAdvance: boolean;
  showSkip: boolean;
}
export interface ShapeProps {
  shape: 'rect' | 'circle' | 'line';
  fill: Fill;
  stroke: ColorRef | 'none';
  strokeWidth: number;
  radius: number;
}
export interface LogoTier {
  title: string;
  /** حجم الشعارات في الفئة: الأعلى أكبر */
  size: 'lg' | 'md' | 'sm';
  logos: MediaRef[];
}
export interface LogoGridProps {
  tiers: LogoTier[];
  titleColor: ColorRef;
}
export interface CounterProps {
  from: number;
  to: number;
  /** مدة العدّ بالملّي ثانية */
  duration: number;
  prefix: string;
  suffix: string;
  font: string;
  weight: number;
  size: number;
  color: ColorRef;
}
export interface NamesProps {
  names: string[];
  /** كم اسماً مع كل نقرة */
  perStep: number;
  font: string;
  weight: number;
  size: number;
  color: ColorRef;
  /** عدّاد «3 / 12» أسفل العنصر */
  counter: boolean;
}

interface ElBase<T extends ElementType, P> {
  id: string;
  type: T;
  /** موضع وحجم على لوحة 1920×1080 */
  x: number;
  y: number;
  w: number;
  h: number;
  /** الدوران بالدرجات */
  rot: number;
  opacity: number;
  shadow: Shadow;
  anim: Anim;
  /** يظهر مع النقرة رقم step في الشريحة (0 = مع الشريحة) */
  step: number;
  /** يختفي عند النقرة رقم until (اختياري) */
  until?: number;
  locked?: boolean;
  name?: string;
  props: P;
}
export type TextEl = ElBase<'text', TextProps>;
export type ImageEl = ElBase<'image', ImageProps>;
export type LogoEl = ElBase<'logo', LogoProps>;
export type VideoEl = ElBase<'video', VideoProps>;
export type ShapeEl = ElBase<'shape', ShapeProps>;
export type LogoGridEl = ElBase<'logoGrid', LogoGridProps>;
export type CounterEl = ElBase<'counter', CounterProps>;
export type NamesEl = ElBase<'names', NamesProps>;
export type SlideElement = TextEl | ImageEl | LogoEl | VideoEl | ShapeEl | LogoGridEl | CounterEl | NamesEl;

export type SlideBg =
  | { kind: 'theme'; glow: boolean }
  | { kind: 'color'; color: ColorRef }
  | { kind: 'gradient'; name: 'teal' | 'gold' }
  | { kind: 'media'; media?: MediaRef }
  | { kind: 'black' };

/** مؤثر خلفية للشريحة كلها: قصاصات احتفالية أو توهّج نابض (بألوان الهوية) */
export const SLIDE_FX = { none: 'بلا مؤثر', confetti: 'قصاصات احتفالية', glow: 'توهّج نابض' } as const;
export type SlideFx = keyof typeof SLIDE_FX;

export interface SlideSettings {
  bg: SlideBg;
  /** شعار الزاوية الثابت */
  mark: boolean;
  elements: SlideElement[];
  fx?: SlideFx;
}

export const DEFAULT_FONT = BRAND_FONTS[0].family;
export const FONT_WEIGHTS = Object.keys(BRAND_FONTS[0].weights).map(Number);

/** نسبة العرض للارتفاع لكل شعار (من viewBox ملف الشعار): الشعار لا يُمد ولا يُضغط */
export const LOGO_RATIO: Record<LogoKind, number> = {
  horizontal: 453.73 / 182.78,
  vertical: 322.12 / 318.03,
  icon: 284.12 / 486.95,
};
export const logoSrc = (p: LogoProps, theme: 'dark' | 'light' = 'dark') => LOGOS[p.kind][p.variant === 'auto' ? (theme === 'light' ? 'color' : 'white') : p.variant];

const NO_ANIM: Anim = { type: 'none', delay: 0, duration: 800 };
export const DEFAULT_ANIM: Anim = { type: 'up', delay: 0, duration: 900 };

const text = (size = TYPE_SCALE.title.size, weight = TYPE_SCALE.title.weight): TextProps => ({ text: 'نص جديد', font: DEFAULT_FONT, weight, size, color: 'fg', align: 'center', line: size >= 60 ? 1.2 : 1.6 });

export function defaultProps(type: ElementType): SlideElement['props'] {
  switch (type) {
    case 'text': return text();
    case 'image': return { fit: 'contain', radius: 24 } satisfies ImageProps;
    case 'logo': return { kind: 'vertical', variant: 'auto' } satisfies LogoProps;
    case 'video': return { fit: 'contain', radius: 24, muted: false, autoAdvance: true, showSkip: true } satisfies VideoProps;
    case 'shape': return { shape: 'rect', fill: 'primary', stroke: 'none', strokeWidth: 4, radius: 24 } satisfies ShapeProps;
    case 'logoGrid': return { tiers: [{ title: 'شريك النجاح', size: 'lg', logos: [] }], titleColor: 'em' } satisfies LogoGridProps;
    case 'counter': return { from: 0, to: 100, duration: 2000, prefix: '', suffix: '', font: DEFAULT_FONT, weight: 900, size: 160, color: 'em' } satisfies CounterProps;
    case 'names': return { names: [], perStep: 1, font: DEFAULT_FONT, weight: 900, size: TYPE_SCALE.display.size, color: 'fg', counter: true } satisfies NamesProps;
  }
}

/** حجم العنصر الجديد الافتراضي على اللوحة */
export function defaultSize(type: ElementType, props?: SlideElement['props']): { w: number; h: number } {
  switch (type) {
    case 'text': return { w: 1200, h: 140 };
    case 'image': case 'video': return { w: 1280, h: 720 };
    case 'logo': {
      const h = 320;
      return { w: Math.round(h * LOGO_RATIO[(props as LogoProps | undefined)?.kind ?? 'vertical']), h };
    }
    case 'shape': return (props as ShapeProps | undefined)?.shape === 'line' ? { w: 240, h: 8 } : { w: 480, h: 320 };
    case 'logoGrid': return { w: 1600, h: 640 };
    case 'counter': return { w: 640, h: 220 };
    case 'names': return { w: 1500, h: 520 };
  }
}

type ElOf<T extends ElementType> = Extract<SlideElement, { type: T }>;
export function makeElement<T extends ElementType>(type: T, id: string, over: Partial<Omit<ElOf<T>, 'props' | 'type'>> & { props?: Partial<ElOf<T>['props']> } = {}): ElOf<T> {
  const props = { ...defaultProps(type), ...(over.props ?? {}) } as SlideElement['props'];
  const size = defaultSize(type, props);
  const el = {
    id,
    type,
    x: (CANVAS.w - size.w) / 2,
    y: (CANVAS.h - size.h) / 2,
    ...size,
    rot: 0,
    opacity: 1,
    shadow: 'none' as Shadow,
    anim: type === 'logo' || type === 'video' || type === 'image' ? { ...DEFAULT_ANIM, type: 'scale' as AnimType } : { ...DEFAULT_ANIM },
    step: 0,
    ...over,
    props,
  };
  return el as Extract<SlideElement, { type: T }>;
}

export const noAnim = (): Anim => ({ ...NO_ANIM });

/** عدد دفعات قائمة الأسماء */
export const nameBatches = (p: NamesProps) => (p.names.length ? Math.ceil(p.names.length / Math.max(1, p.perStep)) : 1);

/** آخر نقرة يحتاجها العنصر (قائمة الأسماء تأخذ نقرة لكل دفعة) */
export const elementLastStep = (el: SlideElement) => el.step + (el.type === 'names' ? nameBatches(el.props) - 1 : 0);

/** عدد خطوات الشريحة: الشريحة نفسها ثم كل نقرة تُظهر عنصراً أو دفعة أسماء */
export function slideStepCount(s: SlideSettings): number {
  let last = 0;
  for (const el of s.elements) last = Math.max(last, elementLastStep(el), el.until ?? 0);
  return last + 1;
}

export const isVisibleAt = (el: SlideElement, step: number) => step >= el.step && (el.until === undefined || step < el.until);

/** قواعد الشعار من ملف الهوية: لا تدوير ولا شفافية ولا ظل ولا تغيير نسبة */
export const LOGO_LOCKS = { rotate: false, opacity: false, shadow: false, ratio: true } as const;
export const keepsRatio = (el: SlideElement) => el.type === 'logo';
export const elementRatio = (el: SlideElement) => (el.type === 'logo' ? LOGO_RATIO[el.props.kind] : el.w / Math.max(1, el.h));
