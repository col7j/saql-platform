// عرض كل نوع فقرة. كل مكوّن يأخذ الخطوة الحالية فقط، والتنقل نفسه في nav.ts.
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { ChevronsLeft, Volume2 } from 'lucide-react';
import type { BlankSegment, NamesSegment, Segment, SlidesSegment, VideoSegment } from '../model';
import { Fallback, SegmentBoundary } from './Fallback';
import { useMediaUrl } from './useMedia';

const DemoView = lazy(() => import('../demo/DemoView'));

export interface SegProps<S extends Segment = Segment> {
  seg: S;
  step: number;
  /** الفقرة المعروضة الآن (لا الخارجة في الانتقال أو المعاينة المتوقفة) */
  active: boolean;
  onSkip: () => void;
}

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
        <Suspense fallback={<div className="show-dark absolute inset-0" />}>
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
    <div className="absolute inset-0 bg-black">
      {url && (
        <video
          ref={ref}
          src={url}
          className="h-full w-full object-contain"
          playsInline
          preload="auto"
          onEnded={() => active && seg.settings.autoAdvance && onSkip()}
          onError={() => setFailed('تعذّر تشغيل ملف الفيديو')}
        />
      )}
      <div className="show-chrome absolute bottom-6 left-6 flex gap-2" onPointerDown={stop} onPointerUp={stop}>
        {forcedMute && (
          <button className="rounded-full bg-white/15 px-4 py-2 text-sm backdrop-blur hover:bg-white/25" onClick={() => { if (ref.current) ref.current.muted = false; setForcedMute(false); }}>
            <Volume2 className="inline h-4 w-4" /> تشغيل الصوت
          </button>
        )}
        {seg.settings.showSkip && (
          <button className="rounded-full bg-white/15 px-4 py-2 text-sm backdrop-blur hover:bg-white/25" onClick={onSkip}>
            تخطٍّ <ChevronsLeft className="inline h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function Slide({ src, fit, visible }: { src: SlidesSegment['settings']['slides'][number]; fit: string; visible: boolean }) {
  const { url, error } = useMediaUrl(src);
  const [failed, setFailed] = useState(false);
  if (error || failed) return visible ? <Fallback reason={error ?? 'تعذّر تحميل الشريحة'} /> : null;
  return url ? (
    <img src={url} alt="" draggable={false} decoding="async" onError={() => setFailed(true)} className="show-slide" style={{ objectFit: fit as 'contain', opacity: visible ? 1 : 0 }} />
  ) : null;
}

function SlidesView({ seg, step }: SegProps<SlidesSegment>) {
  const { slides, fit } = seg.settings;
  if (!slides.length) return <Fallback title={seg.title} reason="لا توجد شرائح في هذه الفقرة" />;
  // الشريحة الحالية وجارتاها فقط في الصفحة: انتقال ناعم بلا تحميل كل الملفات في الذاكرة
  return (
    <div className="absolute inset-0 bg-black">
      {slides.map((s, i) => (Math.abs(i - step) <= 1 ? <Slide key={i} src={s} fit={fit} visible={i === step} /> : null))}
    </div>
  );
}

function NamesView({ seg, step }: SegProps<NamesSegment>) {
  const { names, perStep, columns, heading } = seg.settings;
  const shown = Math.min(names.length, step * perStep);
  const latest = Math.max(0, shown - perStep);
  const cols = Math.min(columns, Math.max(1, names.length));
  const rows = Math.max(1, Math.ceil(names.length / cols));
  // حجم الخط يتناسب مع عدد الصفوف والأعمدة ليتسع الكل في الشاشة دون تمرير
  const size = `min(${(6.4 / cols).toFixed(2)}vw, ${(62 / rows).toFixed(2)}vh, 72px)`;
  return (
    <div className="show-dark absolute inset-0 flex flex-col items-center px-[6vw] py-[6vh]">
      <h1 className="show-rise text-center font-semibold leading-tight text-white" style={{ fontSize: 'min(4.4vw, 9vh)' }}>
        {heading || seg.title}
      </h1>
      <div className="mt-[1.5vh] h-[3px] w-[10vw] rounded-full bg-accent-400" />
      <ol className="mt-[5vh] grid w-full flex-1 content-center gap-x-[4vw] gap-y-[1.6vh]" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {names.map((n, i) => (
          <li
            key={i}
            className={i < shown ? 'show-rise text-center font-medium' : 'invisible text-center'}
            style={{ fontSize: size, lineHeight: 1.35, color: i >= latest && i < shown ? 'rgb(var(--c-accent-300))' : 'white', transition: 'color 1.2s ease' }}
          >
            {n}
          </li>
        ))}
      </ol>
    </div>
  );
}

function BlankView({ seg }: SegProps<BlankSegment>) {
  if (seg.settings.variant === 'black') return <div className="absolute inset-0 bg-black" />;
  return (
    <div className="show-dark absolute inset-0 grid place-items-center text-center">
      <div className="show-rise">
        <img src="./brand/logo-vertical.svg" alt="صقل" className="mx-auto h-[36vh] w-auto" draggable={false} />
        {seg.settings.caption && <p className="mt-[5vh] font-semibold text-white" style={{ fontSize: 'min(3.6vw, 7vh)' }}>{seg.settings.caption}</p>}
      </div>
    </div>
  );
}
