// محرّر العرض (#/show-admin): قائمة الشرائح، ولوحة التحرير، ولوحة الخصائص، والتحكم في شاشة العرض.
// كل تعديل يُحفظ فوراً في show-config ويُبث لشاشة العرض، ويدخل سجل التراجع.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Button, ConfirmHost, Icons, Input, MoreMenu, Modal, Toasts, askConfirm, cx } from '@/ui';
import { CANVAS } from './brand/brand';
import { deleteLocalFile, listLocalFiles, type LocalFile } from './media';
import { DEMO_SCENES, DEMO_SCENE_LABELS, DEMO_STEP_LABELS, demoSteps, type DemoSegment, type MediaRef, type Segment, type ShowConfig, type SlideSegment } from './model';
import { insertSegment, moveSegment, removeSegment, replaceSegment, sortSegments, stepCount, type Pos } from './nav';
import { exportConfig, loadRepoConfig, parseConfig, saveConfig } from './storage';
import { useShowConfig, useSync } from './useShow';
import { DemoEditor } from './admin/DemoEditor';
import { fmtSize, toast } from './admin/MediaPicker';
import { ELEMENT_LABELS, makeElement, type ElementType, type SlideElement, type SlideSettings } from './slides/model';
import { FitStage, SlideCanvas } from './slides/SlideView';
import { TEMPLATES, cloneElements, newId, templateSegment, type TemplateKey } from './slides/templates';
import EditorCanvas from './editor/Canvas';
import { ElementInspector, SlideInspector, type ElPatch } from './editor/Inspector';
import { align, distribute, reorder, round, type AlignMode } from './editor/geometry';
import { external, initHistory, record, redo, undo, type History } from './editor/history';

