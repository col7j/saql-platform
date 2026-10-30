// الوصول وتجربة الواجهة: ما لا يملكه الشخص لا يظهر في قوائمه، ويُرفض لو كُتب عنوانه يدوياً (في التوجيه وطبقة البيانات)
import { describe, expect, it } from 'vitest';
import { ACCESS_DENIED, homeFor, navFor, routeAccess } from '@/domain/access';
import { buildSeed } from '@/data/seed';
import { fixtureSeed } from './helpers/fixture';
import { harness } from './helpers/harness';

const db = fixtureSeed();
const keysOf = (pid: string) => navFor(db, pid).all.map((i) => i.key);

describe('الرفض عند كتابة العنوان يدوياً', () => {
  it('المشارك: شاشات الإدارة والمالية والإعدادات', () => {
    for (const path of ['/app/finance', '/app/settings', '/app/people', '/app/users', '/app/insights', '/app/inbox', '/app/site-editor', '/app/plans/u3', '/app/approvals', '/app/audit'])
      expect(routeAccess(db, 'u2', path), path).toBe(false);
    expect(routeAccess(db, 'u2', '/app/trips')).toBe(true);
  });
  it('عضو فريق العمل بلا صفة: الاعتمادات والسجل والمالية والإعدادات', () => {
    expect(routeAccess(db, 's4', '/app/approvals')).toBe(false);
    expect(routeAccess(db, 's4', '/app/audit')).toBe(false);
    expect(routeAccess(db, 's4', '/app/finance')).toBe(false);
    expect(routeAccess(db, 's4', '/app/settings')).toBe(false);
    expect(routeAccess(db, 's6', '/app/users')).toBe(true);
  });
  it('تبويب مالي لم يُمنح: عضو مالية بلا صلاحية العرض', () => {
    expect(routeAccess(db, 's3', '/app/finance')).toBe(true);
    expect(routeAccess(db, 's3', '/app/finance', '?tab=budget')).toBe(false);
    expect(routeAccess(db, 's3', '/app/finance', '?tab=audit')).toBe(false);
  });
  it('لجنة لم يُمنح صلاحيتها = رفض، ومثلها اللجنة غير الموجودة (لا تسريب)', () => {
    expect(routeAccess(db, 's2', '/app/committees/c_media')).toBe(true); // عضو
    expect(routeAccess(db, 's2', '/app/committees/c_fin')).toBe(false);
    expect(routeAccess(db, 's2', '/app/committees/c_tech')).toBe(false);
    expect(routeAccess(db, 's2', '/app/committees/لا-توجد')).toBe(routeAccess(db, 's2', '/app/committees/c_fin'));
    expect(routeAccess(db, 'u9', '/app/committees/c_media')).toBe(true); // مشارك عضو في الإعلامية
    expect(routeAccess(db, 'u2', '/app/committees/c_media')).toBe(false);
  });
  it('ملفات الأشخاص والخطط والاجتماعات ولقاءات المجموعات الأخرى', () => {
    expect(routeAccess(db, 'u2', '/app/people/u3')).toBe(false);
    expect(routeAccess(db, 'u2', '/app/people/u2')).toBe(true);
    expect(routeAccess(db, 's2', '/app/plans/u2')).toBe(false); // ليس ميسّر مجموعته
    expect(routeAccess(db, 's1', '/app/plans/u2')).toBe(true);
    expect(routeAccess(db, 'u2', '/app/meetings/mt4')).toBe(false);
    expect(routeAccess(db, 'u8', '/app/focus/f_g1_1')).toBe(false); // لقاء مجموعة أخرى
  });
  it('العنوان غير الموجود يُرفض كالممنوع تماماً', () => {
    expect(routeAccess(db, 'p_lead', '/app/لا-يوجد')).toBe(false);
    expect(routeAccess(db, 'p_lead', '/app/trips/t1/extra')).toBe(false);
    expect(routeAccess(db, 'p_lead', '/app/trips/t_missing')).toBe(false);
  });
});

