// اختبارات منطق الصلاحيات والنقاط ودورة الاعتماد (بلا واجهة)
import { describe, expect, it } from 'vitest';
import { buildSeed } from '@/data/seed';
import { fixtureSeed } from './helpers/fixture';
import { canEditTripDoc, canFacilitatorReview, canLeaderDecide, canSeeFacilitatorNotes, canSeeFinance, canSeePersonalPlan, canViewTripPlans, getCapabilities, trackerConflict } from '@/domain/permissions';
import { computeScores } from '@/domain/points';
import { applyDocAction, canPublish, docFor, isPlanUnlocked, publishChecks } from '@/domain/workflow';

const db = fixtureSeed();
const trip = (id: string) => db.trips.find((t) => t.id === id)!;

describe('الصفات والصلاحيات', () => {
  it('تتجمع الصفات على الشخص', () => {
    const c = getCapabilities(db, 's3');
    expect(c.facilitatorOf.map((g) => g.id)).toEqual(['g3']);
    expect(c.isFinance).toBe(true);
    expect(c.isFinanceLead).toBe(false);
    const owner = getCapabilities(db, 's5');
    expect(owner.isTracker).toBe(false); // مسؤول المالية بلا صفة ثانية
    expect(owner.isFinanceLead).toBe(true);
    expect(getCapabilities(db, 's6').isTechLead).toBe(true);
    expect(getCapabilities(db, 's7').isTracker).toBe(true);
  });
  it('خطط المجموعة لا تراها المجموعات الأخرى أبداً، وتراها الإدارة', () => {
    expect(canViewTripPlans(db, 'u2', trip('t7'))).toBe(true); // من أُحُد
    expect(canViewTripPlans(db, 'u8', trip('t7'))).toBe(false); // من قُباء
    expect(canViewTripPlans(db, 's4', trip('t7'))).toBe(true); // عضو إدارة
  });
  it('قائد المجموعة وحده يعدّل الوثيقة', () => {
    const doc = docFor(db, 't9', 'document')!;
    expect(canEditTripDoc(db, 'u13', trip('t9'), doc)).toBe(true);
    expect(canEditTripDoc(db, 'u14', trip('t9'), doc)).toBe(false);
  });
  it('المالية للجنة المالية والقائد العام فقط', () => {
    expect(canSeeFinance(db, 's3')).toBe(true);
    expect(canSeeFinance(db, 's1')).toBe(false); // الميسّر خارج اللجنة المالية
    expect(canSeeFinance(db, 'p_lead')).toBe(true);
    expect(canSeeFinance(db, 's2')).toBe(false);
    expect(canSeeFinance(db, 'u1')).toBe(false);
  });
  it('الخطة الشخصية: صاحبها وميسّره والقائد العام فقط', () => {
    expect(canSeePersonalPlan(db, 'u2', 'u2')).toBe(true);
    expect(canSeePersonalPlan(db, 's1', 'u2')).toBe(true);
    expect(canSeePersonalPlan(db, 's2', 'u2')).toBe(false);
    expect(canSeePersonalPlan(db, 'p_lead', 'u2')).toBe(true);
    expect(canSeePersonalPlan(db, 'u3', 'u2')).toBe(false);
  });
  it('سجل الملاحظات لا يراه المشارك', () => {
    expect(canSeeFacilitatorNotes(db, 'u1')).toBe(false);
    expect(canSeeFacilitatorNotes(db, 's3')).toBe(true);
  });
  it('المتابع لا يكون ميسّر الرحلة', () => {
    expect(trackerConflict(db, 's1', trip('t3'))).not.toBeNull();
    expect(trackerConflict(db, 's5', trip('t3'))).toBeNull();
    expect(trackerConflict(db, 'p_lead', trip('t1'))).not.toBeNull();
  });
  it('الخطة الشخصية تُفتح للجميع عند البند أو التوقيت المحدد في رحلتها', () => {
    expect(isPlanUnlocked(db, 'u1')).toBe(true);
    expect(isPlanUnlocked(db, 'u6')).toBe(true);
  });
});

describe('دورة الاعتماد', () => {
  it('رفض الميسّر يرجعها للفريق، ورفض القائد يرجعها لقائد المجموعة', () => {
    const doc = docFor(db, 't7', 'schedule')!;
    expect(canFacilitatorReview(db, 's1', trip('t7'), doc)).toBe(true);
    const rej = applyDocAction(doc, { type: 'facilitator_reject', reason: 'نقص' }, 's1', false);
    expect(rej.status).toBe('returned_by_facilitator');
    const again = applyDocAction(rej, { type: 'submit' }, 'u1', false);
    expect(again.version).toBe(2);
    const fac = applyDocAction(again, { type: 'facilitator_approve' }, 's1', false);
    expect(canLeaderDecide(db, 'p_lead', trip('t7'), fac)).toBe(true);
    expect(canLeaderDecide(db, 's2', trip('t7'), fac)).toBe(false); // عضو الإدارة لا يعتمد
    const lrej = applyDocAction(fac, { type: 'leader_reject', reason: 'x' }, 'p_lead', false);
    expect(lrej.status).toBe('returned_by_leader');
  });
  it('الرفض بلا سبب ممنوع', () => {
    const doc = docFor(db, 't7', 'schedule')!;
    expect(() => applyDocAction(doc, { type: 'facilitator_reject', reason: ' ' }, 's1', false)).toThrow();
  });
  it('رحلات فريق العمل ترفع للقائد العام مباشرة', () => {
    const doc = { ...docFor(db, 't11', 'schedule')!, status: 'submitted' as const };
    expect(canLeaderDecide(db, 'p_lead', trip('t11'), doc)).toBe(true);
  });
  it('النشر لا يعمل إلا باكتمال الشروط', () => {
    expect(canPublish(db, trip('t6'))).toBe(false); // الموازنة غير معتمدة
    expect(publishChecks(db, trip('t6')).find((c) => c.label.includes('الميزانية'))!.ok).toBe(false);
  });
});

describe('محرك النقاط', () => {
  const s = computeScores(db);
  it('النقاط كسب فقط: لا قيمة سالبة', () => {
    s.persons.forEach((p) => p.individual.forEach((i) => expect(i.points).toBeGreaterThanOrEqual(0)));
    s.log.forEach((l) => expect(l.points).toBeGreaterThan(0));
  });
  it('الجماعي يُوزَّع على الأعضاء بالتساوي', () => {
    const g1 = s.persons.filter((p) => p.groupId === 'g1').map((p) => p.groupShare);
    expect(new Set(g1).size).toBe(1);
  });
  it('الجماعي لا يتجاوز نصيبه', () => {
    s.groups.forEach((g) => expect(g.total).toBeLessThanOrEqual(db.settings.split.group + 0.01));
  });
  it('تعديل الأوزان أو تعطيل البنود لا يكسر الحساب', () => {
    const copy = structuredClone(db);
    copy.settings.evaluationItems.forEach((i) => (i.weight = 0));
    expect(() => computeScores(copy)).not.toThrow();
    copy.settings.evaluationItems = [];
    copy.settings.groupTripSplit = { internal: 0, external: 0 };
    const r = computeScores(copy);
    r.persons.forEach((p) => expect(Number.isFinite(p.total)).toBe(true));
  });
  it('من لم يقدّم لا تُخصم نقاطه', () => {
    const copy = structuredClone(db);
    copy.focusMeetings.forEach((f) => (f.presenterEvaluations = {}));
    computeScores(copy).persons.forEach((p) => expect(p.individual.find((i) => i.key === 'presenting')!.points).toBe(0));
  });
});
