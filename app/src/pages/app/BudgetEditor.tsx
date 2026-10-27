// الموازنة التفصيلية: تصنيف ← بند ← عدد × سعر الوحدة. التصنيفات من المسؤول المالي فقط.
import { uid } from '@/domain/id';
import { SAR } from '@/domain/labels';
import { linesTotal } from '@/domain/finance';
import type { BudgetLine } from '@/domain/types';
import { useDB } from '@/state/store';
import { Button, Icons, Input, Select, cx } from '@/ui';

export function BudgetEditor({ lines, onChange, readOnly, allocated }: { lines: BudgetLine[]; onChange?: (l: BudgetLine[]) => void; readOnly?: boolean; allocated?: number }) {
  const db = useDB();
  const cats = db.budgetCategories.filter((c) => !c.hidden);
  const catName = (id: string) => db.budgetCategories.find((c) => c.id === id)?.name ?? '—';
  const itemName = (cid: string, iid?: string) => db.budgetCategories.find((c) => c.id === cid)?.items.find((i) => i.id === iid)?.name;
  const upd = (id: string, p: Partial<BudgetLine>) => onChange?.(lines.map((l) => (l.id === id ? { ...l, ...p } : l)));
  const total = linesTotal(lines);
  const over = allocated != null && total > allocated;

  return (
    <div className="space-y-3">
      {readOnly ? (
        <div className="divide-y divide-ink-100 rounded-2xl border border-ink-100">
          {lines.length === 0 && <p className="p-3 text-sm text-ink-400">لا بنود</p>}
          {lines.map((l) => (
            <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
              <span><b>{catName(l.categoryId)}</b>{itemName(l.categoryId, l.itemId) && <span className="text-ink-500"> ← {itemName(l.categoryId, l.itemId)}</span>}{l.description && <span className="text-ink-400"> · {l.description}</span>}</span>
              <span className="num text-ink-600">{l.qty} × {l.price} = <b>{SAR(l.qty * l.price)}</b></span>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {lines.map((l) => {
            const cat = db.budgetCategories.find((c) => c.id === l.categoryId);
            return (
              <div key={l.id} className="grid grid-cols-2 gap-2 rounded-2xl border border-ink-100 p-2 sm:grid-cols-[1fr_1fr_1.2fr_70px_90px_auto]">
                <Select value={l.categoryId} onChange={(e) => upd(l.id, { categoryId: e.target.value, itemId: undefined })} options={cats.map((c) => ({ value: c.id, label: c.name }))} aria-label="التصنيف" />
                <Select value={l.itemId ?? ''} onChange={(e) => upd(l.id, { itemId: e.target.value || undefined })} options={[{ value: '', label: 'البند…' }, ...(cat?.items.filter((i) => !i.hidden).map((i) => ({ value: i.id, label: i.name })) ?? [])]} aria-label="البند" />
                <Input className="col-span-2 sm:col-span-1" value={l.description} placeholder="وصف (اختياري)" onChange={(e) => upd(l.id, { description: e.target.value })} />
                <Input className="num" type="number" min={1} value={l.qty} onChange={(e) => upd(l.id, { qty: Math.max(0, +e.target.value) })} aria-label="العدد" />
                <Input className="num" type="number" min={0} value={l.price} onChange={(e) => upd(l.id, { price: Math.max(0, +e.target.value) })} aria-label="سعر الوحدة" />
                <button className="flex min-h-[44px] items-center justify-center text-ink-300 hover:text-red-600" onClick={() => onChange?.(lines.filter((x) => x.id !== l.id))} aria-label="احذف السطر"><Icons.Trash2 className="h-4 w-4" /></button>
              </div>
            );
          })}
          <div className="hidden px-2 text-xs text-ink-400 sm:grid sm:grid-cols-[1fr_1fr_1.2fr_70px_90px_auto] sm:gap-2"><span>التصنيف</span><span>البند</span><span>الوصف</span><span>العدد</span><span>سعر الوحدة</span><span /></div>
          <Button variant="secondary" size="sm" onClick={() => onChange?.([...lines, { id: uid('bl'), categoryId: cats[0]?.id ?? '', description: '', unit: 'وحدة', qty: 1, price: 0 }])} icon={<Icons.Plus className="h-4 w-4" />}>أضف سطراً</Button>
        </div>
      )}
      <div className={cx('flex flex-wrap items-center justify-between gap-2 rounded-2xl px-4 py-3 font-bold', over ? 'bg-accent-50 text-accent-700' : 'bg-brand-50 text-brand-800')}>
        <span>الإجمالي</span>
        <span className="num">{SAR(total)}{allocated != null && <span className="ms-2 text-xs font-medium">من المرصود {SAR(allocated)}</span>}</span>
      </div>
      {over && <p className="text-xs text-accent-700">الإجمالي يتجاوز المرصود، فسيذهب الطلب للقائد العام لاعتماده.</p>}
    </div>
  );
}
