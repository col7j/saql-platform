// أقسام وثيقة الرحلة المبنية من القالب (بيانات): حقول، وأهداف، وجداول بصفوف قابلة للإضافة والحذف
import { SAR as fmtMoney } from '@/domain/labels';
import { activityCost, activitiesTotal, defaultSuggestedGoals, goalsOf, rowsOf, sectionsFor, withGoals, withRows, type DocRow } from '@/domain/tripDocument';
import { requestFor } from '@/domain/finance';
import type { DocColumn, DocSectionDef, Trip, TripDoc } from '@/domain/types';
import { uid } from '@/domain/id';
import { personName, useDB } from '@/state/store';
import { Button, Field, Icons, Input, Select, Textarea } from '@/ui';

type Fields = Record<string, string>;

/** الجدول الزمني والموازنة يُعرضان من مصدريهما، لا يُنسخان */
function Embed({ trip }: { trip: Trip }) {
  const db = useDB();
  const lines = requestFor(db, 'trip', trip.id)?.lines ?? [];
  const byCat = new Map<string, number>();
  lines.forEach((l) => byCat.set(l.categoryId, (byCat.get(l.categoryId) ?? 0) + l.qty * l.price));
  return (
    <div className="rounded-xl bg-ink-50 p-3 text-sm">
      <div>الجدول الزمني: {trip.schedule.plans.map((p) => `${p.name} (${p.items.length} بنداً)`).join('، ')} — يُعدَّل من تبويب «الجدول الزمني».</div>
      <div className="mt-1">الموازنة التفصيلية: <b className="num">{fmtMoney(lines.reduce((s, l) => s + l.qty * l.price, 0))}</b> في {byCat.size} تصنيفات — تُعدَّل من تبويب «الميزانية».</div>
    </div>
  );
}

function Cell({ col, value, editable, onChange, goals }: { col: DocColumn; value: string; editable: boolean; onChange: (v: string) => void; goals: string[] }) {
  const db = useDB();
  if (!editable) return <span>{col.type === 'yesno' ? (value === 'yes' ? 'نعم' : value === 'no' ? 'لا' : '—') : col.type === 'person' ? (value ? personName(db, value) : '—') : value || '—'}</span>;
  if (col.type === 'yesno') return <Select value={value} onChange={(e) => onChange(e.target.value)} options={[{ value: '', label: '—' }, { value: 'yes', label: 'نعم' }, { value: 'no', label: 'لا' }]} aria-label={col.label} />;
  if (col.type === 'goal') return <Select value={value} onChange={(e) => onChange(e.target.value)} options={[{ value: '', label: 'اختر هدفاً' }, ...goals.map((g) => ({ value: g, label: g }))]} aria-label={col.label} />;
  if (col.type === 'person') return <Select value={value} onChange={(e) => onChange(e.target.value)} options={[{ value: '', label: '—' }, ...db.persons.map((p) => ({ value: p.id, label: p.name }))]} aria-label={col.label} />;
  return <Input type={col.type === 'number' ? 'number' : col.type === 'date' ? 'date' : 'text'} value={value} onChange={(e) => onChange(e.target.value)} aria-label={col.label} />;
}

function TableSection({ def, trip, fields, editable, setFields }: { def: DocSectionDef; trip: Trip; fields: Fields; editable: boolean; setFields: (f: Fields) => void }) {
  const db = useDB();
  const rows = rowsOf(fields, def.id);
  const lines = requestFor(db, 'trip', trip.id)?.lines ?? [];
  const goals = goalsOf(fields);
  const goalList = [...goals.educational, ...goals.social];
  const cols = def.columns ?? [];
  const set = (next: DocRow[]) => setFields(withRows(fields, def.id, next));
  const isActivities = def.id === 'activities';
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead><tr className="text-xs text-ink-500">{cols.map((c) => <th key={c.key} className="px-2 py-1 text-start font-medium">{c.label}</th>)}{editable && <th />}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id} className="border-t border-ink-100 align-top">
              {cols.map((c) => {
                // ربط النشاط ببند الميزانية: تُقرأ التكلفة منه
                if (isActivities && c.key === 'cost' && r.budgetLine) return <td key={c.key} className="px-2 py-1 num">{fmtMoney(activityCost(lines, r))} <span className="text-xs text-ink-400">(من الميزانية)</span></td>;
                if (isActivities && c.key === 'budgetLine' && editable)
                  return <td key={c.key} className="px-2 py-1"><Select value={r.budgetLine ?? ''} onChange={(e) => set(rows.map((x, j) => (j === i ? { ...x, budgetLine: e.target.value } : x)))} aria-label={c.label} options={[{ value: '', label: 'بلا ربط' }, ...lines.map((l) => ({ value: l.id, label: l.description }))]} /></td>;
                if (isActivities && c.key === 'budgetLine') return <td key={c.key} className="px-2 py-1">{lines.find((l) => l.id === r.budgetLine)?.description ?? '—'}</td>;
                return <td key={c.key} className="px-2 py-1"><Cell col={c} value={r[c.key] ?? ''} editable={editable} goals={goalList} onChange={(v) => set(rows.map((x, j) => (j === i ? { ...x, [c.key]: v } : x)))} /></td>;
              })}
              {editable && <td className="px-2 py-1"><button aria-label="احذف الصف" className="rounded-full p-2 text-red-600 hover:bg-red-50" onClick={() => set(rows.filter((_, j) => j !== i))}><Icons.Trash2 className="h-4 w-4" /></button></td>}
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={cols.length + 1} className="px-2 py-3 text-xs text-ink-500">لا صفوف بعد{editable ? ': اضغط «أضف صفاً»' : ''}</td></tr>}
        </tbody>
        {isActivities && rows.length > 0 && <tfoot><tr className="border-t border-ink-200 font-bold"><td colSpan={cols.length} className="px-2 py-1">إجمالي التكلفة التقديرية للأنشطة: <span className="num">{fmtMoney(activitiesTotal(lines, rows))}</span></td></tr></tfoot>}
      </table>
      {editable && <div className="mt-2"><Button variant="secondary" onClick={() => set([...rows, { id: uid('r') } as DocRow])} icon={<Icons.Plus className="h-4 w-4" />}>أضف صفاً</Button></div>}
    </div>
  );
}

