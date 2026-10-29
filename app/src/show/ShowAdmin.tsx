// شاشة التحكم (#/show-admin): الفقرات وترتيبها وإعداداتها، معاينة، ريموت للعرض، واستيراد وتصدير.
// كل تعديل يُحفظ فوراً في show-config ويُبث لشاشة العرض.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Button, Card, ConfirmHost, Icons, Input, MoreMenu, Modal, Toasts, askConfirm, cx } from '@/ui';
import { buildSeed } from '@/data/seed';
import { deleteLocalFile, listLocalFiles, type LocalFile } from './media';
import { SEGMENT_LABELS, type MediaRef, type Segment, type SegmentType, type ShowConfig } from './model';
import { addSegment, moveSegment, removeSegment, sortSegments, stepCount, updateSegment, type Pos } from './nav';
import { exportConfig, loadRepoConfig, parseConfig, saveConfig } from './storage';
import { useShowConfig, useSync } from './useShow';
import { SegmentEditor, DEMO_STEP_LABELS } from './admin/Editors';
import { fmtSize, toast } from './admin/MediaPicker';

const TYPE_ICON: Record<SegmentType, typeof Icons.Film> = { video: Icons.Film, slides: Icons.GalleryHorizontal, demo: Icons.MonitorPlay, names: Icons.ListOrdered, blank: Icons.Square };
const TYPE_HINT: Record<SegmentType, string> = {
  video: 'مقدمة أو افتتاح، يعمل تلقائياً مع زر تخطٍّ',
  slides: 'صور مُصدّرة من PowerPoint',
  demo: 'جولة متحركة في شاشات المنصة',
  names: 'قائمة تظهر اسماً بعد اسم',
  blank: 'شاشة سوداء أو الشعار لفقرة المتحدث',
};

const showUrl = (hash: string) => `${window.location.pathname}${window.location.search}${hash}`;
const uid = () => `seg_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function stepLabel(seg: Segment, step: number) {
  if (seg.type === 'slides') return `الشريحة ${step + 1} من ${stepCount(seg)}`;
  if (seg.type === 'names') return step === 0 ? 'العنوان' : `${Math.min(seg.settings.names.length, step * seg.settings.perStep)} من ${seg.settings.names.length} اسماً`;
  if (seg.type === 'demo') return DEMO_STEP_LABELS[seg.settings.steps[step]] ?? '';
  return '';
}

function collectLocalIds(cfg: ShowConfig) {
  const ids = new Set<string>();
  const add = (m?: MediaRef) => m?.kind === 'local' && ids.add(m.id);
  for (const s of cfg.segments) {
    if (s.type === 'video') add(s.settings.media);
    if (s.type === 'slides') s.settings.slides.forEach(add);
  }
  return ids;
}

function download(name: string, text: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** معاينة بحجم شاشة العرض (1280×720) مصغّرة لعرض الحاوية */
function Preview({ seg, step }: { seg: Segment; step: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setScale(e.contentRect.width / 1280));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const src = showUrl(`#/show?preview=${encodeURIComponent(seg.id)}&step=${step}`);
  // أول تحميل بالرابط، وبعده يتغير الـ hash فقط فلا يُعاد تحميل الإطار
  const frame = useRef<HTMLIFrameElement>(null);
  const [initial] = useState(src);
  useEffect(() => {
    const w = frame.current?.contentWindow;
    if (w && w.location.hash !== src.slice(src.indexOf('#'))) w.location.hash = src.slice(src.indexOf('#'));
  }, [src]);
  return (
    <div ref={box} className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
      <iframe ref={frame} src={initial} title="معاينة الفقرة" className="pointer-events-none absolute left-0 top-0 origin-top-left border-0" style={{ width: 1280, height: 720, transform: `scale(${scale})` }} />
    </div>
  );
}

