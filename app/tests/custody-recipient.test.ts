// مستلم العهدة محدد تلقائياً: من رفع الطلب، وبياناته المالية من ملفه الشخصي
import { describe, expect, it } from 'vitest';
import { harness } from './helpers/harness';

const att = { name: 'إيصال.pdf', type: 'application/pdf', size: 1, hash: 'r1' };

describe('مستلم العهدة', () => {
  const prepare = () => {
    const h = harness('s5');
    const r = h.db.budgetRequests.find((x) => x.ownerKind === 'trip' && x.status !== 'draft')!;
    r.status = 'approved';
    h.db.custodies = h.db.custodies.filter((c) => c.requestId !== r.id);
    h.db.custodies = h.db.custodies.filter((c) => c.recipientId !== r.requestedBy || c.status === 'closed');
    return { h, r };
  };
  it('المستلم من رفع الطلب ولو أُرسل غيره', () => {
    const { h, r } = prepare();
    const other = h.db.persons.find((p) => p.kind === 'participant' && p.id !== r.requestedBy)!.id;
    h.repos.finance.disburse(r.id, { recipientId: other, amount: 100, attachment: att });
    expect(h.db.custodies.find((c) => c.requestId === r.id)!.recipientId).toBe(r.requestedBy);
  });
  it('الآيبان الناقص يمنع الصرف برسالة تطلب الإكمال', () => {
    const { h, r } = prepare();
    h.db.persons.find((p) => p.id === r.requestedBy)!.bank = undefined;
    expect(() => h.repos.finance.disburse(r.id, { recipientId: r.requestedBy, amount: 100, attachment: att })).toThrow(/ملفه الشخصي/);
  });
});
