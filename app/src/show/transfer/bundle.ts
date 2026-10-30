// نقل العرض بين الأجهزة: ملف واحد (zip) فيه الإعدادات (الشرائح والقالب والديمو) وكل الوسائط
// (الصور والفيديوهات وشعارات الشركاء والخلفيات)، مع بصمة SHA-256 لكل ملف يُتحقق منها عند الاستيراد.
//
// show.json        إعدادات العرض كما يصدّرها المحرّر
// manifest.json    وصف الملفات وبصماتها
// media/…          الملفات نفسها (بلا ضغط: الصور والفيديو مضغوطة أصلاً)
import { strFromU8, strToU8, unzip, zip, type AsyncZippable } from 'fflate';
import type { MediaRef, ShowConfig } from '../model';
import { exportConfig, parseConfig } from '../storage';

export const BUNDLE_FORMAT = 'saql-show';
export const BUNDLE_VERSION = 1;
export const BUNDLE_EXT = '.saql-show.zip';

export interface BundleFile {
  path: string;
  /** local: ملف مرفوع على الجهاز (معرّفه يبقى كما هو)، url: ملف من الموقع (show-media) نُسخ احتياطاً */
  kind: 'local' | 'url';
  id?: string;
  src?: string;
  name: string;
  type: string;
  size: number;
  sha256: string;
  used: boolean;
}

export interface Manifest {
  format: typeof BUNDLE_FORMAT;
  version: number;
  exportedAt: string;
  title: string;
  segments: number;
  files: BundleFile[];
  /** مراجع لم تُضمَّن (رابط خارجي أو ملف لم يُعثر عليه) */
  missing: { ref: string; reason: string }[];
}

export interface SourceFile {
  kind: 'local' | 'url';
  id?: string;
  src?: string;
  name: string;
  type: string;
  data: Uint8Array;
  used: boolean;
}

const isRef = (v: any): v is MediaRef => v && typeof v === 'object' && ((v.kind === 'local' && typeof v.id === 'string') || (v.kind === 'url' && typeof v.src === 'string'));

/** كل مراجع الوسائط في الإعدادات، أينما كانت (عناصر، خلفيات، فئات الشركاء، وأي نوع يُضاف لاحقاً) */
export function collectRefs(cfg: ShowConfig): MediaRef[] {
  const out = new Map<string, MediaRef>();
  const walk = (v: unknown) => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (!v || typeof v !== 'object') return;
    if (isRef(v)) return void out.set(v.kind === 'local' ? `l:${v.id}` : `u:${v.src}`, v);
    Object.values(v).forEach(walk);
  };
  walk(cfg.segments);
  return [...out.values()];
}

/** رابط من ملفات الموقع نفسه (show-media وغيرها)، لا من موقع خارجي */
export const isSiteUrl = (src: string) => !/^[a-z][a-z0-9+.-]*:/i.test(src) && !src.startsWith('//');

export async function sha256(data: Uint8Array): Promise<string> {
  const h = await crypto.subtle.digest('SHA-256', data as BufferSource);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const safeName = (s: string) => s.replace(/[^\p{L}\p{N}._-]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'file';
const zipAsync = (files: AsyncZippable) => new Promise<Uint8Array>((res, rej) => zip(files, (e, d) => (e ? rej(e) : res(d))));
const unzipAsync = (data: Uint8Array) => new Promise<Record<string, Uint8Array>>((res, rej) => unzip(data, (e, d) => (e ? rej(e) : res(d))));

/** يبني ملف العرض الواحد */
export async function buildBundle(cfg: ShowConfig, sources: SourceFile[], missing: Manifest['missing'] = [], onProgress?: (done: number, total: number) => void): Promise<Uint8Array> {
  const files: BundleFile[] = [];
  const entries: AsyncZippable = {};
  let i = 0;
  for (const f of sources) {
    const path = `media/${String(++i).padStart(3, '0')}-${safeName(f.name)}`;
    files.push({ path, kind: f.kind, id: f.id, src: f.src, name: f.name, type: f.type, size: f.data.byteLength, sha256: await sha256(f.data), used: f.used });
    entries[path] = [f.data, { level: 0 }];
    onProgress?.(i, sources.length);
  }
  const manifest: Manifest = { format: BUNDLE_FORMAT, version: BUNDLE_VERSION, exportedAt: new Date().toISOString(), title: cfg.title, segments: cfg.segments.length, files, missing };
  entries['show.json'] = [strToU8(exportConfig(cfg)), { level: 6 }];
  entries['manifest.json'] = [strToU8(JSON.stringify(manifest, null, 2)), { level: 6 }];
  return zipAsync(entries);
}

export interface ReadBundle {
  config: ShowConfig;
  manifest: Manifest;
  files: (BundleFile & { data: Uint8Array })[];
}

/** يقرأ ملف العرض ويتحقق منه كاملاً قبل أي كتابة: الصيغة، الإعدادات، ووجود كل ملف وحجمه وبصمته */
export async function readBundle(data: Uint8Array): Promise<ReadBundle> {
  let entries: Record<string, Uint8Array>;
  try {
    entries = await unzipAsync(data);
  } catch {
    throw new Error('الملف ليس ملف عرض صالحاً (zip)');
  }
  if (!entries['manifest.json'] || !entries['show.json']) throw new Error('الملف لا يحوي عرضاً (manifest.json وshow.json)');
  let manifest: Manifest;
  try {
    manifest = JSON.parse(strFromU8(entries['manifest.json']));
  } catch {
    throw new Error('وصف الملفات (manifest.json) تالف');
  }
  if (manifest.format !== BUNDLE_FORMAT) throw new Error('الملف ليس من تصدير «عرض الحفل»');
  if (manifest.version > BUNDLE_VERSION) throw new Error('الملف من نسخة أحدث من هذه الشاشة');
  const config = parseConfig(strFromU8(entries['show.json']));
  const files: ReadBundle['files'] = [];
  for (const f of manifest.files ?? []) {
    const d = entries[f.path];
    if (!d) throw new Error(`ملف ناقص في الحزمة: ${f.name}`);
    if (d.byteLength !== f.size || (await sha256(d)) !== f.sha256) throw new Error(`ملف تالف في الحزمة: ${f.name}`);
    if (f.kind === 'local' && !f.id) throw new Error(`ملف بلا معرّف: ${f.name}`);
    files.push({ ...f, data: d });
  }
  return { config, manifest, files };
}

/** يستبدل مراجع روابط بمراجع محلية (حين لا يوجد الملف على الموقع في الجهاز الجديد) */
export function rewriteRefs(cfg: ShowConfig, map: Map<string, MediaRef>): ShowConfig {
  if (!map.size) return cfg;
  const walk = (v: any): any => {
    if (Array.isArray(v)) return v.map(walk);
    if (!v || typeof v !== 'object') return v;
    if (isRef(v) && v.kind === 'url' && map.has(v.src)) return map.get(v.src);
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
  };
  return { ...cfg, segments: walk(cfg.segments) };
}
