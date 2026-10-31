// عرض الشريحة: نفس المكوّن في شاشة العرض والمحرّر والمصغّرات، فما يُرى في المحرّر هو ما يُعرض.
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ChevronsLeft, Volume2 } from 'lucide-react';
import { useMediaUrl } from '../segments/useMedia';
import { SlideFxLayer } from '../ceremony/fx';
import { BRAND_COLORS } from '../brand/brand';
import {
  CANVAS, isVisibleAt, logoSrc, nameBatches, THEME_ROLES,
  type ColorRef, type CounterEl, type Fill, type ImageEl, type LogoGridEl, type NamesEl, type SlideBg, type SlideElement, type SlideSettings, type TextEl, type VideoEl,
} from './model';
import { fitLogoGrid } from './layout';
import type { ShowTheme } from '../model';
import './slides.css';

export type SlideMode = 'play' | 'edit' | 'thumb';

const ROLE_VAR: Record<keyof typeof THEME_ROLES, string> = { head: '--t-head', fg: '--t-fg', em: '--t-em', em2: '--t-em-2', primary: '--t-primary', glow: '--t-glow' };
const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());

/** لون من الهوية أو دور القالب كقيمة CSS */
export function cssColor(c: ColorRef, alpha = 1) {
  const v = c in ROLE_VAR ? ROLE_VAR[c as keyof typeof ROLE_VAR] : c in BRAND_COLORS ? `--b-${kebab(c)}` : '--t-fg';
  return alpha < 1 ? `rgb(var(${v}) / ${alpha})` : `rgb(var(${v}))`;
}
export const cssFill = (f: Fill) => (f === 'none' ? 'transparent' : f === 'gradTeal' ? 'var(--b-grad-teal)' : f === 'gradGold' ? 'var(--b-grad-gold)' : cssColor(f));

const TEXT_ALIGN = { start: 'right', center: 'center', end: 'left' } as const;

