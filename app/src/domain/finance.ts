// المنطق المالي: الصلاحيات المفوّضة، أنواع الصرف، المرصود، مسار الطلب، الحالة والخطوة التالية.
// دوال نقية لا تعتمد على الواجهة. حسابات المحفظة والعهدة ونماذج الصرف في ledger.ts
import { tripTeamLeaderId } from './permissions';
import type { AllocationRule, BudgetOwnerKind, BudgetRequest, DB, FinancePermission, FocusMeeting, ID, Trip, SpendKind } from './types';

// ───────────── الصلاحيات ─────────────
export const FINANCE_PERMS: { key: FinancePermission; label: string; hint: string }[] = [
  { key: 'view_budget', label: 'عرض الموازنة', hint: 'يرى الموازنة العامة والمحفظة والتحليل' },
  { key: 'manage_categories', label: 'إدارة التصنيفات', hint: 'يضيف ويعدّل ويخفي تصنيفات الصرف وبنودها' },
  { key: 'approve_within', label: 'الموافقة ضمن المرصود', hint: 'يوافق أو يرفض الطلبات التي لا تتجاوز المرصود' },
  { key: 'disburse', label: 'الصرف والإيداع', hint: 'يسجّل الإيداعات، ويحوّل العهد، ويصرف مباشرة ويدفع العقود' },
  { key: 'review_invoices', label: 'مراجعة نماذج الصرف', hint: 'يراجع كل بند: يعدّل التصنيف والمبلغ ثم يقبل أو يرفض' },
  { key: 'close_custody', label: 'إغلاق العهد', hint: 'يسوّي الفائض أو العجز ويعتمد الإغلاق' },
];

export function financeCommitteeId(db: DB): ID | undefined {
  return db.committees.find((c) => c.kind === 'finance')?.id;
}
/** مسؤول المالية: المالك الوحيد للجانب المالي */
export function financeOwnerId(db: DB): ID | undefined {
  const cid = financeCommitteeId(db);
  return db.memberships.find((m) => m.committeeId === cid && m.role === 'leader')?.personId;
}
export function isFinanceOwner(db: DB, pid: ID) {
  return financeOwnerId(db) === pid;
}
export function isFinanceMember(db: DB, pid: ID) {
  const cid = financeCommitteeId(db);
  return db.memberships.some((m) => m.committeeId === cid && m.personId === pid);
}
export function financePermsOf(db: DB, pid: ID): FinancePermission[] {
  if (isFinanceOwner(db, pid)) return FINANCE_PERMS.map((p) => p.key);
  const cid = financeCommitteeId(db);
  return db.memberships.find((m) => m.committeeId === cid && m.personId === pid)?.financePerms ?? [];
}
export function hasFinancePerm(db: DB, pid: ID, perm: FinancePermission) {
  return financePermsOf(db, pid).includes(perm);
}
export function isLeaderId(db: DB, pid: ID) {
  return !!db.persons.find((p) => p.id === pid)?.isGeneralLeader;
}
/** من يدخل القسم المالي: أعضاء اللجنة المالية والقائد العام (مراقب) */
export function canOpenFinance(db: DB, pid: ID) {
  return isLeaderId(db, pid) || isFinanceMember(db, pid);
}
/** الموازنة العامة: القائد العام ومن يحدده مسؤول المالية */
export function canViewBudget(db: DB, pid: ID) {
  return isLeaderId(db, pid) || hasFinancePerm(db, pid, 'view_budget');
}

// ───────────── أنواع الصرف ─────────────
export const spendKindLabel: Record<SpendKind, string> = {
  internal_trip: 'الرحلات الداخلية',
  external_trip: 'الرحلات الخارجية',
  focus: 'لقاءات التركيز (ومنها العمرة)',
  opening: 'اللقاء الافتتاحي',
  closing: 'اللقاء الختامي',
  meeting: 'الاجتماعات',
  program_needs: 'احتياجات البرنامج',
};
export const ALL_SPEND_KINDS: SpendKind[] = ['internal_trip', 'external_trip', 'focus', 'opening', 'closing', 'meeting', 'program_needs'];
export const spendKindGroup: Record<SpendKind, 'تنفيذ البرنامج' | 'إداري'> = {
  internal_trip: 'تنفيذ البرنامج', external_trip: 'تنفيذ البرنامج', focus: 'تنفيذ البرنامج',
  opening: 'إداري', closing: 'إداري', meeting: 'إداري', program_needs: 'إداري',
};
/** نوع العهدة لقاعدة العهد المتزامنة: لا يتكرر النوع (الرحلات الداخلية والخارجية نوع واحد) */
export function custodyFamily(kind: SpendKind): string {
  return kind === 'internal_trip' || kind === 'external_trip' ? 'trips' : kind;
}
/** ما يُصرف عليه بعهدة يفتحها مسؤول المالية مباشرة بلا طلب (يقفلها صاحبها) */
export const DIRECT_CUSTODY_KINDS: SpendKind[] = ['opening', 'closing', 'program_needs'];

