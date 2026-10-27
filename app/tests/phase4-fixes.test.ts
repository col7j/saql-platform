// تعديلات ما بعد المرحلة 4: إنشاء الاجتماعات، والحضور الفردي، ومواعيد الرحلة الجماعية، والتقديم المتكرر، والإغلاق، والرسوم
import { describe, expect, it } from 'vitest';
import { addDays, nowISO, todayISO } from '@/domain/dates';
import { computeScores } from '@/domain/points';
import { closeDeadline, deadlineCredit, earlyDeadline, tripCloseBlock } from '@/domain/workflow';
import type { Meeting } from '@/domain/types';
import { harness } from './helpers/harness';

const meeting = (owner: string): Omit<Meeting, 'id' | 'createdBy' | 'status' | 'attendeeIds' | 'decisions' | 'outputs' | 'createdAt'> => ({
  title: 'اجتماع تجربة', kind: 'urgent', recurrence: 'none', withGroupLeaders: false, date: addDays(todayISO(), 2), start: '20:00', end: '21:00', location: 'المقر', ownerId: owner, inviteeIds: [owner], agenda: ['بند'],
});

describe('الاجتماعات', () => {
  it('قائد المجموعة والمشارك لا ينشئان اجتماعاً، وفريق العمل ينشئ', () => {
    const h = harness('u1'); // قائد مجموعة
    expect(() => h.repos.meetings.create(meeting('u1'))).toThrow(/لفريق العمل فقط/);
    h.as('u2');
    expect(() => h.repos.meetings.create(meeting('u2'))).toThrow(/لفريق العمل فقط/);
    h.as('s1');
    const id = h.repos.meetings.create(meeting('s1'));
    expect(h.db.meetings.some((m) => m.id === id)).toBe(true);
  });
  it('طلب الميزانية مع الإنشاء نفسه حين تكون ميزانية الاجتماعات معتمدة', () => {
    const h = harness('s1');
    const id = h.repos.meetings.create(meeting('s1'), { amount: h.db.programBudget.meetingDefault });
    expect(h.db.budgetRequests.find((r) => r.ownerKind === 'meeting' && r.ownerId === id)?.status).toBe('pending_finance');
    h.db.programBudget.meetingDefault = 0;
    expect(() => h.repos.meetings.create(meeting('s1'), { amount: 100 })).toThrow(/غير معتمدة/);
  });
});

describe('الحضور في التقييم الفردي', () => {
  const att = (h: ReturnType<typeof harness>) => computeScores(h.db).persons.find((p) => p.personId === 'u1')!.individual.find((i) => i.key === 'attendance')!.points;
  it('المبكر والوقت درجة واحدة كاملة، والمتأخر جزء من الإعدادات، والغائب صفر', () => {
    const h = harness('p_lead');
    const mine = () => h.db.attendance.filter((x) => x.eventKind === 'trip' && x.personId === 'u1');
    mine().forEach((x) => Object.assign(x, { status: 'on_time', present: true }));
    const onTime = att(h);
    mine().forEach((x) => (x.status = 'early'));
    expect(att(h)).toBe(onTime);
    mine().forEach((x) => (x.status = 'late'));
    const late = att(h);
    expect(late).toBeLessThan(onTime);
    h.db.settings.attendanceLateCredit = 1;
    expect(att(h)).toBe(onTime);
    mine().forEach((x) => Object.assign(x, { status: 'absent', present: false }));
    expect(att(h)).toBeLessThan(late);
  });
  it('لا بند «الالتزام» الفردي المركّب', () => {
    const h = harness('p_lead');
    expect(h.db.settings.evaluationItems.some((i) => i.key === 'commitment')).toBe(false);
    expect(computeScores(h.db).persons[0].individual.some((i) => i.key === 'commitment')).toBe(false);
  });
});

describe('مواعيد الرحلة في التقييم الجماعي', () => {
  it('مبكر = كامل، في النهائي = جزء من الإعدادات، بعده = صفر', () => {
    const h = harness('p_lead');
    h.db.settings.deadlineFinalCredit = 0.4;
    expect(deadlineCredit(h.db, '2026-01-05T10:00:00Z', '2026-01-10', '2026-01-20')).toBe(1);
    expect(deadlineCredit(h.db, '2026-01-15T10:00:00Z', '2026-01-10', '2026-01-20')).toBe(0.4);
    expect(deadlineCredit(h.db, '2026-01-21T10:00:00Z', '2026-01-10', '2026-01-20')).toBe(0);
    expect(deadlineCredit(h.db, undefined, '2026-01-10', '2026-01-20')).toBe(0);
  });
  it('موعد التبكير من الإعدادات بالأيام قبل الرحلة، ولا يتأخر عن النهائي', () => {
    const h = harness('p_lead');
    const t = h.db.trips.find((x) => x.id === 't9')!;
    h.db.settings.deadlineDefaults.documentEarlyDaysBefore = 15;
    expect(earlyDeadline(h.db, t, 'document')).toBe(addDays(t.startDate, -15) < t.deadlines.document ? addDays(t.startDate, -15) : t.deadlines.document);
  });
  it('التبكير يرفع نقاط المجموعة، والإغلاق بعد المهلة يخسر بنده', () => {
    const h = harness('p_lead');
    const pts = () => computeScores(h.db).groups.flatMap((g) => [...g.internal.trips, ...g.external.trips]).find((x) => x.tripId === 't3')!.items.find((i) => i.key === 'trip_auto')!.points;
    const t = h.db.trips.find((x) => x.id === 't3')!;
    const doc = h.db.docs.find((d) => d.tripId === 't3' && d.kind === 'document')!;
    doc.submittedAt = addDays(earlyDeadline(h.db, t, 'document'), -1) + 'T08:00:00.000Z';
    const early = pts();
    doc.submittedAt = t.deadlines.document + 'T08:00:00.000Z';
    const final = pts();
    doc.submittedAt = addDays(t.deadlines.document, 1) + 'T08:00:00.000Z';
    const late = pts();
    expect(early).toBeGreaterThan(final);
    expect(final).toBeGreaterThan(late);
    t.closedAt = new Date(new Date(closeDeadline(h.db, t, 'trip')).getTime() - 3600000).toISOString();
    const inTime = pts();
    t.closedAt = new Date(new Date(closeDeadline(h.db, t, 'trip')).getTime() + 3600000).toISOString();
    expect(pts()).toBeLessThan(inTime);
  });
});

