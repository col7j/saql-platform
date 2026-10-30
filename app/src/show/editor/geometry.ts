// حسابات المحرّر: تحريك وتغيير حجم ودوران ومحاذاة وخطوط إرشاد. منطق نقي قابل للاختبار، كله بإحداثيات اللوحة 1920×1080.
import { CANVAS, SAFE_MARGIN } from '../brand/brand';
import { elementRatio, keepsRatio, type SlideElement } from '../slides/model';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export type Handle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
export const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

const MIN = 8;
const rad = (d: number) => (d * Math.PI) / 180;
const rotateV = (x: number, y: number, deg: number) => {
  const c = Math.cos(rad(deg));
  const s = Math.sin(rad(deg));
  return { x: x * c - y * s, y: x * s + y * c };
};
export const round = (n: number) => Math.round(n * 10) / 10;

/** تغيير الحجم بمقبض، مع ثبات الجهة المقابلة حتى لو كان العنصر مدوّراً. ratio: إبقاء النسبة */
export function resize(r: Rect & { rot: number }, handle: Handle, dx: number, dy: number, ratio?: number): Rect {
  const l = rotateV(dx, dy, -r.rot);
  const sx = handle.includes('e') ? 1 : handle.includes('w') ? -1 : 0;
  const sy = handle.includes('s') ? 1 : handle.includes('n') ? -1 : 0;
  let w = Math.max(MIN, r.w + sx * l.x);
  let h = Math.max(MIN, r.h + sy * l.y);
  if (ratio) {
    if (sx && sy) {
      // الزاوية: يحكم المحور الذي تحرك أكثر
      if (Math.abs(w / r.w - 1) >= Math.abs(h / r.h - 1)) h = w / ratio;
      else w = h * ratio;
    } else if (sx) h = w / ratio;
    else w = h * ratio;
  }
  const dw = w - r.w;
  const dh = h - r.h;
  // الجهة المقابلة ثابتة؛ المقبض الجانبي مع النسبة يكبر من المنتصف على المحور الآخر
  const shift = rotateV((sx * dw) / 2, (sy * dh) / 2, r.rot);
  const cx = r.x + r.w / 2 + shift.x;
  const cy = r.y + r.h / 2 + shift.y;
  return { x: round(cx - w / 2), y: round(cy - h / 2), w: round(w), h: round(h) };
}

/** الزاوية من مركز العنصر إلى المؤشر (0 = المقبض فوق العنصر). snap: التقاط كل 15° */
export function rotation(r: Rect, px: number, py: number, snap: boolean): number {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  let a = (Math.atan2(py - cy, px - cx) * 180) / Math.PI + 90;
  if (a > 180) a -= 360;
  if (snap) a = Math.round(a / 15) * 15;
  else if (Math.abs(a % 90) < 3 || Math.abs(a % 90) > 87) a = Math.round(a / 90) * 90;
  return round(a === -180 ? 180 : a);
}

/** المستطيل المحيط بعنصر بعد الدوران */
export function bounds(r: Rect & { rot?: number }): Rect {
  if (!r.rot) return { x: r.x, y: r.y, w: r.w, h: r.h };
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => rotateV((a * r.w) / 2, (b * r.h) / 2, r.rot!));
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return { x: cx + Math.min(...xs), y: cy + Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}

export function unionRect(rs: Rect[]): Rect {
  const x = Math.min(...rs.map((r) => r.x));
  const y = Math.min(...rs.map((r) => r.y));
  return { x, y, w: Math.max(...rs.map((r) => r.x + r.w)) - x, h: Math.max(...rs.map((r) => r.y + r.h)) - y };
}

export interface Guide {
  axis: 'x' | 'y';
  at: number;
}

/** خطوط الالتقاط: حواف اللوحة ومنتصفها والهامش الآمن، وحواف ومراكز العناصر الأخرى */
export function snapTargets(others: Rect[]) {
  const xs = [0, CANVAS.w / 2, CANVAS.w, SAFE_MARGIN, CANVAS.w - SAFE_MARGIN];
  const ys = [0, CANVAS.h / 2, CANVAS.h, SAFE_MARGIN, CANVAS.h - SAFE_MARGIN];
  for (const o of others) {
    xs.push(o.x, o.x + o.w / 2, o.x + o.w);
    ys.push(o.y, o.y + o.h / 2, o.y + o.h);
  }
  return { xs, ys };
}

/** يلتقط مستطيلاً متحركاً على أقرب خط ضمن threshold، ويعيد الإزاحة المصحَّحة والخطوط الظاهرة */
export function snapMove(r: Rect, targets: { xs: number[]; ys: number[] }, threshold: number): { dx: number; dy: number; guides: Guide[] } {
  const pick = (edges: number[], lines: number[]) => {
    let best: { d: number; at: number } | null = null;
    for (const e of edges) for (const l of lines) {
      const d = l - e;
      if (Math.abs(d) <= threshold && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, at: l };
    }
    return best;
  };
  const bx = pick([r.x, r.x + r.w / 2, r.x + r.w], targets.xs);
  const by = pick([r.y, r.y + r.h / 2, r.y + r.h], targets.ys);
  const guides: Guide[] = [];
  if (bx) guides.push({ axis: 'x', at: bx.at });
  if (by) guides.push({ axis: 'y', at: by.at });
  return { dx: bx?.d ?? 0, dy: by?.d ?? 0, guides };
}