function LocalFilesModal({ open, onClose, used }: { open: boolean; onClose: () => void; used: Set<string> }) {
  const [files, setFiles] = useState<LocalFile[] | null>(null);
  const load = () => listLocalFiles().then(setFiles, () => setFiles([]));
  useEffect(() => {
    if (open) load();
  }, [open]);
  const total = (files ?? []).reduce((a, f) => a + f.size, 0);
  return (
    <Modal open={open} onClose={onClose} title="الملفات المرفوعة على هذا الجهاز" wide>
      <p className="mb-3 text-xs text-ink-500">تُحفظ في متصفح هذا الجهاز فقط (IndexedDB) ولا تُنشر مع الموقع. المجموع: {fmtSize(total)}</p>
      {!files ? null : !files.length ? (
        <p className="py-6 text-center text-sm text-ink-500">لا توجد ملفات</p>
      ) : (
        <ul className="divide-y divide-ink-100">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-3 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate" dir="ltr">{f.name}</span>
              <span className="text-xs text-ink-500">{fmtSize(f.size)}</span>
              {used.has(f.id) ? <Badge tone="green">مستخدم</Badge> : <Badge>غير مستخدم</Badge>}
              <Button size="sm" variant="danger" onClick={() => askConfirm({ title: `حذف «${f.name}»؟`, body: used.has(f.id) ? 'الملف مستخدم في فقرة، وستظهر شاشة البديل مكانه.' : undefined, cta: 'احذف', danger: true, run: () => deleteLocalFile(f.id).then(load) })}>حذف</Button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

export default function ShowAdmin() {
  const sync = useSync();
  const [cfg, setCfg] = useShowConfig(sync);
  const [selected, setSelected] = useState<string | null>(null);
  const [previewStep, setPreviewStep] = useState(0);
  const [live, setLive] = useState<{ pos: Pos; started: boolean; at: number } | null>(null);
  const [filesOpen, setFilesOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const demoTrips = useMemo(() => buildSeed().trips.map((t) => ({ id: t.id, title: t.title })), []);

  useEffect(() => {
    document.title = 'التحكم في العرض · صقل';
    const off = sync.subscribe((m) => m.type === 'state' && setLive({ pos: m.pos, started: m.started, at: Date.now() }));
    sync.send({ type: 'hello' });
    return off;
  }, [sync]);

  // العرض متصل إن أبلغ بحالته خلال آخر دقيقة، ونطلب الحالة دورياً
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => (sync.send({ type: 'hello' }), tick((n) => n + 1)), 5000);
    return () => clearInterval(t);
  }, [sync]);
  const connected = !!live && Date.now() - live.at < 12000;

  if (!cfg) return <div className="min-h-screen bg-ink-50" />;
  const list = sortSegments(cfg.segments);
  const seg = list.find((s) => s.id === selected) ?? list[0];
  const step = seg ? Math.min(previewStep, stepCount(seg) - 1) : 0;
  const liveSeg = connected ? list[live!.pos.seg] : undefined;

  const commit = (next: ShowConfig) => {
    const saved = saveConfig(next);
    setCfg(saved);
    sync.send({ type: 'config', config: saved });
  };
  const setSegments = (fn: (s: Segment[]) => Segment[]) => commit({ ...cfg, segments: fn(cfg.segments) });
  const select = (id: string) => (setSelected(id), setPreviewStep(0));

  const add = (type: SegmentType) => {
    const id = uid();
    setSegments((s) => addSegment(s, type, SEGMENT_LABELS[type], id));
    select(id);
  };

  const onImport = async (f?: File) => {
    if (!f) return;
    try {
      const imported = parseConfig(await f.text());
      askConfirm({ title: 'استيراد الإعدادات؟', body: `ستُستبدل الفقرات الحالية بـ ${imported.segments.length} فقرات من «${f.name}». الملفات المحلية لا تُنقل مع الملف.`, cta: 'استورد', run: () => (commit(imported), setSelected(null), toast('استُوردت الإعدادات')) });
    } catch (e) {
      toast(`الملف غير صالح: ${(e as Error).message}`, 'error');
    }
  };
  const restoreRepo = () =>
    askConfirm({ title: 'استعادة show.json من المستودع؟', body: 'تُستبدل الإعدادات المحفوظة على هذا الجهاز بالملف المنشور مع الموقع.', cta: 'استعد', danger: true, run: async () => (commit(await loadRepoConfig()), setSelected(null), toast('استُعيدت إعدادات المستودع')) });

  return (
    <div className="min-h-screen bg-ink-50 pb-16">
      <header className="sticky top-0 z-20 border-b border-ink-100 bg-white/90 backdrop-blur">
        <div className="container-x flex flex-wrap items-center gap-3 py-3">
          <img src="./brand/logo-icon.svg" alt="" className="h-9 w-9" />
          <div className="min-w-0 flex-1">
            <Input value={cfg.title} onChange={(e) => commit({ ...cfg, title: e.target.value })} className="!min-h-0 border-transparent !px-2 !py-1 text-lg font-semibold text-ink-900 hover:border-ink-200" aria-label="اسم العرض" />
          </div>
          <Badge tone={connected ? 'green' : 'gray'} icon={<span className={cx('h-2 w-2 rounded-full', connected ? 'bg-ok-500' : 'bg-ink-300')} />}>
            {connected ? 'شاشة العرض متصلة' : 'شاشة العرض غير مفتوحة'}
          </Badge>
          <MoreMenu
            label="الملف"
            items={[
              { label: 'تصدير الإعدادات (JSON)', onClick: () => download('show.json', exportConfig(cfg)) },
              { label: 'استيراد إعدادات…', onClick: () => importRef.current?.click() },
              { label: 'استعادة show.json من المستودع', onClick: restoreRepo },
              { label: 'الملفات المرفوعة على هذا الجهاز', onClick: () => setFilesOpen(true) },
            ]}
          />
          <input ref={importRef} type="file" accept="application/json,.json" hidden onChange={(e) => (onImport(e.target.files?.[0]), (e.target.value = ''))} />
          <Button icon={<Icons.MonitorPlay className="h-4 w-4" />} onClick={() => window.open(showUrl('#/show'), 'saql-show')}>افتح شاشة العرض</Button>
        </div>
      </header>

      <main className="container-x mt-6 grid gap-6 lg:grid-cols-[380px_1fr]">
        <div className="space-y-6">
          <Card title="الفقرات" subtitle="اسحب للترتيب، أو استخدم الأسهم" pad={false}>
            <ol className="px-2 pb-2">
              {list.map((s, i) => {
                const I = TYPE_ICON[s.type];
                const onAir = liveSeg?.id === s.id;
                return (
                  <li
                    key={s.id}
                    draggable
                    onDragStart={(e) => (setDragId(s.id), (e.dataTransfer.effectAllowed = 'move'))}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => dragId && dragId !== s.id && setSegments((x) => moveSegment(x, dragId, i))}
                    onDragEnd={() => setDragId(null)}
                    className={cx('group flex items-center gap-2 rounded-xl px-2 py-2 transition', seg?.id === s.id ? 'bg-brand-50' : 'hover:bg-ink-50', dragId === s.id && 'opacity-40')}
                  >
                    <Icons.GripVertical className="h-4 w-4 shrink-0 cursor-grab text-ink-300" />
                    <span className="w-5 shrink-0 text-center text-xs text-ink-400 num">{i + 1}</span>
                    <button className="flex min-w-0 flex-1 items-center gap-2 text-start" onClick={() => select(s.id)}>
                      <I className={cx('h-4 w-4 shrink-0', seg?.id === s.id ? 'text-brand-600' : 'text-ink-400')} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink-900">{s.title}</span>
                        <span className="block text-xs text-ink-500">{SEGMENT_LABELS[s.type]}{stepCount(s) > 1 ? ` · ${stepCount(s)} خطوات` : ''}</span>
                      </span>
                      {onAir && <Badge tone="orange">على الشاشة</Badge>}
                    </button>
                    <span className="flex shrink-0 opacity-60 group-hover:opacity-100">
                      <button className="p-1 text-ink-500 hover:text-ink-900 disabled:opacity-30" disabled={i === 0} onClick={() => setSegments((x) => moveSegment(x, s.id, i - 1))} aria-label="للأعلى"><Icons.ChevronUp className="h-4 w-4" /></button>
                      <button className="p-1 text-ink-500 hover:text-ink-900 disabled:opacity-30" disabled={i === list.length - 1} onClick={() => setSegments((x) => moveSegment(x, s.id, i + 1))} aria-label="للأسفل"><Icons.ChevronDown className="h-4 w-4" /></button>
                    </span>
                  </li>
                );
              })}
              {!list.length && <li className="py-8 text-center text-sm text-ink-500">لا توجد فقرات بعد</li>}
            </ol>
          </Card>

          <Card title="إضافة فقرة">
            <div className="grid gap-2">
              {(Object.keys(SEGMENT_LABELS) as SegmentType[]).map((t) => {
                const I = TYPE_ICON[t];
                return (
                  <button key={t} onClick={() => add(t)} className="flex items-center gap-3 rounded-xl border border-ink-100 px-3 py-2.5 text-start transition hover:border-brand-600/40 hover:bg-brand-50">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-600"><I className="h-4 w-4" /></span>
                    <span>
                      <span className="block text-sm font-medium text-ink-900">{SEGMENT_LABELS[t]}</span>
                      <span className="block text-xs text-ink-500">{TYPE_HINT[t]}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          <Card title="التحكم في العرض" subtitle={connected ? (liveSeg ? `الآن: ${liveSeg.title}${stepLabel(liveSeg, live!.pos.step) ? ' · ' + stepLabel(liveSeg, live!.pos.step) : ''}${live!.started ? '' : ' (لم يبدأ)'}` : '') : 'افتح شاشة العرض على الشاشة الخارجية، ثم تحكّم بها من هنا أو بالكليكر'}>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" disabled={!connected} icon={<Icons.ChevronRight className="h-4 w-4" />} onClick={() => sync.send({ type: 'nav', dir: 'prev' })}>السابق</Button>
              <Button disabled={!connected} onClick={() => sync.send({ type: 'nav', dir: 'next' })}>التالي <Icons.ChevronLeft className="h-4 w-4" /></Button>
              {seg && <Button variant="secondary" disabled={!connected} icon={<Icons.Cast className="h-4 w-4" />} onClick={() => sync.send({ type: 'goto', pos: { seg: list.indexOf(seg), step } })}>اعرض «{seg.title}» الآن</Button>}
            </div>
          </Card>

          {seg && (
            <Card
              title={
                <Input value={seg.title} onChange={(e) => setSegments((x) => updateSegment(x, seg.id, { title: e.target.value }))} className="!min-h-0 border-transparent !px-2 !py-1 text-lg font-semibold text-ink-900 hover:border-ink-200" aria-label="عنوان الفقرة" />
              }
              subtitle={SEGMENT_LABELS[seg.type]}
              action={<Button size="sm" variant="danger" icon={<Icons.Trash2 className="h-4 w-4" />} onClick={() => askConfirm({ title: `حذف «${seg.title}»؟`, cta: 'احذف', danger: true, run: () => (setSegments((x) => removeSegment(x, seg.id)), setSelected(null)) })}>حذف</Button>}
            >
              <div className="grid gap-6 xl:grid-cols-[1fr_minmax(0,1.1fr)]">
                <div className="min-w-0">
                  <SegmentEditor key={seg.id} seg={seg} demoTrips={demoTrips} patch={(settings) => setSegments((x) => updateSegment(x, seg.id, { settings }))} />
                </div>
                <div className="min-w-0">
                  <Preview seg={seg} step={step} />
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <button className="rounded-full p-2 text-ink-500 hover:bg-ink-50 disabled:opacity-30" disabled={step === 0} onClick={() => setPreviewStep(step - 1)} aria-label="الخطوة السابقة"><Icons.ChevronRight className="h-5 w-5" /></button>
                    <span className="text-xs text-ink-500">{stepCount(seg) > 1 ? `معاينة · ${stepLabel(seg, step)}` : 'معاينة'}</span>
                    <button className="rounded-full p-2 text-ink-500 hover:bg-ink-50 disabled:opacity-30" disabled={step >= stepCount(seg) - 1} onClick={() => setPreviewStep(step + 1)} aria-label="الخطوة التالية"><Icons.ChevronLeft className="h-5 w-5" /></button>
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>
      </main>

      <LocalFilesModal open={filesOpen} onClose={() => setFilesOpen(false)} used={collectLocalIds(cfg)} />
      <ConfirmHost />
      <Toasts />
    </div>
  );
}
