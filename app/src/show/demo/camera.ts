// حساب الكاميرا: أي إزاحة وتكبير تُظهر مستطيلاً من الصفحة (عرضها 1440) في وسط الشاشة. منطق نقي قابل للاختبار.

export const PAGE_W = 1440;

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

/** الصفحة كاملة العرض من أعلاها */
export function overview(view: { w: number; h: number }): Cam {
  return { s: view.w / PAGE_W, tx: 0, ty: 0 };
}

/** تقريب على مستطيل مع هامش، بحد أقصى للتكبير، ودون إظهار فراغ فوق الصفحة أو على جانبيها حين تملأ الشاشة */
export function focus(target: Rect, view: { w: number; h: number }, pageH: number, opts: { pad?: number; maxZoom?: number } = {}): Cam {
  const pad = opts.pad ?? 32;
  const base = view.w / PAGE_W;
  // البطاقة الأطول من نسبة الشاشة (جدول ميزانية طويل): نُظهر أعلاها بحجم مقروء بدل تصغيرها كلها
  const maxH = ((target.w + pad * 2) * view.h) / view.w - pad * 2;
  const r = target.h > maxH ? { ...target, h: maxH } : target;
  const s = Math.max(base * 0.55, Math.min(view.w / (r.w + pad * 2), view.h / (r.h + pad * 2), base * (opts.maxZoom ?? 2.6)));
  let tx = view.w / 2 - s * (r.x + r.w / 2);
  let ty = view.h / 2 - s * (r.y + r.h / 2);
  if (s * PAGE_W >= view.w) tx = Math.min(0, Math.max(view.w - s * PAGE_W, tx));
  if (s * pageH >= view.h) ty = Math.min(0, Math.max(view.h - s * pageH, ty));
  return { s, tx, ty };
}

export const camTransform = (c: Cam) => `translate3d(${c.tx}px, ${c.ty}px, 0) scale(${c.s})`;
