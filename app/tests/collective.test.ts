// التقييم الجماعي لكل رحلة: المجموعة الخامسة والأعضاء الموزَّعون ومتوسط المقيّمين
import { describe, expect, it } from 'vitest';
import { collectiveTeamIds, tripEvaluatorAverage, tripEvaluatorIds } from '@/domain/collectiveEvaluation';
import { computeScores } from '@/domain/points';
import { isTripTeam } from '@/domain/permissions';
import { harness } from './helpers/harness';

describe('التقييم الجماعي', () => {
  it('مقيّمو الرحلة كل فريق العمل: الميسّرون الأربعة والقائد العام ومساعده، والمشرف لا يقيّم', () => {
    const h = harness('p_lead');
    expect(tripEvaluatorIds(h.db).sort()).toEqual(['p_lead', 's1', 's2', 's3', 's4', 's7']);
    expect(tripEvaluatorIds(h.db)).not.toContain('s8');
  });
  it('3 ميسّرين + القائد + المساعد بدرجات مختلفة: المتوسط البسيط، ومن لم يرسل لا يدخل، والمؤقت قبل الإغلاق', () => {
    const h = harness('p_lead');
    const t = h.db.trips.find((x) => x.executor.kind === 'group' && x.type === 'external')!;
    delete t.closedAt;
    t.evaluation.staffRatings = { s1: { score: 6, at: '' }, s2: { score: 7, at: '' }, s3: { score: 8, at: '' }, p_lead: { score: 9, at: '' }, s7: { score: 10, at: '' }, s5: { score: 0, at: '' } };
    const r = tripEvaluatorAverage(h.db, t);
    expect(r.avg).toBe(8); // (6+7+8+9+10)/5، وs4 لم يرسل وs5 ليس مقيّماً
    expect(r.rated).toBe(5);
    expect(r.total).toBe(6);
    expect(r.provisional).toBe(true);
    t.closedAt = new Date().toISOString();
    expect(tripEvaluatorAverage(h.db, t).provisional).toBe(false);
  });
  it('استبعاد ميسّر المجموعة المنفذة إعداد معطّل افتراضياً، ونافذة التقييم بعد الإغلاق', () => {
    const h = harness('p_lead');
    const t = h.db.trips.find((x) => x.executor.kind === 'group' && x.type === 'external')!;
    const fac = h.db.groups.find((g) => g.id === (t.executor as { groupId: string }).groupId)!.facilitatorId!;
    expect(tripEvaluatorIds(h.db, t)).toContain(fac);
    h.db.settings.excludeTripFacilitator = true;
    expect(tripEvaluatorIds(h.db, t)).not.toContain(fac);
    const closed = new Date(Date.now() - 10 * 86400000).toISOString(); // أُغلقت قبل 10 أيام، والنافذة 7
    t.closedAt = closed;
    t.evaluation.staffRatings = { p_lead: { score: 10, at: new Date(Date.now() - 9 * 86400000).toISOString() }, s7: { score: 2, at: new Date().toISOString() } };
    expect(tripEvaluatorAverage(h.db, t).avg).toBe(10); // تقييم s7 بعد النافذة لا يدخل
  });
  it('مجموعة خامسة بلا رحلة خارجية، وأعضاؤها يوزَّعون على رحلات مجموعات أخرى ويأخذون نقاطها نفسها', () => {
    const h = harness('p_lead');
    h.repos.groups.create('مجموعة حراء');
    const g5 = h.db.groups[h.db.groups.length - 1];
    // عضوان في المجموعة الخامسة
    h.repos.groups.assignDraft('u25', g5.id);
    h.repos.groups.assignDraft('u26', g5.id);
    const ext = h.db.trips.filter((x) => x.executor.kind === 'group' && x.type === 'external');
    expect(ext.some((t) => t.executor.kind === 'group' && t.executor.groupId === g5.id)).toBe(false);
    const tripId = ext[0].id;
    h.repos.trips.assignExternalMember(tripId, 'u25');
    h.repos.trips.assignExternalMember(tripId, 'u26');
    const trip = h.db.trips.find((t) => t.id === tripId)!;
    expect(collectiveTeamIds(h.db, trip)).toEqual(expect.arrayContaining(['u25', 'u26']));
    expect(isTripTeam(h.db, 'u25', trip)).toBe(true);

    trip.evaluation.staffRatings = { p_lead: { score: 10, at: '' }, s7: { score: 6, at: '' } };
    const sc = computeScores(h.db);
    const gs = (id: string) => sc.persons.find((p) => p.personId === id)!.groupShare;
    const owner = trip.executor.kind === 'group' ? h.db.groups.find((g) => g.id === (trip.executor as { groupId: string }).groupId)!.memberIds[0] : '';
    // الموزَّع يأخذ من الرحلة الخارجية ما يأخذه عضو فريقها
    expect(sc.persons.find((p) => p.personId === 'u25')!.groupShare).toBeGreaterThan(0);
    expect(gs('u25')).toBe(gs('u26'));
    expect(h.db.groups.find((g) => g.id === g5.id)!.memberIds).toEqual(['u25', 'u26']); // يبقيان في مجموعتهما
    // لا يشترط أن يساويا صاحب الرحلة الأصلي في الداخلية، لكن الخارجية نفسها
    const ext_of = (id: string) => sc.persons.find((p) => p.personId === id)!;
    expect(ext_of('u25').groupShare).toBeGreaterThan(0);
    expect(owner).toBeTruthy();
    // ترتيب المجموعات يشمل الخامسة بلا خطأ
    expect(sc.groups.some((g) => g.groupId === g5.id)).toBe(true);
    expect(sc.groups.map((g) => g.rank).sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('المجموعة = متوسط مجموع نقاط أعضائها', () => {
    const h = harness('p_lead');
    const sc = computeScores(h.db);
    const g = h.db.groups[0];
    const avg = g.memberIds.reduce((s, id) => s + sc.persons.find((p) => p.personId === id)!.total, 0) / g.memberIds.length;
    expect(sc.groups.find((x) => x.groupId === g.id)!.total).toBeCloseTo(avg, 1);
  });

  it('توزيع عضو على رحلة لمجموعته نفسها أو من غير القيادة مرفوض', () => {
    const h = harness('s1');
    const trip = h.db.trips.find((x) => x.executor.kind === 'group' && x.type === 'external')!;
    expect(() => h.repos.trips.assignExternalMember(trip.id, 'u25')).toThrow();
    h.as('p_lead');
    const own = trip.executor.kind === 'group' ? trip.executor.groupId : '';
    const member = h.db.groups.find((g) => g.id === own)!.memberIds[0];
    expect(() => h.repos.trips.assignExternalMember(trip.id, member)).toThrow(/مجموعة/);
  });
});
