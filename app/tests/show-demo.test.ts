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
  it('الديمو بصفة مشارك في مجموعة، لا القائد العام ولا أحد من الإدارة', async () => {
    const { demoSnapshot, demoUserId, DEMO_PARTICIPANT } = await import('@/show/demo/data');
    const { getCapabilities } = await import('@/domain/permissions');
    const db = demoSnapshot();
    const c = getCapabilities(db, demoUserId(db));
    expect(demoUserId(db)).toBe(DEMO_PARTICIPANT);
    expect(c.isParticipant).toBe(true);
    expect(c.isStaff || c.isLeader).toBe(false);
    expect(c.group).toBeTruthy();
  });

  it('كل شاشة يمر بها الديمو فيها بيانات يراها المشارك بصلاحياته الفعلية', async () => {
    const { demoSnapshot, demoTargets } = await import('@/show/demo/data');
    const { canViewTripPlans, canTakeTripAttendance } = await import('@/domain/permissions');
    const { eventsFor } = await import('@/domain/calendar');
    const { isPlanUnlocked } = await import('@/domain/workflow');
    const db = demoSnapshot();
    const t = demoTargets(db);
    const trip = db.trips.find((x) => x.id === t.tripId)!;
    expect(canViewTripPlans(db, t.personId, trip)).toBe(true);
    expect(canTakeTripAttendance(db, t.personId, trip)).toBe(true);
    expect(trip.schedule.plans.slice(0, 2).map((p) => p.name)).toEqual(['الخطة أ', 'الخطة ب']);
    expect(trip.schedule.plans[1].items.length).toBeGreaterThan(0);
    // يوم التقويم فيه عام ومجموعة وخاص
    const kinds = new Set(eventsFor(db, t.personId).filter((e) => e.date === t.day).map((e) => e.scope));
    expect(kinds.has('personal')).toBe(true);
    expect(eventsFor(db, t.personId).filter((e) => e.date === t.day).length).toBeGreaterThanOrEqual(2);
    // لقاء التركيز: المشارك مقدّمه وتقييمه مكتمل
    const f = db.focusMeetings.find((x) => x.id === t.focusId)!;
    expect(f.presenterIds).toContain(t.personId);
    expect(Object.keys(f.presenterEvaluations[t.personId] ?? {}).length).toBe(db.settings.presentationCriteria.length);
    // الخطة الشخصية مفتوحة وفيها خطوات
    expect(isPlanUnlocked(db, t.personId)).toBe(true);
    expect(db.personalPlans.find((p) => p.participantId === t.personId)!.aspects.some((a) => a.steps.length > 0)).toBe(true);
  });

  it('الإثراء على نسخة الديمو وحدها: بيانات المنصة التجريبية لا تتغير', async () => {
    const { buildSeed } = await import('@/data/seed');
    const { demoSnapshot } = await import('@/show/demo/data');
    const seed = buildSeed();
    const demo = demoSnapshot();
    expect(demo).not.toBe(seed);
    expect(seed.individualMeetings.some((m) => m.id === 'im_demo')).toBe(false);
    expect(demo.individualMeetings.some((m) => m.id === 'im_demo')).toBe(true);
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
  it('المنطقة الصغيرة في الوسط بتكبير محدود بالحد الأقصى', async () => {
    const { focus } = await import('@/show/demo/camera');
    const r = { x: 500, y: 600, w: 300, h: 150 };
    const c = focus(r, view, 3000, { pad: 0, max: 2.4 });
    expect(c.s).toBeCloseTo(2.4);
    expect(c.tx + c.s * (r.x + r.w / 2)).toBeCloseTo(view.w / 2);
    expect(c.ty + c.s * (r.y + r.h / 2)).toBeCloseTo(view.h / 2);
  });
  it('نص المنصة (14px) لا يقل عن 28px بعد التقريب حتى للبطاقة الكبيرة', async () => {
    const { focus, READABLE, screenScale } = await import('@/show/demo/camera');
    const big = { x: 100, y: 300, w: 1100, h: 1600 };
    const c = focus(big, view, 4000, { min: READABLE });
    expect(14 * c.s).toBeGreaterThanOrEqual(28);
    // وعلى دقة أصغر: نفس النسبة من عرض الشاشة
    const small = focus(big, { w: 1280, h: 720 }, 4000, { min: READABLE });
    expect(screenScale({ w: 1920, h: 1080 }, 14 * small.s * (1920 / 1280))).toBeCloseTo(14 * c.s);
  });
  it('المنطقة الأعرض من الشاشة: يظهر جانبها الأيمن (بداية القراءة)، والأطول: يظهر أعلاها', async () => {
    const { focus } = await import('@/show/demo/camera');
    const r = { x: 100, y: 300, w: 1100, h: 1600 };
    const c = focus(r, view, 4000, { pad: 0, min: 2 });
    expect(c.tx + c.s * (r.x + r.w)).toBeCloseTo(view.w); // الحافة اليمنى عند يمين الشاشة
    expect(c.ty + c.s * r.y).toBeCloseTo(0); // الأعلى عند أعلى الشاشة
  });
  it('لا يُظهر فراغاً خارج الصفحة حين تملأ الشاشة', async () => {
    const { focus, PAGE_W } = await import('@/show/demo/camera');
    const c = focus({ x: 0, y: 0, w: 200, h: 100 }, view, 3000, { min: 2 });
    expect(c.tx).toBeLessThanOrEqual(0);
    expect(c.ty).toBeLessThanOrEqual(0);
    expect(c.tx).toBeGreaterThanOrEqual(view.w - c.s * PAGE_W);
  });
  it('المستطيل الجامع', async () => {
    const { union } = await import('@/show/demo/camera');
    expect(union([{ x: 10, y: 20, w: 5, h: 5 }, null, { x: 0, y: 30, w: 50, h: 10 }])).toEqual({ x: 0, y: 20, w: 50, h: 20 });
    expect(union([null])).toBeNull();
  });
});

describe('الكاميرا وشعار الزاوية', () => {
  it('المنطقة العريضة المثبّتة يميناً تبتعد عن منطقة الشعار بمقدار end', async () => {
    const { focus } = await import('@/show/demo/camera');
    const view = { w: 1920, h: 1080 };
    const r = { x: 100, y: 100, w: 1000, h: 300 };
    const a = focus(r, view, 2000, { min: 2.4, max: 2.4 });
    const b = focus(r, view, 2000, { min: 2.4, max: 2.4, end: 150 });
    expect(a.tx - b.tx).toBeCloseTo(150);
    // المنطقة التي تتسع كلها في الوسط لا تتأثر
    const small = { x: 300, y: 100, w: 300, h: 200 };
    expect(focus(small, view, 2000, { max: 2, end: 150 })).toEqual(focus(small, view, 2000, { max: 2 }));
  });
});
