// لوحة الخصائص: الشريحة إن لم يُحدَّد شيء، وخصائص العنصر المحدد، ومحاذاة العناصر المتعددة.
// الخطوط والألوان المعروضة هنا من ملف الهوية حصراً (brand.ts).
import { useRef, useState, type ReactNode } from 'react';
import { Button, Field, Icons, Input, Select, Textarea, Toggle, cx } from '@/ui';
import { BRAND_COLORS, BRAND_FONTS, LOGOS, LOGO_RULES, TYPE_SCALE } from '../brand/brand';
import { MediaPicker } from '../admin/MediaPicker';
import type { MediaRef } from '../model';
import {
  ANIMS, COLOR_REFS, ELEMENT_LABELS, FONT_WEIGHTS, GRADIENT_FILLS, LOGO_RATIO, SHADOWS, THEME_ROLES, colorLabel, nameBatches,
  type AnimType, type ColorRef, type Fill, type LogoTier, type Shadow, type SlideBg, type SlideElement, type SlideSettings,
} from '../slides/model';
import { cssColor, cssFill } from '../slides/SlideView';
import type { AlignMode } from './geometry';
import { uploadFiles, useMediaPick } from './MediaLibrary';

export type ElPatch = (fn: (el: SlideElement) => SlideElement, key?: string) => void;

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="border-b border-ink-100 px-4 py-4 last:border-0">
    <h4 className="mb-3 text-xs font-semibold text-ink-500">{title}</h4>
    <div className="space-y-3">{children}</div>
  </section>
);

function Num({ label, value, onChange, min, max, step = 1, suffix, disabled }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; suffix?: string; disabled?: boolean }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-[11px] text-ink-500">{label}</span>
      <span className="relative block">
        <input
          type="number"
          dir="ltr"
          className={cx('input !min-h-0 !py-1.5 text-left num', suffix && '!pr-9')}
          value={Number.isFinite(value) ? Math.round(value * 100) / 100 : ''}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onChange={(e) => e.target.value !== '' && Number.isFinite(+e.target.value) && onChange(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, +e.target.value)))}
        />
        {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-ink-400" dir="ltr">{suffix}</span>}
      </span>
    </label>
  );
}

/** ألوان الهوية وأدوار القالب فقط. العيّنات داخل سياق القالب لتظهر أدواره بلونها الفعلي */
export function Swatches({ value, onChange, extra }: { value: string; onChange: (v: any) => void; extra?: { key: string; label: string; css: string }[] }) {
  const items = [
    ...COLOR_REFS.map((c) => ({ key: c, label: colorLabel(c) + (c in THEME_ROLES ? ' (يتبع القالب)' : ` ${BRAND_COLORS[c as keyof typeof BRAND_COLORS].hex}`), css: cssColor(c) })),
    ...(extra ?? []),
  ];
  return (
    <div data-show-theme="dark" className="flex flex-wrap gap-1.5">
      {items.map((i) => (
        <button
          key={i.key}
          type="button"
          title={i.label}
          aria-label={i.label}
          onClick={() => onChange(i.key)}
          className={cx('h-7 w-7 rounded-full ring-1 ring-ink-200 transition', value === i.key ? 'ring-[3px] ring-brand-600 ring-offset-2' : 'hover:scale-110')}
          style={{ background: i.css }}
        />
      ))}
    </div>
  );
}

const fillExtras = [
  ...Object.entries(GRADIENT_FILLS).map(([k, label]) => ({ key: k, label, css: cssFill(k as Fill) })),
  { key: 'none', label: 'بلا تعبئة', css: 'repeating-linear-gradient(45deg, rgb(var(--c-ink-100)) 0 4px, white 4px 8px)' },
];