/** حاوية تملأ مكانها وتضع اللوحة 1920×1080 فيها بأكبر حجم ممكن في المنتصف */
export function FitStage({ children, scale: fixed, className }: { children: (scale: number) => ReactNode; scale?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    if (fixed) return;
    const el = ref.current;
    if (!el) return;
    const measure = () => setBox({ w: el.offsetWidth, h: el.offsetHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => (ro.disconnect(), window.removeEventListener('resize', measure));
  }, [fixed]);
  const s = fixed ?? (box.w && box.h ? Math.min(box.w / CANVAS.w, box.h / CANVAS.h) : 0);
  const left = fixed ? 0 : (box.w - CANVAS.w * s) / 2;
  const top = fixed ? 0 : (box.h - CANVAS.h * s) / 2;
  return (
    <div ref={ref} className={className ?? 'sl-fit'}>
      {s > 0 && <div style={{ position: 'absolute', left, top, width: CANVAS.w * s, height: CANVAS.h * s }}>{children(s)}</div>}
    </div>
  );
}

function Background({ bg, mode }: { bg: SlideBg; mode: SlideMode }) {
  const media = useMediaUrl(bg.kind === 'media' ? bg.media : undefined);
  switch (bg.kind) {
    case 'black': return <div className="sl-bg sl-off" />;
    case 'color': return <div className="sl-bg" style={{ background: cssColor(bg.color) }} />;
    case 'gradient': return <div className={`sl-bg ${bg.name === 'gold' ? 'sl-bg-gold' : 'sl-bg-teal'}`} />;
    case 'media':
      return (
        <div className="show-bg">
          {media.url && <img className="sl-bg-media" src={media.url} alt="" draggable={false} />}
        </div>
      );
    default:
      return <div className="show-bg">{bg.glow && <div className="show-glow" style={mode === 'thumb' ? { animation: 'none' } : undefined} />}</div>;
  }
}

export interface SlideCanvasProps {
  settings: SlideSettings;
  /** القالب الغامق أو الفاتح (من إعدادات العرض) */
  theme?: ShowTheme;
  step: number;
  mode: SlideMode;
  /** الشريحة المعروضة الآن في العرض (الفيديو يعمل والعدّاد يعدّ) */
  active?: boolean;
  /** حركات الدخول تعمل (في العرض: بعد «ابدأ العرض» فقط، فلا تنتهي خلف شاشة البداية) */
  animate?: boolean;
  scale: number;
  onSkip?: () => void;
  /** المحرّر: عنصر قيد تحرير النص، وإشعار بانتهاء التحرير */
  editingId?: string | null;
  onTextCommit?: (id: string, text: string) => void;
  /** المحرّر: عناصر لا تظهر في الخطوة الحالية تُرسم باهتة بدل إخفائها */
  dimHidden?: boolean;
  children?: ReactNode;
}

/** اللوحة نفسها بحجمها الحقيقي 1920×1080 مُصغّرة بـ scale */
export function SlideCanvas({ settings, theme = 'dark', step, mode, active = false, animate = true, scale, onSkip, editingId, onTextCommit, dimHidden, children }: SlideCanvasProps) {
  return (
    <div className="sl-canvas" data-show-theme={theme} style={{ transform: `scale(${scale})` }}>
      <Background bg={settings.bg} mode={mode} />
      <SlideFxLayer fx={settings.fx} still={mode !== 'play'} />
      {settings.elements.map((el, z) => {
        const visible = isVisibleAt(el, step);
        if (!visible && !(dimHidden && mode === 'edit')) return null;
        return <ElementView key={el.id} el={el} z={z} theme={theme} anim={mode === 'play' && animate} step={step} mode={mode} active={active} visible={visible} onSkip={onSkip} editing={editingId === el.id} onTextCommit={onTextCommit} />;
      })}
      {children}
    </div>
  );
}

/** موضع العنصر ودورانه وشفافيته وظله */
export const elementBox = (el: SlideElement, z: number): CSSProperties => ({
  left: el.x,
  top: el.y,
  width: el.w,
  height: el.h,
  zIndex: z + 1,
  transform: el.rot ? `rotate(${el.rot}deg)` : undefined,
  opacity: el.opacity,
});

interface ElProps {
  el: SlideElement;
  theme: ShowTheme;
  /** تعمل حركات الدخول */
  anim: boolean;
  z: number;
  step: number;
  mode: SlideMode;
  active: boolean;
  visible: boolean;
  onSkip?: () => void;
  editing?: boolean;
  onTextCommit?: (id: string, text: string) => void;
}

function ElementView(p: ElProps) {
  const { el, mode, visible } = p;
  const play = p.anim && el.anim.type !== 'none';
  return (
    <div className={`sl-el ${!visible ? 'dim' : ''} ${el.shadow !== 'none' ? `sl-shadow-${el.shadow}` : ''}`} style={elementBox(el, p.z)} data-el={el.id}>
      <div
        // المفتاح يعيد الحركة كلما ظهر العنصر من جديد
        key={play ? `${el.id}:${el.step}` : el.id}
        className={`sl-inner ${play ? `sl-anim sl-a-${el.anim.type}` : ''}`}
        style={play ? ({ ['--d' as string]: `${el.anim.duration}ms`, ['--dl' as string]: `${el.anim.delay}ms` } as CSSProperties) : undefined}
      >
        <Body {...p} />
      </div>
    </div>
  );
}

function Body(p: ElProps) {
  const { el } = p;
  switch (el.type) {
    case 'text': return <TextBody {...p} el={el} />;
    case 'image': return <ImageBody el={el} mode={p.mode} />;
    case 'logo': return <img className="sl-img" src={logoSrc(el.props, p.theme)} alt="شعار برنامج صقل" draggable={false} style={{ objectFit: 'contain' }} />;
    case 'video': return <VideoBody {...p} el={el} />;
    case 'shape': {
      const s = el.props;
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            background: cssFill(s.fill),
            borderRadius: s.shape === 'circle' ? '50%' : s.shape === 'line' ? 999 : s.radius,
            border: s.stroke !== 'none' && s.shape !== 'line' ? `${s.strokeWidth}px solid ${cssColor(s.stroke)}` : undefined,
          }}
        />
      );
    }
    case 'logoGrid': return <LogoGridBody el={el} mode={p.mode} anim={p.anim} />;
    case 'counter': return <CounterBody el={el} mode={p.mode} active={p.active} />;
    case 'names': return <NamesBody el={el} step={p.step} mode={p.mode} anim={p.anim} />;
  }
}

