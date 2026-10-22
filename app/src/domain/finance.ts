// المنطق المالي: الصلاحيات المفوّضة، قاعدة الصرف المسموح، المرصود، مسار الطلب، الحالة والخطوة التالية.
// دوال نقية لا تعتمد على الواجهة.
import type {
  AllocationRule, BudgetOwnerKind, BudgetRequest, DB, FinancePermission, FocusMeeting, ID, InvoiceLine, SpendKind, Trip,
} from './types';

// ───────────── الصلاحيات ─────────────
export const FINANCE_PERMS: { key: FinancePermission; label: string; hint: string }[] = [
  { key: 'view_budget', label: 'عرض الميزانية', hint: 'يرى الميزانية والأرقام والتحليل' },
  { key: 'manage_categories', label: 'إدارة التصنيفات', hint: 'يضيف ويعدّل ويخفي التصنيفات والبنود' },
  { key: 'approve_within', label: 'الموافقة ضمن المرصود', hint: 'يوافق أو يرفض الطلبات التي لا تتجاوز المرصود' },
  { key: 'disburse', label: 'صرف العهد', hint: 'يصرف العهدة ويحوّل الدفعات' },
  { key: 'review_invoices', label: 'مراجعة الفواتير', hint: 'يقبل الفواتير أو يرفضها بسبب' },
  { key: 'close_custody', label: 'إغلاق العهد', hint: 'يعتمد الإغلاق المالي' },
];

export function financeCommitteeId(db: DB): ID | undefined {
  return db.committees.find((c) => c.kind === 'finance')?.id;
}
/** مسؤول اللجنة المالية: المالك الوحيد للجانب المالي */
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
function isLeader(db: DB, pid: ID) {
  return !!db.persons.find((p) => p.id === pid)?.isGeneralLeader;
}
/** من يدخل القسم المالي: أعضاء اللجنة المالية والقائد العام فقط */
export function canOpenFinance(db: DB, pid: ID) {
  return isLeader(db, pid) || isFinanceMember(db, pid);
}
/** من يرى أرقام الميزانية العامة */
export function canViewBudget(db: DB, pid: ID) {
  return isLeader(db, pid) || hasFinancePerm(db, pid, 'view_budget');
}

// ───────────── قاعدة الصرف المسموح ─────────────
export const spendKindLabel: Record<SpendKind, string> = {
  opening: 'اللقاء الافتتاحي',
  focus: 'لقاءات التركيز (ومنها العمرة)',
  internal_trip: 'الرحلات الداخلية',
  external_trip: 'الرحلات الخارجية',
  closing: 'اللقاء الختامي',
  meeting: 'الاجتماعات',
};
export const ALL_SPEND_KINDS: SpendKind[] = ['opening', 'focus', 'internal_trip', 'external_trip', 'closing', 'meeting'];
export const DEFAULT_SPENDABLE: SpendKind[] = ['opening', 'focus', 'internal_trip', 'external_trip', 'closing'];

export function spendKindOfTrip(trip: Pick<Trip, 'milestone' | 'type'>): SpendKind {
  if (trip.milestone) return trip.milestone;
  return trip.type === 'internal' ? 'internal_trip' : 'external_trip';
}
export function spendKindOf(db: DB, ownerKind: BudgetOwnerKind, ownerId: ID): SpendKind {
  if (ownerKind === 'focus') return 'focus';
  if (ownerKind === 'meeting') return 'meeting';
  const t = db.trips.find((x) => x.id === ownerId);
  return t ? spendKindOfTrip(t) : 'internal_trip';
}
export function isSpendable(db: DB, kind: SpendKind) {
  return db.settings.spendableTypes.includes(kind);
}
/** رسالة المنع إن كان النوع غير مسموح (null = مسموح) */
export function spendBlockReason(db: DB, kind: SpendKind): string | null {
  if (isSpendable(db, kind)) return null;
  const allowed = db.settings.spendableTypes.map((k) => spendKindLabel[k]).join('، ');
  return `لا يُسمح بالصرف أو العهد على «${spendKindLabel[kind]}». الصرف مسموح فقط على: ${allowed}. يمكن للمسؤول المالي تغيير ذلك من إعدادات الميزانية.`;
}
export function assertSpendable(db: DB, kind: SpendKind) {
  const r = spendBlockReason(db, kind);
  if (r) throw new Error(r);
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
  return db.trips.filter((t) => t.type === type && !t.milestone).length;
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
  const t = db.trips.find((x) => x.id === ownerId);
  if (!t) return 0;
  const kind = spendKindOfTrip(t);
  if (kind === 'opening') return b.opening;
  if (kind === 'closing') return b.closing;
  return perItem(kind === 'internal_trip' ? b.internalTrip : b.externalTrip);
}