function FontFields({ font, weight, size, onChange, k }: { font: string; weight: number; size: number; onChange: (p: { font?: string; weight?: number; size?: number }, key: string) => void; k: string }) {
  const fam = BRAND_FONTS.find((f) => f.family === font) ?? BRAND_FONTS[0];
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <Field label="الخط">
          <Select className="!min-h-0 !py-1.5" value={fam.family} onChange={(e) => onChange({ font: e.target.value }, k + 'font')} options={BRAND_FONTS.map((f) => ({ value: f.family, label: f.label }))} />
        </Field>
        <Field label="الوزن">
          <Select className="!min-h-0 !py-1.5" value={String(weight)} onChange={(e) => onChange({ weight: +e.target.value }, k + 'weight')} options={FONT_WEIGHTS.filter((w) => w in fam.weights).map((w) => ({ value: String(w), label: `${fam.weights[w]} ${w}` }))} />
        </Field>
      </div>
      <Num label="الحجم" suffix="px" value={size} min={8} max={600} onChange={(v) => onChange({ size: v }, k + 'size')} />
      <div className="flex flex-wrap gap-1">
        {Object.entries(TYPE_SCALE).map(([key, t]) => (
          <button key={key} type="button" onClick={() => onChange({ size: t.size, weight: t.weight }, k + 'scale')} className={cx('rounded-full border px-2 py-0.5 text-[11px]', size === t.size ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-ink-100 text-ink-600 hover:border-ink-200')}>
            {t.label} {t.size}
          </button>
        ))}
      </div>
    </>
  );
}

/** إضافة شعارات لفئة: رفع عدة ملفات، أو من المكتبة، أو رابط في show-media */
function TierAdd({ onAdd }: { onAdd: (m: MediaRef[]) => void }) {
  const pick = useMediaPick();
  const file = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState('');
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" variant="secondary" icon={<Icons.Upload className="h-4 w-4" />} onClick={() => file.current?.click()}>رفع شعارات</Button>
        {pick && <Button size="sm" variant="secondary" icon={<Icons.Library className="h-4 w-4" />} onClick={async () => { const m = await pick('image'); if (m) onAdd([m]); }}>من المكتبة</Button>}
        <input ref={file} type="file" accept="image/*" multiple hidden onChange={async (e) => { const fs = [...(e.target.files ?? [])]; e.target.value = ''; onAdd((await uploadFiles(fs)).map((x) => x.ref)); }} />
      </div>
      <div className="flex gap-1.5">
        <Input dir="ltr" className="!min-h-0 !py-1.5 text-left" value={url} placeholder="show-media/partners/logo.png" onChange={(e) => setUrl(e.target.value)} />
        <Button size="sm" variant="secondary" disabled={!url.trim()} onClick={() => (onAdd([{ kind: 'url', src: url.trim() }]), setUrl(''))}>أضف</Button>
      </div>
    </div>
  );
}

function TiersEditor({ tiers, onChange }: { tiers: LogoTier[]; onChange: (t: LogoTier[]) => void }) {
  const set = (i: number, t: Partial<LogoTier>) => onChange(tiers.map((x, k) => (k === i ? { ...x, ...t } : x)));
  return (
    <div className="space-y-3">
      {tiers.map((t, i) => (
        <div key={i} className="space-y-2 rounded-xl border border-ink-100 p-2">
          <div className="flex gap-2">
            <Input className="!min-h-0 !py-1.5" value={t.title} placeholder="عنوان الفئة" onChange={(e) => set(i, { title: e.target.value })} />
            <Select className="!min-h-0 w-24 !py-1.5" value={t.size} onChange={(e) => set(i, { size: e.target.value as LogoTier['size'] })} options={[{ value: 'lg', label: 'كبير' }, { value: 'md', label: 'متوسط' }, { value: 'sm', label: 'صغير' }]} />
            <button type="button" className="p-1 text-ink-400 hover:text-bad-600" aria-label="حذف الفئة" onClick={() => onChange(tiers.filter((_, k) => k !== i))}><Icons.Trash2 className="h-4 w-4" /></button>
          </div>
          {t.logos.map((m, k) => (
            <div key={k} className="flex items-center gap-2 text-xs">
              <span className="min-w-0 flex-1 truncate" dir="ltr">{m.kind === 'local' ? m.name ?? m.id : m.src}</span>
              <button type="button" className="p-1 text-ink-400 hover:text-bad-600" aria-label="إزالة" onClick={() => set(i, { logos: t.logos.filter((_, j) => j !== k) })}><Icons.X className="h-3.5 w-3.5" /></button>
            </div>
          ))}
          <TierAdd onAdd={(ms) => set(i, { logos: [...t.logos, ...ms] })} />
        </div>
      ))}
      <Button size="sm" variant="secondary" icon={<Icons.Plus className="h-4 w-4" />} onClick={() => onChange([...tiers, { title: '', size: 'md', logos: [] }])}>فئة</Button>
    </div>
  );
}

