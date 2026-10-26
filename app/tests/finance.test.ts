// اختبارات المالية عبر طبقة البيانات (وثيقة القرارات: الصرف والمالية + حسم س5 وس6)
import { describe, expect, it } from 'vitest';
import { navFor } from '@/domain/access';
import { sha256Hex } from '@/domain/crypto';
import { allocatedFor, focusCounter, hasFinancePerm, perItem, requestFor, requestStage, spendKindOf } from '@/domain/finance';
import { activitySpend, custodyCloseChecks, custodyFigures, formDuplicateWarnings, splitWarning, walletBalance } from '@/domain/ledger';
import { canSeeFinance } from '@/domain/permissions';
import type { Attachment } from '@/domain/types';
import { harness } from './helpers/harness';

const att = (name: string): Attachment => ({ name, type: 'image/jpeg', size: 1000, hash: sha256Hex(`test:${name}`) });
const focusInput = (groupId: string, title: string) => ({
  groupId, title, isUmrah: false, topicMode: 'free' as const, topicOptions: [], dateMode: 'free' as const, dateOptions: [], start: '20:00', end: '21:00', location: 'قاعة',
  presenterMode: 'facilitator' as const, presenterIds: [], presenterAxes: {},
});
const line = (amount: number, categoryId = 'bc_food') => ({ categoryId, item: 'بند', amount });

describe('الصلاحيات المالية', () => {
  it('القسم المالي للجنة المالية والقائد العام فقط', () => {
    const h = harness('s5');
    expect(canSeeFinance(h.db, 's5')).toBe(true);
    expect(canSeeFinance(h.db, 'p_lead')).toBe(true);
    expect(canSeeFinance(h.db, 's2')).toBe(false);
  });
  it('العضو بلا صلاحية الصرف لا يودع ولا يصرف، والتفويض يُسجَّل', () => {
    const h = harness('s3');
    expect(() => h.repos.finance.deposit({ amount: 100, attachment: att('a'), source: 'x' })).toThrow(/صلاحية/);
    h.as('s5');
    h.repos.finance.setPermission('s3', 'disburse', true);
    expect(hasFinancePerm(h.db, 's3', 'disburse')).toBe(true);
    expect(h.db.audit[0].action).toBe('منح صلاحية');
  });
});

describe('المحفظة والإثبات الإلزامي', () => {
  it('الإيداع يعبّئ الرصيد، ولا يُسجَّل بلا إيصال', () => {
    const h = harness('s5');
    const before = walletBalance(h.db);
    expect(() => h.repos.finance.deposit({ amount: 500, attachment: undefined as unknown as Attachment, source: 'الجمعية' })).toThrow(/بلا مرفق/);
    h.repos.finance.deposit({ amount: 500, attachment: att('حوالة'), source: 'الجمعية' });
    expect(walletBalance(h.db)).toBe(before + 500);
  });
  it('لا صرف إلا من الرصيد الفعلي', () => {
    const h = harness('s5');
    const b = walletBalance(h.db);
    expect(() => h.repos.finance.directSpend({ allocations: [{ ownerKind: 'trip', ownerId: 't4', amount: b + 1 }], vendor: 'مورد', invoiceDate: '2026-10-01', proofKind: 'invoice', attachment: att('x'), lines: [line(b + 1)] })).toThrow(/لا يكفي/);
  });
});

describe('الأنواع السبعة والموازنة المقفلة', () => {
  it('الاجتماعات واحتياجات البرنامج أنواع صرف فعلية', () => {
    const h = harness('s5');
    expect(spendKindOf(h.db, 'meeting', 'mt3')).toBe('meeting');
    expect(spendKindOf(h.db, 'need', 'nd1')).toBe('program_needs');
    h.as('s2');
    h.repos.finance.submitRequest({ ownerKind: 'meeting', ownerId: 'mt3', amount: 250, lines: [], detailed: false });
    expect(requestFor(h.db, 'meeting', 'mt3')!.status).toBe('pending_finance');
  });
  it('الموازنة المعتمدة لا تُعدَّل مباشرة: طلب يوافق عليه القائد العام فيُطبَّق', () => {
    const h = harness('s5');
    expect(() => h.repos.finance.setupBudget(h.db.programBudget)).toThrow(/مقفلة/);
    h.repos.finance.requestEdit({ target: { kind: 'program_budget' }, patch: { budget: { ...h.db.programBudget, opening: 5000 } }, summary: 'رفع الافتتاحي', reason: 'زيادة الحضور' });
    expect(h.db.programBudget.opening).not.toBe(5000);
    expect(() => h.repos.finance.decideEdit(h.db.editRequests[h.db.editRequests.length - 1].id, true)).toThrow(/للقائد العام/);
    h.as('p_lead');
    h.repos.finance.decideEdit(h.db.editRequests[h.db.editRequests.length - 1].id, true);
    expect(h.db.programBudget.opening).toBe(5000);
    expect(h.db.audit[0].action).toBe('موافقة على تعديل سجل معتمد');
  });
  it('البند المعتمد مقفل: تعديله بطلب، والرفض لا يغيّره', () => {
    const h = harness('p_lead');
    const er = h.db.editRequests.find((e) => e.id === 'er1')!;
    h.repos.finance.decideEdit(er.id, false, 'المبلغ صحيح');
    const t = er.target as { formId: string; lineId: string };
    expect(h.db.spendForms.find((f) => f.id === t.formId)!.lines.find((l) => l.id === t.lineId)!.amount).toBe(1000);
    h.as('s5');
    expect(() => h.repos.finance.reviewLine(t.formId, t.lineId, { accept: true, amount: 10 })).toThrow(/مقفل/);
  });
});

