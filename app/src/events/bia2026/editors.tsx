// محرّرات فقرات حفل «بيئات التطوع 2026» في لوحة خصائص المحرّر. الأماكن الفارغة تظهر هنا وفي «بيانات ناقصة» فقط.
import { Button, Icons, Input, Select, Textarea, Toggle } from '@/ui';
import type { ExtEditorProps } from '@/show/ext';
import { MediaPicker } from '@/show/admin/MediaPicker';
import type { AwardData, ExperienceData, Honoree, HonoringData, QrData, SpeakerData } from './kinds';
import { QrSvg, clean, placeLabel } from './kinds';

const F = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block space-y-1">
    <span className="text-xs font-medium text-ink-600">{label}</span>
    {children}
  </label>
);
/** حقل نص يحذف التطويل عند الكتابة */
const T = ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) => (
  <Input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value.replace(/ـ/g, ''))} className="!min-h-0 !py-1.5 text-sm" />
);

export function SpeakerEditor({ data, patch }: ExtEditorProps<SpeakerData>) {
  return (
    <div className="space-y-3">
      <F label="عنوان الكلمة"><T value={data.kicker} onChange={(kicker) => patch({ kicker })} /></F>
      <F label="اسم المتحدث"><T value={data.name} onChange={(name) => patch({ name })} placeholder="مثال: أ. الاسم" /></F>
      <F label="الصفة (اختيارية)"><T value={data.role} onChange={(role) => patch({ role })} /></F>
      <F label="صورة المتحدث (اختيارية)"><MediaPicker value={data.photo} onChange={(photo) => patch({ photo })} accept="image/*" placeholder="رابط الصورة أو ارفعها" /></F>
      <F label="شعار (اختياري)"><MediaPicker value={data.logo} onChange={(logo) => patch({ logo })} accept="image/*" placeholder="رابط الشعار أو ارفعه" /></F>
    </div>
  );
}

export function ExperienceEditor({ data, patch }: ExtEditorProps<ExperienceData>) {
  return (
    <div className="space-y-3">
      <F label="العنوان"><T value={data.kicker} onChange={(kicker) => patch({ kicker })} /></F>
      <F label="نوع الصورة">
        <Select value={data.mediaKind} onChange={(e) => patch({ mediaKind: e.target.value as ExperienceData['mediaKind'] })} options={[{ value: 'logo', label: 'شعار جهة' }, { value: 'photo', label: 'صورة شخص' }]} />
      </F>
      <F label={data.mediaKind === 'logo' ? 'اسم الجهة' : 'الاسم'}><T value={data.name} onChange={(name) => patch({ name })} /></F>
      <F label={data.mediaKind === 'logo' ? 'الشعار' : 'الصورة (اختيارية)'}><MediaPicker value={data.media} onChange={(media) => patch({ media })} accept="image/*" placeholder="رابط أو ارفع ملفاً" /></F>
      <p className="text-[11px] text-ink-500">لأكثر من جمعية: كرّر الشريحة من قائمة الشرائح (أيقونة النسخ) وغيّر الاسم والشعار.</p>
    </div>
  );
}

export function AwardEditor({ data, patch }: ExtEditorProps<AwardData>) {
  const setPlace = (i: number, p: Partial<AwardData['places'][number]>) => patch({ places: data.places.map((x, k) => (k === i ? { ...x, ...p } : x)) });
  return (
    <div className="space-y-3">
      <F label="سطر الإعلان"><T value={data.intro} onChange={(intro) => patch({ intro })} /></F>
      <F label="اسم الجائزة"><T value={data.title} onChange={(title) => patch({ title })} /></F>
      <F label="المراكز">
        <Select value={data.mode} onChange={(e) => patch({ mode: e.target.value as AwardData['mode'] })} options={[{ value: 'person', label: 'أشخاص: الاسم الثلاثي واللقب' }, { value: 'org', label: 'جهات: الشعار والاسم واسم المبادرة' }]} />
      </F>
      <F label="وصف المركز الأول (اختياري)"><T value={data.crown} onChange={(crown) => patch({ crown })} placeholder="مثال: صاحب بريق العطاء" /></F>
      <ol className="space-y-2">
        {data.places.map((p, i) => (
          <li key={i} className="space-y-2 rounded-xl border border-ink-100 p-3" data-place-editor>
            <div className="flex items-center gap-2">
              <b className="flex-1 text-xs text-ink-700">{placeLabel(i)}</b>
              <button className="p-1 text-ink-400 hover:text-bad-600 disabled:opacity-30" disabled={data.places.length <= 1} onClick={() => patch({ places: data.places.filter((_, k) => k !== i) })} title="حذف المركز"><Icons.X className="h-3.5 w-3.5" /></button>
            </div>
            <T value={p.name} onChange={(name) => setPlace(i, { name })} placeholder={data.mode === 'org' ? 'اسم الجهة' : 'الاسم الثلاثي'} />
            <T value={p.sub} onChange={(sub) => setPlace(i, { sub })} placeholder={data.mode === 'org' ? 'اسم المبادرة' : 'اللقب'} />
            {data.mode === 'org' && <MediaPicker value={p.logo} onChange={(logo) => setPlace(i, { logo })} accept="image/*" placeholder="شعار الجهة" />}
          </li>
        ))}
      </ol>
      <Button size="sm" variant="secondary" icon={<Icons.Plus className="h-4 w-4" />} disabled={data.places.length >= 10} onClick={() => patch({ places: [...data.places, { name: '', sub: '' }] })}>مركز</Button>
      <p className="text-[11px] text-ink-500">الكشف تنازلي: الإعلان، ثم آخر مركز، حتى الأول. «التالي» أو «كشف» من الجوال يُظهر المركز التالي.</p>
    </div>
  );
}