function ElementFields({ el, patch }: { el: SlideElement; patch: ElPatch }) {
  const props = (p: Record<string, unknown>, key: string) => patch((e) => ({ ...e, props: { ...e.props, ...p } }) as SlideElement, `${el.id}:${key}`);
  switch (el.type) {
    case 'text':
      return (
        <Section title="النص">
          <Textarea rows={3} value={el.props.text} onChange={(e) => props({ text: e.target.value }, 'text')} />
          <FontFields font={el.props.font} weight={el.props.weight} size={el.props.size} k="t" onChange={(p, k) => props(p, k)} />
          <div className="flex items-end gap-2">
            <div className="flex overflow-hidden rounded-xl border border-ink-200">
              {(['start', 'center', 'end'] as const).map((a) => {
                const I = a === 'start' ? Icons.AlignRight : a === 'center' ? Icons.AlignCenter : Icons.AlignLeft;
                return <button key={a} type="button" onClick={() => props({ align: a }, 'align')} className={cx('p-2', el.props.align === a ? 'bg-brand-50 text-brand-700' : 'text-ink-500 hover:bg-ink-50')} aria-label="محاذاة"><I className="h-4 w-4" /></button>;
              })}
            </div>
            <Num label="ارتفاع السطر" value={el.props.line} step={0.05} min={0.8} max={3} onChange={(v) => props({ line: v }, 'line')} />
          </div>
          <Field label="اللون"><Swatches value={el.props.color} onChange={(c: ColorRef) => props({ color: c }, 'color')} /></Field>
        </Section>
      );
    case 'image':
    case 'video':
      return (
        <Section title={el.type === 'image' ? 'الصورة' : 'الفيديو'}>
          <MediaPicker value={el.props.media} accept={el.type === 'image' ? 'image/*' : 'video/*'} placeholder={el.type === 'image' ? 'show-media/photo.jpg' : 'show-media/intro.mp4'} onChange={(m?: MediaRef) => props({ media: m }, 'media')} />
          <div className="grid grid-cols-2 gap-2">
            <Field label="الملاءمة"><Select className="!min-h-0 !py-1.5" value={el.props.fit} onChange={(e) => props({ fit: e.target.value }, 'fit')} options={[{ value: 'contain', label: 'كاملة' }, { value: 'cover', label: 'تملأ الإطار' }]} /></Field>
            <Num label="استدارة الحواف" value={el.props.radius} min={0} max={999} onChange={(v) => props({ radius: v }, 'radius')} />
          </div>
          {el.type === 'video' && (
            <div className="space-y-1">
              <Toggle checked={!el.props.muted} onChange={(v) => props({ muted: !v }, 'muted')} label="بالصوت" />
              <Toggle checked={el.props.autoAdvance} onChange={(v) => props({ autoAdvance: v }, 'auto')} label="ينتقل للتالي عند انتهائه" />
              <Toggle checked={el.props.showSkip} onChange={(v) => props({ showSkip: v }, 'skip')} label="زر «تخطٍّ» للمقدّم" />
            </div>
          )}
        </Section>
      );
    case 'logo':
      return (
        <Section title="شعار البرنامج">
          <div className="grid grid-cols-2 gap-2">
            <Field label="الشكل">
              <Select className="!min-h-0 !py-1.5" value={el.props.kind} onChange={(e) => patch((x) => (x.type === 'logo' ? { ...x, props: { ...x.props, kind: e.target.value as typeof x.props.kind }, h: x.w / LOGO_RATIO[e.target.value as typeof x.props.kind] } : x), `${el.id}:kind`)} options={Object.entries(LOGOS).map(([k, l]) => ({ value: k, label: l.label }))} />
            </Field>
            <Field label="النسخة">
              <Select className="!min-h-0 !py-1.5" value={el.props.variant} onChange={(e) => props({ variant: e.target.value }, 'variant')} options={[{ value: 'auto', label: 'حسب القالب' }, { value: 'color', label: 'الملونة' }, { value: 'white', label: 'البيضاء (على التيل)' }]} />
            </Field>
          </div>
          <p className="text-[11px] leading-relaxed text-ink-500">قواعد ملف الهوية: لا مد ولا ضغط ولا تدوير ولا شفافية ولا ظل، ومساحة آمنة خُمس الارتفاع، وأصغر عرض {LOGOS[el.props.kind].minWidth}px.</p>
        </Section>
      );
    case 'shape':
      return (
        <Section title="الشكل">
          <div className="grid grid-cols-2 gap-2">
            <Field label="النوع"><Select className="!min-h-0 !py-1.5" value={el.props.shape} onChange={(e) => props({ shape: e.target.value }, 'shape')} options={[{ value: 'rect', label: 'مستطيل' }, { value: 'circle', label: 'دائرة' }, { value: 'line', label: 'خط' }]} /></Field>
            {el.props.shape === 'rect' && <Num label="استدارة الحواف" value={el.props.radius} min={0} max={999} onChange={(v) => props({ radius: v }, 'radius')} />}
          </div>
          <Field label="التعبئة"><Swatches value={el.props.fill} extra={fillExtras} onChange={(c: Fill) => props({ fill: c }, 'fill')} /></Field>
          {el.props.shape !== 'line' && (
            <>
              <Field label="الإطار"><Swatches value={el.props.stroke} extra={[fillExtras[2]]} onChange={(c: ColorRef | 'none') => props({ stroke: c }, 'stroke')} /></Field>
              {el.props.stroke !== 'none' && <Num label="سماكة الإطار" value={el.props.strokeWidth} min={0} max={200} onChange={(v) => props({ strokeWidth: v }, 'sw')} />}
            </>
          )}
        </Section>
      );
    case 'counter':
      return (
        <Section title="العدّاد">
          <div className="grid grid-cols-3 gap-2">
            <Num label="من" value={el.props.from} onChange={(v) => props({ from: v }, 'from')} />
            <Num label="إلى" value={el.props.to} onChange={(v) => props({ to: v }, 'to')} />
            <Num label="المدة" suffix="ms" value={el.props.duration} min={0} step={100} onChange={(v) => props({ duration: v }, 'dur')} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="قبل الرقم"><Input className="!min-h-0 !py-1.5" value={el.props.prefix} onChange={(e) => props({ prefix: e.target.value }, 'pre')} /></Field>
            <Field label="بعد الرقم"><Input className="!min-h-0 !py-1.5" value={el.props.suffix} placeholder="+" onChange={(e) => props({ suffix: e.target.value }, 'suf')} /></Field>
          </div>
          <FontFields font={el.props.font} weight={el.props.weight} size={el.props.size} k="c" onChange={(p, k) => props(p, k)} />
          <Field label="اللون"><Swatches value={el.props.color} onChange={(c: ColorRef) => props({ color: c }, 'color')} /></Field>
        </Section>
      );
    case 'names':
      return (
        <Section title="الأسماء">
          <Field label={`الأسماء (${el.props.names.length}) · اسم في كل سطر`}>
            <Textarea rows={6} value={el.props.names.join('\n')} onChange={(e) => props({ names: e.target.value.split('\n').map((n) => n.trim()).filter(Boolean) }, 'names')} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Num label="أسماء مع كل نقرة" value={el.props.perStep} min={1} max={50} onChange={(v) => props({ perStep: Math.round(v) }, 'per')} />
            <div className="pt-5"><Toggle checked={el.props.counter} onChange={(v) => props({ counter: v }, 'counter')} label="العدّاد" /></div>
          </div>
          <p className="text-[11px] text-ink-500">تأخذ القائمة {nameBatches(el.props)} نقرة بعد ظهورها.</p>
          <FontFields font={el.props.font} weight={el.props.weight} size={el.props.size} k="n" onChange={(p, k) => props(p, k)} />
          <Field label="اللون"><Swatches value={el.props.color} onChange={(c: ColorRef) => props({ color: c }, 'color')} /></Field>
        </Section>
      );
    case 'logoGrid':
      return (
        <Section title="شبكة الشعارات">
          <TiersEditor tiers={el.props.tiers} onChange={(tiers) => props({ tiers }, 'tiers')} />
          <Field label="لون عناوين الفئات"><Swatches value={el.props.titleColor} onChange={(c: ColorRef) => props({ titleColor: c }, 'tc')} /></Field>
        </Section>
      );
  }
}