function TextBody({ el, editing, onTextCommit }: ElProps & { el: TextEl }) {
  const t = el.props;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!editing || !d) return;
    d.focus();
    const r = document.createRange();
    r.selectNodeContents(d);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(r);
  }, [editing]);
  return (
    <div
      ref={ref}
      className="sl-text"
      contentEditable={editing ? 'true' : undefined}
      suppressContentEditableWarning
      onBlur={editing ? (e) => onTextCommit?.(el.id, e.currentTarget.innerText.replace(/\n$/, '')) : undefined}
      onKeyDown={editing ? (e) => (e.stopPropagation(), e.key === 'Escape' && e.currentTarget.blur()) : undefined}
      style={{ fontFamily: t.font, fontWeight: t.weight, fontSize: t.size, lineHeight: t.line, color: cssColor(t.color), textAlign: TEXT_ALIGN[t.align] }}
    >
      {t.text}
    </div>
  );
}

function ImageBody({ el, mode }: { el: ImageEl; mode: SlideMode }) {
  const { url, error } = useMediaUrl(el.props.media);
  if (!url) return mode === 'play' ? null : <div className="sl-placeholder">{el.props.media ? (error ?? '…') : 'اختر صورة'}</div>;
  return <img className="sl-img" src={url} alt="" draggable={false} decoding="async" style={{ objectFit: el.props.fit, borderRadius: el.props.radius }} />;
}

const stop = (e: React.SyntheticEvent) => e.stopPropagation();

function VideoBody({ el, mode, active, visible, onSkip }: ElProps & { el: VideoEl }) {
  const { url, error } = useMediaUrl(el.props.media);
  const ref = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  const [forcedMute, setForcedMute] = useState(false);
  const playing = mode === 'play' && active && visible;
  useEffect(() => {
    const v = ref.current;
    if (!v || !url) return;
    v.muted = el.props.muted || mode !== 'play';
    if (!playing) return v.pause();
    v.play().catch((e: Error) => {
      // المتصفح منع التشغيل بالصوت قبل أي نقرة: نشغّل بلا صوت ونعرض زر الصوت
      if (e.name === 'NotAllowedError' && !v.muted) {
        v.muted = true;
        setForcedMute(true);
        v.play().catch(() => undefined);
      }
    });
  }, [playing, url, el.props.muted, mode]);
  if (!url || failed) return mode === 'play' ? null : <div className="sl-placeholder">{el.props.media ? (error ?? (failed ? 'تعذّر تشغيل الفيديو' : '…')) : 'اختر فيديو'}</div>;
  return (
    <>
      <video
        ref={ref}
        src={url}
        className="sl-img"
        style={{ objectFit: el.props.fit, borderRadius: el.props.radius }}
        playsInline
        preload={mode === 'play' ? 'auto' : 'metadata'}
        onEnded={() => playing && el.props.autoAdvance && onSkip?.()}
        onError={() => setFailed(true)}
      />
      {playing && (forcedMute || el.props.showSkip) && (
        <VideoChrome el={el} forcedMute={forcedMute} showSkip={el.props.showSkip} onUnmute={() => { if (ref.current) ref.current.muted = false; setForcedMute(false); }} onSkip={onSkip} />
      )}
    </>
  );
}

/** أزرار المقدّم في زاوية اللوحة اليسرى السفلى مهما كان موضع الفيديو (الإحداثيات نسبةً للعنصر) */
function VideoChrome({ el, forcedMute, showSkip, onUnmute, onSkip }: { el: VideoEl; forcedMute: boolean; showSkip: boolean; onUnmute: () => void; onSkip?: () => void }) {
  return (
    <div className="sl-chrome show-chrome" style={{ left: 96 - el.x, top: CANVAS.h - 150 - el.y, bottom: 'auto' }} onPointerDown={stop} onPointerUp={stop}>
      {forcedMute && (
        <button className="show-glass" onClick={onUnmute}>
          <Volume2 className="h-[1.1em] w-[1.1em]" /> تشغيل الصوت
        </button>
      )}
      {showSkip && (
        <button className="show-glass" onClick={onSkip}>
          تخطٍّ <ChevronsLeft className="h-[1.1em] w-[1.1em]" />
        </button>
      )}
    </div>
  );
}

