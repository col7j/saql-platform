// التنسيق التلقائي لشبكة الشعارات: أكبر حجم للبطاقات تتسع معه كل الفئات في صندوق العنصر. منطق نقي قابل للاختبار.

/** نسبة حجم البطاقة لكل فئة إلى الأكبر */
export const TIER_SCALE = { lg: 1, md: 0.72, sm: 0.54 } as const;
/** البطاقة أعرض من ارتفاعها: الشعارات أفقية غالباً */
export const CARD_RATIO = 2;
/** سقف ارتفاع بطاقة الفئة الكبرى حتى لا يتضخم شعار وحيد */
export const MAX_CARD = 230;
const MIN_CARD = 36;

export interface TierInput {
  size: keyof typeof TIER_SCALE;
  count: number;
  hasTitle: boolean;
}

export interface GridLayout {
  /** ارتفاع بطاقة الفئة الكبرى */
  base: number;
  gap: number;
  titleSize: number;
  tierGap: number;
  tiers: { cardH: number; cardW: number; perRow: number; rows: number }[];
  height: number;
}

export function measureGrid(tiers: TierInput[], w: number, base: number): GridLayout {
  const gap = Math.round(base * 0.16);
  const titleSize = Math.max(22, Math.min(40, Math.round(base * 0.2)));
  const tierGap = Math.round(base * 0.32);
  const shown = tiers.filter((t) => t.count > 0);
  const rows = tiers.map((t) => {
    const cardH = Math.round(base * TIER_SCALE[t.size]);
    const cardW = Math.round(cardH * CARD_RATIO);
    const perRow = Math.max(1, Math.floor((w + gap) / (cardW + gap)));
    return { cardH, cardW, perRow, rows: t.count ? Math.ceil(t.count / perRow) : 0 };
  });
  let height = 0;
  tiers.forEach((t, i) => {
    if (!t.count) return;
    const r = rows[i];
    height += (t.hasTitle ? titleSize * 1.4 + gap : 0) + r.rows * r.cardH + (r.rows - 1) * gap;
  });
  height += Math.max(0, shown.length - 1) * tierGap;
  return { base, gap, titleSize, tierGap, tiers: rows, height };
}

/** أكبر حجم تتسع معه الشبكة في w×h (بحث ثنائي؛ الارتفاع يزيد مع الحجم) */
export function fitLogoGrid(tiers: TierInput[], w: number, h: number): GridLayout {
  let lo = MIN_CARD;
  let hi = MAX_CARD;
  if (measureGrid(tiers, w, hi).height <= h) return measureGrid(tiers, w, hi);
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (measureGrid(tiers, w, mid).height <= h) lo = mid;
    else hi = mid;
  }
  return measureGrid(tiers, w, Math.floor(lo));
}
