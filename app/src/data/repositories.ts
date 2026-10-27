// طبقة الوصول للبيانات (Repositories).
// الشاشات لا تعدّل قاعدة البيانات مباشرة، بل تستدعي هذه الواجهات فقط.
// لتحويل النموذج إلى منصة حقيقية: نكتب تنفيذاً آخر لنفس الواجهة يتصل بالخادم.
import { addDays, nowISO, todayISO } from '@/domain/dates';
import { uid } from '@/domain/id';
import { canManageCommittee, canManageFocus, canSeeCommittee, groupOf, groupsPublished, meetingCreateBlock, tripFacilitatorId, tripTeamIds, tripTeamLeaderId, effectiveTrackerId } from '@/domain/permissions';
import { ACCESS_DENIED, meetingVisibleTo, routeAccess } from '@/domain/access';
import { canManageAccounts, passwordError, suggestUsername, usernameError } from '@/domain/accounts';
import { assertNoCapacityConflict, substituteConflict } from '@/domain/capacities';
import { hasTempGrant, tempPermissionLabel } from '@/domain/grants';
import { findSupporterByPassword, supporterLocked } from '@/domain/supporter';
import { canEditEvaluation, canUnlockEvaluation, evaluationKeyLabel, evaluationSettingsError, isEvaluationKey, settingsKeyBlockReason, type EvaluationKey, type EvaluationSettings } from '@/domain/settings';
import { hashPassword, tempPassword } from '@/domain/crypto';
import { applyDocAction, canPublish, docFor, focusDone, focusIsPast, tasksFromTemplates, tripCloseBlock, type DocAction } from '@/domain/workflow';
import type {
  AvailabilitySlot, BudgetCategory, BudgetLine, Comment, Committee, CommitteeKPI, Custody, DB, FocusMeeting, ID, IndividualMeeting,
  LifeAspect, Material, MemberRequest, NotificationType, PointsEntry, ProgramEvent, SchedulePlan, Settings,
  Attendance, StepFollowUp, Survey, Task, TaskTemplate, Trip, TripDoc, TripExecutor, TripSession, TripType,
} from '@/domain/types';
import { docKindLabel } from '@/domain/labels';
import {
  allocatedFor, DIRECT_CUSTODY_KINDS, FINANCE_PERMS, financePermsOf, firstStatusFor, hasFinancePerm, isFinanceOwner, isLeaderId, linesTotal, meetingBudgetReady, ownerLink, ownerTitle,
  spendKindLabel, spendKindOf, submitterOf, tripBudgetFacilitatorId,
} from '@/domain/finance';
import { attachmentError, custodyCloseChecks, custodyFigures, formDuplicateWarnings, insufficientFunds, openCustodyConflict, splitWarning } from '@/domain/ledger';
import type {
  Attachment, AuditEntry, BudgetRequest, DirectSpend, SupporterEntity, EditRequest, EditTarget, FeeStatus, FinancePermission, Meeting, Person, ProgramBudget, ProofKind, SpendForm, TempPermission, WalletEntry,
} from '@/domain/types';

/** إن أعادت الوصفة false فلا تغيير يُحفظ */
export type Mutate = (recipe: (draft: DB) => unknown) => void;

