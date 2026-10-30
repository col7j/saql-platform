// عرض كل نوع فقرة بأسلوب المؤتمرات. كل مكوّن يأخذ الخطوة الحالية فقط، والتنقل نفسه في nav.ts.
import { lazy, Suspense, useEffect, useRef, useState, type CSSProperties } from 'react';
import { ChevronsLeft, Volume2 } from 'lucide-react';
import type { BlankSegment, NamesSegment, Segment, SlidesSegment, VideoSegment } from '../model';
import { Backdrop, Fallback, LOGO_ONDARK, SegmentBoundary } from './Fallback';
import { useMediaUrl } from './useMedia';

const DemoView = lazy(() => import('../demo/DemoView'));

export interface SegProps<S extends Segment = Segment> {
  seg: S;
  step: number;
  /** الفقرة المعروضة الآن (لا الخارجة في الانتقال أو المعاينة المتوقفة) */
  active: boolean;
  onSkip: () => void;
}

/** الفقرات التي يكون الشعار فيها هو العنصر الرئيسي أو الشاشة سوداء: لا يظهر شعار الزاوية */
export const hidesCornerMark = (seg?: Segment) => seg?.type === 'blank';

const order = (i: number) => ({ ['--i' as string]: i }) as CSSProperties;

export function SegmentView(p: SegProps) {
  return (
    <SegmentBoundary key={p.seg.id} title={p.seg.title}>
      <Inner {...p} />
    </SegmentBoundary>
  );
}

function Inner(p: SegProps) {
  switch (p.seg.type) {
    case 'video': return <VideoView {...(p as SegProps<VideoSegment>)} />;
    case 'slides': return <SlidesView {...(p as SegProps<SlidesSegment>)} />;
    case 'names': return <NamesView {...(p as SegProps<NamesSegment>)} />;
    case 'blank': return <BlankView {...(p as SegProps<BlankSegment>)} />;
    case 'demo':
      return (
        <Suspense fallback={<Backdrop />}>
          <DemoView seg={p.seg} step={p.step} active={p.active} />
        </Suspense>
      );
  }
}

const stop = (e: React.SyntheticEvent) => e.stopPropagation();

function VideoView({ seg, active, onSkip }: SegProps<VideoSegment>) {
  const { url, error } = useMediaUrl(seg.settings.media);
  const ref = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState<string>();
  const [forcedMute, setForcedMute] = useState(false);

  useEffect(() => {
    const v = ref.current;
    if (!v || !url) return;
    v.muted = seg.settings.muted;
    if (!active) return v.pause();
    v.play().catch((e: Error) => {
      // المتصفح منع التشغيل بالصوت قبل أي نقرة: نشغّل بلا صوت ونعرض زر الصوت
      if (e.name === 'NotAllowedError' && !v.muted) {
        v.muted = true;
        setForcedMute(true);
        v.play().catch(() => undefined);
      }
    });
  }, [active, url, seg.settings.muted]);

  if (error || failed) return <Fallback title={seg.title} reason={error ?? failed} />;
  return (
    <Backdrop>
      <div className="show-center">
        {url && (
          <video
            ref={ref}
            src={url}
            className="show-media show-fade h-auto w-auto"
            playsInline
            preload="auto"
            onEnded={() => active && seg.settings.autoAdvance && onSkip()}
            onError={() => setFailed('تعذّر تشغيل ملف الفيديو')}
          />
        )}
      </div>
      <div className="show-chrome absolute bottom-[4.5vh] left-[3.2vw] z-20 flex gap-3" onPointerDown={stop} onPointerUp={stop}>
        {forcedMute && (
          <button className="show-glass" onClick={() => { if (ref.current) ref.current.muted = false; setForcedMute(false); }}>
            <Volume2 className="h-[1.1em] w-[1.1em]" /> تشغيل الصوت
          </button>
        )}
        {seg.settings.showSkip && (
          <button className="show-glass" onClick={onSkip}>
            تخطٍّ <ChevronsLeft className="h-[1.1em] w-[1.1em]" />
          </button>
        )}
      </div>
    </Backdrop>
  );
}

