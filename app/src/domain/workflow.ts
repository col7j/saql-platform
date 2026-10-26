// منطق المسارات: دورة الاعتماد، شروط النشر، حالة الرحلة، العهدة، المهام.
import { addDays, dateTime, diffDays, minutesOf, now, nowISO, todayISO } from './dates';
import { groupOf, isMaterialRevealed, tripTeamIds } from './permissions';
import { isBudgetApproved, ownerTitle, requestFor } from './finance';
import type {
  Approval, DB, DocKind, DocStatus, FocusMeeting, ID, PersonalPlan, ScheduleItem, Settings, Task, Trip, TripDoc,
} from './types';

// ───────────── دورة الاعتماد (قسم 6.4) ─────────────
export type DocAction =
  | { type: 'submit' }
  | { type: 'facilitator_approve' }
  | { type: 'facilitator_reject'; reason: string }
  | { type: 'leader_approve' }
  | { type: 'leader_reject'; reason: string }
  | { type: 'leader_edit_approve'; reason: string };

export function applyDocAction(doc: TripDoc, action: DocAction, byId: ID, isStaffTrip: boolean): TripDoc {
  const at = nowISO();
  const hist = (role: Approval['role'], decision: Approval['decision'], reason?: string): Approval => ({
    id: `ap_${Math.random().toString(36).slice(2, 9)}`, byId, role, decision, reason, at, version: doc.version,
  });
  switch (action.type) {
    case 'submit': {
      if (!['draft', 'returned_by_facilitator', 'returned_by_leader'].includes(doc.status)) throw new Error('لا يمكن الرفع في هذه الحالة');
      const wasReturned = doc.status !== 'draft';
      return { ...doc, status: 'submitted', submittedAt: doc.submittedAt ?? at, version: wasReturned ? doc.version + 1 : doc.version };
    }
    case 'facilitator_approve':
      if (doc.status !== 'submitted' || isStaffTrip) throw new Error('ليست بانتظار الميسّر');
      return { ...doc, status: 'facilitator_approved', history: [...doc.history, hist('facilitator', 'approve')] };
    case 'facilitator_reject':
      if (doc.status !== 'submitted') throw new Error('ليست بانتظار الميسّر');
      if (!action.reason.trim()) throw new Error('سبب الرفض إلزامي');
      // يرجع للفريق نموذجاً قابلاً للتعديل
      return { ...doc, status: 'returned_by_facilitator', history: [...doc.history, hist('facilitator', 'reject', action.reason)] };
    case 'leader_approve':
    case 'leader_edit_approve': {
      const ready = isStaffTrip ? doc.status === 'submitted' || doc.status === 'facilitator_approved' : doc.status === 'facilitator_approved';
      if (!ready) throw new Error('ليست بانتظار القائد العام');
      const decision = action.type === 'leader_edit_approve' ? 'edit' : 'approve';
      const reason = action.type === 'leader_edit_approve' ? action.reason : undefined;
      return { ...doc, status: 'approved', approvedAt: at, history: [...doc.history, hist('leader', decision, reason)] };
    }
    case 'leader_reject': {
      if (!action.reason.trim()) throw new Error('سبب الرفض إلزامي');
      // يرجع لقائد المجموعة مباشرة (وليس للميسّر)
      return { ...doc, status: 'returned_by_leader', history: [...doc.history, hist('leader', 'reject', action.reason)] };
    }
  }
}

export function docFor(db: DB, tripId: ID, kind: DocKind): TripDoc | undefined {
  return db.docs.find((d) => d.tripId === tripId && d.kind === kind);
}
export function isApproved(db: DB, tripId: ID, kind: DocKind): boolean {
  return docFor(db, tripId, kind)?.status === 'approved';
}

/** هل رُفعت الوثيقة قبل موعدها النهائي؟ (null = لم تُرفع بعد) */
export function docOnTime(doc: TripDoc | undefined, deadline: string): boolean | null {
  if (!doc?.submittedAt) return null;
  return doc.submittedAt.slice(0, 10) <= deadline;
}

