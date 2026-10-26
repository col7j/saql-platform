// حسابات المال الفعلي: محفظة مسؤول المالية، أرقام العهدة، نماذج الصرف، الإغلاق، كشف التكرار والتجزئة،
// إجمالي مصروف النشاط (العهدة + المباشر)، والموازنة العامة مقابل المصروف. دوال نقية.
import { addDays } from './dates';
import { custodyFamily, ownerTitle, perItem, spendKindLabel, spendKindOf, spendKindOfTrip } from './finance';
import type { Attachment, BudgetOwnerKind, Custody, DB, ID, SpendForm, SpendKind, SpendLine, WalletEntryKind } from './types';

const r2 = (n: number) => Math.round(n * 100) / 100;
/** تصنيف دفعات العقود في التحليل */
export const CONTRACTS_CATEGORY = 'العقود';

// ───────────── الإثبات الإلزامي ─────────────
export function attachmentError(a: Attachment | undefined, what: string): string | null {
  if (!a || !a.hash || !a.name) return `${what} إلزامي: لا يُسجَّل مبلغ بلا مرفق`;
  return null;
}

// ───────────── المحفظة ─────────────
export const WALLET_IN: WalletEntryKind[] = ['deposit', 'surplus_return'];
export const walletKindLabel: Record<WalletEntryKind, string> = {
  deposit: 'إيداع', surplus_return: 'فائض عهدة مُرجَع', custody_transfer: 'تحويل عهدة', direct_spend: 'صرف مباشر', contract_payment: 'دفعة عقد', deficit_payout: 'تحويل عجز عهدة',
};
export function walletFigures(db: DB) {
  const sum = (kinds: WalletEntryKind[]) => r2(db.wallet.filter((e) => kinds.includes(e.kind)).reduce((s, e) => s + e.amount, 0));
  const deposits = sum(['deposit']);
  const returned = sum(['surplus_return']);
  const toCustody = sum(['custody_transfer']);
  const direct = sum(['direct_spend']);
  const contracts = sum(['contract_payment']);
  const deficits = sum(['deficit_payout']);
  const balance = r2(deposits + returned - toCustody - direct - contracts - deficits);
  return { deposits, returned, toCustody, direct, contracts, deficits, balance, in: r2(deposits + returned), out: r2(toCustody + direct + contracts + deficits) };
}
export function walletBalance(db: DB) {
  return walletFigures(db).balance;
}
export function insufficientFunds(db: DB, amount: number): string | null {
  const b = walletBalance(db);
  return amount > b + 0.009 ? `الرصيد الفعلي ${b} ر.س لا يكفي لـ ${r2(amount)} ر.س. سجّل إيداعاً، أو اصرف جزءاً وأجّل الباقي.` : null;
}

// ───────────── العهدة ─────────────
export function formsOf(db: DB, custodyId: ID): SpendForm[] {
  return db.spendForms.filter((f) => f.custodyId === custodyId);
}
export function custodyLines(db: DB, custodyId: ID): (SpendLine & { form: SpendForm })[] {
  return formsOf(db, custodyId).flatMap((form) => form.lines.map((l) => ({ ...l, form })));
}
export function custodyFigures(db: DB, c: Custody) {
  const lines = custodyLines(db, c.id);
  const transferred = r2(c.transfers.reduce((s, t) => s + t.amount, 0));
  const accepted = r2(lines.filter((l) => l.status === 'accepted').reduce((s, l) => s + l.amount, 0));
  const held = r2(lines.filter((l) => l.status === 'pending').reduce((s, l) => s + l.amount, 0)); // محجوز حتى تُراجَع
  const balance = r2(transferred - accepted); // رصيد العهدة بعد الخصم
  return {
    transferred,
    toTransfer: r2(Math.max(0, c.approved - transferred)), // الدفعة المؤجّلة
    accepted,
    held,
    balance,
    available: r2(balance - held),
    surplus: r2(Math.max(0, balance)),
    deficit: r2(Math.max(0, -balance)),
    pendingLines: lines.filter((l) => l.status === 'pending').length,
    rejected: lines.filter((l) => l.status === 'rejected').length,
    lines,
  };
}

