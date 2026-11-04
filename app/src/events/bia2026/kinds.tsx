// فقرات حفل ختام «بيئات التطوع 2026»: المتحدث، التجربة، الجائزة، التكريم، رابط التقييم.
// تُسجَّل في وضع العرض (show/ext.ts) دون تعديل أنواع «صقل». النصوص بلا تطويل، والفارغ لا يظهر على شاشة العرض.
import { useMemo, type CSSProperties, type ReactNode } from 'react';
import qrcode from 'qrcode-generator';
import type { MediaRef } from '@/show/model';
import type { ExtKind, ExtViewProps } from '@/show/ext';
import { FitStage } from '@/show/slides/SlideView';
import { useMediaUrl } from '@/show/segments/useMedia';
import { media as readMedia } from '@/show/slides/sanitize';
import { AwardEditor, ExperienceEditor, HonoringEditor, QrEditor, SpeakerEditor } from './editors';
import './bia.css';

/** يحذف التطويل (ـ) والمسافات الزائدة: العرض الأصلي يفرّد الحروف بالتطويل فينكسر النص */
export const clean = (v: unknown, d = '') => (typeof v === 'string' ? v.replace(/ـ/g, '').replace(/\s+/g, ' ').trim() : d);
const isObj = (v: unknown): v is Record<string, any> => typeof v === 'object' && v !== null && !Array.isArray(v);
const arr = (v: unknown) => (Array.isArray(v) ? v : []);
const ORDINALS = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر'];
export const placeLabel = (i: number) => `المركز ${ORDINALS[i] ?? i + 1}`;

// ───────────── عناصر مشتركة ─────────────

function Stage({ theme, children, className }: { theme: 'dark' | 'light'; children: ReactNode; className?: string }) {
  return (
    <div className="absolute inset-0" style={{ background: 'rgb(var(--t-bg))' }}>
      <FitStage>
        {(scale) => (
          <div className={`sl-canvas ev ${className ?? ''}`} data-show-theme={theme} style={{ transform: `scale(${scale})` }}>
            <div className="show-bg" />
            <div className="ev-shapes" />
            {children}
          </div>
        )}
      </FitStage>
    </div>
  );
}

/** صورة أو شعار. فارغ: مكان منقّط في المحرّر فقط */
function Pic({ media, label, preview, className, round }: { media?: MediaRef; label: string; preview: boolean; className?: string; round?: boolean }) {
  const { url } = useMediaUrl(media);
  if (url) return <img src={url} alt="" className={`${className ?? ''} ${round ? 'ev-round' : ''}`} draggable={false} />;
  return preview ? <span className={`${className ?? ''} ev-empty ${round ? 'ev-round' : ''}`}>{label}</span> : null;
}

/** نص فارغ: مكان منقّط في المحرّر فقط */
function Txt({ v, label, preview, className, style }: { v: string; label: string; preview: boolean; className: string; style?: CSSProperties }) {
  if (v) return <p className={className} style={style}>{v}</p>;
  return preview ? <p className={`${className} ev-empty-text`} style={style}>{label}</p> : null;
}

const d = (ms: number) => ({ ['--d' as string]: `${ms}ms` }) as CSSProperties;

// ───────────── المتحدث ─────────────

export interface SpeakerData {
  kicker: string;
  name: string;
  role: string;
  photo?: MediaRef;
  logo?: MediaRef;
}

function SpeakerView({ data, theme, preview }: ExtViewProps<SpeakerData>) {
  const hasPic = !!data.photo || preview;
  return (
    <Stage theme={theme}>
      <div className={`ev-center ${hasPic ? 'ev-with-pic' : ''}`}>
        {(data.photo || preview) && <Pic media={data.photo} label="صورة المتحدث (اختيارية)" preview={preview} className="ev-photo ev-in" round />}
        <div className="ev-stack">
          {(data.logo || preview) && <Pic media={data.logo} label="شعار (اختياري)" preview={preview} className="ev-logo ev-in" />}
          <p className="ev-kicker ev-in" style={d(150)}>{data.kicker}</p>
          <span className="ev-rule ev-wipe" style={d(400)} />
          <Txt v={data.name} label="اسم المتحدث" preview={preview} className="ev-name ev-in" style={d(550)} />
          {(data.role || preview) && <Txt v={data.role} label="الصفة (اختيارية)" preview={preview} className="ev-sub ev-in" style={d(750)} />}
        </div>
      </div>
    </Stage>
  );
}