// ───────────── الطلبات ─────────────
export function routeFor(amount: number, allocated: number): 'pending_finance' | 'pending_leader' {
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
  return db.meetings.find((m) => m.id === ownerId)?.title ?? 'اجتماع';
}
export function ownerLink(ownerKind: BudgetOwnerKind, ownerId: ID) {
  return ownerKind === 'trip' ? `/app/trips/${ownerId}?tab=budget` : ownerKind === 'focus' ? `/app/focus/${ownerId}` : `/app/meetings/${ownerId}`;
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
  switch (r.status) {
    case 'draft':
      return { label: 'مسودة', tone: 'gray', next: 'أرسل الطلب', waitingOn: name(r.requestedBy), waitingOnId: r.requestedBy };
    case 'pending_finance':
      return { label: 'بانتظار مسؤول المالية', tone: 'blue', next: 'يوافق أو يرفض بسبب', waitingOn: name(owner), waitingOnId: owner };
    case 'pending_leader':
      return { label: 'بانتظار القائد العام (يتجاوز المرصود)', tone: 'orange', next: 'يعتمد، أو يرفض، أو يطلب موازنة تفصيلية', waitingOn: name(leader), waitingOnId: leader };
    case 'needs_detail':
      return { label: 'مطلوب موازنة تفصيلية', tone: 'orange', next: 'عبّئ جدول الموازنة وأرسله للقائد العام', waitingOn: name(r.requestedBy), waitingOnId: r.requestedBy };
    case 'rejected':
      return { label: 'مرفوض: أُعيد لمقدّم الطلب', tone: 'red', next: 'عدّل الطلب وأعد إرساله', waitingOn: name(r.requestedBy), waitingOnId: r.requestedBy };
  }
  const c = custodyForRequest(db, r);
  if (!c) return { label: 'معتمد: بانتظار صرف العهدة', tone: 'blue', next: 'يصرف المسؤول المالي العهدة', waitingOn: name(owner), waitingOnId: owner };
  if (c.status === 'closed') return { label: 'مغلق', tone: 'green', next: 'لا إجراء', waitingOn: '—' };
  if (c.status === 'closing') return { label: 'قيد الإغلاق المالي', tone: 'purple', next: 'تعتمد المالية الإغلاق', waitingOn: name(owner), waitingOnId: owner };
  const inst = c.installments;
  if (inst.some((i) => i.status === 'awaiting_iban')) return { label: 'صُرفت العهدة: بانتظار الآيبان', tone: 'orange', next: 'يرفع المستلم رقم الآيبان', waitingOn: name(c.recipientId), waitingOnId: c.recipientId };
  if (inst.some((i) => i.status === 'awaiting_transfer')) return { label: 'بانتظار تحويل المالية', tone: 'blue', next: 'تحوّل المالية الدفعة وترفع الإيصال', waitingOn: name(owner), waitingOnId: owner };
  if (inst.some((i) => i.status === 'awaiting_confirm')) return { label: 'بانتظار تأكيد الاستلام', tone: 'orange', next: 'يؤكد المستلم استلام الدفعة', waitingOn: name(c.recipientId), waitingOnId: c.recipientId };
  const pending = db.invoices.filter((i) => i.custodyId === c.id && i.status === 'pending').length;
  if (pending) return { label: `${pending} فواتير بانتظار المراجعة`, tone: 'blue', next: 'تراجع المالية الفواتير', waitingOn: name(owner), waitingOnId: owner };
  const rejected = db.invoices.filter((i) => i.custodyId === c.id && i.status === 'rejected').length;
  if (rejected) return { label: 'فاتورة مرفوضة تحتاج تعديلاً', tone: 'red', next: 'يعدّل المستلم الفاتورة ويعيد رفعها', waitingOn: name(c.recipientId), waitingOnId: c.recipientId };
  return { label: 'العهدة مفعّلة: التنفيذ ورفع الفواتير', tone: 'green', next: 'يرفع المستلم الفواتير ثم يطلب الإغلاق', waitingOn: name(c.recipientId), waitingOnId: c.recipientId };
}

export function canFinanceDecide(db: DB, pid: ID, r: BudgetRequest) {
  return r.status === 'pending_finance' && hasFinancePerm(db, pid, 'approve_within') && r.requestedBy !== pid;
}
export function canLeaderDecide(db: DB, pid: ID, r: BudgetRequest) {
  return r.status === 'pending_leader' && isLeader(db, pid);
}
export function canEditRequest(db: DB, pid: ID, r: BudgetRequest) {
  return r.requestedBy === pid && ['draft', 'rejected', 'needs_detail'].includes(r.status);
}
export function canDisburse(db: DB, pid: ID, r: BudgetRequest) {
  return r.status === 'approved' && !custodyForRequest(db, r) && hasFinancePerm(db, pid, 'disburse');
}