/** شبكة الشعارات بتنسيق تلقائي: أكبر بطاقات تتسع معها كل الفئات في صندوق العنصر، وتدخل البطاقات تباعاً */
function LogoGridBody({ el, mode, anim }: { el: LogoGridEl; mode: SlideMode; anim: boolean }) {
  const tiers = el.props.tiers;
  if (!tiers.some((t) => t.logos.length)) return mode === 'play' ? null : <div className="sl-placeholder">أضف شعارات الشركاء من لوحة الخصائص</div>;
  const g = fitLogoGrid(tiers.map((t) => ({ size: t.size, count: t.logos.length, hasTitle: !!t.title })), el.w, el.h);
  let n = 0;
  return (
    <div className="sl-grid" style={{ gap: g.tierGap }}>
      {tiers.map((t, i) =>
        t.logos.length ? (
          <div key={i} className="sl-tier" style={{ gap: g.gap }}>
            {t.title && <div className="sl-tier-title" style={{ color: cssColor(el.props.titleColor), fontSize: g.titleSize }}>{t.title}</div>}
            <div className="sl-tier-logos" style={{ gap: g.gap, maxWidth: g.tiers[i].perRow * (g.tiers[i].cardW + g.gap) - g.gap }}>
              {t.logos.map((m, k) => (
                <div
                  key={k}
                  className={`sl-logo-card ${anim ? 'sl-anim sl-a-up' : ''}`}
                  style={{ height: g.tiers[i].cardH, width: g.tiers[i].cardW, ['--d' as string]: '700ms', ['--dl' as string]: `${el.anim.delay + 120 * n++}ms` } as CSSProperties}
                >
                  <GridLogo media={m} />
                </div>
              ))}
            </div>
          </div>
        ) : null,
      )}
    </div>
  );
}

function GridLogo({ media }: { media: LogoGridEl['props']['tiers'][number]['logos'][number] }) {
  const { url } = useMediaUrl(media);
  return url ? <img src={url} alt="" draggable={false} /> : null;
}

function CounterBody({ el, mode, active }: { el: CounterEl; mode: SlideMode; active: boolean }) {
  const c = el.props;
  const [value, setValue] = useState(mode === 'play' ? c.from : c.to);
  useEffect(() => {
    if (mode !== 'play') return setValue(c.to);
    if (!active) return setValue(c.from);
    let raf = 0;
    const start = performance.now() + el.anim.delay;
    const tick = (t: number) => {
      const k = Math.min(1, Math.max(0, (t - start) / Math.max(1, c.duration)));
      const e = 1 - Math.pow(1 - k, 3);
      setValue(c.from + (c.to - c.from) * e);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    // احتياط إن توقفت الإطارات (نافذة في الخلفية): القيمة النهائية بعد المدة
    const done = setTimeout(() => setValue(c.to), el.anim.delay + c.duration + 100);
    return () => (cancelAnimationFrame(raf), clearTimeout(done));
  }, [mode, active, c.from, c.to, c.duration, el.anim.delay]);
  return (
    <div className="sl-text num" style={{ display: 'grid', placeItems: 'center', fontFamily: c.font, fontWeight: c.weight, fontSize: c.size, lineHeight: 1, color: cssColor(c.color) }}>
      <span dir="ltr">{c.prefix}{Math.round(value).toLocaleString('en-US')}{c.suffix}</span>
    </div>
  );
}

function NamesBody({ el, step, mode, anim }: { el: NamesEl; step: number; mode: SlideMode; anim: boolean }) {
  const n = el.props;
  const batch = Math.max(0, Math.min(nameBatches(n) - 1, step - el.step));
  if (!n.names.length) return mode === 'play' ? null : <div className="sl-placeholder">أضف الأسماء</div>;
  const from = batch * n.perStep;
  const list = n.names.slice(from, from + n.perStep);
  const last = Math.min(n.names.length, from + n.perStep);
  const size = list.length > 1 ? n.size * 0.62 : n.size;
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div key={batch} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
        {list.map((name, i) => (
          <div
            key={name + i}
            className={anim ? 'sl-anim sl-a-scale' : undefined}
            style={{ ['--d' as string]: '1300ms', ['--dl' as string]: `${i * 260}ms`, fontFamily: n.font, fontWeight: n.weight, fontSize: size, lineHeight: 1.15, color: cssColor(n.color), textAlign: 'center', textWrap: 'balance' } as CSSProperties}
          >
            {name}
          </div>
        ))}
      </div>
      {n.counter && (
        <div className="num" style={{ fontSize: 'calc(var(--b-fs-caption) * 1px)', fontWeight: 500, color: cssColor('fg', 0.72) }}>
          <span style={{ color: cssColor('em'), fontWeight: 700 }}>{last}</span> / {n.names.length}
        </div>
      )}
    </div>
  );
}
