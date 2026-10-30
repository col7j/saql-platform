/// <reference types="vite/client" />
// القوالب: الغامق والفاتح من رموز الهوية، الافتتاح، شبكة الشعارات التلقائية، ومكان استخدام الوسائط.
import { describe, expect, it } from 'vitest';
import { LOGOS } from '@/show/brand/brand';
import { DEFAULT_CONFIG, type ShowConfig } from '@/show/model';
import { parseConfig, exportConfig } from '@/show/storage';
import { logoSrc } from '@/show/slides/model';
import { MAX_CARD, TIER_SCALE, fitLogoGrid, type TierInput } from '@/show/slides/layout';
import { templateSegment, templateSettings } from '@/show/slides/templates';
import { mediaUsage } from '@/show/editor/usage';

const tokens = Object.values(import.meta.glob('../src/show/brand/tokens.css', { query: '?raw', import: 'default', eager: true }))[0] as string;
const block = (selector: string) => {
  const i = tokens.indexOf(selector + ' {');
  return tokens.slice(i, tokens.indexOf('}', i));
};
const vars = (b: string) => [...b.matchAll(/(--t-[a-z0-9-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].replace(/\/\*.*$/, '').trim()] as const);

describe('القالبان الغامق والفاتح', () => {
  const dark = vars(block(".show-stage, [data-show-theme='dark']"));
  const light = vars(block("[data-show-theme='light']"));
  it('الفاتح يعرّف كل أدوار الغامق، فالتبديل يغيّر كل شيء', () => {
    expect(dark.length).toBeGreaterThan(10);
    expect(light.map(([k]) => k).sort()).toEqual(dark.map(([k]) => k).sort());
  });
  it('الألوان في القالبين من رموز الهوية فقط (--b-*) أو شفافية', () => {
    for (const [k, v] of [...dark, ...light]) {
      const colors = v.match(/var\(--[a-z-]+\)/g) ?? [];
      for (const c of colors) expect(c, k).toMatch(/^var\(--b-/);
      expect(v, k).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    }
  });
  it('الفاتح: خلفية بيضاء وعناوين بالتيل الداكن ونص بالحبر', () => {
    const l = Object.fromEntries(light);
    expect(l['--t-bg']).toBe('var(--b-white)');
    expect(l['--t-head']).toBe('var(--b-teal-deep)');
    expect(l['--t-fg']).toBe('var(--b-ink)');
  });
  it('القالب يُحفظ ويُستورد، والافتراضي غامق', () => {
    expect(parseConfig({ segments: [] }).theme).toBe('dark');
    const cfg: ShowConfig = { ...DEFAULT_CONFIG, theme: 'light' };
    expect(parseConfig(exportConfig(cfg)).theme).toBe('light');
    expect(parseConfig({ theme: 'neon', segments: [] }).theme).toBe('dark');
  });
  it('الشعار «حسب القالب»: الأبيض الكامل على الغامق والملون على الفاتح', () => {
    expect(logoSrc({ kind: 'vertical', variant: 'auto' }, 'dark')).toBe(LOGOS.vertical.white);
    expect(logoSrc({ kind: 'vertical', variant: 'auto' }, 'light')).toBe(LOGOS.vertical.color);
    expect(logoSrc({ kind: 'icon', variant: 'white' }, 'light')).toBe(LOGOS.icon.white);
  });
});

describe('شاشة الافتتاح', () => {
  const s = templateSettings('opening', 'o', { title: 'حفل الختام', org: 'جمعية', orgLogo: { kind: 'local', id: 'm1' } });
  it('شعار الجمعية ثم اسمها ثم الخط الذهبي ثم عنوان الحفل', () => {
    const delays = s.elements.map((e) => e.anim.delay);
    expect(delays).toEqual([...delays].sort((a, b) => a - b));
    expect(s.elements.map((e) => e.type)).toEqual(['image', 'text', 'shape', 'text']);
    expect(s.elements[0].type === 'image' && s.elements[0].props.media).toEqual({ kind: 'local', id: 'm1' });
    expect(s.elements[2].anim.type).toBe('wipe');
  });
  it('كل العناصر داخل الهامش الآمن', () => {
    for (const e of s.elements) {
      expect(e.y).toBeGreaterThanOrEqual(96);
      expect(e.y + e.h).toBeLessThanOrEqual(1080 - 96);
    }
  });
});

describe('شبكة الشعارات التلقائية', () => {
  const tiers = (counts: number[]): TierInput[] => counts.map((count, i) => ({ size: (['lg', 'md', 'sm'] as const)[i % 3], count, hasTitle: true }));
  it('تتسع دائماً في الصندوق', () => {
    for (const counts of [[1], [1, 3, 7], [2, 6, 20], [0, 40, 0], [12, 12, 12]]) {
      for (const [w, h] of [[1728, 714], [900, 400], [1600, 900]]) {
        expect(fitLogoGrid(tiers(counts), w, h).height, `${counts} ${w}×${h}`).toBeLessThanOrEqual(h);
      }
    }
  });
  it('شعار وحيد لا يتضخم، والكثير يصغر ويلتف', () => {
    expect(fitLogoGrid(tiers([1]), 1728, 714).base).toBe(MAX_CARD);
    const many = fitLogoGrid(tiers([4, 12, 30]), 1728, 714);
    expect(many.base).toBeLessThan(MAX_CARD);
    expect(many.tiers[2].rows).toBeGreaterThan(1);
  });
  it('الفئة الأعلى بطاقاتها أكبر', () => {
    const g = fitLogoGrid(tiers([1, 3, 5]), 1728, 714);
    expect(g.tiers[0].cardH).toBeGreaterThan(g.tiers[1].cardH);
    expect(g.tiers[1].cardH).toBeGreaterThan(g.tiers[2].cardH);
    expect(g.tiers[2].cardH / g.tiers[0].cardH).toBeCloseTo(TIER_SCALE.sm, 1);
  });
  it('الصندوق الأكبر يعطي بطاقات أكبر', () => {
    expect(fitLogoGrid(tiers([3, 8, 14]), 1728, 800).base).toBeGreaterThan(fitLogoGrid(tiers([3, 8, 14]), 1728, 400).base);
  });
});

describe('مكان استخدام الملفات', () => {
  it('يجمع الشرائح التي تستخدم كل ملف محلي من الصور والفيديو والشعارات والخلفية', () => {
    const a = templateSegment('image', 'a', 0, { media: { kind: 'local', id: 'img' } });
    const b = templateSegment('partners', 'b', 1, { tiers: [{ title: 'x', size: 'lg', logos: [{ kind: 'local', id: 'img' }, { kind: 'url', src: 'p.png' }] }] });
    const c = { ...templateSegment('blank', 'c', 2), settings: { ...templateSegment('blank', 'c', 2).settings, bg: { kind: 'media' as const, media: { kind: 'local' as const, id: 'bg' } } } };
    const u = mediaUsage({ ...DEFAULT_CONFIG, segments: [a, b, c] });
    expect(u.get('img')).toEqual([a.title, b.title]);
    expect(u.get('bg')).toEqual([c.title]);
    expect(u.has('p.png')).toBe(false);
  });
});
