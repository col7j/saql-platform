/// <reference types="vite/client" />
// هوية العرض: الرموز تطابق ملف الهوية، ولا ألوان أو خطوط مباشرة في شاشات العرض.
import { describe, expect, it } from 'vitest';
import { BRAND_COLORS, BRAND_FONTS, LOGOS, TYPE_SCALE, SAFE_MARGIN, hexToRgb, logoClearance } from '../src/show/brand/brand';

// الملفات نصاً عبر Vite (بلا أنواع Node في المشروع)
const raw = (g: Record<string, unknown>) => g as Record<string, string>;
const SHOW = raw(import.meta.glob('../src/show/**/*.{ts,tsx,css}', { query: '?raw', import: 'default', eager: true }));
const PUBLIC = raw(import.meta.glob('../public/{fonts,brand}/**/*', { query: '?raw', import: 'default', eager: true }));
const ORIGINAL = raw(import.meta.glob('../../brand assets/logo/*.svg', { query: '?raw', import: 'default', eager: true }));
const tokens = SHOW['../src/show/brand/tokens.css'];
const cssVar = (name: string) => new RegExp(`--${name}:\\s*([^;]+);`).exec(tokens)?.[1].replace(/\/\*.*$/, '').trim();
const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());


describe('رموز الهوية', () => {
  it('كل لون في brand.ts له رمز مطابق في tokens.css', () => {
    for (const [key, c] of Object.entries(BRAND_COLORS)) {
      expect(cssVar('b-' + kebab(key)), key).toBe(hexToRgb(c.hex).join(' '));
    }
  });

  it('ألوان ملف الهوية كما وردت، والقراران المعتمدان موسومان', () => {
    const pdf = Object.values(BRAND_COLORS).filter((c) => c.source === 'pdf').map((c) => c.hex);
    expect(pdf.sort()).toEqual(['#006F8C', '#00728E', '#00B9D1', '#1E2E33', '#8D8D8D', '#F79845', '#FBB42B', '#FFFFFF'].sort());
    expect(BRAND_COLORS.night).toMatchObject({ hex: '#044554', source: 'decision' });
  });

  it('أحجام الخطوط وتسلسلها من الجدول، والهامش الآمن 9%', () => {
    for (const [k, t] of Object.entries(TYPE_SCALE)) expect(Number(cssVar('b-fs-' + k)), k).toBe(t.size);
    expect(TYPE_SCALE.title.size).toBeGreaterThanOrEqual(96);
    expect(TYPE_SCALE.title.size).toBeLessThanOrEqual(110);
    expect(Number(cssVar('b-safe'))).toBe(SAFE_MARGIN);
    expect(SAFE_MARGIN / 1080).toBeCloseTo(0.09, 2);
  });

  it('المساحة الآمنة للشعار خُمس ارتفاعه', () => {
    expect(logoClearance(150)).toBe(30);
  });
});

describe('الخطوط محلية', () => {
  it('كل وزن معلن له ملف woff2 في public وتعريف @font-face', () => {
    for (const f of BRAND_FONTS) {
      expect(cssVar('b-font')).toContain(`'${f.family}'`);
      for (const [w, name] of Object.entries(f.weights)) {
        const file = `fonts/thmanyahsans/thmanyahsans-${name}.woff2`;
        expect('../public/' + file in PUBLIC, file).toBe(true);
        expect(tokens).toMatch(new RegExp(`font-weight: ${w};[^}]*${file.replace(/\./g, '\\.')}`));
      }
    }
  });

  it('لا تحميل خطوط أو ملفات من الإنترنت في العرض', () => {
    const css = [tokens, SHOW['../src/show/show.css']].join('\n');
    expect(css).not.toMatch(/https?:\/\//);
    expect(css).not.toMatch(/@fontsource|ibm-plex/i);
  });
});

describe('الشعارات', () => {
  it('النسخ الملونة مطابقة لملفات brand assets، والبيضاء بيضاء كلها', () => {
    const src: Record<string, string> = { horizontal: 'الشعار العرضي.svg', vertical: 'الشعار الطولي.svg', icon: 'ايقونة الشعار.svg' };
    for (const [k, l] of Object.entries(LOGOS)) {
      const color = PUBLIC['../public/' + l.color.slice(2)];
      const original = ORIGINAL['../../brand assets/logo/' + src[k]];
      if (original) expect(color, k).toBe(original);
      const white = PUBLIC['../public/' + l.white.slice(2)];
      const fills = [...white.matchAll(/fill:\s*([^;}\s]+)/g)].map((m) => m[1]);
      expect(fills.length).toBeGreaterThan(0);
      expect(new Set(fills)).toEqual(new Set(['#fff']));
    }
  });
});

describe('لا قيم مباشرة في شاشات العرض', () => {
  // المحرّر (admin) يتبع واجهة المنصة، والديمو يعرض صفحات المنصة نفسها
  const files = Object.keys(SHOW).filter((f) => !/\/(brand|admin)\/|ShowAdmin|PreviewFrame|DemoFrame/.test(f));
  const read = (f: string) => SHOW[f];

  it('لا ألوان hex ولا rgb ثابتة ولا رموز ألوان المنصة', () => {
    for (const f of files) {
      const s = read(f).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
      expect(s, f).not.toMatch(/#[0-9a-fA-F]{3,8}\b(?![^'"`]*\.svg)/);
      expect(s, f).not.toMatch(/rgb\((?!var\(--[bt]-)/);
      expect(s, f).not.toMatch(/--c-(brand|accent|ink)/);
      expect(s, f).not.toMatch(/\b(bg|text|ring|shadow|border)-(brand|accent|ink|white|black)\b/);
    }
  });

  it('لا خطوط مكتوبة مباشرة', () => {
    expect(files.length).toBeGreaterThan(10);
    for (const f of files) expect(read(f), f).not.toMatch(/font-family:(?!\s*var\(--b-font\))|fontFamily:/);
  });
});
