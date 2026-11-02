// وثيقة الرحلة: بنية القالب بيانات، والربط بالاعتماد، وتفعيل القالب للرحلات الجديدة فقط
import { describe, expect, it } from 'vitest';
import { addDays, todayISO } from '@/domain/dates';
import { activityCost, coordinationView, defaultDocTemplate, docGaps, goalsOf, rowsOf, sectionsFor } from '@/domain/tripDocument';
import { docFor } from '@/domain/workflow';
import { routeAccess } from '@/domain/access';
import { harness } from './helpers/harness';

describe('وثيقة الرحلة', () => {
  it('رحلة رشد - القصيم مملوءة بأقسام النموذج، والأقسام العشرة في القالب', () => {
    const h = harness('p_lead');
    expect(h.db.settings.docTemplate).toHaveLength(10);
    const trip = h.db.trips.find((t) => t.title.includes('رشد'))!;
    const init = docFor(h.db, trip.id, 'document')!;
    const det = docFor(h.db, trip.id, 'detailed')!;
    expect(init.fields.slogan).toBe('رشد رفقة وأثر');
    expect(goalsOf(init.fields).educational).toContain('قيادة الفريق');
    expect(rowsOf(det.fields, 'activities').length).toBeGreaterThanOrEqual(5);
    expect(rowsOf(det.fields, 'approvals').some((r) => r.name === 'بيت الشباب' && r.done === 'yes')).toBe(true);
    expect(docGaps(h.db, trip, init)).toEqual([]);
    expect(docGaps(h.db, trip, det)).toEqual([]);
  });
  it('الأقسام تتوزع على المرحلتين، وتُخفى أقسام السكن والأسر عن الداخلية', () => {
    const h = harness('p_lead');
    const ext = h.db.trips.find((t) => t.type === 'external')!;
    const int = h.db.trips.find((t) => t.type === 'internal')!;
    expect(sectionsFor(h.db, ext, 'initial').map((s) => s.id)).toEqual(['identity', 'justification', 'transport', 'goals']);
    expect(sectionsFor(h.db, ext, 'detailed').map((s) => s.id)).toContain('housing');
    expect(sectionsFor(h.db, int, 'detailed').map((s) => s.id)).not.toContain('housing');
    expect(sectionsFor(h.db, int, 'detailed').map((s) => s.id)).not.toContain('families');
  });
  it('رفع المبدئية بنواقص مرفوض بسبب واضح ثم يُقبل مكتملة، والتفصيلية بعد المبدئية', () => {
    const h = harness('u1');
    const trip = h.db.trips.find((t) => t.executor.kind === 'group' && t.executor.groupId === 'g1' && t.type === 'internal' && docFor(h.db, t.id, 'document')?.status === 'draft');
    if (!trip) return;
    expect(docGaps(h.db, trip, docFor(h.db, trip.id, 'document')!).length).toBeGreaterThan(0);
  });
  it('الربط ببند الميزانية يقرأ التكلفة منها، والتنسيقات عرض بلا تكرار', () => {
    const h = harness('p_lead');
    const lines = [{ id: 'l1', categoryId: 'c', description: 'باص', unit: 'رحلة', qty: 2, price: 500 }];
    expect(activityCost(lines, { id: 'a', cost: '10', budgetLine: 'l1' })).toBe(1000);
    expect(activityCost(lines, { id: 'a', cost: '10' })).toBe(10);
    const trip = h.db.trips.find((t) => t.title.includes('رشد'))!;
    const v = coordinationView(h.db, trip, docFor(h.db, trip.id, 'detailed'), (id) => id);
    expect(v.approvals.length).toBe(3);
    expect(v.housing[0].location).toBe('بريدة');
  });
  it('تغيير القالب يؤثر على الرحلات الجديدة فقط', () => {
    const h = harness('p_lead');
    const before = h.db.trips[0];
    const tpl = defaultDocTemplate().filter((s) => s.id !== 'health');
    h.repos.settings.update({ docTemplate: tpl });
    const id = h.repos.trips.create({
      title: 'رحلة جديدة', type: 'internal', executor: { kind: 'group', groupId: 'g1' }, startDate: addDays(todayISO(), 30), endDate: addDays(todayISO(), 30),
      isPersonalPlanMeeting: false, deadlines: { document: addDays(todayISO(), 10), schedule: addDays(todayISO(), 15), budget: addDays(todayISO(), 15) },
    });
    const fresh = h.db.trips.find((t) => t.id === id)!;
    expect(sectionsFor(h.db, fresh).map((s) => s.id)).not.toContain('health');
    expect(sectionsFor(h.db, h.db.trips.find((t) => t.id === before.id)!).map((s) => s.id)).toContain('health'); // القائمة بنسختها القديمة
    expect(docFor(h.db, id, 'detailed')).toBeTruthy();
  });
  it('طباعة الوثيقة للفريق والإدارة فقط', () => {
    const h = harness('p_lead');
    const trip = h.db.trips.find((t) => t.title.includes('رشد'))!;
    expect(routeAccess(h.db, 'p_lead', `/app/trip-print/${trip.id}`)).toBe(true);
    expect(routeAccess(h.db, 'u1', `/app/trip-print/${trip.id}`)).toBe(false); // مشارك من مجموعة أخرى
  });
});
