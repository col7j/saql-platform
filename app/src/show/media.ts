// الوسائط: ملفات في public/show-media (تُنشر مع الموقع)، أو ملفات مرفوعة محلياً في IndexedDB على هذا الجهاز فقط.
import type { MediaRef } from './model';

const DB_NAME = 'saql-show-media';
const STORE = 'files';

export interface LocalFile {
  id: string;
  name: string;
  type: string;
  size: number;
  blob: Blob;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const req = run(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }).finally(() => db.close());
}

export async function putLocalFile(file: File): Promise<MediaRef> {
  const id = `m_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  await tx('readwrite', (s) => s.put({ id, name: file.name, type: file.type, size: file.size, blob: file } satisfies LocalFile));
  return { kind: 'local', id, name: file.name };
}
/** حفظ ملف بمعرّفه كما هو (استيراد عرض من جهاز آخر): المراجع في الإعدادات تبقى صالحة */
export async function putLocalFileWithId(f: LocalFile): Promise<void> {
  await tx('readwrite', (s) => s.put(f));
  urlCache.delete(f.id);
}
export const getLocalFile = (id: string) => tx<LocalFile | undefined>('readonly', (s) => s.get(id));
export const deleteLocalFile = (id: string) => tx('readwrite', (s) => s.delete(id)).then(() => undefined);
export const listLocalFiles = () => tx<LocalFile[]>('readonly', (s) => s.getAll());

const urlCache = new Map<string, Promise<string>>();

/** رابط قابل للعرض للمرجع. الملف المحلي غير الموجود على هذا الجهاز يرمي خطأً فتظهر شاشة البديل */
export function resolveMedia(ref: MediaRef): Promise<string> {
  if (ref.kind === 'url') return Promise.resolve(ref.src);
  let p = urlCache.get(ref.id);
  if (!p) {
    p = getLocalFile(ref.id).then((f) => {
      if (!f) throw new Error(`الملف «${ref.name ?? ref.id}» غير مرفوع على هذا الجهاز`);
      return URL.createObjectURL(f.blob);
    });
    p.catch(() => urlCache.delete(ref.id));
    urlCache.set(ref.id, p);
  }
  return p;
}

export const mediaLabel = (ref?: MediaRef) => (!ref ? '—' : ref.kind === 'url' ? ref.src : `${ref.name ?? ref.id} (محلي)`);

const preloaded = new Map<string, Promise<void>>();

/** تحميل مسبق: الصور تُفك مسبقاً، والفيديو يُحمَّل أوله في عنصر مخفي */
export function preload(ref: MediaRef, kind: 'image' | 'video'): Promise<void> {
  const key = (ref.kind === 'url' ? ref.src : ref.id) + kind;
  let p = preloaded.get(key);
  if (!p) {
    p = resolveMedia(ref).then(
      (url) =>
        new Promise<void>((resolve, reject) => {
          if (kind === 'image') {
            const img = new Image();
            img.src = url;
            img.decode().then(resolve, reject);
          } else {
            const v = document.createElement('video');
            v.preload = 'auto';
            v.muted = true;
            v.oncanplaythrough = () => resolve();
            v.onloadeddata = () => resolve();
            v.onerror = () => reject(new Error('تعذّر تحميل الفيديو'));
            v.src = url;
            v.load();
          }
        }),
    );
    p.catch(() => preloaded.delete(key));
    preloaded.set(key, p);
  }
  return p;
}