describe('التقديم المتكرر', () => {
  it('متوسط كل معيار ضمن سقف البند، ونقاط تميّز ثابتة عن كل مرة بعد الأولى', () => {
    const h = harness('p_lead');
    h.db.settings.presentingRevealAfterEnd = false;
    h.db.settings.presentingExtraBonus = 3;
    const crit = h.db.settings.presentationCriteria.map((c) => c.key);
    h.db.focusMeetings.forEach((f) => { delete f.presenterEvaluations.u2; f.presenterIds = f.presenterIds.filter((x) => x !== 'u2'); });
    const fms = h.db.focusMeetings.filter((f) => f.groupId === 'g1').slice(0, 3);
    fms.forEach((f, i) => { f.presenterIds.push('u2'); f.presenterEvaluations.u2 = Object.fromEntries(crit.map((c, k) => [c, k === 0 ? [5, 3, 1][i] : 5])); });
    const item = computeScores(h.db).persons.find((p) => p.personId === 'u2')!.individual.find((i) => i.key === 'presenting')!;
    // المعيار الأول متوسطه 3 من 5، والبقية 5 من 5
    const avg = (0.6 + (crit.length - 1)) / crit.length;
    expect(item.ratio).toBeCloseTo(avg, 2);
    expect(item.extra).toBe(6); // تميّز مرتين × 3 نقاط
    expect(item.points).toBeCloseTo(item.maxPoints * avg + 6, 1);
    expect(item.points).toBeLessThan(item.maxPoints * 3); // لا مجموع المرات
  });
});

describe('إغلاق الرحلة', () => {
  it('لا تُغلق قبل اكتمال نصاب تقييمات فريق العمل', () => {
    const h = harness('p_lead');
    const t = h.db.trips.find((x) => x.id === 't3')!;
    t.evaluation.staffRatings = {};
    delete t.closedAt;
    expect(() => h.repos.trips.close('t3')).toThrow(/تقييمات فريق العمل/);
    const staff = h.db.persons.filter((p) => p.kind === 'staff');
    const needed = Math.ceil(staff.length * h.db.settings.tripRatingQuorum);
    staff.slice(0, needed).forEach((p) => (h.db.trips.find((x) => x.id === 't3')!.evaluation.staffRatings[p.id] = { score: 8, at: nowISO() }));
    expect(tripCloseBlock(h.db, h.db.trips.find((x) => x.id === 't3')!) ?? '').not.toMatch(/تقييمات فريق العمل/);
    h.as('u2');
    expect(() => h.repos.trips.close('t3')).toThrow(/لقائد فريقها أو القائد العام/);
  });
});

describe('الرسوم والعهد المتزامنة', () => {
  it('الرسوم بلا مرفق، والاستثناء نص حر يُعتبر سداداً', () => {
    const h = harness('s5');
    h.repos.finance.setFee('u3', { status: 'unpaid', exemption: 'مستفيد جمعية البر' });
    expect(h.db.fees.find((f) => f.personId === 'u3')).toMatchObject({ status: 'paid', exemption: 'مستفيد جمعية البر' });
  });
  it('حد العهد المتزامنة إعداد يملكه مسؤول المالية', () => {
    const h = harness('p_lead');
    expect(h.db.settings.finance.maxOpenCustodies).toBe(2);
    expect(() => h.repos.finance.setFinanceSettings({ maxOpenCustodies: 3 })).toThrow();
    h.as('s5');
    h.repos.finance.setFinanceSettings({ maxOpenCustodies: 3 });
    expect(h.db.settings.finance.maxOpenCustodies).toBe(3);
  });
  it('قيم التقييم تُتحقق عند الحفظ: التبكير أسبق من النهائي', () => {
    const h = harness('p_lead');
    h.db.settings.evaluationLock = { locked: false };
    expect(() => h.repos.settings.saveEvaluation({ deadlineDefaults: { ...h.db.settings.deadlineDefaults, documentEarlyDaysBefore: 5, documentDaysBefore: 10 } })).toThrow(/التبكير/);
  });
});