/** قاعدة العهد المتزامنة: عدد أقصى للعهد المفتوحة للشخص، ولا يتكرر نوعها */
export function openCustodyConflict(db: DB, recipientId: ID, kind: SpendKind): string | null {
  const open = db.custodies.filter((c) => c.recipientId === recipientId && c.status !== 'closed');
  if (open.some((c) => custodyFamily(c.spendKind) === custodyFamily(kind)))
    return `لدى المستلم عهدة مفتوحة من النوع نفسه (${spendKindLabel[kind]}). تُغلق أولاً قبل فتح عهدة جديدة منه.`;
  if (open.length >= db.settings.finance.maxOpenCustodies)
    return `لدى المستلم ${open.length} عهد مفتوحة، والحد المسموح ${db.settings.finance.maxOpenCustodies} (يغيّره مسؤول المالية).`;
  return null;
}

/** شروط إغلاق العهدة: طلب الإغلاق، ومراجعة كل البنود، وتسوية الفائض أو العجز بإيصال */
export function custodyCloseChecks(db: DB, c: Custody) {
  const f = custodyFigures(db, c);
  const checks = [
    { label: 'أرسل صاحب العهدة طلب الإغلاق', ok: c.status === 'closing' || c.status === 'closed' },
    { label: 'رُفع نموذج صرف واحد على الأقل', ok: f.lines.length > 0 },
    { label: 'رُوجعت كل بنود الصرف', ok: f.pendingLines === 0 },
  ];
  if (f.surplus > 0.009) checks.push({ label: `حُوّل الفائض (${f.surplus} ر.س) لحساب مسؤول المالية بإيصال`, ok: c.settlement?.kind === 'surplus' });
  if (f.deficit > 0.009) checks.push({ label: `سُوّي العجز (${f.deficit} ر.س) بتحويل أو تسوية خارجية`, ok: c.settlement?.kind === 'deficit' });
  return checks;
}

