// المرحلة 3: نماذج الرحلة، قفل البنود التي بدأت، المزدوجة، حالات الحضور، الافتتاحي والختامي، ومحرك النقاط الجديد
import { describe, expect, it } from 'vitest';
import { addDays, nowISO, todayISO } from '@/domain/dates';
import { computeScores } from '@/domain/points';
import { docFor } from '@/domain/workflow';
import { harness } from './helpers/harness';

describe('نماذج الرحلة الثلاثة', () => {
  it('الوثيقة أول ما يُرفع: الجدول والميزانية لا يُرفعان قبلها', () => {
    const h = harness('p_lead');
    const id = h.repos.trips.create({ title: 'تجربة', type: 'internal', executor: { kind: 'group', groupId: 'g3' }, startDate: addDays(todayISO(), 30), endDate: addDays(todayISO(), 30), isPersonalPlanMeeting: false, deadlines: { document: todayISO(), schedule: todayISO(), budget: todayISO() } });
    h.as('u13'); // قائد سَلع
    const s = docFor(h.db, id, 'schedule')!;
    expect(() => h.repos.trips.docAction(s.id, { type: 'submit' })).toThrow(/وثيقة الرحلة أولاً/);
    expect(() => h.repos.finance.submitRequest({ ownerKind: 'trip', ownerId: id, amount: 0, detailed: true, lines: [{ id: 'l', categoryId: 'bc_food', description: 'غداء', unit: 'وجبة', qty: 10, price: 30 }] })).toThrow(/وثيقة الرحلة أولاً/);
    h.repos.trips.docAction(docFor(h.db, id, 'document')!.id, { type: 'submit' });
    h.repos.trips.docAction(docFor(h.db, id, 'schedule')!.id, { type: 'submit' });
  });
  it('تخطيط رحلات المجموعات يبدأ بعد نشر التشكيل', () => {
    const h = harness('u13');
    h.db.formation = { status: 'draft' };
    const d = docFor(h.db, 't9', 'document')!;
    expect(() => h.repos.trips.docAction(d.id, { type: 'submit' })).toThrow(/بعد نشر التشكيل/);
  });
});

describe('الجدول أثناء التنفيذ', () => {
  it('البند الذي بدأ لا يُعدَّل، وما بعده يُعدَّل بلا اعتماد', () => {
    const h = harness('u7'); // قائد قُباء، رحلة t4 جارية
    const t = h.db.trips.find((x) => x.id === 't4')!;
    const plans = structuredClone(t.schedule.plans);
    const key = (i: { date: string; start: string }) => `${i.date}T${i.start}`;
    const now = nowISO().slice(0, 16);
    const started = plans[0].items.find((i) => key(i) <= now)!;
    const future = plans[0].items.find((i) => key(i) > now)!;
    future.detail = 'تعديل قبل البداية';
    h.repos.trips.saveSchedule('t4', plans);
    expect(h.db.trips.find((x) => x.id === 't4')!.schedule.plans[0].items.find((i) => i.id === future.id)!.detail).toBe('تعديل قبل البداية');
    const p2 = structuredClone(h.db.trips.find((x) => x.id === 't4')!.schedule.plans);
    p2[0].items.find((i) => i.id === started.id)!.detail = 'محاولة';
    expect(() => h.repos.trips.saveSchedule('t4', p2)).toThrow(/بدأ فلا يُعدَّل/);
  });
});

describe('الرحلة الخارجية المزدوجة', () => {
  it('نهاية الأولى بداية الثانية، وتتحدث تلقائياً', () => {
    const h = harness('p_lead');
    const t7 = h.db.trips.find((t) => t.id === 't7')!;
    expect(h.db.trips.find((t) => t.id === 't8')!.pair).toEqual({ tripId: 't7', part: 2 });
    const newEnd = addDays(t7.endDate, 1);
    h.repos.trips.update('t7', { endDate: newEnd });
    expect(h.db.trips.find((t) => t.id === 't8')!.startDate).toBe(newEnd);
  });
  it('إنشاء مزدوجة: رحلتان مستقلتان لمجموعتين', () => {
    const h = harness('p_lead');
    const s = addDays(todayISO(), 60);
    const [a, b] = h.repos.trips.createDouble({ title: 'جدة', type: 'external', startDate: s, splitDate: addDays(s, 2), endDate: addDays(s, 4), isPersonalPlanMeeting: false, groupIds: ['g3', 'g4'], deadlines: { document: s, schedule: s, budget: s } });
    const A = h.db.trips.find((t) => t.id === a)!;
    const B = h.db.trips.find((t) => t.id === b)!;
    expect(A.endDate).toBe(B.startDate);
    expect(A.executor).toEqual({ kind: 'group', groupId: 'g3' });
    expect(B.pair).toEqual({ tripId: a, part: 2 });
  });
});

