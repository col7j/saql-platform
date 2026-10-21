// "المطلوب مني": قائمة الإجراءات المعلّقة لكل شخص بحسب صفاته
import { addDays, todayISO } from './dates';
import { docKindLabel } from './labels';
import { getCapabilities, tripFacilitatorId, tripTeamLeaderId, effectiveTrackerId } from './permissions';
import { canPublish, dueSteps, isPlanUnlocked, isTaskLate, surveysForPerson, tripStage, materialState, focusIsPast } from './workflow';
import type { DB, ID } from './types';

export interface PendingAction {
  id: string;
  title: string;
  link: string;
  tone: 'red' | 'orange' | 'blue';
  group: string;
}

export function pendingActions(db: DB, personId: ID): PendingAction[] {
  const c = getCapabilities(db, personId);
  const out: PendingAction[] = [];
  const add = (id: string, title: string, link: string, tone: PendingAction['tone'], group: string) => out.push({ id, title, link, tone, group });
  const today = todayISO();

  // ── المشارك ──
  if (c.isParticipant) {
    surveysForPerson(db, personId)
      .filter((s) => !s.responses.some((r) => r.personId === personId))
      .forEach((s) => add(`sv_${s.id}`, `${s.mandatory ? 'استبيان إلزامي' : 'استبيان اختياري'}: ${s.title}`, '/app/surveys', s.mandatory ? 'orange' : 'blue', 'استبيانات'));
    db.materials
      .filter((m) => m.origin === 'pre_trip' && m.mandatory && materialState(db, personId, m.id) === 'new')
      .forEach((m) => add(`mt_${m.id}`, `مادة قبلية إلزامية: ${m.title}`, '/app/library', 'orange', 'المكتبة'));
    if (isPlanUnlocked(db, personId))
      dueSteps(db.personalPlans.find((p) => p.participantId === personId)).forEach((s) => add(`st_${s.stepId}`, `وش صار في خطوة "${s.title}"؟`, '/app/plan', 'orange', 'الخطة الشخصية'));
    db.slots.filter((s) => s.invite === personId && !s.bookedBy && s.date >= today).forEach((s) => add(`sl_${s.id}`, 'طلب منك الميسّر حجز لقاء فردي', '/app/individual', 'blue', 'اللقاءات الفردية'));
    c.presenterIn.filter((f) => f.status === 'draft' || f.status === 'published').forEach((f) => add(`pr_${f.id}`, `أنت مقدّم في "${f.title}"`, `/app/focus/${f.id}`, 'blue', 'لقاءات التركيز'));
  }

  // ── المهام ──
  db.tasks.filter((t) => t.assigneeId === personId && t.status !== 'done').forEach((t) =>
    add(`tk_${t.id}`, `${isTaskLate(t) ? 'مهمة متأخرة' : 'مهمة'}: ${t.title}`, t.tripId && t.scope === 'trip_team' ? `/app/trips/${t.tripId}?tab=prep` : '/app/tasks', isTaskLate(t) ? 'red' : 'blue', 'المهام'),
  );

  // ── قائد فريق الرحلة ──
  db.trips.filter((t) => tripTeamLeaderId(db, t) === personId).forEach((t) => {
    db.docs.filter((d) => d.tripId === t.id).forEach((d) => {
      const deadline = d.kind === 'initial' ? t.deadlines.initial : t.deadlines.detailed;
      if (d.status === 'returned_by_facilitator' || d.status === 'returned_by_leader') add(`dr_${d.id}`, `أُعيدت ${docKindLabel[d.kind]} (${t.title}) للتعديل`, `/app/trips/${t.id}`, 'red', 'إعداد الرحلات');
      else if (d.status === 'draft' && d.kind !== 'final_report' && deadline <= addDays(today, 7)) add(`dd_${d.id}`, `${deadline < today ? 'فات موعد' : 'اقترب موعد'} ${docKindLabel[d.kind]}: ${t.title}`, `/app/trips/${t.id}`, deadline < today ? 'red' : 'orange', 'إعداد الرحلات');
    });
    if (canPublish(db, t)) add(`pub_${t.id}`, `${t.title} جاهزة للنشر`, `/app/trips/${t.id}`, 'blue', 'إعداد الرحلات');
    const st = tripStage(db, t);
    if (st === 'published' && t.scheduleVisibility === 'hidden' && t.startDate <= addDays(today, 1)) add(`vis_${t.id}`, `اعرض جدول ${t.title} للمشاركين`, `/app/trips/${t.id}?tab=data`, 'orange', 'إعداد الرحلات');
  });
  db.custodies.filter((x) => x.recipientId === personId).forEach((x) => {
    if (x.installments.some((i) => i.status === 'awaiting_iban')) add(`ib_${x.id}`, 'ارفع بيانات الآيبان لاستلام العهدة', '/app/custody', 'orange', 'العهدة');
    if (x.installments.some((i) => i.status === 'awaiting_confirm')) add(`cf_${x.id}`, 'أكّد استلام دفعة العهدة', '/app/custody', 'orange', 'العهدة');
    db.invoices.filter((i) => i.custodyId === x.id && i.status === 'rejected').forEach((i) => add(`ir_${i.id}`, `فاتورة مرفوضة: ${i.statement}`, '/app/custody', 'red', 'العهدة'));
  });
  // تحضير لقاءات التركيز
  db.focusMeetings.filter((f) => f.status === 'published' && f.date && f.date <= today).forEach((f) => {
    const g = db.groups.find((x) => x.id === f.groupId);
    if (f.attendanceTakerId === personId || (!f.attendanceTakerId && g?.leaderId === personId)) add(`fa_${f.id}`, `حضّر الحضور في "${f.title}"`, `/app/focus/${f.id}`, 'orange', 'لقاءات التركيز');
  });

  // ── الميسّر ──
  db.trips.filter((t) => t.executor.kind === 'group' && tripFacilitatorId(db, t) === personId).forEach((t) =>
    db.docs.filter((d) => d.tripId === t.id && d.status === 'submitted').forEach((d) => add(`rv_${d.id}`, `راجع ${docKindLabel[d.kind]}: ${t.title}`, `/app/trips/${t.id}`, 'orange', 'مراجعات')),
  );
  c.facilitatorOf.forEach((g) => {
    db.focusMeetings.filter((f) => f.groupId === g.id && f.status === 'held').forEach((f) => add(`ev_${f.id}`, `قيّم المقدّمين وأغلق "${f.title}"`, `/app/focus/${f.id}`, 'orange', 'لقاءات التركيز'));
    db.focusMeetings.filter((f) => f.groupId === g.id && f.status === 'published' && focusIsPast(f)).forEach((f) => add(`fh_${f.id}`, `انتهى وقت "${f.title}": بانتظار التحضير`, `/app/focus/${f.id}`, 'blue', 'لقاءات التركيز'));
    db.focusMeetings.filter((f) => f.groupId === g.id && f.budget.status === 'revise').forEach((f) => add(`fb_${f.id}`, `المالية طلبت تعديل ميزانية "${f.title}"`, `/app/focus/${f.id}`, 'red', 'لقاءات التركيز'));
  });
  db.individualMeetings.filter((m) => m.facilitatorId === personId && m.status === 'requested').forEach((m) => add(`ir_${m.id}`, `طلب لقاء فردي من ${db.persons.find((p) => p.id === m.participantId)?.name}`, '/app/individual', 'blue', 'اللقاءات الفردية'));
  db.individualMeetings.filter((m) => m.facilitatorId === personId && m.status === 'booked' && m.date < today).forEach((m) => add(`in_${m.id}`, `ارفع ملاحظات اللقاء الفردي مع ${db.persons.find((p) => p.id === m.participantId)?.name}`, '/app/individual', 'orange', 'اللقاءات الفردية'));

  // ── القائد العام ──
  if (c.isLeader) {
    db.docs.forEach((d) => {
      const t = db.trips.find((x) => x.id === d.tripId)!;
      const waiting = t.executor.kind === 'staff' ? d.status === 'submitted' : d.status === 'facilitator_approved';
      if (waiting) add(`ld_${d.id}`, `بانتظار اعتمادك: ${docKindLabel[d.kind]} — ${t.title}`, `/app/trips/${t.id}`, 'orange', 'الاعتمادات');
    });
    db.memberRequests.filter((r) => r.status === 'pending').forEach((r) => add(`mr_${r.id}`, `طلب إضافة عضو: ${db.persons.find((p) => p.id === r.personId)?.name}`, `/app/committees/${r.committeeId}`, 'blue', 'اللجان'));
    db.materials.filter((m) => m.pointsStatus === 'pending').forEach((m) => add(`mp_${m.id}`, `طلب نقاط على مادة: ${m.title}`, '/app/library', 'blue', 'المكتبة'));
    db.trips.filter((t) => t.trackerSubstitute?.status === 'pending').forEach((t) => add(`ts_${t.id}`, `طلب متابع بديل: ${t.title}`, `/app/trips/${t.id}`, 'orange', 'الرحلات'));
    db.custodies.filter((x) => x.overspend && !x.overspend.adminApproved).forEach((x) => add(`os_${x.id}`, 'طلب موافقة على مصروف زائد', '/app/finance', 'orange', 'المالية'));
    db.trips.filter((t) => tripStage(db, t) === 'closing' && t.evaluation.leaderScore == null).forEach((t) => add(`le_${t.id}`, `قيّم ${t.title}`, `/app/trips/${t.id}?tab=closure`, 'blue', 'الرحلات'));
  }

  // ── المالية ──
  if (c.isFinance) {
    db.trips.filter((t) => db.docs.some((d) => d.tripId === t.id && d.kind === 'budget' && d.status === 'approved') && !db.custodies.some((x) => x.ownerKind === 'trip' && x.ownerId === t.id))
      .forEach((t) => add(`cu_${t.id}`, `اصرف عهدة: ${t.title}`, '/app/finance', 'orange', 'المالية'));
    const pendingInv = db.invoices.filter((i) => i.status === 'pending').length;
    if (pendingInv) add('inv', `${pendingInv} فواتير بانتظار المراجعة`, '/app/finance?tab=invoices', 'orange', 'المالية');
    db.custodies.forEach((x) => x.installments.filter((i) => i.status === 'awaiting_transfer').forEach((i) => add(`tr_${i.id}`, `حوّل دفعة ${i.amount} ر.س`, '/app/finance?tab=custody', 'orange', 'المالية')));
    db.focusMeetings.filter((f) => f.budget.status === 'pending').forEach((f) => add(`fbr_${f.id}`, `طلب ميزانية: ${f.title}`, '/app/finance?tab=focus', 'blue', 'المالية'));
  }

  // ── متابع الرحلات ──
  db.trips.filter((t) => effectiveTrackerId(db, t) === personId).forEach((t) => {
    const st = tripStage(db, t);
    if (st === 'live') add(`tl_${t.id}`, `وثّق تنفيذ ${t.title} الآن`, `/app/tracker?trip=${t.id}`, 'orange', 'متابعة الرحلات');
    if (st === 'closing' && t.evaluation.trackerScore == null) add(`te_${t.id}`, `قيّم ${t.title}`, `/app/tracker?trip=${t.id}`, 'blue', 'متابعة الرحلات');
  });

  return out;
}
