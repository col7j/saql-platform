// طباعة وثيقة الرحلة PDF: A4 عرضياً، RTL، بخط الهوية، بشكل قريب من نموذج الإعداد (شعار الرحلة في الرأس)
import { useParams } from 'react-router-dom';
import { SAR } from '@/domain/labels';
import { requestFor } from '@/domain/finance';
import { activityCost, activitiesTotal, goalsOf, rowsOf, sectionsFor, type DocRow } from '@/domain/tripDocument';
import { docFor as findDoc } from '@/domain/workflow';
import { personName, useDB } from '@/state/store';
import { Button } from '@/ui';

export default function PrintTripDoc() {
  const { id } = useParams();
  const db = useDB();
  const trip = db.trips.find((t) => t.id === id);
  if (!trip) return <p className="p-6">الرحلة غير موجودة</p>;
  const lines = requestFor(db, 'trip', trip.id)?.lines ?? [];
  const docs = [findDoc(db, trip.id, 'document'), findDoc(db, trip.id, 'detailed')].filter(Boolean);
  const fields = Object.assign({}, ...docs.map((d) => d!.fields)) as Record<string, string>;
  const sections = sectionsFor(db, trip);
  return (
    <div className="trip-print mx-auto max-w-[1100px] bg-white p-6" dir="rtl">
      <style>{`@page { size: A4 landscape; margin: 12mm; } @media print { .no-print { display: none !important; } body { background: #fff; } section, tr { break-inside: avoid; } }`}</style>
      <div className="no-print mb-4 flex justify-end"><Button onClick={() => window.print()}>احفظ PDF</Button></div>
      <header className="mb-4 flex items-center justify-between border-b-2 border-brand-600 pb-3">
        <img src="./brand/logo-horizontal.svg" alt="صقل" className="h-10" />
        <div className="text-center">
          <div className="text-xs text-ink-500">نموذج إعداد رحلة طلابية {trip.type === 'external' ? 'خارجية' : 'داخلية'}</div>
          <h1 className="text-2xl font-bold text-brand-700">{fields.title || trip.title}</h1>
          {fields.slogan && <div className="text-sm text-accent-700">{fields.slogan}</div>}
        </div>
        <div className="w-24" />
      </header>
      {sections.map((s, i) => (
        <section key={s.id} className="mb-4">
          <h2 className="mb-1 rounded-lg bg-brand-600 px-3 py-1 text-sm font-bold text-white">{i + 1}. {s.title}</h2>
          {s.kind === 'fields' && (
            <table className="w-full text-sm"><tbody>
              {(s.fields ?? []).map((f) => <tr key={f.key} className="border-b border-ink-100"><th className="w-1/4 bg-ink-100 px-2 py-1 text-start font-medium">{f.label}</th><td className="px-2 py-1">{fields[f.key] || '—'}</td></tr>)}
            </tbody></table>
          )}
          {s.kind === 'goals' && (() => { const g = goalsOf(fields); return (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><b>الأهداف التعليمية</b><ul className="list-disc ps-5">{g.educational.map((x) => <li key={x}>{x}</li>)}</ul></div>
              <div><b>الأهداف الاجتماعية</b><ul className="list-disc ps-5">{g.social.map((x) => <li key={x}>{x}</li>)}</ul></div>
            </div>); })()}
          {s.kind === 'table' && (
            <table className="w-full border-collapse text-xs">
              <thead><tr>{(s.columns ?? []).map((c) => <th key={c.key} className="border border-ink-200 bg-ink-100 px-2 py-1 text-center">{c.label}</th>)}</tr></thead>
              <tbody>
                {rowsOf(fields, s.id).map((r: DocRow) => (
                  <tr key={r.id}>{(s.columns ?? []).map((c) => (
                    <td key={c.key} className="border border-ink-200 px-2 py-1">
                      {c.type === 'yesno' ? (r[c.key] === 'yes' ? 'نعم' : r[c.key] === 'no' ? 'لا' : '—') : c.type === 'person' ? (r[c.key] ? personName(db, r[c.key]) : '—')
                        : s.id === 'activities' && c.key === 'cost' ? SAR(activityCost(lines, r)) : r[c.key] || '—'}
                    </td>))}</tr>
                ))}
              </tbody>
              {s.id === 'activities' && <tfoot><tr><td colSpan={(s.columns ?? []).length} className="border border-ink-200 px-2 py-1 font-bold">الإجمالي: {SAR(activitiesTotal(lines, rowsOf(fields, s.id)))}</td></tr></tfoot>}
            </table>
          )}
          {s.kind === 'embed' && (
            <div className="space-y-2 text-xs">
              {trip.schedule.plans.map((p) => (
                <div key={p.id}><b>{p.name}</b>: {p.items.length ? p.items.map((it) => `${it.date} ${it.start}-${it.end} ${it.detail}`).join(' · ') : '—'}</div>
              ))}
              <table className="w-full border-collapse"><thead><tr>{['البند', 'العدد', 'سعر الوحدة', 'الإجمالي'].map((h) => <th key={h} className="border border-ink-200 bg-ink-100 px-2 py-1">{h}</th>)}</tr></thead>
                <tbody>{lines.map((l) => <tr key={l.id}><td className="border border-ink-200 px-2 py-1">{db.budgetCategories.find((c) => c.id === l.categoryId)?.name} — {l.description}</td><td className="num border border-ink-200 px-2 py-1">{l.qty}</td><td className="num border border-ink-200 px-2 py-1">{l.price}</td><td className="num border border-ink-200 px-2 py-1">{SAR(l.qty * l.price)}</td></tr>)}</tbody></table>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
