// الأدوار الجديدة (الرئيسي 1): المشرف العام للقراءة فقط، ومساعد القائد العام، وحصرية التقنية
import { describe, expect, it } from 'vitest';
import { navFor, routeAccess } from '@/domain/access';
import { can, roleKeysOf } from '@/domain/roles';
import { getCapabilities } from '@/domain/permissions';
import { harness } from './helpers/harness';

describe('المشرف العام: قراءة فقط', () => {
  it('يرى شاشات القائد ولا يرى الحسابات التقنية', () => {
    const h = harness('s8');
    expect(routeAccess(h.db, 's8', '/app/finance')).toBe(true);
    expect(routeAccess(h.db, 's8', '/app/media')).toBe(true);
    expect(routeAccess(h.db, 's8', '/app/approvals')).toBe(true);
    expect(getCapabilities(h.db, 's8').isSupervisor).toBe(true);
    expect(can(h.db, 's8', 'accounts.manage')).toBe(false);
    expect(can(h.db, 's8', 'settings.technical')).toBe(false);
  });
  it('كل كتابة تُرفض في طبقة البيانات حتى لو استُدعيت برمجياً', () => {
    const h = harness('s8');
    expect(() => h.repos.settings.update({ showHijri: false })).toThrow(/القراءة فقط/);
    expect(() => h.repos.people.createAccount({ role: 'participant', name: 'س', email: 'a@b.co' })).toThrow(/القراءة فقط/);
    const doc = h.db.docs.find((d) => d.status === 'facilitator_approved');
    if (doc) expect(() => h.repos.trips.docAction(doc.id, { type: 'leader_approve' })).toThrow(/القراءة فقط/);
  });
});

describe('مساعد القائد العام', () => {
  it('هو المتابع ويعتمد بصلاحيات القائد ويُسجَّل اسمه، ولا ينشئ حساباً', () => {
    const h = harness('s7');
    expect(roleKeysOf(h.db, 's7')).toContain('assistant');
    expect(getCapabilities(h.db, 's7').isTracker).toBe(true);
    const doc = h.db.docs.find((d) => d.status === 'facilitator_approved');
    if (doc) {
      h.repos.trips.docAction(doc.id, { type: 'leader_approve' });
      const after = h.db.docs.find((d) => d.id === doc.id)!;
      expect(after.history[after.history.length - 1]).toMatchObject({ byId: 's7', role: 'leader' });
    }
    expect(() => h.repos.people.createAccount({ role: 'supervisor', name: 'س', email: 'a@b.co' })).toThrow(/التقنية/);
  });
  it('الإعدادات التقنية لمسؤول التقنية وحده', () => {
    for (const id of ['p_lead', 's7', 's8']) {
      const h = harness(id);
      expect(() => h.repos.settings.update({ importantNotifications: [] })).toThrow();
    }
    const h = harness('s6');
    h.repos.settings.update({ importantNotifications: [] });
    expect(navFor(h.db, 's6').all.length).toBeGreaterThan(0);
  });
});