// ───────────── كشف التكرار والتجزئة (بلا ذكاء اصطناعي) ─────────────
interface ProofLike {
  id: ID;
  vendor: string;
  serial?: string;
  invoiceDate: string;
  amount: number;
  hash: string;
  label: string;
}
function allProofs(db: DB): ProofLike[] {
  const forms = db.spendForms.map((f) => ({ id: f.id, vendor: f.vendor, serial: f.serial, invoiceDate: f.invoiceDate, amount: r2(f.lines.reduce((s, l) => s + (l.original?.amount ?? l.amount), 0)), hash: f.attachment.hash, label: `نموذج صرف — ${custodyTitle(db, f.custodyId)}` }));
  const direct = db.directSpends.map((d) => ({ id: d.id, vendor: d.vendor, serial: d.serial, invoiceDate: d.invoiceDate, amount: d.total, hash: d.attachment.hash, label: 'صرف مباشر' }));
  const contracts = db.contracts.flatMap((c) => c.payments.filter((p) => p.attachment).map((p) => ({ id: p.id, vendor: c.vendor, serial: undefined, invoiceDate: (p.paidAt ?? p.dueDate).slice(0, 10), amount: p.amount, hash: p.attachment!.hash, label: `دفعة عقد — ${c.title}` })));
  return [...forms, ...direct, ...contracts];
}
const norm = (s?: string) => (s ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

/** تحذيرات التكرار لإثبات: بالرقم التسلسلي والمورد، أو المورد والمبلغ والتاريخ، أو بصمة الصورة */
export function duplicateWarnings(db: DB, p: Omit<ProofLike, 'label'>): string[] {
  const out: string[] = [];
  for (const o of allProofs(db)) {
    if (o.id === p.id) continue;
    if (o.hash === p.hash) out.push(`الصورة نفسها مرفوعة من قبل (${o.label})`);
    else if (p.serial && o.serial && norm(o.serial) === norm(p.serial) && norm(o.vendor) === norm(p.vendor)) out.push(`الرقم التسلسلي ${p.serial} لنفس المورد مسجّل من قبل (${o.label})`);
    else if (norm(o.vendor) === norm(p.vendor) && Math.abs(o.amount - p.amount) < 0.01 && o.invoiceDate === p.invoiceDate) out.push(`نفس المورد والمبلغ والتاريخ (${o.label})`);
  }
  return [...new Set(out)];
}
export function formDuplicateWarnings(db: DB, f: SpendForm): string[] {
  return duplicateWarnings(db, { id: f.id, vendor: f.vendor, serial: f.serial, invoiceDate: f.invoiceDate, amount: r2(f.lines.reduce((s, l) => s + (l.original?.amount ?? l.amount), 0)), hash: f.attachment.hash });
}

/** تجزئة المصروف: فواتير صغيرة متكررة لنفس المورد والنشاط في فترة قصيرة */
export function splitWarning(db: DB, f: SpendForm): string | null {
  const { maxAmount, windowDays, minCount } = db.settings.finance.splitAlert;
  const c = db.custodies.find((x) => x.id === f.custodyId);
  if (!c) return null;
  const small = (x: SpendForm) => x.lines.reduce((s, l) => s + (l.original?.amount ?? l.amount), 0) <= maxAmount;
  if (!small(f)) return null;
  const sameActivity = db.custodies.filter((x) => x.ownerKind === c.ownerKind && x.ownerId === c.ownerId).map((x) => x.id);
  const near = db.spendForms.filter((x) => sameActivity.includes(x.custodyId) && norm(x.vendor) === norm(f.vendor) && small(x)
    && x.invoiceDate >= addDays(f.invoiceDate, -windowDays) && x.invoiceDate <= addDays(f.invoiceDate, windowDays));
  return near.length >= minCount ? `احتمال تجزئة: ${near.length} فواتير صغيرة (≤ ${maxAmount} ر.س) لنفس المورد «${f.vendor}» والنشاط خلال ${windowDays} أيام` : null;
}

// ───────────── إجمالي مصروف النشاط والموازنة ─────────────
export function custodyTitle(db: DB, custodyId: ID) {
  const c = db.custodies.find((x) => x.id === custodyId);
  return c ? ownerTitle(db, c.ownerKind, c.ownerId) : 'عهدة';
}
/** إجمالي مصروفات النشاط = المقبول من العهدة + الصرف المباشر (حصته) + دفعات العقود */
export function activitySpend(db: DB, ownerKind: BudgetOwnerKind, ownerId: ID) {
  const custody = r2(db.custodies.filter((c) => c.ownerKind === ownerKind && c.ownerId === ownerId).reduce((s, c) => s + custodyFigures(db, c).accepted, 0));
  const direct = r2(db.directSpends.flatMap((d) => d.allocations).filter((a) => a.ownerKind === ownerKind && a.ownerId === ownerId).reduce((s, a) => s + a.amount, 0));
  const contracts = ownerKind === 'need' ? r2(db.contracts.filter((c) => c.needId === ownerId).flatMap((c) => c.payments).filter((p) => p.paidAt).reduce((s, p) => s + p.amount, 0)) : 0;
  return { custody, direct, contracts, total: r2(custody + direct + contracts) };
}

/** كل أسطر الصرف المعتمدة على مستوى البرنامج (للتحليل): من العهد (المقبولة) ومن الصرف المباشر بحسب التوزيع */
export function spentLines(db: DB) {
  const fromCustody = db.spendForms.flatMap((f) => {
    const c = db.custodies.find((x) => x.id === f.custodyId)!;
    return f.lines.filter((l) => l.status === 'accepted').map((l) => ({ categoryId: l.categoryId, customCategory: l.customCategory, item: l.item, amount: l.amount, ownerKind: c.ownerKind, ownerId: c.ownerId, spendKind: c.spendKind, source: 'custody' as const, vendor: f.vendor, date: f.invoiceDate, attachment: f.attachment }));
  });
  const fromDirect = db.directSpends.flatMap((d) => d.allocations.flatMap((a) => d.lines.map((l) => ({
    categoryId: l.categoryId, customCategory: l.customCategory, item: l.item, amount: r2((l.amount * a.amount) / (d.total || 1)), ownerKind: a.ownerKind, ownerId: a.ownerId, spendKind: spendKindOf(db, a.ownerKind, a.ownerId), source: 'direct' as const, vendor: d.vendor, date: d.invoiceDate, attachment: d.attachment,
  }))));
  const fromContracts = db.contracts.flatMap((c) => c.payments.filter((p) => p.paidAt).map((p) => ({
    categoryId: undefined, customCategory: CONTRACTS_CATEGORY, item: c.title, amount: p.amount, ownerKind: 'need' as BudgetOwnerKind, ownerId: c.needId, spendKind: 'program_needs' as SpendKind, source: 'contract' as const, vendor: c.vendor, date: (p.paidAt ?? p.dueDate).slice(0, 10), attachment: p.attachment!,
  })));
  return [...fromCustody, ...fromDirect, ...fromContracts];
}

export function budgetOverview(db: DB) {
  const b = db.programBudget;
  const lines = spentLines(db);
  const spentOf = (pred: (l: (typeof lines)[number]) => boolean) => r2(lines.filter(pred).reduce((s, l) => s + l.amount, 0));
  const isUmrah = (id: ID) => !!db.focusMeetings.find((f) => f.id === id)?.isUmrah;
  const approvedFor = (kind: SpendKind, umrah?: boolean) =>
    r2(db.budgetRequests.filter((r) => r.spendKind === kind && r.status === 'approved').filter((r) => (umrah === undefined ? true : isUmrah(r.ownerId) === umrah)).reduce((s, r) => s + r.amount, 0)
      + db.custodies.filter((c) => !c.requestId && c.spendKind === kind).reduce((s, c) => s + c.approved, 0));
  const tripsOf = (kind: SpendKind) => db.trips.filter((t) => spendKindOfTrip(t) === kind);
  const groups = db.groups.length;
  const focusUnits = groups * b.focusLimits.min;
  const tripRow = (key: 'internal_trip' | 'external_trip', rule: typeof b.internalTrip) => {
    const units = tripsOf(key).length;
    return { key, label: spendKindLabel[key], perUnit: perItem(rule), units, allocated: rule.mode === 'total' ? rule.total : perItem(rule) * units, approved: approvedFor(key), spent: spentOf((l) => l.spendKind === key) };
  };
  const rows = [
    tripRow('internal_trip', b.internalTrip),
    tripRow('external_trip', b.externalTrip),
    { key: 'focus', label: 'لقاءات التركيز', perUnit: perItem(b.focus), units: b.focus.mode === 'total' ? b.focus.divisor : focusUnits, allocated: b.focus.mode === 'total' ? b.focus.total : perItem(b.focus) * focusUnits, approved: approvedFor('focus', false), spent: spentOf((l) => l.spendKind === 'focus' && !isUmrah(l.ownerId)) },
    { key: 'umrah', label: 'لقاء العمرة', perUnit: b.umrahPerGroup, units: groups, allocated: b.umrahPerGroup * groups, approved: approvedFor('focus', true), spent: spentOf((l) => l.spendKind === 'focus' && isUmrah(l.ownerId)) },
    { key: 'opening', label: spendKindLabel.opening, perUnit: b.opening, units: 1, allocated: b.opening, approved: approvedFor('opening'), spent: spentOf((l) => l.spendKind === 'opening') },
    { key: 'closing', label: spendKindLabel.closing, perUnit: b.closing, units: 1, allocated: b.closing, approved: approvedFor('closing'), spent: spentOf((l) => l.spendKind === 'closing') },
    { key: 'meeting', label: spendKindLabel.meeting, perUnit: b.meetingDefault, units: db.meetings.length, allocated: r2(db.meetings.reduce((s, m) => s + (m.allocated ?? b.meetingDefault), 0)), approved: approvedFor('meeting'), spent: spentOf((l) => l.spendKind === 'meeting') },
    { key: 'program_needs', label: spendKindLabel.program_needs, perUnit: b.programNeeds, units: 1, allocated: b.programNeeds, approved: approvedFor('program_needs'), spent: spentOf((l) => l.spendKind === 'program_needs') },
  ];
  return { rows, total: r2(rows.reduce((s, r) => s + r.allocated, 0)), spent: r2(rows.reduce((s, r) => s + r.spent, 0)) };
}

