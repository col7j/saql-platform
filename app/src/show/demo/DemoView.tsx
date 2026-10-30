// فقرة «ديمو المنصة» بصفة مشارك: أربعة مشاهد من صفحات المنصة الحقيقية (في iframe للقراءة فقط)،
// وجولة تلقائية في كل صفحة: الصفحة كاملة، ثم كل بطاقة بترتيب القراءة بحجم مقروء، ثم الصفحة التالية.
// تشغيل/إيقاف بـ K أو من الريموت، وتقدّم ورجوع يدوي في أي وقت (يمرّ عبر ShowPlayer)، والأرقام 1–4 للمشاهد.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { Pause, Play } from 'lucide-react';
import { getCapabilities } from '@/domain/permissions';
import { DEMO_SCENE_LABELS, demoSteps, type DemoScene, type DemoSegment } from '../model';
import { Backdrop, Fallback, markLogo } from '../segments/Fallback';
import { PAGE_W, READABLE, camTransform, focus, type Cam, type Rect } from './camera';
import { DEMO_READY, demoSnapshot, demoTargets, type DemoViewKey } from './data';
import { contentRects, detectCards, planTour, shotCam, shotDuration, visibleShots, type Shot } from './tour';

const CAM_MS = 1300;
const FADE_MS = 320;
const TITLE_MS = 2000;
const EASE = 'cubic-bezier(.65,0,.35,1)';
/** عرض منطقة شعار الزاوية من الحافة اليمنى على شاشة 1920 (الهامش + الشريحة) */
const MARK_ZONE = 150;

/** الصفحات التي تحتاج معرّفاً: صفحات الرحلة ولقاء التركيز */
export const PAGE_ID: Partial<Record<DemoViewKey, 'tripId' | 'focusId'>> = { trip: 'tripId', docs: 'tripId', plans: 'tripId', attendance: 'tripId', closure: 'tripId', focusDetail: 'focusId' };

const SCENE_LINE: Record<DemoScene, string> = {
  calendar: 'كل لقاءاتك ورحلاتك في مكان واحد',
  trips: 'من الوثيقة إلى التقييم',
  focus: 'تقدّم وتتدرّب وتُقيَّم',
  plan: 'عجلة حياتك وخطواتك',
};

/** رابط إطار الديمو. معامل ?demo-frame يميّزه عن نوافذه الأم: Chrome يرفض إطاراً متداخلاً برابط أحد آبائه نفسه
 *  (المعاينة داخل المحرّر = ثلاثة مستويات)، والجزء بعد # لا يكفي للتمييز */
export const frameUrl = (view: DemoViewKey, id: string, seq: number) => {
  const q = new URLSearchParams(window.location.search);
  q.set('demo-frame', '1');
  return `${window.location.pathname}?${q}#/show/demo?view=${view}&id=${encodeURIComponent(id)}&seq=${seq}`;
};

// إطار رسم تالٍ، أو مهلة قصيرة إن أوقف المتصفح الرسم (نافذة في الخلفية)
const nextFrame = () =>
  new Promise<void>((r) => {
    const t = setTimeout(r, 60);
    requestAnimationFrame(() => requestAnimationFrame(() => (clearTimeout(t), r())));
  });
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const order = (i: number) => ({ ['--i' as string]: i }) as CSSProperties;
const rectOf = (el: Element | null | undefined): Rect | null => {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width && r.height ? { x: r.left, y: r.top, w: r.width, h: r.height } : null;
};

/** يعيد true إن تولّت الجولة الخطوة (بطاقة تالية أو سابقة في نفس الصفحة) */
export type DemoNav = (dir: 'next' | 'prev') => boolean;

export interface DemoProps {
  seg: DemoSegment;
  /** الصفحة الحالية من صفحات الديمو */
  step: number;
  active: boolean;
  /** الجولة تعمل وحدها (لا موقوفة) */
  playing?: boolean;
  /** آخر بطاقة في الصفحة انتهت مدتها: انتقل للصفحة التالية */
  onAdvance?: () => void;
  /** انتهت الجولة كلها: يتوقف التشغيل وينتظر المقدّم */
  onEnd?: () => void;
  /** يسجّل معالج التقدّم والرجوع اليدوي عند ShowPlayer */
  registerNav?: (fn: DemoNav | null) => void;
  theme?: 'dark' | 'light';
  /** تبدأ الجولة (وعنوان المشهد الأول) بعد «ابدأ العرض» لا خلف شاشة البداية */
  animate?: boolean;
}