export const speaker: ExtKind<SpeakerData> = {
  kind: 'speaker',
  label: 'متحدث',
  hint: 'عنوان الكلمة واسم المتحدث وصفته، وصورة وشعار اختياريان',
  icon: 'Mic',
  create: () => ({ kicker: 'كلمة', name: '', role: '' }),
  parse: (r) => {
    const v = isObj(r) ? r : {};
    return { kicker: clean(v.kicker, 'كلمة'), name: clean(v.name), role: clean(v.role), ...(readMedia(v.photo) ? { photo: readMedia(v.photo) } : {}), ...(readMedia(v.logo) ? { logo: readMedia(v.logo) } : {}) };
  },
  steps: () => 1,
  missing: (x) => (x.name ? [] : ['اسم المتحدث']),
  View: SpeakerView,
  Editor: SpeakerEditor,
};

// ───────────── التجربة ─────────────

export interface ExperienceData {
  kicker: string;
  name: string;
  media?: MediaRef;
  /** logo: شعار جهة على بطاقة بيضاء، photo: صورة شخص دائرية */
  mediaKind: 'logo' | 'photo';
}

function ExperienceView({ data, theme, preview }: ExtViewProps<ExperienceData>) {
  return (
    <Stage theme={theme}>
      <div className="ev-center">
        <p className="ev-title ev-in">{data.kicker}</p>
        <span className="ev-rule ev-wipe" style={d(350)} />
        {(data.media || preview) && (
          <div className={`ev-in ${data.mediaKind === 'logo' ? 'ev-card' : ''}`} style={d(500)}>
            <Pic media={data.media} label={data.mediaKind === 'logo' ? 'الشعار' : 'الصورة (اختيارية)'} preview={preview} className={data.mediaKind === 'logo' ? 'ev-card-img' : 'ev-photo'} round={data.mediaKind === 'photo'} />
          </div>
        )}
        <Txt v={data.name} label={data.mediaKind === 'logo' ? 'اسم الجهة' : 'اسم المتطوع'} preview={preview} className="ev-name ev-in" style={d(750)} />
      </div>
    </Stage>
  );
}

export const experience: ExtKind<ExperienceData> = {
  kind: 'experience',
  label: 'تجربة',
  hint: 'تجربة جمعية أو متطوع: عنوان واسم وشعار أو صورة',
  icon: 'Sparkles',
  create: () => ({ kicker: 'تجربة جمعية', name: '', mediaKind: 'logo' }),
  parse: (r) => {
    const v = isObj(r) ? r : {};
    return { kicker: clean(v.kicker, 'تجربة'), name: clean(v.name), mediaKind: v.mediaKind === 'photo' ? 'photo' : 'logo', ...(readMedia(v.media) ? { media: readMedia(v.media) } : {}) };
  },
  steps: () => 1,
  missing: (x) => [...(x.name ? [] : [x.mediaKind === 'logo' ? 'اسم الجهة' : 'الاسم']), ...(x.media || x.mediaKind === 'photo' ? [] : ['الشعار'])],
  View: ExperienceView,
  Editor: ExperienceEditor,
};

// ───────────── الجائزة ─────────────
// الخطوة 0 الإعلان، ثم المراكز من الأدنى إلى الأول (الثالث ثم الثاني ثم الأول)

export interface AwardPlace {
  name: string;
  /** لقب الفائز أو اسم المبادرة */
  sub: string;
  logo?: MediaRef;
}
export interface AwardData {
  intro: string;
  title: string;
  /** person: اسم ولقب، org: شعار الجهة واسمها */
  mode: 'person' | 'org';
  /** المراكز من الأول: places[0] هو الأول */
  places: AwardPlace[];
  /** وصف إضافي للمركز الأول، مثل «صاحب بريق العطاء» */
  crown: string;
}

const awardIndex = (x: AwardData, step: number) => x.places.length - step; // step 1 → آخر مركز

function AwardView({ data, step, theme, preview }: ExtViewProps<AwardData>) {
  if (step <= 0 || !data.places.length) {
    return (
      <Stage theme={theme}>
        <div className="ev-center">
          <p className="ev-kicker ev-in">{data.intro}</p>
          <h1 className="ev-mega ev-in" style={d(300)}>{data.title}</h1>
          <span className="ev-rule ev-wipe" style={d(800)} />
        </div>
      </Stage>
    );
  }
  const i = Math.max(0, awardIndex(data, step));
  const p = data.places[i];
  const first = i === 0;
  return (
    <Stage theme={theme} className={first ? 'ev-first' : ''}>
      <div className="ev-center ev-award ev-compact" key={i}>
        <p className="ev-small-kicker ev-in">{data.title}</p>
        <div className="ev-place ev-rise">
          <span className="ev-medal" data-place={i + 1}>{i + 1}</span>
          <span className="ev-place-label">{placeLabel(i)}</span>
        </div>
        {first && data.crown && <p className="ev-crown ev-in" style={d(500)}>{data.crown}</p>}
        {data.mode === 'org' && (p.logo || preview) && (
          <div className="ev-card ev-in" style={d(650)}>
            <Pic media={p.logo} label="شعار الجهة" preview={preview} className="ev-card-img" />
          </div>
        )}
        <Txt v={p.name} label={data.mode === 'org' ? 'اسم الجهة' : 'الاسم الثلاثي'} preview={preview} className="ev-name ev-in" style={d(850)} />
        {(p.sub || preview) && <Txt v={p.sub} label={data.mode === 'org' ? 'اسم المبادرة' : 'اللقب'} preview={preview} className="ev-sub ev-in" style={d(1050)} />}
      </div>
    </Stage>
  );
}

