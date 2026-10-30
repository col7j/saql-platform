// تصدير العرض كاملاً في ملف واحد، واستيراده على جهاز آخر (مع ملخص قبل الاستبدال وتقدّم أثناء العمل).
import { useEffect, useRef, useState } from 'react';
import { Button, Icons, Modal, Notice, Toggle } from '@/ui';
import { listLocalFiles } from '../media';
import type { ShowConfig } from '../model';
import { fmtSize, toast } from '../admin/MediaPicker';
import { BUNDLE_EXT, collectRefs, readBundle, type Manifest, type ReadBundle } from '../transfer/bundle';
import { exportShow, importShow, type ExportProgress } from '../transfer/device';

const fileName = (title: string) => `${(title || 'عرض').replace(/[\\/:*?"<>|]+/g, '-').trim()}-${new Date().toISOString().slice(0, 10)}${BUNDLE_EXT}`;

function save(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

export function ExportModal({ cfg, open, onClose }: { cfg: ShowConfig; open: boolean; onClose: () => void }) {
  const [unused, setUnused] = useState(false);
  const [lib, setLib] = useState<{ used: number; usedSize: number; all: number; allSize: number } | null>(null);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [result, setResult] = useState<{ size: number; count: number; missing: Manifest['missing'] } | null>(null);

  useEffect(() => {
    if (!open) return;
    setResult(null);
    setProgress(null);
    const used = new Set(collectRefs(cfg).flatMap((r) => (r.kind === 'local' ? [r.id] : [])));
    listLocalFiles().then((fs) => {
      const u = fs.filter((f) => used.has(f.id));
      setLib({ used: u.length, usedSize: u.reduce((a, f) => a + f.size, 0), all: fs.length, allSize: fs.reduce((a, f) => a + f.size, 0) });
    });
  }, [open, cfg]);

  const run = async () => {
    try {
      const out = await exportShow(cfg, unused, setProgress);
      save(out.blob, fileName(cfg.title));
      setResult({ size: out.blob.size, count: out.count, missing: out.manifest.missing });
    } catch (e) {
      toast(`تعذّر التصدير: ${(e as Error).message}`, 'error');
    } finally {
      setProgress(null);
    }
  };

  const busy = !!progress;
  return (
    <Modal open={open} onClose={() => !busy && onClose()} title="تصدير العرض كاملاً">
      <div className="space-y-4 text-sm text-ink-700">
        <p>ملف واحد فيه الشرائح والقالب وإعدادات الديمو، وكل الصور والفيديوهات والشعارات المرفوعة على هذا الجهاز وملفات الموقع المستخدمة. افتحه على الجهاز الآخر من «الملف ← استيراد عرض».</p>
        {lib && (
          <ul className="space-y-1 rounded-xl bg-ink-50 p-3 text-xs">
            <li>الشرائح: <b className="num">{cfg.segments.length}</b></li>
            <li>الملفات المستخدمة على هذا الجهاز: <b className="num">{lib.used}</b> ({fmtSize(lib.usedSize)})</li>
            <li>ملفات الموقع المستخدمة: <b className="num">{collectRefs(cfg).filter((r) => r.kind === 'url').length}</b></li>
          </ul>
        )}
        {lib && lib.all > lib.used && (
          <Toggle checked={unused} onChange={setUnused} label={`تضمين ملفات المكتبة غير المستخدمة (${lib.all - lib.used}، ${fmtSize(lib.allSize - lib.usedSize)})`} />
        )}
        {busy && (
          <div className="space-y-1">
            <div className="h-2 overflow-hidden rounded-full bg-ink-100">
              <div className="h-full bg-brand-600 transition-all" style={{ width: `${progress!.phase === 'collect' ? Math.round((progress!.done / Math.max(1, progress!.total)) * 80) : progress!.phase === 'pack' ? 90 : 100}%` }} />
            </div>
            <p className="text-xs text-ink-500">{progress!.phase === 'collect' ? `جمع الملفات ${progress!.done} من ${progress!.total}` : 'حزم الملف…'}</p>
          </div>
        )}
        {result && (
          <Notice tone={result.missing.length ? 'orange' : 'green'}>
            صُدِّر الملف ({fmtSize(result.size)}، {result.count} ملفاً).
            {result.missing.length > 0 && (
              <ul className="mt-1 list-disc ps-4 text-xs">
                {result.missing.map((m, i) => <li key={i}><span dir="ltr">{m.ref}</span>: {m.reason}</li>)}
              </ul>
            )}
          </Notice>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" disabled={busy} onClick={onClose}>{result ? 'تم' : 'إلغاء'}</Button>
          {!result && <Button icon={<Icons.Download className="h-4 w-4" />} disabled={busy || !lib} onClick={run}>{busy ? 'جارٍ التصدير…' : 'صدّر'}</Button>}
        </div>
      </div>
    </Modal>
  );
}

export function ImportModal({ file, onClose, onDone }: { file: File | null; onClose: () => void; onDone: (cfg: ShowConfig) => void }) {
  const [bundle, setBundle] = useState<ReadBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    setBundle(null);
    setError(null);
    if (!file) return;
    const n = ++seq.current;
    file
      .arrayBuffer()
      .then((b) => readBundle(new Uint8Array(b)))
      .then((b) => n === seq.current && setBundle(b), (e: Error) => n === seq.current && setError(e.message));
  }, [file]);

  const run = async () => {
    if (!bundle) return;
    setProgress({ done: 0, total: bundle.files.length });
    try {
      const cfg = await importShow(bundle, (done, total) => setProgress({ done, total }));
      onDone(cfg);
    } catch (e) {
      setError(`تعذّر الاستيراد: ${(e as Error).message}`);
    } finally {
      setProgress(null);
    }
  };

  const size = bundle?.files.reduce((a, f) => a + f.size, 0) ?? 0;
  return (
    <Modal open={!!file} onClose={() => !progress && onClose()} title="استيراد عرض">
      <div className="space-y-4 text-sm text-ink-700">
        {!bundle && !error && <p className="text-ink-500">جارٍ قراءة «{file?.name}» والتحقق من ملفاته…</p>}
        {error && <Notice tone="red">{error}</Notice>}
        {bundle && (
          <>
            <ul className="space-y-1 rounded-xl bg-ink-50 p-3 text-xs">
              <li>العرض: <b>{bundle.config.title}</b> (القالب {bundle.config.theme === 'light' ? 'الفاتح' : 'الغامق'})</li>
              <li>الشرائح: <b className="num">{bundle.config.segments.length}</b></li>
              <li>الملفات: <b className="num">{bundle.files.length}</b> ({fmtSize(size)})، وكلها سليمة (تطابقت بصماتها)</li>
              <li>صُدِّر في: <span className="num">{new Date(bundle.manifest.exportedAt).toLocaleString('ar-SA-u-nu-latn')}</span></li>
            </ul>
            {bundle.manifest.missing.length > 0 && (
              <Notice tone="orange">
                مراجع لم تُضمَّن في الملف:
                <ul className="mt-1 list-disc ps-4 text-xs">{bundle.manifest.missing.map((m, i) => <li key={i}><span dir="ltr">{m.ref}</span>: {m.reason}</li>)}</ul>
              </Notice>
            )}
            <Notice tone="orange">يستبدل العرض الحالي على هذا الجهاز بهذا العرض (يمكن التراجع بـ Ctrl+Z). الملفات تُضاف إلى المكتبة ولا يُحذف منها شيء.</Notice>
          </>
        )}
        {progress && <p className="text-xs text-ink-500">حفظ الملفات {progress.done} من {progress.total}…</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" disabled={!!progress} onClick={onClose}>إلغاء</Button>
          <Button icon={<Icons.Upload className="h-4 w-4" />} disabled={!bundle || !!progress} onClick={run}>{progress ? 'جارٍ الاستيراد…' : 'استورد'}</Button>
        </div>
      </div>
    </Modal>
  );
}