export function spendKindOfTrip(trip: Pick<Trip, 'type'>): SpendKind {
  return trip.type === 'internal' ? 'internal_trip' : 'external_trip';
}
export function spendKindOf(db: DB, ownerKind: BudgetOwnerKind, ownerId: ID): SpendKind {
  if (ownerKind === 'focus') return 'focus';
  if (ownerKind === 'meeting') return 'meeting';
  if (ownerKind === 'need') return 'program_needs';
  if (ownerKind === 'event') return db.events.find((e) => e.id === ownerId)?.kind ?? 'opening';
  const t = db.trips.find((x) => x.id === ownerId);
  return t ? spendKindOfTrip(t) : 'internal_trip';
}

// ───────────── المرصود ─────────────
export function perItem(rule: AllocationRule): number {
  if (rule.mode === 'per_item') return rule.perItem;
  return rule.divisor > 0 ? Math.round((rule.total / rule.divisor) * 100) / 100 : 0;
}
/** المقسوم عليه الافتراضي: لقاءات التركيز المعتمدة = عدد المجموعات × الحد الأدنى، والرحلات = عددها */
export function defaultDivisor(db: DB, kind: 'focus' | 'internal_trip' | 'external_trip'): number {
  if (kind === 'focus') return db.groups.length * db.programBudget.focusLimits.min;
  const type = kind === 'internal_trip' ? 'internal' : 'external';
  return db.trips.filter((t) => t.type === type).length;
}

/** ترتيب لقاء التركيز داخل مجموعته (بترتيب الإنشاء) */
export function focusIndex(db: DB, fm: FocusMeeting): number {
  return db.focusMeetings.filter((f) => f.groupId === fm.groupId).findIndex((f) => f.id === fm.id) + 1;
}
export function focusHasBudgetSlot(db: DB, fm: FocusMeeting): boolean {
  return focusIndex(db, fm) <= db.programBudget.focusLimits.max;
}
/** عداد "3 من 8": اللقاءات المحسوبة بميزانية في المجموعة */
export function focusCounter(db: DB, groupId: ID) {
  const n = db.focusMeetings.filter((f) => f.groupId === groupId).length;
  const { min, max } = db.programBudget.focusLimits;
  return { withBudget: Math.min(n, max), total: n, min, max, overflow: Math.max(0, n - max) };
}

/** ميزانية الاجتماعات معتمدة: الموازنة العامة محفوظة ولها مرصود للاجتماع. عندها فقط يظهر الطلب في نموذج الإنشاء */
export function meetingBudgetReady(db: DB) {
  return db.programBudget.setupDone && db.programBudget.meetingDefault > 0;
}

export function allocatedFor(db: DB, ownerKind: BudgetOwnerKind, ownerId: ID): number {
  const b = db.programBudget;
  if (ownerKind === 'focus') {
    const fm = db.focusMeetings.find((f) => f.id === ownerId);
    if (!fm || !focusHasBudgetSlot(db, fm)) return 0;
    return fm.isUmrah ? b.umrahPerGroup : perItem(b.focus);
  }
  if (ownerKind === 'meeting') {
    const m = db.meetings.find((x) => x.id === ownerId);
    return m?.allocated ?? b.meetingDefault;
  }
  if (ownerKind === 'need') return 0; // احتياجات البرنامج مرصودها إجمالي لا لكل بند
  if (ownerKind === 'event') return db.events.find((e) => e.id === ownerId)?.kind === 'closing' ? b.closing : b.opening;
  const t = db.trips.find((x) => x.id === ownerId);
  if (!t) return 0;
  return perItem(spendKindOfTrip(t) === 'internal_trip' ? b.internalTrip : b.externalTrip);
}

