// الموازنة بكتل التصنيفات: التصنيفات المزروعة، والإجمالي لكل تصنيف وعام
import { describe, expect, it } from 'vitest';
import { linesTotal } from '@/domain/finance';
import { harness } from './helpers/harness';

describe('الموازنة التفصيلية', () => {
  it('التصنيفات المطلوبة مزروعة', () => {
    const h = harness('s5');
    const names = h.db.budgetCategories.map((c) => c.name);
    for (const n of ['المواصلات', 'التغذية', 'الترفيه', 'السكن', 'الضيافة', 'الطوارئ']) expect(names).toContain(n);
    expect(names.some((n) => n.includes('مطبوعات'))).toBe(true);
  });
  it('إجمالي كل تصنيف والإجمالي العام = عدد × سعر', () => {
    const lines = [
      { id: '1', categoryId: 'bc_transport', description: '', unit: 'x', qty: 2, price: 500 },
      { id: '2', categoryId: 'bc_food', description: '', unit: 'x', qty: 30, price: 35 },
      { id: '3', categoryId: 'bc_food', description: '', unit: 'x', qty: 1, price: 50 },
    ];
    expect(linesTotal(lines.filter((l) => l.categoryId === 'bc_food'))).toBe(1100);
    expect(linesTotal(lines)).toBe(2100);
  });
});