/** إضافة إشعار داخل المنصة (الإيميل مؤجّل: importantNotifications جاهزة لتحديد ما يصل به لاحقاً) */
export function pushNotification(d: DB, toIds: ID[], type: NotificationType, title: string, link?: string, body?: string) {
  [...new Set(toIds)].filter(Boolean).forEach((toId) =>
    d.notifications.unshift({ id: uid('nt'), toId, type, title, body, link, at: nowISO(), read: false }),
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
  deadlines: Trip['deadlines'];
}

function personName(d: DB, id: ID) {
  return d.persons.find((p) => p.id === id)?.name ?? '—';
}
/** سجل تدقيق لا يُحذف. المجال الافتراضي المالية */
function audit(d: DB, byId: ID, action: string, detail: string, area: AuditEntry['area'] = 'finance') {
  d.audit.unshift({ id: uid('au'), at: nowISO(), byId, action, detail, area });
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
function findCustody(d: DB, id: ID) {
  const c = d.custodies.find((x) => x.id === id);
  if (!c) throw new Error('العهدة غير موجودة');
  return c;
}
function findForm(d: DB, id: ID) {
  const f = d.spendForms.find((x) => x.id === id);
  if (!f) throw new Error('نموذج الصرف غير موجود');
  return f;
}
function findMeeting(d: DB, id: ID) {
  const m = d.meetings.find((x) => x.id === id);
  if (!m) throw new Error('الاجتماع غير موجود');
  return m;
}
/** فتح عهدة بأول تحويل من المحفظة (يعبّئ رصيد المستلم). يمر بقاعدة العهد المتزامنة والرصيد الفعلي والإثبات */
function openCustodyIn(d: DB, by: ID, input: { ownerKind: Custody['ownerKind']; ownerId: ID; requestId?: ID; recipientId: ID; approved: number; amount: number; attachment: Attachment }) {
  if (!(input.approved > 0)) throw new Error('حدد مبلغ العهدة المعتمد');
  if (!(input.amount > 0) || input.amount > input.approved + 0.009) throw new Error('مبلغ التحويل الأول بين صفر والمبلغ المعتمد');
  const spendKind = spendKindOf(d, input.ownerKind, input.ownerId);
  const conflict = openCustodyConflict(d, input.recipientId, spendKind);
  if (conflict) throw new Error(conflict);
  const c: Custody = {
    id: uid('cu'), requestId: input.requestId, ownerKind: input.ownerKind, ownerId: input.ownerId, spendKind, recipientId: input.recipientId,
    approved: input.approved, transfers: [], status: 'active', createdAt: nowISO(), createdBy: by,
  };
  d.custodies.push(c);
  transferIn(d, by, c, input.amount, input.attachment);
  pushNotification(d, [input.recipientId], 'custody_issued', `حُوّلت لك عهدة ${ownerTitle(d, c.ownerKind, c.ownerId)} (${input.amount} ر.س)`, '/app/requests');
  return c;
}
/** تحويل للعهدة من رصيد مسؤول المالية الفعلي، بإيصال إلزامي */
function transferIn(d: DB, by: ID, c: Custody, amount: number, attachment: Attachment) {
  const err = attachmentError(attachment, 'إيصال التحويل') ?? insufficientFunds(d, amount);
  if (err) throw new Error(err);
  const e = walletOut(d, by, 'custody_transfer', amount, attachment, { custodyId: c.id });
  c.transfers.push({ id: uid('ct'), amount, at: nowISO(), byId: by, walletEntryId: e.id });
}
function walletOut(d: DB, by: ID, kind: WalletEntry['kind'], amount: number, attachment: Attachment, ref?: WalletEntry['ref'], note?: string) {
  const e: WalletEntry = { id: uid('we'), kind, amount: Math.round(amount * 100) / 100, at: nowISO(), byId: by, attachment, ref, note };
  d.wallet.push(e);
  return e;
}
/** سطر صرف صالح: تصنيف من القائمة أو «غير موجود» باسم، وبند مكتوب، ومبلغ */
function lineError(l: { categoryId?: ID; customCategory?: string; item: string; amount: number }, d: DB): string | null {
  if (!l.categoryId && !l.customCategory?.trim()) return 'اختر تصنيفاً لكل بند، أو «غير موجود» واكتب اسمه';
  if (l.categoryId && !d.budgetCategories.some((c) => c.id === l.categoryId)) return 'التصنيف غير موجود';
  if (!l.item.trim()) return 'اكتب شرح كل بند';
  if (!(l.amount > 0)) return 'اكتب مبلغ كل بند';
  return null;
}
function proofError(p: { vendor: string; invoiceDate: string; attachment: Attachment }, what: string): string | null {
  return attachmentError(p.attachment, what) ?? (!p.vendor.trim() ? 'اكتب اسم المورد' : !p.invoiceDate ? 'حدد تاريخ الفاتورة' : null);
}
/** تقديم طلب ميزانية أو إعادة تقديمه. يُستخدم من الشاشات ومن إنشاء لقاء التركيز */
function submitRequestIn(d: DB, pid: ID, input: { ownerKind: BudgetRequest['ownerKind']; ownerId: ID; amount: number; lines: BudgetLine[]; detailed: boolean; note?: string }) {
  if (!d.programBudget.setupDone) throw new Error('لم يُعدّ مسؤول المالية الموازنة العامة بعد. أرسل الطلب بعد إعدادها.');
  if (input.ownerKind === 'need') throw new Error('احتياجات البرنامج تُصرف مباشرة أو بعهدة يفتحها مسؤول المالية');
  const spendKind = spendKindOf(d, input.ownerKind, input.ownerId);
  if (submitterOf(d, input.ownerKind, input.ownerId) !== pid)
    throw new Error(input.ownerKind === 'focus' ? 'طلب ميزانية لقاء التركيز للميسّر فقط' : input.ownerKind === 'trip' ? 'ميزانية الرحلة يرفعها قائد الفريق فقط' : 'طلب ميزانية الاجتماع لمسؤوله');
  if (input.ownerKind === 'focus' && allocatedFor(d, 'focus', input.ownerId) === 0) throw new Error(`هذا اللقاء بعد الحد الأعلى (${d.programBudget.focusLimits.max}) للقاءات بميزانية، فلا يُطلب له ميزانية.`);
  if (input.ownerKind === 'trip') {
    if (!input.lines.length) throw new Error('الرحلات تُقدَّم دائماً بموازنة تفصيلية: أضف بنود الموازنة');
    const block = tripBudgetBlock(d, input.ownerId);
    if (block) throw new Error(block);
  }
  const detailed = input.detailed || input.lines.length > 0;
  const amount = detailed ? linesTotal(input.lines) : input.amount;
  if (!(amount > 0)) throw new Error('اكتب المبلغ المطلوب');
  const allocated = allocatedFor(d, input.ownerKind, input.ownerId);
  const existing = [...d.budgetRequests].reverse().find((r) => r.ownerKind === input.ownerKind && r.ownerId === input.ownerId);
  if (existing && !['draft', 'rejected', 'needs_detail'].includes(existing.status)) throw new Error('يوجد طلب قائم لهذا العنصر');
  // بعد طلب القائد العام موازنة تفصيلية يعود الطلب إليه مباشرة
  const status = existing?.status === 'needs_detail' ? 'pending_leader' : firstStatusFor(d, input.ownerKind, input.ownerId, amount, allocated);
  const r: BudgetRequest = existing ?? { id: uid('br'), ownerKind: input.ownerKind, ownerId: input.ownerId, spendKind, requestedBy: pid, amount, allocated, detailed, lines: [], status, history: [] };
  Object.assign(r, { amount, allocated, detailed, lines: input.lines, note: input.note, status, submittedAt: r.submittedAt ?? nowISO() });
  r.history.push({ at: nowISO(), byId: pid, action: existing?.status === 'needs_detail' ? 'detail_submitted' : 'submit', note: input.note });
  if (!existing) d.budgetRequests.push(r);
  const t = ownerTitle(d, r.ownerKind, r.ownerId);
  const over = amount > allocated ? ` — يتجاوز المرصود (${allocated} ر.س)` : '';
  if (status === 'pending_facilitator') pushNotification(d, [tripBudgetFacilitatorId(d, r.ownerId)!], 'budget_request', `ميزانية رحلة بانتظار اعتمادك: ${t} (${amount} ر.س)`, ownerLink(r.ownerKind, r.ownerId));
  else if (status === 'pending_finance') pushNotification(d, financeIdsWith(d, 'approve_within').filter((x) => x !== pid), 'budget_request', `طلب ميزانية ضمن المرصود: ${t} (${amount} ر.س)`, '/app/finance?tab=requests');
  else pushNotification(d, [leaderId(d)], 'budget_request', `طلب ميزانية بانتظار قرارك: ${t} (${amount} ر.س)${over}`, '/app/approvals');
}
/** شروط رفع نماذج الرحلة: تخطيط رحلات المجموعات بعد نشر التشكيل، والوثيقة أول ما يُرفع */
function tripFormBlock(d: DB, trip: Trip, kind: TripDoc['kind'] | 'budget'): string | null {
  if (trip.executor.kind === 'group' && !groupsPublished(d)) return 'تخطيط رحلات المجموعات يبدأ بعد نشر التشكيل';
  if (kind === 'final_report') return null;
  if (kind !== 'document' && !docFor(d, trip.id, 'document')?.submittedAt) return 'ارفع وثيقة الرحلة أولاً: هي أول ما يُرفع';
  return null;
}
export function programPostBlock(d: DB): string | null {
  const last = [...d.trips].filter((t) => t.type === 'external').sort((a, b) => b.endDate.localeCompare(a.endDate))[0];
  if (!last) return null;
  return d.surveys.some((x) => x.context.kind === 'trip' && x.context.id === last.id) ? null : `الاستبيان العام البعدي يُنشأ بعد تسجيل استبيان آخر رحلة خارجية (${last.title})`;
}
function tripBudgetBlock(d: DB, tripId: ID): string | null {
  return tripFormBlock(d, findTrip(d, tripId), 'budget');
}
/** تطبيق طلب تعديل سجل معتمد بعد موافقة القائد العام */
function applyEditIn(d: DB, er: EditRequest) {
  const t = er.target;
  const p = er.patch as { amount?: number; categoryId?: ID; note?: string; budget?: ProgramBudget };
  if (t.kind === 'spend_line') {
    const line = d.spendForms.find((f) => f.id === t.formId)?.lines.find((l) => l.id === t.lineId);
    if (!line) throw new Error('البند غير موجود');
    if (p.amount != null) line.amount = p.amount;
    if (p.categoryId) Object.assign(line, { categoryId: p.categoryId, customCategory: undefined });
  } else if (t.kind === 'direct_spend') {
    const ds = d.directSpends.find((x) => x.id === t.id);
    if (!ds) throw new Error('الصرف المباشر غير موجود');
    if (p.categoryId) ds.lines.forEach((l) => Object.assign(l, { categoryId: p.categoryId, customCategory: undefined }));
    if (p.amount != null) {
      if (ds.lines.length !== 1 || ds.allocations.length !== 1) throw new Error('تعديل مبلغ صرف موزّع أو متعدد البنود غير متاح: اعكسه بصرف جديد');
      const delta = p.amount - ds.total;
      if (delta > 0) { const err = insufficientFunds(d, delta); if (err) throw new Error(err); }
      ds.lines[0].amount = ds.allocations[0].amount = ds.total = p.amount;
      const we = d.wallet.find((e) => e.id === ds.walletEntryId);
      if (we) we.amount = p.amount;
    }
  } else if (t.kind === 'deposit') {
    const e = d.wallet.find((x) => x.id === t.id && x.kind === 'deposit');
    if (!e) throw new Error('الإيداع غير موجود');
    if (p.amount != null) e.amount = p.amount;
    if (p.note != null) e.note = p.note;
  } else if (t.kind === 'program_budget') {
    if (!p.budget) throw new Error('لا موازنة جديدة في الطلب');
    d.programBudget = { ...p.budget, setupDone: true, setupAt: d.programBudget.setupAt };
  }
}

export function createLocalRepositories(mutate: Mutate, me: () => ID, read: () => DB) {
  /** يرفض بنفس الرسالة الممنوع وغير الموجود */
  const deny = () => {
    throw new Error(ACCESS_DENIED);
  };
  const canSeeCommitteeIn = (d: DB, committeeId: ID) => d.committees.some((c) => c.id === committeeId) && canSeeCommittee(d, me(), committeeId);
  const manageCommitteeIn = (d: DB, committeeId: ID) => {
    if (!canSeeCommitteeIn(d, committeeId) || !canManageCommittee(d, me(), committeeId)) deny();
  };
  return {
    // ───────────── الوصول: نفس الفحص الذي يستخدمه التوجيه، وقراءات تُرفض لمن لا يملك الصلاحية ─────────────
    access: {
      canOpen(pathname: string, search = '') {
        return routeAccess(read(), me(), pathname, search);
      },
      committee(id: ID) {
        const d = read();
        return canSeeCommitteeIn(d, id) ? d.committees.find((c) => c.id === id)! : deny();
      },
      person(id: ID) {
        const d = read();
        return routeAccess(d, me(), `/app/people/${id}`) ? d.persons.find((p) => p.id === id)! : deny();
      },
      meeting(id: ID) {
        const d = read();
        return meetingVisibleTo(d, me(), id) ? d.meetings.find((m) => m.id === id)! : deny();
      },
    },
    // ───────────── الأشخاص والمجموعات ─────────────
    people: {
      /** القائد العام ينشئ الشخص ويحدد نوعه، ثم يدير مسؤول اللجنة التقنية حساب دخوله */
      create(input: Omit<Person, 'id' | 'isGeneralLeader'>): ID {
        const id = uid(input.kind === 'staff' ? 's' : 'u');
        mutate((d) => {
          if (input.kind === 'staff' ? !isLeaderId(d, me()) : !hasTempGrant(d, me(), 'register_participants'))
            throw new Error(input.kind === 'staff' ? 'إضافة فريق العمل للقائد العام' : 'تسجيل المشاركين للقائد العام أو من يمنحه صلاحية مؤقتة');
          if (!input.name.trim()) throw new Error('الاسم مطلوب');
          if (!/^\S+@\S+\.\S+$/.test(input.email.trim())) throw new Error('البريد غير صحيح');
          if (d.persons.some((p) => p.email.toLowerCase() === input.email.trim().toLowerCase())) throw new Error('البريد مسجّل لشخص آخر');
          d.persons.push({ ...input, id, name: input.name.trim(), email: input.email.trim() });
          d.accounts.push({ personId: id, username: suggestUsername(d, input.email), mustChangePassword: true, disabled: false, updatedAt: nowISO(), updatedBy: me() });
          audit(d, me(), input.kind === 'staff' ? 'إضافة عضو فريق عمل' : 'تسجيل مشارك', input.name, 'roles');
          const tech = d.memberships.find((m) => m.role === 'leader' && d.committees.find((c) => c.id === m.committeeId)?.kind === 'tech')?.personId;
          if (tech) pushNotification(d, [tech], 'general', `حساب جديد بلا كلمة مرور: ${input.name}`, '/app/people');
        });
        return id;
      },
    },
    // ───────────── الصلاحيات المؤقتة (يمنحها القائد العام) ─────────────
    grants: {
      grant(personId: ID, permission: TempPermission, expiresAt: string) {
        mutate((d) => {
          if (!isLeaderId(d, me())) throw new Error('الصلاحيات المؤقتة يمنحها القائد العام');
          if (!expiresAt || expiresAt < todayISO()) throw new Error('حدد تاريخ انتهاء من اليوم فصاعداً');
          d.tempGrants.push({ id: uid('gr'), personId, permission, grantedBy: me(), at: nowISO(), expiresAt });
          audit(d, me(), 'منح صلاحية مؤقتة', `${tempPermissionLabel[permission]} — ${personName(d, personId)} حتى ${expiresAt}`, 'roles');
          pushNotification(d, [personId], 'general', `مُنحت صلاحية مؤقتة: ${tempPermissionLabel[permission]} حتى ${expiresAt}`);
        });
      },
      revoke(grantId: ID) {
        mutate((d) => {
          if (!isLeaderId(d, me())) throw new Error('سحب الصلاحيات للقائد العام');
          const g = d.tempGrants.find((x) => x.id === grantId);
          if (!g || g.revokedAt) return false;
          g.revokedAt = nowISO();
          audit(d, me(), 'سحب صلاحية مؤقتة', `${tempPermissionLabel[g.permission]} — ${personName(d, g.personId)}`, 'roles');
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
          pushNotification(d, [leaderId(d)], 'general', 'رسالة جديدة من مشارك', '/app/messages');
        });
      },
      reply(id: ID, text: string) {
        mutate((d) => {
          const m = d.adminMessages.find((x) => x.id === id)!;
          m.reply = { byId: me(), text, at: nowISO() };
          pushNotification(d, [m.fromId], 'general', 'ردّت الإدارة على رسالتك', '/app/messages');
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
            schedule: { plans: [{ id: uid('pl'), name: 'الخطة أ', items: [] }, { id: uid('pl'), name: 'الخطة ب', items: [] }] },
            scheduleVisibility: 'hidden', sessions: [], guests: [],
            coordinations: input.type === 'external'
              ? (['transport', 'food', 'housing', 'hosting'] as const).map((key) => ({ key, status: 'pending' as const }))
              : (['transport', 'food', 'hosting'] as const).map((key) => ({ key, status: 'pending' as const })),
            closure: { photos: [] }, evaluation: { staffRatings: {}, finance: {} },
          };
          d.trips.push(trip);
          if (trip.executor.kind === 'staff') assertNoCapacityConflict(d, [trip.executor.leaderId, ...trip.executor.memberIds]);
          (['document', 'schedule'] as const).forEach((kind) => d.docs.push({ id: uid('doc'), tripId: id, kind, status: 'draft', version: 1, fields: {}, history: [] }));
          d.tasks.push(...tasksFromTemplates(d, trip, me()));
          const team = tripTeamIds(d, trip);
          pushNotification(d, team, 'general', `أُسندت إليكم رحلة جديدة: ${trip.title}`, `/app/trips/${id}`);
          // تظهر الرحلة في تقويم الجميع منذ إدراجها
          pushNotification(d, [...allParticipants(d), ...staffIds(d)].filter((x) => !team.includes(x)), 'general', `أُدرجت رحلة في التقويم: ${trip.title}`, `/app/calendar`);
        });
        return id;
      },
      /** الرحلة الخارجية المزدوجة: وجهة واحدة لمجموعتين متتاليتين، نهاية الأولى بداية الثانية، ولكل منهما رحلتها المستقلة */
      createDouble(input: Omit<CreateTripInput, 'executor' | 'endDate'> & { groupIds: [ID, ID]; splitDate: string; endDate: string }): [ID, ID] {
        if (!isLeaderId(read(), me())) throw new Error('إنشاء الرحلات للقائد العام');
        if (input.type !== 'external') throw new Error('الرحلة المزدوجة خارجية فقط');
        if (input.groupIds[0] === input.groupIds[1]) throw new Error('اختر مجموعتين مختلفتين');
        if (!(input.startDate < input.splitDate && input.splitDate < input.endDate)) throw new Error('موعد التبديل بين البداية والنهاية');
        const g = (id: ID) => read().groups.find((x) => x.id === id)?.name ?? '';
        const a = this.create({ ...input, title: `${input.title} — ${g(input.groupIds[0])} (الجزء الأول)`, executor: { kind: 'group', groupId: input.groupIds[0] }, endDate: input.splitDate });
        const b = this.create({ ...input, title: `${input.title} — ${g(input.groupIds[1])} (الجزء الثاني)`, executor: { kind: 'group', groupId: input.groupIds[1] }, startDate: input.splitDate, endDate: input.endDate,
          deadlines: { document: addDays(input.splitDate, -read().settings.deadlineDefaults.documentDaysBefore), schedule: addDays(input.splitDate, -read().settings.deadlineDefaults.scheduleDaysBefore), budget: addDays(input.splitDate, -read().settings.deadlineDefaults.budgetDaysBefore) } });
        mutate((d) => {
          findTrip(d, a).pair = { tripId: b, part: 1 };
          findTrip(d, b).pair = { tripId: a, part: 2 };
        });
        return [a, b];
      },
      update(tripId: ID, patch: Partial<Trip>) {
        mutate((d) => {
          const t = findTrip(d, tripId);
          const dateChanged = patch.startDate && patch.startDate !== t.startDate;
          Object.assign(t, patch);
          // المزدوجة: نهاية الأولى بداية الثانية، وتتحدث تلقائياً
          if (t.pair) {
            const other = d.trips.find((x) => x.id === t.pair!.tripId);
            if (other && t.pair.part === 1 && patch.endDate) other.startDate = t.endDate;
            if (other && t.pair.part === 2 && patch.startDate) other.endDate = t.startDate;
            if (other && (other.startDate > other.endDate)) throw new Error('التوقيت الجديد يجعل الجزء الآخر بلا مدة');
          }
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
          if (action.type === 'submit') {
            const block = tripFormBlock(d, trip, doc.kind);
            if (block) throw new Error(block);
          }
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
            // فتح التقرير الختامي بعد اعتماد الجدول تلقائياً
            if (doc.kind === 'schedule' && !docFor(d, trip.id, 'final_report'))
              d.docs.push({ id: uid('doc'), tripId: trip.id, kind: 'final_report', status: 'draft', version: 1, fields: {}, history: [] });
          }
        });
      },
      /** حفظ الجدول: يُعدَّل أي بند قبل بدايته بلا اعتماد، والبند الذي بدأ لا يُعدَّل. لا سجل للتعديلات */
      saveSchedule(tripId: ID, plans: SchedulePlan[], newSessions: TripSession[] = []) {
        mutate((d) => {
          const t = findTrip(d, tripId);
          const nowKey = nowISO().slice(0, 16);
          const startedKey = (i: { date: string; start: string }) => `${i.date}T${i.start}` <= nowKey;
          // البنود التي بدأت مقفلة: يجب أن تبقى كما هي في كل خطة
          t.schedule.plans.forEach((old) => {
            const next = plans.find((p) => p.id === old.id);
            old.items.filter(startedKey).forEach((i) => {
              const n = next?.items.find((x) => x.id === i.id);
              if (!n || n.date !== i.date || n.start !== i.start || n.end !== i.end || n.categoryId !== i.categoryId || n.detail !== i.detail) throw new Error(`البند «${i.detail}» بدأ فلا يُعدَّل`);
            });
          });
          plans.forEach((p) => p.items.filter((i) => !t.schedule.plans.some((o) => o.items.some((x) => x.id === i.id))).forEach((i) => {
            if (startedKey(i)) throw new Error(`لا يُضاف بند يبدأ في وقت مضى («${i.detail}»)`);
          }));
          t.schedule.plans = plans;
          t.sessions.push(...newSessions);
          if (t.published) pushNotification(d, [...tripTeamIds(d, t), ...staffIds(d)], 'general', `حُدّث جدول ${t.title}`, `/app/trips/${tripId}`);
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
      /** رحلة الخطة الشخصية: قائد فريقها يحدد بند الجدول أو توقيت فتح الخطة */
      setPlanUnlock(tripId: ID, unlock: Trip['planUnlock']) {
        mutate((d) => {
          const t = findTrip(d, tripId);
          if (!t.isPersonalPlanMeeting) throw new Error('هذه الرحلة لا تخص الخطة الشخصية');
          if (tripTeamLeaderId(d, t) !== me() && !isLeaderId(d, me())) throw new Error('يحدده من يخطط الرحلة');
          if (unlock?.mode === 'item' && !t.schedule.plans[0]?.items.some((i) => i.id === unlock.itemId)) throw new Error('البند غير موجود في الخطة أ');
          t.planUnlock = unlock;
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
      /** الحضور: الرحلة بحالاتها (مسؤول التحضير أو قائد الفريق)، والتركيز (قائد المجموعة)، ولقاءات الرحلة التي يلزمها تحضير */
      setAttendance(eventKind: 'trip' | 'focus' | 'trip_session', eventId: ID, personId: ID, status: Attendance['status'], sessionId?: ID) {
        mutate((d) => {
          if (eventKind === 'trip' && status === 'present') status = 'on_time';
          if (eventKind !== 'trip' && !['present', 'absent'].includes(status)) throw new Error('الحالات هنا: حاضر أو غائب');
          const present = status !== 'absent';
          const ex = d.attendance.find((a) => a.eventKind === eventKind && a.eventId === eventId && a.personId === personId && a.sessionId === sessionId);
          if (ex) Object.assign(ex, { status, present, byId: me(), at: nowISO() });
          else d.attendance.push({ id: uid('at'), eventKind, eventId, sessionId, personId, status, present, byId: me(), at: nowISO() });
        });
      },
      recordActual(tripId: ID, refItemId: ID, entry: { followed: 'A' | 'B' | 'none'; note?: string; actualStart?: string; actualEnd?: string; categoryId?: ID }) {
        mutate((d) => {
          const ex = d.actualSchedule.find((e) => e.tripId === tripId && e.refItemId === refItemId);
          if (ex) Object.assign(ex, entry, { byId: me(), at: nowISO() });
          else d.actualSchedule.push({ id: uid('ac'), tripId, refItemId, ...entry, byId: me(), at: nowISO() });
        });
      },
      /** كل عضو في فريق العمل يقيّم الرحلة مرة (من 10)، والمتوسط يدخل في نقاطها */
      rateTrip(tripId: ID, score: number, note?: string) {
        mutate((d) => {
          const p = d.persons.find((x) => x.id === me());
          if (p?.kind !== 'staff') throw new Error('تقييم الرحلة لفريق العمل');
          const t = findTrip(d, tripId);
          if (!(score >= 0 && score <= 10)) throw new Error('التقييم من 0 إلى 10');
          if (t.evaluation.staffRatings[me()]) throw new Error('قيّمت هذه الرحلة من قبل');
          t.evaluation.staffRatings[me()] = { score, note, at: nowISO() };
        });
      },
      /** إغلاق الرحلة: لقائد فريقها أو القائد العام، ولا يتم قبل اكتمال المتطلبات ونصاب تقييمات فريق العمل */
      close(tripId: ID) {
        mutate((d) => {
          const t = findTrip(d, tripId);
          if (tripTeamLeaderId(d, t) !== me() && !d.persons.find((p) => p.id === me())?.isGeneralLeader) throw new Error('إغلاق الرحلة لقائد فريقها أو القائد العام');
          const block = tripCloseBlock(d, t);
          if (block) throw new Error(block);
          Object.assign(t, { closedAt: nowISO(), closedBy: me() });
          pushNotification(d, tripTeamIds(d, t).filter((x) => x !== me()), 'general', `أُغلقت الرحلة: ${t.title}`, `/app/trips/${t.id}`);
        });
      },
      /** بنود المالية (مثل الترشيد): يقيّم بها مسؤول المالية وحده (من 5) */
      rateTripFinance(tripId: ID, key: string, score: number) {
        mutate((d) => {
          ownerOnly(d, me());
          if (!d.settings.finance.evalItems.some((i) => i.key === key)) throw new Error('البند غير موجود');
          if (!(score >= 0 && score <= 5)) throw new Error('التقييم من 0 إلى 5');
          findTrip(d, tripId).evaluation.finance[key] = score;
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

    // ───────────── اللقاء الافتتاحي والختامي ─────────────
    events: {
      /** واحد لكل منهما. بأثر رجعي = لقاء منتهٍ يتخطى التخطيط والتجهيز */
      create(input: { kind: ProgramEvent['kind']; title: string; date: string; location?: string; description?: string; retroactive: boolean; attendees?: number }): ID {
        const id = uid('ev');
        mutate((d) => {
          if (!isLeaderId(d, me())) throw new Error('إنشاء الافتتاحي والختامي للقائد العام');
          if (d.events.some((e) => e.kind === input.kind)) throw new Error(input.kind === 'opening' ? 'يوجد لقاء افتتاحي واحد بالفعل' : 'يوجد لقاء ختامي واحد بالفعل');
          if (!input.title.trim() || !input.date) throw new Error('اكتب العنوان والتاريخ');
          if (input.retroactive && input.date > todayISO()) throw new Error('اللقاء بأثر رجعي تاريخه مضى');
          d.events.push({ id, ...input, title: input.title.trim(), status: input.retroactive ? 'done' : 'planned', createdBy: me(), createdAt: nowISO() });
          if (!input.retroactive) pushNotification(d, [...allParticipants(d), ...staffIds(d)], 'general', `أُدرج في التقويم: ${input.title}`, '/app/calendar');
        });
        return id;
      },
      markDone(id: ID, attendees?: number) {
        mutate((d) => {
          if (!isLeaderId(d, me())) throw new Error('للقائد العام');
          const e = d.events.find((x) => x.id === id);
          if (!e) throw new Error('اللقاء غير موجود');
          Object.assign(e, { status: 'done', attendees });
        });
      },
    },

    // ───────────── تقييم القائد العام الفردي (مرة واحدة) ─────────────
    leaderEval: {
      save(participantId: ID, scores: Record<string, number>, note?: string) {
        mutate((d) => {
          if (!isLeaderId(d, me())) throw new Error('هذا التقييم للقائد العام');
          if (!d.persons.some((p) => p.id === participantId && p.kind === 'participant')) throw new Error('يُقيَّم المشاركون فقط');
          if (d.leaderEvaluations.some((e) => e.participantId === participantId)) throw new Error('قيّمت هذا المشارك من قبل: التقييم مرة واحدة');
          for (const i of d.settings.leaderEvalItems) {
            const v = scores[i.key];
            if (v == null || v < 0 || v > i.max) throw new Error(`«${i.name}» من 0 إلى ${i.max}`);
          }
          d.leaderEvaluations.push({ participantId, scores, note, byId: me(), at: nowISO() });
        });
      },
    },

    // ───────────── المهام ─────────────
    tasks: {
      create(input: Omit<Task, 'id' | 'createdAt' | 'createdBy' | 'status'> & { status?: Task['status'] }) {
        mutate((d) => {
          if (input.committeeId && !canSeeCommitteeIn(d, input.committeeId)) deny();
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
      /** المقدّم والموضوع: يحددهما الميسّر عند الإنشاء ويعدّلهما قبل اللقاء فقط. المقدّمون من أعضاء المجموعة */
      setPresenter(id: ID, p: Pick<FocusMeeting, 'presenterMode' | 'presenterIds' | 'presenterAxes' | 'guestName' | 'topic'>) {
        mutate((d) => {
          const f = d.focusMeetings.find((x) => x.id === id);
          if (!f || !canManageFocus(d, me(), f)) throw new Error('يعدّل المقدّم ميسّر المجموعة فقط');
          if (focusDone(f) || focusIsPast(f)) throw new Error('لا يُعدَّل المقدّم بعد موعد اللقاء');
          const g = d.groups.find((x) => x.id === f.groupId)!;
          if (p.presenterMode === 'members' && (!p.presenterIds.length || p.presenterIds.some((x) => !g.memberIds.includes(x)))) throw new Error('اختر مقدّماً أو أكثر من المجموعة');
          if (p.presenterMode === 'guest' && !p.guestName?.trim()) throw new Error('اكتب اسم الضيف');
          const added = p.presenterMode === 'members' ? p.presenterIds.filter((x) => !f.presenterIds.includes(x)) : [];
          Object.assign(f, { ...p, presenterIds: p.presenterMode === 'members' ? p.presenterIds : [], guestName: p.presenterMode === 'guest' ? p.guestName : undefined });
          if (added.length) pushNotification(d, added, 'focus_created_presenter', `أنت مقدّم في "${f.title}"`, `/app/focus/${id}`);
        });
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
          d.attendance.push({ id: uid('at'), eventKind: 'individual', eventId: id, personId: m.participantId, status: 'present', present: true, byId: me(), at: nowISO() });
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
          // العام البعدي: لا يُنشأ قبل تسجيل استبيان آخر رحلة خارجية
          if (s.context.kind === 'program' && s.phase === 'post' && !d.surveys.some((x) => x.id === s.id)) {
            const block = programPostBlock(d);
            if (block) throw new Error(block);
          }
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
      /** الموازنة العامة: يسجّلها مسؤول المالية أول مرة، ثم تُقفل ولا تتغيّر إلا بطلب تعديل يوافق عليه القائد العام */
      setupBudget(pb: ProgramBudget) {
        mutate((d) => {
          ownerOnly(d, me());
          if (d.programBudget.setupDone) throw new Error('الموازنة معتمدة ومقفلة: ارفع طلب تعديل للقائد العام');
          d.programBudget = { ...pb, setupDone: true, setupAt: nowISO() };
          audit(d, me(), 'إعداد الموازنة العامة', 'حُفظت مبالغ المرصود لكل نوع وقُفلت');
        });
      },
      setFinanceSettings(patch: Partial<DB['settings']['finance']>) {
        mutate((d) => {
          ownerOnly(d, me());
          d.settings.finance = { ...d.settings.finance, ...patch, splitAlert: { ...d.settings.finance.splitAlert, ...(patch.splitAlert ?? {}) } };
          if (!(d.settings.finance.maxOpenCustodies >= 1)) throw new Error('الحد الأدنى للعهد المتزامنة 1');
          audit(d, me(), 'تعديل الإعدادات المالية', `العهد المتزامنة ${d.settings.finance.maxOpenCustodies} · تنبيه التجزئة ≤ ${d.settings.finance.splitAlert.maxAmount} ر.س خلال ${d.settings.finance.splitAlert.windowDays} أيام (${d.settings.finance.splitAlert.minCount} فواتير)`);
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
          const used = d.spendForms.some((f) => f.lines.some((l) => l.categoryId === id)) || d.directSpends.some((x) => x.lines.some((l) => l.categoryId === id)) || d.budgetRequests.some((r) => r.lines.some((l) => l.categoryId === id));
          if (used) throw new Error('لا يُحذف تصنيف عليه صرف أو موازنات. أخفِه بدلاً من حذفه.');
          d.budgetCategories = d.budgetCategories.filter((x) => x.id !== id);
        });
      },

      // ── المحفظة ──
      /** إيداع: الجمعية تحوّل لمسؤول المالية فيسجّله بإيصال الحوالة والمبلغ والتفاصيل */
      deposit(input: { amount: number; attachment: Attachment; source: string; note?: string }) {
        mutate((d) => {
          guard(d, me(), 'disburse');
          if (!(input.amount > 0)) throw new Error('اكتب مبلغ الإيداع');
          const err = attachmentError(input.attachment, 'إيصال الحوالة');
          if (err) throw new Error(err);
          if (!input.source.trim()) throw new Error('اكتب الجهة المحوِّلة');
          d.wallet.push({ id: uid('we'), kind: 'deposit', amount: input.amount, at: nowISO(), byId: me(), attachment: input.attachment, source: input.source.trim(), note: input.note });
          audit(d, me(), 'إيداع في المحفظة', `${input.amount} ر.س من ${input.source}`);
        });
      },

      // ── طلبات الميزانية ──
      submitRequest(input: { ownerKind: BudgetRequest['ownerKind']; ownerId: ID; amount: number; lines: BudgetLine[]; detailed: boolean; note?: string }) {
        mutate((d) => submitRequestIn(d, me(), input));
      },
      /** ميزانية رحلة المجموعة: الميسّر يعتمد ثم القائد العام */
      facilitatorDecide(requestId: ID, approve: boolean, reason?: string) {
        mutate((d) => {
          const r = findRequest(d, requestId);
          if (r.status !== 'pending_facilitator' || tripBudgetFacilitatorId(d, r.ownerId) !== me()) throw new Error('الطلب ليس بانتظارك');
          if (!approve && !reason?.trim()) throw new Error('اكتب سبب الإعادة');
          r.status = approve ? 'pending_leader' : 'rejected';
          r.history.push({ at: nowISO(), byId: me(), action: approve ? 'facilitator_approve' : 'facilitator_reject', note: reason });
          const t = ownerTitle(d, r.ownerKind, r.ownerId);
          if (approve) pushNotification(d, [leaderId(d)], 'budget_request', `ميزانية ${t} بانتظار اعتمادك (${r.amount} ر.س)${r.amount > r.allocated ? ` — تتجاوز المرصود ${r.allocated} ر.س` : ''}`, '/app/approvals');
          else pushNotification(d, [r.requestedBy], 'approval_rejected', `أعاد الميسّر ميزانية ${t}: ${reason}`, ownerLink(r.ownerKind, r.ownerId));
        });
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
      /** القائد العام: يعتمد التجاوز وميزانيات الرحلات (منبَّهاً إن تجاوزت المرصود)، أو يرفض، أو يطلب تفصيلاً. ولا يصرف */
      leaderDecide(requestId: ID, decision: 'approve' | 'reject' | 'detail', reason?: string) {
        mutate((d) => {
          if (!isLeaderId(d, me())) throw new Error('هذا القرار للقائد العام فقط');
          const r = findRequest(d, requestId);
          if (r.status !== 'pending_leader') throw new Error('الطلب ليس بانتظار القائد العام');
          if (decision !== 'approve' && !reason?.trim()) throw new Error('اكتب السبب أو المطلوب');
          r.status = decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : 'needs_detail';
          r.history.push({ at: nowISO(), byId: me(), action: decision === 'approve' ? 'leader_approve' : decision === 'reject' ? 'leader_reject' : 'leader_request_detail', note: reason });
          const over = r.amount > r.allocated;
          audit(d, me(), { approve: over ? 'اعتماد ميزانية تتجاوز المرصود' : 'اعتماد ميزانية', reject: 'رفض ميزانية', detail: 'طلب موازنة تفصيلية' }[decision], `${ownerTitle(d, r.ownerKind, r.ownerId)} — ${r.amount} ر.س (المرصود ${r.allocated})`);
          const t = ownerTitle(d, r.ownerKind, r.ownerId);
          if (decision === 'approve') {
            pushNotification(d, [r.requestedBy], 'approval_approved', `اعتمد القائد العام ميزانية ${t}`, ownerLink(r.ownerKind, r.ownerId));
            pushNotification(d, financeIdsWith(d, 'disburse'), 'custody_issued', `اعتُمدت ميزانية ${t}: حوّل العهدة`, '/app/finance?tab=requests');
          } else pushNotification(d, [r.requestedBy], 'approval_rejected', decision === 'reject' ? `رفض القائد العام ميزانية ${t}: ${reason}` : `طلب القائد العام موازنة تفصيلية لـ ${t}: ${reason}`, ownerLink(r.ownerKind, r.ownerId));
        });
      },

      // ── العهد ──
      /** صرف عهدة الطلب المعتمد: تحويل أول بإيصال (كامل أو جزء إن لم يكفِ الرصيد، والباقي دفعة ثانية) */
      disburse(requestId: ID, input: { recipientId: ID; amount: number; attachment: Attachment }) {
        mutate((d) => {
          guard(d, me(), 'disburse');
          const r = findRequest(d, requestId);
          if (r.status !== 'approved') throw new Error('لا تُصرف العهدة إلا بعد اعتماد الطلب');
          if (d.custodies.some((c) => c.requestId === r.id)) throw new Error('صُرفت عهدة هذا الطلب مسبقاً');
          const c = openCustodyIn(d, me(), { ownerKind: r.ownerKind, ownerId: r.ownerId, requestId: r.id, recipientId: input.recipientId, approved: r.amount, amount: input.amount, attachment: input.attachment });
          r.history.push({ at: nowISO(), byId: me(), action: 'disbursed', note: input.amount < r.amount ? `دفعة أولى ${input.amount} من ${r.amount}` : undefined });
          audit(d, me(), 'صرف عهدة', `${ownerTitle(d, r.ownerKind, r.ownerId)} — ${input.amount} من ${r.amount} ر.س لـ ${personName(d, input.recipientId)}`);
          d.tasks.filter((t) => t.tripId === c.ownerId && t.tag === 'custody_issue' && t.status !== 'done').forEach((t) => Object.assign(t, { status: 'done', doneAt: nowISO(), proof: `حُوّلت ${input.amount} ر.س` }));
        });
      },
      /** عهدة بلا طلب للافتتاحي والختامي واحتياجات البرنامج (لشخص يقفلها، مثل القائد العام) */
      issueCustody(input: { ownerKind: Custody['ownerKind']; ownerId: ID; recipientId: ID; approved: number; amount: number; attachment: Attachment }) {
        mutate((d) => {
          guard(d, me(), 'disburse');
          const kind = spendKindOf(d, input.ownerKind, input.ownerId);
          if (!DIRECT_CUSTODY_KINDS.includes(kind)) throw new Error(`عهدة «${spendKindLabel[kind]}» تُصرف بعد اعتماد طلبها`);
          openCustodyIn(d, me(), input);
          audit(d, me(), 'صرف عهدة مباشرة', `${ownerTitle(d, input.ownerKind, input.ownerId)} — ${input.amount} من ${input.approved} ر.س لـ ${personName(d, input.recipientId)}`);
        });
      },
      /** الدفعة التالية (المؤجّلة لعدم كفاية الرصيد) */
      transferMore(custodyId: ID, amount: number, attachment: Attachment) {
        mutate((d) => {
          guard(d, me(), 'disburse');
          const c = findCustody(d, custodyId);
          if (c.status !== 'active') throw new Error('العهدة ليست مفعّلة');
          const left = c.approved - c.transfers.reduce((s, t) => s + t.amount, 0);
          if (!(amount > 0) || amount > left + 0.009) throw new Error(`المتبقي من المعتمد ${Math.round(left * 100) / 100} ر.س`);
          transferIn(d, me(), c, amount, attachment);
          audit(d, me(), 'تحويل دفعة عهدة', `${ownerTitle(d, c.ownerKind, c.ownerId)} — ${amount} ر.س`);
          pushNotification(d, [c.recipientId], 'custody_issued', `حُوّلت دفعة ${amount} ر.س على عهدة ${ownerTitle(d, c.ownerKind, c.ownerId)}`, '/app/requests');
        });
      },
      setMeetingAllocation(meetingId: ID, amount: number) {
        mutate((d) => {
          ownerOnly(d, me());
          d.meetings.find((m) => m.id === meetingId)!.allocated = amount;
          audit(d, me(), 'مرصود اجتماع', `${d.meetings.find((m) => m.id === meetingId)!.title} — ${amount} ر.س`);
        });
      },

      // ── نموذج الصرف ──
      /** المستلم يرفع نموذج صرف: فاتورة (أو إيصال تحويل) بسطر أو أكثر. يُقبل ولو تجاوز رصيد العهدة (يُسجَّل عجزاً) */
      submitSpendForm(custodyId: ID, input: { vendor: string; serial?: string; invoiceDate: string; proofKind: ProofKind; attachment: Attachment; lines: { categoryId?: ID; customCategory?: string; item: string; amount: number }[] }) {
        let id = '';
        mutate((d) => {
          const c = findCustody(d, custodyId);
          if (c.recipientId !== me()) throw new Error('نموذج الصرف يرفعه صاحب العهدة');
          if (c.status !== 'active') throw new Error(c.status === 'closing' ? 'أُرسل طلب الإغلاق فتوقف الصرف' : 'العهدة مغلقة');
          const err = proofError(input, input.proofKind === 'invoice' ? 'صورة الفاتورة' : 'إيصال التحويل') ?? (!input.lines.length ? 'أضف بنداً واحداً على الأقل' : null) ?? input.lines.map((l) => lineError(l, d)).find(Boolean) ?? null;
          if (err) throw new Error(err);
          id = uid('sf');
          const form: SpendForm = {
            id, custodyId, uploadedBy: me(), at: nowISO(), vendor: input.vendor.trim(), serial: input.serial?.trim() || undefined, invoiceDate: input.invoiceDate, proofKind: input.proofKind, attachment: input.attachment,
            lines: input.lines.map((l) => ({ id: uid('sl'), categoryId: l.categoryId || undefined, customCategory: l.categoryId ? undefined : l.customCategory?.trim(), item: l.item.trim(), amount: Math.round(l.amount * 100) / 100, status: 'pending' as const })),
          };
          d.spendForms.push(form);
          const warn = [...formDuplicateWarnings(d, form), splitWarning(d, form)].filter(Boolean);
          pushNotification(d, financeIdsWith(d, 'review_invoices'), 'general', `نموذج صرف بانتظار المراجعة — ${ownerTitle(d, c.ownerKind, c.ownerId)}${warn.length ? ` (تنبيه: ${warn[0]})` : ''}`, '/app/finance?tab=invoices');
        });
        return id;
      },
      /** الرقم التسلسلي: يُدخل يدوياً إن لم يكتبه الرافع (مكان جاهز لقراءته بـ OCR لاحقاً) */
      setSerial(formId: ID, serial: string) {
        mutate((d) => {
          guard(d, me(), 'review_invoices');
          const f = findForm(d, formId);
          if (findCustody(d, f.custodyId).recipientId === me()) throw new Error('لا يراجع صاحب العهدة صرفه بنفسه');
          if (f.lines.every((l) => l.status !== 'pending')) throw new Error('رُوجع النموذج وقُفل');
          f.serial = serial.trim() || undefined;
        });
      },
      /** مراجعة كل بند وحده: يُعدَّل التصنيف والمبلغ (لا الصورة ولا الشرح) ثم يُقبل أو يُرفض. المقبول يُقفل */
      reviewLine(formId: ID, lineId: ID, input: { accept: boolean; categoryId?: ID; amount?: number; note?: string }) {
        mutate((d) => {
          guard(d, me(), 'review_invoices');
          const f = findForm(d, formId);
          const c = findCustody(d, f.custodyId);
          if (c.recipientId === me()) throw new Error('لا يراجع صاحب العهدة صرفه بنفسه');
          const l = f.lines.find((x) => x.id === lineId);
          if (!l) throw new Error('البند غير موجود');
          if (l.status !== 'pending') throw new Error('البند مراجَع ومقفل: التعديل بطلب يوافق عليه القائد العام');
          if (input.accept) {
            if (!f.serial) throw new Error('أدخل الرقم التسلسلي للفاتورة قبل القبول');
            const categoryId = input.categoryId ?? l.categoryId;
            if (!categoryId) throw new Error('اختر تصنيفاً من القائمة لبند «غير موجود» قبل قبوله');
            const amount = input.amount ?? l.amount;
            if (!(amount > 0)) throw new Error('المبلغ أكبر من صفر');
            if (categoryId !== l.categoryId || amount !== l.amount) l.original = { categoryId: l.categoryId, customCategory: l.customCategory, amount: l.amount };
            Object.assign(l, { categoryId, customCategory: undefined, amount, status: 'accepted' });
          } else {
            if (!input.note?.trim()) throw new Error('اكتب سبب الرفض');
            l.status = 'rejected';
          }
          Object.assign(l, { reviewNote: input.note, reviewedBy: me(), reviewedAt: nowISO() });
          audit(d, me(), input.accept ? 'قبول بند صرف' : 'رفض بند صرف', `${ownerTitle(d, c.ownerKind, c.ownerId)} — ${l.item} ${l.amount} ر.س${l.original ? ` (كان ${l.original.amount})` : ''}${input.note ? ` — ${input.note}` : ''}`);
          if (!input.accept) pushNotification(d, [c.recipientId], 'invoice_rejected', `رُفض بند «${l.item}» (${l.amount} ر.س): ${input.note}`, '/app/requests');
        });
      },

      // ── الصرف المباشر ──
      /** يصرفه مسؤول المالية بنفسه من رصيده على نشاط أو أكثر، بفاتورة وتصنيف ومبلغ، بلا اعتماد حتى لو تجاوز */
      directSpend(input: { allocations: DirectSpend['allocations']; vendor: string; serial?: string; invoiceDate: string; proofKind: ProofKind; attachment: Attachment; lines: { categoryId?: ID; customCategory?: string; item: string; amount: number }[] }) {
        mutate((d) => {
          guard(d, me(), 'disburse');
          const err = proofError(input, 'الفاتورة أو إيصال التحويل') ?? (!input.lines.length ? 'أضف بنداً واحداً على الأقل' : null) ?? input.lines.map((l) => lineError(l, d)).find(Boolean) ?? null;
          if (err) throw new Error(err);
          const total = Math.round(input.lines.reduce((s, l) => s + l.amount, 0) * 100) / 100;
          const allocated = Math.round(input.allocations.reduce((s, a) => s + a.amount, 0) * 100) / 100;
          if (!input.allocations.length || input.allocations.some((a) => !(a.amount > 0))) throw new Error('حدد النشاط ومبلغ كل حصة');
          if (Math.abs(allocated - total) > 0.009) throw new Error(`مجموع التوزيع (${allocated}) يجب أن يساوي مبلغ الفاتورة (${total}) بالضبط`);
          const funds = insufficientFunds(d, total);
          if (funds) throw new Error(funds);
          const id = uid('ds');
          const e = walletOut(d, me(), 'direct_spend', total, input.attachment, { directSpendId: id });
          d.directSpends.push({
            id, allocations: input.allocations, vendor: input.vendor.trim(), serial: input.serial?.trim() || undefined, invoiceDate: input.invoiceDate, proofKind: input.proofKind, attachment: input.attachment,
            lines: input.lines.map((l) => ({ id: uid('dl'), categoryId: l.categoryId || undefined, customCategory: l.categoryId ? undefined : l.customCategory?.trim(), item: l.item.trim(), amount: l.amount })), total, byId: me(), at: nowISO(), walletEntryId: e.id,
          });
          audit(d, me(), 'صرف مباشر', `${input.allocations.map((a) => `${ownerTitle(d, a.ownerKind, a.ownerId)} ${a.amount}`).join(' + ')} ر.س — ${input.vendor}`);
        });
      },

      // ── احتياجات البرنامج والعقود ──
      createNeed(title: string, description?: string): ID {
        const id = uid('nd');
        mutate((d) => {
          guard(d, me(), 'disburse');
          if (!title.trim()) throw new Error('اكتب اسم الاحتياج');
          d.programNeeds.push({ id, title: title.trim(), description, createdBy: me(), at: nowISO() });
        });
        return id;
      },
      createContract(input: { needId: ID; vendor: string; title: string; total: number; payments: { amount: number; dueDate: string }[] }) {
        mutate((d) => {
          guard(d, me(), 'disburse');
          if (!d.programNeeds.some((n) => n.id === input.needId)) throw new Error('العقود في احتياجات البرنامج فقط');
          if (!input.vendor.trim() || !input.title.trim()) throw new Error('اكتب المورد وموضوع العقد');
          if (!(input.total > 0) || !input.payments.length || input.payments.some((p) => !(p.amount > 0) || !p.dueDate)) throw new Error('حدد قيمة العقد ومبلغ وموعد كل دفعة');
          const sum = Math.round(input.payments.reduce((s, p) => s + p.amount, 0) * 100) / 100;
          if (Math.abs(sum - input.total) > 0.009) throw new Error(`مجموع الدفعات (${sum}) يجب أن يساوي قيمة العقد (${input.total})`);
          d.contracts.push({ id: uid('ctr'), needId: input.needId, vendor: input.vendor.trim(), title: input.title.trim(), total: input.total, payments: input.payments.map((p) => ({ id: uid('cp'), ...p })), createdBy: me(), at: nowISO() });
          audit(d, me(), 'عقد جديد', `${input.title} — ${input.vendor} — ${input.total} ر.س (${input.payments.length} دفعات)`);
        });
      },
      payContract(contractId: ID, paymentId: ID, attachment: Attachment) {
        mutate((d) => {
          guard(d, me(), 'disburse');
          const c = d.contracts.find((x) => x.id === contractId);
          const p = c?.payments.find((x) => x.id === paymentId);
          if (!c || !p) throw new Error('الدفعة غير موجودة');
          if (p.paidAt) throw new Error('الدفعة مدفوعة');
          const err = attachmentError(attachment, 'فاتورة الدفعة أو إيصال تحويلها') ?? insufficientFunds(d, p.amount);
          if (err) throw new Error(err);
          const e = walletOut(d, me(), 'contract_payment', p.amount, attachment, { contractId, paymentId });
          Object.assign(p, { paidAt: nowISO(), byId: me(), attachment, walletEntryId: e.id });
          audit(d, me(), 'دفعة عقد', `${c.title} — ${p.amount} ر.س`);
        });
      },

      // ── الإغلاق ──
      /** صاحب العهدة يرسل طلب الإغلاق فيتوقف الصرف فوراً */
      requestClose(custodyId: ID) {
        mutate((d) => {
          const c = findCustody(d, custodyId);
          if (c.recipientId !== me()) throw new Error('طلب الإغلاق لصاحب العهدة');
          if (c.status !== 'active') throw new Error('العهدة ليست مفعّلة');
          Object.assign(c, { status: 'closing', closeRequestedAt: nowISO() });
          pushNotification(d, financeIdsWith(d, 'close_custody'), 'general', `طلب إغلاق عهدة: ${ownerTitle(d, c.ownerKind, c.ownerId)}`, '/app/finance?tab=requests');
        });
      },
      /** الفائض: يحوّله صاحب العهدة لحساب مسؤول المالية ويرفع الإيصال */
      submitSurplusReturn(custodyId: ID, attachment: Attachment) {
        mutate((d) => {
          const c = findCustody(d, custodyId);
          if (c.recipientId !== me()) throw new Error('إيصال الفائض يرفعه صاحب العهدة');
          const err = attachmentError(attachment, 'إيصال تحويل الفائض');
          if (err) throw new Error(err);
          c.surplusReturn = { attachment, at: nowISO() };
          pushNotification(d, financeIdsWith(d, 'close_custody'), 'general', `رُفع إيصال فائض عهدة ${ownerTitle(d, c.ownerKind, c.ownerId)}`, '/app/finance?tab=requests');
        });
      },
      /** تسوية الإغلاق: تأكيد استلام الفائض، أو العجز بتحويله للشخص من الرصيد أو بتسوية خارجية يتحمّلها المسؤول أو صاحب العهدة */
      settle(custodyId: ID, input: { method: 'transfer' | 'external'; bearer?: 'finance_officer' | 'holder'; attachment?: Attachment; note?: string }) {
        mutate((d) => {
          guard(d, me(), 'close_custody');
          const c = findCustody(d, custodyId);
          if (c.status !== 'closing') throw new Error('التسوية بعد طلب الإغلاق');
          if (c.settlement) throw new Error('سُوّيت العهدة مسبقاً');
          const f = custodyFigures(d, c);
          if (f.pendingLines) throw new Error('راجع كل بنود الصرف قبل التسوية');
          if (f.surplus > 0.009) {
            if (!c.surplusReturn) throw new Error('بانتظار إيصال تحويل الفائض من صاحب العهدة');
            const e: WalletEntry = { id: uid('we'), kind: 'surplus_return', amount: f.surplus, at: nowISO(), byId: me(), attachment: c.surplusReturn.attachment, ref: { custodyId: c.id } };
            d.wallet.push(e);
            c.settlement = { kind: 'surplus', amount: f.surplus, method: 'transfer', attachment: c.surplusReturn.attachment, at: nowISO(), byId: me(), walletEntryId: e.id };
            audit(d, me(), 'استلام فائض عهدة', `${ownerTitle(d, c.ownerKind, c.ownerId)} — ${f.surplus} ر.س`);
          } else if (f.deficit > 0.009) {
            const err = attachmentError(input.attachment, input.method === 'transfer' ? 'إيصال تحويل العجز' : 'مستند التسوية');
            if (err) throw new Error(err);
            if (input.method === 'external' && !input.bearer) throw new Error('حدد من يتحمّل التسوية');
            let walletEntryId: ID | undefined;
            if (input.method === 'transfer') {
              const funds = insufficientFunds(d, f.deficit);
              if (funds) throw new Error(funds);
              walletEntryId = walletOut(d, me(), 'deficit_payout', f.deficit, input.attachment!, { custodyId: c.id }).id;
            }
            c.settlement = { kind: 'deficit', amount: f.deficit, method: input.method, bearer: input.method === 'external' ? input.bearer : undefined, attachment: input.attachment!, note: input.note, at: nowISO(), byId: me(), walletEntryId };
            audit(d, me(), input.method === 'transfer' ? 'تحويل عجز عهدة' : 'تسوية عجز من خارج العهدة', `${ownerTitle(d, c.ownerKind, c.ownerId)} — ${f.deficit} ر.س${input.bearer ? ` يتحمّلها ${input.bearer === 'holder' ? personName(d, c.recipientId) : 'مسؤول المالية'}` : ''}`);
          } else throw new Error('لا فائض ولا عجز: أغلق العهدة مباشرة');
        });
      },
      closeCustody(custodyId: ID) {
        mutate((d) => {
          guard(d, me(), 'close_custody');
          const c = findCustody(d, custodyId);
          const failed = custodyCloseChecks(d, c).find((x) => !x.ok);
          if (failed) throw new Error(`لا يُغلق قبل: ${failed.label}`);
          Object.assign(c, { status: 'closed', closedAt: nowISO(), closedBy: me() });
          audit(d, me(), 'إغلاق عهدة', `${ownerTitle(d, c.ownerKind, c.ownerId)} — معتمد ${c.approved} ر.س، مقبول ${custodyFigures(d, c).accepted} ر.س`);
          d.tasks.filter((t) => t.tripId === c.ownerId && t.tag === 'custody_close').forEach((t) => Object.assign(t, { status: 'done', doneAt: nowISO() }));
          pushNotification(d, [c.recipientId], 'general', `أُغلقت عهدة ${ownerTitle(d, c.ownerKind, c.ownerId)}`, '/app/requests');
        });
      },

      // ── الرسوم ──
      /** متابعة فقط بلا مرفق إثبات: مسدد أو جزئي أو غير مسدد. الاستثناء سبب بنص حر ويُعتبر المشارك مسدداً */
      setFee(personId: ID, input: { status: FeeStatus; paidAmount?: number; exemption?: string; note?: string }) {
        mutate((d) => {
          ownerOnly(d, me());
          let f = d.fees.find((x) => x.personId === personId);
          if (!f) d.fees.push((f = { personId, amount: d.settings.feeAmount, status: 'unpaid', paidAmount: 0 }));
          if (input.exemption?.trim()) input = { ...input, status: 'paid' };
          const paidAmount = input.status === 'paid' ? f.amount : input.status === 'unpaid' ? 0 : input.paidAmount ?? f.paidAmount;
          if (input.status === 'partial' && !(paidAmount > 0 && paidAmount < f.amount)) throw new Error(`السداد الجزئي بين صفر و${f.amount}`);
          Object.assign(f, { status: input.status, paidAmount, exemption: input.exemption?.trim() || undefined, note: input.note, updatedAt: nowISO() });
          audit(d, me(), 'تحديث رسوم', `${personName(d, personId)} — ${{ paid: 'مسدد', partial: `جزئي ${paidAmount}`, unpaid: 'غير مسدد' }[input.status]}${f.exemption ? ` (استثناء: ${f.exemption})` : ''}`);
        });
      },

      // ── تعديل السجلات المعتمدة ──
      /** السجل المعتمد لا يُعدَّل مباشرة: يُرفع طلب للقائد العام */
      requestEdit(input: { target: EditTarget; patch: Record<string, unknown>; summary: string; reason: string }) {
        mutate((d) => {
          if (!financePermsOf(d, me()).some((p) => p !== 'view_budget')) throw new Error('طلب تعديل السجلات المالية لمسؤول المالية ومن فُوِّض');
          if (!input.reason.trim()) throw new Error('اكتب سبب التعديل');
          const t = input.target;
          if (t.kind === 'spend_line' && d.spendForms.find((f) => f.id === t.formId)?.lines.find((l) => l.id === t.lineId)?.status !== 'accepted') throw new Error('التعديل بطلب للبنود المعتمدة فقط');
          if (t.kind === 'program_budget' && !d.programBudget.setupDone) throw new Error('الموازنة لم تُعتمد بعد: عدّلها مباشرة');
          if (d.editRequests.some((e) => e.status === 'pending' && JSON.stringify(e.target) === JSON.stringify(t))) throw new Error('يوجد طلب تعديل قائم لهذا السجل');
          d.editRequests.push({ id: uid('er'), ...input, requestedBy: me(), at: nowISO(), status: 'pending' });
          audit(d, me(), 'طلب تعديل سجل معتمد', `${input.summary} — ${input.reason}`);
          pushNotification(d, [leaderId(d)], 'general', `طلب تعديل سجل مالي معتمد: ${input.summary}`, '/app/approvals');
        });
      },
      decideEdit(id: ID, approve: boolean, note?: string) {
        mutate((d) => {
          if (!isLeaderId(d, me())) throw new Error('الموافقة على تعديل السجلات المعتمدة للقائد العام');
          const er = d.editRequests.find((x) => x.id === id);
          if (!er || er.status !== 'pending') throw new Error('الطلب غير قائم');
          if (!approve && !note?.trim()) throw new Error('اكتب سبب الرفض');
          if (approve) applyEditIn(d, er);
          Object.assign(er, { status: approve ? 'approved' : 'rejected', decidedBy: me(), decidedAt: nowISO(), decisionNote: note });
          audit(d, me(), approve ? 'موافقة على تعديل سجل معتمد' : 'رفض تعديل سجل معتمد', `${er.summary}${note ? ` — ${note}` : ''}`);
          pushNotification(d, [er.requestedBy], approve ? 'approval_approved' : 'approval_rejected', `${approve ? 'وافق' : 'رفض'} القائد العام طلب التعديل: ${er.summary}`, '/app/approvals');
        });
      },
    },

    // ───────────── الاجتماعات ─────────────
    meetings: {
      /** ينشئه أي عضو في فريق العمل، ومعه طلب الميزانية إن طلبه مسؤول الاجتماع. قائد المجموعة والمشارك يستقبلان الدعوات فقط */
      create(input: Omit<Meeting, 'id' | 'createdBy' | 'status' | 'attendeeIds' | 'decisions' | 'outputs' | 'createdAt'>, budget?: { amount: number; note?: string }): ID {
        const id = uid('mt');
        mutate((d) => {
          const block = meetingCreateBlock(d, me());
          if (block) throw new Error(block);
          d.meetings.push({ ...input, id, createdBy: me(), status: 'planned', attendeeIds: [], decisions: [], outputs: [], createdAt: nowISO() });
          pushNotification(d, input.inviteeIds.filter((x) => x !== me()), 'meeting', `دعوة لاجتماع: ${input.title}`, `/app/meetings/${id}`);
          if (budget) {
            if (!meetingBudgetReady(d)) throw new Error('ميزانية الاجتماعات غير معتمدة في الموازنة العامة');
            submitRequestIn(d, me(), { ownerKind: 'meeting', ownerId: id, amount: budget.amount, note: budget.note, lines: [], detailed: false });
          }
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
          manageCommitteeIn(d, committeeId);
          const c = d.committees.find((x) => x.id === committeeId)!;
          const i = c.kpis.findIndex((k) => k.id === kpi.id);
          if (i >= 0) c.kpis[i] = kpi;
          else c.kpis.push(kpi);
        });
      },
      removeKpi(committeeId: ID, kpiId: ID) {
        mutate((d) => {
          manageCommitteeIn(d, committeeId);
          const c = d.committees.find((x) => x.id === committeeId)!;
          c.kpis = c.kpis.filter((k) => k.id !== kpiId);
        });
      },
      addMember(committeeId: ID, personId: ID, role: 'leader' | 'member', canSeeFinance: boolean) {
        mutate((d) => {
          if (!isLeaderId(d, me())) deny();
          d.memberships = d.memberships.filter((m) => !(m.committeeId === committeeId && m.personId === personId));
          d.memberships.push({ id: uid('cm'), committeeId, personId, role, canSeeFinance });
          assertNoCapacityConflict(d, [personId]);
          audit(d, me(), 'إسناد صفة', `${role === 'leader' ? 'مسؤول' : 'عضو'} ${d.committees.find((c) => c.id === committeeId)?.name} — ${personName(d, personId)}`, 'roles');
        });
      },
      removeMember(committeeId: ID, personId: ID) {
        mutate((d) => {
          if (!isLeaderId(d, me())) deny();
          d.memberships = d.memberships.filter((m) => !(m.committeeId === committeeId && m.personId === personId));
        });
      },
      requestMember(committeeId: ID, personId: ID, note?: string) {
        mutate((d) => {
          manageCommitteeIn(d, committeeId);
          d.memberRequests.push({ id: uid('mr'), committeeId, personId, requestedBy: me(), note, status: 'pending', at: nowISO() });
          pushNotification(d, [leaderId(d)], 'committee_member_request', `طلب إضافة ${d.persons.find((p) => p.id === personId)?.name} إلى ${d.committees.find((c) => c.id === committeeId)?.name}`, `/app/committees/${committeeId}`);
        });
      },
      decideRequest(requestId: ID, approve: boolean, role: 'leader' | 'member' = 'member', canSeeFinance = false) {
        mutate((d) => {
          if (!isLeaderId(d, me())) deny();
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

    // ───────────── الإعدادات ورابط المتابعة والموقع ─────────────
    settings: {
      /** الإعدادات غير التقييمية: كل مفتاح يعدّله صاحبه فقط */
      update(patch: Partial<Settings>) {
        mutate((d) => {
          for (const k of Object.keys(patch) as (keyof Settings)[]) {
            const reason = settingsKeyBlockReason(d, me(), k);
            if (reason) throw new Error(reason);
          }
          Object.assign(d.settings, patch);
        });
      },
      /** حفظ إعدادات التقييم يقفلها، ولا يفتحها إلا مسؤول اللجنة التقنية */
      saveEvaluation(patch: Partial<EvaluationSettings>) {
        mutate((d) => {
          if (d.settings.evaluationLock.locked) throw new Error('إعدادات التقييم مقفلة. يفتحها مسؤول اللجنة التقنية');
          if (!canEditEvaluation(d, me())) throw new Error('إعدادات التقييم يضبطها القائد العام');
          for (const k of Object.keys(patch)) if (!isEvaluationKey(k)) throw new Error(`«${k}» ليس من إعدادات التقييم`);
          const changed = (Object.keys(patch) as EvaluationKey[]).filter((k) => JSON.stringify(patch[k]) !== JSON.stringify(d.settings[k]));
          Object.assign(d.settings, patch);
          const err = evaluationSettingsError(d.settings);
          if (err) throw new Error(err);
          d.settings.evaluationLock = { locked: true, at: nowISO(), by: me() };
          audit(d, me(), 'حفظ إعدادات التقييم وقفلها', changed.length ? `تغيّر: ${changed.map((k) => evaluationKeyLabel[k]).join('، ')}` : 'بلا تغيير في القيم', 'settings');
        });
      },
      unlockEvaluation(reason: string) {
        mutate((d) => {
          if (!canUnlockEvaluation(d, me())) throw new Error('فتح قفل التقييم لمسؤول اللجنة التقنية وحده');
          if (!d.settings.evaluationLock.locked) return false;
          if (!reason.trim()) throw new Error('اكتب سبب فتح القفل');
          d.settings.evaluationLock = { locked: false, at: nowISO(), by: me() };
          audit(d, me(), 'فتح قفل إعدادات التقييم', reason, 'settings');
          pushNotification(d, [leaderId(d)], 'general', `فُتح قفل إعدادات التقييم: ${reason}`, '/app/settings');
        });
      },
      setTracker(personId: ID) {
        mutate((d) => {
          d.settings.trackerId = personId;
          assertNoCapacityConflict(d, [personId]);
          audit(d, me(), 'إسناد صفة', `متابع الرحلات الدائم — ${personName(d, personId)}`, 'roles');
          pushNotification(d, [personId], 'general', 'عُيّنت متابعاً للرحلات', '/app/tracker');
        });
      },
      moderateTrackingComment(id: ID, status: 'visible' | 'hidden') {
        mutate((d) => {
          if (d.persons.find((p) => p.id === me())?.kind !== 'staff') throw new Error('مراجعة التعليقات لفريق العمل');
          d.trackingComments.find((c) => c.id === id)!.status = status;
        });
      },
    },

    // ───────────── رابط الداعم: كلمة مرور لكل جهة ─────────────
    supporters: {
      create(input: { name: string; kind: SupporterEntity['kind']; password: string }) {
        mutate((d) => {
          if (!isLeaderId(d, me())) throw new Error('جهات رابط الداعم يسجّلها القائد العام');
          if (!input.name.trim() || !input.password) throw new Error('اكتب اسم الجهة وكلمة المرور');
          if (findSupporterByPassword(d, input.password)) throw new Error('كلمة المرور مستخدمة لجهة أخرى');
          const salt = uid('salt');
          d.supporters.push({ id: uid('sp'), name: input.name.trim(), kind: input.kind, salt, passwordHash: hashPassword(input.password, salt), active: true, placement: 'above', orientation: 'horizontal', primary: false, order: d.supporters.length + 1, createdAt: nowISO() });
          audit(d, me(), 'إضافة جهة لرابط الداعم', input.name, 'settings');
        });
      },
      setPassword(id: ID, password: string) {
        mutate((d) => {
          if (!isLeaderId(d, me())) throw new Error('للقائد العام');
          if (!password) throw new Error('اكتب كلمة المرور');
          const other = findSupporterByPassword(d, password);
          if (other && other.id !== id) throw new Error('كلمة المرور مستخدمة لجهة أخرى');
          const sp = d.supporters.find((x) => x.id === id)!;
          sp.salt = uid('salt');
          sp.passwordHash = hashPassword(password, sp.salt);
          audit(d, me(), 'تغيير كلمة مرور جهة', sp.name, 'settings');
        });
      },
      update(id: ID, patch: Partial<Pick<SupporterEntity, 'name' | 'kind' | 'active' | 'logo' | 'placement' | 'orientation' | 'primary' | 'order'>>) {
        mutate((d) => {
          if (!isLeaderId(d, me())) throw new Error('للقائد العام');
          Object.assign(d.supporters.find((x) => x.id === id)!, patch);
        });
      },
      /** الدخول بكلمة المرور: حد للمحاولات الخاطئة ثم قفل مؤقت */
      login(password: string): ID | null {
        let found: ID | null = null;
        mutate((d) => {
          const locked = supporterLocked(d);
          if (locked) throw new Error(locked);
          const sp = findSupporterByPassword(d, password);
          if (!sp || !sp.active) {
            d.supporterAccess.failed += 1;
            if (d.supporterAccess.failed >= d.settings.supporterLink.maxAttempts) d.supporterAccess = { failed: 0, lockedUntil: new Date(Date.now() + d.settings.supporterLink.lockMinutes * 60000).toISOString() };
            return;
          }
          d.supporterAccess = { failed: 0 };
          found = sp.id;
        });
        return found;
      },
      /** تعليق الزائر بعد الدخول: لا يظهر إلا بعد الموافقة من «رابط المتابعة» */
      comment(entityId: ID, name: string, text: string) {
        mutate((d) => {
          const sp = d.supporters.find((x) => x.id === entityId && x.active);
          if (!sp) throw new Error('سجّل الدخول أولاً');
          if (!text.trim()) throw new Error('اكتب التعليق');
          d.trackingComments.push({ id: uid('tc'), entityId, name: name.trim() || sp.name, text: text.trim(), at: nowISO(), status: d.settings.trackingCommentsNeedReview ? 'pending' : 'visible' });
          pushNotification(d, staffIds(d).filter((x) => d.memberships.some((m) => m.personId === x && d.committees.find((c) => c.id === m.committeeId)?.kind === 'media')), 'general', `تعليق جديد في رابط الداعم من ${sp.name}`, '/app/tracking-link');
        });
      },
    },

    // ───────────── الملف الشخصي والختامي ─────────────
    profile: {
      /** صاحب الحساب يعبّئ ملفه وصورته وبياناته المالية (أول دخول) */
      saveOwn(patch: Partial<Pick<Person, 'phone' | 'university' | 'major' | 'photo' | 'bank'>>, complete = false) {
        mutate((d) => {
          const p = d.persons.find((x) => x.id === me())!;
          if (complete && p.kind === 'participant') {
            const bank = patch.bank ?? p.bank;
            if (!bank?.iban || !/^SA\d{22}$/.test(bank.iban.replace(/\s/g, ''))) throw new Error('أدخل رقم آيبان سعودي صحيح (SA متبوعاً بـ 22 رقماً)');
            if (!(patch.photo ?? p.photo)) throw new Error('أضف صورتك الشخصية');
          }
          Object.assign(p, patch);
          if (p.bank) p.bank.iban = p.bank.iban.replace(/\s/g, '').toUpperCase();
          if (complete) p.profileCompletedAt = nowISO();
        });
      },
      /** القائد العام يضيف بيانات فريق العمل التي تظهر في رابط الداعم والموقع العام */
      saveStaff(personId: ID, patch: Partial<Pick<Person, 'title' | 'phone' | 'photo'>>) {
        mutate((d) => {
          if (!isLeaderId(d, me())) throw new Error('بيانات فريق العمل يضيفها القائد العام');
          const p = d.persons.find((x) => x.id === personId && x.kind === 'staff');
          if (!p) throw new Error('ليس من فريق العمل');
          Object.assign(p, patch);
        });
      },
    },
    finalFiles: {
      /** الميسّر يرفع الملف الختامي لكل مشارك في مجموعته (نصائح وبيانات يحمّلها المشارك) */
      upload(participantId: ID, advice: string, attachment: Attachment) {
        mutate((d) => {
          const g = groupOf(d, participantId);
          if (g?.facilitatorId !== me()) throw new Error('الملف الختامي يرفعه ميسّر المجموعة');
          const err = attachmentError(attachment, 'ملف الختام');
          if (err) throw new Error(err);
          if (!advice.trim()) throw new Error('اكتب النصائح');
          d.finalFiles = d.finalFiles.filter((f) => f.participantId !== participantId);
          d.finalFiles.push({ participantId, advice: advice.trim(), attachment, uploadedBy: me(), at: nowISO() });
          pushNotification(d, [participantId], 'general', 'رفع ميسّرك ملفك الختامي', '/app/plans');
        });
      },
    },
  };
}

export type Repositories = ReturnType<typeof createLocalRepositories>;

// أدوات مساعدة تُستخدم في الشاشات
export { effectiveTrackerId, addDays };
