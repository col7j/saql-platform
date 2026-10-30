// مكتبة الوسائط داخل المحرّر: رفع (بالسحب أو الاختيار) واستعراض وإعادة استخدام الملفات المحفوظة على هذا الجهاز.
// تعمل في وضعين: استعراض (إدراج في الشريحة الحالية)، واختيار (لحقل صورة أو فيديو أو شعار شريك).
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button, Icons, Modal, askConfirm, cx } from '@/ui';
import { deleteLocalFile, listLocalFiles, putLocalFile, type LocalFile } from '../media';
import type { MediaRef } from '../model';
import { fmtSize, toast } from '../admin/MediaPicker';

export type MediaKind = 'image' | 'video';
const kindOf = (type: string): MediaKind | null => (type.startsWith('image/') ? 'image' : type.startsWith('video/') ? 'video' : null);

/** يرفع ملفات الصور والفيديو ويعيد مراجعها، ويتجاهل غيرها */
export async function uploadFiles(files: File[]): Promise<{ ref: MediaRef; kind: MediaKind }[]> {
  const out: { ref: MediaRef; kind: MediaKind }[] = [];
  for (const f of files) {
    const kind = kindOf(f.type);
    if (!kind) {
      toast(`«${f.name}» ليس صورة ولا فيديو`, 'error');
      continue;
    }
    try {
      out.push({ ref: await putLocalFile(f), kind });
    } catch {
      toast(`تعذّر حفظ «${f.name}» (المساحة ممتلئة؟)`, 'error');
    }
  }
  if (out.length) toast(out.length === 1 ? `رُفع ملف واحد إلى المكتبة` : `رُفع ${out.length} ملفات إلى المكتبة`);
  return out;
}

/** فتح المكتبة لاختيار ملف (يستخدمها حقل الوسائط في لوحة الخصائص) */
type Pick = (accept: MediaKind) => Promise<MediaRef | undefined>;
const PickContext = createContext<Pick | null>(null);
export const useMediaPick = () => useContext(PickContext);