// ───────────── الطلبات ─────────────
/** مسار الطلب الأول: ميزانية رحلة المجموعة تمر بالميسّر ثم القائد العام، ورحلات فريق العمل للقائد العام مباشرة،
 *  وبقية الطلبات حسب المرصود: ضمنه لمسؤول المالية، وأعلى منه للقائد العام */
export function firstStatusFor(db: DB, ownerKind: BudgetOwnerKind, ownerId: ID, amount: number, allocated: number): BudgetRequest['status'] {
  if (ownerKind === 'trip') {
    const t = db.trips.find((x) => x.id === ownerId);
    return t?.executor.kind === 'group' ? 'pending_facilitator' : 'pending_leader';
  }
  return amount <= allocated ? 'pending_finance' : 'pending_leader';
}
export function requestFor(db: DB, ownerKind: BudgetOwnerKind, ownerId: ID): BudgetRequest | undefined {
  const list = db.budgetRequests.filter((r) => r.ownerKind === ownerKind && r.ownerId === ownerId);
  return list[list.length - 1];
}
export function custodyForRequest(db: DB, r: BudgetRequest) {
  return db.custodies.find((c) => c.requestId === r.id) ?? db.custodies.find((c) => c.ownerKind === r.ownerKind && c.ownerId === r.ownerId);
}
export function isBudgetApproved(db: DB, ownerKind: BudgetOwnerKind, ownerId: ID) {
  const r = requestFor(db, ownerKind, ownerId);
  return r?.status === 'approved';
}
export function linesTotal(lines: { qty: number; price: number }[]) {
  return lines.reduce((s, l) => s + l.qty * l.price, 0);
}
export function ownerTitle(db: DB, ownerKind: BudgetOwnerKind, ownerId: ID) {
  if (ownerKind === 'trip') return db.trips.find((t) => t.id === ownerId)?.title ?? 'رحلة';
  if (ownerKind === 'focus') return db.focusMeetings.find((f) => f.id === ownerId)?.title ?? 'لقاء تركيز';
  if (ownerKind === 'need') return db.programNeeds.find((n) => n.id === ownerId)?.title ?? 'احتياج';
  if (ownerKind === 'event') return db.events.find((e) => e.id === ownerId)?.title ?? 'لقاء';
  return db.meetings.find((m) => m.id === ownerId)?.title ?? 'اجتماع';
}
export function ownerLink(ownerKind: BudgetOwnerKind, ownerId: ID) {
  if (ownerKind === 'trip') return `/app/trips/${ownerId}?tab=budget`;
  if (ownerKind === 'focus') return `/app/focus/${ownerId}`;
  if (ownerKind === 'need' || ownerKind === 'event') return '/app/finance?tab=needs';
  return `/app/meetings/${ownerId}`;
}
/** ميسّر المجموعة المنفِّذة لرحلة (لمسار ميزانية الرحلة) */
export function tripBudgetFacilitatorId(db: DB, ownerId: ID): ID | undefined {
  const t = db.trips.find((x) => x.id === ownerId);
  if (!t || t.executor.kind !== 'group') return undefined;
  const gid = t.executor.groupId;
  return db.groups.find((g) => g.id === gid)?.facilitatorId;
}
/** من يقدّم الطلب: الميسّر للقاء التركيز، وقائد الفريق للرحلة، ومسؤول الاجتماع للاجتماع */
export function submitterOf(db: DB, ownerKind: BudgetOwnerKind, ownerId: ID): ID | undefined {
  if (ownerKind === 'focus') {
    const fm = db.focusMeetings.find((f) => f.id === ownerId);
    return db.groups.find((g) => g.id === fm?.groupId)?.facilitatorId;
  }
  if (ownerKind === 'trip') {
    const t = db.trips.find((x) => x.id === ownerId);
    return t ? tripTeamLeaderId(db, t) : undefined;
  }
  if (ownerKind === 'meeting') return db.meetings.find((m) => m.id === ownerId)?.ownerId;
  return undefined;
}

export type Tone = 'gray' | 'blue' | 'green' | 'red' | 'orange' | 'purple';
export interface Stage {
  label: string;
  tone: Tone;
  next: string;
  waitingOn: string; // من ينتظره الطلب الآن
  waitingOnId?: ID;
}