export const award: ExtKind<AwardData> = {
  kind: 'award',
  label: 'جائزة',
  hint: 'شاشة إعلان ثم المراكز تنازلياً (الثالث ثم الثاني ثم الأول)',
  icon: 'Trophy',
  create: () => ({ intro: 'الإعلان عن الفائزين بجائزة', title: 'الجائزة', mode: 'person', places: [{ name: '', sub: '' }, { name: '', sub: '' }, { name: '', sub: '' }], crown: '' }),
  parse: (r) => {
    const v = isObj(r) ? r : {};
    const places = arr(v.places).slice(0, 10).map((p) => (isObj(p) ? { name: clean(p.name), sub: clean(p.sub), ...(readMedia(p.logo) ? { logo: readMedia(p.logo) } : {}) } : { name: '', sub: '' }));
    return { intro: clean(v.intro), title: clean(v.title, 'الجائزة'), mode: v.mode === 'org' ? 'org' : 'person', places: places.length ? places : [{ name: '', sub: '' }], crown: clean(v.crown) };
  },
  steps: (x) => 1 + x.places.length,
  sub: (x, step) => (step <= 0 ? 'شاشة الإعلان' : `${placeLabel(Math.max(0, awardIndex(x, step)))} (${step} من ${x.places.length})`),
  missing: (x) => x.places.flatMap((p, i) => [...(p.name ? [] : [`${placeLabel(i)}: ${x.mode === 'org' ? 'اسم الجهة' : 'الاسم'}`]), ...(x.mode === 'org' && !p.logo ? [`${placeLabel(i)}: الشعار`] : [])]),
  scrub: (x) => ({ ...x, places: x.places.map(() => ({ name: '', sub: '' })) }),
  View: AwardView,
  Editor: AwardEditor,
};

// ───────────── التكريم ─────────────
// الخطوة 0 شاشة العنوان، ثم شريحة لكل مكرَّم، ثم (اختيارياً) شبكة بكل الأسماء

export interface Honoree {
  label: string;
  name: string;
  role: string;
  logo?: MediaRef;
}
export interface HonoringData {
  kicker: string;
  title: string;
  items: Honoree[];
  /** شبكة بكل الأسماء بعد الشرائح (كفقرة فريق العمل) */
  grid: boolean;
  /** بلا شرائح منفردة: الشبكة وحدها (لفريق كبير) */
  gridOnly: boolean;
}

const honorSteps = (x: HonoringData) => 1 + (x.gridOnly ? 0 : x.items.length) + (x.grid || x.gridOnly ? 1 : 0);

function HonoringView({ data, step, theme, preview }: ExtViewProps<HonoringData>) {
  const singles = data.gridOnly ? 0 : data.items.length;
  if (step <= 0) {
    return (
      <Stage theme={theme}>
        <div className="ev-center">
          <p className="ev-kicker ev-in">{data.kicker}</p>
          <h1 className="ev-mega ev-in" style={d(300)}>{data.title}</h1>
          <span className="ev-rule ev-wipe" style={d(800)} />
        </div>
      </Stage>
    );
  }
  if (step > singles) {
    const n = data.items.length;
    const cols = n <= 4 ? Math.max(1, n) : n <= 9 ? 3 : n <= 16 ? 4 : 5;
    return (
      <Stage theme={theme}>
        <p className="ev-corner-title">{data.kicker} {data.title}</p>
        <ul className="ev-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {data.items.map((h, i) => (
            <li key={i} className="ev-grid-item ev-in" style={d(200 + i * 90)}>
              {h.logo && <Pic media={h.logo} label="" preview={false} className="ev-grid-logo" />}
              <Txt v={h.name} label="الاسم" preview={preview} className="ev-grid-name" />
              {h.role && <p className="ev-grid-role">{h.role}</p>}
            </li>
          ))}
        </ul>
      </Stage>
    );
  }
  const h = data.items[step - 1];
  return (
    <Stage theme={theme}>
      <div className="ev-center ev-compact" key={step}>
        <p className="ev-small-kicker ev-in">{data.kicker} {data.title}</p>
        <p className="ev-title ev-in" style={d(150)}>{h.label}</p>
        <span className="ev-rule ev-wipe" style={d(300)} />
        {(h.logo || preview) && (
          <div className="ev-card ev-in" style={d(450)}>
            <Pic media={h.logo} label="الشعار" preview={preview} className="ev-card-img" />
          </div>
        )}
        <Txt v={h.name} label="الاسم" preview={preview} className="ev-name ev-in" style={d(650)} />
        {(h.role || preview) && <Txt v={h.role} label="الصفة (اختيارية)" preview={preview} className="ev-sub ev-in" style={d(850)} />}
      </div>
    </Stage>
  );
}

