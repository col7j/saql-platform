// اختبارات المنطق المالي عبر طبقة البيانات نفسها (بلا واجهة)
import { beforeEach, describe, expect, it } from 'vitest';
import { buildSeed } from '@/data/seed';
import { createLocalRepositories } from '@/data/repositories';
import { allocatedFor, canDisburse, focusCounter, hasFinancePerm, invoiceError, perItem, requestFor, requestStage } from '@/domain/finance';
import { canSeeFinance } from '@/domain/permissions';
import { navFor } from '@/domain/access';
import type { DB } from '@/domain/types';

let db: DB;
let who = 's5';
const repos = createLocalRepositories((recipe) => {
  const draft = structuredClone(db);
  if (recipe(draft) === false) return;
  db = draft;
}, () => who, () => db);
const as = (id: string) => (who = id);
const setup = () => {
  as('s5');
  repos.finance.setupBudget({ ...db.programBudget, setupDone: false });
};
const focusInput = (groupId: string, title: string) => ({
  groupId, title, isUmrah: false, topicMode: 'free' as const, topicOptions: [], dateMode: 'free' as const, dateOptions: [], start: '20:00', end: '21:00', location: 'قاعة',
  presenterMode: 'facilitator' as const, presenterIds: [], presenterAxes: {},
});

beforeEach(() => {
  db = buildSeed();
});

describe('الصلاحيات المالية', () => {
  it('القسم المالي للجنة المالية والقائد العام فقط', () => {
    expect(canSeeFinance(db, 's5')).toBe(true);
    expect(canSeeFinance(db, 'p_lead')).toBe(true);
    expect(canSeeFinance(db, 's2')).toBe(false);
    expect(canSeeFinance(db, 'u1')).toBe(false);
  });
  it('العضو بلا صلاحية الصرف لا يصرف، وتفويضه يُسجَّل في سجل التدقيق', () => {
    const r = db.budgetRequests.find((x) => x.ownerId === 'f_g1_4')!;
    expect(canDisburse(db, 's3', r)).toBe(false);
    expect(canDisburse(db, 's5', r)).toBe(true);
    as('s3');
    expect(() => repos.finance.disburse(r.id, { recipientId: 's1', installments: [{ amount: 150, dueDate: '2026-11-01' }] })).toThrow(/صلاحية/);
    as('s5');
    repos.finance.setPermission('s3', 'disburse', true);
    expect(hasFinancePerm(db, 's3', 'disburse')).toBe(true);
    expect(db.audit[0].action).toBe('منح صلاحية');
    expect(db.audit[0].detail).toContain('صرف العهد');
  });
  it('غير المسؤول المالي لا يفوّض', () => {
    as('s1');
    expect(() => repos.finance.setPermission('s3', 'disburse', true)).toThrow();
  });
});

describe('قاعدة الصرف المسموح', () => {
  it('الصرف على اجتماع ممنوع افتراضياً برسالة واضحة', () => {
    as('s5');
    expect(() => repos.finance.disburseDirect('meeting', 'mt3', { recipientId: 's2', installments: [{ amount: 300, dueDate: '2026-11-01' }] })).toThrow(/لا يُسمح بالصرف/);
  });
  it('يُسمح بعد تفعيل نوع الاجتماعات', () => {
    as('s5');
    repos.finance.setSpendable([...db.settings.spendableTypes, 'meeting']);
    repos.finance.disburseDirect('meeting', 'mt3', { recipientId: 's2', installments: [{ amount: 300, dueDate: '2026-11-01' }] });
    expect(db.custodies.some((c) => c.ownerKind === 'meeting')).toBe(true);
  });
});

describe('المعالج والمرصود', () => {
  it('الإجمالي يُقسَّم على المقسوم عليه', () => {
    expect(perItem({ mode: 'total', perItem: 0, total: 1000, divisor: 16 })).toBe(62.5);
    expect(perItem({ mode: 'per_item', perItem: 100, total: 0, divisor: 0 })).toBe(100);
  });
  it('لا تُقبل الطلبات قبل إعداد الميزانية', () => {
    as('s2');
    expect(() => repos.focus.create(focusInput('g2', 'لقاء جديد'), { amount: 150 })).toThrow(/لم يُعدّ/);
  });
});

