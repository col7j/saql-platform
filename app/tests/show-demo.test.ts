// ديمو عرض الحفل: يقرأ لقطة ثابتة ولا يكتب في أي مخزن
import { beforeAll, describe, expect, it, vi } from 'vitest';

const writes: string[] = [];
beforeAll(() => {
  // مخزن متصفح وهمي يسجّل كل كتابة
  const m = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => (writes.push(k), m.set(k, v)),
    removeItem: (k: string) => (writes.push(k), m.delete(k)),
    clear: () => writes.push('*clear*'),
  });
});

describe('ديمو المنصة للقراءة فقط', () => {
  it('يختار رحلة مكتملة: وثيقة وخطتان أ وب وميزانية', async () => {
    const { demoSnapshot, pickDemoTrip } = await import('@/show/demo/data');
    const db = demoSnapshot();
    const t = pickDemoTrip(db)!;
    expect(t.schedule.plans.map((p) => p.name).slice(0, 2)).toEqual(['الخطة أ', 'الخطة ب']);
    expect(t.schedule.plans[1].items.length).toBeGreaterThan(0);
    expect(db.budgetRequests.some((r) => r.ownerId === t.id)).toBe(true);
    expect(pickDemoTrip(db, db.trips[2].id)!.id).toBe(db.trips[2].id);
    expect(pickDemoTrip(db, 'غير-موجود')!.id).toBe(t.id);
  });

  it('أي تعديل من الشاشات لا يغيّر اللقطة ولا يُكتب في التخزين', async () => {
    const { useStore, repos } = await import('@/state/store');
    const { enterReadOnly, demoSnapshot, demoUserId } = await import('@/show/demo/data');
    enterReadOnly();
    writes.length = 0;
    const db = demoSnapshot();
    const before = JSON.stringify(db);
    const trip = db.trips[0];
    try {
      repos.trips.update(trip.id, { title: 'تعديل من الديمو' });
    } catch {
      /* قد ترفض الصلاحيات، والمهم ألا يتغير شيء */
    }
    useStore.getState().setUser('someone-else');
    useStore.getState().reset();
    expect(useStore.getState().db).toBe(db);
    expect(JSON.stringify(useStore.getState().db)).toBe(before);
    expect(useStore.getState().userId).toBe(demoUserId(db));
    expect(writes).toEqual([]);
  });
});

describe('كاميرا الديمو', () => {
  const view = { w: 1920, h: 1080 };
  it('النظرة العامة تملأ العرض من أعلى الصفحة', async () => {
    const { overview, PAGE_W } = await import('@/show/demo/camera');
    expect(overview(view)).toEqual({ s: 1920 / PAGE_W, tx: 0, ty: 0 });
  });
  it('التقريب يضع البطاقة في الوسط بتكبير محدود', async () => {
    const { focus } = await import('@/show/demo/camera');
    const r = { x: 600, y: 700, w: 400, h: 200 };
    const c = focus(r, view, 3000, { pad: 0 });
    expect(c.s).toBeCloseTo((1920 / 1440) * 2.6);
    expect(c.tx + c.s * (r.x + r.w / 2)).toBeCloseTo(view.w / 2);
    expect(c.ty + c.s * (r.y + r.h / 2)).toBeCloseTo(view.h / 2);
  });
  it('لا يُظهر فراغاً فوق الصفحة أو على جانبيها', async () => {
    const { focus } = await import('@/show/demo/camera');
    const c = focus({ x: 0, y: 0, w: 300, h: 150 }, view, 3000);
    expect(c.tx).toBeLessThanOrEqual(0);
    expect(c.ty).toBeLessThanOrEqual(0);
    expect(c.tx).toBeGreaterThanOrEqual(view.w - c.s * 1440);
  });
  it('البطاقة الطويلة يظهر أعلاها مقروءاً لا مصغّرة كلها', async () => {
    const { focus } = await import('@/show/demo/camera');
    const c = focus({ x: 300, y: 400, w: 1000, h: 2400 }, view, 4000, { pad: 0 });
    expect(c.s).toBeCloseTo(1920 / 1000);
    expect(c.ty + c.s * 400).toBeCloseTo(0); // أعلى البطاقة عند أعلى الشاشة
  });
});
