// منطق نقي لترتيب الفقرات والتنقل بينها: لا يعرف الواجهة ولا التخزين.
import { demoSteps, type Segment, type ShowConfig } from './model';
import { slideStepCount } from './slides/model';
import { agreementSteps, LAUNCH_STEPS, rosterPages, whoNext, whoStepCount } from './ceremony/logic';

/** موضع العرض: الفقرة (بترتيبها) والخطوة داخلها (شريحة، دفعة أسماء، خطوة ديمو) */
export interface Pos {
  seg: number;
  step: number;
}

export function sortSegments(segments: Segment[]): Segment[] {
  return segments.map((s, i) => [s, i] as const).sort((a, b) => a[0].order - b[0].order || a[1] - b[1]).map(([s]) => s);
}

/** يرتّب ويعيد ترقيم order من 0 بلا فجوات */
export function normalize(segments: Segment[]): Segment[] {
  return sortSegments(segments).map((s, i) => (s.order === i ? s : { ...s, order: i }));
}

export function moveSegment(segments: Segment[], id: string, toIndex: number): Segment[] {
  const list = sortSegments(segments);
  const from = list.findIndex((s) => s.id === id);
  if (from < 0) return normalize(list);
  const [item] = list.splice(from, 1);
  list.splice(Math.max(0, Math.min(toIndex, list.length)), 0, item);
  return list.map((s, i) => ({ ...s, order: i }));
}

/** يضيف فقرة جاهزة بعد الفقرة after (أو في النهاية) */
export function insertSegment(segments: Segment[], seg: Segment, after?: string): Segment[] {
  const list = sortSegments(segments);
  const at = after ? list.findIndex((s) => s.id === after) + 1 : list.length;
  list.splice(at > 0 ? at : list.length, 0, seg);
  return list.map((s, i) => ({ ...s, order: i }));
}

export function removeSegment(segments: Segment[], id: string): Segment[] {
  return normalize(segments.filter((s) => s.id !== id));
}

export function updateSegment(segments: Segment[], id: string, patch: Partial<Pick<Segment, 'title'>> & { settings?: Partial<Segment['settings']> }): Segment[] {
  return segments.map((s) => (s.id === id ? ({ ...s, ...patch, settings: { ...s.settings, ...patch.settings } } as Segment) : s));
}

/** يستبدل فقرة كاملة بمعرّفها */
export const replaceSegment = (segments: Segment[], seg: Segment): Segment[] => segments.map((s) => (s.id === seg.id ? seg : s));

/** عدد الخطوات داخل الفقرة */
export function stepCount(seg: Segment): number {
  // الشريحة: نقرة لكل عنصر يظهر لاحقاً أو دفعة أسماء. الديمو: خطوة لكل لقطة
  switch (seg.type) {
    case 'demo': return Math.max(1, demoSteps(seg.settings).length);
    case 'whoami': return whoStepCount(seg.settings);
    case 'roster': return rosterPages(seg.settings).length;
    case 'agreements': return agreementSteps(seg.settings);
    case 'launch': return LAUNCH_STEPS;
    case 'photo': return 1;
    default: return slideStepCount(seg.settings);
  }
}

export function clampPos(cfg: ShowConfig, pos: Pos): Pos {
  const list = sortSegments(cfg.segments);
  if (!list.length) return { seg: 0, step: 0 };
  const seg = Math.max(0, Math.min(pos.seg, list.length - 1));
  return { seg, step: Math.max(0, Math.min(pos.step, stepCount(list[seg]) - 1)) };
}

export function next(cfg: ShowConfig, pos: Pos): Pos {
  const list = sortSegments(cfg.segments);
  const p = clampPos(cfg, pos);
  if (!list.length) return p;
  const cur = list[p.seg];
  // «من أنا؟»: التالي يكشف ثم ينتقل للمشارك التالي (التلميحات بزرها)
  if (cur.type === 'whoami') {
    const n = whoNext(cur.settings, p.step);
    if (n !== null) return { seg: p.seg, step: n };
  } else if (p.step < stepCount(cur) - 1) return { seg: p.seg, step: p.step + 1 };
  if (p.seg < list.length - 1) return { seg: p.seg + 1, step: 0 };
  return p;
}

export function prev(cfg: ShowConfig, pos: Pos): Pos {
  const list = sortSegments(cfg.segments);
  const p = clampPos(cfg, pos);
  if (!list.length) return p;
  if (p.step > 0) return { seg: p.seg, step: p.step - 1 };
  if (p.seg > 0) return { seg: p.seg - 1, step: stepCount(list[p.seg - 1]) - 1 };
  return p;
}

/** يتخطى بقية خطوات الفقرة إلى أول الفقرة التالية (زر «تخطٍّ» في الفيديو) */
export function skipSegment(cfg: ShowConfig, pos: Pos): Pos {
  const list = sortSegments(cfg.segments);
  const p = clampPos(cfg, pos);
  return p.seg < list.length - 1 ? { seg: p.seg + 1, step: 0 } : p;
}

export function isEnd(cfg: ShowConfig, pos: Pos): boolean {
  const n = next(cfg, pos);
  return n.seg === pos.seg && n.step === pos.step;
}

/** بعد تعديل الإعدادات: يبقى العرض على نفس الفقرة (بمعرّفها) حتى لو تغيّر ترتيبها */
export function followSegment(before: ShowConfig, after: ShowConfig, pos: Pos): Pos {
  const id = sortSegments(before.segments)[pos.seg]?.id;
  const idx = sortSegments(after.segments).findIndex((s) => s.id === id);
  return clampPos(after, idx >= 0 ? { seg: idx, step: pos.step } : pos);
}

/** ترتيب طبيعي لأسماء الملفات: Slide2 قبل Slide10 (تصدير PowerPoint) */
export const naturalCompare = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

/** مسارات شرائح بنمط مرقّم: show-media/slides/Slide{n}.PNG مع العدد */
export function expandPattern(pattern: string, count: number): string[] {
  if (!pattern.includes('{n}')) return pattern.trim() ? [pattern.trim()] : [];
  return Array.from({ length: Math.max(0, Math.min(500, Math.floor(count))) }, (_, i) => pattern.trim().replace(/\{n\}/g, String(i + 1)));
}