/** خصائص مشتركة: الظهور والحركة (تعمل على عنصر أو عدة عناصر) */
function AppearFields({ els, patch }: { els: SlideElement[]; patch: ElPatch }) {
  const el = els[0];
  const key = els.map((e) => e.id).join(',');
  const set = (fn: (e: SlideElement) => SlideElement, k: string) => patch(fn, `${key}:${k}`);
  return (
    <Section title="الظهور والحركة">
      <div className="grid grid-cols-2 gap-2">
        <Num label="يظهر مع النقرة" value={el.step} min={0} max={500} onChange={(v) => set((e) => ({ ...e, step: Math.round(v) }), 'step')} />
        <Num label="يختفي مع النقرة (0 = لا)" value={el.until ?? 0} min={0} max={500} onChange={(v) => set((e) => ({ ...e, until: v > 0 ? Math.round(v) : undefined }), 'until')} />
      </div>
      <Field label="حركة الدخول">
        <Select className="!min-h-0 !py-1.5" value={el.anim.type} onChange={(e) => set((x) => ({ ...x, anim: { ...x.anim, type: e.target.value as AnimType } }), 'anim')} options={Object.entries(ANIMS).map(([value, label]) => ({ value, label }))} />
      </Field>
      {el.anim.type !== 'none' && (
        <div className="grid grid-cols-2 gap-2">
          <Num label="التأخير" suffix="ms" step={100} min={0} max={20000} value={el.anim.delay} onChange={(v) => set((x) => ({ ...x, anim: { ...x.anim, delay: v } }), 'delay')} />
          <Num label="المدة" suffix="ms" step={100} min={100} max={10000} value={el.anim.duration} onChange={(v) => set((x) => ({ ...x, anim: { ...x.anim, duration: v } }), 'dur')} />
        </div>
      )}
    </Section>
  );
}

