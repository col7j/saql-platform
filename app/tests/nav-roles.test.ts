// المرحلة 5: قوائم الأدوار الجديدة. مهام الدور فقط، من 4 إلى 6 مجموعات، وفي كل مجموعة 5 عناصر أو أقل، ولا تكرار
import { describe, expect, it } from 'vitest';
import { navFor, routeAccess } from '@/domain/access';
import { buildSeed } from '@/data/seed';

const db = buildSeed();
const nav = (pid: string) => navFor(db, pid);
const keys = (pid: string) => nav(pid).all.map((i) => i.key);
const labels = (pid: string) => nav(pid).all.map((i) => i.label);
const groupItems = (pid: string, title: string) => nav(pid).sections.find((s) => s.title === title)?.items.map((i) => i.label);
const BASICS = ['الرئيسية', 'التقويم', 'الإشعارات', 'ملفي'];

describe('قواعد عامة لكل القوائم', () => {
  it('الأساسية أولاً، ومجموعات من 4 إلى 6، وكل مجموعة 5 عناصر أو أقل، ولا شاشة مكررة', () => {
    for (const p of db.persons) {
      const n = nav(p.id);
      expect(n.sections[0].items.map((i) => i.label), p.name).toEqual(BASICS);
      expect(n.sections.length, p.name).toBeGreaterThanOrEqual(2);
      expect(n.sections.length, p.name).toBeLessThanOrEqual(6);
      n.sections.forEach((s) => expect(s.items.length, `${p.name}: ${s.title}`).toBeLessThanOrEqual(5));
      const tos = n.all.map((i) => i.to);
      expect(new Set(tos).size, p.name).toBe(tos.length);
    }
  });
  it('كل عنصر في كل قائمة يفتح فعلاً لصاحبها (لا عنصر بلا صلاحية)', () => {
    db.persons.forEach((p) => nav(p.id).all.forEach((i) => {
      const [path, q] = i.to.split('?');
      expect(routeAccess(db, p.id, path, q ? `?${q}` : ''), `${p.name}: ${i.to}`).toBe(true);
    }));
  });
});

describe('القائد العام', () => {
  it('17 عنصراً في خمس مجموعات بعد الأساسية', () => {
    expect(nav('p_lead').all.length).toBe(4 + 17);
    expect(groupItems('p_lead', 'البرنامج')).toEqual(['الرحلات', 'المجموعات', 'لقاءات التركيز', 'الاجتماعات', 'الترتيب']);
    expect(groupItems('p_lead', 'المتابعة')).toEqual(['المؤشرات', 'المهام', 'بانتظار اعتمادي', 'المالية (مراقبة)']);
    expect(groupItems('p_lead', 'الأشخاص والصلاحيات')).toEqual(['الأشخاص والصلاحيات']);
    expect(groupItems('p_lead', 'التقييم')).toEqual(['الإعدادات والتقييم', 'الاستبيانات', 'الخطط الشخصية']);
    expect(groupItems('p_lead', 'المحتوى')).toEqual(['رابط الداعم', 'تحرير الموقع', 'المكتبة', 'رسائل المشاركين']);
  });
  it('لا «اللجان» ولا «المستخدمون» عناصرَ مستقلة (صارت داخل الأشخاص والصلاحيات)', () => {
    expect(keys('p_lead')).not.toContain('committees');
    expect(keys('p_lead')).not.toContain('users');
    expect(routeAccess(db, 'p_lead', '/app/committees')).toBe(true);
  });
});

describe('مسؤول المالية', () => {
  it('ثمانية أقسام مالية فقط، ولا أقسام البرنامج في قائمته', () => {
    expect(keys('s5').filter((k) => k.startsWith('finance_'))).toEqual(['finance_overview', 'finance_requests', 'finance_invoices', 'finance_direct', 'finance_wallet', 'finance_fees', 'finance_reports', 'finance_settings']);
    ['trips', 'focus', 'meetings', 'groups', 'library', 'surveys', 'tasks', 'people', 'committees'].forEach((k) => expect(keys('s5')).not.toContain(k));
    expect(keys('s5')[keys('s5').length - 1]).toBe('leaderboard');
  });
  it('يصل للرحلة من داخل الطلب فقط: ليست في قائمته لكن رابطها يفتح', () => {
    expect(routeAccess(db, 's5', '/app/trips/t3')).toBe(true);
  });
});

