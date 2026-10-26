// طبقة الوصول للبيانات (Repositories).
// الشاشات لا تعدّل قاعدة البيانات مباشرة، بل تستدعي هذه الواجهات فقط.
// لتحويل النموذج إلى منصة حقيقية: نكتب تنفيذاً آخر لنفس الواجهة يتصل بالخادم.
import { addDays, nowISO, todayISO } from '@/domain/dates';
import { uid } from '@/domain/id';
import { groupOf, tripFacilitatorId, tripTeamIds, tripTeamLeaderId, effectiveTrackerId } from '@/domain/permissions';
import { canManageAccounts, passwordError, suggestUsername, usernameError } from '@/domain/accounts';
import { assertNoCapacityConflict, substituteConflict } from '@/domain/capacities';
import { hashPassword, tempPassword } from '@/domain/crypto';
import { applyDocAction, canPublish, docFor, tasksFromTemplates, type DocAction } from '@/domain/workflow';
import type {
  AvailabilitySlot, BudgetCategory, BudgetLine, Comment, Committee, CommitteeKPI, Custody, DB, FocusMeeting, ID, IndividualMeeting,
  Installment, Invoice, LifeAspect, Material, MemberRequest, NotificationType, PointsEntry, ScheduleChange, SchedulePlan, Settings,
  StepFollowUp, Survey, Task, TaskTemplate, Trip, TripDoc, TripExecutor, TripSession, TripType,
} from '@/domain/types';
import { docKindLabel } from '@/domain/labels';
import {
  allocatedFor, assertSpendable, financeOwnerId, hasFinancePerm, invoiceError, isFinanceOwner, linesTotal, ownerLink, ownerTitle, routeFor, spendKindLabel, spendKindOf, FINANCE_PERMS,
} from '@/domain/finance';
import type { AuditEntry, BudgetRequest, Person, FinancePermission, InvoiceLine, Meeting, ProgramBudget, SpendKind } from '@/domain/types';

/** إن أعادت الوصفة false فلا تغيير يُحفظ */
export type Mutate = (recipe: (draft: DB) => unknown) => void;

/** إضافة إشعار داخلي (وتعليم "بالإيميل" إن كان النوع مهماً في الإعدادات) */
export function pushNotification(d: DB, toIds: ID[], type: NotificationType, title: string, link?: string, body?: string) {
  const important = d.settings.importantNotifications.includes(type);
  [...new Set(toIds)].filter(Boolean).forEach((toId) =>
    d.notifications.unshift({ id: uid('nt'), toId, type, title, body, link, at: nowISO(), read: false, emailed: important }),
  );
}

const staffIds = (d: DB) => d.persons.filter((p) => p.kind === 'staff').map((p) => p.id);
const leaderId = (d: DB) => d.persons.find((p) => p.isGeneralLeader)!.id;
const financeIds = (d: DB) => d.memberships.filter((m) => d.committees.find((c) => c.id === m.committeeId)?.kind === 'finance').map((m) => m.personId);
const allParticipants = (d: DB) => d.persons.filter((p) => p.kind === 'participant').map((p) => p.id);
const findTrip = (d: DB, id: ID) => {
  const t = d.trips.find((x) => x.id === id);
  if (!t) throw new Error('الرحلة غير موجودة');
  return t;
};

export interface CreateTripInput {
  title: string;
  type: TripType;
  executor: TripExecutor;
  startDate: string;
  endDate: string;
  location?: string;
  description?: string;
  isPersonalPlanMeeting: boolean;
  deadlines: { initial: string; detailed: string };
}

function personName(d: DB, id: ID) {
  return d.persons.find((p) => p.id === id)?.name ?? '—';
}
/** سجل تدقيق لا يُحذف. المجال الافتراضي المالية */
function audit(d: DB, byId: ID, action: string, detail: string, area: AuditEntry['area'] = 'finance') {
  d.audit.unshift({ id: uid('au'), at: nowISO(), byId, action, detail, area });
}
function isLeaderId(d: DB, pid: ID) {
  return !!d.persons.find((p) => p.id === pid)?.isGeneralLeader;
}
function techOnly(d: DB, pid: ID) {
  if (!canManageAccounts(d, pid)) throw new Error('إدارة الحسابات وكلمات المرور لمسؤول اللجنة التقنية وحده');
}
function accountFor(d: DB, personId: ID) {
  const acc = d.accounts.find((a) => a.personId === personId);
  if (!acc) throw new Error('لا حساب لهذا الشخص');
  return acc;
}
function guard(d: DB, pid: ID, perm: FinancePermission) {
  if (!hasFinancePerm(d, pid, perm)) throw new Error(`لا تملك صلاحية «${FINANCE_PERMS.find((p) => p.key === perm)!.label}». يمنحها مسؤول اللجنة المالية.`);
}
function ownerOnly(d: DB, pid: ID) {
  if (!isFinanceOwner(d, pid)) throw new Error('هذا الإجراء لمسؤول اللجنة المالية فقط');
}
function financeIdsWith(d: DB, perm: FinancePermission) {
  return d.memberships.filter((m) => d.committees.find((c) => c.id === m.committeeId)?.kind === 'finance').map((m) => m.personId).filter((p) => hasFinancePerm(d, p, perm));
}
function findRequest(d: DB, id: ID) {
  const r = d.budgetRequests.find((x) => x.id === id);
  if (!r) throw new Error('الطلب غير موجود');
  return r;
}
function findMeeting(d: DB, id: ID) {
  const m = d.meetings.find((x) => x.id === id);
  if (!m) throw new Error('الاجتماع غير موجود');
  return m;
}
function createCustodyIn(d: DB, input: { ownerKind: Custody['ownerKind']; ownerId: ID; requestId?: ID; recipientId: ID; installments: { amount: number; dueDate: string; condition?: string }[] }) {
  if (!input.installments.length || input.installments.some((i) => !(i.amount > 0))) throw new Error('حدد مبلغ كل دفعة');
  const total = input.installments.reduce((s, i) => s + i.amount, 0);
  const c: Custody = {
    id: uid('cu'), requestId: input.requestId, ownerKind: input.ownerKind, ownerId: input.ownerId, recipientId: input.recipientId, total, status: 'setup', createdAt: nowISO(),
    installments: input.installments.map((i, idx) => ({ id: uid('in'), ...i, status: idx === 0 ? 'awaiting_iban' : 'scheduled' })),
  };
  d.custodies.push(c);
  pushNotification(d, [input.recipientId], 'custody_issued', `صُرفت لك عهدة ${ownerTitle(d, input.ownerKind, input.ownerId)}: ارفع رقم الآيبان`, '/app/requests');
  return c;
}
/** تقديم طلب ميزانية أو إعادة تقديمه. يُستخدم من الشاشات ومن إنشاء لقاء التركيز */
function submitRequestIn(d: DB, pid: ID, input: { ownerKind: BudgetRequest['ownerKind']; ownerId: ID; amount: number; lines: BudgetLine[]; detailed: boolean; note?: string }) {
  if (!d.programBudget.setupDone) throw new Error('لم يُعدّ المسؤول المالي الميزانية بعد. أرسل الطلب بعد إعدادها.');
  const spendKind = spendKindOf(d, input.ownerKind, input.ownerId);
  assertSpendable(d, spendKind);
  // من يقدّم: الميسّر للقاء التركيز، وقائد الفريق للرحلة، ومسؤول الاجتماع للاجتماع
  if (input.ownerKind === 'focus') {
    const fm = d.focusMeetings.find((f) => f.id === input.ownerId)!;
    if (d.groups.find((g) => g.id === fm.groupId)?.facilitatorId !== pid) throw new Error('طلب ميزانية لقاء التركيز للميسّر فقط');
    if (allocatedFor(d, 'focus', fm.id) === 0) throw new Error(`هذا اللقاء بعد الحد الأعلى (${d.programBudget.focusLimits.max}) للقاءات بميزانية، فلا يُطلب له ميزانية.`);
  }
  if (input.ownerKind === 'trip') {
    const t = d.trips.find((x) => x.id === input.ownerId)!;
    if (tripTeamLeaderId(d, t) !== pid) throw new Error('طلب ميزانية الرحلة لقائد الفريق فقط');
    if (!input.lines.length) throw new Error('الرحلات تُقدَّم دائماً بموازنة تفصيلية: أضف بنود الموازنة');
  }
  if (input.ownerKind === 'meeting' && d.meetings.find((m) => m.id === input.ownerId)?.ownerId !== pid) throw new Error('طلب ميزانية الاجتماع لمسؤوله');
  const detailed = input.detailed || input.lines.length > 0;
  const amount = detailed ? linesTotal(input.lines) : input.amount;
  if (!(amount > 0)) throw new Error('اكتب المبلغ المطلوب');
  const allocated = allocatedFor(d, input.ownerKind, input.ownerId);
  const existing = [...d.budgetRequests].reverse().find((r) => r.ownerKind === input.ownerKind && r.ownerId === input.ownerId);
  if (existing && !['draft', 'rejected', 'needs_detail'].includes(existing.status)) throw new Error('يوجد طلب قائم لهذا العنصر');
  // بعد طلب القائد العام موازنة تفصيلية يعود الطلب إليه مباشرة
  const status = existing?.status === 'needs_detail' ? 'pending_leader' : routeFor(amount, allocated);
  const r: BudgetRequest = existing ?? { id: uid('br'), ownerKind: input.ownerKind, ownerId: input.ownerId, spendKind, requestedBy: pid, amount, allocated, detailed, lines: [], status, history: [] };
  Object.assign(r, { amount, allocated, detailed, lines: input.lines, note: input.note, status, submittedAt: r.submittedAt ?? nowISO() });
  r.history.push({ at: nowISO(), byId: pid, action: existing?.status === 'needs_detail' ? 'detail_submitted' : 'submit', note: input.note });
  if (!existing) d.budgetRequests.push(r);
  const t = ownerTitle(d, r.ownerKind, r.ownerId);
  if (status === 'pending_finance') pushNotification(d, financeIdsWith(d, 'approve_within').filter((x) => x !== pid), 'budget_request', `طلب ميزانية ضمن المرصود: ${t} (${amount} ر.س)`, '/app/finance');
  else pushNotification(d, [leaderId(d)], 'budget_request', `طلب ميزانية يتجاوز المرصود: ${t} (${amount} من ${allocated} ر.س)`, '/app/finance');
}

