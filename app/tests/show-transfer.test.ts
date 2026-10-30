// نقل العرض: ملف واحد يحمل الإعدادات وكل الوسائط، ويُتحقق منه كاملاً قبل أي كتابة.
import { describe, expect, it } from 'vitest';
import { strToU8, unzipSync, zipSync } from 'fflate';
import { DEFAULT_CONFIG, type ShowConfig } from '@/show/model';
import { templateSegment } from '@/show/slides/templates';
import { buildBundle, collectRefs, isSiteUrl, readBundle, rewriteRefs, sha256, type SourceFile } from '@/show/transfer/bundle';

const img: SourceFile = { kind: 'local', id: 'm_logo', name: 'شعار الجمعية.png', type: 'image/png', data: new Uint8Array([137, 80, 78, 71, 1, 2, 3, 4]), used: true };
const vid: SourceFile = { kind: 'local', id: 'm_vid', name: 'intro.webm', type: 'video/webm', data: new Uint8Array(70_000).map((_, i) => i % 251), used: true };
const site: SourceFile = { kind: 'url', src: 'show-media/partners/a.svg', name: 'a.svg', type: 'image/svg+xml', data: strToU8('<svg/>'), used: true };

function deck(): ShowConfig {
  const opening = templateSegment('opening', 'o', 0, { title: 'حفل الختام', org: 'جمعية', orgLogo: { kind: 'local', id: 'm_logo', name: 'شعار الجمعية.png' } });
  const video = templateSegment('video', 'v', 1, { title: 'المقدمة', media: { kind: 'local', id: 'm_vid', name: 'intro.webm' } });
  const partners = templateSegment('partners', 'p', 2, { tiers: [{ title: 'الشركاء', size: 'lg', logos: [{ kind: 'url', src: 'show-media/partners/a.svg' }, { kind: 'url', src: 'https://example.com/x.png' }, { kind: 'local', id: 'm_logo' }] }] });
  return { ...DEFAULT_CONFIG, title: 'حفل الختام', theme: 'light', segments: [opening, video, partners, ...DEFAULT_CONFIG.segments.map((s) => ({ ...s, order: 3 }))] };
}

describe('مراجع الوسائط', () => {
  it('كل المراجع أينما كانت، بلا تكرار', () => {
    const refs = collectRefs(deck());
    expect(refs.map((r) => (r.kind === 'local' ? r.id : r.src)).sort()).toEqual(['https://example.com/x.png', 'm_logo', 'm_vid', 'show-media/partners/a.svg'].sort());
  });
  it('ملفات الموقع نفسه فقط تُنسخ، والخارجية تبقى روابط', () => {
    expect(isSiteUrl('show-media/a.png')).toBe(true);
    expect(isSiteUrl('./brand/logo.svg')).toBe(true);
    expect(isSiteUrl('https://x.com/a.png')).toBe(false);
    expect(isSiteUrl('//cdn.x.com/a.png')).toBe(false);
    expect(isSiteUrl('data:image/png;base64,AAA')).toBe(false);
  });
});

describe('الحزمة', () => {
  it('التصدير ثم الاستيراد يعيد العرض والملفات كما هي بالبايت', async () => {
    const cfg = deck();
    const zip = await buildBundle(cfg, [img, vid, site], [{ ref: 'https://example.com/x.png', reason: 'رابط خارجي' }]);
    const back = await readBundle(zip);
    expect(back.config.segments).toEqual(cfg.segments);
    expect(back.config.theme).toBe('light');
    expect(back.manifest.missing).toHaveLength(1);
    expect(back.files.map((f) => [f.kind, f.id ?? f.src, f.name])).toEqual([['local', 'm_logo', 'شعار الجمعية.png'], ['local', 'm_vid', 'intro.webm'], ['url', 'show-media/partners/a.svg', 'a.svg']]);
    expect(back.files[1].data).toEqual(vid.data);
    expect(back.files[1].sha256).toBe(await sha256(vid.data));
  });
  it('ملف تالف أو ناقص يُرفض قبل أي كتابة', async () => {
    const zip = await buildBundle(deck(), [img, vid]);
    const entries = unzipSync(zip);
    const path = Object.keys(entries).find((k) => k.includes('intro'))!;
    const broken = { ...entries, [path]: entries[path].slice() };
    broken[path][100] ^= 0xff;
    await expect(readBundle(zipSync(broken))).rejects.toThrow(/تالف في الحزمة: intro\.webm/);
    const { [path]: _gone, ...without } = entries;
    await expect(readBundle(zipSync(without))).rejects.toThrow(/ناقص/);
  });
  it('ليس ملف عرض: يُرفض برسالة واضحة', async () => {
    await expect(readBundle(strToU8('hello'))).rejects.toThrow(/zip/);
    await expect(readBundle(zipSync({ 'a.txt': strToU8('x') }))).rejects.toThrow(/لا يحوي عرضاً/);
    const zip = await buildBundle(deck(), []);
    const entries = unzipSync(zip);
    const m = JSON.parse(new TextDecoder().decode(entries['manifest.json']));
    await expect(readBundle(zipSync({ ...entries, 'manifest.json': strToU8(JSON.stringify({ ...m, format: 'other' })) }))).rejects.toThrow(/ليس من تصدير/);
    await expect(readBundle(zipSync({ ...entries, 'manifest.json': strToU8(JSON.stringify({ ...m, version: 99 })) }))).rejects.toThrow(/أحدث/);
  });
  it('الوسائط بلا ضغط (مضغوطة أصلاً) والإعدادات مضغوطة', async () => {
    const zip = await buildBundle(deck(), [vid]);
    expect(zip.byteLength).toBeGreaterThan(vid.data.byteLength);
    expect(zip.byteLength).toBeLessThan(vid.data.byteLength + 20_000);
  });
});

describe('ملفات الموقع غير الموجودة في الجهاز الجديد', () => {
  it('تتحول مراجعها إلى ملفات محلية من الحزمة، والباقي كما هو', () => {
    const cfg = deck();
    const out = rewriteRefs(cfg, new Map([['show-media/partners/a.svg', { kind: 'local', id: 'm_imp_1', name: 'a.svg' }]]));
    const refs = collectRefs(out).map((r) => (r.kind === 'local' ? r.id : r.src)).sort();
    expect(refs).toEqual(['https://example.com/x.png', 'm_imp_1', 'm_logo', 'm_vid'].sort());
    expect(rewriteRefs(cfg, new Map())).toBe(cfg);
  });
});