// ───────────── الفواتير ─────────────
/** يُمنع الإرسال إن اختلف مجموع الأسطر عن الإجمالي */
export function invoiceError(total: number, lines: Pick<InvoiceLine, 'categoryId' | 'amount' | 'description'>[], image: string): string | null {
  if (!image) return 'ارفع صورة الفاتورة (إلزامية).';
  if (!(total > 0)) return 'اكتب إجمالي الفاتورة.';
  if (!lines.length) return 'أضف سطراً واحداً على الأقل.';
  if (lines.some((l) => !l.categoryId || !(l.amount > 0))) return 'اختر تصنيفاً واكتب مبلغاً لكل سطر.';
  const sum = Math.round(lines.reduce((s, l) => s + l.amount, 0) * 100) / 100;
  if (Math.abs(sum - total) > 0.009) return `مجموع الأسطر (${sum}) لا يساوي إجمالي الفاتورة (${total}). عدّل المبالغ حتى يتطابقا.`;
  return null;
}

// ───────────── نظرة عامة على الميزانية ─────────────
export function budgetOverview(db: DB) {
  const b = db.programBudget;
  const acceptedFor = (pred: (ownerKind: BudgetOwnerKind, ownerId: ID) => boolean) =>
    db.invoices
      .filter((i) => i.status === 'accepted')
      .filter((i) => {
        const c = db.custodies.find((x) => x.id === i.custodyId);
        return !!c && pred(c.ownerKind, c.ownerId);
      })
      .reduce((s, i) => s + i.total, 0);
  const approvedFor = (kind: SpendKind, umrah?: boolean) =>
    db.budgetRequests
      .filter((r) => r.spendKind === kind && r.status === 'approved')
      .filter((r) => (umrah === undefined ? true : !!db.focusMeetings.find((f) => f.id === r.ownerId)?.isUmrah === umrah))
      .reduce((s, r) => s + r.amount, 0);
  const tripsOf = (kind: SpendKind) => db.trips.filter((t) => spendKindOfTrip(t) === kind);
  const groups = db.groups.length;
  const focusUnits = groups * b.focusLimits.min;
  const rows = [
    { key: 'opening', label: spendKindLabel.opening, perUnit: b.opening, units: 1, allocated: b.opening, approved: approvedFor('opening'), spent: acceptedFor((k, id) => k === 'trip' && tripsOf('opening').some((t) => t.id === id)) },
    { key: 'focus', label: 'لقاءات التركيز', perUnit: perItem(b.focus), units: b.focus.mode === 'total' ? b.focus.divisor : focusUnits, allocated: b.focus.mode === 'total' ? b.focus.total : perItem(b.focus) * focusUnits, approved: approvedFor('focus', false), spent: acceptedFor((k, id) => k === 'focus' && !db.focusMeetings.find((f) => f.id === id)?.isUmrah) },
    { key: 'umrah', label: 'لقاء العمرة', perUnit: b.umrahPerGroup, units: groups, allocated: b.umrahPerGroup * groups, approved: approvedFor('focus', true), spent: acceptedFor((k, id) => k === 'focus' && !!db.focusMeetings.find((f) => f.id === id)?.isUmrah) },
    { key: 'internal_trip', label: spendKindLabel.internal_trip, perUnit: perItem(b.internalTrip), units: tripsOf('internal_trip').length, allocated: b.internalTrip.mode === 'total' ? b.internalTrip.total : perItem(b.internalTrip) * tripsOf('internal_trip').length, approved: approvedFor('internal_trip'), spent: acceptedFor((k, id) => k === 'trip' && tripsOf('internal_trip').some((t) => t.id === id)) },
    { key: 'external_trip', label: spendKindLabel.external_trip, perUnit: perItem(b.externalTrip), units: tripsOf('external_trip').length, allocated: b.externalTrip.mode === 'total' ? b.externalTrip.total : perItem(b.externalTrip) * tripsOf('external_trip').length, approved: approvedFor('external_trip'), spent: acceptedFor((k, id) => k === 'trip' && tripsOf('external_trip').some((t) => t.id === id)) },
    { key: 'closing', label: spendKindLabel.closing, perUnit: b.closing, units: 1, allocated: b.closing, approved: approvedFor('closing'), spent: acceptedFor((k, id) => k === 'trip' && tripsOf('closing').some((t) => t.id === id)) },
    { key: 'meeting', label: 'الاجتماعات (للتخطيط)', perUnit: b.meetingDefault, units: db.meetings.length, allocated: db.meetings.reduce((s, m) => s + (m.allocated ?? b.meetingDefault), 0), approved: 0, spent: acceptedFor((k) => k === 'meeting') },
  ];
  return { rows, total: rows.reduce((s, r) => s + r.allocated, 0), spent: rows.reduce((s, r) => s + r.spent, 0) };
}