function Preview({ f }: { f: LocalFile }) {
  const url = useMemo(() => URL.createObjectURL(f.blob), [f]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return kindOf(f.type) === 'video' ? (
    <video src={url} muted preload="metadata" className="h-full w-full object-contain" />
  ) : (
    <img src={url} alt="" className="h-full w-full object-contain" draggable={false} />
  );
}

interface Props {
  /** معرّفات الملفات المستخدمة وأسماء الشرائح التي تستخدمها */
  usage: Map<string, string[]>;
  onInsert: (ref: MediaRef, kind: MediaKind) => void;
  children: ReactNode;
  open: boolean;
  setOpen: (v: boolean) => void;
}

/** يوفّر الاختيار من المكتبة لكل ما بداخله، ويرسم نافذة المكتبة */
export function MediaLibraryHost({ usage, onInsert, children, open, setOpen }: Props) {
  const [picking, setPicking] = useState<{ accept: MediaKind; resolve: (r?: MediaRef) => void } | null>(null);
  const pick: Pick = (accept) => new Promise((resolve) => setPicking({ accept, resolve }));
  const close = () => {
    picking?.resolve(undefined);
    setPicking(null);
    setOpen(false);
  };
  return (
    <PickContext.Provider value={pick}>
      {children}
      {(open || picking) && (
        <Library
          accept={picking?.accept}
          usage={usage}
          onClose={close}
          onChoose={(ref, kind) => {
            if (picking) {
              picking.resolve(ref);
              setPicking(null);
            } else {
              onInsert(ref, kind);
              setOpen(false);
            }
          }}
        />
      )}
    </PickContext.Provider>
  );
}

function Library({ accept, usage, onClose, onChoose }: { accept?: MediaKind; usage: Map<string, string[]>; onClose: () => void; onChoose: (ref: MediaRef, kind: MediaKind) => void }) {
  const [files, setFiles] = useState<LocalFile[] | null>(null);
  const [filter, setFilter] = useState<'all' | MediaKind>(accept ?? 'all');
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const load = () => listLocalFiles().then((l) => setFiles(l.sort((a, b) => b.id.localeCompare(a.id))), () => setFiles([]));
  useEffect(() => {
    load();
  }, []);
  const add = async (list: FileList | File[] | null) => {
    if (!list?.length) return;
    await uploadFiles([...list]);
    load();
  };
  const shown = (files ?? []).filter((f) => filter === 'all' || kindOf(f.type) === filter);
  const total = (files ?? []).reduce((a, f) => a + f.size, 0);
  return (
    <Modal open onClose={onClose} title={accept ? (accept === 'image' ? 'اختر صورة من المكتبة' : 'اختر فيديو من المكتبة') : 'مكتبة الوسائط'} wide>
      <div
        onDragOver={(e) => (e.preventDefault(), setOver(true))}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => (e.preventDefault(), setOver(false), add(e.dataTransfer.files))}
        className={cx('mb-4 flex flex-wrap items-center gap-3 rounded-2xl border-2 border-dashed p-4 transition', over ? 'border-brand-600 bg-brand-50' : 'border-ink-200')}
      >
        <Icons.Upload className="h-6 w-6 text-brand-600" />
        <span className="min-w-0 flex-1 text-sm text-ink-600">اسحب الصور والفيديوهات إلى هنا، أو</span>
        <Button size="sm" onClick={() => input.current?.click()}>اختر ملفات</Button>
        <input ref={input} type="file" multiple accept={accept ? `${accept}/*` : 'image/*,video/*'} hidden onChange={(e) => (add(e.target.files), (e.target.value = ''))} />
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-ink-500">
        {!accept &&
          (['all', 'image', 'video'] as const).map((k) => (
            <button key={k} onClick={() => setFilter(k)} className={cx('rounded-full border px-3 py-1', filter === k ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-ink-100 hover:border-ink-200')}>
              {k === 'all' ? 'الكل' : k === 'image' ? 'صور' : 'فيديو'}
            </button>
          ))}
        <span className="ms-auto">على هذا الجهاز فقط (لا تُنشر مع الموقع) · {files?.length ?? 0} ملفاً · {fmtSize(total)}</span>
      </div>
      {!files ? null : !shown.length ? (
        <p className="py-10 text-center text-sm text-ink-500">لا توجد ملفات بعد</p>
      ) : (
        <ul className="grid max-h-[55vh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((f) => {
            const kind = kindOf(f.type)!;
            const used = usage.get(f.id) ?? [];
            return (
              <li key={f.id} className="group overflow-hidden rounded-xl border border-ink-100 bg-white">
                <button className="block aspect-video w-full bg-ink-50 p-2" onClick={() => onChoose({ kind: 'local', id: f.id, name: f.name }, kind)} title={accept ? 'اختر' : 'أدرج في الشريحة'}>
                  <Preview f={f} />
                </button>
                <div className="space-y-1 p-2">
                  <p className="truncate text-xs text-ink-800" dir="ltr" title={f.name}>{f.name}</p>
                  <div className="flex items-center gap-1 text-[11px] text-ink-500">
                    {kind === 'video' ? <Icons.Film className="h-3 w-3" /> : <Icons.Image className="h-3 w-3" />}
                    <span>{fmtSize(f.size)}</span>
                    <span className="flex-1" />
                    <button
                      className="p-1 text-ink-400 hover:text-bad-600"
                      title="حذف"
                      onClick={() => askConfirm({ title: `حذف «${f.name}»؟`, body: used.length ? `مستخدم في: ${used.join('، ')}. سيختفي منها.` : undefined, cta: 'احذف', danger: true, run: () => deleteLocalFile(f.id).then(load) })}
                    >
                      <Icons.Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className={cx('truncate text-[11px]', used.length ? 'text-ok-700' : 'text-ink-400')} title={used.join('، ')}>
                    {used.length ? `مستخدم في: ${used.join('، ')}` : 'غير مستخدم'}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}
