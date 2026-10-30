// شاشة العرض (#/show): ملء الشاشة، كليكر وأسهم ولمس، انتقالات ناعمة، تحميل مسبق، وتزامن مع شاشة التحكم.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Maximize } from 'lucide-react';
import { sceneStart, type Segment, type ShowConfig } from './model';
import { preload } from './media';
import { clampPos, followSegment, next, prev, skipSegment, sortSegments, stepCount, type Pos } from './nav';
import { keyAction, sceneKey, touchAction } from './keys';
import { SegmentView, hidesCornerMark } from './segments';
import { Backdrop, LOGO_MARK, LOGO_ONDARK } from './segments/Fallback';
import { useShowConfig, useSync } from './useShow';
import './show.css';

const FADE_MS = 900;

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
    const before = prevCfg.current;
    prevCfg.current = cfg;
    if (cfg && before && before !== cfg) setPos((p) => followSegment(before, cfg, p));
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
      // الأرقام 1–4 تقفز إلى أول مشهد في الديمو المعروض
      const n = sceneKey(e);
      if (n !== null && ref.current.started) {
        const { cfg, pos } = ref.current;
        const seg = cfg ? sortSegments(cfg.segments)[pos.seg] : undefined;
        const step = seg?.type === 'demo' ? sceneStart(seg.settings, n) : null;
        if (step !== null) {
          e.preventDefault();
          go((_, p) => ({ seg: p.seg, step }));
        }
        return;
      }
      const a = keyAction(e);
      if (!a) return;
      e.preventDefault();
      // أول ضغطة على شاشة البداية تبدأ العرض فقط ولا تتخطى الفقرة الأولى
      if (!ref.current.started && a !== 'fullscreen') {
        if (a === 'next') setStarted(true);
        return;
      }
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
          <div key={l.id} className={`show-layer ${l.leaving ? 'leaving' : 'entering'}`}>
            <SegmentView seg={seg} step={Math.min(l.step, stepCount(seg) - 1)} active={started && !l.leaving} onSkip={skip} />
          </div>
        );
      })}
      {!list.length && <Backdrop />}

      {/* شعار الزاوية: حجم وموقع ثابتان، ويغيب حين يكون الشعار نفسه هو الشاشة */}
      <div className="show-mark" style={{ opacity: started && !hidesCornerMark(current) && !blackout ? 1 : 0 }}>
        <img src={LOGO_MARK} alt="" draggable={false} />
      </div>

      <div className="show-off z-40" style={{ opacity: blackout ? 1 : 0, pointerEvents: blackout ? 'auto' : 'none', transition: 'opacity 500ms ease' }} />

      {!started && (
        <div className="absolute inset-0 z-50" onPointerUp={(e) => e.stopPropagation()}>
          <Backdrop>
            <div className="show-center">
              <div className="flex flex-col items-center">
                <img src={LOGO_ONDARK} alt="صقل" className="show-in show-logo-start" style={{ ['--i' as string]: 0 }} draggable={false} />
                <h1 className="show-subtitle show-in mt-[4vh]" style={{ ['--i' as string]: 1 }}>{cfg.title}</h1>
                <button
                  autoFocus
                  className="show-in show-cta mt-[5vh]"
                  style={{ ['--i' as string]: 2 }}
                  onClick={() => {
                    setStarted(true);
                    if (!document.fullscreenElement) toggleFullscreen();
                  }}
                >
                  ابدأ العرض
                </button>
                <p className="show-in show-help mt-[4vh]" style={{ ['--i' as string]: 3 }}>
                  {list.length} فقرات · التالي: → أو PageDown أو المسافة · السابق: ← أو PageUp
                  <br />
                  F ملء الشاشة · B شاشة سوداء · 1–4 مشاهد الديمو · باللمس: اسحب يميناً أو انقر يسار الشاشة للتالي
                </p>
              </div>
            </div>
          </Backdrop>
        </div>
      )}

      {started && (
        <button className="show-chrome show-glass absolute end-[3.2vw] top-[4.2vh] z-30 !p-[.7em]" title="ملء الشاشة (F)" onPointerUp={(e) => e.stopPropagation()} onClick={toggleFullscreen}>
          <Maximize className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