function GoalsSection({ fields, editable, setFields }: { fields: Fields; editable: boolean; setFields: (f: Fields) => void }) {
  const db = useDB();
  const g = goalsOf(fields);
  const sug = db.settings.suggestedGoals ?? defaultSuggestedGoals();
  const groups: { key: 'educational' | 'social'; title: string }[] = [{ key: 'educational', title: 'أهداف تعليمية' }, { key: 'social', title: 'أهداف اجتماعية' }];
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {groups.map(({ key, title }) => {
        const options = [...new Set([...sug[key], ...g[key]])];
        const toggle = (x: string) => setFields(withGoals(fields, { ...g, [key]: g[key].includes(x) ? g[key].filter((y) => y !== x) : [...g[key], x] }));
        return (
          <div key={key}>
            <div className="mb-1 text-sm font-bold">{title}</div>
            <ul className="space-y-1">
              {options.map((o) => (
                <li key={o}><label className="flex min-h-[36px] items-center gap-2 text-sm"><input type="checkbox" disabled={!editable} checked={g[key].includes(o)} onChange={() => toggle(o)} /> {o}</label></li>
              ))}
            </ul>
            {editable && <AddGoal onAdd={(x) => setFields(withGoals(fields, { ...g, [key]: [...g[key], x] }))} />}
          </div>
        );
      })}
    </div>
  );
}
function AddGoal({ onAdd }: { onAdd: (x: string) => void }) {
  let value = '';
  return (
    <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (value.trim()) { onAdd(value.trim()); (e.currentTarget.elements.namedItem('g') as HTMLInputElement).value = ''; value = ''; } }}>
      <Input name="g" placeholder="هدف جديد" onChange={(e) => (value = e.target.value)} />
      <Button type="submit" variant="secondary">أضف</Button>
    </form>
  );
}

/** كل أقسام مرحلة الوثيقة (مبدئية أو تفصيلية) */
export function DocSections({ trip, doc, fields, editable, setFields, stage }: { trip: Trip; doc: TripDoc; fields: Fields; editable: boolean; setFields: (f: Fields) => void; stage: 'initial' | 'detailed' }) {
  const db = useDB();
  const defs = sectionsFor(db, trip, stage);
  const all = trip.docTemplate ?? db.settings.docTemplate;
  return (
    <div className="space-y-5">
      {defs.map((def) => (
        <section key={def.id}>
          <h3 className="mb-2 text-sm font-bold text-brand-700">{all.indexOf(def) + 1}. {def.title}</h3>
          {def.kind === 'fields' && (
            <div className="grid gap-3 sm:grid-cols-2">
              {(def.fields ?? []).map((f) => editable ? (
                <Field key={f.key} label={f.label} className={f.long ? 'sm:col-span-2' : undefined}>
                  {f.long ? <Textarea rows={3} value={fields[f.key] ?? ''} onChange={(e) => setFields({ ...fields, [f.key]: e.target.value })} /> : <Input value={fields[f.key] ?? ''} onChange={(e) => setFields({ ...fields, [f.key]: e.target.value })} />}
                </Field>
              ) : (
                <div key={f.key} className={f.long ? 'sm:col-span-2' : undefined}><div className="text-xs text-ink-500">{f.label}</div><p className="mt-0.5 whitespace-pre-line text-sm">{doc.fields[f.key] || '—'}</p></div>
              ))}
            </div>
          )}
          {def.kind === 'goals' && <GoalsSection fields={fields} editable={editable} setFields={setFields} />}
          {def.kind === 'table' && <TableSection def={def} trip={trip} fields={fields} editable={editable} setFields={setFields} />}
          {def.kind === 'embed' && <Embed trip={trip} />}
        </section>
      ))}
    </div>
  );
}