export const honoring: ExtKind<HonoringData> = {
  kind: 'honoring',
  label: 'تكريم',
  hint: 'شاشة عنوان ثم شريحة لكل مكرَّم، أو شبكة بكل الأسماء',
  icon: 'Award',
  create: () => ({ kicker: 'تكريم', title: 'الشركاء', items: [{ label: 'شريك النجاح', name: '', role: '' }], grid: false, gridOnly: false }),
  parse: (r) => {
    const v = isObj(r) ? r : {};
    const items = arr(v.items).slice(0, 200).map((h) => (isObj(h) ? { label: clean(h.label), name: clean(h.name), role: clean(h.role), ...(readMedia(h.logo) ? { logo: readMedia(h.logo) } : {}) } : { label: '', name: '', role: '' }));
    return { kicker: clean(v.kicker, 'تكريم'), title: clean(v.title), items, grid: v.grid === true, gridOnly: v.gridOnly === true };
  },
  steps: honorSteps,
  sub: (x, step) => {
    const singles = x.gridOnly ? 0 : x.items.length;
    if (step <= 0) return 'شاشة العنوان';
    if (step > singles) return `شبكة الأسماء (${x.items.length})`;
    return `${step} من ${singles}`;
  },
  missing: (x) => (x.items.length ? x.items.flatMap((h, i) => (h.name ? [] : [`${h.label || `المكرَّم ${i + 1}`}: الاسم`])) : ['لا يوجد مكرَّمون بعد']),
  scrub: (x) => ({ ...x, items: x.items.map((h) => ({ label: h.label, name: '', role: '' })) }),
  View: HonoringView,
  Editor: HonoringEditor,
};

// ───────────── رابط التقييم ─────────────

export interface QrData {
  title: string;
  sub: string;
  url: string;
}

/** QR يُولَّد محلياً بلا أي خدمة خارجية */
export function QrSvg({ text, size }: { text: string; size: number }) {
  const q = useMemo(() => {
    const g = qrcode(0, 'M');
    g.addData(text);
    g.make();
    const n = g.getModuleCount();
    let path = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (g.isDark(r, c)) path += `M${c + 4} ${r + 4}h1v1h-1z`;
    return { path, n: n + 8 };
  }, [text]);
  return (
    <svg viewBox={`0 0 ${q.n} ${q.n}`} width={size} height={size} shapeRendering="crispEdges" role="img" aria-label="رمز QR">
      <rect width={q.n} height={q.n} fill="#FFFFFF" />
      <path d={q.path} fill="#274653" />
    </svg>
  );
}

function QrView({ data, theme, preview }: ExtViewProps<QrData>) {
  return (
    <Stage theme={theme}>
      <div className="ev-center ev-qr-row">
        <div className="ev-stack">
          <h1 className="ev-title ev-in">{data.title}</h1>
          <span className="ev-rule ev-wipe" style={d(300)} />
          <p className="ev-sub ev-in" style={d(450)}>{data.sub}</p>
        </div>
        <div className="ev-qr ev-in" style={d(600)}>{data.url ? <QrSvg text={data.url} size={460} /> : preview ? <span className="ev-empty ev-qr-empty">رابط التقييم</span> : null}</div>
      </div>
    </Stage>
  );
}

export const qrLink: ExtKind<QrData> = {
  kind: 'qr-link',
  label: 'رابط و QR',
  hint: 'عنوان ورابط يتحوّل إلى QR محلياً',
  icon: 'QrCode',
  create: () => ({ title: 'رابط تقييم الحفل', sub: 'لمشاركتكم وحضوركم', url: '' }),
  parse: (r) => {
    const v = isObj(r) ? r : {};
    const url = typeof v.url === 'string' ? v.url.trim() : '';
    return { title: clean(v.title, 'رابط'), sub: clean(v.sub), url: /^https?:\/\//i.test(url) ? url : '' };
  },
  steps: () => 1,
  missing: (x) => (x.url ? [] : ['رابط التقييم']),
  View: QrView,
  Editor: QrEditor,
};

export const KINDS = [speaker, experience, award, honoring, qrLink] as ExtKind[];