describe('حالات الحضور', () => {
  it('الرحلة: مبكر/في الوقت/متأخر/غائب، ولقاءاتها حاضر/غائب فقط', () => {
    const h = harness('u8'); // مسؤول تحضير t4
    h.repos.trips.setAttendance('trip', 't4', 'u20', 'late');
    expect(h.db.attendance.find((a) => a.eventId === 't4' && a.personId === 'u20' && a.eventKind === 'trip')).toMatchObject({ status: 'late', present: true });
    expect(() => h.repos.trips.setAttendance('trip_session', 't4', 'u20', 'late', 'x')).toThrow(/حاضر أو غائب/);
  });
  it('قيمة المتأخر من الإعدادات: يكسب أقل من الحاضر في الوقت', () => {
    const h = harness('p_lead');
    const a = h.db.attendance.filter((x) => x.eventKind === 'trip' && x.eventId === 't3');
    a.forEach((x) => Object.assign(x, { status: 'on_time', present: true }));
    const before = computeScores(h.db).persons.find((p) => p.personId === 'u1')!.individual.find((i) => i.key === 'attendance')!.points;
    a.filter((x) => x.personId === 'u1').forEach((x) => (x.status = 'late'));
    const after = computeScores(h.db).persons.find((p) => p.personId === 'u1')!.individual.find((i) => i.key === 'attendance')!.points;
    expect(after).toBeLessThan(before);
  });
});

describe('محرك النقاط', () => {
  it('التقديم المتكرر: المتوسط لا المجموع، مع تميّز عن كل مرة بعد الأولى، ويظهر بعد نهاية البرنامج', () => {
    const h = harness('p_lead');
    const pres = (pid: string) => computeScores(h.db).persons.find((p) => p.personId === pid)!.individual.find((i) => i.key === 'presenting')!;
    expect(pres('u2').points).toBe(0); // قبل نهاية البرنامج
    h.db.settings.presentingRevealAfterEnd = false;
    const crit = h.db.settings.presentationCriteria.map((c) => c.key);
    const full = Object.fromEntries(crit.map((c) => [c, 5]));
    const half = Object.fromEntries(crit.map((c) => [c, 2.5]));
    const fms = h.db.focusMeetings.filter((f) => f.groupId === 'g1').slice(0, 2);
    h.db.focusMeetings.forEach((f) => { delete f.presenterEvaluations.u2; f.presenterIds = f.presenterIds.filter((x) => x !== 'u2'); });
    fms[0].presenterIds.push('u2'); fms[0].presenterEvaluations.u2 = full;
    fms[1].presenterIds.push('u2'); fms[1].presenterEvaluations.u2 = half;
    expect(pres('u2').ratio).toBe(0.75); // (1 + 0.5) / 2
    expect(pres('u2').extra).toBe(h.db.settings.presentingExtraBonus); // تميّز مرة بنقاط ثابتة
  });
  it('تقييم القائد العام مرة واحدة ويدخل في الفردي', () => {
    const h = harness('p_lead');
    const items = h.db.settings.leaderEvalItems;
    const scores = Object.fromEntries(items.map((i) => [i.key, i.max]));
    h.repos.leaderEval.save('u2', scores);
    expect(() => h.repos.leaderEval.save('u2', scores)).toThrow(/مرة واحدة/);
    expect(computeScores(h.db).persons.find((p) => p.personId === 'u2')!.individual.find((i) => i.key === 'leader_eval')!.ratio).toBe(1);
    h.as('s1');
    expect(() => h.repos.leaderEval.save('u3', scores)).toThrow(/للقائد العام/);
  });
  it('الجماعي: متوسط تقييم فريق العمل وبنود المالية (لمسؤولها وحده)', () => {
    const h = harness('s5');
    const g = () => computeScores(h.db).groups.find((x) => x.groupId === 'g1')!.internal.trips.find((t) => t.tripId === 't3')!.items;
    expect(g().find((i) => i.key === 'staff_rating')!.detail).toMatch(/متوسط/);
    h.repos.trips.rateTrip('t3', 10);
    expect(() => h.repos.trips.rateTrip('t3', 9)).toThrow(/من قبل/);
    h.as('s1');
    expect(() => h.repos.trips.rateTripFinance('t3', 'rationing', 5)).toThrow();
  });
  it('الحضور لا يؤثر على الجماعي', () => {
    const h = harness('p_lead');
    const before = computeScores(h.db).groups.map((g) => g.total);
    h.db.attendance.filter((a) => a.eventKind === 'trip').forEach((a) => Object.assign(a, { status: 'absent', present: false }));
    expect(computeScores(h.db).groups.map((g) => g.total)).toEqual(before);
  });
});

describe('الافتتاحي والختامي', () => {
  it('واحد لكل منهما، والرجعي تاريخه مضى', () => {
    const h = harness('p_lead');
    expect(() => h.repos.events.create({ kind: 'opening', title: 'افتتاحي آخر', date: todayISO(), retroactive: false })).toThrow(/واحد/);
    h.db.events = h.db.events.filter((e) => e.kind !== 'opening');
    expect(() => h.repos.events.create({ kind: 'opening', title: 'افتتاحي', date: addDays(todayISO(), 3), retroactive: true })).toThrow(/مضى/);
    h.repos.events.create({ kind: 'opening', title: 'افتتاحي', date: addDays(todayISO(), -30), retroactive: true, attendees: 20 });
    expect(h.db.events.find((e) => e.kind === 'opening')!.status).toBe('done');
  });
});
