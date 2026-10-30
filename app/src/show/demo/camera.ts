// حساب الكاميرا: أي إزاحة وتكبير تُظهر منطقة من الصفحة (عرضها PAGE_W) على الشاشة. منطق نقي قابل للاختبار.

export const PAGE_W = 1280;

/** أصغر نص في المنصة 14px؛ ليبلغ قرابة 28px على شاشة 1920 يلزم تكبير 2 بالنسبة لعرض 1920 */
export const READABLE = 2;
/** للعناصر التي نصها 16px (بنود الجدول): 1.75 يكفي لـ 28px */
export const READABLE_16 = 1.75;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Cam {
  s: number;
  tx: number;
  ty: number;
}
export interface View {
  w: number;
  h: number;
}

/** التكبير بوحدة «شاشة 1920»: نفس النتيجة المقروءة على أي دقة عرض */
export const screenScale = (view: View, s: number) => s * (view.w / 1920);

/** الصفحة كاملة العرض من أعلاها */
export function overview(view: View): Cam {
  return { s: view.w / PAGE_W, tx: 0, ty: 0 };
}

export interface FocusOpts {
  pad?: number;
  /** أدنى تكبير بوحدة شاشة 1920 (للقراءة من آخر القاعة) */
  min?: number;
  /** أقصى تكبير بوحدة شاشة 1920 */
  max?: number;
}

/**
 * تقريب على منطقة. إن لم تتسع المنطقة كلها بالتكبير المقروء:
 * عرضاً نُظهر جانبها الأيمن (بداية القراءة بالعربية)، وطولاً نُظهر أعلاها.
 */
export function focus(r: Rect, view: View, pageH: number, opts: FocusOpts = {}): Cam {
  const pad = opts.pad ?? 32;
  const k = view.w / 1920;
  const fit = Math.min(view.w / (r.w + pad * 2), view.h / (r.h + pad * 2));
  const s = Math.max((opts.min ?? 0) * k, Math.min(fit, (opts.max ?? 3) * k));
  const visW = view.w / s;
  const visH = view.h / s;
  let tx = r.w + pad * 2 <= visW ? view.w / 2 - s * (r.x + r.w / 2) : view.w - s * (r.x + r.w + pad);
  let ty = r.h + pad * 2 <= visH ? view.h / 2 - s * (r.y + r.h / 2) : -s * (r.y - pad);
  // لا فراغ خارج الصفحة حين تملأ الشاشة
  if (s * PAGE_W >= view.w) tx = Math.min(0, Math.max(view.w - s * PAGE_W, tx));
  if (s * pageH >= view.h) ty = Math.min(0, Math.max(view.h - s * pageH, ty));
  return { s, tx, ty };
}

export const camTransform = (c: Cam) => `translate3d(${c.tx}px, ${c.ty}px, 0) scale(${c.s})`;

/** المستطيل الجامع لعدة مستطيلات */
export function union(rects: (Rect | null | undefined)[]): Rect | null {
  const rs = rects.filter((r): r is Rect => !!r);
  if (!rs.length) return null;
  const x = Math.min(...rs.map((r) => r.x));
  const y = Math.min(...rs.map((r) => r.y));
  return { x, y, w: Math.max(...rs.map((r) => r.x + r.w)) - x, h: Math.max(...rs.map((r) => r.y + r.h)) - y };
}
