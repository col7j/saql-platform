// التحقق من شريحة مقروءة من ملف أو تخزين: كل قيمة غير معروفة تُستبدل بالافتراضي،
// وكل لون أو خط من خارج الهوية يُرفض، فلا يدخل العرض شيء من خارج ملف الهوية حتى عبر الاستيراد.
import { BRAND_FONTS, type LogoKind } from '../brand/brand';
import type { MediaRef } from '../model';
import {
  ANIMS, COLOR_REFS, ELEMENT_TYPES, GRADIENT_FILLS, LOGO_RATIO, SHADOWS, defaultProps, makeElement,
  type Anim, type ColorRef, type ElementType, type Fill, type LogoTier, type SlideBg, type SlideElement, type SlideSettings,
} from './model';

const isObj = (v: unknown): v is Record<string, any> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, d: number, min = -Infinity, max = Infinity) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d);
const str = (v: unknown, d = '') => (typeof v === 'string' ? v : d);
const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
const oneOf = <T extends string>(v: unknown, list: readonly T[], d: T): T => (list.includes(v as T) ? (v as T) : d);

export function media(v: unknown): MediaRef | undefined {
  if (typeof v === 'string' && v) return { kind: 'url', src: v };
  if (!isObj(v)) return undefined;
  if (v.kind === 'local' && typeof v.id === 'string') return { kind: 'local', id: v.id, name: str(v.name) || undefined };
  if (typeof v.src === 'string' && v.src) return { kind: 'url', src: v.src };
  return undefined;
}

const color = (v: unknown, d: ColorRef): ColorRef => oneOf(v, COLOR_REFS, d);
const fill = (v: unknown, d: Fill): Fill => (v === 'none' || (typeof v === 'string' && v in GRADIENT_FILLS) ? (v as Fill) : color(v, d as ColorRef));
const font = (v: unknown, d: string) => (BRAND_FONTS.some((f) => f.family === v) ? (v as string) : d);
const weight = (v: unknown, d: number, family: string) => {
  const w = Number(v);
  const f = BRAND_FONTS.find((x) => x.family === family) ?? BRAND_FONTS[0];
  return w in f.weights ? w : d;
};

function anim(v: unknown, d: Anim): Anim {
  if (!isObj(v)) return d;
  return { type: oneOf(v.type, Object.keys(ANIMS) as (keyof typeof ANIMS)[], d.type), delay: num(v.delay, d.delay, 0, 20000), duration: num(v.duration, d.duration, 100, 10000) };
}

function props(type: ElementType, v: unknown): SlideElement['props'] {
  const d = defaultProps(type) as any;
  const p = isObj(v) ? v : {};
  switch (type) {
    case 'text': {
      const f = font(p.font, d.font);
      return { text: str(p.text, d.text), font: f, weight: weight(p.weight, d.weight, f), size: num(p.size, d.size, 8, 600), color: color(p.color, d.color), align: oneOf(p.align, ['start', 'center', 'end'] as const, d.align), line: num(p.line, d.line, 0.8, 3) };
    }
    case 'image':
      return { media: media(p.media), fit: oneOf(p.fit, ['contain', 'cover'] as const, d.fit), radius: num(p.radius, d.radius, 0, 999) };
    case 'logo':
      return { kind: oneOf(p.kind, Object.keys(LOGO_RATIO) as LogoKind[], d.kind), variant: oneOf(p.variant, ['auto', 'color', 'white'] as const, d.variant) };
    case 'video':
      return { media: media(p.media), fit: oneOf(p.fit, ['contain', 'cover'] as const, d.fit), radius: num(p.radius, d.radius, 0, 999), muted: bool(p.muted, d.muted), autoAdvance: bool(p.autoAdvance, d.autoAdvance), showSkip: bool(p.showSkip, d.showSkip) };
    case 'shape':
      return { shape: oneOf(p.shape, ['rect', 'circle', 'line'] as const, d.shape), fill: fill(p.fill, d.fill), stroke: p.stroke === 'none' ? 'none' : color(p.stroke, 'fg'), strokeWidth: num(p.strokeWidth, d.strokeWidth, 0, 200), radius: num(p.radius, d.radius, 0, 999) };
    case 'logoGrid': {
      const tiers: LogoTier[] = (Array.isArray(p.tiers) ? p.tiers : []).filter(isObj).map((t) => ({ title: str(t.title), size: oneOf(t.size, ['lg', 'md', 'sm'] as const, 'md'), logos: (Array.isArray(t.logos) ? t.logos : []).map(media).filter(Boolean) as MediaRef[] }));
      return { tiers: tiers.length ? tiers : d.tiers, titleColor: color(p.titleColor, d.titleColor) };
    }
    case 'counter': {
      const f = font(p.font, d.font);
      return { from: num(p.from, d.from), to: num(p.to, d.to), duration: num(p.duration, d.duration, 0, 60000), prefix: str(p.prefix), suffix: str(p.suffix), font: f, weight: weight(p.weight, d.weight, f), size: num(p.size, d.size, 8, 800), color: color(p.color, d.color) };
    }
    case 'names': {
      const f = font(p.font, d.font);
      return { names: (Array.isArray(p.names) ? p.names : []).map((n: unknown) => str(n).trim()).filter(Boolean), perStep: Math.floor(num(p.perStep, 1, 1, 50)), font: f, weight: weight(p.weight, d.weight, f), size: num(p.size, d.size, 8, 600), color: color(p.color, d.color), counter: bool(p.counter, d.counter) };
    }
  }
}

