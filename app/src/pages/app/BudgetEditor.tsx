// الموازنة التفصيلية بكتل التصنيفات (الرئيسي 4): كتلة لكل تصنيف، عنوانه شارة في أعلى اليمين وإجماليه في أعلى اليسار،
// وتحتهما صفوف: البند، العدد، سعر الوحدة، الإجمالي. التصنيفات من المسؤول المالي فقط. القراءة بالشكل نفسه (مع ملخص التصنيفات أعلاها).
import { useState } from 'react';
import { uid } from '@/domain/id';
import { SAR } from '@/domain/labels';
import { linesTotal } from '@/domain/finance';
import type { BudgetLine } from '@/domain/types';
import { useDB } from '@/state/store';
import { Button, Icons, Input, Select, cx } from '@/ui';

interface Props { lines: BudgetLine[]; onChange?: (l: BudgetLine[]) => void; readOnly?: boolean; allocated?: number }

export function BudgetEditor({ lines, onChange, readOnly, allocated }: Props) {
  const db = useDB();
  const cats = db.budgetCategories.filter((c) => !c.hidden);
  const catName = (id: string) => db.budgetCategories.find((c) => c.id === id)?.name ?? 'بلا تصنيف';
  const total = linesTotal(lines);
  const over = allocated != null && total > allocated;
  const upd = (id: string, p: Partial<BudgetLine>) => onChange?.(lines.map((l) => (l.id === id ? { ...l, ...p } : l)));
  // الكتل بترتيب ظهور التصنيفات في القائمة، ثم أي تصنيف مخفي له بنود
  const used = [...new Set(lines.map((l) => l.categoryId))];
  const [extra, setExtra] = useState<string[]>([]);
  const ids = [...new Set([...cats.map((c) => c.id).filter((id) => used.includes(id) || extra.includes(id)), ...used.filter((id) => !cats.some((c) => c.id === id)), ...extra])];
  const remaining = cats.filter((c) => !ids.includes(c.id));
  const sub = (id: string) => linesTotal(lines.filter((l) => l.categoryId === id));

  return (
    <div className="space-y-4">
      {readOnly && lines.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-ink-100" aria-label="ملخص التصنيفات">
          <table className="w-full text-sm">
            <thead><tr className="bg-ink-50 text-xs text-ink-500"><th className="px-3 py-2 text-start font-medium">التصنيف</th><th className="px-3 py-2 text-start font-medium">الإجمالي</th><th className="px-3 py-2 text-start font-medium">من الكل</th></tr></thead>
            <tbody>
              {used.map((id) => (
                <tr key={id} className="border-t border-ink-100"><td className="px-3 py-2">{catName(id)}</td><td className="num px-3 py-2">{SAR(sub(id))}</td><td className="num px-3 py-2">{total ? Math.round((sub(id) / total) * 100) : 0}%</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {ids.length === 0 && <p className="rounded-2xl border border-dashed border-ink-200 p-4 text-sm text-ink-500">لا تصنيفات بعد. {readOnly ? '' : 'أضف تصنيفاً من الزر أسفل الشاشة ثم أضف بنوده.'}</p>}
      {ids.map((cid) => {
        const cat = db.budgetCategories.find((c) => c.id === cid);
        const rows = lines.filter((l) => l.categoryId === cid);
        return (
          <section key={cid} className="rounded-2xl border border-ink-100 bg-white p-3 shadow-card sm:p-4" aria-label={catName(cid)}>
            <header className="mb-3 flex items-center justify-between gap-2">
              <span className="rounded-full bg-brand-600 px-4 py-1 text-sm font-bold text-white">{catName(cid)}</span>
              <span className="num text-base font-bold text-ink-900">الإجمالي: {SAR(sub(cid))}</span>
            </header>
            <div className="divide-y divide-ink-100">
              {rows.map((l) => readOnly ? (
                <div key={l.id} className="grid grid-cols-[1fr_auto] items-center gap-2 py-2 text-sm sm:grid-cols-[2fr_60px_90px_100px]">
                  <span>{cat?.items.find((i) => i.id === l.itemId)?.name ?? l.description}{l.itemId && l.description && <span className="text-ink-500"> — {l.description}</span>}</span>
                  <span className="num hidden text-ink-600 sm:block">{l.qty}</span>
                  <span className="num hidden text-ink-600 sm:block">{l.price}</span>
                  <span className="num font-medium">{SAR(l.qty * l.price)}</span>
                </div>
              ) : (
                <div key={l.id} className="grid grid-cols-2 gap-2 py-2 sm:grid-cols-[1.4fr_1.4fr_70px_100px_100px_auto] sm:items-center">
                  <Select value={l.itemId ?? ''} onChange={(e) => upd(l.id, { itemId: e.target.value || undefined })} options={[{ value: '', label: 'البند…' }, ...(cat?.items ?? []).filter((i) => !i.hidden).map((i) => ({ value: i.id, label: i.name }))]} aria-label="البند" />
                  <Input value={l.description} placeholder="ملاحظة (اختياري)" onChange={(e) => upd(l.id, { description: e.target.value })} aria-label="ملاحظة" />
                  <Input className="num" type="number" min={0} value={l.qty} onChange={(e) => upd(l.id, { qty: Math.max(0, +e.target.value) })} aria-label="العدد" />
                  <Input className="num" type="number" min={0} value={l.price} onChange={(e) => upd(l.id, { price: Math.max(0, +e.target.value) })} aria-label="سعر الوحدة" />
                  <span className="num flex min-h-[44px] items-center font-medium">{SAR(l.qty * l.price)}</span>
                  <button className="flex min-h-[44px] min-w-[44px] items-center justify-center text-ink-400 hover:text-red-600" onClick={() => onChange?.(lines.filter((x) => x.id !== l.id))} aria-label="احذف البند"><Icons.Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
              {rows.length === 0 && <p className="py-2 text-xs text-ink-500">لا بنود في هذا التصنيف</p>}
            </div>
            {!readOnly && <div className="mt-2"><Button variant="secondary" onClick={() => onChange?.([...lines, { id: uid('bl'), categoryId: cid, description: '', unit: 'وحدة', qty: 1, price: 0 }])} icon={<Icons.Plus className="h-4 w-4" />}>أضف بنداً</Button></div>}
          </section>
        );
      })}
      {!readOnly && remaining.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Select value="" onChange={(e) => e.target.value && setExtra([...extra, e.target.value])} options={[{ value: '', label: 'أضف تصنيفاً…' }, ...remaining.map((c) => ({ value: c.id, label: c.name }))]} aria-label="أضف تصنيفاً" />
        </div>
      )}
      <div className={cx('sticky bottom-2 flex flex-wrap items-center justify-between gap-2 rounded-2xl px-4 py-3 font-bold shadow-lift', over ? 'bg-accent-50 text-accent-700' : 'bg-brand-50 text-brand-800')}>
        <span>الإجمالي العام</span>
        <span className="num">{SAR(total)}{allocated != null && <span className="ms-2 text-xs font-medium">من المرصود {SAR(allocated)}</span>}</span>
      </div>
      {over && <p className="text-xs text-accent-700">الإجمالي يتجاوز المرصود، فسيذهب الطلب للقائد العام لاعتماده.</p>}
    </div>
  );
}
