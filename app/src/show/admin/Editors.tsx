// محررات إعدادات كل نوع فقرة
import { useRef, useState } from 'react';
import { Button, Field, Icons, Input, Select, Textarea, Toggle, cx } from '@/ui';
import { putLocalFile } from '../media';
import { DEMO_STEPS, type DemoSegment, type DemoStep, type MediaRef, type NamesSegment, type Segment, type SlidesSegment, type VideoSegment, type BlankSegment } from '../model';
import { expandPattern, naturalCompare } from '../nav';
import { useMediaUrl } from '../segments/useMedia';
import { MediaPicker, toast } from './MediaPicker';

export type Patch = (settings: Partial<Segment['settings']>) => void;

const REPO_HINT = 'ضع الملف في app/public/show-media واكتب مساره هنا. حد GitHub للملف 100 م.ب (يُفضّل أقل من 50)، والأكبر ارفعه من الجهاز.';

export function SegmentEditor({ seg, patch, demoTrips }: { seg: Segment; patch: Patch; demoTrips: { id: string; title: string }[] }) {
  switch (seg.type) {
    case 'video': return <VideoEditor seg={seg} patch={patch} />;
    case 'slides': return <SlidesEditor seg={seg} patch={patch} />;
    case 'names': return <NamesEditor seg={seg} patch={patch} />;
    case 'blank': return <BlankEditor seg={seg} patch={patch} />;
    case 'demo': return <DemoEditor seg={seg} patch={patch} trips={demoTrips} />;
  }
}

function VideoEditor({ seg, patch }: { seg: VideoSegment; patch: Patch }) {
  const s = seg.settings;
  return (
    <div className="space-y-4">
      <Field label="ملف الفيديو" hint={REPO_HINT}>
        <MediaPicker value={s.media} onChange={(media) => patch({ media })} accept="video/*" placeholder="show-media/intro.mp4" />
      </Field>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <Toggle checked={s.autoAdvance} onChange={(autoAdvance) => patch({ autoAdvance })} label="ينتقل للفقرة التالية عند انتهائه" />
        <Toggle checked={s.showSkip} onChange={(showSkip) => patch({ showSkip })} label="زر «تخطٍّ»" />
        <Toggle checked={s.muted} onChange={(muted) => patch({ muted })} label="بلا صوت" />
      </div>
    </div>
  );
}

function Thumb({ media, index, onUp, onDown, onRemove }: { media: MediaRef; index: number; onUp?: () => void; onDown?: () => void; onRemove: () => void }) {
  const { url, error } = useMediaUrl(media);
  const [bad, setBad] = useState(false);
  return (
    <li className="group overflow-hidden rounded-xl border border-ink-100 bg-white">
      <div className="relative aspect-video bg-ink-900">
        {url && !bad ? <img src={url} alt="" className="h-full w-full object-contain" onError={() => setBad(true)} /> : <div className="grid h-full place-items-center px-2 text-center text-xs text-bad-200">{error ?? (bad ? 'تعذّر التحميل' : '')}</div>}
        <span className="absolute start-1.5 top-1.5 rounded-full bg-black/60 px-2 text-xs text-white">{index + 1}</span>
      </div>
      <div className="flex items-center justify-between px-1 py-0.5">
        <span className="min-w-0 truncate px-1 text-xs text-ink-500" dir="ltr">{media.kind === 'url' ? media.src.split('/').pop() : media.name}</span>
        <span className="flex shrink-0">
          <button className="p-1.5 text-ink-400 hover:text-ink-800 disabled:opacity-30" disabled={!onUp} onClick={onUp} aria-label="قبلها"><Icons.ChevronRight className="h-4 w-4" /></button>
          <button className="p-1.5 text-ink-400 hover:text-ink-800 disabled:opacity-30" disabled={!onDown} onClick={onDown} aria-label="بعدها"><Icons.ChevronLeft className="h-4 w-4" /></button>
          <button className="p-1.5 text-ink-400 hover:text-bad-600" onClick={onRemove} aria-label="حذف الشريحة"><Icons.X className="h-4 w-4" /></button>
        </span>
      </div>
    </li>
  );
}

