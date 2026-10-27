// المرحلة 5: مراجعة الفواتير كجدول. الصف يعدّل التصنيف والمبلغ فقط، ولا مراجعة لعهدة المراجع نفسه، والمعتمد يُعدَّل بطلب
import { describe, expect, it } from 'vitest';
import { harness } from './helpers/harness';

const pendingLine = (db: ReturnType<typeof harness>['db']) => {
  const f = db.spendForms.find((x) => x.lines.some((l) => l.status === 'pending'))!;
  return { f, l: f.lines.find((x) => x.status === 'pending')!, c: db.custodies.find((x) => x.id === f.custodyId)! };
};

describe('مراجعة بند من الصف', () => {
  it('الاعتماد يحفظ التصنيف والمبلغ الجديدين ويُبقي الأصل للسطر «عدّلته المالية: كان…»', () => {
    const h = harness('s5');
    const { f, l } = pendingLine(h.db);
    if (!f.serial) h.repos.finance.setSerial(f.id, 'S-100');
    const cat = h.db.budgetCategories.find((x) => x.id !== l.categoryId && !x.hidden)!;
    h.repos.finance.reviewLine(f.id, l.id, { accept: true, categoryId: cat.id, amount: l.amount - 1 });
    const after = h.db.spendForms.find((x) => x.id === f.id)!.lines.find((x) => x.id === l.id)!;
    expect(after.status).toBe('accepted');
    expect(after.categoryId).toBe(cat.id);
    expect(after.original?.amount).toBe(l.amount);
  });
  it('الرفض يحتاج سبباً، والمراجَع لا يُعدَّل مباشرة', () => {
    const h = harness('s5');
    const { f, l } = pendingLine(h.db);
    h.repos.finance.reviewLine(f.id, l.id, { accept: false, note: 'الفاتورة غير واضحة' });
    expect(h.db.spendForms.find((x) => x.id === f.id)!.lines.find((x) => x.id === l.id)!.status).toBe('rejected');
    expect(() => h.repos.finance.reviewLine(f.id, l.id, { accept: true })).toThrow(/مقفل/);
  });
  it('المراجع لا يراجع ولا يعدّل الرقم التسلسلي على عهدته الشخصية', () => {
    const h = harness('s5');
    const { f, l, c } = pendingLine(h.db);
    h.db.custodies.find((x) => x.id === c.id)!.recipientId = 's5';
    expect(() => h.repos.finance.reviewLine(f.id, l.id, { accept: false, note: 'x' })).toThrow(/صاحب العهدة/);
    expect(() => h.repos.finance.setSerial(f.id, 'S-1')).toThrow(/صاحب العهدة/);
  });
  it('من لا يملك صلاحية المراجعة يُرفض', () => {
    const h = harness('s3'); // عضو مالية بلا صلاحيات
    const { f, l } = pendingLine(h.db);
    expect(() => h.repos.finance.reviewLine(f.id, l.id, { accept: false, note: 'x' })).toThrow();
  });
});
