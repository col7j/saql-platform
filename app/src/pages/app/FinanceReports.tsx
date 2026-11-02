// التقارير المالية بفرز (رحلة، كل الرحلات، داخلية، خارجية، لقاءات تركيز، مجموعة، فترة، تصنيف) وتصدير CSV وPDF بصور الفواتير المصغّرة، واللوحة المالية
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { financeDashboard, reportCsv, reportRows, reportTotal, type ReportFilter, type ReportScope } from '@/domain/financeReport';
import { SAR } from '@/domain/labels';
import { spendKindLabel } from '@/domain/finance';
import { useDB } from '@/state/store';
import { Button, Card, Empty, Field, Input, Select, Stat, Table, Toggle } from '@/ui';
import { downloadCsv } from './Letters';

const SCOPES: { value: ReportScope; label: string }[] = [
  { value: 'all', label: 'كل الفعاليات' }, { value: 'trip', label: 'رحلة واحدة' }, { value: 'internal', label: 'كل الرحلات الداخلية' },
  { value: 'external', label: 'كل الرحلات الخارجية' }, { value: 'focus', label: 'لقاءات التركيز' }, { value: 'group', label: 'مجموعة' },
];

export const filterFromParams = (p: URLSearchParams): ReportFilter => ({
  scope: (p.get('scope') as ReportScope) || 'all', refId: p.get('ref') || undefined, from: p.get('from') || undefined, to: p.get('to') || undefined,
  categoryId: p.get('cat') || undefined, includeExtra: p.get('extra') === '1',
});
const toParams = (f: ReportFilter) => new URLSearchParams(Object.entries({ scope: f.scope, ref: f.refId, from: f.from, to: f.to, cat: f.categoryId, extra: f.includeExtra ? '1' : '' }).filter(([, v]) => v) as [string, string][]);

export function Dashboard() {
  const db = useDB();
  const d = financeDashboard(db);
  const max = Math.max(1, ...d.byCategory.map((x) => x.amount));
  const maxK = Math.max(1, ...d.byKind.map((x) => x.amount));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="الرصيد الفعلي" value={SAR(d.balance)} />
        <Stat label="المصروف" value={SAR(d.spent)} />
        <Stat label="عهد مفتوحة" value={d.openCustodies} />
        <Stat label="طلبات تنتظر قراراً" value={d.pendingRequests} tone="accent" />
        <Stat label="فواتير تنتظر مراجعة" value={d.pendingInvoices} tone="accent" />
        <Stat label="صرف مباشر" value={SAR(d.directSpendTotal)} />
        <Stat label="فواتير إضافية (منفصلة)" value={SAR(d.extraInvoicesTotal)} hint="لا تدخل المصروف" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="الصرف حسب التصنيف">
          {d.byCategory.length === 0 && <p className="text-sm text-ink-500">لا مصروف بعد</p>}
          {d.byCategory.map((c) => <Bar key={c.name} label={c.name} value={c.amount} max={max} />)}
        </Card>
        <Card title="الصرف حسب نوع الفعالية">
          {d.byKind.length === 0 && <p className="text-sm text-ink-500">لا مصروف بعد</p>}
          {d.byKind.map((c) => <Bar key={c.kind} label={spendKindLabel[c.kind]} value={c.amount} max={maxK} />)}
        </Card>
      </div>
    </div>
  );
}
function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div className="mb-2">
      <div className="flex justify-between text-xs"><span>{label}</span><span className="num">{SAR(value)}</span></div>
      <div className="mt-0.5 h-2 rounded-full bg-ink-100"><div className="h-2 rounded-full bg-brand-600" style={{ width: `${(value / max) * 100}%` }} /></div>
    </div>
  );
}