describe('لقاءات التركيز (4 إلى 8 بميزانية)', () => {
  it('اللقاء الخامس: المبلغ الافتراضي ويذهب لمسؤول المالية', () => {
    const h = harness('s2');
    const id = h.repos.focus.create(focusInput('g2', 'لقاء خامس'), { amount: perItem(h.db.programBudget.focus) });
    const r = requestFor(h.db, 'focus', id)!;
    expect(r.status).toBe('pending_finance');
    expect(requestStage(h.db, r).waitingOnId).toBe('s5');
  });
  it('اللقاء التاسع بلا ميزانية', () => {
    const h = harness('s1');
    expect(focusCounter(h.db, 'g1').withBudget).toBe(8);
    const id = h.repos.focus.create(focusInput('g1', 'لقاء تاسع'));
    expect(allocatedFor(h.db, 'focus', id)).toBe(0);
    expect(() => h.repos.finance.submitRequest({ ownerKind: 'focus', ownerId: id, amount: 100, lines: [], detailed: false })).toThrow(/الحد الأعلى/);
  });
});

describe('ميزانية الرحلة (س6)', () => {
  it('الميسّر ثم القائد العام (منبَّهاً بالتجاوز)، ثم تحويل جزئي وتأجيل الباقي', () => {
    const h = harness('s4');
    const r = requestFor(h.db, 'trip', 't6')!;
    expect(r.status).toBe('pending_facilitator');
    h.as('p_lead');
    expect(() => h.repos.finance.leaderDecide(r.id, 'approve')).toThrow();
    h.as('s4');
    h.repos.finance.facilitatorDecide(r.id, true);
    expect(requestFor(h.db, 'trip', 't6')!.status).toBe('pending_leader');
    expect(h.db.notifications.some((n) => n.toId === 'p_lead' && n.type === 'budget_request')).toBe(true);
    h.as('p_lead');
    h.repos.finance.leaderDecide(r.id, 'approve');
    h.as('s5');
    // رصيد لا يكفي: يُحوَّل جزء والباقي دفعة ثانية
    const b = walletBalance(h.db);
    h.repos.finance.directSpend({ allocations: [{ ownerKind: 'need', ownerId: 'nd2', amount: b - 1000 }], vendor: 'مورد', invoiceDate: '2026-10-01', proofKind: 'invoice', attachment: att('big'), lines: [line(b - 1000, 'bc_print')] });
    expect(() => h.repos.finance.disburse(r.id, { recipientId: 'u19', amount: r.amount, attachment: att('t6-1') })).toThrow(/لا يكفي/);
    h.repos.finance.disburse(r.id, { recipientId: 'u19', amount: 1000, attachment: att('t6-1') });
    const c = h.db.custodies.find((x) => x.requestId === r.id)!;
    expect(custodyFigures(h.db, c).toTransfer).toBe(r.amount - 1000);
    h.repos.finance.deposit({ amount: 5000, attachment: att('dep'), source: 'الجمعية' });
    h.repos.finance.transferMore(c.id, r.amount - 1000, att('t6-2'));
    expect(custodyFigures(h.db, h.db.custodies.find((x) => x.id === c.id)!).toTransfer).toBe(0);
  });
});