const showUrl = (hash: string) => `${window.location.pathname}${window.location.search}${hash}`;
const segId = () => `seg_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function stepLabel(seg: Segment, step: number) {
  if (seg.type === 'demo') {
    const d = demoSteps(seg.settings)[step];
    return d ? `${DEMO_SCENE_LABELS[d.scene]} · ${DEMO_STEP_LABELS[d.key]}` : '';
  }
  const n = stepCount(seg);
  return n > 1 ? `النقرة ${step} من ${n - 1}` : '';
}

export function collectLocalIds(cfg: ShowConfig) {
  const ids = new Set<string>();
  const add = (m?: MediaRef) => m?.kind === 'local' && ids.add(m.id);
  for (const s of cfg.segments) {
    if (s.type !== 'slide') continue;
    if (s.settings.bg.kind === 'media') add(s.settings.bg.media);
    for (const el of s.settings.elements) {
      if (el.type === 'image' || el.type === 'video') add(el.props.media);
      if (el.type === 'logoGrid') el.props.tiers.forEach((t) => t.logos.forEach(add));
    }
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

/** معاينة بشاشة العرض الحقيقية (1280×720) مصغّرة: بالحركة، وللديمو بجولته */
function LivePreview({ seg, step }: { seg: Segment; step: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setScale(el.getBoundingClientRect().width / 1280);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const hash = `#/show?preview=${encodeURIComponent(seg.id)}&step=${step}`;
  // أول تحميل بالرابط، وبعده يتغير الـ hash فقط فلا يُعاد تحميل الإطار
  const frame = useRef<HTMLIFrameElement>(null);
  const [initial] = useState(showUrl(hash));
  useEffect(() => {
    const w = frame.current?.contentWindow;
    if (w && w.location.hash !== hash) w.location.hash = hash;
  }, [hash]);
  return (
    <div ref={box} className="relative aspect-video w-full overflow-hidden rounded-xl bg-black shadow-lift">
      <iframe ref={frame} src={initial} title="معاينة" className="pointer-events-none absolute left-0 top-0 origin-top-left border-0" style={{ width: 1280, height: 720, transform: `scale(${scale})` }} />
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
              <Button size="sm" variant="danger" onClick={() => askConfirm({ title: `حذف «${f.name}»؟`, body: used.has(f.id) ? 'الملف مستخدم في شريحة وسيختفي منها.' : undefined, cta: 'احذف', danger: true, run: () => deleteLocalFile(f.id).then(load) })}>حذف</Button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

const THUMB_W = 168;

function Thumb({ seg }: { seg: Segment }) {
  if (seg.type === 'demo') {
    return (
      <div className="grid h-full w-full place-items-center bg-gradient-to-br from-brand-700 to-brand-500 text-white">
        <span className="flex flex-col items-center gap-1 text-[11px]"><Icons.MonitorPlay className="h-5 w-5" /> ديمو المنصة</span>
      </div>
    );
  }
  return <FitStage scale={THUMB_W / CANVAS.w}>{(s) => <SlideCanvas settings={seg.settings} step={0} mode="thumb" scale={s} />}</FitStage>;
}

const ADD_TOOLS: { type: ElementType; label: string; icon: keyof typeof Icons; props?: Record<string, unknown> }[] = [
  { type: 'text', label: 'نص', icon: 'Type' },
  { type: 'image', label: 'صورة', icon: 'Image' },
  { type: 'logo', label: 'الشعار', icon: 'BadgeCheck' },
  { type: 'video', label: 'فيديو', icon: 'Film' },
  { type: 'shape', label: 'مستطيل', icon: 'Square' },
  { type: 'shape', label: 'دائرة', icon: 'Circle', props: { shape: 'circle' } },
  { type: 'shape', label: 'خط', icon: 'Minus', props: { shape: 'line', fill: 'em' } },
  { type: 'logoGrid', label: 'شعارات', icon: 'LayoutGrid' },
  { type: 'counter', label: 'عدّاد', icon: 'Hash' },
  { type: 'names', label: 'أسماء', icon: 'ListOrdered' },
];

function newElement(type: ElementType, props: Record<string, unknown> | undefined, step: number): SlideElement {
  const el = makeElement(type, newId(), { step, props: props as never });
  if (type === 'shape' && props?.shape === 'circle') return { ...el, w: 320, h: 320, x: (CANVAS.w - 320) / 2, y: (CANVAS.h - 320) / 2 };
  if (type === 'shape' && props?.shape === 'line') return { ...el, w: 400, h: 8, x: (CANVAS.w - 400) / 2, y: (CANVAS.h - 8) / 2 };
  return el;
}

export default function ShowAdmin() {
  const sync = useSync();
  const [cfg, setCfg] = useShowConfig(sync);
  const [hist, setHist] = useState<History<ShowConfig> | null>(null);
  const [selectedSeg, setSelectedSeg] = useState<string | null>(null);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [step, setStep] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [live, setLive] = useState<{ pos: Pos; started: boolean; at: number } | null>(null);
  const [filesOpen, setFilesOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const clipboard = useRef<SlideElement[]>([]);

  // السجل يبدأ مع أول تحميل، وتعديل من نافذة أخرى يصبح الحالة الحالية دون مسح السجل
  useEffect(() => {
    if (!cfg) return;
    setHist((h) => (h ? external(h, cfg) : initHistory(cfg)));
  }, [cfg]);

  useEffect(() => {
    document.title = 'محرّر العرض · صقل';
    const off = sync.subscribe((m) => m.type === 'state' && setLive({ pos: m.pos, started: m.started, at: Date.now() }));
    sync.send({ type: 'hello' });
    return off;
  }, [sync]);
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => (sync.send({ type: 'hello' }), tick((n) => n + 1)), 5000);
    return () => clearInterval(t);
  }, [sync]);
  const connected = !!live && Date.now() - live.at < 12000;

  const list = useMemo(() => (cfg ? sortSegments(cfg.segments) : []), [cfg]);
  const seg = list.find((s) => s.id === selectedSeg) ?? list[0];
  const slide = seg?.type === 'slide' ? seg : null;
  const maxStep = seg ? stepCount(seg) - 1 : 0;
  const curStep = Math.min(step, maxStep);
  const selectedEls = slide ? slide.settings.elements.filter((e) => selection.has(e.id)) : [];

  const save = useCallback(
    (next: ShowConfig) => {
      const saved = saveConfig(next);
      setCfg(saved);
      sync.send({ type: 'config', config: saved });
      return saved;
    },
    [setCfg, sync],
  );
  const commit = (next: ShowConfig, key?: string) => {
    const saved = save(next);
    setHist((h) => (h ? record(h, saved, key) : initHistory(saved)));
  };
  const setSegments = (fn: (s: Segment[]) => Segment[], key?: string) => cfg && commit({ ...cfg, segments: fn(cfg.segments) }, key);
  const setSlide = (fn: (s: SlideSettings) => SlideSettings, key?: string) => slide && setSegments((x) => replaceSegment(x, { ...slide, settings: fn(slide.settings) }), key);
  const setElements = (els: SlideElement[], key?: string) => setSlide((s) => ({ ...s, elements: els }), key);

  const doUndo = () => {
    if (!hist?.past.length) return;
    const h = undo(hist);
    setHist({ ...h, present: save(h.present) });
    setEditingId(null);
  };
  const doRedo = () => {
    if (!hist?.future.length) return;
    const h = redo(hist);
    setHist({ ...h, present: save(h.present) });
  };

  const selectSeg = (id: string) => (setSelectedSeg(id), setSelection(new Set()), setStep(0), setEditingId(null));

  const patchSelected: ElPatch = (fn, key) => slide && setElements(slide.settings.elements.map((e) => (selection.has(e.id) ? fn(e) : e)), key);
  const addElement = (type: ElementType, props?: Record<string, unknown>) => {
    if (!slide) return;
    const el = newElement(type, props, curStep);
    setElements([...slide.settings.elements, el]);
    setSelection(new Set([el.id]));
  };
  const deleteSelected = () => slide && selection.size && (setElements(slide.settings.elements.filter((e) => !selection.has(e.id))), setSelection(new Set()));
  const paste = (els: SlideElement[]) => {
    if (!slide || !els.length) return;
    const copies = cloneElements(els).map((e) => ({ ...e, x: e.x + 24, y: e.y + 24 }));
    setElements([...slide.settings.elements, ...copies]);
    setSelection(new Set(copies.map((e) => e.id)));
  };
  const duplicate = () => paste(selectedEls);
  const doAlign = (m: AlignMode) => {
    const moved = new Map(align(selectedEls, m).map((e) => [e.id, e]));
    slide && setElements(slide.settings.elements.map((e) => moved.get(e.id) ?? e));
  };
  const doDistribute = (axis: 'x' | 'y') => {
    const moved = new Map(distribute(selectedEls, axis).map((e) => [e.id, e]));
    slide && setElements(slide.settings.elements.map((e) => moved.get(e.id) ?? e));
  };

  // اختصارات لوحة المفاتيح (خارج حقول الإدخال وتحرير النص)
  const keys = useRef<(e: KeyboardEvent) => void>(() => undefined);
  keys.current = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement;
    if (t.closest('input, textarea, select, [contenteditable="true"]') || filesOpen || previewOpen) return;
    const mod = e.metaKey || e.ctrlKey;
    const k = e.key.toLowerCase();
    if (mod && (k === 'z' || e.code === 'KeyZ')) return e.preventDefault(), e.shiftKey ? doRedo() : doUndo();
    if (mod && (k === 'y' || e.code === 'KeyY')) return e.preventDefault(), doRedo();
    if (!slide) return;
    if (mod && e.code === 'KeyD') return e.preventDefault(), duplicate();
    if (mod && e.code === 'KeyC') return void (clipboard.current = structuredClone(selectedEls));
    if (mod && e.code === 'KeyV') return e.preventDefault(), paste(clipboard.current);
    if (mod && e.code === 'KeyA') return e.preventDefault(), setSelection(new Set(slide.settings.elements.map((x) => x.id)));
    if (e.key === 'Escape') return setSelection(new Set());
    if ((e.key === 'Delete' || e.key === 'Backspace') && selection.size) return e.preventDefault(), deleteSelected();
    if (e.key === 'Enter' && selectedEls.length === 1 && selectedEls[0].type === 'text') return e.preventDefault(), setEditingId(selectedEls[0].id);
    const arrows: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (arrows[e.key] && selection.size) {
      e.preventDefault();
      const d = e.shiftKey ? 10 : 1;
      const [dx, dy] = arrows[e.key];
      patchSelected((x) => (x.locked ? x : { ...x, x: round(x.x + dx * d), y: round(x.y + dy * d) }), 'nudge');
    }
  };
  useEffect(() => {
    const on = (e: KeyboardEvent) => keys.current(e);
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, []);

  if (!cfg) return <div className="min-h-screen bg-ink-50" />;

  const addSlide = (key: TemplateKey | 'demo') => {
    const id = segId();
    const s: Segment = key === 'demo' ? ({ id, type: 'demo', title: 'جولة في المنصة', order: 0, settings: { scenes: [...DEMO_SCENES] } } as DemoSegment) : templateSegment(key, id, 0);
    setSegments((x) => insertSegment(x, s, seg?.id));
    selectSeg(id);
    setAddOpen(false);
  };
  const duplicateSlide = (s: Segment) => {
    const id = segId();
    const copy: Segment = s.type === 'slide' ? { ...s, id, title: `${s.title} (نسخة)`, settings: { ...s.settings, elements: cloneElements(s.settings.elements) } } : { ...structuredClone(s), id };
    setSegments((x) => insertSegment(x, copy, s.id));
    selectSeg(id);
  };

  const onImport = async (f?: File) => {
    if (!f) return;
    try {
      const imported = parseConfig(await f.text());
      askConfirm({ title: 'استيراد الإعدادات؟', body: `ستُستبدل الشرائح الحالية بـ ${imported.segments.length} من «${f.name}». الملفات المحلية لا تُنقل مع ملف JSON.`, cta: 'استورد', run: () => (commit(imported), setSelectedSeg(null), toast('استُوردت الإعدادات')) });
    } catch (e) {
      toast(`الملف غير صالح: ${(e as Error).message}`, 'error');
    }
  };
  const restoreRepo = () =>
    askConfirm({ title: 'استعادة show.json من المستودع؟', body: 'تُستبدل الإعدادات المحفوظة على هذا الجهاز بالملف المنشور مع الموقع (يمكن التراجع).', cta: 'استعد', danger: true, run: async () => (commit(await loadRepoConfig()), setSelectedSeg(null), toast('استُعيدت إعدادات المستودع')) });

  const liveSeg = connected ? list[live!.pos.seg] : undefined;

  return (
    <div className="flex h-screen flex-col bg-ink-50">
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-ink-100 bg-white px-4 py-2">
        <img src="./brand/logo-icon.svg" alt="" className="h-8 w-auto" />
        <Input value={cfg.title} onChange={(e) => commit({ ...cfg, title: e.target.value }, 'title')} className="!min-h-0 max-w-xs border-transparent !px-2 !py-1 text-base font-semibold text-ink-900 hover:border-ink-200" aria-label="اسم العرض" />
        <div className="ms-2 flex">
          <button className="rounded-lg p-2 text-ink-600 hover:bg-ink-50 disabled:opacity-30" disabled={!hist?.past.length} title="تراجع (Ctrl+Z)" onClick={doUndo}><Icons.Undo2 className="h-4 w-4" /></button>
          <button className="rounded-lg p-2 text-ink-600 hover:bg-ink-50 disabled:opacity-30" disabled={!hist?.future.length} title="إعادة (Ctrl+Shift+Z)" onClick={doRedo}><Icons.Redo2 className="h-4 w-4" /></button>
        </div>
        <div className="flex-1" />
        <Badge tone={connected ? 'green' : 'gray'} icon={<span className={cx('h-2 w-2 rounded-full', connected ? 'bg-ok-500' : 'bg-ink-300')} />}>
          {connected ? (liveSeg ? `على الشاشة: ${liveSeg.title}` : 'شاشة العرض متصلة') : 'شاشة العرض غير مفتوحة'}
        </Badge>
        <Button size="sm" variant="secondary" disabled={!connected} title="السابق" onClick={() => sync.send({ type: 'nav', dir: 'prev' })}><Icons.ChevronRight className="h-4 w-4" /></Button>
        <Button size="sm" variant="secondary" disabled={!connected} title="التالي" onClick={() => sync.send({ type: 'nav', dir: 'next' })}><Icons.ChevronLeft className="h-4 w-4" /></Button>
        {seg && <Button size="sm" variant="secondary" disabled={!connected} icon={<Icons.Cast className="h-4 w-4" />} onClick={() => sync.send({ type: 'goto', pos: { seg: list.indexOf(seg), step: curStep } })}>اعرضها الآن</Button>}
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
        <Button size="sm" icon={<Icons.MonitorPlay className="h-4 w-4" />} onClick={() => window.open(showUrl('#/show'), 'saql-show')}>افتح شاشة العرض</Button>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[208px_minmax(0,1fr)_340px]">
        {/* قائمة الشرائح */}
        <aside className="flex min-h-0 flex-col border-e border-ink-100 bg-white">
          <ol className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
            {list.map((s, i) => (
              <li
                key={s.id}
                draggable
                onDragStart={(e) => (setDragId(s.id), (e.dataTransfer.effectAllowed = 'move'))}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => dragId && dragId !== s.id && setSegments((x) => moveSegment(x, dragId, i))}
                onDragEnd={() => setDragId(null)}
                className={cx('group relative', dragId === s.id && 'opacity-40')}
              >
                <button onClick={() => selectSeg(s.id)} className="block w-full text-start">
                  <span className="mb-1 flex items-center gap-1.5 text-[11px] text-ink-500">
                    <span className="num">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate">{s.title}</span>
                    {liveSeg?.id === s.id && <span className="h-2 w-2 rounded-full bg-accent-500" title="على الشاشة" />}
                  </span>
                  <span className={cx('relative block overflow-hidden rounded-lg ring-1', seg?.id === s.id ? 'ring-[3px] ring-brand-600' : 'ring-ink-200 group-hover:ring-ink-300')} style={{ width: THUMB_W, height: (THUMB_W * CANVAS.h) / CANVAS.w }}>
                    <Thumb seg={s} />
                    {stepCount(s) > 1 && <span className="absolute bottom-1 start-1 rounded bg-black/60 px-1 text-[10px] text-white num">{stepCount(s)}</span>}
                  </span>
                </button>
                <span className="absolute end-1 top-5 hidden gap-0.5 rounded-md bg-white/90 p-0.5 shadow group-hover:flex">
                  <button className="p-1 text-ink-500 hover:text-ink-900" title="تكرار" onClick={() => duplicateSlide(s)}><Icons.Copy className="h-3.5 w-3.5" /></button>
                  <button className="p-1 text-ink-500 hover:text-bad-600" title="حذف" onClick={() => askConfirm({ title: `حذف «${s.title}»؟`, body: 'يمكن التراجع بـ Ctrl+Z.', cta: 'احذف', danger: true, run: () => (setSegments((x) => removeSegment(x, s.id)), setSelectedSeg(null)) })}><Icons.Trash2 className="h-3.5 w-3.5" /></button>
                </span>
              </li>
            ))}
            {!list.length && <li className="py-8 text-center text-sm text-ink-500">لا توجد شرائح</li>}
          </ol>
          <div className="relative border-t border-ink-100 p-3">
            <Button className="w-full" icon={<Icons.Plus className="h-4 w-4" />} onClick={() => setAddOpen((v) => !v)}>شريحة</Button>
            {addOpen && (
              <div className="absolute bottom-full start-3 z-30 mb-2 w-72 rounded-2xl border border-ink-100 bg-white p-2 shadow-lift">
                {(Object.keys(TEMPLATES) as TemplateKey[]).map((k) => (
                  <button key={k} onClick={() => addSlide(k)} className="block w-full rounded-xl px-3 py-2 text-start hover:bg-ink-50">
                    <span className="block text-sm font-medium text-ink-900">{TEMPLATES[k].label}</span>
                    <span className="block text-xs text-ink-500">{TEMPLATES[k].hint}</span>
                  </button>
                ))}
                <button onClick={() => addSlide('demo')} className="block w-full rounded-xl px-3 py-2 text-start hover:bg-ink-50">
                  <span className="block text-sm font-medium text-ink-900">ديمو المنصة</span>
                  <span className="block text-xs text-ink-500">جولة متحركة في شاشات المنصة</span>
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* لوحة التحرير */}
        <main className="flex min-h-0 min-w-0 flex-col">
          {slide && (
            <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-ink-100 bg-white px-3 py-1.5">
              {ADD_TOOLS.map((t) => {
                const I = Icons[t.icon] as typeof Icons.Type;
                return (
                  <button key={t.label} title={`أضف ${t.label}`} onClick={() => addElement(t.type, t.props)} className="flex flex-col items-center gap-0.5 rounded-lg px-2 py-1 text-[10px] text-ink-600 hover:bg-ink-50 hover:text-ink-900">
                    <I className="h-4 w-4" /> {t.label}
                  </button>
                );
              })}
              <div className="flex-1" />
              <Button size="sm" variant="ghost" icon={<Icons.Play className="h-4 w-4" />} onClick={() => setPreviewOpen(true)}>معاينة بالحركة</Button>
            </div>
          )}
          <div className="min-h-0 flex-1 p-2" onPointerDown={(e) => e.target === e.currentTarget && setSelection(new Set())}>
            {slide ? (
              <EditorCanvas
                key={slide.id}
                settings={slide.settings}
                step={curStep}
                selection={selection}
                onSelect={setSelection}
                onChange={(els) => setElements(els)}
                editingId={editingId}
                onEdit={setEditingId}
                onTextCommit={(id, text) => {
                  setEditingId(null);
                  const el = slide.settings.elements.find((x) => x.id === id);
                  if (el?.type === 'text' && el.props.text !== text) setElements(slide.settings.elements.map((x) => (x.id === id ? ({ ...x, props: { ...x.props, text } } as SlideElement) : x)));
                }}
              />
            ) : seg ? (
              <div className="mx-auto max-w-4xl p-4"><LivePreview seg={seg} step={curStep} /></div>
            ) : null}
          </div>
          {seg && maxStep > 0 && (
            <div className="flex shrink-0 items-center justify-center gap-2 border-t border-ink-100 bg-white py-1.5 text-xs text-ink-600">
              <button className="rounded-full p-1.5 hover:bg-ink-50 disabled:opacity-30" disabled={curStep === 0} onClick={() => setStep(curStep - 1)} aria-label="الخطوة السابقة"><Icons.ChevronRight className="h-4 w-4" /></button>
              <span className="min-w-40 text-center">{curStep === 0 ? (seg.type === 'demo' ? stepLabel(seg, 0) : 'عند ظهور الشريحة') : stepLabel(seg, curStep)}{seg.type === 'slide' ? ` · ${maxStep} نقرة` : ''}</span>
              <button className="rounded-full p-1.5 hover:bg-ink-50 disabled:opacity-30" disabled={curStep >= maxStep} onClick={() => setStep(curStep + 1)} aria-label="الخطوة التالية"><Icons.ChevronLeft className="h-4 w-4" /></button>
            </div>
          )}
        </main>

        {/* لوحة الخصائص */}
        <aside className="min-h-0 overflow-y-auto border-s border-ink-100 bg-white">
          {slide && selectedEls.length > 0 ? (
            <ElementInspector
              els={selectedEls}
              patch={patchSelected}
              onAlign={doAlign}
              onDistribute={doDistribute}
              onLayer={(to) => setElements(reorder(slide.settings.elements, selection, to))}
              onDuplicate={duplicate}
              onDelete={deleteSelected}
            />
          ) : slide ? (
            <SlideInspector
              title={slide.title}
              settings={slide.settings}
              onTitle={(t) => setSegments((x) => replaceSegment(x, { ...slide, title: t }), 'slide-title')}
              onChange={(p, key) => setSlide((s) => ({ ...s, ...p }), key)}
            />
          ) : seg?.type === 'demo' ? (
            <div className="space-y-4 p-4">
              <Input value={seg.title} onChange={(e) => setSegments((x) => replaceSegment(x, { ...seg, title: e.target.value }), 'demo-title')} className="!min-h-0 !py-1.5 font-semibold" aria-label="عنوان الفقرة" />
              <DemoEditor seg={seg} patch={(p) => setSegments((x) => replaceSegment(x, { ...seg, settings: { ...seg.settings, ...p } }))} />
            </div>
          ) : null}
          {slide && selectedEls.length === 0 && slide.settings.elements.length > 0 && (
            <div className="border-t border-ink-100 px-4 py-4">
              <h4 className="mb-2 text-xs font-semibold text-ink-500">الطبقات (الأعلى أولاً)</h4>
              <ul className="space-y-0.5">
                {[...slide.settings.elements].reverse().map((el) => (
                  <li key={el.id}>
                    <button onClick={() => setSelection(new Set([el.id]))} className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-start text-xs text-ink-700 hover:bg-ink-50">
                      <span className="min-w-0 flex-1 truncate">{el.name || (el.type === 'text' ? el.props.text.split('\n')[0] : ELEMENT_LABELS[el.type])}</span>
                      {el.step > 0 && <span className="text-[10px] text-ink-400 num">نقرة {el.step}</span>}
                      {el.locked && <Icons.Lock className="h-3 w-3 text-ink-400" />}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>

      <Modal open={previewOpen} onClose={() => setPreviewOpen(false)} title={seg ? `معاينة «${seg.title}»` : 'معاينة'} wide>
        {seg && previewOpen && <LivePreview seg={seg} step={curStep} />}
        <p className="mt-2 text-xs text-ink-500">المعاينة من الخطوة الحالية؛ غيّر الخطوة من شريط النقرات أسفل اللوحة.</p>
      </Modal>
      <LocalFilesModal open={filesOpen} onClose={() => setFilesOpen(false)} used={collectLocalIds(cfg)} />
      <ConfirmHost />
      <Toasts />
    </div>
  );
}

