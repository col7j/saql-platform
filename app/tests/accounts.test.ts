// الحسابات: القائد العام ينشئ الشخص، ومسؤول اللجنة التقنية وحده يدير الدخول وكلمات المرور
import { describe, expect, it } from 'vitest';
import { DEMO_PASSWORD } from '@/data/seed-people';
import { authenticate } from '@/domain/accounts';
import { sha256Hex } from '@/domain/crypto';
import { harness } from './helpers/harness';

describe('الحسابات وكلمات المرور', () => {
  it('SHA-256 مطابق للمعيار', () => {
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });
  it('الدخول باسم الدخول وكلمة المرور التجريبية', () => {
    const h = harness('p_lead');
    expect(authenticate(h.db, 'leader', DEMO_PASSWORD)).toMatchObject({ personId: 'p_lead' });
    expect(authenticate(h.db, 'leader', 'خطأ')).toHaveProperty('error');
  });
  it('المشارك والعضو ينشئهما التقنية والقائد ومساعده، والحسابات الخاصة للتقنية وحدها', () => {
    const h = harness('p_lead');
    const r0 = h.repos.people.createAccount({ role: 'participant', name: 'مشارك', email: 'new.one@student.example' });
    expect(h.db.persons.find((p) => p.id === r0.id)).toBeTruthy();
    expect(() => h.repos.people.createAccount({ role: 'general_leader', name: 'ق', email: 'l9@x.io' })).toThrow(/التقنية وحده/);
    expect(() => h.repos.people.createAccount({ role: 'supervisor', name: 'ش', email: 'sv@x.io' })).toThrow(/التقنية وحده/);
    h.as('s1');
    expect(() => h.repos.people.create({ kind: 'staff', name: 'س', email: 'x@y.z' })).toThrow(/التقنية/);
    h.as('s6');
    const r = h.repos.people.createAccount({ role: 'participant', name: 'مشارك جديد', email: 'second.one@student.example' });
    expect(h.db.accounts.find((x) => x.personId === r.id)).toMatchObject({ username: 'second.one', mustChangePassword: true });
    expect(authenticate(h.db, 'second.one', r.password)).toMatchObject({ personId: r.id, mustChangePassword: true });
    expect(() => h.repos.people.createAccount({ role: 'general_leader', name: 'قائد آخر', email: 'l2@x.io' })).toThrow(/بالفعل/);
  });
  it('مسؤول التقنية يعيد التعيين، وصاحب الحساب يغيّر الكلمة أول دخول', () => {
    const h = harness('s6');
    const temp = h.repos.accounts.resetPassword('u1');
    expect(authenticate(h.db, 'u1', DEMO_PASSWORD)).toHaveProperty('error');
    expect(authenticate(h.db, 'u1', temp)).toMatchObject({ personId: 'u1', mustChangePassword: true });
    h.repos.accounts.changeOwnPassword('u1', temp, 'newpass1');
    expect(authenticate(h.db, 'u1', 'newpass1')).toMatchObject({ mustChangePassword: false });
  });
  it('التعطيل يمنع الدخول، واسم الدخول فريد', () => {
    const h = harness('s6');
    h.repos.accounts.setDisabled('u2', true);
    expect(authenticate(h.db, 'u2', DEMO_PASSWORD)).toMatchObject({ error: expect.stringMatching(/معطّل/) });
    expect(() => h.repos.accounts.setUsername('u3', 'u4')).toThrow(/مستخدم/);
    expect(h.db.audit.filter((a) => a.area === 'accounts').length).toBeGreaterThan(0);
  });
});
