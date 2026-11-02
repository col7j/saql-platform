// التقارير المالية (ملاحظات 11): صفوف الصرف الفعلي بفرز متعدد، وتصدير CSV، وبيانات اللوحة المالية.
// الفواتير الإضافية مستبعدة افتراضياً ولها مفتاح تضمين. السطر المرفوض لا يُحتسب.
import { ownerTitle, spendKindOf } from './finance';
import { walletBalance } from './ledger';
import type { BudgetOwnerKind, DB, ExtraInvoice, ID, SpendKind } from './types';

export type ReportScope = 'all' | 'trip' | 'internal' | 'external' | 'focus' | 'group';
export interface ReportFilter {
  scope: ReportScope;
  /** معرّف الرحلة (trip) أو المجموعة (group) */
  refId?: ID;
  from?: string;
  to?: string;
  categoryId?: ID;
  includeExtra?: boolean;
}
export interface ReportRow {
  ownerKind: BudgetOwnerKind;
  ownerId: ID;
  activity: string;
  spendKind: SpendKind;
  groupId?: ID;
  group: string;
  categoryId?: ID;
  category: string;
  item: string;
  description: string;
  unitPrice: number;
  qty: number;
  amount: number;
  invoiceNo: string;
  invoiceDate: string;
  source: 'عهدة' | 'صرف مباشر' | 'فاتورة إضافية';
  attachmentName: string;
  preview?: string;
}

const catName = (db: DB, id?: ID, custom?: string) => (id ? db.budgetCategories.find((c) => c.id === id)?.name : undefined) ?? custom ?? 'غير مصنف';

function groupOfOwner(db: DB, kind: BudgetOwnerKind, id: ID): ID | undefined {
  if (kind === 'trip') {
    const t = db.trips.find((x) => x.id === id);
    return t?.executor.kind === 'group' ? t.executor.groupId : undefined;
  }
  if (kind === 'focus') return db.focusMeetings.find((f) => f.id === id)?.groupId;
  return undefined;
}

export function reportRows(db: DB, f: ReportFilter): ReportRow[] {
  const rows: ReportRow[] = [];
  const base = (ownerKind: BudgetOwnerKind, ownerId: ID) => {
    const groupId = groupOfOwner(db, ownerKind, ownerId);
    return { ownerKind, ownerId, activity: ownerTitle(db, ownerKind, ownerId), spendKind: spendKindOf(db, ownerKind, ownerId), groupId, group: db.groups.find((g) => g.id === groupId)?.name ?? '—' };
  };
  for (const sf of db.spendForms) {
    const c = db.custodies.find((x) => x.id === sf.custodyId);
    if (!c) continue;
    for (const l of sf.lines.filter((x) => x.status !== 'rejected'))
      rows.push({ ...base(c.ownerKind, c.ownerId), categoryId: l.categoryId, category: catName(db, l.categoryId, l.customCategory), item: l.item, description: l.item, unitPrice: l.amount, qty: 1, amount: l.amount, invoiceNo: sf.serial ?? '', invoiceDate: sf.invoiceDate, source: 'عهدة', attachmentName: sf.attachment.name, preview: sf.attachment.preview });
  }
  for (const ds of db.directSpends) {
    const owner = ds.allocations[0];
    if (!owner) continue;
    for (const l of ds.lines)
      rows.push({ ...base(owner.ownerKind, owner.ownerId), categoryId: l.categoryId, category: catName(db, l.categoryId, l.customCategory), item: l.item, description: l.item, unitPrice: l.amount, qty: 1, amount: l.amount, invoiceNo: ds.serial ?? '', invoiceDate: ds.invoiceDate, source: 'صرف مباشر', attachmentName: ds.attachment.name, preview: ds.attachment.preview });
  }
  if (f.includeExtra)
    db.extraInvoices.forEach((x: ExtraInvoice) =>
      rows.push({ ...base(x.ownerKind, x.ownerId), categoryId: x.categoryId, category: catName(db, x.categoryId), item: x.description, description: x.description, unitPrice: x.amount, qty: 1, amount: x.amount, invoiceNo: '', invoiceDate: x.date, source: 'فاتورة إضافية', attachmentName: x.attachment.name, preview: x.attachment.preview }));
  return rows.filter((r) => {
    if (f.scope === 'trip' && !(r.ownerKind === 'trip' && r.ownerId === f.refId)) return false;
    if (f.scope === 'internal' && r.spendKind !== 'internal_trip') return false;
    if (f.scope === 'external' && r.spendKind !== 'external_trip') return false;
    if (f.scope === 'focus' && r.spendKind !== 'focus') return false;
    if (f.scope === 'group' && r.groupId !== f.refId) return false;
    if (f.from && r.invoiceDate < f.from) return false;
    if (f.to && r.invoiceDate > f.to) return false;
    if (f.categoryId && r.categoryId !== f.categoryId) return false;
    return true;
  });
}

export const reportTotal = (rows: ReportRow[]) => Math.round(rows.reduce((s, r) => s + r.amount, 0) * 100) / 100;

export function reportCsv(rows: ReportRow[]): string {
  const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const head = ['الفعالية', 'النوع', 'المجموعة', 'التصنيف', 'البند', 'الوصف', 'سعر الوحدة', 'العدد', 'المبلغ', 'رقم الفاتورة', 'تاريخها', 'مصدر الصرف', 'صورة الفاتورة'];
  const kind = (k: SpendKind) => ({ internal_trip: 'رحلة داخلية', external_trip: 'رحلة خارجية', focus: 'لقاء تركيز', opening: 'افتتاحي', closing: 'ختامي', meeting: 'اجتماع', program_needs: 'احتياجات' })[k];
  return '﻿' + [head, ...rows.map((r) => [r.activity, kind(r.spendKind), r.group, r.category, r.item, r.description, r.unitPrice, r.qty, r.amount, r.invoiceNo, r.invoiceDate, r.source, r.attachmentName])].map((l) => l.map(q).join(',')).join('\n');
}

export interface FinanceDashboard {
  balance: number;
  openCustodies: number;
  pendingRequests: number;
  pendingInvoices: number;
  directSpendTotal: number;
  extraInvoicesTotal: number;
  spent: number;
  byCategory: { name: string; amount: number }[];
  byKind: { kind: SpendKind; amount: number }[];
}
export function financeDashboard(db: DB): FinanceDashboard {
  const rows = reportRows(db, { scope: 'all' });
  const sum = <K extends string>(key: (r: ReportRow) => K) => {
    const m = new Map<K, number>();
    rows.forEach((r) => m.set(key(r), (m.get(key(r)) ?? 0) + r.amount));
    return [...m.entries()];
  };
  return {
    balance: walletBalance(db),
    openCustodies: db.custodies.filter((c) => c.status !== 'closed').length,
    pendingRequests: db.budgetRequests.filter((r) => ['pending_finance', 'pending_leader'].includes(r.status)).length,
    pendingInvoices: db.spendForms.filter((f) => f.lines.some((l) => l.status === 'pending')).length,
    directSpendTotal: db.directSpends.reduce((s, d) => s + d.total, 0),
    extraInvoicesTotal: db.extraInvoices.reduce((s, x) => s + x.amount, 0),
    spent: reportTotal(rows),
    byCategory: sum((r) => r.category).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount),
    byKind: sum((r) => r.spendKind).map(([kind, amount]) => ({ kind, amount })),
  };
}