/** مراحل الدورة للعرض المرئي */
export function approvalSteps(status: DocStatus, isStaffTrip: boolean) {
  const order: DocStatus[] = isStaffTrip ? ['draft', 'submitted', 'approved'] : ['draft', 'submitted', 'facilitator_approved', 'approved'];
  const labels = isStaffTrip ? ['تعبئة الفريق', 'مراجعة القائد العام', 'معتمدة'] : ['تعبئة الفريق', 'مراجعة الميسّر', 'قرار القائد العام', 'معتمدة'];
  const map: Record<DocStatus, number> = {
    draft: 0, returned_by_facilitator: 0, returned_by_leader: 0, submitted: 1, facilitator_approved: isStaffTrip ? 1 : 2, approved: order.length - 1,
  };
  const current = map[status];
  return labels.map((label, i) => ({ label, state: i < current || status === 'approved' ? 'done' : i === current ? 'current' : 'todo' as 'done' | 'current' | 'todo' }));
}

// ───────────── الجدول ─────────────
export function planA(trip: Trip) {
  return trip.schedule.plans[0];
}
export function hasSchedule(trip: Trip): boolean {
  return (planA(trip)?.items.length ?? 0) > 0;
}
export function sortItems(items: ScheduleItem[]): ScheduleItem[] {
  return [...items].sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
}
export function itemStart(i: ScheduleItem) {
  return dateTime(i.date, i.start);
}
export function itemEnd(i: ScheduleItem) {
  return dateTime(i.date, i.end);
}
export function tripStartDT(trip: Trip): Date {
  const first = sortItems(planA(trip)?.items ?? [])[0];
  return first ? itemStart(first) : dateTime(trip.startDate, '08:00');
}
export function tripEndDT(trip: Trip): Date {
  const items = sortItems(planA(trip)?.items ?? []);
  const last = items[items.length - 1];
  return last ? itemEnd(last) : dateTime(trip.endDate, '23:00');
}
export function tripHasStarted(trip: Trip) {
  return now() >= tripStartDT(trip);
}
export function tripHasEnded(trip: Trip) {
  return now() > tripEndDT(trip);
}

/** ما يراه المشارك من الجدول (قسم 6.6) */
export function participantScheduleView(trip: Trip, settings: Settings): { visible: boolean; items: ScheduleItem[]; mode: 'full' | 'next24' | 'hidden'; reason?: string } {
  const items = sortItems(planA(trip)?.items ?? []);
  if (!trip.published) return { visible: false, items: [], mode: 'hidden', reason: 'لم تُنشر الرحلة بعد' };
  if (trip.scheduleVisibility === 'hidden') {
    const hrs = settings.scheduleRevealHours;
    return { visible: false, items: [], mode: 'hidden', reason: `يعرض قائد الفريق الجدول قبل الرحلة بـ ${hrs} ساعة` };
  }
  // الرحلات الداخلية: العرض دائماً كامل
  if (trip.type === 'internal' || trip.scheduleVisibility === 'full') return { visible: true, items, mode: 'full' };
  const from = now();
  const to = new Date(from.getTime() + 24 * 3600 * 1000);
  return { visible: true, items: items.filter((i) => itemEnd(i) >= from && itemStart(i) <= to), mode: 'next24' };
}

/** نسبة كل تصنيف من وقت الرحلة */
export function categoryBreakdown(items: { categoryId?: ID; start?: string; end?: string }[]) {
  const totals: Record<string, number> = {};
  let sum = 0;
  for (const i of items) {
    if (!i.start || !i.end || !i.categoryId) continue;
    const m = Math.max(0, minutesOf(i.end) - minutesOf(i.start));
    totals[i.categoryId] = (totals[i.categoryId] ?? 0) + m;
    sum += m;
  }
  return { totals, sum };
}

/** الجدول الفعلي: ما ثبّته المتابع لكل بند */
export function actualItems(db: DB, trip: Trip) {
  const A = sortItems(trip.schedule.plans[0]?.items ?? []);
  const B = trip.schedule.plans[1]?.items ?? [];
  const entries = db.actualSchedule.filter((e) => e.tripId === trip.id);
  return A.map((item, idx) => {
    const e = entries.find((x) => x.refItemId === item.id);
    let actual: { start?: string; end?: string; categoryId?: ID; detail: string } | undefined;
    if (e) {
      if (e.followed === 'A') actual = { start: item.start, end: item.end, categoryId: item.categoryId, detail: item.detail };
      else if (e.followed === 'B') {
        const b = B[idx] ?? B.find((x) => x.start === item.start);
        actual = { start: b?.start ?? item.start, end: b?.end ?? item.end, categoryId: b?.categoryId ?? item.categoryId, detail: b?.detail ?? 'الخطة ب' };
      } else actual = { start: e.actualStart ?? item.start, end: e.actualEnd ?? item.end, categoryId: e.categoryId ?? item.categoryId, detail: e.note ?? '' };
    }
    return { item, entry: e, actual };
  });
}

