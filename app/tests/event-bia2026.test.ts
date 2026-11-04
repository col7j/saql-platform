/// <reference types="vite/client" />
// حفل ختام «بيئات التطوع 2026»: الفقرات السبع عشرة، والجوائز التنازلية، والتكريم، والتنظيف من التطويل، والعزل عن «صقل»
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { registerExt, missingData } from '@/show/ext';
import { profile, nsKey, fbPath } from '@/show/profile';
import { exportConfig, parseConfig } from '@/show/storage';
import { agenda } from '@/show/ceremony/logic';
import { next, sortSegments, stepCount } from '@/show/nav';
import { stepSub } from '@/show/stepLabel';
import { KINDS, award, clean, honoring, qrLink, speaker, type AwardData } from '@/events/bia2026/kinds';
import { PRESETS, biaConfig } from '@/events/bia2026/defaults';

registerExt(...KINDS);

describe('الفقرات', () => {
  const cfg = biaConfig();
  const list = sortSegments(cfg.segments);
  it('17 فقرة بترتيب العرض الأصلي', () => {
    expect(agenda(list).map((a) => a.title)).toEqual([
      'الترحيب', 'المقدمة', 'القرآن الكريم', 'كلمة جمعية وفادة', 'تجربة جمعية', 'تجربة متطوع', 'التقرير الختامي', 'كلمة مؤسسة سالم بن محفوظ الأهلية',
      'جائزة بريق العطاء', 'جائزة أفضل مبادرة', 'تكريم الشركاء', 'تكريم فريق العمل', 'تكريم الجهات المتميزة', 'تكريم الجهات الداعمة والإشرافية', 'الختام', 'الصورة التذكارية', 'رابط تقييم الحفل',
    ]);
    const kinds = list.map((s) => (s.type === 'ext' ? s.settings.kind : s.type));
    for (const k of ['speaker', 'experience', 'award', 'honoring', 'qr-link', 'photo', 'slide']) expect(kinds).toContain(k);
  });
  it('لا تطويل في أي نص', () => {
    expect(JSON.stringify(cfg)).not.toContain('ـ');
    expect(clean('حـيــــاكـــم   الله')).toBe('حياكم الله');
    expect(speaker.parse({ kicker: 'المـــــقدمـــــة', name: 'أ. سهيل' }).kicker).toBe('المقدمة');
  });
  it('الجائزة: إعلان ثم الثالث ثم الثاني ثم الأول', () => {
    const a = list.find((s) => s.id === 'b_award_brq')!;
    expect(stepCount(a)).toBe(4);
    expect([0, 1, 2, 3].map((st) => stepSub(a, st))).toEqual(['شاشة الإعلان', 'المركز الثالث (1 من 3)', 'المركز الثاني (2 من 3)', 'المركز الأول (3 من 3)']);
    const d: AwardData = award.parse({ title: 'x', places: Array.from({ length: 5 }, () => ({ name: 'n' })) });
    expect(award.steps(d)).toBe(6);
    expect(award.parse({ places: Array.from({ length: 20 }, () => ({})) }).places).toHaveLength(10);
  });
  it('التكريم: عنوان ثم مكرَّم مكرَّم، أو شبكة وحدها، ويقبل أي عدد', () => {
    const items = Array.from({ length: 7 }, (_, i) => ({ label: 'شريك النجاح', name: `ج${i}`, role: '' }));
    expect(honoring.steps({ kicker: '', title: '', items, grid: false, gridOnly: false })).toBe(8);
    expect(honoring.steps({ kicker: '', title: '', items, grid: true, gridOnly: false })).toBe(9);
    expect(honoring.steps({ kicker: '', title: '', items, grid: false, gridOnly: true })).toBe(2);
  });
  it('رابط التقييم يقبل http(s) فقط', () => {
    expect(qrLink.parse({ url: 'https://x.sa/r' }).url).toBe('https://x.sa/r');
    expect(qrLink.parse({ url: 'javascript:alert(1)' }).url).toBe('');
  });
  it('التنقل يمر بكل المراكز', () => {
    let p = { seg: 8, step: 0 };
    const seen: number[] = [];
    for (let i = 0; i < 4; i++) (p = next(cfg, p)), seen.push(p.seg === 8 ? p.step : -1);
    expect(seen).toEqual([1, 2, 3, -1]);
  });
  it('قائمة «بيانات ناقصة» تعرض ما لم يُملأ', () => {
    const m = missingData(list);
    const titles = m.map((x) => x.title);
    expect(titles).toContain('كلمة جمعية وفادة');
    expect(titles).toContain('رابط تقييم الحفل');
    expect(titles).toContain('التقرير الختامي');
    expect(m.find((x) => x.title === 'جائزة بريق العطاء')!.fields).toContain('المركز الأول: الاسم');
    expect(titles).not.toContain('المقدمة');
  });
  it('قوالب «شريحة جديدة» لكل نوع', () => {
    expect(PRESETS.map((p) => p.key)).toEqual(['welcome', 'speaker', 'quran', 'experience', 'video', 'award', 'honoring', 'closing', 'photo', 'qr']);
    for (const p of PRESETS) expect(p.create('x').length).toBeGreaterThan(0);
  });
});

describe('الخصوصية والتخزين', () => {
  it('تصدير JSON (وshow.json العلني) بلا أسماء فائزين ولا مكرَّمين', () => {
    const cfg = biaConfig();
    const a = cfg.segments.find((s) => s.id === 'b_award_brq')!;
    if (a.type === 'ext') a.settings.data.places[0].name = 'اسم فائز حقيقي';
    const h = cfg.segments.find((s) => s.id === 'b_team')!;
    if (h.type === 'ext') h.settings.data.items = [{ label: '', name: 'عضو الفريق', role: '' }];
    const json = exportConfig(cfg);
    expect(json).not.toContain('اسم فائز حقيقي');
    expect(json).not.toContain('عضو الفريق');
    expect(exportConfig(cfg, { personal: true })).toContain('اسم فائز حقيقي');
    const repo = readFileSync('public-bia2026/show.json', 'utf8');
    expect(parseConfig(repo).segments).toHaveLength(17);
  });
  it('مفاتيح المتصفح ومسار Firebase بادئتهما الحفل، و«صقل» بلا بادئة', () => {
    expect(nsKey('show-config')).toBe('show-config');
    expect(fbPath('sessions/x')).toBe('sessions/x');
    const before = { ...profile };
    Object.assign(profile, { ns: 'bia2026', firebaseRoot: 'events/bia2026' });
    expect(nsKey('show-config')).toBe('bia2026.show-config');
    expect(fbPath('codes/123456')).toBe('events/bia2026/codes/123456');
    Object.assign(profile, before);
  });
  it('قواعد Firebase: مسار الحفل مستقل ومراجعه داخله', () => {
    const raw = Object.values(import.meta.glob('../firebase/database.rules.json', { query: '?raw', import: 'default', eager: true }))[0] as string;
    const ev = JSON.parse(raw).rules.events.bia2026;
    expect(Object.keys(ev).sort()).toEqual(['attempts', 'claims', 'codes', 'displayKeys', 'sessions']);
    const txt = JSON.stringify(ev);
    expect(txt).not.toMatch(/root\.child\('(sessions|codes|claims|attempts|displayKeys)'\)/);
    expect(txt).toContain("root.child('events').child('bia2026').child('codes')");
  });
});
