// سيناريوهات قبول التحديث (delta): السجل المركزي، والمفاتيح، وشاشة الصلاحيات
import { describe, expect, it } from 'vitest';
import { routeAccess } from '@/domain/access';
import { harness } from './helpers/harness';

const att = { name: 'إيصال.pdf', type: 'application/pdf', size: 1, hash: 'd1' };

describe('السجل المركزي الواحد', () => {
  it('الاعتماد والصرف والتفويض والدخول في سجل واحد يراه مسؤول التقنية وحده', () => {
    const h = harness('p_lead');
    const doc = h.db.docs.find((d) => d.status === 'facilitator_approved');
    if (doc) h.repos.trips.docAction(doc.id, { type: 'leader_approve' });
    h.as('s5');
    h.repos.finance.setPermission('s3', 'view_budget', true);
    h.repos.accounts.recordLogin('s5');
    const areas = new Set(h.db.audit.map((a) => a.area));
    expect(areas.has('finance')).toBe(true);
    expect(areas.has('login')).toBe(true);
    if (doc) expect(areas.has('approvals')).toBe(true);
    expect(routeAccess(h.db, 's6', '/app/audit')).toBe(true);
    for (const id of ['p_lead', 's7', 's8', 's5', 's1', 'u1']) expect(routeAccess(h.db, id, '/app/audit'), id).toBe(false);
  });
});

describe('مفاتيح الربط', () => {
  it('لا تُعرض بعد الحفظ ولا تدخل قاعدة البيانات، ولمسؤول التقنية وحده', () => {
    const h = harness('p_lead');
    expect(() => h.repos.integrations.save('EMAIL_API_KEY', 'sk_live_SECRET123')).toThrow(/التقنية/);
    expect(routeAccess(h.db, 'p_lead', '/app/integrations')).toBe(false);
    h.as('s6');
    h.repos.integrations.save('EMAIL_API_KEY', 'sk_live_SECRET123');
    expect(h.db.integrations.EMAIL_API_KEY.set).toBe(true);
    expect(JSON.stringify(h.db)).not.toContain('SECRET123');
    expect(JSON.stringify(Object.keys(h.repos.integrations))).not.toMatch(/get|read/i);
    expect(routeAccess(h.db, 's6', '/app/integrations')).toBe(true);
    expect(h.db.audit.some((a) => a.action === 'ضبط مفتاح ربط')).toBe(true);
  });
});

describe('شاشة الصلاحيات', () => {
  it('القائد يمنح ويسحب صلاحية، ولا يستطيع مسؤول التقنية ذلك، والتفويض الداخلي ضمن السقف', () => {
    const h = harness('p_lead');
    const fin = h.db.committees.find((c) => c.kind === 'finance')!.id;
    h.repos.permissions.setMemberPerm(fin, 's3', 'review_invoices', true);
    expect(h.db.memberships.find((m) => m.committeeId === fin && m.personId === 's3')!.financePerms).toContain('review_invoices');
    h.repos.permissions.setMemberPerm(fin, 's3', 'review_invoices', false);
    expect(h.db.memberships.find((m) => m.committeeId === fin && m.personId === 's3')!.financePerms).not.toContain('review_invoices');
    // سقف اللجنة: تقليصه يمنع التفويض الداخلي
    h.repos.permissions.setCommitteeCeiling(fin, ['view_budget']);
    h.as('s5');
    expect(() => h.repos.finance.setPermission('s3', 'disburse', true)).toThrow(/القائد العام/);
    h.repos.finance.setPermission('s3', 'view_budget', true);
    h.as('s6');
    expect(() => h.repos.permissions.setMemberPerm(fin, 's3', 'view_budget', false)).toThrow(/مساعده/);
    expect(() => h.repos.permissions.setCommitteeCeiling(fin, [])).toThrow();
    expect(routeAccess(h.db, 's6', '/app/permissions')).toBe(false);
    expect(routeAccess(h.db, 'p_lead', '/app/permissions')).toBe(true);
    expect(routeAccess(h.db, 's7', '/app/permissions')).toBe(true);
    expect(h.db.audit.some((a) => a.action === 'منح صلاحية' && a.area === 'roles')).toBe(true);
  });
});