export function scheduleAdherence(db: DB, trip: Trip): number | null {
  const rows = actualItems(db, trip).filter((r) => r.entry);
  if (!rows.length) return null;
  return rows.filter((r) => r.entry!.followed !== 'none').length / rows.length;
}

// ───────────── حالة الرحلة ─────────────
export type TripStage =
  | 'document' | 'schedule' | 'budget' | 'trip_data' | 'ready' | 'published' | 'live' | 'closing' | 'closed';

export const tripStageLabel: Record<TripStage, string> = {
  document: 'وثيقة الرحلة',
  schedule: 'الجدول الزمني',
  budget: 'بانتظار اعتماد الميزانية',
  trip_data: 'استكمال بيانات الرحلة',
  ready: 'جاهزة للنشر',
  published: 'منشورة',
  live: 'يوم التنفيذ',
  closing: 'قيد الإغلاق',
  closed: 'مغلقة',
};
export const tripStageOrder: TripStage[] = ['document', 'schedule', 'budget', 'trip_data', 'ready', 'published', 'live', 'closing', 'closed'];

export function tripStage(db: DB, trip: Trip): TripStage {
  if (trip.published) {
    if (tripHasEnded(trip)) return isTripClosed(db, trip) ? 'closed' : 'closing';
    if (tripHasStarted(trip)) return 'live';
    return 'published';
  }
  if (!isApproved(db, trip.id, 'document')) return 'document';
  if (!isApproved(db, trip.id, 'schedule')) return 'schedule';
  if (!isBudgetApproved(db, 'trip', trip.id)) return 'budget';
  if (!tripDataComplete(trip)) return 'trip_data';
  return 'ready';
}

export function tripProgress(db: DB, trip: Trip): number {
  const idx = tripStageOrder.indexOf(tripStage(db, trip));
  return Math.round((idx / (tripStageOrder.length - 1)) * 100);
}

export function tripDataComplete(trip: Trip): boolean {
  return hasSchedule(trip) && trip.guests.length > 0 && trip.guests.every((g) => g.confirmed);
}

export function publishChecks(db: DB, trip: Trip) {
  return [
    { label: 'اعتماد وثيقة الرحلة', ok: isApproved(db, trip.id, 'document') },
    { label: 'اعتماد الجدول الزمني', ok: isApproved(db, trip.id, 'schedule') },
    { label: 'اعتماد الميزانية', ok: isBudgetApproved(db, 'trip', trip.id) },
    { label: 'اكتمال الجدول في بيانات الرحلة', ok: hasSchedule(trip) },
    { label: 'إضافة الضيوف وتأكيدهم', ok: trip.guests.length > 0 && trip.guests.every((g) => g.confirmed) },
  ];
}
export function canPublish(db: DB, trip: Trip) {
  return !trip.published && publishChecks(db, trip).every((c) => c.ok);
}

export function closureChecks(db: DB, trip: Trip) {
  const custody = db.custodies.find((c) => c.ownerKind === 'trip' && c.ownerId === trip.id);
  const post = db.surveys.find((s) => s.context.kind === 'trip' && s.context.id === trip.id && s.phase === 'post');
  return [
    { key: 'survey', label: 'استبيان الرحلة للمشاركين', ok: !!post && post.responses.length > 0 },
    { key: 'team_eval', label: 'نموذج تقييم فريق العمل', ok: !!trip.closure.teamEvalForm },
    { key: 'experience', label: 'نموذج إغلاق التجربة', ok: !!trip.closure.experienceForm },
    { key: 'finance', label: 'الإغلاق المالي (العهدة)', ok: custody?.status === 'closed' },
    { key: 'report', label: 'اعتماد التقرير الختامي', ok: isApproved(db, trip.id, 'final_report') },
    { key: 'evaluation', label: `تقييم فريق العمل (${staffRatingCount(db, trip).rated} من ${staffRatingCount(db, trip).needed} على الأقل)`, ok: staffRatingCount(db, trip).rated >= staffRatingCount(db, trip).needed },
  ];
}
/** كل فريق العمل يقيّم الرحلة، ويكفي للإغلاق نصاب يضبطه القائد العام */
export function staffRatingCount(db: DB, trip: Trip) {
  const staff = db.persons.filter((p) => p.kind === 'staff').length;
  return { rated: Object.keys(trip.evaluation.staffRatings).length, needed: Math.max(1, Math.ceil(staff * db.settings.tripRatingQuorum)), staff };
}
export function isTripClosed(db: DB, trip: Trip) {
  return closureChecks(db, trip).every((c) => c.ok);
}