function Slide({ src, fit, visible, title }: { src: SlidesSegment['settings']['slides'][number]; fit: string; visible: boolean; title: string }) {
  const { url, error } = useMediaUrl(src);
  const [failed, setFailed] = useState(false);
  if (error || failed) return visible ? <Fallback title={title} reason={error ?? 'تعذّر تحميل الشريحة'} /> : null;
  if (!url) return null;
  // «تملأ الشاشة» حتى الحواف، و«كاملة» على نفس الخلفية الداكنة بلا حواف بيضاء
  return (
    <div className="show-slide" style={{ opacity: visible ? 1 : 0, transform: visible ? 'none' : 'scale(.985)' }}>
      {fit === 'cover' ? (
        <img src={url} alt="" draggable={false} decoding="async" onError={() => setFailed(true)} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <img src={url} alt="" draggable={false} decoding="async" onError={() => setFailed(true)} className="show-media h-auto w-auto" />
      )}
    </div>
  );
}

function SlidesView({ seg, step }: SegProps<SlidesSegment>) {
  const { slides, fit } = seg.settings;
  if (!slides.length) return <Fallback title={seg.title} reason="لا توجد شرائح في هذه الفقرة" />;
  // الشريحة الحالية وجارتاها فقط في الصفحة: انتقال ناعم بلا تحميل كل الملفات في الذاكرة
  return (
    <Backdrop glow={fit !== 'cover'}>
      {slides.map((s, i) => (Math.abs(i - step) <= 1 ? <Slide key={i} src={s} fit={fit} visible={i === step} title={seg.title} /> : null))}
    </Backdrop>
  );
}

/** الأسماء: شاشة العنوان أولاً، ثم اسم ضخم واحد في المنتصف (أو دفعة صغيرة) مع عدّاد */
function NamesView({ seg, step }: SegProps<NamesSegment>) {
  const { names, perStep, heading } = seg.settings;
  const title = heading || seg.title;
  if (step === 0 || !names.length) {
    return (
      <Backdrop>
        <div className="show-center">
          <div className="flex flex-col items-center gap-[4vh]">
            <h1 className="show-title show-in" style={order(0)}>{title}</h1>
            <div className="show-rule show-in" style={order(1)} />
            {names.length > 0 && <p className="show-kicker show-in" style={order(2)}>{names.length} {names.length > 10 ? 'اسماً' : 'أسماء'}</p>}
          </div>
        </div>
      </Backdrop>
    );
  }
  const from = (step - 1) * perStep;
  const batch = names.slice(from, from + perStep);
  const last = Math.min(names.length, from + perStep);
  return (
    <Backdrop>
      <p className="show-kicker show-fade absolute left-0 right-0 top-[6vh] text-center">{title}</p>
      <div className="show-center">
        <div key={step} className="flex flex-col items-center gap-[3vh]">
          {batch.map((n, i) => (
            <div key={n + i} className="show-display show-reveal" style={{ animationDelay: `${i * 260}ms`, fontSize: batch.length > 1 ? 'clamp(48px, min(5vw, 9vh), 96px)' : undefined }}>
              {n}
            </div>
          ))}
        </div>
      </div>
      {/* العدّاد: الرقم الحالي وحده بلون التوكيد */}
      <p className="show-kicker absolute bottom-[5vh] left-0 right-0 text-center num">
        <span className="show-em font-bold">{last}</span> / {names.length}
      </p>
    </Backdrop>
  );
}

function BlankView({ seg }: SegProps<BlankSegment>) {
  if (seg.settings.variant === 'black') return <div className="absolute inset-0 bg-black" />;
  return (
    <Backdrop>
      <div className="show-center">
        <div className="flex flex-col items-center">
          <img src={LOGO_ONDARK} alt="صقل" className="show-in h-[38vh] w-auto" style={order(0)} draggable={false} />
          {seg.settings.caption && <p className="show-title show-in mt-[5vh]" style={{ ...order(1), fontSize: 'clamp(40px, min(4.4vw, 8vh), 96px)' }}>{seg.settings.caption}</p>}
        </div>
      </div>
    </Backdrop>
  );
}