export function element(v: unknown, i: number, base: string): SlideElement | null {
  if (!isObj(v) || !ELEMENT_TYPES.includes(v.type)) return null;
  const type = v.type as ElementType;
  const d = makeElement(type, str(v.id) || `${base}_e${i + 1}`);
  const el = {
    ...d,
    x: num(v.x, d.x, -10000, 10000),
    y: num(v.y, d.y, -10000, 10000),
    w: num(v.w, d.w, 1, 20000),
    h: num(v.h, d.h, 1, 20000),
    rot: num(v.rot, 0, -360, 360),
    opacity: num(v.opacity, 1, 0, 1),
    shadow: oneOf(v.shadow, Object.keys(SHADOWS) as (keyof typeof SHADOWS)[], 'none'),
    anim: anim(v.anim, d.anim),
    step: Math.floor(num(v.step, 0, 0, 500)),
    until: v.until === undefined || v.until === null ? undefined : Math.floor(num(v.until, 1, 1, 500)),
    locked: bool(v.locked, false) || undefined,
    name: str(v.name) || undefined,
    props: props(type, v.props),
  } as SlideElement;
  // قواعد الشعار: بلا دوران ولا شفافية ولا ظل، وبنسبته الأصلية
  if (el.type === 'logo') {
    Object.assign(el, { rot: 0, opacity: 1, shadow: 'none' });
    if (Math.abs(el.h - el.w / LOGO_RATIO[el.props.kind]) > 0.5) el.h = el.w / LOGO_RATIO[el.props.kind];
  }
  return el;
}

function bg(v: unknown): SlideBg {
  if (!isObj(v)) return { kind: 'theme', glow: true };
  switch (v.kind) {
    case 'color': return { kind: 'color', color: color(v.color, 'night') };
    case 'gradient': return { kind: 'gradient', name: v.name === 'gold' ? 'gold' : 'teal' };
    case 'media': return { kind: 'media', media: media(v.media) };
    case 'black': return { kind: 'black' };
    default: return { kind: 'theme', glow: bool(v.glow, true) };
  }
}

export function slideSettings(v: unknown, base: string): SlideSettings {
  const s = isObj(v) ? v : {};
  const seen = new Set<string>();
  const elements = (Array.isArray(s.elements) ? s.elements : [])
    .map((e: unknown, i: number) => element(e, i, base))
    .filter((e): e is SlideElement => !!e)
    .map((e: SlideElement, i: number) => {
      const id = seen.has(e.id) ? `${e.id}_${i}` : e.id;
      seen.add(id);
      return { ...e, id };
    });
  return { bg: bg(s.bg), mark: bool(s.mark, true), elements };
}