/** المواعيد النهائية القادمة والمتأخرة */
export function tripDeadlines(db: DB, trip: Trip) {
  const list: { kind: DocKind | 'budget'; label: string; date: string; done: boolean; late: boolean; onTime: boolean | null }[] = [];
  const today = todayISO();
  const mk = (kind: DocKind | 'budget', label: string, date: string, submittedAt?: string) => {
    const onTime = submittedAt ? submittedAt.slice(0, 10) <= date : null;
    list.push({ kind, label, date, done: !!submittedAt, late: !submittedAt && today > date, onTime });
  };
  mk('document', 'رفع وثيقة الرحلة', trip.deadlines.document, docFor(db, trip.id, 'document')?.submittedAt);
  mk('schedule', 'رفع الجدول الزمني', trip.deadlines.schedule, docFor(db, trip.id, 'schedule')?.submittedAt);
  mk('budget', 'رفع الميزانية', trip.deadlines.budget, requestFor(db, 'trip', trip.id)?.submittedAt);
  return list;
}

export function budgetTotal(lines: { qty: number; price: number }[]) {
  return lines.reduce((s, l) => s + l.qty * l.price, 0);
}


// ───────────── المهام ─────────────
export function isTaskLate(t: Task): boolean {
  return t.status !== 'done' && t.dueDate < todayISO();
}
export function taskDisplayStatus(t: Task): Task['status'] | 'late' {
  return isTaskLate(t) ? 'late' : t.status;
}
export function canCloseTask(t: Task, proof?: string): boolean {
  if (t.proofType === 'none') return true;
  return !!(proof ?? t.proof)?.trim();
}

/** إنشاء المهام التلقائية من القالب عند إنشاء رحلة (قسم 12.3) */
export function tasksFromTemplates(db: DB, trip: Trip, byId: ID): Task[] {
  return db.taskTemplates
    .filter((tpl) => tpl.appliesTo === 'all' || tpl.appliesTo === trip.type)
    .map((tpl) => {
      const lead = db.memberships.find((m) => m.committeeId === tpl.committeeId && m.role === 'leader')
        ?? db.memberships.find((m) => m.committeeId === tpl.committeeId);
      return {
        id: `tk_${Math.random().toString(36).slice(2, 9)}`,
        title: `${tpl.title} — ${trip.title}`,
        scope: 'committee' as const,
        committeeId: tpl.committeeId,
        tripId: trip.id,
        assigneeId: lead?.personId ?? byId,
        createdBy: byId,
        dueDate: addDays(trip.endDate, tpl.dueOffsetDays),
        status: 'new' as const,
        proofType: tpl.proofType,
        tag: tpl.tag,
        mandatory: true,
        autoFromTemplateId: tpl.id,
        createdAt: nowISO(),
      };
    });
}

/** قيمة مؤشر حي: عدد المهام المنتهية بالوسم */
export function kpiValue(db: DB, committeeId: ID, tag: string): number {
  return db.tasks.filter((t) => t.committeeId === committeeId && t.tag === tag && t.status === 'done').length;
}

