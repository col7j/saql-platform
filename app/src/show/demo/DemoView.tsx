// فقرة «ديمو المنصة» بصفة مشارك: أربعة مشاهد (التقويم، الرحلات، لقاءات التركيز، الخطة الشخصية)،
// وكاميرا سينمائية فوق شاشات المنصة الحقيقية (في iframe للقراءة فقط) تقرّب بحجم مقروء من آخر القاعة.
// كل خطوة بنقرة أو سهم، والأرقام 1–4 للمشاهد (في ShowPlayer)، والنقر بالفأرة على عنصر يقرّبه.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { getCapabilities } from '@/domain/permissions';
import { DEMO_SCENE_LABELS, demoSteps, type DemoScene, type DemoSegment, type DemoStepKey } from '../model';
import { Backdrop, Fallback } from '../segments/Fallback';
import { PAGE_W, READABLE, READABLE_16, camTransform, focus, union, type Cam, type FocusOpts, type Rect } from './camera';
import { DEMO_READY, demoSnapshot, demoTargets, type DemoTargets, type DemoViewKey } from './data';

const CAM_MS = 1300;
const FADE_MS = 320;
const TITLE_MS = 2000;
const EASE = 'cubic-bezier(.65,0,.35,1)';
/** عرض منطقة شعار الزاوية من الحافة اليمنى على شاشة 1920 (الهامش + الشريحة) */
const MARK_ZONE = 150;

type Finder = (doc: Document, t: DemoTargets) => Rect | null;

function rectOf(el: Element | null | undefined): Rect | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width && r.height ? { x: r.left, y: r.top, w: r.width, h: r.height } : null;
}
/** البطاقة (section) التي يحمل عنوانها النص */
const cardEl = (doc: Document, text: string) => [...doc.querySelectorAll('main section')].find((s) => s.querySelector('h3, header, button')?.textContent?.includes(text));
const card = (text: string): Finder => (doc) => rectOf(cardEl(doc, text));

/** خلية اليوم مع أسبوعها في شبكة الشهر (تبدأ من الأحد السابق لأول الشهر) */
const calendarWeek: Finder = (doc, t) => {
  const grids = doc.querySelectorAll('main section .grid.grid-cols-7');
  const cells = grids[grids.length - 1]?.children;
  if (!cells) return null;
  const d = new Date(`${t.day}T00:00:00`);
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const idx = d.getDate() - 1 + first.getDay();
  const row = idx - (idx % 7);
  return union([rectOf(cells[row]), rectOf(cells[row + 6]), rectOf(cells[idx])]);
};

const calendarDay: Finder = (doc, t) => {
  const grids = doc.querySelectorAll('main section .grid.grid-cols-7');
  const cells = grids[grids.length - 1]?.children;
  const d = new Date(`${t.day}T00:00:00`);
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  return rectOf(cells?.[d.getDate() - 1 + first.getDay()]);
};

const pageHeader: Finder = (doc) => union([rectOf(doc.querySelector('main h1')?.closest('.flex')), rectOf(doc.querySelector('main ol'))]);

interface StepDef {
  view: DemoViewKey;
  id?: 'tripId' | 'focusId';
  target: Finder;
  /** ما تحيطه حلقة الإضاءة إن اختلف عما تؤطّره الكاميرا */
  spot?: Finder;
  opts?: FocusOpts;
}