export default function DemoView({ seg, step, active, playing = false, onAdvance, onEnd, registerNav, theme = 'dark', animate = true }: DemoProps) {
  const db = demoSnapshot();
  const targets = demoTargets(db);
  const person = db.persons.find((p) => p.id === targets.personId);
  const group = getCapabilities(db, targets.personId).group;
  const pages = demoSteps(seg.settings);
  const cur = pages[Math.min(step, pages.length - 1)];
  const sceneCount = seg.settings.scenes.length;
  const idOf = (v: DemoViewKey) => (PAGE_ID[v] ? targets[PAGE_ID[v]!] : '');

  const root = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [cam, setCam] = useState<Cam & { instant?: boolean }>({ s: 1, tx: 0, ty: 0, instant: true });
  const pageH = useRef(800);
  const [hidden, setHidden] = useState(true);
  const [failed, setFailed] = useState(false);
  const [title, setTitle] = useState<{ scene: DemoScene; n: number; key: number } | null>(null);
  // خطوات الصفحة الحالية والخطوة المعروضة، ووقت وصول الكاميرا (تبدأ المدة بعده)
  const [tour, setTour] = useState<{ page: number; shots: Shot[]; idx: number; at: number } | null>(null);
  const [zoomed, setZoomedState] = useState<Element | null>(null);
  const zoomRef = useRef<Element | null>(null);
  const setZoomed = (el: Element | null) => ((zoomRef.current = el), setZoomedState(el));
  // الدخول إلى صفحة بالرجوع يبدأ من آخر بطاقاتها
  const enterAtEnd = useRef(false);

  const [initial] = useState(() => ({ view: cur.page, id: idOf(cur.page), src: frameUrl(cur.page, idOf(cur.page), 1) }));
  const st = useRef({ view: '', id: '', seq: 0, run: 0, scene: '', waiters: new Map<number, () => void>(), seen: new Set<number>(), loading: Promise.resolve(false) as Promise<boolean> });

  // قياس مباشر عند التركيب ومع تغيّر حجم النافذة (offsetWidth لا getBoundingClientRect: الأخير يتأثر بتكبير حركة دخول الفقرة)
  useLayoutEffect(() => {
    const measure = () => {
      const el = root.current;
      if (el) setSize((p) => (p.w === el.offsetWidth && p.h === el.offsetHeight ? p : { w: el.offsetWidth, h: el.offsetHeight }));
    };
    measure();
    window.addEventListener('resize', measure);
    document.addEventListener('fullscreenchange', measure);
    return () => (window.removeEventListener('resize', measure), document.removeEventListener('fullscreenchange', measure));
  }, []);

  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow || e.data?.type !== DEMO_READY) return;
      const seq = Number(e.data.seq);
      const w = st.current.waiters.get(seq);
      if (w) w();
      else st.current.seen.add(seq); // وصلت الجاهزية قبل أن ننتظرها (التحميل الأول)
      st.current.waiters.delete(seq);
    };
    window.addEventListener('message', on);
    return () => window.removeEventListener('message', on);
  }, []);

  const waitReady = (seq: number, ms: number) =>
    new Promise<boolean>((resolve) => {
      if (st.current.seen.delete(seq)) return resolve(true);
      const t = setTimeout(() => (st.current.waiters.delete(seq), resolve(false)), ms);
      st.current.waiters.set(seq, () => (clearTimeout(t), resolve(true)));
    });

  const doc = () => frame.current?.contentDocument ?? null;

  /** الإطار بطول صفحته كاملة، فتتحرك الكاميرا عليها كلوحة واحدة دون تمرير داخلي */
  const fitHeight = async (shrink = true) => {
    const f = frame.current;
    const d = doc();
    if (!f || !d) return;
    if (shrink) {
      f.style.height = '800px';
      await nextFrame();
    }
    const h = Math.max(800, d.documentElement.scrollHeight);
    f.style.height = `${h}px`;
    pageH.current = h;
  };

  /** تحميل صفحة في الإطار: إخفاء ناعم، تبديل الصفحة، انتظار الجاهزية، ثم ضبط الطول */
  const load = (view: DemoViewKey, id: string, fadeMs: number) => {
    const s = st.current;
    const first = s.seq === 0 && view === initial.view && id === initial.id;
    const seq = first ? 1 : Math.max(2, s.seq + 1); // 1 محجوز لتحميل الرابط الأصلي
    s.seq = seq;
    s.view = view;
    s.id = id;
    s.loading = (async () => {
      if (!first) {
        setHidden(true);
        await wait(fadeMs);
        if (seq !== s.seq) return false;
        frame.current?.contentWindow?.location.replace(frameUrl(view, id, seq));
      }
      // التحميل الأول قد يطول (خادم بارد أو جهاز بطيء): نصبر قبل شاشة البديل
      const ok = await waitReady(seq, first ? 45000 : 8000);
      if (seq !== s.seq) return false;
      if (!ok && first) {
        setFailed(true);
        return false;
      }
      await fitHeight();
      return seq === s.seq;
    })();
  };

  // أسفل الشاشة محجوز لمؤشر التقدّم، ويمينها العلوي لشعار الزاوية
  const view = { w: size.w, h: size.h * 0.88 };
  const end = size.w * (MARK_ZONE / 1920);
  const plan = (page: DemoViewKey) => {
    const dc = doc();
    if (!dc) return [];
    const shots = visibleShots(planTour(page, detectCards(dc), view, { content: contentRects(dc) }), seg.settings.durations);
    return shots.length ? shots : planTour(page, [], view);
  };

  /** دخول صفحة: تحميلها، انتظار استقرار تخطيط بطاقاتها، ثم تخطيط الجولة */
  const enter = useCallback(
    async (pageIdx: number) => {
      if (!size.w) return;
      const s = st.current;
      const run = ++s.run;
      const p = pages[Math.min(pageIdx, pages.length - 1)];
      setZoomed(null);
      setTour(null);
      // مشهد جديد: عنوانه يغطي الانتقال ثانيتين، والصفحة تتبدل تحته
      const titleShown = s.scene !== p.scene && p.first;
      s.scene = p.scene;
      if (titleShown) setTitle({ scene: p.scene, n: p.sceneIndex + 1, key: run });
      else setTitle(null);
      const titleUntil = performance.now() + TITLE_MS;

      if (s.view !== p.page || s.id !== idOf(p.page)) load(p.page, idOf(p.page), titleShown ? 0 : FADE_MS);
      const ok = await s.loading;
      if (run !== s.run || !ok) return;
      // استقرار التخطيط: قراءتان متطابقتان لمواضع البطاقات وطول الصفحة
      let last = '';
      for (let i = 0; i < 12; i++) {
        const dc = doc();
        const now = JSON.stringify(dc ? detectCards(dc).map((c) => c.rect) : null) + (dc?.documentElement.scrollHeight ?? 0);
        if (now === last) break;
        last = now;
        await wait(120);
        if (run !== s.run) return;
      }
      await fitHeight(false);
      const shots = plan(p.page);
      const idx = enterAtEnd.current ? shots.length - 1 : 0;
      enterAtEnd.current = false;
      // دخول ناعم: الكاميرا تبدأ أقرب قليلاً ثم تستقر
      const to = shotCam(shots[idx], view, pageH.current, end);
      setCam({ s: to.s * 1.05, tx: to.tx - size.w * 0.025, ty: to.ty - size.h * 0.025, instant: true });
      await nextFrame();
      if (titleShown) {
        await wait(Math.max(0, titleUntil - performance.now()));
        if (run !== s.run) return;
        setTitle(null);
      }
      setHidden(false);
      setTour({ page: pageIdx, shots, idx, at: performance.now() + CAM_MS });
      // الصفحة قد تكمل تخطيطها بعد العرض: نعيد التخطيط بهدوء إن تحركت البطاقات
      for (let i = 0; i < 6; i++) {
        await wait(500);
        if (run !== s.run) return;
        await fitHeight(false);
        const again = plan(p.page);
        setTour((t) => {
          if (!t || t.page !== pageIdx) return t;
          const moved = again.length !== t.shots.length || again.some((x, k) => JSON.stringify(x.rect) !== JSON.stringify(t.shots[k].rect));
          return moved ? { ...t, shots: again, idx: Math.min(t.idx, again.length - 1) } : t;
        });
      }
    },
    [size.w, size.h], // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    if (animate) enter(step);
  }, [step, size.w, size.h, animate]); // eslint-disable-line react-hooks/exhaustive-deps

  const shot = tour?.shots[tour.idx];

  // الكاميرا تتبع الخطوة الحالية (ما لم يقرّب المقدّم عنصراً بالنقر)
  useEffect(() => {
    if (!shot || zoomRef.current || !size.w) return;
    setCam({ ...shotCam(shot, view, pageH.current, end), instant: false });
  }, [shot?.key, JSON.stringify(shot?.rect), size.w, size.h]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (dir: 1 | -1) => setTour((t) => (t ? { ...t, idx: Math.max(0, Math.min(t.shots.length - 1, t.idx + dir)), at: performance.now() + CAM_MS } : t));

  // التقدّم والرجوع اليدوي: داخل الصفحة نتولّى نحن، وعند حدودها يتولى ShowPlayer
  const live = useRef(tour);
  live.current = tour;
  useEffect(() => {
    if (!registerNav || !active) return;
    registerNav((dir) => {
      const t = live.current;
      setZoomed(null);
      if (!t) return false; // الصفحة ما زالت تُحمَّل: الانتقال لصفحة أخرى
      if (dir === 'next' && t.idx < t.shots.length - 1) return go(1), true;
      if (dir === 'prev' && t.idx > 0) return go(-1), true;
      if (dir === 'prev') enterAtEnd.current = true;
      return false;
    });
    return () => registerNav(null);
  }, [registerNav, active]); // eslint-disable-line react-hooks/exhaustive-deps

  // التشغيل التلقائي: بعد وصول الكاميرا ومدة الخطوة، الخطوة التالية أو الصفحة التالية
  const duration = shot ? shotDuration(shot, seg.settings.dwell, seg.settings.durations) : 0;
  useEffect(() => {
    if (!active || !playing || !tour || !shot || title || zoomed) return;
    const t = setTimeout(
      () => {
        if (tour.idx < tour.shots.length - 1) go(1);
        else if (step < pages.length - 1) onAdvance?.();
        else onEnd?.();
      },
      Math.max(0, tour.at - performance.now()) + duration,
    );
    return () => clearTimeout(t);
  }, [active, playing, tour?.idx, tour?.page, tour?.at, shot?.key, title, zoomed, duration]); // eslint-disable-line react-hooks/exhaustive-deps

  // النقر بالفأرة على عنصر يقرّبه بحجم مقروء (ويوقف العدّ)، والنقر عليه مرة أخرى أو على فراغ يرجع للجولة
  const onClick = (e: React.MouseEvent) => {
    const dc = doc();
    const box = root.current?.getBoundingClientRect();
    if (!dc || !box) return;
    e.stopPropagation();
    const x = (e.clientX - box.left - cam.tx) / cam.s;
    const y = (e.clientY - box.top - cam.ty) / cam.s;
    const el = dc.elementFromPoint(x, y)?.closest('main [data-demo-card], main a[href], main table, main [role="tablist"], main .rounded-2xl, main .rounded-xl, #demo-plan-a, #demo-plan-b') ?? null;
    if (!el || el === zoomed) {
      setZoomed(null);
      if (shot) setCam({ ...shotCam(shot, view, pageH.current, end), instant: false });
      setTour((t) => (t ? { ...t, at: performance.now() + CAM_MS } : t));
      return;
    }
    const r = rectOf(el);
    if (!r) return;
    setZoomed(el);
    setCam({ ...focus(r, size, pageH.current, { pad: 24, min: READABLE, max: 3 }), instant: false });
  };

  if (failed) return <Fallback title={seg.title} reason="تعذّر تحميل شاشات المنصة" />;

  // الحلقة على البطاقة كاملة فقط: حدود الأجزاء تقطع المحتوى فلا تُرسم
  const spot = zoomed ? rectOf(zoomed) : shot?.kind === 'card' ? shot.rect : null;
  const counting = active && playing && !!tour && !title && !zoomed;
  return (
    <div ref={root} className="absolute inset-0 overflow-hidden" onClick={onClick} onPointerUp={(e) => e.pointerType === 'mouse' && e.stopPropagation()} data-demo-shot={shot?.key ?? ''}>
      <Backdrop />
      <div
        className="absolute left-0 top-0 origin-top-left will-change-transform"
        style={{ width: PAGE_W, height: pageH.current, transform: camTransform(cam), transition: cam.instant ? 'none' : `transform ${CAM_MS}ms ${EASE}` }}
      >
        {/* الشاشة الحقيقية كلوح عائم: حواف مستديرة وظل على الخلفية */}
        <iframe
          ref={frame}
          src={initial.src}
          title="ديمو المنصة"
          tabIndex={-1}
          className="show-demo-panel pointer-events-none block border-0"
          style={{
            width: PAGE_W,
            height: 800,
            opacity: hidden ? 0 : 1,
            transform: hidden ? 'scale(.985)' : 'none',
            transition: `opacity ${FADE_MS}ms ease, transform ${FADE_MS * 2}ms ease`,
          }}
        />
        {/* إضاءة المنطقة المقرّبة: حلقة بلون التوهّج (لا حلقة على الصفحة كاملة) */}
        <div
          className="show-demo-ring pointer-events-none absolute"
          style={{
            left: (spot?.x ?? 0) - 8,
            top: (spot?.y ?? 0) - 8,
            width: (spot?.w ?? PAGE_W) + 16,
            height: (spot?.h ?? 800) + 16,
            opacity: spot && !hidden && !title ? 1 : 0,
            transition: `opacity 500ms ease, left ${CAM_MS}ms ${EASE}, top ${CAM_MS}ms ${EASE}, width ${CAM_MS}ms ${EASE}, height ${CAM_MS}ms ${EASE}`,
          }}
        />
      </div>

      {/* عنوان المشهد بنفس أسلوب شاشات العرض */}
      <div className="absolute inset-0 z-20 transition-opacity duration-700" style={{ opacity: title ? 1 : 0, pointerEvents: 'none' }}>
        <Backdrop>
          {title && (
            <div key={title.key} className="show-center">
              <div className="show-stack">
                <p className="show-kicker show-in num" style={order(0)}>
                  <span className="show-em">{title.n}</span> / {sceneCount}
                </p>
                <h1 className="show-title show-in" style={order(1)}>{DEMO_SCENE_LABELS[title.scene]}</h1>
                <div className="show-rule show-in" style={order(2)} />
                <p className="show-body show-in" style={order(3)}>{SCENE_LINE[title.scene]}</p>
                {title.n === 1 && person && (
                  <p className="show-kicker show-in" style={order(4)}>بعيون {person.name.split(' ')[0]}، مشارك في {group?.name}</p>
                )}
              </div>
            </div>
          )}
        </Backdrop>
      </div>

      {/* مؤشر التقدّم: حالة التشغيل، ونقطة لكل صفحة مجمّعة بالمشاهد، وشريط مدة الخطوة الحالية */}
      <div className="show-dots absolute bottom-[3.2vh] left-1/2 z-30 flex -translate-x-1/2 flex-col items-stretch gap-[0.7vh] px-[1.1vw] py-[0.9vh]">
        <div className="flex items-center gap-[1.2vw]">
          <span className="show-tour-state" title={playing ? 'الجولة تعمل (K للإيقاف)' : 'الجولة موقوفة (K للتشغيل)'}>
            {playing ? <Pause className="h-full w-full" /> : <Play className="h-full w-full" />}
          </span>
          {seg.settings.scenes.map((sc, si) => (
            <div key={sc} className="flex items-center gap-[0.45vw]">
              {pages.map((x, i) => (x.sceneIndex === si ? <span key={x.page} className={`show-dot ${i === step ? 'now' : i < step ? 'done' : ''}`} /> : null))}
            </div>
          ))}
        </div>
        <div className="show-tour-bar">
          {shot && (
            <span
              key={`${tour?.page}:${tour?.idx}:${tour?.at}`}
              style={{ animationDuration: `${duration}ms`, animationDelay: `${Math.round(Math.max(0, (tour?.at ?? 0) - performance.now()))}ms`, animationPlayState: counting ? 'running' : 'paused' }}
            />
          )}
        </div>
      </div>

      {hidden && st.current.seq <= 1 && !title && (
        <div className="absolute inset-0 grid place-items-center">
          <img src={markLogo(theme)} alt="" className="h-[12vh] w-auto animate-pulse" draggable={false} />
        </div>
      )}
    </div>
  );
}