export function createLocalRepositories(mutate: Mutate, me: () => ID) {
  return {
    // ───────────── الأشخاص والمجموعات ─────────────
    people: {
      /** القائد العام ينشئ الشخص ويحدد نوعه، ثم يدير مسؤول اللجنة التقنية حساب دخوله */
      create(input: Omit<Person, 'id' | 'isGeneralLeader'>): ID {
        const id = uid(input.kind === 'staff' ? 's' : 'u');
        mutate((d) => {
          if (!isLeaderId(d, me())) throw new Error('إضافة الأشخاص للقائد العام');
          if (!input.name.trim()) throw new Error('الاسم مطلوب');
          if (!/^\S+@\S+\.\S+$/.test(input.email.trim())) throw new Error('البريد غير صحيح');
          if (d.persons.some((p) => p.email.toLowerCase() === input.email.trim().toLowerCase())) throw new Error('البريد مسجّل لشخص آخر');
          d.persons.push({ ...input, id, name: input.name.trim(), email: input.email.trim() });
          d.accounts.push({ personId: id, username: suggestUsername(d, input.email), mustChangePassword: true, disabled: false, updatedAt: nowISO(), updatedBy: me() });
          audit(d, me(), input.kind === 'staff' ? 'إضافة عضو فريق عمل' : 'تسجيل مشارك', input.name, 'roles');
          const tech = d.memberships.find((m) => m.role === 'leader' && d.committees.find((c) => c.id === m.committeeId)?.kind === 'tech')?.personId;
          if (tech) pushNotification(d, [tech], 'general', `حساب جديد بلا كلمة مرور: ${input.name}`, '/app/users');
        });
        return id;
      },
      setSiteEditor(personId: ID, on: boolean) {
        mutate((d) => {
          d.capacities = d.capacities.filter((c) => !(c.personId === personId && c.kind === 'site_editor'));
          if (on) d.capacities.push({ id: uid('cap'), personId, kind: 'site_editor', grantedBy: me(), at: nowISO() });
        });
      },
    },
    // ───────────── حسابات الدخول (مسؤول اللجنة التقنية وحده) ─────────────
    accounts: {
      setUsername(personId: ID, username: string) {
        mutate((d) => {
          techOnly(d, me());
          const err = usernameError(d, personId, username);
          if (err) throw new Error(err);
          const acc = accountFor(d, personId);
          acc.username = username.trim().toLowerCase();
          Object.assign(acc, { updatedAt: nowISO(), updatedBy: me() });
          audit(d, me(), 'تعديل اسم الدخول', `${personName(d, personId)} — ${acc.username}`, 'accounts');
        });
      },
      /** يولّد كلمة مرور مؤقتة تُسلَّم للشخص، ويُطلب منه تغييرها أول دخول */
      resetPassword(personId: ID): string {
        const pw = tempPassword();
        mutate((d) => {
          techOnly(d, me());
          const acc = accountFor(d, personId);
          const salt = uid('salt');
          Object.assign(acc, { salt, passwordHash: hashPassword(pw, salt), mustChangePassword: true, updatedAt: nowISO(), updatedBy: me() });
          audit(d, me(), 'إعادة تعيين كلمة المرور', personName(d, personId), 'accounts');
        });
        return pw;
      },
      setDisabled(personId: ID, disabled: boolean) {
        mutate((d) => {
          techOnly(d, me());
          if (personId === me() && disabled) throw new Error('لا تعطّل حسابك بنفسك');
          Object.assign(accountFor(d, personId), { disabled, updatedAt: nowISO(), updatedBy: me() });
          audit(d, me(), disabled ? 'تعطيل حساب' : 'تفعيل حساب', personName(d, personId), 'accounts');
        });
      },
      /** صاحب الحساب يغيّر كلمته (مطلوب بعد إعادة التعيين) */
      changeOwnPassword(personId: ID, current: string, next: string) {
        mutate((d) => {
          const acc = accountFor(d, personId);
          if (!acc.salt || hashPassword(current, acc.salt) !== acc.passwordHash) throw new Error('كلمة المرور الحالية غير صحيحة');
          const err = passwordError(next);
          if (err) throw new Error(err);
          if (next === current) throw new Error('اختر كلمة مرور مختلفة عن الحالية');
          const salt = uid('salt');
          Object.assign(acc, { salt, passwordHash: hashPassword(next, salt), mustChangePassword: false, updatedAt: nowISO(), updatedBy: personId });
        });
      },
    },
    groups: {
      update(groupId: ID, patch: Partial<{ name: string; leaderId: ID; facilitatorId: ID; color: string }>) {
        mutate((d) => {
          Object.assign(d.groups.find((g) => g.id === groupId)!, patch);
          assertNoCapacityConflict(d, [patch.facilitatorId, patch.leaderId]);
          if (patch.facilitatorId) audit(d, me(), 'إسناد صفة', `ميسّر ${d.groups.find((g) => g.id === groupId)!.name} — ${personName(d, patch.facilitatorId)}`, 'roles');
        });
      },
      create(name: string) {
        mutate((d) => d.groups.push({ id: uid('g'), name, color: '#00b9d1', memberIds: [] }));
      },
      /** قبل النشر: تعديل حر ولا يُعد نقلاً */
      assignDraft(personId: ID, toGroupId: ID | null) {
        mutate((d) => {
          d.groups.forEach((g) => {
            g.memberIds = g.memberIds.filter((m) => m !== personId);
            if (g.leaderId === personId && g.id !== toGroupId) g.leaderId = undefined;
          });
          if (toGroupId) d.groups.find((g) => g.id === toGroupId)!.memberIds.push(personId);
        });
      },
      /** بعد النشر: نقل يُسجَّل، والميسّر الجديد يرى السجل القديم */
      transfer(personId: ID, toGroupId: ID, reason?: string) {
        mutate((d) => {
          const from = groupOf(d, personId);
          if (!from || from.id === toGroupId) return;
          from.memberIds = from.memberIds.filter((m) => m !== personId);
          if (from.leaderId === personId) from.leaderId = undefined;
          const to = d.groups.find((g) => g.id === toGroupId)!;
          to.memberIds.push(personId);
          d.transfers.push({ id: uid('tr'), personId, fromGroupId: from.id, toGroupId, by: me(), at: nowISO(), reason });
          pushNotification(d, [personId, to.facilitatorId!, from.facilitatorId!], 'general', `نُقل ${d.persons.find((p) => p.id === personId)?.name} إلى ${to.name}`, '/app/groups');
        });
      },
      schedulePublish(publishAt: string) {
        mutate((d) => {
          d.formation = { status: 'scheduled', publishAt };
        });
      },
      publishNow() {
        mutate((d) => {
          d.formation = { status: 'published', publishAt: nowISO(), publishedAt: nowISO() };
          pushNotification(d, [...allParticipants(d), ...staffIds(d)], 'groups_published', 'نُشر تشكيل المجموعات: تعرّف على مجموعتك', '/app/groups');
        });
      },
      unpublish() {
        mutate((d) => {
          d.formation = { status: 'draft' };
        });
      },
      addNote(participantId: ID, text: string) {
        mutate((d) => {
          d.facilitatorNotes.push({ id: uid('fn'), participantId, authorId: me(), groupIdAtTime: groupOf(d, participantId)?.id, text, at: nowISO() });
        });
      },
    },
    messages: {
      send(text: string) {
        mutate((d) => {
          d.adminMessages.push({ id: uid('am'), fromId: me(), text, at: nowISO() });
          pushNotification(d, [leaderId(d)], 'general', 'رسالة جديدة من مشارك', '/app/inbox');
        });
      },
      reply(id: ID, text: string) {
        mutate((d) => {
          const m = d.adminMessages.find((x) => x.id === id)!;
          m.reply = { byId: me(), text, at: nowISO() };
          pushNotification(d, [m.fromId], 'general', 'ردّت الإدارة على رسالتك', '/app/contact');
        });
      },
    },

    // ───────────── الرحلات ─────────────
    trips: {
      create(input: CreateTripInput): ID {
        const id = uid('t');
        mutate((d) => {
          const trip: Trip = {
            id, ...input, createdAt: nowISO(), createdBy: me(), published: false,
            schedule: { plans: [{ id: uid('pl'), name: 'الخطة أ', items: [] }, { id: uid('pl'), name: 'الخطة ب', items: [] }], changes: [] },
            scheduleVisibility: 'hidden', sessions: [], guests: [],
            coordinations: input.type === 'external'
              ? (['transport', 'food', 'housing', 'hosting'] as const).map((key) => ({ key, status: 'pending' as const }))
              : (['transport', 'food', 'hosting'] as const).map((key) => ({ key, status: 'pending' as const })),
            closure: { photos: [] }, evaluation: { manual: {} }, punctuality: {},
          };
          d.trips.push(trip);
          if (trip.executor.kind === 'staff') assertNoCapacityConflict(d, [trip.executor.leaderId, ...trip.executor.memberIds]);
          (['initial', 'detailed'] as const).forEach((kind) => d.docs.push({ id: uid('doc'), tripId: id, kind, status: 'draft', version: 1, fields: {}, history: [] }));
          d.tasks.push(...tasksFromTemplates(d, trip, me()));
          const team = tripTeamIds(d, trip);
          pushNotification(d, team, 'general', `أُسندت إليكم رحلة جديدة: ${trip.title}`, `/app/trips/${id}`);
          // تظهر الرحلة في تقويم الجميع منذ إدراجها
          pushNotification(d, [...allParticipants(d), ...staffIds(d)].filter((x) => !team.includes(x)), 'general', `أُدرجت رحلة في التقويم: ${trip.title}`, `/app/calendar`);
        });
        return id;
      },
      update(tripId: ID, patch: Partial<Trip>) {
        mutate((d) => {
          const t = findTrip(d, tripId);
          const dateChanged = patch.startDate && patch.startDate !== t.startDate;
          Object.assign(t, patch);
          if (t.executor.kind === 'staff') assertNoCapacityConflict(d, [t.executor.leaderId, ...t.executor.memberIds]);
          if (dateChanged) pushNotification(d, [...allParticipants(d), ...staffIds(d)], 'general', `تعديل تاريخ ${t.title}`, `/app/trips/${tripId}`);
        });
      },
      updateDocFields(docId: ID, fields: Record<string, string>) {
        mutate((d) => {
          const doc = d.docs.find((x) => x.id === docId)!;
          doc.fields = { ...doc.fields, ...fields };
        });
      },
      docAction(docId: ID, action: DocAction) {
        mutate((d) => {
          let doc = d.docs.find((x) => x.id === docId);
          if (!doc) throw new Error('الوثيقة غير موجودة');
          const trip = findTrip(d, doc.tripId);
          const isStaff = trip.executor.kind === 'staff';
          const updated = applyDocAction(doc, action, me(), isStaff);
          Object.assign(doc, updated);
          doc = updated;
          const label = `${docKindLabel[doc.kind]} — ${trip.title}`;
          const link = `/app/trips/${trip.id}`;
          const team = tripTeamIds(d, trip);
          const teamLead = tripTeamLeaderId(d, trip)!;
          const fac = tripFacilitatorId(d, trip)!;
          if (action.type === 'submit') pushNotification(d, [fac], 'approval_submitted', `رُفعت ${label} للمراجعة`, link);
          if (action.type === 'facilitator_approve') {
            pushNotification(d, [leaderId(d)], 'approval_submitted', `وافق الميسّر على ${label}: بانتظار قرارك`, link);
            pushNotification(d, staffIds(d), 'general', `${label} معروضة على الإدارة للنقاش`, link);
            pushNotification(d, team, 'approval_approved', `وافق الميسّر على ${label}`, link);
          }
          if (action.type === 'facilitator_reject') pushNotification(d, team, 'approval_rejected', `أعاد الميسّر ${label}: ${action.reason}`, link);
          if (action.type === 'leader_reject') pushNotification(d, [teamLead, fac], 'approval_rejected', `أعاد القائد العام ${label}: ${action.reason}`, link);
          if (action.type === 'leader_approve' || action.type === 'leader_edit_approve') {
            pushNotification(d, [...team, fac], 'approval_approved', `اعتُمدت ${label}`, link);
            // فتح التقرير الختامي بعد اعتماد التفصيلية تلقائياً
            if (doc.kind === 'detailed' && !docFor(d, trip.id, 'final_report'))
              d.docs.push({ id: uid('doc'), tripId: trip.id, kind: 'final_report', status: 'draft', version: 1, fields: {}, history: [] });
          }
        });
      },
      /** حفظ الجدول. أي تعديل بعد الانطلاق يُسجَّل ويؤثر على التقييم */
      saveSchedule(tripId: ID, plans: SchedulePlan[], changeNote?: string, newSessions: TripSession[] = []) {
        mutate((d) => {
          const t = findTrip(d, tripId);
          t.schedule.plans = plans;
          t.sessions.push(...newSessions);
          const started = t.published && plans[0]?.items.some((i) => `${i.date}T${i.start}` <= nowISO().slice(0, 16));
          if (t.published || changeNote) {
            const ch: ScheduleChange = { id: uid('ch'), at: nowISO(), byId: me(), description: changeNote || 'تعديل على الجدول', afterStart: !!started };
            t.schedule.changes.push(ch);
            if (t.published) pushNotification(d, [...tripTeamIds(d, t), ...staffIds(d)], 'general', `عُدّل جدول ${t.title}`, `/app/trips/${tripId}`);
          }
          // ربط اللقاءات ببنود الجدول
          const sessions = plans[0]?.items.filter((i) => i.sessionId) ?? [];
          t.sessions = t.sessions.filter((s) => sessions.some((i) => i.sessionId === s.id)).map((s) => {
            const i = sessions.find((x) => x.sessionId === s.id)!;
            return { ...s, date: i.date, start: i.start, end: i.end };
          });
        });
      },
      addSession(tripId: ID, itemId: ID, title: string, presenter?: string) {
        mutate((d) => {
          const t = findTrip(d, tripId);
          const item = t.schedule.plans[0].items.find((i) => i.id === itemId)!;
          const sid = uid('ss');
          t.sessions.push({ id: sid, title, presenter, date: item.date, start: item.start, end: item.end });
          item.sessionId = sid;
        });
      },
      setScheduleVisibility(tripId: ID, v: Trip['scheduleVisibility']) {
        mutate((d) => {
          const t = findTrip(d, tripId);
          t.scheduleVisibility = v;
          if (v !== 'hidden') pushNotification(d, allParticipants(d), 'general', `جدول ${t.title} متاح الآن`, `/app/trips/${tripId}`);
        });
      },
      publish(tripId: ID) {
        mutate((d) => {
          const t = findTrip(d, tripId);
          if (!canPublish(d, t)) throw new Error('لم تكتمل شروط النشر');
          t.published = true;
          t.publishedAt = nowISO();
          pushNotification(d, [...allParticipants(d), ...staffIds(d)], 'trip_published', `نُشرت ${t.title}`, `/app/trips/${tripId}`);
          // استبيان قبلي إلزامي يُفتح مع النشر إن لم يوجد
          if (!d.surveys.some((s) => s.context.kind === 'trip' && s.context.id === tripId)) {
            const preId = uid('sv');
            d.surveys.push({ id: preId, title: `استبيان ${t.title} — قبلي`, context: { kind: 'trip', id: tripId }, phase: 'pre', mandatory: true, opensAt: nowISO(), createdBy: me(), questions: [{ id: `${preId}_q0`, text: 'ما مدى معرفتك بموضوع الرحلة؟', type: 'scale' }], responses: [] });
          }
        });
      },
      updateGuests(tripId: ID, guests: Trip['guests']) {
        mutate((d) => (findTrip(d, tripId).guests = guests));
      },
      updateCoordination(tripId: ID, key: string, patch: Partial<Trip['coordinations'][number]>) {
        mutate((d) => Object.assign(findTrip(d, tripId).coordinations.find((c) => c.key === key)!, patch));
      },
      notifyScheduleStarted(tripId: ID) {
        mutate((d) => {
          const t = findTrip(d, tripId);
          if (t.scheduleStartedNotified) return false;
          t.scheduleStartedNotified = true;
          pushNotification(d, [...allParticipants(d), ...staffIds(d)], 'schedule_started', `بدأ جدول ${t.title}`, `/app/trips/${tripId}`);
        });
      },
      setAttendance(eventKind: 'trip' | 'focus', eventId: ID, personId: ID, present: boolean) {
        mutate((d) => {
          const ex = d.attendance.find((a) => a.eventKind === eventKind && a.eventId === eventId && a.personId === personId);
          if (ex) Object.assign(ex, { present, byId: me(), at: nowISO() });
          else d.attendance.push({ id: uid('at'), eventKind, eventId, personId, present, byId: me(), at: nowISO() });
        });
      },
      setPunctuality(tripId: ID, personId: ID, score: number) {
        mutate((d) => (findTrip(d, tripId).punctuality[personId] = score));
      },
      recordActual(tripId: ID, refItemId: ID, entry: { followed: 'A' | 'B' | 'none'; note?: string; actualStart?: string; actualEnd?: string; categoryId?: ID }) {
        mutate((d) => {
          const ex = d.actualSchedule.find((e) => e.tripId === tripId && e.refItemId === refItemId);
          if (ex) Object.assign(ex, entry, { byId: me(), at: nowISO() });
          else d.actualSchedule.push({ id: uid('ac'), tripId, refItemId, ...entry, byId: me(), at: nowISO() });
        });
      },
      evaluate(tripId: ID, patch: Partial<Trip['evaluation']>) {
        mutate((d) => {
          const t = findTrip(d, tripId);
          t.evaluation = { ...t.evaluation, ...patch, manual: { ...t.evaluation.manual, ...(patch.manual ?? {}) } };
        });
      },
      updateClosure(tripId: ID, patch: Partial<Trip['closure']>) {
        mutate((d) => {
          const t = findTrip(d, tripId);
          t.closure = { ...t.closure, ...patch };
        });
      },
      /** إرسال الاستبيان البعدي تلقائياً بعد انتهاء الرحلة */
      ensurePostSurvey(tripId: ID) {
        mutate((d) => {
          const t = findTrip(d, tripId);
          const pre = d.surveys.find((s) => s.context.kind === 'trip' && s.context.id === tripId && s.phase === 'pre');
          if (!pre || d.surveys.some((s) => s.preSurveyId === pre.id)) return false;
          const id = uid('sv');
          d.surveys.push({
            id, title: `استبيان ${t.title} — بعدي`, context: pre.context, phase: 'post', preSurveyId: pre.id, mandatory: true, opensAt: nowISO(), createdBy: pre.createdBy, responses: [],
            questions: [
              ...pre.questions.map((q, i) => ({ id: `${id}_q${i}`, text: `بعد حضورك: ${q.text}`, type: q.type, pairsWith: q.id })),
              { id: `${id}_g1`, text: 'ما مدى رضاك عن الرحلة؟', type: 'scale' as const, isGeneral: true },
              { id: `${id}_g2`, text: 'ما مدى رضاك عن المادة العلمية؟', type: 'scale' as const, isGeneral: true },
            ],
          });
          pushNotification(d, allParticipants(d), 'survey_available', `الاستبيان البعدي لـ ${t.title} متاح`, '/app/surveys');
        });
      },
      requestTrackerSubstitute(tripId: ID, candidateId: ID, reason?: string) {
        mutate((d) => {
          const conflict = substituteConflict(d, candidateId, findTrip(d, tripId));
          if (conflict) throw new Error(`${personName(d, candidateId)}: ${conflict}`);
          findTrip(d, tripId).trackerSubstitute = { candidateId, reason, status: 'pending' };
          pushNotification(d, [leaderId(d)], 'general', 'طلب متابع بديل لرحلة', `/app/trips/${tripId}`);
        });
      },
      decideTrackerSubstitute(tripId: ID, approve: boolean) {
        mutate((d) => {
          const t = findTrip(d, tripId);
          if (!t.trackerSubstitute) return;
          t.trackerSubstitute.status = approve ? 'approved' : 'rejected';
          if (approve) pushNotification(d, [t.trackerSubstitute.candidateId], 'general', `كُلّفت بمتابعة ${t.title} بديلاً عن المتابع`, `/app/tracker`);
        });
      },
    },

    // ───────────── المهام ─────────────
    tasks: {
      create(input: Omit<Task, 'id' | 'createdAt' | 'createdBy' | 'status'> & { status?: Task['status'] }) {
        mutate((d) => {
          const t: Task = { status: 'new', ...input, id: uid('tk'), createdAt: nowISO(), createdBy: me() };
          d.tasks.push(t);
          pushNotification(d, [t.assigneeId], 'task_assigned', `أُسندت لك مهمة: ${t.title}`, t.tripId ? `/app/trips/${t.tripId}` : '/app/tasks');
        });
      },
      update(taskId: ID, patch: Partial<Task>) {
        mutate((d) => {
          const t = d.tasks.find((x) => x.id === taskId)!;
          if (patch.status === 'done' && t.proofType !== 'none' && !(patch.proof ?? t.proof)?.trim()) throw new Error('الإثبات إلزامي لإغلاق المهمة');
          Object.assign(t, patch);
          if (patch.status === 'done') t.doneAt = nowISO();
          if (patch.assigneeId) pushNotification(d, [patch.assigneeId], 'task_assigned', `أُسندت لك مهمة: ${t.title}`, '/app/tasks');
        });
      },
      remove(taskId: ID) {
        mutate((d) => (d.tasks = d.tasks.filter((t) => t.id !== taskId)));
      },
      saveTemplate(tpl: TaskTemplate) {
        mutate((d) => {
          const i = d.taskTemplates.findIndex((x) => x.id === tpl.id);
          if (i >= 0) d.taskTemplates[i] = tpl;
          else d.taskTemplates.push(tpl);
        });
      },
      removeTemplate(id: ID) {
        mutate((d) => (d.taskTemplates = d.taskTemplates.filter((x) => x.id !== id)));
      },
    },
    comments: {
      add(target: Comment['target'], text: string, kind: Comment['kind'] = 'comment') {
        mutate((d) => {
          d.comments.push({ id: uid('cm'), target, authorId: me(), text, kind, at: nowISO() });
        });
      },
    },

    // ───────────── لقاءات التركيز ─────────────
    focus: {
      /** إنشاء اللقاء، ومعه طلب الميزانية مباشرة إن طلبه الميسّر */
      create(fm: Omit<FocusMeeting, 'id' | 'createdBy' | 'status' | 'presenterEvaluations'>, budget?: { amount: number; note?: string }): ID {
        const id = uid('f');
        mutate((d) => {
          const meeting: FocusMeeting = { ...fm, id, createdBy: me(), status: 'draft', presenterEvaluations: {} };
          d.focusMeetings.push(meeting);
          if (meeting.presenterIds.length) pushNotification(d, meeting.presenterIds, 'focus_created_presenter', `كُلّفت بالتقديم في "${meeting.title}": جهّز وحدد التفاصيل`, `/app/focus/${id}`);
          if (budget) submitRequestIn(d, me(), { ownerKind: 'focus', ownerId: id, amount: budget.amount, note: budget.note, lines: [], detailed: false });
        });
        return id;
      },
      update(id: ID, patch: Partial<FocusMeeting>) {
        mutate((d) => Object.assign(d.focusMeetings.find((f) => f.id === id)!, patch));
      },
      publish(id: ID) {
        mutate((d) => {
          const f = d.focusMeetings.find((x) => x.id === id)!;
          f.status = 'published';
          const g = d.groups.find((x) => x.id === f.groupId)!;
          pushNotification(d, g.memberIds, 'focus_published', `لقاء تركيز جديد: ${f.title}`, `/app/focus/${id}`);
        });
      },
      /** يوم اللقاء: يغلق قائد المجموعة التحضير. إن لم يحضر ولم يؤكد، يصل الميسّر تنبيه */
      markHeld(id: ID) {
        mutate((d) => {
          const f = d.focusMeetings.find((x) => x.id === id)!;
          f.status = 'held';
          f.attendanceConfirmedBy = me();
          const g = d.groups.find((x) => x.id === f.groupId)!;
          const leaderPresent = d.attendance.some((a) => a.eventKind === 'focus' && a.eventId === id && a.personId === g.leaderId && a.present);
          if (!leaderPresent && !f.attendanceTakerId) pushNotification(d, [g.facilitatorId!], 'leader_absent_focus', `قائد ${g.name} لم يحضر لقاء "${f.title}" ولم يكلّف نائباً`, `/app/focus/${id}`);
          if (!d.surveys.some((s) => s.context.kind === 'focus' && s.context.id === id)) {
            const sid = uid('sv');
            d.surveys.push({ id: sid, title: `استبيان ${f.title}`, context: { kind: 'focus', id }, phase: 'post', mandatory: false, opensAt: nowISO(), createdBy: me(), responses: [], questions: [{ id: `${sid}_g1`, text: 'ما مدى استفادتك من اللقاء؟', type: 'scale', isGeneral: true }, { id: `${sid}_g2`, text: 'ملاحظاتك', type: 'text', isGeneral: true }] });
            pushNotification(d, g.memberIds, 'survey_available', `استبيان اختياري: ${f.title}`, '/app/surveys');
          }
        });
      },
      evaluatePresenter(id: ID, personId: ID, scores: Record<string, number>) {
        mutate((d) => {
          d.focusMeetings.find((x) => x.id === id)!.presenterEvaluations[personId] = scores;
        });
      },
      close(id: ID) {
        mutate((d) => {
          d.focusMeetings.find((x) => x.id === id)!.status = 'closed';
        });
      },
    },

    // ───────────── اللقاءات الفردية ─────────────
    individual: {
      addSlot(slot: Omit<AvailabilitySlot, 'id' | 'facilitatorId'>) {
        mutate((d) => {
          const s = { ...slot, id: uid('sl'), facilitatorId: me() };
          d.slots.push(s);
          const g = d.groups.find((x) => x.facilitatorId === me());
          if (slot.invite === 'open' && g) pushNotification(d, g.memberIds, 'general', 'نشر الميسّر أوقاتاً جديدة للقاءات الفردية', '/app/individual');
          if (slot.invite !== 'open') pushNotification(d, [slot.invite], 'general', 'طلب منك الميسّر حجز لقاء فردي', '/app/individual');
        });
      },
      removeSlot(id: ID) {
        mutate((d) => (d.slots = d.slots.filter((s) => s.id !== id || s.bookedBy)));
      },
      book(slotId: ID) {
        mutate((d) => {
          const s = d.slots.find((x) => x.id === slotId)!;
          if (s.bookedBy) throw new Error('هذا الموعد محجوز');
          s.bookedBy = me();
          d.individualMeetings.push({ id: uid('im'), facilitatorId: s.facilitatorId, participantId: me(), slotId, date: s.date, start: s.start, end: s.end, origin: s.invite === 'open' ? 'open_invite' : 'personal_invite', status: 'booked' });
          pushNotification(d, [s.facilitatorId, me()], 'individual_booked', `حُجز لقاء فردي ${s.date} ${s.start}`, '/app/individual');
        });
      },
      request(date: string, start: string, note: string) {
        mutate((d) => {
          const g = groupOf(d, me())!;
          d.individualMeetings.push({ id: uid('im'), facilitatorId: g.facilitatorId!, participantId: me(), date, start, end: start, origin: 'participant_request', status: 'requested', requestNote: note });
          pushNotification(d, [g.facilitatorId!], 'individual_booked', `طلب لقاء فردي من ${d.persons.find((p) => p.id === me())?.name}`, '/app/individual');
        });
      },
      approveRequest(id: ID, date: string, start: string, end: string) {
        mutate((d) => {
          const m = d.individualMeetings.find((x) => x.id === id)!;
          Object.assign(m, { date, start, end, status: 'booked' });
          pushNotification(d, [m.participantId], 'individual_booked', 'أكّد الميسّر موعد لقائك الفردي', '/app/individual');
        });
      },
      complete(id: ID, notesOnPlan: string, notesOnMeeting: string, attachment?: { title: string; url: string; type: 'pdf' | 'video' | 'link' }) {
        mutate((d) => {
          const m = d.individualMeetings.find((x) => x.id === id)!;
          Object.assign(m, { status: 'done', notesOnPlan, notesOnMeeting });
          d.attendance.push({ id: uid('at'), eventKind: 'individual', eventId: id, personId: m.participantId, present: true, byId: me(), at: nowISO() });
          if (attachment?.title) {
            const mid = uid('mt');
            d.materials.push({ id: mid, title: attachment.title, type: attachment.type, url: attachment.url || 'https://example.com', uploaderId: me(), origin: 'individual', revealMode: 'auto', revealed: true, audience: { kind: 'person', personId: m.participantId }, at: nowISO() });
            m.attachmentMaterialId = mid;
          }
          pushNotification(d, [m.participantId], 'general', 'أضاف الميسّر ملاحظات لقائك الفردي', '/app/library');
        });
      },
      cancel(id: ID) {
        mutate((d) => {
          const m = d.individualMeetings.find((x) => x.id === id)!;
          m.status = 'cancelled';
          const s = d.slots.find((x) => x.id === m.slotId);
          if (s) s.bookedBy = undefined;
        });
      },
    },

    // ───────────── الخطة الشخصية ─────────────
    plans: {
      saveAspect(participantId: ID, aspect: LifeAspect) {
        mutate((d) => {
          let p = d.personalPlans.find((x) => x.participantId === participantId);
          if (!p) d.personalPlans.push((p = { participantId, aspects: [] }));
          const i = p.aspects.findIndex((a) => a.key === aspect.key);
          if (i >= 0) p.aspects[i] = aspect;
          else p.aspects.push(aspect);
          p.updatedAt = nowISO();
        });
      },
      setLevel(participantId: ID, key: LifeAspect['key'], level: number) {
        mutate((d) => {
          let p = d.personalPlans.find((x) => x.participantId === participantId);
          if (!p) d.personalPlans.push((p = { participantId, aspects: [] }));
          let a = p.aspects.find((x) => x.key === key);
          if (!a) p.aspects.push((a = { key, level, vision: '', steps: [] }));
          a.level = level;
        });
      },
      followUp(participantId: ID, stepId: ID, f: Omit<StepFollowUp, 'id' | 'at'>, status: 'started' | 'done' | 'challenged' | 'pending') {
        mutate((d) => {
          const p = d.personalPlans.find((x) => x.participantId === participantId)!;
          const step = p.aspects.flatMap((a) => a.steps).find((s) => s.id === stepId)!;
          step.followUps.push({ ...f, id: uid('fu'), at: nowISO() });
          step.status = status;
          if (f.needHelp) {
            const g = groupOf(d, participantId);
            if (g?.facilitatorId) pushNotification(d, [g.facilitatorId], 'plan_step_due', `${d.persons.find((x) => x.id === participantId)?.name} يحتاج مساعدة في خطوة "${step.title}"`, `/app/plans/${participantId}`);
          }
        });
      },
      unlock(participantId: ID, on = true) {
        mutate((d) => {
          let p = d.personalPlans.find((x) => x.participantId === participantId);
          if (!p) d.personalPlans.push((p = { participantId, aspects: [] }));
          p.manuallyUnlocked = on;
        });
      },
    },

    // ───────────── الاستبيانات ─────────────
    surveys: {
      save(s: Survey) {
        mutate((d) => {
          const i = d.surveys.findIndex((x) => x.id === s.id);
          if (i >= 0) d.surveys[i] = s;
          else {
            d.surveys.push(s);
            if (new Date(s.opensAt) <= new Date()) pushNotification(d, allParticipants(d), 'survey_available', `استبيان جديد: ${s.title}`, '/app/surveys');
          }
        });
      },
      respond(surveyId: ID, answers: Record<ID, string>) {
        mutate((d) => {
          const s = d.surveys.find((x) => x.id === surveyId)!;
          s.responses = s.responses.filter((r) => r.personId !== me());
          s.responses.push({ id: uid('rs'), personId: me(), answers, at: nowISO() });
        });
      },
    },

    // ───────────── المكتبة ─────────────
    materials: {
      add(m: Omit<Material, 'id' | 'uploaderId' | 'at'>) {
        mutate((d) => {
          const mat: Material = { ...m, id: uid('mt'), uploaderId: me(), at: nowISO() };
          if (mat.pointsRequested) mat.pointsStatus = 'pending';
          d.materials.push(mat);
          if (mat.pointsRequested) pushNotification(d, [leaderId(d)], 'general', `طلب نقاط على مادة: ${mat.title}`, '/app/library');
          if (mat.audience.kind === 'person') pushNotification(d, [mat.audience.personId], 'general', `أُرفقت لك مادة: ${mat.title}`, '/app/library');
        });
      },
      setRevealed(id: ID, revealed: boolean) {
        mutate((d) => {
          d.materials.find((m) => m.id === id)!.revealed = revealed;
        });
      },
      mark(materialId: ID, status: 'viewed' | 'skipped') {
        mutate((d) => {
          d.materialViews = d.materialViews.filter((v) => !(v.personId === me() && v.materialId === materialId));
          d.materialViews.push({ id: uid('mv'), personId: me(), materialId, status, at: nowISO() });
        });
      },
      unmark(materialId: ID) {
        mutate((d) => (d.materialViews = d.materialViews.filter((v) => !(v.personId === me() && v.materialId === materialId))));
      },
      decidePoints(id: ID, approve: boolean) {
        mutate((d) => {
          const m = d.materials.find((x) => x.id === id)!;
          m.pointsStatus = approve ? 'approved' : 'rejected';
          pushNotification(d, [m.uploaderId], approve ? 'approval_approved' : 'approval_rejected', `${approve ? 'اعتُمدت' : 'رُفضت'} نقاط مادة "${m.title}"`, '/app/library');
        });
      },
    },

    // ───────────── المالية ─────────────
    finance: {
      /** معالج الميزانية: أول إعداد من المسؤول المالي */
      setupBudget(pb: ProgramBudget) {
        mutate((d) => {
          ownerOnly(d, me());
          d.programBudget = { ...pb, setupDone: true, setupAt: d.programBudget.setupAt ?? nowISO() };
          audit(d, me(), pb.setupDone ? 'تعديل الميزانية' : 'إعداد الميزانية', 'حُفظت مبالغ المرصود لكل نوع');
        });
      },
      setSpendable(kinds: SpendKind[]) {
        mutate((d) => {
          ownerOnly(d, me());
          d.settings.spendableTypes = kinds;
          audit(d, me(), 'تعديل أنواع الصرف المسموح', kinds.map((k) => spendKindLabel[k]).join('، '));
        });
      },
      /** تفويض صلاحية لعضو في اللجنة المالية أو سحبها */
      setPermission(personId: ID, perm: FinancePermission, on: boolean) {
        mutate((d) => {
          ownerOnly(d, me());
          const cid = d.committees.find((c) => c.kind === 'finance')!.id;
          const m = d.memberships.find((x) => x.committeeId === cid && x.personId === personId);
          if (!m) throw new Error('الشخص ليس عضواً في اللجنة المالية');
          const set = new Set(m.financePerms ?? []);
          if (on) set.add(perm); else set.delete(perm);
          m.financePerms = [...set];
          m.canSeeFinance = set.has('view_budget');
          const label = FINANCE_PERMS.find((x) => x.key === perm)!.label;
          audit(d, me(), on ? 'منح صلاحية' : 'سحب صلاحية', `${label} — ${personName(d, personId)}`);
          pushNotification(d, [personId], 'general', `${on ? 'مُنحت' : 'سُحبت'} صلاحية «${label}» في اللجنة المالية`, '/app/finance');
        });
      },
      saveCategory(c: BudgetCategory) {
        mutate((d) => {
          guard(d, me(), 'manage_categories');
          const i = d.budgetCategories.findIndex((x) => x.id === c.id);
          if (i >= 0) d.budgetCategories[i] = c;
          else d.budgetCategories.push(c);
        });
      },
      removeCategory(id: ID) {
        mutate((d) => {
          guard(d, me(), 'manage_categories');
          const used = d.invoices.some((i) => i.lines.some((l) => l.categoryId === id)) || d.budgetRequests.some((r) => r.lines.some((l) => l.categoryId === id));
          if (used) throw new Error('لا يُحذف تصنيف عليه فواتير أو موازنات. أخفِه بدلاً من حذفه.');
          d.budgetCategories = d.budgetCategories.filter((x) => x.id !== id);
        });
      },

      // ── طلبات الميزانية ──
      submitRequest(input: { ownerKind: BudgetRequest['ownerKind']; ownerId: ID; amount: number; lines: BudgetLine[]; detailed: boolean; note?: string }) {
        mutate((d) => submitRequestIn(d, me(), input));
      },
      financeDecide(requestId: ID, approve: boolean, reason?: string) {
        mutate((d) => {
          guard(d, me(), 'approve_within');
          const r = findRequest(d, requestId);
          if (r.status !== 'pending_finance') throw new Error('الطلب ليس بانتظار مسؤول المالية');
          if (r.requestedBy === me()) throw new Error('لا يعتمد صاحب الطلب طلبه بنفسه');
          if (!approve && !reason?.trim()) throw new Error('اكتب سبب الرفض ليعرف مقدّم الطلب ما يعدّله');
          r.status = approve ? 'approved' : 'rejected';
          r.history.push({ at: nowISO(), byId: me(), action: approve ? 'finance_approve' : 'finance_reject', note: reason });
          audit(d, me(), approve ? 'موافقة على طلب ميزانية' : 'رفض طلب ميزانية', `${ownerTitle(d, r.ownerKind, r.ownerId)} — ${r.amount} ر.س${reason ? ` — ${reason}` : ''}`);
          pushNotification(d, [r.requestedBy], approve ? 'approval_approved' : 'approval_rejected', approve ? `وافقت المالية على ميزانية ${ownerTitle(d, r.ownerKind, r.ownerId)}` : `رُفض طلب ميزانية ${ownerTitle(d, r.ownerKind, r.ownerId)}: ${reason}`, ownerLink(r.ownerKind, r.ownerId));
        });
      },
      /** القائد العام (لما يتجاوز المرصود): يعتمد، أو يرفض، أو يطلب موازنة تفصيلية. ولا يصرف */
      leaderDecide(requestId: ID, decision: 'approve' | 'reject' | 'detail', reason?: string) {
        mutate((d) => {
          if (!d.persons.find((p) => p.id === me())?.isGeneralLeader) throw new Error('هذا القرار للقائد العام فقط');
          const r = findRequest(d, requestId);
          if (r.status !== 'pending_leader') throw new Error('الطلب ليس بانتظار القائد العام');
          if (decision !== 'approve' && !reason?.trim()) throw new Error('اكتب السبب أو المطلوب');
          r.status = decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : 'needs_detail';
          r.history.push({ at: nowISO(), byId: me(), action: decision === 'approve' ? 'leader_approve' : decision === 'reject' ? 'leader_reject' : 'leader_request_detail', note: reason });
          audit(d, me(), { approve: 'اعتماد تجاوز المرصود', reject: 'رفض تجاوز المرصود', detail: 'طلب موازنة تفصيلية' }[decision], `${ownerTitle(d, r.ownerKind, r.ownerId)} — ${r.amount} ر.س (المرصود ${r.allocated})`);
          const t = ownerTitle(d, r.ownerKind, r.ownerId);
          if (decision === 'approve') {
            pushNotification(d, [r.requestedBy], 'approval_approved', `اعتمد القائد العام ميزانية ${t}`, ownerLink(r.ownerKind, r.ownerId));
            pushNotification(d, [financeOwnerId(d)!], 'custody_issued', `اعتمد القائد العام ميزانية ${t}: اصرف العهدة`, '/app/finance');
          } else pushNotification(d, [r.requestedBy], 'approval_rejected', decision === 'reject' ? `رفض القائد العام ميزانية ${t}: ${reason}` : `طلب القائد العام موازنة تفصيلية لـ ${t}: ${reason}`, ownerLink(r.ownerKind, r.ownerId));
        });
      },
      /** صرف العهدة بعد اعتماد الطلب. ممنوع خارج أنواع الصرف المسموح */
      disburse(requestId: ID, input: { recipientId: ID; installments: { amount: number; dueDate: string; condition?: string }[] }) {
        mutate((d) => {
          guard(d, me(), 'disburse');
          const r = findRequest(d, requestId);
          assertSpendable(d, r.spendKind);
          if (r.status !== 'approved') throw new Error('لا تُصرف العهدة إلا بعد اعتماد الطلب');
          if (d.custodies.some((c) => c.requestId === r.id)) throw new Error('صُرفت عهدة هذا الطلب مسبقاً');
          createCustodyIn(d, { ownerKind: r.ownerKind, ownerId: r.ownerId, requestId: r.id, ...input });
          r.history.push({ at: nowISO(), byId: me(), action: 'disbursed' });
          audit(d, me(), 'صرف عهدة', `${ownerTitle(d, r.ownerKind, r.ownerId)} — ${input.installments.reduce((s, i) => s + i.amount, 0)} ر.س لـ ${personName(d, input.recipientId)} (${input.installments.length} دفعات)`);
        });
      },
      /** صرف مباشر بلا طلب (للاجتماعات مثلاً): يمر بنفس قاعدة الصرف المسموح */
      disburseDirect(ownerKind: BudgetRequest['ownerKind'], ownerId: ID, input: { recipientId: ID; installments: { amount: number; dueDate: string; condition?: string }[] }) {
        mutate((d) => {
          guard(d, me(), 'disburse');
          assertSpendable(d, spendKindOf(d, ownerKind, ownerId));
          createCustodyIn(d, { ownerKind, ownerId, ...input });
          audit(d, me(), 'صرف عهدة مباشرة', `${ownerTitle(d, ownerKind, ownerId)} — ${input.installments.reduce((s, i) => s + i.amount, 0)} ر.س`);
        });
      },
      setMeetingAllocation(meetingId: ID, amount: number) {
        mutate((d) => {
          ownerOnly(d, me());
          d.meetings.find((m) => m.id === meetingId)!.allocated = amount;
          audit(d, me(), 'مرصود اجتماع', `${d.meetings.find((m) => m.id === meetingId)!.title} — ${amount} ر.س (للتخطيط)`);
        });
      },
      submitIban(custodyId: ID, iban: string) {
        mutate((d) => {
          const c = d.custodies.find((x) => x.id === custodyId)!;
          c.iban = iban;
          c.installments.forEach((i) => i.status === 'awaiting_iban' && (i.status = 'awaiting_transfer'));
          pushNotification(d, financeIdsWith(d, 'disburse'), 'custody_issued', 'رُفع الآيبان: العهدة جاهزة للتحويل', '/app/finance?tab=custody');
        });
      },
      transfer(custodyId: ID, installmentId: ID, receipt: string) {
        mutate((d) => {
          guard(d, me(), 'disburse');
          const c = d.custodies.find((x) => x.id === custodyId)!;
          const i = c.installments.find((x) => x.id === installmentId)!;
          Object.assign(i, { status: 'awaiting_confirm', transferReceipt: receipt, transferredAt: nowISO() } satisfies Partial<Installment>);
          audit(d, me(), 'تحويل دفعة', `${ownerTitle(d, c.ownerKind, c.ownerId)} — ${i.amount} ر.س إلى ${personName(d, c.recipientId)}`);
          pushNotification(d, [c.recipientId], 'custody_issued', `حُوّلت دفعة ${i.amount} ر.س: أكّد الاستلام`, '/app/requests');
        });
      },
      releaseInstallment(custodyId: ID, installmentId: ID) {
        mutate((d) => {
          guard(d, me(), 'disburse');
          const c = d.custodies.find((x) => x.id === custodyId)!;
          const i = c.installments.find((x) => x.id === installmentId)!;
          i.status = c.iban ? 'awaiting_transfer' : 'awaiting_iban';
        });
      },
      confirmReceipt(custodyId: ID, installmentId: ID) {
        mutate((d) => {
          const c = d.custodies.find((x) => x.id === custodyId)!;
          if (c.recipientId !== me()) throw new Error('تأكيد الاستلام لمستلم العهدة فقط');
          const i = c.installments.find((x) => x.id === installmentId)!;
          i.status = 'received';
          i.confirmedAt = nowISO();
          if (c.status === 'setup') c.status = 'active'; // المستلم يؤكد الاستلام فتتفعل العهدة
        });
      },
      addInvoice(custodyId: ID, inv: { total: number; lines: InvoiceLine[]; image: string }) {
        mutate((d) => {
          const err = invoiceError(inv.total, inv.lines, inv.image);
          if (err) throw new Error(err);
          d.invoices.push({ id: uid('iv'), custodyId, ...inv, uploadedBy: me(), status: 'pending', at: nowISO() });
          pushNotification(d, financeIdsWith(d, 'review_invoices'), 'general', 'فاتورة جديدة بانتظار المراجعة', '/app/finance?tab=invoices');
        });
      },
      updateInvoice(invoiceId: ID, inv: { total: number; lines: InvoiceLine[]; image: string }) {
        mutate((d) => {
          const err = invoiceError(inv.total, inv.lines, inv.image);
          if (err) throw new Error(err);
          const i = d.invoices.find((x) => x.id === invoiceId)!;
          Object.assign(i, inv, { status: 'pending', rejectReason: undefined, at: nowISO() });
        });
      },
      reviewInvoice(invoiceId: ID, accept: boolean, reason?: string) {
        mutate((d) => {
          guard(d, me(), 'review_invoices');
          if (!accept && !reason?.trim()) throw new Error('اكتب سبب الرفض ليعرف المستلم ما يعدّله');
          const i = d.invoices.find((x) => x.id === invoiceId)!;
          i.status = accept ? 'accepted' : 'rejected';
          i.rejectReason = accept ? undefined : reason;
          const c = d.custodies.find((x) => x.id === i.custodyId)!;
          audit(d, me(), accept ? 'قبول فاتورة' : 'رفض فاتورة', `${ownerTitle(d, c.ownerKind, c.ownerId)} — ${i.total} ر.س${reason ? ` — ${reason}` : ''}`);
          if (!accept) pushNotification(d, [c.recipientId], 'invoice_rejected', `رُفضت فاتورة بقيمة ${i.total} ر.س: ${reason}`, '/app/requests');
        });
      },
      requestClose(custodyId: ID) {
        mutate((d) => {
          d.custodies.find((x) => x.id === custodyId)!.status = 'closing';
          pushNotification(d, financeIdsWith(d, 'close_custody'), 'general', 'طلب إغلاق عهدة', '/app/finance?tab=custody');
        });
      },
      refund(custodyId: ID, amount: number, receipt: string) {
        mutate((d) => (d.custodies.find((x) => x.id === custodyId)!.refund = { amount, receipt, at: nowISO() }));
      },
      requestOverspend(custodyId: ID, amount: number, reason: string) {
        mutate((d) => {
          d.custodies.find((x) => x.id === custodyId)!.overspend = { amount, reason };
          pushNotification(d, [financeOwnerId(d)!, leaderId(d)], 'general', 'طلب موافقة على مصروف زائد عن الموازنة', '/app/finance?tab=custody');
        });
      },
      approveOverspend(custodyId: ID, as: 'finance' | 'admin') {
        mutate((d) => {
          const c = d.custodies.find((x) => x.id === custodyId)!;
          if (!c.overspend) return false;
          if (as === 'finance') { guard(d, me(), 'close_custody'); c.overspend.financeApproved = true; }
          else {
            if (!d.persons.find((p) => p.id === me())?.isGeneralLeader) throw new Error('موافقة الإدارة للقائد العام');
            c.overspend.adminApproved = true;
          }
          audit(d, me(), 'موافقة على مصروف زائد', `${ownerTitle(d, c.ownerKind, c.ownerId)} — ${c.overspend.amount} ر.س`);
        });
      },
      closeCustody(custodyId: ID) {
        mutate((d) => {
          guard(d, me(), 'close_custody');
          const c = d.custodies.find((x) => x.id === custodyId)!;
          c.status = 'closed';
          c.closedAt = nowISO();
          audit(d, me(), 'إغلاق عهدة', `${ownerTitle(d, c.ownerKind, c.ownerId)} — ${c.total} ر.س`);
          d.tasks.filter((t) => t.tripId === c.ownerId && t.tag === 'custody_close').forEach((t) => Object.assign(t, { status: 'done', doneAt: nowISO() }));
        });
      },
      setFee(personId: ID, paid: boolean, note?: string) {
        mutate((d) => {
          ownerOnly(d, me());
          const f = d.fees.find((x) => x.personId === personId);
          if (f) Object.assign(f, { paid, paidAt: paid ? todayISO() : undefined, note });
          else d.fees.push({ personId, amount: d.settings.feeAmount, paid, paidAt: paid ? todayISO() : undefined, note });
        });
      },
    },

    // ───────────── الاجتماعات ─────────────
    meetings: {
      create(input: Omit<Meeting, 'id' | 'createdBy' | 'status' | 'attendeeIds' | 'decisions' | 'outputs' | 'createdAt'>): ID {
        const id = uid('mt');
        mutate((d) => {
          const c = d.persons.find((p) => p.id === me());
          const isLeaderOfGroup = d.groups.some((g) => g.leaderId === me());
          if (c?.kind !== 'staff' && !isLeaderOfGroup) throw new Error('إنشاء الاجتماعات لأعضاء الإدارة وقادة المجموعات');
          d.meetings.push({ ...input, id, createdBy: me(), status: 'planned', attendeeIds: [], decisions: [], outputs: [], createdAt: nowISO() });
          pushNotification(d, input.inviteeIds.filter((x) => x !== me()), 'meeting', `دعوة لاجتماع: ${input.title}`, `/app/meetings/${id}`);
        });
        return id;
      },
      update(id: ID, patch: Partial<Meeting>) {
        mutate((d) => {
          const m = findMeeting(d, id);
          if (m.ownerId !== me() && m.createdBy !== me()) throw new Error('التعديل لمسؤول الاجتماع');
          Object.assign(m, patch);
        });
      },
      markHeld(id: ID, attendeeIds: ID[]) {
        mutate((d) => {
          const m = findMeeting(d, id);
          if (m.ownerId !== me()) throw new Error('تسجيل الانعقاد لمسؤول الاجتماع');
          m.status = 'held';
          m.attendeeIds = attendeeIds;
        });
      },
      /** المحضر: ما دار، والقرارات، والمخرجات، ومهام تُنشأ وتُربط بالاجتماع */
      saveMinutes(id: ID, minutes: { discussion: string; decisions: string[]; outputs: string[]; tasks: { title: string; assigneeId: ID; dueDate: string }[] }) {
        mutate((d) => {
          const m = findMeeting(d, id);
          if (m.ownerId !== me()) throw new Error('كتابة المحضر لمسؤول الاجتماع فقط');
          Object.assign(m, { discussion: minutes.discussion, decisions: minutes.decisions, outputs: minutes.outputs, status: 'minutes' });
          minutes.tasks.forEach((t) => {
            d.tasks.push({ id: uid('tk'), title: t.title, scope: 'general', meetingId: id, assigneeId: t.assigneeId, createdBy: me(), dueDate: t.dueDate, status: 'new', proofType: 'none', createdAt: nowISO() });
            pushNotification(d, [t.assigneeId], 'task_assigned', `مهمة من اجتماع "${m.title}": ${t.title}`, '/app/tasks');
          });
          pushNotification(d, m.inviteeIds.filter((x) => x !== me()), 'meeting', `رُفع محضر اجتماع: ${m.title}`, `/app/meetings/${id}`);
        });
      },
      close(id: ID) {
        mutate((d) => {
          const m = findMeeting(d, id);
          if (m.ownerId !== me()) throw new Error('الإغلاق لمسؤول الاجتماع');
          m.status = 'closed';
          // الاجتماع الدوري: يُجدول الموعد التالي تلقائياً
          if (m.kind === 'periodic' && m.recurrence !== 'none') {
            const days = { weekly: 7, biweekly: 14, monthly: 30, none: 0 }[m.recurrence];
            d.meetings.push({ ...m, id: uid('mt'), date: addDays(m.date, days), status: 'planned', attendeeIds: [], decisions: [], outputs: [], discussion: undefined, createdAt: nowISO() });
          }
        });
      },
    },

    // ───────────── اللجان ─────────────
    committees: {
      create(c: Omit<Committee, 'id' | 'kpis'>) {
        mutate((d) => d.committees.push({ ...c, id: uid('c'), kpis: [] }));
      },
      saveKpi(committeeId: ID, kpi: CommitteeKPI) {
        mutate((d) => {
          const c = d.committees.find((x) => x.id === committeeId)!;
          const i = c.kpis.findIndex((k) => k.id === kpi.id);
          if (i >= 0) c.kpis[i] = kpi;
          else c.kpis.push(kpi);
        });
      },
      removeKpi(committeeId: ID, kpiId: ID) {
        mutate((d) => {
          const c = d.committees.find((x) => x.id === committeeId)!;
          c.kpis = c.kpis.filter((k) => k.id !== kpiId);
        });
      },
      addMember(committeeId: ID, personId: ID, role: 'leader' | 'member', canSeeFinance: boolean) {
        mutate((d) => {
          d.memberships = d.memberships.filter((m) => !(m.committeeId === committeeId && m.personId === personId));
          d.memberships.push({ id: uid('cm'), committeeId, personId, role, canSeeFinance });
          assertNoCapacityConflict(d, [personId]);
          audit(d, me(), 'إسناد صفة', `${role === 'leader' ? 'مسؤول' : 'عضو'} ${d.committees.find((c) => c.id === committeeId)?.name} — ${personName(d, personId)}`, 'roles');
        });
      },
      removeMember(committeeId: ID, personId: ID) {
        mutate((d) => (d.memberships = d.memberships.filter((m) => !(m.committeeId === committeeId && m.personId === personId))));
      },
      requestMember(committeeId: ID, personId: ID, note?: string) {
        mutate((d) => {
          d.memberRequests.push({ id: uid('mr'), committeeId, personId, requestedBy: me(), note, status: 'pending', at: nowISO() });
          pushNotification(d, [leaderId(d)], 'committee_member_request', `طلب إضافة ${d.persons.find((p) => p.id === personId)?.name} إلى ${d.committees.find((c) => c.id === committeeId)?.name}`, `/app/committees/${committeeId}`);
        });
      },
      decideRequest(requestId: ID, approve: boolean, role: 'leader' | 'member' = 'member', canSeeFinance = false) {
        mutate((d) => {
          const r = d.memberRequests.find((x) => x.id === requestId)! as MemberRequest;
          r.status = approve ? 'approved' : 'rejected';
          r.decidedAt = nowISO();
          if (approve) {
            d.memberships.push({ id: uid('cm'), committeeId: r.committeeId, personId: r.personId, role, canSeeFinance });
            assertNoCapacityConflict(d, [r.personId]);
            audit(d, me(), 'إسناد صفة', `${role === 'leader' ? 'مسؤول' : 'عضو'} ${d.committees.find((c) => c.id === r.committeeId)?.name} — ${personName(d, r.personId)}`, 'roles');
          }
          pushNotification(d, [r.requestedBy, ...(approve ? [r.personId] : [])], 'committee_member_request', `${approve ? 'وافق' : 'رفض'} القائد العام طلب إضافة العضو`, `/app/committees/${r.committeeId}`);
        });
      },
      sendChat(committeeId: ID, text: string) {
        mutate((d) => d.chat.push({ id: uid('ch'), committeeId, authorId: me(), text, at: nowISO() }));
      },
    },

    // ───────────── الإشعارات ─────────────
    notifications: {
      markRead(id: ID) {
        mutate((d) => {
          const n = d.notifications.find((x) => x.id === id);
          if (n) n.read = true;
        });
      },
      markAllRead() {
        mutate((d) => d.notifications.forEach((n) => n.toId === me() && (n.read = true)));
      },
    },

    // ───────────── النقاط اليدوية ─────────────
    points: {
      addManual(entry: Omit<PointsEntry, 'id' | 'at' | 'auto'>) {
        if (entry.points < 0) throw new Error('النقاط كسب فقط، لا خصم');
        mutate((d) => d.manualPoints.push({ ...entry, id: uid('pm'), at: nowISO(), auto: false }));
      },
    },

    // ───────────── الإعدادات ورابط المتابعة والموقع ─────────────
    settings: {
      update(patch: Partial<Settings>) {
        mutate((d) => Object.assign(d.settings, patch));
      },
      setTracker(personId: ID) {
        mutate((d) => {
          d.settings.trackerId = personId;
          assertNoCapacityConflict(d, [personId]);
          audit(d, me(), 'إسناد صفة', `متابع الرحلات الدائم — ${personName(d, personId)}`, 'roles');
          pushNotification(d, [personId], 'general', 'عُيّنت متابعاً للرحلات', '/app/tracker');
        });
      },
      generateTrackingLink() {
        mutate((d) => (d.settings.trackingLink = { token: Math.random().toString(36).slice(2, 12), active: true, createdAt: nowISO() }));
      },
      revokeTrackingLink() {
        mutate((d) => (d.settings.trackingLink = { ...d.settings.trackingLink, active: false }));
      },
      addTrackingComment(name: string, text: string) {
        mutate((d) => d.trackingComments.push({ id: uid('tc'), name: name || 'زائر', text, at: nowISO(), status: d.settings.trackingCommentsNeedReview ? 'pending' : 'visible' }));
      },
      moderateTrackingComment(id: ID, status: 'visible' | 'hidden') {
        mutate((d) => (d.trackingComments.find((c) => c.id === id)!.status = status));
      },
    },
  };
}

export type Repositories = ReturnType<typeof createLocalRepositories>;

// أدوات مساعدة تُستخدم في الشاشات
export { effectiveTrackerId, addDays };