/** التقاط حافة المقبض فقط عند تغيير الحجم (بلا دوران) */
export function snapResize(r: Rect, handle: Handle, targets: { xs: number[]; ys: number[] }, threshold: number): { rect: Rect; guides: Guide[] } {
  const out = { ...r };
  const guides: Guide[] = [];
  const near = (v: number, lines: number[]) => lines.reduce<number | null>((b, l) => (Math.abs(l - v) <= threshold && (b === null || Math.abs(l - v) < Math.abs(b - v)) ? l : b), null);
  if (handle.includes('e')) { const l = near(r.x + r.w, targets.xs); if (l !== null) { out.w = l - r.x; guides.push({ axis: 'x', at: l }); } }
  if (handle.includes('w')) { const l = near(r.x, targets.xs); if (l !== null) { out.w = r.x + r.w - l; out.x = l; guides.push({ axis: 'x', at: l }); } }
  if (handle.includes('s')) { const l = near(r.y + r.h, targets.ys); if (l !== null) { out.h = l - r.y; guides.push({ axis: 'y', at: l }); } }
  if (handle.includes('n')) { const l = near(r.y, targets.ys); if (l !== null) { out.h = r.y + r.h - l; out.y = l; guides.push({ axis: 'y', at: l }); } }
  return { rect: out, guides };
}

export type AlignMode = 'start' | 'centerX' | 'end' | 'top' | 'middle' | 'bottom';

/** محاذاة العناصر: عنصر واحد إلى اللوحة، وعدة عناصر إلى مستطيلها الجامع. start = اليمين (عربي) */
export function align(els: SlideElement[], mode: AlignMode): SlideElement[] {
  const frame = els.length > 1 ? unionRect(els.map(bounds)) : { x: 0, y: 0, w: CANVAS.w, h: CANVAS.h };
  return els.map((e) => {
    const b = bounds(e);
    const ox = e.x - b.x;
    const oy = e.y - b.y;
    switch (mode) {
      case 'start': return { ...e, x: round(frame.x + frame.w - b.w + ox) };
      case 'end': return { ...e, x: round(frame.x + ox) };
      case 'centerX': return { ...e, x: round(frame.x + (frame.w - b.w) / 2 + ox) };
      case 'top': return { ...e, y: round(frame.y + oy) };
      case 'bottom': return { ...e, y: round(frame.y + frame.h - b.h + oy) };
      case 'middle': return { ...e, y: round(frame.y + (frame.h - b.h) / 2 + oy) };
    }
  });
}

/** توزيع متساوٍ للمسافات بين ثلاثة عناصر أو أكثر */
export function distribute(els: SlideElement[], axis: 'x' | 'y'): SlideElement[] {
  if (els.length < 3) return els;
  const key = axis === 'x' ? 'x' : 'y';
  const size = axis === 'x' ? 'w' : 'h';
  const sorted = [...els].sort((a, b) => bounds(a)[key] - bounds(b)[key]);
  const bs = sorted.map(bounds);
  const total = bs.reduce((s, b) => s + b[size], 0);
  const span = bs[bs.length - 1][key] + bs[bs.length - 1][size] - bs[0][key];
  const gap = (span - total) / (bs.length - 1);
  let at = bs[0][key];
  const moved = new Map<string, number>();
  sorted.forEach((e, i) => {
    moved.set(e.id, round(e[key] + (at - bs[i][key])));
    at += bs[i][size] + gap;
  });
  return els.map((e) => ({ ...e, [key]: moved.get(e.id)! }));
}

/** ترتيب الطبقات: آخر عنصر في القائمة هو الأعلى */
export function reorder(els: SlideElement[], ids: Set<string>, to: 'front' | 'back' | 'up' | 'down'): SlideElement[] {
  const sel = els.filter((e) => ids.has(e.id));
  const rest = els.filter((e) => !ids.has(e.id));
  if (to === 'front') return [...rest, ...sel];
  if (to === 'back') return [...sel, ...rest];
  const out = [...els];
  const idx = out.map((e, i) => (ids.has(e.id) ? i : -1)).filter((i) => i >= 0);
  if (to === 'up') for (const i of idx.reverse()) { if (i < out.length - 1 && !ids.has(out[i + 1].id)) [out[i], out[i + 1]] = [out[i + 1], out[i]]; }
  else for (const i of idx) { if (i > 0 && !ids.has(out[i - 1].id)) [out[i], out[i - 1]] = [out[i - 1], out[i]]; }
  return out;
}

/** يطبّق تغيير حجم على عنصر مع احترام قيوده: نسبة الشعار ثابتة، ولا يصغر عن حدّه الأدنى (يبقى عند آخر حجم مسموح) */
export function resizeElement(el: SlideElement, handle: Handle, dx: number, dy: number, shift: boolean, minW = 0): Rect {
  const ratio = keepsRatio(el) || shift ? elementRatio(el) : undefined;
  const r = resize(el, handle, dx, dy, ratio);
  return r.w < minW ? { x: el.x, y: el.y, w: el.w, h: el.h } : r;
}