// ───────────── الخطة الشخصية ─────────────
export function personalPlanTrip(db: DB): Trip | undefined {
  return db.trips.find((t) => t.isPersonalPlanMeeting);
}
/** القفل: يُفتح بعد انعقاد "لقاء الخطة الشخصية" لمن حضره، أو بفتح يدوي من الإدارة */
/** موعد فتح الخطة الشخصية: بند الجدول أو التوقيت الذي يحدده مخطط رحلة الخطة الشخصية (وإلا بداية الرحلة) */
export function planUnlockAt(db: DB): Date | undefined {
  const trip = personalPlanTrip(db);
  if (!trip) return undefined;
  const u = trip.planUnlock;
  if (u?.mode === 'time') return new Date(u.at);
  if (u?.mode === 'item') {
    const item = trip.schedule.plans[0]?.items.find((i) => i.id === u.itemId);
    if (item) return itemStart(item);
  }
  return tripStartDT(trip);
}
export function isPlanUnlocked(db: DB, participantId: ID): boolean {
  const plan = db.personalPlans.find((p) => p.participantId === participantId);
  if (plan?.manuallyUnlocked) return true;
  const trip = personalPlanTrip(db);
  const at = planUnlockAt(db);
  return !!trip && trip.published && !!at && now() >= at;
}

export function planProgress(plan?: PersonalPlan) {
  const steps = plan?.aspects.flatMap((a) => a.steps) ?? [];
  const done = steps.filter((s) => s.status === 'done').length;
  const started = steps.filter((s) => s.status === 'started' || s.status === 'challenged').length;
  return { total: steps.length, done, started, ratio: steps.length ? (done + started * 0.5) / steps.length : 0 };
}
/** خطوات حان تاريخها وتحتاج متابعة ذكية */
export function dueSteps(plan?: PersonalPlan) {
  const today = todayISO();
  const out: { aspectKey: string; stepId: ID; title: string; startDate: string }[] = [];
  plan?.aspects.forEach((a) =>
    a.steps.forEach((s) => {
      if (s.startDate <= today && s.status === 'pending') out.push({ aspectKey: a.key, stepId: s.id, title: s.title, startDate: s.startDate });
    }),
  );
  return out;
}

// ───────────── لقاءات التركيز ─────────────
export function focusDone(fm: FocusMeeting) {
  return fm.status === 'held' || fm.status === 'closed';
}
export function focusIsPast(fm: FocusMeeting) {
  if (!fm.date) return false;
  return dateTime(fm.date, fm.end ?? '23:59') < now();
}
export function facilitatorTargetProgress(db: DB, facilitatorId: ID) {
  const groups = db.groups.filter((g) => g.facilitatorId === facilitatorId);
  const ids = groups.map((g) => g.id);
  const focus = db.focusMeetings.filter((f) => ids.includes(f.groupId));
  const members = groups.flatMap((g) => g.memberIds);
  const indiv = db.individualMeetings.filter((m) => m.facilitatorId === facilitatorId && m.status === 'done');
  const target = db.settings.targets;
  const perMember = members.map((m) => indiv.filter((x) => x.participantId === m).length);
  return {
    focusDone: focus.filter(focusDone).length,
    focusTotal: focus.length,
    focusTarget: target.focusMeetingsPerGroup * groups.length,
    umrahDone: focus.some((f) => f.isUmrah && focusDone(f)),
    individualDone: indiv.length,
    individualTarget: target.individualMeetingsPerParticipant * members.length,
    membersReachedTarget: perMember.filter((n) => n >= target.individualMeetingsPerParticipant).length,
    members: members.length,
  };
}

// ───────────── المكتبة ─────────────
export function materialState(db: DB, personId: ID, materialId: ID): 'viewed' | 'skipped' | 'new' {
  const v = db.materialViews.find((x) => x.personId === personId && x.materialId === materialId);
  return v?.status ?? 'new';
}
export { isMaterialRevealed };

// ───────────── الاستبيانات ─────────────
export function surveysForPerson(db: DB, personId: ID) {
  const g = groupOf(db, personId);
  return db.surveys.filter((s) => {
    if (new Date(s.opensAt) > now()) return false;
    if (s.context.kind === 'program') return true;
    if (s.context.kind === 'focus') {
      const fm = db.focusMeetings.find((f) => f.id === s.context.id);
      return !!fm && fm.groupId === g?.id;
    }
    const trip = db.trips.find((t) => t.id === s.context.id);
    if (!trip) return false;
    // الرحلات عامة لكل المشاركين، والفريق المنفذ لا يعبّئ استبيان المشاركين
    if (s.phase === 'post' && tripTeamIds(db, trip).includes(personId) && trip.executor.kind === 'staff') return false;
    return trip.published || trip.isPersonalPlanMeeting;
  });
}

export function deadlineCountdown(date: string) {
  return diffDays(date, todayISO());
}
