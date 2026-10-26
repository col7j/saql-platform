// الصلاحيات المؤقتة: يمنحها القائد العام حتى تاريخ، وتسقط بالانتهاء أو السحب
import { describe, expect, it } from 'vitest';
import { addDays, todayISO } from '@/domain/dates';
import { hasTempGrant } from '@/domain/grants';
import { getCapabilities } from '@/domain/permissions';
import { harness } from './helpers/harness';

describe('الصلاحيات المؤقتة', () => {
  it('تسجيل المشاركين بصلاحية مؤقتة، ولا تشمل فريق العمل', () => {
    const h = harness('p_lead');
    h.as('s2');
    expect(() => h.repos.people.create({ kind: 'participant', name: 'أ', email: 'a1@x.io' })).toThrow(/صلاحية مؤقتة/);
    h.as('p_lead');
    h.repos.grants.grant('s2', 'register_participants', addDays(todayISO(), 7));
    h.as('s2');
    h.repos.people.create({ kind: 'participant', name: 'أ', email: 'a1@x.io' });
    expect(() => h.repos.people.create({ kind: 'staff', name: 'ب', email: 'b1@x.io' })).toThrow(/للقائد العام/);
  });
  it('تنتهي بتاريخها وتُسحب', () => {
    const h = harness('p_lead');
    h.repos.grants.grant('s3', 'edit_site', todayISO());
    expect(getCapabilities(h.db, 's3').isSiteEditor).toBe(true);
    h.db.tempGrants.find((g) => g.personId === 's3')!.expiresAt = addDays(todayISO(), -1);
    expect(hasTempGrant(h.db, 's3', 'edit_site')).toBe(false);
    expect(getCapabilities(h.db, 's6').isSiteEditor).toBe(true); // مفوّض في البيانات التجريبية
    h.repos.grants.revoke('gr1');
    expect(getCapabilities(h.db, 's6').isSiteEditor).toBe(false);
  });
  it('يمنحها القائد العام وحده', () => {
    const h = harness('s6');
    expect(() => h.repos.grants.grant('s2', 'edit_site', todayISO())).toThrow(/القائد العام/);
  });
});
