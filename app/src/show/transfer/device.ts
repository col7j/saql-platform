// جانب المتصفح من النقل: جمع الملفات من هذا الجهاز (IndexedDB) ومن الموقع (show-media) للتصدير،
// وكتابتها في الجهاز الجديد عند الاستيراد بنفس معرّفاتها، فتبقى كل المراجع في الإعدادات صالحة.
import { listLocalFiles, putLocalFileWithId } from '../media';
import type { MediaRef, ShowConfig } from '../model';
import { buildBundle, collectRefs, isSiteUrl, rewriteRefs, type Manifest, type ReadBundle, type SourceFile } from './bundle';

export interface ExportProgress {
  phase: 'collect' | 'pack' | 'done';
  done: number;
  total: number;
}

const bytes = async (b: Blob) => new Uint8Array(await b.arrayBuffer());

/** ملف العرض كاملاً. includeUnused: تضمين ملفات المكتبة غير المستخدمة في أي شريحة */
export async function exportShow(cfg: ShowConfig, includeUnused: boolean, onProgress?: (p: ExportProgress) => void): Promise<{ blob: Blob; manifest: Pick<Manifest, 'missing'>; count: number }> {
  const refs = collectRefs(cfg);
  const usedLocal = new Set(refs.filter((r) => r.kind === 'local').map((r) => (r as { id: string }).id));
  const library = await listLocalFiles();
  const sources: SourceFile[] = [];
  const missing: Manifest['missing'] = [];
  const wanted = library.filter((f) => includeUnused || usedLocal.has(f.id));
  const urls = refs.filter((r): r is Extract<MediaRef, { kind: 'url' }> => r.kind === 'url');
  const total = wanted.length + urls.length;
  let done = 0;
  for (const f of wanted) {
    sources.push({ kind: 'local', id: f.id, name: f.name, type: f.type, data: await bytes(f.blob), used: usedLocal.has(f.id) });
    onProgress?.({ phase: 'collect', done: ++done, total });
  }
  for (const id of usedLocal) if (!library.some((f) => f.id === id)) missing.push({ ref: id, reason: 'ملف محلي مستخدم لكنه غير موجود على هذا الجهاز' });
  for (const r of urls) {
    onProgress?.({ phase: 'collect', done: ++done, total });
    if (!isSiteUrl(r.src)) {
      missing.push({ ref: r.src, reason: 'رابط من موقع خارجي: يبقى رابطاً' });
      continue;
    }
    try {
      const res = await fetch(r.src, { cache: 'no-cache' });
      const type = res.headers.get('content-type') ?? '';
      // خادم التطوير يعيد الصفحة الرئيسية للمسار غير الموجود: ليست ملف وسائط
      if (!res.ok || type.startsWith('text/html')) throw new Error();
      sources.push({ kind: 'url', src: r.src, name: r.src.split('/').pop() || 'file', type, data: await bytes(await res.blob()), used: true });
    } catch {
      missing.push({ ref: r.src, reason: 'لم يُعثر على الملف في الموقع' });
    }
  }
  onProgress?.({ phase: 'pack', done: 0, total: 1 });
  const zipped = await buildBundle(cfg, sources, missing);
  onProgress?.({ phase: 'done', done: 1, total: 1 });
  return { blob: new Blob([zipped as BlobPart], { type: 'application/zip' }), manifest: { missing }, count: sources.length };
}

/** هل الملف موجود على الموقع في هذا الجهاز؟ */
async function onSite(src: string) {
  try {
    const res = await fetch(src, { method: 'HEAD', cache: 'no-cache' });
    return res.ok && !(res.headers.get('content-type') ?? '').startsWith('text/html');
  } catch {
    return false;
  }
}

/** يكتب ملفات الحزمة في هذا الجهاز ويعيد الإعدادات الجاهزة للحفظ */
export async function importShow(b: ReadBundle, onProgress?: (done: number, total: number) => void): Promise<ShowConfig> {
  const map = new Map<string, MediaRef>();
  let done = 0;
  for (const f of b.files) {
    const blob = new Blob([f.data as BlobPart], { type: f.type });
    if (f.kind === 'local') {
      await putLocalFileWithId({ id: f.id!, name: f.name, type: f.type, size: f.size, blob });
    } else if (f.src && !(await onSite(f.src))) {
      // ملف الموقع غير موجود هنا (نسخة أخرى من الموقع أو بلا إنترنت): يُحفظ محلياً من الحزمة
      const id = `m_imp_${f.sha256.slice(0, 12)}`;
      await putLocalFileWithId({ id, name: f.name, type: f.type, size: f.size, blob });
      map.set(f.src, { kind: 'local', id, name: f.name });
    }
    onProgress?.(++done, b.files.length);
  }
  return rewriteRefs(b.config, map);
}