const STEPS: Record<DemoStepKey, StepDef> = {
  // التقويم: الشهر كاملاً لقطة تمهيدية، ثم أسبوع اليوم الأكثر أنشطة، ثم اللقاء الفردي في «لقاءاتي»
  'calendar.month': { view: 'calendar', target: (doc) => rectOf(doc.querySelector('main section .grid.grid-cols-7')?.closest('section')), opts: { pad: 44, max: 1.6 } },
  'calendar.day': { view: 'calendar', target: calendarWeek, spot: calendarDay, opts: { pad: 20, min: READABLE, max: 2.4 } },
  'calendar.event': { view: 'individual', target: card('لقاءاتي'), opts: { min: READABLE } },
  // الرحلات: رحلة المجموعة ومراحلها، ثم وثيقتها، ثم الخطتان أ وب، ثم الحضور والتقييم
  'trips.trip': { view: 'trip', id: 'tripId', target: pageHeader, opts: { pad: 24, min: READABLE } },
  'trips.docs': { view: 'docs', id: 'tripId', target: card('وثيقة الرحلة'), opts: { min: READABLE } },
  'trips.plans': { view: 'plans', id: 'tripId', target: (doc) => rectOf(doc.getElementById('demo-plans')), opts: { pad: 20, min: READABLE_16 } },
  'trips.attendance': { view: 'attendance', id: 'tripId', target: card('الحضور'), opts: { min: READABLE } },
  'trips.evaluation': { view: 'closure', id: 'tripId', target: card('نتيجة الرحلة للمجموعة'), opts: { min: READABLE } },
  // لقاءات التركيز: القائمة، ثم تفاصيل لقاء قدّمه المشارك، ثم تقييم تقديمه
  'focus.list': {
    view: 'focus',
    target: (doc) => union([rectOf(doc.querySelector('main h1')?.closest('.flex')), rectOf(doc.querySelector('main .grid'))]),
    spot: (doc) => union([...(doc.querySelector('main .grid')?.children ?? [])].map(rectOf)),
    opts: { pad: 24, min: READABLE_16 },
  },
  'focus.detail': { view: 'focusDetail', id: 'focusId', target: card('التفاصيل'), opts: { min: READABLE } },
  'focus.evaluation': { view: 'focusDetail', id: 'focusId', target: card('تقييم أداء المقدّمين'), opts: { min: READABLE } },
  // الخطة الشخصية: عجلة الحياة، ثم الجانب ورؤيته وخطواته
  'plan.wheel': {
    view: 'plan',
    target: (doc) => { const c = cardEl(doc, 'عجلة الحياة'); return union([rectOf(c?.querySelector('header')), rectOf(c?.querySelector('svg'))]); },
    opts: { pad: 28, min: READABLE_16, max: 2.4 },
  },
  'plan.goals': { view: 'plan', target: (doc) => rectOf(cardEl(doc, 'عجلة الحياة')?.nextElementSibling), opts: { min: READABLE } },
};

const SCENE_LINE: Record<DemoScene, string> = {
  calendar: 'كل لقاءاتك ورحلاتك في مكان واحد',
  trips: 'من الوثيقة إلى التقييم',
  focus: 'تقدّم وتتدرّب وتُقيَّم',
  plan: 'عجلة حياتك وخطواتك',
};

const frameUrl = (view: DemoViewKey, id: string, seq: number) => `${window.location.pathname}${window.location.search}#/show/demo?view=${view}&id=${encodeURIComponent(id)}&seq=${seq}`;

// إطار رسم تالٍ، أو مهلة قصيرة إن أوقف المتصفح الرسم (نافذة في الخلفية)
const nextFrame = () =>
  new Promise<void>((r) => {
    const t = setTimeout(r, 60);
    requestAnimationFrame(() => requestAnimationFrame(() => (clearTimeout(t), r())));
  });
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const order = (i: number) => ({ ['--i' as string]: i }) as CSSProperties;

