// "المطلوب منك الآن": الإجراءات المعلّقة لكل شخص حسب صفاته، مرتبة بالأولوية، ولكل إجراء زر يبدأ بفعل
import { addDays, todayISO } from './dates';
import { SAR, docKindLabel } from './labels';
import { getCapabilities, tripFacilitatorId, tripTeamLeaderId, effectiveTrackerId } from './permissions';
import { canPublish, dueSteps, isPlanUnlocked, isTaskLate, surveysForPerson, tripStage, materialState, focusIsPast } from './workflow';
import {
  canDisburse, canFacilitatorDecide, canFinanceDecide, canLeaderDecide, hasFinancePerm, isFinanceOwner, ownerLink, ownerTitle, requestFor,
} from './finance';
import { custodyFigures } from './ledger';
import type { DB, ID } from './types';

export interface PendingAction {
  id: string;
  title: string;
  hint?: string;
  cta: string; // نص الزر ويبدأ بفعل
  link: string;
  tone: 'red' | 'orange' | 'blue';
  group: string;
}

const RANK = { red: 0, orange: 1, blue: 2 } as const;

export function pendingActions(db: DB, personId: ID): PendingAction[] {
  const c = getCapabilities(db, personId);
  const out: PendingAction[] = [];
  const add = (a: PendingAction) => out.push(a);
  const today = todayISO();

  // ── المالية ──
  if (isFinanceOwner(db, personId) && !db.programBudget.setupDone)
    add({ id: 'setup', title: 'أعدّ ميزانية البرنامج', hint: 'لا تُقبل طلبات الميزانية حتى تُحدَّد مبالغ المرصود', cta: 'ابدأ إعداد الميزانية', link: '/app/finance', tone: 'red', group: 'المالية' });
  db.budgetRequests.forEach((r) => {
    const t = ownerTitle(db, r.ownerKind, r.ownerId);
    if (canFinanceDecide(db, personId, r)) add({ id: `rf_${r.id}`, title: `طلب ميزانية: ${t}`, hint: `${SAR(r.amount)} ضمن المرصود (${SAR(r.allocated)})`, cta: 'راجع الطلب', link: `/app/finance?req=${r.id}`, tone: 'orange', group: 'المالية' });
    if (canLeaderDecide(db, personId, r)) add({ id: `rl_${r.id}`, title: r.amount > r.allocated ? `ميزانية تتجاوز المرصود: ${t}` : `ميزانية بانتظار اعتمادك: ${t}`, hint: `مطلوب ${SAR(r.amount)} والمرصود ${SAR(r.allocated)}`, cta: 'اتخذ القرار', link: `/app/finance?req=${r.id}`, tone: 'orange', group: 'الاعتمادات' });
    if (canDisburse(db, personId, r)) add({ id: `rd_${r.id}`, title: `اصرف عهدة: ${t}`, hint: `${SAR(r.amount)} معتمدة`, cta: 'اصرف العهدة', link: `/app/finance?req=${r.id}`, tone: 'orange', group: 'المالية' });
    if (r.requestedBy === personId && r.status === 'rejected') add({ id: `rr_${r.id}`, title: `أُعيد طلب ميزانية ${t}`, hint: r.history[r.history.length - 1]?.note, cta: 'عدّل وأعد الإرسال', link: ownerLink(r.ownerKind, r.ownerId), tone: 'red', group: 'طلباتي' });
    if (r.requestedBy === personId && r.status === 'needs_detail') add({ id: `rn_${r.id}`, title: `القائد العام يطلب موازنة تفصيلية: ${t}`, hint: r.history[r.history.length - 1]?.note, cta: 'عبّئ الموازنة التفصيلية', link: ownerLink(r.ownerKind, r.ownerId), tone: 'red', group: 'طلباتي' });
  });
  if (hasFinancePerm(db, personId, 'review_invoices')) {
    const n = db.spendForms.flatMap((f) => f.lines).filter((l) => l.status === 'pending').length;
    if (n) add({ id: 'inv', title: `${n} بنود صرف بانتظار المراجعة`, cta: 'راجع البنود', link: '/app/finance?tab=invoices', tone: 'orange', group: 'المالية' });
  }
  if (hasFinancePerm(db, personId, 'disburse'))
    db.custodies.filter((x) => x.status === 'active' && custodyFigures(db, x).toTransfer > 0).forEach((x) => add({ id: `tr_${x.id}`, title: `دفعة مؤجّلة ${custodyFigures(db, x).toTransfer} ر.س`, hint: ownerTitle(db, x.ownerKind, x.ownerId), cta: 'حوّل الدفعة', link: '/app/finance?tab=custody', tone: 'orange', group: 'المالية' }));
  if (hasFinancePerm(db, personId, 'close_custody'))
    db.custodies.filter((x) => x.status === 'closing').forEach((x) => add({ id: `cl_${x.id}`, title: `طلب إغلاق عهدة: ${ownerTitle(db, x.ownerKind, x.ownerId)}`, cta: 'راجع الإغلاق', link: '/app/finance?tab=custody', tone: 'blue', group: 'المالية' }));
  db.custodies.filter((x) => x.recipientId === personId && x.status !== 'closed').forEach((x) => {
    const t = ownerTitle(db, x.ownerKind, x.ownerId);
    const f = custodyFigures(db, x);
    f.lines.filter((l) => l.status === 'rejected').slice(0, 3).forEach((l) => add({ id: `ir_${l.id}`, title: `بند صرف مرفوض: ${l.item} (${l.amount} ر.س)`, hint: l.reviewNote, cta: 'افتح العهدة', link: '/app/requests', tone: 'red', group: 'العهدة' }));
    if (x.status === 'closing' && f.surplus > 0.009 && !x.surplusReturn) add({ id: `sr_${x.id}`, title: `حوّل فائض عهدة ${t} (${f.surplus} ر.س) وارفع الإيصال`, cta: 'ارفع الإيصال', link: '/app/requests', tone: 'orange', group: 'العهدة' });
  });
  db.budgetRequests.filter((r) => canFacilitatorDecide(db, personId, r)).forEach((r) => add({ id: `rfa_${r.id}`, title: `ميزانية رحلة بانتظار اعتمادك: ${ownerTitle(db, r.ownerKind, r.ownerId)}`, hint: SAR(r.amount), cta: 'راجع الميزانية', link: ownerLink(r.ownerKind, r.ownerId), tone: 'orange', group: 'الاعتمادات' }));
  if (c.isLeader) db.editRequests.filter((e) => e.status === 'pending').forEach((e) => add({ id: `er_${e.id}`, title: `طلب تعديل سجل مالي معتمد`, hint: e.summary, cta: 'وافق أو ارفض', link: '/app/finance?tab=edits', tone: 'orange', group: 'الاعتمادات' }));

  // ── المشارك ──
  if (c.isParticipant) {
    surveysForPerson(db, personId)
      .filter((s) => s.mandatory && !s.responses.some((r) => r.personId === personId))
      .forEach((s) => add({ id: `sv_${s.id}`, title: s.title, hint: 'استبيان إلزامي', cta: 'عبّئ الاستبيان', link: '/app/surveys', tone: 'orange', group: 'استبيانات' }));
    db.materials
      .filter((m) => m.origin === 'pre_trip' && m.mandatory && materialState(db, personId, m.id) === 'new')
      .forEach((m) => add({ id: `mt_${m.id}`, title: m.title, hint: 'مادة قبلية إلزامية', cta: 'شاهد المادة', link: '/app/library', tone: 'orange', group: 'المكتبة' }));
    if (isPlanUnlocked(db, personId))
      dueSteps(db.personalPlans.find((p) => p.participantId === personId)).forEach((s) => add({ id: `st_${s.stepId}`, title: `وش صار في خطوة "${s.title}"؟`, cta: 'سجّل المتابعة', link: '/app/plan', tone: 'orange', group: 'الخطة الشخصية' }));
    db.slots.filter((s) => s.invite === personId && !s.bookedBy && s.date >= today).forEach((s) => add({ id: `sl_${s.id}`, title: 'طلب منك الميسّر حجز لقاء فردي', cta: 'احجز موعداً', link: '/app/individual', tone: 'blue', group: 'اللقاءات الفردية' }));
    c.presenterIn.filter((f) => f.status === 'draft' || f.status === 'published').forEach((f) => add({ id: `pr_${f.id}`, title: `أنت مقدّم في "${f.title}"`, cta: 'جهّز تقديمك', link: `/app/focus/${f.id}`, tone: 'blue', group: 'لقاءات التركيز' }));
  }

  // ── المهام ──
  db.tasks.filter((t) => t.assigneeId === personId && t.status !== 'done').forEach((t) =>
    add({ id: `tk_${t.id}`, title: t.title, hint: isTaskLate(t) ? 'متأخرة' : undefined, cta: 'افتح المهمة', link: t.tripId && t.scope === 'trip_team' ? `/app/trips/${t.tripId}?tab=prep` : '/app/tasks', tone: isTaskLate(t) ? 'red' : 'blue', group: 'المهام' }),
  );

  // ── قائد فريق الرحلة ──
  db.trips.filter((t) => tripTeamLeaderId(db, t) === personId).forEach((t) => {
    db.docs.filter((d) => d.tripId === t.id).forEach((d) => {
      const deadline = d.kind === 'initial' ? t.deadlines.initial : t.deadlines.detailed;
      if (d.status === 'returned_by_facilitator' || d.status === 'returned_by_leader') add({ id: `dr_${d.id}`, title: `أُعيدت ${docKindLabel[d.kind]}: ${t.title}`, hint: d.history[d.history.length - 1]?.reason, cta: 'عدّل وأعد الرفع', link: `/app/trips/${t.id}?tab=docs`, tone: 'red', group: 'إعداد الرحلات' });
      else if (d.status === 'draft' && d.kind !== 'final_report' && deadline <= addDays(today, 7)) add({ id: `dd_${d.id}`, title: `${docKindLabel[d.kind]}: ${t.title}`, hint: deadline < today ? 'فات الموعد النهائي' : 'اقترب الموعد النهائي', cta: 'أكمل وارفع', link: `/app/trips/${t.id}?tab=docs`, tone: deadline < today ? 'red' : 'orange', group: 'إعداد الرحلات' });
    });
    if (db.docs.some((d) => d.tripId === t.id && d.kind === 'initial' && d.status === 'approved') && !requestFor(db, 'trip', t.id) && !t.published)
      add({ id: `bq_${t.id}`, title: `قدّم طلب ميزانية ${t.title}`, hint: 'الرحلات تُقدَّم بموازنة تفصيلية', cta: 'جهّز الموازنة', link: `/app/trips/${t.id}?tab=budget`, tone: 'blue', group: 'إعداد الرحلات' });
    if (canPublish(db, t)) add({ id: `pub_${t.id}`, title: `${t.title} جاهزة للنشر`, cta: 'انشر الرحلة', link: `/app/trips/${t.id}`, tone: 'orange', group: 'إعداد الرحلات' });
    if (tripStage(db, t) === 'published' && t.scheduleVisibility === 'hidden' && t.startDate <= addDays(today, 1)) add({ id: `vis_${t.id}`, title: `اعرض جدول ${t.title} للمشاركين`, cta: 'اعرض الجدول', link: `/app/trips/${t.id}?tab=data`, tone: 'orange', group: 'إعداد الرحلات' });
  });
  db.focusMeetings.filter((f) => f.status === 'published' && f.date && f.date <= today).forEach((f) => {
    const g = db.groups.find((x) => x.id === f.groupId);
    if (f.attendanceTakerId === personId || (!f.attendanceTakerId && g?.leaderId === personId)) add({ id: `fa_${f.id}`, title: `حضّر الحضور في "${f.title}"`, cta: 'حضّر الآن', link: `/app/focus/${f.id}`, tone: 'orange', group: 'لقاءات التركيز' });
  });

  // ── الميسّر ──
  db.trips.filter((t) => t.executor.kind === 'group' && tripFacilitatorId(db, t) === personId).forEach((t) =>
    db.docs.filter((d) => d.tripId === t.id && d.status === 'submitted').forEach((d) => add({ id: `rv_${d.id}`, title: `${docKindLabel[d.kind]}: ${t.title}`, hint: 'رفعها قائد المجموعة للمراجعة', cta: 'راجع الخطة', link: `/app/trips/${t.id}?tab=docs`, tone: 'orange', group: 'مراجعات' })),
  );
  c.facilitatorOf.forEach((g) => {
    db.focusMeetings.filter((f) => f.groupId === g.id && f.status === 'held').forEach((f) => add({ id: `ev_${f.id}`, title: `قيّم المقدّمين في "${f.title}"`, cta: 'قيّم وأغلق', link: `/app/focus/${f.id}`, tone: 'orange', group: 'لقاءات التركيز' }));
    db.focusMeetings.filter((f) => f.groupId === g.id && f.status === 'published' && focusIsPast(f)).forEach((f) => add({ id: `fh_${f.id}`, title: `انتهى وقت "${f.title}" ولم يُحضَّر`, cta: 'افتح اللقاء', link: `/app/focus/${f.id}`, tone: 'blue', group: 'لقاءات التركيز' }));
  });
  db.individualMeetings.filter((m) => m.facilitatorId === personId && m.status === 'requested').forEach((m) => add({ id: `irq_${m.id}`, title: `طلب لقاء فردي من ${db.persons.find((p) => p.id === m.participantId)?.name}`, cta: 'حدّد الموعد', link: '/app/individual', tone: 'blue', group: 'اللقاءات الفردية' }));
  db.individualMeetings.filter((m) => m.facilitatorId === personId && m.status === 'booked' && m.date < today).forEach((m) => add({ id: `in_${m.id}`, title: `ملاحظات اللقاء الفردي مع ${db.persons.find((p) => p.id === m.participantId)?.name}`, cta: 'اكتب الملاحظات', link: '/app/individual', tone: 'orange', group: 'اللقاءات الفردية' }));

  // ── القائد العام ──
  if (c.isLeader) {
    db.docs.forEach((d) => {
      const t = db.trips.find((x) => x.id === d.tripId)!;
      const waiting = t.executor.kind === 'staff' ? d.status === 'submitted' : d.status === 'facilitator_approved';
      if (waiting) add({ id: `ld_${d.id}`, title: `${docKindLabel[d.kind]}: ${t.title}`, hint: 'وافق عليها الميسّر وتنتظر قرارك', cta: 'اعتمد أو أعد', link: `/app/trips/${t.id}?tab=docs`, tone: 'orange', group: 'الاعتمادات' });
    });
    db.memberRequests.filter((r) => r.status === 'pending').forEach((r) => add({ id: `mr_${r.id}`, title: `طلب إضافة ${db.persons.find((p) => p.id === r.personId)?.name} للجنة`, cta: 'وافق أو ارفض', link: `/app/committees/${r.committeeId}`, tone: 'blue', group: 'اللجان' }));
    db.materials.filter((m) => m.pointsStatus === 'pending').forEach((m) => add({ id: `mp_${m.id}`, title: `طلب نقاط على مادة: ${m.title}`, cta: 'راجع المادة', link: '/app/library', tone: 'blue', group: 'المكتبة' }));
    db.trips.filter((t) => t.trackerSubstitute?.status === 'pending').forEach((t) => add({ id: `ts_${t.id}`, title: `متابع بديل لـ ${t.title}`, cta: 'اعتمد البديل', link: `/app/trips/${t.id}`, tone: 'orange', group: 'الرحلات' }));
    db.trips.filter((t) => tripStage(db, t) === 'closing' && t.evaluation.leaderScore == null).forEach((t) => add({ id: `le_${t.id}`, title: `قيّم ${t.title}`, cta: 'قيّم الرحلة', link: `/app/trips/${t.id}?tab=closure`, tone: 'blue', group: 'الرحلات' }));
  }

  // ── الاجتماعات ──
  db.meetings.filter((m) => m.ownerId === personId).forEach((m) => {
    if (m.status === 'planned' && m.date < today) add({ id: `mh_${m.id}`, title: `سجّل انعقاد "${m.title}"`, cta: 'سجّل الحضور', link: `/app/meetings/${m.id}`, tone: 'orange', group: 'الاجتماعات' });
    if (m.status === 'held') add({ id: `mm_${m.id}`, title: `اكتب محضر "${m.title}"`, cta: 'اكتب المحضر', link: `/app/meetings/${m.id}`, tone: 'orange', group: 'الاجتماعات' });
  });

  // ── متابع الرحلات ──
  db.trips.filter((t) => effectiveTrackerId(db, t) === personId).forEach((t) => {
    const st = tripStage(db, t);
    if (st === 'live') add({ id: `tl_${t.id}`, title: `${t.title} تجري الآن`, hint: 'وثّق ما يحدث مقابل الجدول', cta: 'وثّق التنفيذ', link: `/app/tracker?trip=${t.id}`, tone: 'red', group: 'متابعة الرحلات' });
    if (st === 'closing' && t.evaluation.trackerScore == null) add({ id: `te_${t.id}`, title: `قيّم ${t.title}`, cta: 'قيّم الرحلة', link: `/app/tracker?trip=${t.id}`, tone: 'blue', group: 'متابعة الرحلات' });
  });

  // إزالة التكرار وترتيب بالأولوية
  const seen = new Set<string>();
  return out.filter((a) => (seen.has(a.id) ? false : (seen.add(a.id), true))).sort((a, b) => RANK[a.tone] - RANK[b.tone]);
}