function BoxFields({ el, patch }: { el: SlideElement; patch: ElPatch }) {
  const logo = el.type === 'logo';
  const set = (p: Partial<SlideElement>, k: string) => patch((e) => ({ ...e, ...p }) as SlideElement, `${el.id}:${k}`);
  return (
    <Section title="الموضع والمظهر">
      <div className="grid grid-cols-4 gap-2">
        <Num label="س" value={el.x} onChange={(v) => set({ x: v }, 'x')} />
        <Num label="ص" value={el.y} onChange={(v) => set({ y: v }, 'y')} />
        <Num label="العرض" value={el.w} min={logo ? LOGOS[el.props.kind].minWidth : 1} onChange={(v) => set(logo ? { w: v, h: v / LOGO_RATIO[el.props.kind] } : { w: v }, 'w')} />
        <Num label="الارتفاع" value={el.h} min={1} onChange={(v) => set(logo ? { h: v, w: v * LOGO_RATIO[el.props.kind] } : { h: v }, 'h')} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Num label="الدوران" suffix="°" value={el.rot} min={-360} max={360} disabled={logo && !LOGO_RULES.allowRotate} onChange={(v) => set({ rot: v }, 'rot')} />
        <Num label="الشفافية" suffix="%" value={Math.round(el.opacity * 100)} min={0} max={100} disabled={logo && !LOGO_RULES.allowOpacity} onChange={(v) => set({ opacity: v / 100 }, 'op')} />
      </div>
      <Field label="الظل">
        <Select className="!min-h-0 !py-1.5" disabled={logo && !LOGO_RULES.allowShadow} value={el.shadow} onChange={(e) => set({ shadow: e.target.value as Shadow }, 'shadow')} options={Object.entries(SHADOWS).map(([value, label]) => ({ value, label }))} />
      </Field>
      <Toggle checked={!!el.locked} onChange={(v) => set({ locked: v || undefined }, 'lock')} label="قفل العنصر (لا يتحرك بالسحب)" />
    </Section>
  );
}