describe('العهدة ونموذج الصرف', () => {
  it('العهد المتزامنة: لا يتكرر النوع، وبحد يضبطه مسؤول المالية', () => {
    const h = harness('s5');
    expect(() => h.repos.finance.issueCustody({ ownerKind: 'need', ownerId: 'nd1', recipientId: 'p_lead', approved: 100, amount: 100, attachment: att('n1') })).toThrow(/النوع نفسه/);
    h.repos.finance.issueCustody({ ownerKind: 'event', ownerId: 'ev_open', recipientId: 's4', approved: 100, amount: 100, attachment: att('o1') });
    h.repos.finance.setFinanceSettings({ maxOpenCustodies: 1 });
    expect(() => h.repos.finance.issueCustody({ ownerKind: 'event', ownerId: 'ev_close', recipientId: 's4', approved: 100, amount: 100, attachment: att('o2') })).toThrow(/الحد المسموح/);
  });
  it('النموذج محجوز حتى المراجعة، ويُفك الحجز بالرفض، ويُقبل ولو تجاوز الرصيد (عجز)', () => {
    const h = harness('s2');
    const c = h.db.custodies.find((x) => x.id === 'cu_f22')!;
    expect(custodyFigures(h.db, c).held).toBe(165);
    const id = h.repos.finance.submitSpendForm(c.id, { vendor: 'مطعم', serial: 'Z-1', invoiceDate: '2026-10-20', proofKind: 'invoice', attachment: att('z1'), lines: [line(40), { categoryId: undefined, customCategory: 'هدايا', item: 'هدية', amount: 20 }] });
    expect(custodyFigures(h.db, h.db.custodies.find((x) => x.id === c.id)!).held).toBe(225);
    h.as('s5');
    const form = h.db.spendForms.find((f) => f.id === id)!;
    expect(() => h.repos.finance.reviewLine(id, form.lines[1].id, { accept: true })).toThrow(/غير موجود/);
    h.repos.finance.reviewLine(id, form.lines[1].id, { accept: false, note: 'ليست من المصروفات' });
    h.repos.finance.reviewLine(id, form.lines[0].id, { accept: true, amount: 35, categoryId: 'bc_hosting' });
    const f2 = h.db.spendForms.find((x) => x.id === id)!;
    expect(f2.lines[0]).toMatchObject({ amount: 35, categoryId: 'bc_hosting', original: { amount: 40 } });
    const pending = h.db.spendForms.find((x) => x.custodyId === c.id && x.id !== id)!;
    h.repos.finance.reviewLine(pending.id, pending.lines[0].id, { accept: true });
    expect(custodyFigures(h.db, h.db.custodies.find((x) => x.id === c.id)!).deficit).toBe(50);
  });
  it('لا يُقبل بند بلا رقم تسلسلي، ولا يراجع صاحب العهدة نفسه', () => {
    const h = harness('s5');
    const f = h.db.spendForms.find((x) => x.custodyId === 'cu_t2' && !x.serial)!;
    expect(() => h.repos.finance.reviewLine(f.id, f.lines[0].id, { accept: true })).toThrow(/الرقم التسلسلي/);
    h.repos.finance.setSerial(f.id, 'T2-77');
    h.repos.finance.reviewLine(f.id, f.lines[0].id, { accept: true });
  });
  it('كشف التكرار (الصورة، الرقم والمورد) والتجزئة', () => {
    const h = harness('s5');
    const forms = h.db.spendForms.filter((f) => f.custodyId === 'cu_t4');
    const dup = forms[forms.length - 1];
    expect(formDuplicateWarnings(h.db, dup).join(' ')).toMatch(/الصورة نفسها/);
    const small = forms.find((f) => f.serial === 'R-121')!;
    expect(splitWarning(h.db, small)).toMatch(/تجزئة/);
  });
});

