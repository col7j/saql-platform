// الجولة التلقائية في الديمو: ترتيب القراءة، الأجزاء المقروءة، تخطّي الفارغ، المدد، والتقريب المقروء.
import { describe, expect, it } from 'vitest';
import { READABLE } from '@/show/demo/camera';
import { MAX_PARTS, MINOR_PART, contentArea, fitToContent, partsOf, planTour, readingOrder, shotCam, shotDuration, visibleShots, type DemoCard } from '@/show/demo/tour';
import { keyAction } from '@/show/keys';

const view = { w: 1920, h: 1080 * 0.88 };
const card = (key: string, x: number, y: number, w: number, h: number): DemoCard => ({ key, label: key, rect: { x, y, w, h } });

describe('ترتيب القراءة', () => {
  it('صفوفاً من الأعلى، وفي الصف من اليمين', () => {
    const cards = [card('يسار-أعلى', 100, 100, 300, 200), card('يمين-أعلى', 700, 110, 300, 200), card('أسفل', 100, 500, 900, 200), card('وسط-أعلى', 400, 95, 250, 200)];
    expect(readingOrder(cards).map((c) => c.key)).toEqual(['يمين-أعلى', 'وسط-أعلى', 'يسار-أعلى', 'أسفل']);
  });
});

describe('الأجزاء', () => {
  it('البطاقة التي تتسع بالتكبير المقروء لقطة واحدة', () => {
    expect(partsOf({ x: 0, y: 0, w: 600, h: 300 }, view)).toHaveLength(1);
  });
  it('الكبيرة شبكة أجزاء من أعلى اليمين، كل جزء يتسع مقروءاً', () => {
    const r = { x: 100, y: 100, w: 1100, h: 900 };
    const parts = partsOf(r, view);
    // المرئي بتكبير 2 على 1920×950: نحو 896×411 بعد الهامش ← عمودان وثلاثة صفوف
    expect(parts.length).toBe(6);
    // الأول أعلى اليمين
    expect(parts[0].x + parts[0].w).toBeCloseTo(r.x + r.w);
    expect(parts[0].y).toBe(r.y);
    for (const p of parts) expect(partsOf(p, view)).toHaveLength(1);
  });
  it('لا يتجاوز الحد الأقصى للأجزاء', () => {
    expect(partsOf({ x: 0, y: 0, w: 1200, h: 5000 }, view).length).toBe(MAX_PARTS);
  });
  it('تضييق الجزء على محتواه، والفارغ لا شيء', () => {
    const content = [{ x: 50, y: 50, w: 100, h: 20 }, { x: 300, y: 300, w: 10, h: 10 }];
    expect(fitToContent({ x: 0, y: 0, w: 200, h: 200 }, content)).toEqual({ x: 50, y: 50, w: 100, h: 20 });
    expect(fitToContent({ x: 500, y: 500, w: 100, h: 100 }, content)).toBeNull();
    expect(contentArea({ x: 0, y: 0, w: 100, h: 100 }, content)).toBe(50 * 20);
  });
});

describe('خطة الجولة', () => {
  const cards = [card('رأس الصفحة', 200, 20, 800, 80), card('كبيرة', 100, 140, 1100, 900), card('صغيرة', 100, 1100, 400, 200)];
  it('الصفحة كاملة أولاً، ثم البطاقات بالترتيب، والكبيرة أجزاء', () => {
    const shots = planTour('p', cards, view);
    expect(shots[0]).toMatchObject({ kind: 'overview', rect: null, key: 'p|الصفحة' });
    expect(shots.map((s) => s.kind)).toEqual(['overview', 'card', 'part', 'part', 'part', 'part', 'part', 'part', 'card']);
    expect(shots[2].key).toBe('p|كبيرة|1');
    expect(new Set(shots.map((s) => s.key)).size).toBe(shots.length);
  });
  it('الأجزاء الفارغة أو الهامشية تُتخطّى، وما يبقى واحداً يصير بطاقة', () => {
    // محتوى البطاقة الكبيرة كله في ربعها الأيمن العلوي، وشارة صغيرة في الأيسر
    const content = [{ x: 700, y: 160, w: 450, h: 200 }, { x: 120, y: 160, w: 30, h: 12 }];
    const shots = planTour('p', [cards[1]], view, { content });
    expect(shots.map((s) => s.kind)).toEqual(['overview', 'card']);
    expect(shots[1].rect).toEqual({ x: 700, y: 160, w: 450, h: 200 });
    expect(30 * 12).toBeLessThan(450 * 200 * MINOR_PART);
  });
  it('كل خطوة مقرّبة بحجم مقروء: 14px تصير 28px أو أكثر على شاشة 1920', () => {
    for (const s of planTour('p', cards, view).slice(1)) expect(shotCam(s, view, 2000).s * 14).toBeGreaterThanOrEqual(28 - 0.01);
    expect(READABLE * 14).toBe(28);
  });
  it('الصفحة كاملة بعرض الشاشة من أعلاها', () => {
    expect(shotCam(planTour('p', [], view)[0], view, 2000)).toEqual({ s: 1.5, tx: 0, ty: 0 });
  });
});

describe('المدد والتخطّي', () => {
  const shots = planTour('p', [card('أ', 0, 0, 300, 200), card('ب', 0, 300, 300, 200)], view);
  it('المدة الخاصة أو العامة بالملّي ثانية', () => {
    expect(shotDuration(shots[1], 5, {})).toBe(5000);
    expect(shotDuration(shots[1], 5, { 'p|أ': 2.5 })).toBe(2500);
  });
  it('مدة 0 تتخطّى الخطوة', () => {
    expect(visibleShots(shots, { 'p|أ': 0 }).map((s) => s.key)).toEqual(['p|الصفحة', 'p|ب']);
  });
  it('K يشغّل الجولة أو يوقفها بأي لوحة مفاتيح', () => {
    expect(keyAction({ key: 'k', code: 'KeyK' })).toBe('tour');
    expect(keyAction({ key: 'ن', code: 'KeyK' })).toBe('tour');
  });
});