export function ElementInspector({ els, patch, onAlign, onDistribute, onLayer, onDuplicate, onDelete }: {
  els: SlideElement[];
  patch: ElPatch;
  onAlign: (m: AlignMode) => void;
  onDistribute: (axis: 'x' | 'y') => void;
  onLayer: (to: 'front' | 'back' | 'up' | 'down') => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const one = els.length === 1 ? els[0] : null;
  const AL: [AlignMode, typeof Icons.AlignRight, string][] = [
    ['start', Icons.AlignHorizontalJustifyEnd, 'يمين'], ['centerX', Icons.AlignHorizontalJustifyCenter, 'وسط أفقي'], ['end', Icons.AlignHorizontalJustifyStart, 'يسار'],
    ['top', Icons.AlignVerticalJustifyStart, 'أعلى'], ['middle', Icons.AlignVerticalJustifyCenter, 'وسط عمودي'], ['bottom', Icons.AlignVerticalJustifyEnd, 'أسفل'],
  ];
  return (
    <div>
      <div className="flex items-center gap-2 border-b border-ink-100 px-4 py-3">
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink-900">{one ? ELEMENT_LABELS[one.type] : `${els.length} عناصر`}</span>
        <button type="button" title="تكرار (Ctrl+D)" className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-50" onClick={onDuplicate}><Icons.Copy className="h-4 w-4" /></button>
        <button type="button" title="حذف (Delete)" className="rounded-lg p-1.5 text-ink-500 hover:bg-bad-50 hover:text-bad-600" onClick={onDelete}><Icons.Trash2 className="h-4 w-4" /></button>
      </div>
      <Section title={els.length > 1 ? 'المحاذاة (إلى المجموعة)' : 'المحاذاة (إلى الشريحة)'}>
        <div className="flex flex-wrap gap-1">
          {AL.map(([m, I, label]) => <button key={m} type="button" title={label} onClick={() => onAlign(m)} className="rounded-lg border border-ink-100 p-1.5 text-ink-600 hover:border-ink-200 hover:bg-ink-50"><I className="h-4 w-4" /></button>)}
          {els.length > 2 && (
            <>
              <button type="button" title="توزيع أفقي" onClick={() => onDistribute('x')} className="rounded-lg border border-ink-100 p-1.5 text-ink-600 hover:bg-ink-50"><Icons.AlignHorizontalSpaceAround className="h-4 w-4" /></button>
              <button type="button" title="توزيع عمودي" onClick={() => onDistribute('y')} className="rounded-lg border border-ink-100 p-1.5 text-ink-600 hover:bg-ink-50"><Icons.AlignVerticalSpaceAround className="h-4 w-4" /></button>
            </>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          <Button size="sm" variant="secondary" onClick={() => onLayer('front')}>للأمام</Button>
          <Button size="sm" variant="secondary" onClick={() => onLayer('up')}>طبقة لأعلى</Button>
          <Button size="sm" variant="secondary" onClick={() => onLayer('down')}>طبقة لأسفل</Button>
          <Button size="sm" variant="secondary" onClick={() => onLayer('back')}>للخلف</Button>
        </div>
      </Section>
      {one && <ElementFields el={one} patch={patch} />}
      <AppearFields els={els} patch={patch} />
      {one && <BoxFields el={one} patch={patch} />}
    </div>
  );
}

export function SlideInspector({ title, settings, onTitle, onChange }: { title: string; settings: SlideSettings; onTitle: (t: string) => void; onChange: (s: Partial<SlideSettings>, key: string) => void }) {
  const bg = settings.bg;
  const setBg = (b: SlideBg) => onChange({ bg: b }, 'bg');
  return (
    <div>
      <Section title="الشريحة">
        <Field label="اسم الشريحة (في القائمة وشاشة التحكم)"><Input className="!min-h-0 !py-1.5" value={title} onChange={(e) => onTitle(e.target.value)} /></Field>
        <Toggle checked={settings.mark} onChange={(v) => onChange({ mark: v }, 'mark')} label="شعار الزاوية" />
      </Section>
      <Section title="الخلفية">
        <Select
          className="!min-h-0 !py-1.5"
          value={bg.kind}
          onChange={(e) => {
            const k = e.target.value as SlideBg['kind'];
            setBg(k === 'theme' ? { kind: 'theme', glow: true } : k === 'color' ? { kind: 'color', color: 'night' } : k === 'gradient' ? { kind: 'gradient', name: 'teal' } : k === 'media' ? { kind: 'media' } : { kind: 'black' });
          }}
          options={[{ value: 'theme', label: 'خلفية القالب' }, { value: 'color', label: 'لون من الهوية' }, { value: 'gradient', label: 'تدرّج من الهوية' }, { value: 'media', label: 'صورة' }, { value: 'black', label: 'سوداء (إطفاء)' }]}
        />
        {bg.kind === 'theme' && <Toggle checked={bg.glow} onChange={(v) => setBg({ kind: 'theme', glow: v })} label="التوهّج خلف المحتوى" />}
        {bg.kind === 'color' && <Swatches value={bg.color} onChange={(c: ColorRef) => setBg({ kind: 'color', color: c })} />}
        {bg.kind === 'gradient' && (
          <div className="flex gap-2">
            {(['teal', 'gold'] as const).map((n) => <button key={n} type="button" onClick={() => setBg({ kind: 'gradient', name: n })} className={cx('h-10 flex-1 rounded-xl ring-1 ring-ink-200', bg.name === n && 'ring-[3px] ring-brand-600')} style={{ background: n === 'teal' ? 'var(--b-grad-teal)' : 'var(--b-grad-gold)' }} aria-label={GRADIENT_FILLS[n === 'teal' ? 'gradTeal' : 'gradGold']} />)}
          </div>
        )}
        {bg.kind === 'media' && <MediaPicker value={bg.media} accept="image/*" placeholder="show-media/background.jpg" onChange={(m) => setBg({ kind: 'media', media: m })} />}
      </Section>
      <Section title="تلميحات">
        <ul className="list-disc space-y-1 ps-4 text-[11px] leading-relaxed text-ink-500">
          <li>انقر عنصراً لتحديده، وShift للتحديد المتعدد، أو اسحب مستطيلاً حول العناصر.</li>
          <li>نقرتان على النص لتحريره مباشرة.</li>
          <li>Shift أثناء السحب يثبّت المحور، وأثناء التدوير يلتقط كل 15°. Alt يلغي خطوط الإرشاد.</li>
          <li>Ctrl+Z تراجع، Ctrl+Shift+Z إعادة، Ctrl+D تكرار، Delete حذف، والأسهم للتحريك الدقيق.</li>
        </ul>
      </Section>
    </div>
  );
}