describe('لقاءات التركيز (4 إلى 8 بميزانية)', () => {
  it('اللقاء الخامس: المبلغ الافتراضي ويذهب لمسؤول المالية', () => {
    setup();
    as('s2');
    const id = repos.focus.create(focusInput('g2', 'لقاء خامس'), { amount: perItem(db.programBudget.focus) });
    const r = requestFor(db, 'focus', id)!;
    expect(r.status).toBe('pending_finance');
    expect(requestStage(db, r).waitingOnId).toBe('s5');
  });
  it('اللقاء التاسع بلا ميزانية', () => {
    setup();
    as('s1');
    expect(focusCounter(db, 'g1').withBudget).toBe(8);
    const id = repos.focus.create(focusInput('g1', 'لقاء تاسع'));
    expect(allocatedFor(db, 'focus', id)).toBe(0);
    expect(() => repos.finance.submitRequest({ ownerKind: 'focus', ownerId: id, amount: 100, lines: [], detailed: false })).toThrow(/الحد الأعلى/);
  });
});

describe('دورة الطلب', () => {
  it('تجاوز المرصود: القائد العام يطلب تفصيلية، ثم يعتمد، ثم تصرف المالية', () => {
    setup();
    const r = db.budgetRequests.find((x) => x.ownerId === 'f_g3_5')!;
    expect(r.status).toBe('pending_leader');
    as('s5');
    expect(() => repos.finance.financeDecide(r.id, true)).toThrow();
    as('p_lead');
    repos.finance.leaderDecide(r.id, 'detail', 'فصّل بنود النقل والتغذية');
    expect(requestFor(db, 'focus', 'f_g3_5')!.status).toBe('needs_detail');
    as('s3');
    repos.finance.submitRequest({ ownerKind: 'focus', ownerId: 'f_g3_5', amount: 0, detailed: true, lines: [
      { id: 'l1', categoryId: 'bc_transport', itemId: 'bi_bus', description: 'باص 30 راكباً', unit: 'رحلة', qty: 1, price: 1400 },
      { id: 'l2', categoryId: 'bc_food', itemId: 'bi_meals', description: 'وجبات', unit: 'وجبة', qty: 14, price: 30 },
    ] });
    expect(requestFor(db, 'focus', 'f_g3_5')!.status).toBe('pending_leader');
    as('p_lead');
    repos.finance.leaderDecide(r.id, 'approve');
    const after = requestFor(db, 'focus', 'f_g3_5')!;
    expect(after.status).toBe('approved');
    expect(requestStage(db, after).waitingOnId).toBe('s5');
    expect(() => repos.finance.disburse(r.id, { recipientId: 's3', installments: [{ amount: 1820, dueDate: '2026-11-01' }] })).toThrow(); // القائد العام لا يصرف
    as('s5');
    repos.finance.disburse(r.id, { recipientId: 's3', installments: [{ amount: 1820, dueDate: '2026-11-01' }] });
    expect(db.custodies.some((c) => c.requestId === r.id)).toBe(true);
  });
  it('لا يعتمد صاحب الطلب طلبه', () => {
    setup();
    as('s2');
    const id = repos.focus.create(focusInput('g2', 'لقاء'), { amount: 100 });
    const r = requestFor(db, 'focus', id)!;
    expect(r.status).toBe('pending_finance');
    as('s1');
    repos.finance.financeDecide(r.id, true); // s1 عضو مالي مفوّض بالموافقة
    expect(requestFor(db, 'focus', id)!.status).toBe('approved');
  });
});

describe('الفواتير', () => {
  it('يُمنع الإرسال إذا اختلف مجموع الأسطر عن الإجمالي', () => {
    const lines = [{ categoryId: 'bc_food', description: 'غداء', amount: 200 }, { categoryId: 'bc_hosting', description: 'قهوة', amount: 90 }];
    expect(invoiceError(300, lines, 'a.jpg')).toMatch(/لا يساوي/);
    expect(invoiceError(290, lines, 'a.jpg')).toBeNull();
    expect(invoiceError(290, lines, '')).toMatch(/صورة/);
  });
});

describe('القائمة الجانبية', () => {
  it('كل الأقسام ظاهرة، والتقويم من الأساسية لكل دور', () => {
    db.persons.forEach((p) => {
      const nav = navFor(db, p.id);
      expect(nav.all.map((i) => i.to)).toContain('/app/calendar');
      expect(nav.all.some((i) => i.to === '/app/more')).toBe(false);
    });
  });
});
