// قواعد تعارض الصفات (وثيقة القرارات + إجابات المالك): تُخزَّن كبيانات وتُطبَّق عند الإضافة
import { describe, expect, it } from 'vitest';
import { buildSeed } from '@/data/seed';
import { createLocalRepositories } from '@/data/repositories';
import { capacityConflict, substituteConflict } from '@/domain/capacities';
import type { DB } from '@/domain/types';

function harness(as: string) {
  let db: DB = buildSeed();
  const mutate = (recipe: (d: DB) => unknown) => {
    const draft = structuredClone(db);
    if (recipe(draft) === false) return;
    db = draft;
  };
  return { repos: createLocalRepositories(mutate, () => as), get db() { return db; } };
}

describe('قواعد التعارض', () => {
  it('البيانات التجريبية خالية من التعارض', () => {
    const db = buildSeed();
    db.persons.forEach((p) => expect(capacityConflict(db, p.id), p.name).toBeNull());
  });
  it('مسؤول المالية لا يقبل أي صفة ثانية', () => {
    const h = harness('p_lead');
    expect(() => h.repos.committees.addMember('c_media', 's5', 'member', false)).toThrow(/مسؤول المالية/);
    expect(() => h.repos.settings.setTracker('s5')).toThrow(/مسؤول المالية/);
    expect(h.db.memberships.some((m) => m.committeeId === 'c_media' && m.personId === 's5')).toBe(false);
  });
  it('مسؤول أي لجنة لا يكون ميسّراً، وعضوها يجوز', () => {
    const h = harness('p_lead');
    expect(() => h.repos.groups.update('g1', { facilitatorId: 's6' })).toThrow(/مسؤول اللجنة لا يكون ميسّراً/);
    expect(() => h.repos.committees.addMember('c_media', 's1', 'leader', false)).toThrow();
    h.repos.committees.addMember('c_media', 's1', 'member', false); // عضو لجنة + ميسّر: مسموح
    expect(h.db.memberships.some((m) => m.committeeId === 'c_media' && m.personId === 's1')).toBe(true);
  });
  it('مسؤول التقنية لا يكون متابعاً دائماً، ويجوز مسؤولاً للإعلامية وبديلاً مؤقتاً', () => {
    const h = harness('p_lead');
    expect(() => h.repos.settings.setTracker('s6')).toThrow(/التقنية/);
    expect(h.db.memberships.some((m) => m.committeeId === 'c_media' && m.personId === 's6' && m.role === 'leader')).toBe(true);
    const trip = h.db.trips.find((t) => t.id === 't7')!; // رحلة أُحُد
    expect(substituteConflict(h.db, 's6', trip)).toBeNull();
  });
  it('المتابع الدائم لا يكون ميسّراً ولا مسؤول لجنة، ويجوز عضواً', () => {
    const h = harness('p_lead');
    expect(() => h.repos.groups.update('g2', { facilitatorId: 's7' })).toThrow(/متابع الرحلات الدائم/);
    expect(() => h.repos.committees.addMember('c_media', 's7', 'leader', false)).toThrow(/متابع الرحلات الدائم/);
    h.repos.committees.addMember('c_media', 's7', 'member', false);
  });
  it('البديل المؤقت: أي شخص ليس ميسّر المجموعة المنفِّذة', () => {
    const db = buildSeed();
    const t7 = db.trips.find((t) => t.id === 't7')!; // أُحُد: ميسّرها s1
    expect(substituteConflict(db, 's1', t7)).toMatch(/ميسّر المجموعة المنفِّذة/);
    expect(substituteConflict(db, 's2', t7)).toBeNull(); // ميسّر مجموعة أخرى
    expect(substituteConflict(db, 's5', t7)).toMatch(/مسؤول المالية/);
  });
  it('القائد العام بلا قاعدة جمع صفات', () => {
    const h = harness('p_lead');
    h.repos.committees.addMember('c_tech', 'p_lead', 'leader', false);
    expect(capacityConflict(h.db, 'p_lead')).toBeNull();
  });
  it('القواعد بيانات: حذف قاعدة يرفع المنع', () => {
    const h = harness('p_lead');
    h.db.capacityRules = h.db.capacityRules.filter((r) => r.id !== 'cr_head_fac');
    expect(capacityConflict(h.db, 's6')).toBeNull();
  });
});