describe('طبقة البيانات', () => {
  it('قراءة لجنة لم يُمنح صلاحيتها تُرفض بنفس الرسالة للموجود وغير الموجود', () => {
    const h = harness('s2');
    expect(() => h.repos.access.committee('c_fin')).toThrow(ACCESS_DENIED);
    expect(() => h.repos.access.committee('c_none')).toThrow(ACCESS_DENIED);
    expect(h.repos.access.committee('c_media').id).toBe('c_media');
    expect(h.repos.access.canOpen('/app/finance')).toBe(false);
  });
  it('الكتابة في لجنة لم يُمنح صلاحيتها تُرفض', () => {
    const h = harness('s2');
    expect(() => h.repos.committees.saveKpi('c_fin', { id: 'k', title: 'x', target: 1, taskTag: 'x' })).toThrow(ACCESS_DENIED);
    expect(() => h.repos.tasks.create({ title: 'x', scope: 'committee', committeeId: 'c_fin', assigneeId: 's2', dueDate: '2026-12-01', proofType: 'none' })).toThrow(ACCESS_DENIED);
    expect(() => h.repos.committees.addMember('c_media', 'u3', 'member', false)).toThrow(ACCESS_DENIED);
  });
  it('ملف شخص آخر للمشارك يُرفض', () => {
    const h = harness('u2');
    expect(() => h.repos.access.person('u3')).toThrow(ACCESS_DENIED);
    expect(h.repos.access.person('u2').id).toBe('u2');
  });
});

describe('القوائم ما يملكه الشخص فقط', () => {
  it('كل عنصر في القائمة يفتح فعلاً لصاحبها', () => {
    db.persons.forEach((p) => navFor(db, p.id).all.forEach((i) => {
      const [path, q] = i.to.split('?');
      expect(routeAccess(db, p.id, path, q ? `?${q}` : ''), `${p.name}: ${i.to}`).toBe(true);
    }));
  });
  it('المشارك لا يرى المالية ولا الإعدادات ولا اللجان التي ليس فيها', () => {
    const k = keysOf('u2');
    ['finance', 'settings', 'people', 'users'].forEach((x) => expect(k).not.toContain(x));
  });
});

describe('الواجهة حسب الدور (بيانات)', () => {
  it('مسؤول المالية: الأساسية ثم المالية والترتيب آخراً، ولا منافسة في الرئيسية', () => {
    const nav = navFor(db, 's5');
    expect(nav.sections[0].title).toBe('الأساسية');
    expect(nav.sections[1].items[0].key).toBe('finance_overview');
    expect(nav.all[nav.all.length - 1].key).toBe('leaderboard');
    expect(homeFor(db, 's5')).not.toContain('competition');
  });
  it('مسؤول التقنية والإعلامية: أدواته بعد الأساسية والترتيب آخراً', () => {
    const nav = navFor(db, 's6');
    expect(nav.sections[1].items[0].key).toBe('people');
    expect(nav.sections[1].items[0].label).toBe('الأشخاص والحسابات');
    expect(nav.all.map((i) => i.key)).toContain('tracking_link');
    expect(nav.all[nav.all.length - 1].key).toBe('leaderboard');
    expect(homeFor(db, 's6')).not.toContain('competition');
  });
  it('المشارك يرى المنافسة أولاً، والتقويم من الأساسية لكل دور', () => {
    expect(homeFor(db, 'u2')[0]).not.toBe('actions');
    db.persons.forEach((p) => expect(keysOf(p.id)).toContain('calendar'));
  });
  it('الترتيب يُقرأ من الإعدادات: تغييره يغيّر القائمة دون كود', () => {
    const d = buildSeed();
    const fin = d.settings.ui.layouts.find((l) => l.role === 'finance_head')!;
    fin.sections[1].items.reverse();
    expect(navFor(d, 's5').sections[1].items[0].key).toBe('finance_wallet');
  });
});
