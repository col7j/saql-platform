// شاشة العرض (#/show): ملء الشاشة، كليكر وأسهم ولمس، انتقالات ناعمة، تحميل مسبق، وتزامن مع شاشة التحكم.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Maximize } from 'lucide-react';
import { sceneStart, type Segment, type ShowConfig } from './model';
import { preload } from './media';
import { clampPos, followSegment, next, prev, skipSegment, sortSegments, stepCount, type Pos } from './nav';
import { keyAction, sceneKey, touchAction } from './keys';
import type { DemoNav } from './demo/DemoView';
import { useRemoteDisplay } from './remote/display';
import { combineSync, type Cue, type LiveInfo, type ShowMessage } from './sync';
import { agenda, agendaIndex, agendaKey, emptyTiming, spentOf, tick, whoHint, whoReveal, whoSkip, type Timing } from './ceremony/logic';
import { stepSub } from './stepLabel';

const TIMING_KEY = 'show-timing';
const loadTiming = (): Timing => {
  try {
    const v = JSON.parse(localStorage.getItem(TIMING_KEY) ?? 'null');
    return v && typeof v.spent === 'object' ? v : emptyTiming();
  } catch {
    return emptyTiming();
  }
};
const saveTiming = (t: Timing) => {
  try {
    localStorage.setItem(TIMING_KEY, JSON.stringify(t));
  } catch {
    /* في الذاكرة فقط */
  }
};


import { SegmentView, hidesCornerMark } from './segments';
import { Backdrop, heroLogo, markLogo } from './segments/Fallback';
import { useShowConfig, useSync } from './useShow';
import './show.css';

const FADE_MS = 900;

function preloadAround(cfg: ShowConfig, pos: Pos) {
  const list = sortSegments(cfg.segments);
  // وسائط الشريحة الحالية والتالية: صور وفيديو وشعارات الشركاء
  const warm = (s: Segment | undefined) => {
    if (s?.type !== 'slide') return;
    if (s.settings.bg.kind === 'media' && s.settings.bg.media) preload(s.settings.bg.media, 'image').catch(() => undefined);
    for (const el of s.settings.elements) {
      if (el.type === 'image' && el.props.media) preload(el.props.media, 'image').catch(() => undefined);
      if (el.type === 'video' && el.props.media) preload(el.props.media, 'video').catch(() => undefined);
      if (el.type === 'logoGrid') el.props.tiers.forEach((t) => t.logos.forEach((m) => preload(m, 'image').catch(() => undefined)));
    }
  };
  warm(list[pos.seg]);
  warm(list[pos.seg + 1]);
}

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
  else document.documentElement.requestFullscreen?.().catch(() => undefined);
}

