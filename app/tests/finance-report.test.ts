// التقارير المالية بالفرز، واللوحة، والافتتاحي والختامي منفصلان
import { describe, expect, it } from 'vitest';
import { financeDashboard, reportCsv, reportRows, reportTotal } from '@/domain/financeReport';
import { routeAccess } from '@/domain/access';
import { harness } from './helpers/harness';

describe('التقارير المالية', () => {
  it('الفرز بالنوع يطابق مجموع الكل، والفواتير الإضافية مستبعدة افتراضياً', () => {
    const h = harness('s5');
    const all = reportRows(h.db, { scope: 'all' });
    const parts = (['internal', 'external', 'focus'] as const).map((scope) => reportTotal(reportRows(h.db, { scope })));
    expect(all.length).toBeGreaterThan(0);
    expect(parts.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(reportTotal(all) + 0.01);
    const withExtra = reportRows(h.db, { scope: 'all', includeExtra: true });
    expect(withExtra.length).toBe(all.length + h.db.extraInvoices.length);
    expect(withExtra.filter((r) => r.source === 'فاتورة إضافية').length).toBe(h.db.extraInvoices.length);
  });
  it('تقرير الرحلات الخارجية يُصدَّر CSV وفيه اسم صورة الفاتورة', () => {
    const h = harness('s5');
    const rows = reportRows(h.db, { scope: 'external' });
    const csv = reportCsv(rows);
    expect(csv.split('\n')[0]).toContain('صورة الفاتورة');
    expect(csv.split('\n').length).toBe(rows.length + 1);
    expect(routeAccess(h.db, 's5', '/app/finance-print')).toBe(true);
    expect(routeAccess(h.db, 'u1', '/app/finance-print')).toBe(false);
  });
  it('اللوحة: الفواتير الإضافية منفصلة عن المصروف', () => {
    const h = harness('s5');
    const d = financeDashboard(h.db);
    expect(d.spent).toBe(reportTotal(reportRows(h.db, { scope: 'all' })));
    expect(d.extraInvoicesTotal).toBe(h.db.extraInvoices.reduce((s, x) => s + x.amount, 0));
  });
});

describe('الافتتاحي والختامي منفصلان', () => {
  it('لكل منهما حقوله وحفظه ولا يختلطان', () => {
    const h = harness('p_lead');
    h.repos.events.saveOpening({ programIntro: 'تعريف', groupsAnnouncement: 'مجموعات' });
    h.repos.events.saveClosing({ rankingAnnouncement: 'ترتيب', honorsAndCertificates: 'تكريم' });
    const o = h.db.events.find((e) => e.kind === 'opening')!;
    const c = h.db.events.find((e) => e.kind === 'closing')!;
    expect(o.opening?.programIntro).toBe('تعريف');
    expect(o.closing).toBeUndefined();
    expect(c.closing?.honorsAndCertificates).toBe('تكريم');
    expect(c.opening).toBeUndefined();
    expect(routeAccess(h.db, 'p_lead', '/app/opening')).toBe(true);
    expect(routeAccess(h.db, 'p_lead', '/app/closing')).toBe(true);
    h.as('s1');
    expect(() => h.repos.events.saveOpening({ programIntro: 'x' })).toThrow();
  });
});
