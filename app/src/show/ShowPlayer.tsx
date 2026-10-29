// شاشة العرض (#/show): ملء الشاشة، كليكر وأسهم ولمس، انتقالات ناعمة، تحميل مسبق، وتزامن مع شاشة التحكم.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Maximize } from 'lucide-react';
import type { Segment, ShowConfig } from './model';
import { preload } from './media';
import { clampPos, followSegment, next, prev, skipSegment, sortSegments, stepCount, type Pos } from './nav';
import { keyAction, touchAction } from './keys';
import { SegmentView } from './segments';
import { useShowConfig, useSync } from './useShow';
import './show.css';

const FADE_MS = 700;

function preloadAround(cfg: ShowConfig, pos: Pos) {
  const list = sortSegments(cfg.segments);
  const warm = (s: Segment | undefined, from: number) => {
    if (s?.type === 'video' && s.settings.media) preload(s.settings.media, 'video').catch(() => undefined);
    if (s?.type === 'slides') s.settings.slides.slice(from, from + 2).forEach((m) => preload(m, 'image').catch(() => undefined));
  };
  warm(list[pos.seg], pos.step + 1);
  warm(list[pos.seg + 1], 0);
}

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
  else document.documentElement.requestFullscreen?.().catch(() => undefined);
}

export default function ShowPlayer() {
  const sync = useSync();
  const [cfg, setCfg] = useShowConfig(sync);
  const [pos, setPos] = useState<Pos>({ seg: 0, step: 0 });
  const [started, setStarted] = useState(false);
  const [blackout, setBlackout] = useState(false);
  const [idle, setIdle] = useState(false);
  // الطبقات: الفقرة الحالية فوق، والسابقة تحتها حتى يكتمل الظهور التدريجي
  const [layers, setLayers] = useState<{ id: string; step: number; leaving: boolean }[]>([]);

  const ref = useRef({ cfg, pos, started });
  ref.current = { cfg, pos, started };

  const list = cfg ? sortSegments(cfg.segments) : [];
  const current = list[pos.seg];

  const go = useCallback((fn: (c: ShowConfig, p: Pos) => Pos) => {
    const { cfg } = ref.current;
    if (!cfg) return;
    setStarted(true);
    setBlackout(false);
    setPos((p) => fn(cfg, p));
  }, []);

  // تعديل الإعدادات من شاشة التحكم: يبقى العرض على نفس الفقرة
  const prevCfg = useRef<ShowConfig | null>(null);
  useEffect(() => {
    if (cfg && prevCfg.current && prevCfg.current !== cfg) setPos((p) => followSegment(prevCfg.current!, cfg, p));
    prevCfg.current = cfg;
  }, [cfg]);

  useEffect(() => {
    if (cfg) preloadAround(cfg, pos);
    sync.send({ type: 'state', pos, started });
  }, [cfg, pos, started, sync]);

  useEffect(
    () =>
      sync.subscribe((m) => {
        if (m.type === 'hello') sync.send({ type: 'state', pos: ref.current.pos, started: ref.current.started });
        if (m.type === 'goto') go((c) => clampPos(c, m.pos));
        if (m.type === 'nav') go(m.dir === 'next' ? next : prev);
      }),
    [sync, go],
  );

  // الانتقال بين الفقرات
  useEffect(() => {
    if (!current) return;
    setLayers((ls) => {
      const top = ls[ls.length - 1];
      if (top?.id === current.id) return ls.map((l) => (l.id === current.id ? { ...l, step: pos.step } : l));
      return [...ls.filter((l) => l.id !== current.id).map((l) => ({ ...l, leaving: true })), { id: current.id, step: pos.step, leaving: false }];
    });
    const t = setTimeout(() => setLayers((ls) => ls.filter((l) => !l.leaving)), FADE_MS + 50);
    return () => clearTimeout(t);
  }, [current?.id, pos.step]);

  // المفاتيح
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const a = keyAction(e);
      if (!a) return;
      e.preventDefault();
      if (a === 'next') go(next);
      else if (a === 'prev') go(prev);
      else if (a === 'first') go(() => ({ seg: 0, step: 0 }));
      else if (a === 'last') go((c) => ({ seg: c.segments.length - 1, step: 0 }));
      else if (a === 'fullscreen') toggleFullscreen();
      else if (a === 'blackout') setBlackout((b) => !b);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  // إخفاء المؤشر بعد ثانيتين بلا حركة
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const wake = () => {
      setIdle(false);
      clearTimeout(t);
      t = setTimeout(() => setIdle(true), 2000);
    };
    wake();
    window.addEventListener('pointermove', wake);
    return () => (clearTimeout(t), window.removeEventListener('pointermove', wake));
  }, []);

  // اللمس: سحب أو نقرة على نصف الشاشة
  const touch = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch') touch.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const t = touch.current;
    touch.current = null;
    if (!t || !started) return;
    const a = touchAction(e.clientX - t.x, e.clientY - t.y, e.clientX, window.innerWidth);
    if (a) go(a === 'next' ? next : prev);
  };

  const skip = useCallback(() => go(skipSegment), [go]);

  if (!cfg) return <div className="show-stage" />;

  return (
    <div className={`show-stage ${idle && started ? 'hide-cursor' : ''}`} onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
      {layers.map((l) => {
        const seg = list.find((s) => s.id === l.id);
        if (!seg) return null;
        return (
          <div key={l.id} className="show-layer" style={l.leaving ? undefined : { animation: `show-fade ${FADE_MS}ms ease both` }}>
            <SegmentView seg={seg} step={Math.min(l.step, stepCount(seg) - 1)} active={started && !l.leaving} onSkip={skip} />
          </div>
        );
      })}
      {!list.length && <div className="show-dark absolute inset-0" />}

      <div className="show-layer bg-black" style={{ opacity: blackout ? 1 : 0, pointerEvents: blackout ? 'auto' : 'none' }} />

      {!started && (
        <div className="absolute inset-0 grid place-items-center bg-black/70 text-center backdrop-blur-sm" onPointerUp={(e) => e.stopPropagation()}>
          <div>
            <p className="text-3xl font-semibold">{cfg.title}</p>
            <p className="mt-2 text-sm text-white/60">{list.length} فقرات</p>
            <button
              autoFocus
              className="mt-8 rounded-full bg-brand-600 px-10 py-4 text-lg font-medium text-white shadow-lg transition hover:bg-brand-500"
              onClick={() => {
                setStarted(true);
                if (!document.fullscreenElement) toggleFullscreen();
              }}
            >
              ابدأ العرض
            </button>
            <p className="mt-6 text-xs leading-loose text-white/50">
              التالي: → أو PageDown أو المسافة · السابق: ← أو PageUp
              <br />
              F ملء الشاشة · B شاشة سوداء · باللمس: اسحب يميناً أو انقر يسار الشاشة للتالي
            </p>
          </div>
        </div>
      )}

      {started && (
        <button className="show-chrome absolute right-4 top-4 rounded-full bg-white/10 p-2.5 text-white/70 backdrop-blur hover:bg-white/20" title="ملء الشاشة (F)" onPointerUp={(e) => e.stopPropagation()} onClick={toggleFullscreen}>
          <Maximize className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