export default function DemoView({ seg, step }: { seg: DemoSegment; step: number; active: boolean }) {
  const db = demoSnapshot();
  const targets = demoTargets(db);
  const person = db.persons.find((p) => p.id === targets.personId);
  const group = getCapabilities(db, targets.personId).group;
  const steps = demoSteps(seg.settings);
  const cur = steps[Math.min(step, steps.length - 1)];
  const def = STEPS[cur.key];
  const sceneCount = seg.settings.scenes.length;

  const root = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [cam, setCam] = useState<Cam & { instant?: boolean }>({ s: 1, tx: 0, ty: 0, instant: true });
  const pageH = useRef(800);
  const [hidden, setHidden] = useState(true);
  const [spot, setSpot] = useState<Rect | null>(null);
  const [zoomed, setZoomedState] = useState<Element | null>(null);
  // نسخة فورية للقراءة داخل الحلقات غير المتزامنة
  const zoomRef = useRef<Element | null>(null);
  const setZoomed = (el: Element | null) => ((zoomRef.current = el), setZoomedState(el));
  const [failed, setFailed] = useState(false);
  // عنوان المشهد: يظهر ثانيتين عند دخول مشهد جديد
  const [title, setTitle] = useState<{ scene: DemoScene; n: number; key: number } | null>(null);

  const idOf = (d: StepDef) => (d.id ? targets[d.id] : '');
  const [initial] = useState(() => ({ view: def.view, id: idOf(def), src: frameUrl(def.view, idOf(def), 1) }));
  const st = useRef({ view: '', id: '', seq: 0, run: 0, scene: '', waiters: new Map<number, () => void>(), seen: new Set<number>(), loading: Promise.resolve(false) as Promise<boolean> });

  // قياس مباشر عند التركيب ومع تغيّر حجم النافذة (ResizeObserver لا يُبلغ حين يتوقف الرسم في الخلفية)
  useLayoutEffect(() => {
    // offsetWidth لا getBoundingClientRect: الأخير يتأثر بتكبير حركة دخول الفقرة فيُفسد الحساب
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
    // التصغير أولاً يكشف الطول الحقيقي لشاشة جديدة؛ بعد العرض نكتفي بالتمدد حتى لا تهتز الصفحة
    if (shrink) {
      f.style.height = '800px';
      await nextFrame();
    }
    const h = Math.max(800, d.documentElement.scrollHeight);
    f.style.height = `${h}px`;
    pageH.current = h;
  };

  /** تحميل شاشة في الإطار: إخفاء ناعم، تبديل الشاشة، انتظار الجاهزية، ثم ضبط الطول. أي خطوة لاحقة على نفس الشاشة تنتظر نفس التحميل */
  const load = (view: DemoViewKey, id: string, fadeMs: number) => {
    const s = st.current;
    // التحميل الأول بالرابط الأصلي للإطار ما لم تتغير الخطوة قبل أن يجهز
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
      const ok = await waitReady(seq, first ? 15000 : 6000);
      if (seq !== s.seq) return false;
      if (!ok && first) {
        setFailed(true);
        return false;
      }
      await fitHeight();
      return seq === s.seq;
    })();
  };

  const aim = (d: StepDef): { cam: Cam; rect: Rect | null } => {
    const dc = doc();
    const r = dc ? d.target(dc, targets) : null;
    // أسفل الشاشة محجوز لمؤشر التقدّم، فلا تقع المنطقة تحته
    const safe = { w: size.w, h: size.h * 0.9 };
    const spot = d.spot && dc ? d.spot(dc, targets) : r;
    // ويمين الشاشة العلوي فيه شعار الزاوية: لا يبدأ النص المقروء تحته
    return { cam: r ? focus(r, safe, pageH.current, { end: size.w * (MARK_ZONE / 1920), ...d.opts }) : { s: size.w / PAGE_W, tx: 0, ty: 0 }, rect: spot };
  };

  const go = useCallback(
    async (key: DemoStepKey, sceneFirst: boolean, scene: DemoScene, sceneIndex: number) => {
      if (!size.w) return;
      const s = st.current;
      const run = ++s.run;
      const d = STEPS[key];
      setZoomed(null);

      // مشهد جديد: عنوانه يغطي الانتقال ثانيتين، والشاشة تتبدل تحته
      const titleShown = s.scene !== scene && sceneFirst;
      s.scene = scene;
      if (titleShown) setTitle({ scene, n: sceneIndex + 1, key: run });
      else setTitle(null);
      const titleUntil = performance.now() + TITLE_MS;

      const entering = s.view !== d.view || s.id !== idOf(d);
      if (entering) load(d.view, idOf(d), titleShown ? 0 : FADE_MS);
      const ok = await s.loading;
      if (run !== s.run || !ok) return;
      // ننتظر استقرار تخطيط المنطقة (قراءتان متطابقتان) قبل أن تتحرك الكاميرا
      if (entering) {
        let last = '';
        for (let i = 0; i < 10; i++) {
          const dc = doc();
          const now = JSON.stringify(dc ? d.target(dc, targets) : null) + (dc?.documentElement.scrollHeight ?? 0);
          if (now === last) break;
          last = now;
          await wait(120);
          if (run !== s.run) return;
        }
        await fitHeight(false);
      }

      const { cam: to, rect } = aim(d);
      if (entering) {
        // دخول ناعم: الكاميرا تبدأ أقرب قليلاً ثم تستقر
        setCam({ s: to.s * 1.06, tx: to.tx - size.w * 0.03, ty: to.ty - size.h * 0.03, instant: true });
        await nextFrame();
        if (run !== s.run) return;
      }
      if (titleShown) {
        await wait(Math.max(0, titleUntil - performance.now()));
        if (run !== s.run) return;
        setTitle(null);
      }
      setHidden(false);
      setCam({ ...to, instant: false });
      setSpot(rect);
      // الصفحة قد تكمل تخطيطها بعد العرض (خطوط، بيانات محسوبة): نراقب ثلاث ثوانٍ ونصحّح بهدوء إن تغيّر
      let last = to;
      for (let i = 0; i < 7; i++) {
        await wait(450);
        if (run !== s.run || zoomRef.current) return; // المقدّم قرّب عنصراً بالنقر: لا نتدخل
        await fitHeight(false);
        const again = aim(d);
        if (Math.abs(again.cam.s - last.s) > 0.01 || Math.abs(again.cam.ty - last.ty) > 4 || Math.abs(again.cam.tx - last.tx) > 4) {
          last = again.cam;
          setCam({ ...again.cam, instant: false });
          setSpot(again.rect);
        }
      }
    },
    [size.w, size.h], // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    go(cur.key, cur.first, cur.scene, cur.sceneIndex);
  }, [cur.key, size.w, size.h]); // eslint-disable-line react-hooks/exhaustive-deps

  // النقر بالفأرة على عنصر يقرّبه بحجم مقروء، والنقر عليه مرة أخرى أو على فراغ يرجع لمشهد الخطوة
  const onClick = (e: React.MouseEvent) => {
    const dc = doc();
    const box = root.current?.getBoundingClientRect();
    if (!dc || !box) return;
    e.stopPropagation();
    const x = (e.clientX - box.left - cam.tx) / cam.s;
    const y = (e.clientY - box.top - cam.ty) / cam.s;
    const el = dc.elementFromPoint(x, y)?.closest('main section, main a[href], main table, main [role="tablist"], main .rounded-2xl, main .rounded-xl, #demo-plan-a, #demo-plan-b') ?? null;
    if (!el || el === zoomed) {
      setZoomed(null);
      const { cam: to, rect } = aim(def);
      setCam({ ...to, instant: false });
      setSpot(rect);
      return;
    }
    const r = rectOf(el);
    if (!r) return;
    setZoomed(el);
    setSpot(r);
    setCam({ ...focus(r, size, pageH.current, { pad: 24, min: READABLE, max: 3 }), instant: false });
  };

  if (failed) return <Fallback title={seg.title} reason="تعذّر تحميل شاشات المنصة" />;

  return (
    <div ref={root} className="absolute inset-0 overflow-hidden" onClick={onClick} onPointerUp={(e) => e.pointerType === 'mouse' && e.stopPropagation()}>
      <Backdrop />
      <div
        className="absolute left-0 top-0 origin-top-left will-change-transform"
        style={{ width: PAGE_W, height: pageH.current, transform: camTransform(cam), transition: cam.instant ? 'none' : `transform ${CAM_MS}ms ${EASE}` }}
      >
        {/* الشاشة الحقيقية كلوح عائم: حواف مستديرة وظل على الخلفية الداكنة */}
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
        {/* إضاءة المنطقة المقرّبة: حلقة بلون التوهّج */}
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

      {/* مؤشر التقدّم: نقطة لكل خطوة مجمّعة بالمشاهد، والحالية وحدها بلون التوكيد */}
      <div className="absolute bottom-[3.2vh] left-1/2 z-30 flex -translate-x-1/2 items-center gap-[1.2vw] px-[1.1vw] py-[0.9vh] show-dots">
        {seg.settings.scenes.map((sc, si) => (
          <div key={sc} className="flex items-center gap-[0.45vw]">
            {steps.map((x, i) =>
              x.sceneIndex === si ? (
                <span key={x.key} className={`show-dot ${i === step ? 'now' : i < step ? 'done' : ''}`} />
              ) : null,
            )}
          </div>
        ))}
      </div>

      {hidden && st.current.seq <= 1 && !title && (
        <div className="absolute inset-0 grid place-items-center">
          <img src="./brand/logo-icon.svg" alt="" className="h-[12vh] w-auto animate-pulse" draggable={false} />
        </div>
      )}
    </div>
  );
}