function SlidesEditor({ seg, patch }: { seg: SlidesSegment; patch: Patch }) {
  const { slides, fit } = seg.settings;
  const file = useRef<HTMLInputElement>(null);
  const [pattern, setPattern] = useState('show-media/slides/Slide{n}.PNG');
  const [count, setCount] = useState(10);
  const [busy, setBusy] = useState(false);
  const set = (next: MediaRef[]) => patch({ slides: next });
  const swap = (i: number, j: number) => {
    const n = [...slides];
    [n[i], n[j]] = [n[j], n[i]];
    set(n);
  };
  const upload = async (files: File[]) => {
    setBusy(true);
    try {
      const refs: MediaRef[] = [];
      for (const f of files.sort((a, b) => naturalCompare(a.name, b.name))) refs.push(await putLocalFile(f));
      set([...slides, ...refs]);
      toast(`أُضيفت ${refs.length} شريحة على هذا الجهاز`);
    } catch {
      toast('تعذّر حفظ الصور على هذا الجهاز', 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-4">
      <p className="text-xs text-ink-500">من PowerPoint: ملف ← تصدير ← PNG ← كل الشرائح. ثم ارفع الصور كلها مرة واحدة، أو ضعها في app/public/show-media/slides.</p>
      <div className="flex flex-wrap items-end gap-2">
        <Button variant="secondary" disabled={busy} icon={<Icons.Upload className="h-4 w-4" />} onClick={() => file.current?.click()}>{busy ? 'جارٍ الرفع…' : 'رفع صور الشرائح'}</Button>
        <input ref={file} type="file" accept="image/*" multiple hidden onChange={(e) => (upload([...(e.target.files ?? [])]), (e.target.value = ''))} />
        <Select value={fit} onChange={(e) => patch({ fit: e.target.value as 'contain' | 'cover' })} options={[{ value: 'contain', label: 'الشريحة كاملة' }, { value: 'cover', label: 'تملأ الشاشة' }]} className="!w-auto" aria-label="ملاءمة الشريحة" />
      </div>
      <details className="rounded-xl border border-ink-100 p-3">
        <summary className="cursor-pointer text-sm font-medium text-ink-700">إضافة من مجلد المستودع</summary>
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_96px_auto] sm:items-end">
          <Field label="المسار ({n} رقم الشريحة)"><Input dir="ltr" className="text-left" value={pattern} onChange={(e) => setPattern(e.target.value)} /></Field>
          <Field label="العدد"><Input type="number" min={1} value={count} onChange={(e) => setCount(Number(e.target.value))} /></Field>
          <Button variant="secondary" onClick={() => set([...slides, ...expandPattern(pattern, count).map((src) => ({ kind: 'url' as const, src }))])}>أضف</Button>
        </div>
      </details>
      {slides.length > 0 && (
        <>
          <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            {slides.map((m, i) => (
              <Thumb key={i + (m.kind === 'url' ? m.src : m.id)} media={m} index={i} onUp={i > 0 ? () => swap(i, i - 1) : undefined} onDown={i < slides.length - 1 ? () => swap(i, i + 1) : undefined} onRemove={() => set(slides.filter((_, j) => j !== i))} />
            ))}
          </ol>
          <Button size="sm" variant="danger" onClick={() => set([])}>حذف كل الشرائح</Button>
        </>
      )}
    </div>
  );
}

function NamesEditor({ seg, patch }: { seg: NamesSegment; patch: Patch }) {
  const s = seg.settings;
  // النص كما يكتبه المستخدم (بالأسطر الفارغة)، والأسماء تُحفظ منظفة
  const [text, setText] = useState(s.names.join('\n'));
  return (
    <div className="space-y-4">
      <Field label="العنوان على الشاشة" hint="يُعرض أولاً وحده، ثم تظهر الأسماء مع كل نقرة">
        <Input value={s.heading ?? ''} placeholder={seg.title} onChange={(e) => patch({ heading: e.target.value })} />
      </Field>
      <Field label={`الأسماء (${s.names.length}) · اسم في كل سطر`}>
        <Textarea rows={8} value={text} onChange={(e) => { setText(e.target.value); patch({ names: e.target.value.split('\n').map((n) => n.trim()).filter(Boolean) }); }} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="يظهر مع كل نقرة"><Select value={String(s.perStep)} onChange={(e) => patch({ perStep: Number(e.target.value) })} options={[1, 2, 3, 4, 5, 10].map((n) => ({ value: String(n), label: n === 1 ? 'اسم واحد' : `${n} أسماء` }))} /></Field>
        <Field label="الأعمدة"><Select value={String(s.columns)} onChange={(e) => patch({ columns: Number(e.target.value) as 1 | 2 | 3 })} options={[1, 2, 3].map((n) => ({ value: String(n), label: String(n) }))} /></Field>
      </div>
    </div>
  );
}

function BlankEditor({ seg, patch }: { seg: BlankSegment; patch: Patch }) {
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(['logo', 'black'] as const).map((v) => (
          <button key={v} onClick={() => patch({ variant: v })} className={cx('flex-1 rounded-xl border-2 p-3 text-sm', seg.settings.variant === v ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-ink-100 text-ink-600 hover:border-ink-200')}>
            {v === 'logo' ? 'الشعار' : 'شاشة سوداء'}
          </button>
        ))}
      </div>
      {seg.settings.variant === 'logo' && (
        <Field label="نص تحت الشعار (اختياري)"><Input value={seg.settings.caption ?? ''} onChange={(e) => patch({ caption: e.target.value })} placeholder="كلمة سعادة ..." /></Field>
      )}
    </div>
  );
}

export const DEMO_STEP_LABELS: Record<DemoStep, string> = {
  list: 'قائمة الرحلات',
  focusTrip: 'تقريب رحلة واحدة',
  trip: 'صفحة الرحلة',
  document: 'وثيقة الرحلة',
  schedule: 'الجدول الزمني',
  budget: 'الميزانية',
  plans: 'الخطتان أ وب',
  back: 'الرجوع للقائمة',
};

function DemoEditor({ seg, patch, trips }: { seg: DemoSegment; patch: Patch; trips: { id: string; title: string }[] }) {
  const on = new Set(seg.settings.steps);
  return (
    <div className="space-y-4">
      <Field label="الرحلة المعروضة" hint="من البيانات التجريبية الثابتة. الديمو للقراءة فقط ولا يكتب في بيانات المنصة">
        <Select value={seg.settings.tripId ?? ''} onChange={(e) => patch({ tripId: e.target.value || undefined })} options={[{ value: '', label: 'تلقائي (أول رحلة مكتملة)' }, ...trips.map((t) => ({ value: t.id, label: t.title }))]} />
      </Field>
      <div>
        <span className="label">الخطوات (نقرة لكل خطوة)</span>
        <div className="flex flex-wrap gap-2">
          {DEMO_STEPS.map((k, i) => (
            <button key={k} onClick={() => { const steps = DEMO_STEPS.filter((x) => (x === k ? !on.has(k) : on.has(x))); if (steps.length) patch({ steps }); }}className={cx('chip border', on.has(k) ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-ink-200 text-ink-500 line-through')}>
              {i + 1}. {DEMO_STEP_LABELS[k]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