describe('مسؤول التقنية', () => {
  it('أدواته ثم «البرنامج (عرض)»', () => {
    expect(groupItems('s6', 'أدوات اللجنة التقنية')).toEqual(['الأشخاص والحسابات', 'إعدادات النظام', 'سجل التدقيق', 'لجنتي']);
    expect(groupItems('s6', 'البرنامج (عرض)')).toEqual(['الرحلات', 'لقاءات التركيز', 'الاجتماعات']);
    expect(routeAccess(db, 's6', '/app/audit')).toBe(true);
  });
});

describe('الميسّر', () => {
  it('مجموعتي ثم البرنامج ثم المتابعة، وبلا المالية', () => {
    expect(groupItems('s1', 'مجموعتي')).toEqual(['مجموعتي', 'اللقاءات', 'اللقاءات الفردية', 'الخطط الشخصية']);
    expect(groupItems('s1', 'البرنامج')).toEqual(['الرحلات', 'الاجتماعات', 'الاستبيانات', 'المكتبة']);
    expect(groupItems('s1', 'المتابعة')).toEqual(['طلباتي', 'المهام']);
    expect(keys('s1')).not.toContain('finance');
    expect(routeAccess(db, 's1', '/app/finance')).toBe(false); // خرج من اللجنة المالية في البيانات التجريبية
  });
});

describe('المشارك وقائد المجموعة والمتابع وعضو فريق العمل', () => {
  it('المشارك: عناصره الحالية في مجموعات، والتنقل السفلي الرحلات ولقاءات التركيز', () => {
    expect(labels('u2')).toEqual(expect.arrayContaining(['الرحلات', 'لقاءات التركيز', 'خطتي', 'المكتبة', 'لقائي مع الميسّر', 'مهامي', 'الاستبيانات', 'المجموعات', 'الترتيب']));
    expect(nav('u2').sections[1].items.slice(0, 2).map((i) => i.label)).toEqual(['الرحلات', 'لقاءات التركيز']);
  });
  it('قائد المجموعة: رحلتي وطلباتي أولاً، ولا يكرر عناصر المشارك', () => {
    expect(nav('u1').sections[1].items.slice(0, 2).map((i) => i.label)).toEqual(['رحلتي', 'طلباتي']);
    expect(labels('u1').filter((l) => l === 'الرحلات')).toHaveLength(0);
  });
  it('متابع الرحلات: متابعة الرحلات أولاً', () => {
    expect(nav('s7').sections[1].items[0].key).toBe('tracker');
  });
  it('الرسائل شاشة واحدة لطرفي القناة، والخطط الشخصية شاشة واحدة', () => {
    expect(nav('p_lead').all.find((i) => i.key === 'inbox')!.to).toBe('/app/messages');
    expect(routeAccess(db, 'p_lead', '/app/messages')).toBe(true);
    expect(routeAccess(db, 'u2', '/app/plans')).toBe(true); // خطتي
    expect(routeAccess(db, 'u2', '/app/plans/u2')).toBe(true);
    expect(routeAccess(db, 'u2', '/app/plans/u3')).toBe(false);
  });
});

describe('منع الوصول للشاشات الجديدة', () => {
  it('بانتظار اعتمادي للقائد العام وحده', () => {
    db.persons.filter((p) => !p.isGeneralLeader).forEach((p) => expect(routeAccess(db, p.id, '/app/approvals'), p.name).toBe(false));
    expect(routeAccess(db, 'p_lead', '/app/approvals')).toBe(true);
  });
  it('سجل التدقيق لمسؤول التقنية والقائد العام فقط', () => {
    expect(routeAccess(db, 's6', '/app/audit')).toBe(true);
    ['s1', 's5', 's7', 'u1', 'u2'].forEach((id) => expect(routeAccess(db, id, '/app/audit'), id).toBe(false));
  });
  it('أقسام المالية: العناوين القديمة تتحول، وقسم لم يُمنح يُرفض', () => {
    expect(routeAccess(db, 's5', '/app/finance', '?tab=custody')).toBe(true); // ← الطلبات والعهد
    expect(routeAccess(db, 's3', '/app/finance', '?tab=wallet')).toBe(false);
    expect(routeAccess(db, 's3', '/app/finance', '?tab=reports')).toBe(false);
    expect(routeAccess(db, 's3', '/app/finance', '?tab=لا-يوجد')).toBe(false);
  });
  it('المشارك بعد نشر التشكيل لا يصل للرسائل', () => {
    expect(routeAccess(db, 'u2', '/app/messages')).toBe(false);
  });
});