describe('الإغلاق (س5)', () => {
  it('طلب الإغلاق يوقف الصرف، ولا يُقفل قبل المراجعة والتسوية', () => {
    const h = harness('u7');
    h.repos.finance.requestClose('cu_t4');
    expect(() => h.repos.finance.submitSpendForm('cu_t4', { vendor: 'x', invoiceDate: '2026-10-20', proofKind: 'invoice', attachment: att('late'), lines: [line(10)] })).toThrow(/توقف الصرف/);
    h.as('s5');
    expect(() => h.repos.finance.closeCustody('cu_t4')).toThrow(/لا يُغلق قبل/);
  });
  it('العجز: تحويل للشخص من رصيد المالية، أو تسوية خارجية يتحمّلها أحدهما', () => {
    const h = harness('s2');
    h.repos.finance.requestClose('cu_f22');
    h.as('s5');
    const f = h.db.spendForms.find((x) => x.custodyId === 'cu_f22')!;
    h.repos.finance.reviewLine(f.id, f.lines[0].id, { accept: true });
    const before = walletBalance(h.db);
    h.repos.finance.settle('cu_f22', { method: 'transfer', attachment: att('deficit') });
    expect(walletBalance(h.db)).toBe(before - 15);
    h.repos.finance.closeCustody('cu_f22');
    expect(h.db.custodies.find((c) => c.id === 'cu_f22')!.status).toBe('closed');
  });
  it('الفائض: صاحب العهدة يرفع الإيصال، والمالية تؤكد فيدخل المحفظة', () => {
    const h = harness('s3');
    const c = h.db.custodies.find((x) => x.id === 'cu_t2')!;
    h.as('s5');
    h.db.spendForms.filter((f) => f.custodyId === c.id).forEach((f) => { if (!f.serial) h.repos.finance.setSerial(f.id, 'S-1'); });
    h.db.spendForms.filter((f) => f.custodyId === c.id).forEach((f) => f.lines.filter((l) => l.status === 'pending').forEach((l) => h.repos.finance.reviewLine(f.id, l.id, { accept: true })));
    const surplus = custodyFigures(h.db, h.db.custodies.find((x) => x.id === c.id)!).surplus;
    expect(surplus).toBe(590);
    expect(() => h.repos.finance.settle(c.id, { method: 'transfer' })).toThrow(/إيصال/);
    h.as('s3');
    h.repos.finance.submitSurplusReturn(c.id, att('surplus'));
    h.as('s5');
    const before = walletBalance(h.db);
    h.repos.finance.settle(c.id, { method: 'transfer' });
    expect(walletBalance(h.db)).toBe(before + 590);
    expect(custodyCloseChecks(h.db, h.db.custodies.find((x) => x.id === c.id)!).every((x) => x.ok)).toBe(true);
  });
});

describe('الصرف المباشر والعقود', () => {
  it('المصروف المشترك: مجموع التوزيع يساوي الفاتورة بالضبط، ويظهر في مصروف كل نشاط', () => {
    const h = harness('s5');
    const base = { vendor: 'فندق', invoiceDate: '2026-10-01', proofKind: 'invoice' as const, attachment: att('hotel'), lines: [line(1000, 'bc_housing')] };
    expect(() => h.repos.finance.directSpend({ ...base, allocations: [{ ownerKind: 'trip', ownerId: 't7', amount: 600 }, { ownerKind: 'trip', ownerId: 't8', amount: 300 }] })).toThrow(/بالضبط/);
    const t8 = activitySpend(h.db, 'trip', 't8').direct;
    h.repos.finance.directSpend({ ...base, allocations: [{ ownerKind: 'trip', ownerId: 't7', amount: 600 }, { ownerKind: 'trip', ownerId: 't8', amount: 400 }] });
    expect(activitySpend(h.db, 'trip', 't8').direct).toBe(t8 + 400);
  });
  it('العقد في احتياجات البرنامج فقط، ودفعاته تُقفل القيمة كاملة بفواتير', () => {
    const h = harness('s5');
    expect(() => h.repos.finance.createContract({ needId: 'nd1', vendor: 'م', title: 'ع', total: 1000, payments: [{ amount: 600, dueDate: '2026-11-01' }] })).toThrow(/يساوي/);
    h.repos.finance.createContract({ needId: 'nd1', vendor: 'م', title: 'ع', total: 1000, payments: [{ amount: 600, dueDate: '2026-11-01' }, { amount: 400, dueDate: '2026-12-01' }] });
    const c = h.db.contracts[h.db.contracts.length - 1];
    h.repos.finance.payContract(c.id, c.payments[0].id, att('p1'));
    expect(h.db.contracts.find((x) => x.id === c.id)!.payments[0].paidAt).toBeTruthy();
  });
});

describe('الرسوم الثلاثية', () => {
  it('مسدد وجزئي وغير مسدد، والاستثناء يُعتبر سداداً', () => {
    const h = harness('s5');
    h.repos.finance.setFee('u1', { status: 'partial', paidAmount: 200 });
    expect(h.db.fees.find((f) => f.personId === 'u1')).toMatchObject({ status: 'partial', paidAmount: 200 });
    expect(() => h.repos.finance.setFee('u1', { status: 'partial', paidAmount: 9999 })).toThrow();
    h.repos.finance.setFee('u2', { status: 'paid', exemption: 'جمعية البر' });
    expect(h.db.fees.find((f) => f.personId === 'u2')).toMatchObject({ status: 'paid', exemption: 'جمعية البر' });
  });
});

describe('القائمة الجانبية', () => {
  it('التقويم في قائمة كل دور', () => {
    const h = harness('s5');
    h.db.persons.forEach((p) => expect(navFor(h.db, p.id).all.map((i) => i.to)).toContain('/app/calendar'));
  });
});
