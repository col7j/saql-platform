// محرر الموازنة: بند رئيسي (من المالية) + تفصيل (وحدة × عدد × سعر)
import { uid } from '@/domain/id';
import { SAR } from '@/domain/labels';
import type { BudgetLine, BudgetOwnerKind } from '@/domain/types';
import { budgetTotal } from '@/domain/workflow';
import { useDB } from '@/state/store';
import { Button, Icons, Input } from '@/ui';

export function BudgetEditor({ lines, onChange, ownerKind, readOnly }: { lines: BudgetLine[]; onChange?: (l: BudgetLine[]) => void; ownerKind: BudgetOwnerKind; readOnly?: boolean }) {
  const db = useDB();
  const cats = db.budgetCategories.filter((c) => c.appliesTo.includes(ownerKind));
  const upd = (id: string, p: Partial<BudgetLine>) => onChange?.(lines.map((l) => (l.id === id ? { ...l, ...p } : l)));
  const byCat = cats.map((c) => ({ c, items: lines.filter((l) => l.categoryId === c.id) })).filter((x) => x.items.length || !readOnly);

  return (
    <div className="space-y-3">
      {byCat.map(({ c, items }) => (
        <div key={c.id} className="rounded-2xl border border-ink-100">
          <div className="flex items-center justify-between bg-ink-50 px-3 py-2 text-sm">
            <span className="font-bold">{c.name}</span>
            <span className="num text-ink-500">{SAR(budgetTotal(items))}</span>
          </div>
          <div className="divide-y divide-ink-100">
            {items.map((l) => (
              <div key={l.id} className="grid grid-cols-12 items-center gap-2 px-3 py-2 text-sm">
                {readOnly ? (
                  <>
                    <span className="col-span-6">{l.description}</span>
                    <span className="num col-span-3 text-ink-500">{l.qty} {l.unit} × {l.price}</span>
                    <span className="num col-span-3 text-end font-medium">{SAR(l.qty * l.price)}</span>
                  </>
                ) : (
                  <>
                    <Input className="col-span-12 sm:col-span-5" value={l.description} placeholder="التفصيل (مثال: باص كوستر مع سائق)" onChange={(e) => upd(l.id, { description: e.target.value })} />
                    <Input className="col-span-3 sm:col-span-2" value={l.unit} placeholder="الوحدة" onChange={(e) => upd(l.id, { unit: e.target.value })} />
                    <Input className="num col-span-3 sm:col-span-1" type="number" min={0} value={l.qty} onChange={(e) => upd(l.id, { qty: +e.target.value })} />
                    <Input className="num col-span-3 sm:col-span-2" type="number" min={0} value={l.price} onChange={(e) => upd(l.id, { price: +e.target.value })} />
                    <span className="num col-span-2 text-end text-xs sm:col-span-1">{l.qty * l.price}</span>
                    <button className="col-span-1 text-ink-300 hover:text-red-600" onClick={() => onChange?.(lines.filter((x) => x.id !== l.id))}><Icons.Trash2 className="h-4 w-4" /></button>
                  </>
                )}
              </div>
            ))}
            {!readOnly && (
              <button className="flex w-full items-center gap-1 px-3 py-2 text-xs text-brand-600 hover:bg-brand-50" onClick={() => onChange?.([...lines, { id: uid('bl'), categoryId: c.id, description: '', unit: 'وحدة', qty: 1, price: 0 }])}>
                <Icons.Plus className="h-3.5 w-3.5" /> إضافة تفصيل تحت {c.name}
              </button>
            )}
          </div>
        </div>
      ))}
      <div className="flex items-center justify-between rounded-2xl bg-brand-50 px-4 py-3 font-bold text-brand-800">
        <span>الإجمالي التقديري</span>
        <span className="num">{SAR(budgetTotal(lines))}</span>
      </div>
      {!readOnly && <p className="text-xs text-ink-400">البنود الرئيسية يحددها مسؤول اللجنة المالية، ولا يضيف الفريق بنداً رئيسياً من عنده.</p>}
    </div>
  );
}

export { Button };