export default function ShowPlayer() {
  const local = useSync();
  const [cfg, setCfg] = useShowConfig(local);
  // التحكم من الجوال (Firebase) قناة ثانية تُضم للمحلية؛ بلا إعداد أو بلا إنترنت تبقى المحلية وحدها
  const remote = useRemoteDisplay();
  const sync = useMemo(() => (remote.sync ? combineSync(local, remote.sync) : local), [local, remote.sync]);
  const [pos, setPos] = useState<Pos>({ seg: 0, step: 0 });
  const [started, setStarted] = useState(false);
  const [blackout, setBlackout] = useState(false);
  // جولة الديمو: موقوفة أم تعمل، ومعالج التقدّم اليدوي داخل صفحتها
  const [paused, setPaused] = useState(false);
  const tourNav = useRef<DemoNav | null>(null);
  const registerNav = useCallback((fn: DemoNav | null) => void (tourNav.current = fn), []);
  const [idle, setIdle] = useState(false);
  // الطبقات: الفقرة الحالية فوق، والسابقة تحتها حتى يكتمل الظهور التدريجي
  const [layers, setLayers] = useState<{ id: string; step: number; leaving: boolean }[]>([]);

  const [photoRun, setPhotoRun] = useState(0);
  const [video, setVideo] = useState<LiveInfo['video']>();
  const [timing, setTiming] = useState<Timing>(loadTiming);
  const [clockOn, setClockOn] = useState(true);

  const ref = useRef({ cfg, pos, started, paused, blackout, remote: remote.info, video, timing, clockOn });
  ref.current = { cfg, pos, started, paused, blackout, remote: remote.info, video, timing, clockOn };

  const list = cfg ? sortSegments(cfg.segments) : [];
  const current = list[pos.seg];

  const go = useCallback((fn: (c: ShowConfig, p: Pos) => Pos) => {
    const { cfg } = ref.current;
    if (!cfg) return;
    setStarted(true);
    setBlackout(false);
    setPos((p) => fn(cfg, p));
  }, []);

  /** التالي والسابق: جولة الديمو تتولى بطاقات صفحتها أولاً، وعند حدودها ننتقل */
  const nav = useCallback(
    (dir: 'next' | 'prev') => {
      if (ref.current.started && tourNav.current?.(dir)) return;
      go(dir === 'next' ? next : prev);
    },
    [go],
  );

  /** أوامر فقرات الحفل (من المفاتيح أو المحرّر أو الجوال) */
  const cue = useCallback(
    (c: Cue) => {
      const { cfg, pos } = ref.current;
      if (!cfg) return;
      const l = sortSegments(cfg.segments);
      const seg = l[pos.seg];
      const to = (step: number | null) => step !== null && go((_, p) => ({ seg: p.seg, step }));
      switch (c) {
        case 'hint': if (seg?.type === 'whoami') to(whoHint(seg.settings, pos.step)); break;
        case 'reveal': if (seg?.type === 'whoami') to(whoReveal(seg.settings, pos.step)); break;
        case 'skip':
          if (seg?.type === 'whoami') {
            const n = whoSkip(seg.settings, pos.step);
            if (n !== null) to(n);
            else go(skipSegment);
          }
          break;
        case 'launch': {
          // من أي مكان: يقفز إلى التدشين ويبدأ التسلسل المحلي (الحركة، ثم «تم التدشين»، ثم الفيديو، ثم الديمو)
          const i = seg?.type === 'launch' ? pos.seg : l.findIndex((s) => s.type === 'launch');
          if (i >= 0 && !(seg?.type === 'launch' && pos.step > 0)) go(() => ({ seg: i, step: 1 }));
          break;
        }
        case 'photo': if (seg?.type === 'photo') setPhotoRun((r) => r + 1); break;
        case 'skipVideo': if (ref.current.video) go(skipSegment); break;
      }
    },
    [go],
  );

  // التدشين: بعد «تم التدشين» بالثواني المحددة تبدأ الفقرة التالية (الفيديو ثم الديمو) على هذا الجهاز بلا إنترنت
  useEffect(() => {
    if (!started || current?.type !== 'launch' || pos.step !== 2 || !current.settings.autoNext) return;
    const t = setTimeout(() => go(next), current.settings.autoNext * 1000);
    return () => clearTimeout(t);
  }, [started, current, pos.step, go]);

  // تقدّم الفيديو المعروض (للمحرّر والجوال)
  useEffect(() => {
    const t = setInterval(() => {
      const v = document.querySelector<HTMLVideoElement>('.show-layer.entering video');
      setVideo((old) => {
        const now = v && Number.isFinite(v.duration) && v.duration > 0 ? { t: Math.floor(v.currentTime), d: Math.round(v.duration) } : undefined;
        return old?.t === now?.t && old?.d === now?.d ? old : now;
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // ساعة الحفل: الزمن الفعلي لكل فقرة في الجدول، بعد «ابدأ العرض» وما دامت تعمل
  const items = useMemo(() => agenda(list), [cfg]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const key = started && clockOn && items.length ? agendaKey(items, agendaIndex(items, pos.seg)) : null;
    setTiming((t) => {
      const n = tick(t, key, Date.now());
      if (n !== t) saveTiming(n);
      return n;
    });
  }, [started, clockOn, pos.seg, items]);

  // كل فقرة ديمو تبدأ بحسب إعداد التشغيل التلقائي
  useEffect(() => {
    setPaused(current?.type === 'demo' ? !current.settings.autoplay : false);
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // تعديل الإعدادات من شاشة التحكم: يبقى العرض على نفس الفقرة
  const prevCfg = useRef<ShowConfig | null>(null);
  useEffect(() => {
    const before = prevCfg.current;
    prevCfg.current = cfg;
    if (cfg && before && before !== cfg) setPos((p) => followSegment(before, cfg, p));
  }, [cfg]);

  // الحالة لشاشة التحكم والجوال: الموضع، والجولة، والشاشة السوداء، وقائمة الفقرات، وحالة التحكم من الجوال
  const stateMsg = (): ShowMessage => {
    const { cfg, pos, started, paused, blackout } = ref.current;
    const l = cfg ? sortSegments(cfg.segments) : [];
    const items = agenda(l);
    const now = Date.now();
    const t = ref.current.timing;
    const live: LiveInfo = {
      sub: stepSub(l[pos.seg], pos.step),
      ...(ref.current.video ? { video: ref.current.video } : {}),
      agenda: items.map((a, i) => ({ title: a.title, minutes: a.minutes, spent: spentOf(t, agendaKey(items, i), now) })),
      agendaAt: agendaIndex(items, pos.seg),
      clock: { running: !!t.current, startedAt: t.startedAt, at: now },
      ...(l[pos.seg]?.type === 'launch' ? { launch: pos.step } : {}),
    };
    return { type: 'state', pos, started, paused, blackout, steps: l[pos.seg] ? stepCount(l[pos.seg]) : 1, outline: l.map((s) => ({ title: s.title, type: s.type })), remote: ref.current.remote, live };
  };
  useEffect(() => {
    if (cfg) preloadAround(cfg, pos);
    sync.send(stateMsg());
  }, [cfg, pos, started, paused, blackout, sync, remote.info, video, timing]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(
    () =>
      sync.subscribe((m) => {
        if (m.type === 'hello') sync.send(stateMsg());
        if (m.type === 'blackout') setBlackout((b) => !b);
        if (m.type === 'goto') go((c) => clampPos(c, m.pos));
        if (m.type === 'nav') nav(m.dir);
        if (m.type === 'tour') setPaused((p) => (m.action === 'toggle' ? !p : m.action === 'pause'));
        if (m.type === 'cue') cue(m.cue);
        if (m.type === 'timing') {
          if (m.action === 'toggle') setClockOn((v) => !v);
          else {
            const t = emptyTiming();
            saveTiming(t);
            setTiming(t);
          }
        }
      }),
    [sync, go, nav, cue],
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
      if (a === 'next') nav('next');
      else if (a === 'prev') nav('prev');
      else if (a === 'tour') setPaused((p) => !p);
      else if (a === 'first') go(() => ({ seg: 0, step: 0 }));
      else if (a === 'last') go((c) => ({ seg: c.segments.length - 1, step: 0 }));
      else if (a === 'fullscreen') toggleFullscreen();
      else if (a === 'blackout') setBlackout((b) => !b);
      else cue(a);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, nav, cue]);

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
    if (a) nav(a);
  };

  const skip = useCallback(() => go(skipSegment), [go]);

  if (!cfg) return <div className="show-stage" />;

  return (
    <div className={`show-stage ${idle && started ? 'hide-cursor' : ''}`} data-show-theme={cfg.theme} onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
      {layers.map((l) => {
        const seg = list.find((s) => s.id === l.id);
        if (!seg) return null;
        return (
          <div key={l.id} className={`show-layer ${l.leaving ? 'leaving' : 'entering'}`}>
            <SegmentView
              seg={seg}
              theme={cfg.theme}
              step={Math.min(l.step, stepCount(seg) - 1)}
              active={started && !l.leaving}
              animate={started}
              onSkip={skip}
              playing={!paused}
              onAdvance={() => go(next)}
              onEnd={() => setPaused(true)}
              registerNav={registerNav}
              photoRun={photoRun}
            />
          </div>
        );
      })}
      {!list.length && <Backdrop />}

      {/* شعار الزاوية: حجم وموقع ثابتان، ويغيب حين يكون الشعار نفسه هو الشاشة */}
      <div className="show-mark" style={{ opacity: started && !hidesCornerMark(current) && !blackout ? 1 : 0 }}>
        <img src={markLogo(cfg.theme)} alt="" draggable={false} />
      </div>

      <div className="show-off z-40" style={{ opacity: blackout ? 1 : 0, pointerEvents: blackout ? 'auto' : 'none', transition: 'opacity 500ms ease' }} />

      {!started && (
        <div className="absolute inset-0 z-50" onPointerUp={(e) => e.stopPropagation()}>
          <Backdrop>
            <div className="show-center">
              <div className="flex flex-col items-center">
                <img src={heroLogo(cfg.theme)} alt="صقل" className="show-in show-logo-start" style={{ ['--i' as string]: 0 }} draggable={false} />
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
                  F ملء الشاشة · B شاشة سوداء · 1–4 مشاهد الديمو · K الجولة · H تلميح · R كشف · S تخطي · L تدشين · T مؤقت الصورة · باللمس: اسحب يميناً أو انقر يسار الشاشة للتالي
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