export function HonoringEditor({ data, patch }: ExtEditorProps<HonoringData>) {
  const setItem = (i: number, p: Partial<Honoree>) => patch({ items: data.items.map((x, k) => (k === i ? { ...x, ...p } : x)) });
  const label = data.items[data.items.length - 1]?.label ?? '';
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <F label="السطر الأول"><T value={data.kicker} onChange={(kicker) => patch({ kicker })} /></F>
        <F label="العنوان"><T value={data.title} onChange={(title) => patch({ title })} /></F>
      </div>
      <Toggle checked={data.gridOnly} onChange={(gridOnly) => patch({ gridOnly })} label="شبكة الأسماء وحدها (بلا شريحة لكل مكرَّم)" />
      {!data.gridOnly && <Toggle checked={data.grid} onChange={(grid) => patch({ grid })} label="وبعد الشرائح شبكة بكل الأسماء" />}
      <ol className="max-h-[44vh] space-y-2 overflow-y-auto">
        {data.items.map((h, i) => (
          <li key={i} className="space-y-2 rounded-xl border border-ink-100 p-3" data-honoree-editor>
            <div className="flex items-center gap-2">
              <span className="text-xs text-ink-400 num">{i + 1}</span>
              <div className="flex-1"><T value={h.label} onChange={(v) => setItem(i, { label: v })} placeholder="العنوان (مثل: شريك النجاح)" /></div>
              <button className="p-1 text-ink-400 hover:text-bad-600" onClick={() => patch({ items: data.items.filter((_, k) => k !== i) })} title="حذف"><Icons.X className="h-3.5 w-3.5" /></button>
            </div>
            <T value={h.name} onChange={(name) => setItem(i, { name })} placeholder="الاسم" />
            <T value={h.role} onChange={(role) => setItem(i, { role })} placeholder="الصفة (اختيارية)" />
            <MediaPicker value={h.logo} onChange={(logo) => setItem(i, { logo })} accept="image/*" placeholder="الشعار (اختياري)" />
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" icon={<Icons.Plus className="h-4 w-4" />} onClick={() => patch({ items: [...data.items, { label, name: '', role: '' }] })}>مكرَّم</Button>
      </div>
      <details className="rounded-xl border border-ink-100 p-2">
        <summary className="cursor-pointer text-sm text-ink-700">لصق قائمة أسماء</summary>
        <Textarea
          rows={4}
          placeholder={'سطر لكل اسم، والصفة بعد شرطة: الاسم - الصفة'}
          className="mt-2 text-sm"
          onBlur={(e) => {
            const rows = e.target.value.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
            if (!rows.length) return;
            patch({ items: [...data.items, ...rows.map((l) => { const [name, ...role] = l.split(/\s+[-–—]\s+/); return { label, name: clean(name), role: clean(role.join(' - ')) }; })] });
            e.target.value = '';
          }}
        />
        <p className="mt-1 text-[11px] text-ink-500">تُضاف عند الخروج من الحقل.</p>
      </details>
    </div>
  );
}

export function QrEditor({ data, patch }: ExtEditorProps<QrData>) {
  const valid = /^https?:\/\//i.test(data.url);
  return (
    <div className="space-y-3">
      <F label="العنوان"><T value={data.title} onChange={(title) => patch({ title })} /></F>
      <F label="السطر الثاني"><T value={data.sub} onChange={(sub) => patch({ sub })} /></F>
      <F label="الرابط"><Input dir="ltr" value={data.url} placeholder="https://…" onChange={(e) => patch({ url: e.target.value.trim() })} className="!min-h-0 !py-1.5 text-left text-sm" /></F>
      {data.url && !valid && <p className="text-xs text-bad-700">الرابط يبدأ بـ https://</p>}
      {valid && <div className="w-40 rounded-xl bg-white p-2 shadow-soft"><QrSvg text={data.url} size={144} /></div>}
      <p className="text-[11px] text-ink-500">يُولَّد QR في المتصفح نفسه بلا أي خدمة خارجية.</p>
    </div>
  );
}