export function ReportBuilder() {
  const db = useDB();
  const [f, setF] = useState<ReportFilter>({ scope: 'all' });
  const rows = useMemo(() => reportRows(db, f), [db, f]);
  const refs = f.scope === 'trip' ? db.trips.map((t) => ({ value: t.id, label: t.title })) : f.scope === 'group' ? db.groups.map((g) => ({ value: g.id, label: g.name })) : [];
  return (
    <div className="space-y-4">
      <Card title="فرز التقرير">
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Field label="النطاق"><Select value={f.scope} onChange={(e) => setF({ ...f, scope: e.target.value as ReportScope, refId: undefined })} options={SCOPES} /></Field>
          {refs.length > 0 && <Field label={f.scope === 'trip' ? 'الرحلة' : 'المجموعة'}><Select value={f.refId ?? ''} onChange={(e) => setF({ ...f, refId: e.target.value || undefined })} options={[{ value: '', label: 'اختر' }, ...refs]} /></Field>}
          <Field label="من"><Input type="date" value={f.from ?? ''} onChange={(e) => setF({ ...f, from: e.target.value || undefined })} /></Field>
          <Field label="إلى"><Input type="date" value={f.to ?? ''} onChange={(e) => setF({ ...f, to: e.target.value || undefined })} /></Field>
          <Field label="التصنيف"><Select value={f.categoryId ?? ''} onChange={(e) => setF({ ...f, categoryId: e.target.value || undefined })} options={[{ value: '', label: 'كل التصنيفات' }, ...db.budgetCategories.map((c) => ({ value: c.id, label: c.name }))]} /></Field>
          <div className="flex items-end"><Toggle checked={!!f.includeExtra} onChange={(v) => setF({ ...f, includeExtra: v })} label="ضمّ الفواتير الإضافية" /></div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-sm">{rows.length} سطراً · الإجمالي <b className="num">{SAR(reportTotal(rows))}</b></span>
          <Button variant="secondary" disabled={!rows.length} onClick={() => downloadCsv('finance-report.csv', reportCsv(rows))}>صدّر CSV</Button>
          <Link to={`/app/finance-print?${toParams(f)}`} target="_blank" className="text-sm text-brand-700 underline">اطبع PDF بصور الفواتير</Link>
        </div>
      </Card>
      {!rows.length ? <Empty title="لا صرف مطابق" text="غيّر الفرز أو اختر نطاقاً آخر" /> : (
        <Card pad={false}><ReportTable rows={rows} /></Card>
      )}
    </div>
  );
}

function ReportTable({ rows, thumbs }: { rows: ReturnType<typeof reportRows>; thumbs?: boolean }) {
  return (
    <Table>
      <thead><tr><th>الفعالية</th><th>المجموعة</th><th>التصنيف</th><th>البند</th><th>سعر الوحدة</th><th>العدد</th><th>المبلغ</th><th>الفاتورة</th><th>المصدر</th></tr></thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td className="text-xs">{r.activity}</td><td className="text-xs">{r.group}</td><td>{r.category}</td><td className="text-xs">{r.item}</td>
            <td className="num">{r.unitPrice}</td><td className="num">{r.qty}</td><td className="num font-medium">{SAR(r.amount)}</td>
            <td className="text-xs">{r.invoiceNo || '—'} · {r.invoiceDate}{thumbs && r.preview && <img src={r.preview} alt={r.attachmentName} className="mt-1 h-12 rounded border" />}{!thumbs && ` · ${r.attachmentName}`}</td>
            <td className="text-xs">{r.source}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

/** صفحة طباعة التقرير: A4 عرضياً RTL بصور الفواتير المصغّرة */
export function FinancePrint() {
  const db = useDB();
  const [params] = useSearchParams();
  const rows = reportRows(db, filterFromParams(params));
  return (
    <div className="mx-auto max-w-[1100px] bg-white p-6" dir="rtl">
      <style>{`@page { size: A4 landscape; margin: 12mm; } @media print { .no-print { display: none !important; } tr { break-inside: avoid; } }`}</style>
      <div className="no-print mb-4 flex justify-end"><Button onClick={() => window.print()}>احفظ PDF</Button></div>
      <h1 className="mb-1 text-xl font-bold text-brand-700">التقرير المالي</h1>
      <p className="mb-3 text-sm text-ink-600">{rows.length} سطراً · الإجمالي {SAR(reportTotal(rows))}</p>
      <ReportTable rows={rows} thumbs />
    </div>
  );
}