/** حالة الطلب مع الخطوة التالية ومن ينتظره (تشمل مرحلة العهدة بعد الصرف) */
export function requestStage(db: DB, r: BudgetRequest): Stage {
  const name = (id?: ID) => db.persons.find((p) => p.id === id)?.name ?? '—';
  const owner = financeOwnerId(db);
  const leader = db.persons.find((p) => p.isGeneralLeader)?.id;
  const over = r.amount > r.allocated;
  switch (r.status) {
    case 'draft':
      return { label: 'مسودة', tone: 'gray', next: 'أرسل الطلب', waitingOn: name(r.requestedBy), waitingOnId: r.requestedBy };
    case 'pending_facilitator': {
      const fac = tripBudgetFacilitatorId(db, r.ownerId);
      return { label: 'بانتظار الميسّر', tone: 'blue', next: 'يعتمد الميسّر أو يعيدها بسبب', waitingOn: name(fac), waitingOnId: fac };
    }
    case 'pending_finance':
      return { label: 'بانتظار مسؤول المالية', tone: 'blue', next: 'يوافق أو يرفض بسبب', waitingOn: name(owner), waitingOnId: owner };
    case 'pending_leader':
      return { label: over ? 'بانتظار القائد العام (يتجاوز المرصود)' : 'بانتظار القائد العام', tone: over ? 'orange' : 'blue', next: 'يعتمد، أو يرفض، أو يطلب موازنة تفصيلية', waitingOn: name(leader), waitingOnId: leader };
    case 'needs_detail':
      return { label: 'مطلوب موازنة تفصيلية', tone: 'orange', next: 'عبّئ جدول الموازنة وأرسله للقائد العام', waitingOn: name(r.requestedBy), waitingOnId: r.requestedBy };
    case 'rejected':
      return { label: 'مرفوض: أُعيد لمقدّم الطلب', tone: 'red', next: 'عدّل الطلب وأعد إرساله', waitingOn: name(r.requestedBy), waitingOnId: r.requestedBy };
  }
  const c = custodyForRequest(db, r);
  if (!c) return { label: 'معتمد: بانتظار صرف العهدة', tone: 'blue', next: 'يحوّل مسؤول المالية العهدة مع الإيصال', waitingOn: name(owner), waitingOnId: owner };
  if (c.status === 'closed') return { label: 'مغلق', tone: 'green', next: 'لا إجراء', waitingOn: '—' };
  if (c.status === 'closing') return { label: 'قيد الإغلاق المالي', tone: 'purple', next: 'تراجع المالية البنود وتسوّي ثم تعتمد الإغلاق', waitingOn: name(owner), waitingOnId: owner };
  const pending = db.spendForms.filter((f) => f.custodyId === c.id).flatMap((f) => f.lines).filter((l) => l.status === 'pending').length;
  if (pending) return { label: `${pending} بنود صرف بانتظار المراجعة`, tone: 'blue', next: 'تراجع المالية كل بند', waitingOn: name(owner), waitingOnId: owner };
  const transferred = c.transfers.reduce((s, t) => s + t.amount, 0);
  if (transferred < c.approved) return { label: 'العهدة مفعّلة (بقيت دفعة)', tone: 'green', next: 'يرفع المستلم نماذج الصرف، وتحوّل المالية الباقي', waitingOn: name(c.recipientId), waitingOnId: c.recipientId };
  return { label: 'العهدة مفعّلة: التنفيذ ورفع نماذج الصرف', tone: 'green', next: 'يرفع المستلم نماذج الصرف ثم يطلب الإغلاق', waitingOn: name(c.recipientId), waitingOnId: c.recipientId };
}

export function canFacilitatorDecide(db: DB, pid: ID, r: BudgetRequest) {
  return r.status === 'pending_facilitator' && tripBudgetFacilitatorId(db, r.ownerId) === pid;
}
export function canFinanceDecide(db: DB, pid: ID, r: BudgetRequest) {
  return r.status === 'pending_finance' && hasFinancePerm(db, pid, 'approve_within') && r.requestedBy !== pid;
}
export function canLeaderDecide(db: DB, pid: ID, r: BudgetRequest) {
  return r.status === 'pending_leader' && isLeaderId(db, pid);
}
export function canEditRequest(db: DB, pid: ID, r: BudgetRequest) {
  return r.requestedBy === pid && ['draft', 'rejected', 'needs_detail'].includes(r.status);
}
export function canDisburse(db: DB, pid: ID, r: BudgetRequest) {
  return r.status === 'approved' && !custodyForRequest(db, r) && hasFinancePerm(db, pid, 'disburse');
}
