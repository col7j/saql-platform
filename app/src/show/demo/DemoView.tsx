// فقرة «ديمو المنصة»: كاميرا سينمائية فوق شاشات المنصة الحقيقية (في iframe للقراءة فقط).
// كل خطوة يحددها المقدّم بنقرة أو سهم، والنقر بالفأرة على بطاقة يقرّبها، والنقر مرة أخرى يرجع.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { DemoSegment, DemoStep } from '../model';
import { Fallback } from '../segments/Fallback';
import { PAGE_W, camTransform, focus, overview, type Cam, type Rect } from './camera';
import { DEMO_READY, demoSnapshot, pickDemoTrip, type DemoViewKey } from './data';

const CAM_MS = 1100;
const FADE_MS = 280;
const EASE = 'cubic-bezier(.65,0,.35,1)';

type Finder = (doc: Document, tripId: string) => Element | null | undefined;

/** البطاقة (section) التي عنوانها أو زر رأسها يحمل النص */
const card = (text: string): Finder => (doc) =>
  [...doc.querySelectorAll('main section')].find((s) => s.querySelector('h3, header, button')?.textContent?.includes(text));
const tripCard: Finder = (doc, id) => doc.querySelector(`main a[href$="/app/trips/${id}"]`);

/** لكل خطوة: الشاشة، وما تقرّبه الكاميرا، ومن أين تدخل حين تتغير الشاشة */
const STEPS: Record<DemoStep, { view: DemoViewKey; target?: Finder; enter?: 'zoomIn' | Finder }> = {
  list: { view: 'list' },
  focusTrip: { view: 'list', target: tripCard },
  trip: { view: 'trip', enter: 'zoomIn' },
  document: { view: 'docs', target: card('وثيقة الرحلة') },
  schedule: { view: 'schedule', target: card('الجدول الزمني') },
  budget: { view: 'budget', target: card('ميزانية الرحلة') },
  plans: { view: 'plans', target: (doc) => doc.getElementById('demo-plans') },
  back: { view: 'list', enter: tripCard },
};

const ZOOMABLE = 'main section, main a[href*="/app/trips/"], main table, main [role="tablist"], main .rounded-2xl, main .rounded-xl, #demo-plan-a, #demo-plan-b';

const frameUrl = (view: DemoViewKey, trip: string, seq: number) => `${window.location.pathname}${window.location.search}#/show/demo?view=${view}&trip=${encodeURIComponent(trip)}&seq=${seq}`;

function rectOf(el: Element | null | undefined): Rect | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width && r.height ? { x: r.left, y: r.top, w: r.width, h: r.height } : null;
}

// إطار رسم تالٍ، أو مهلة قصيرة إن أوقف المتصفح الرسم (نافذة في الخلفية)
const nextFrame = () =>
  new Promise<void>((r) => {
    const t = setTimeout(r, 60);
    requestAnimationFrame(() => requestAnimationFrame(() => (clearTimeout(t), r())));
  });
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export default function DemoView({ seg, step }: { seg: DemoSegment; step: number; active: boolean }) {
  const tripId = pickDemoTrip(demoSnapshot(), seg.settings.tripId)?.id ?? '';
  const stepKey = seg.settings.steps[Math.min(step, seg.settings.steps.length - 1)] ?? 'list';

  const root = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [cam, setCam] = useState<Cam & { instant?: boolean }>({ s: 1, tx: 0, ty: 0, instant: true });
  const [pageH, setPageH] = useState(900);
  const pageHRef = useRef(900);
  const [hidden, setHidden] = useState(true);
  const [spot, setSpot] = useState<Rect | null>(null);
  const [zoomed, setZoomed] = useState<Element | null>(null);
  const [failed, setFailed] = useState(false);

  // حالة الإطار: الشاشة المحمّلة فيه ورقم آخر طلب، ومن ينتظر جاهزيته
  const st = useRef({ view: '' as string, trip: '', seq: 0, run: 0, waiters: new Map<number, () => void>(), seen: new Set<number>(), loading: Promise.resolve(false) as Promise<boolean> });
  const [initial] = useState(() => ({ view: STEPS[stepKey].view, trip: tripId, src: frameUrl(STEPS[stepKey].view, tripId, 1) }));

  // قياس مباشر عند التركيب ومع تغيّر حجم النافذة (ResizeObserver لا يُبلغ حين يتوقف الرسم في الخلفية)
  useLayoutEffect(() => {
    const measure = () => {
      const r = root.current?.getBoundingClientRect();
      if (r) setSize((p) => (p.w === r.width && p.h === r.height ? p : { w: r.width, h: r.height }));
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
  const fitHeight = async () => {
    const f = frame.current;
    const d = doc();
    if (!f || !d) return 900;
    f.style.height = '900px';
    await nextFrame();
    const h = Math.max(900, d.documentElement.scrollHeight);
    f.style.height = `${h}px`;
    pageHRef.current = h;
    setPageH(h);
    return h;
  };

  /** تحميل شاشة في الإطار: إخفاء ناعم، تبديل الشاشة، انتظار الجاهزية، ثم ضبط الطول. أي خطوة لاحقة على نفس الشاشة تنتظر نفس التحميل */
  const load = (view: DemoViewKey) => {
    const s = st.current;
    // التحميل الأول بالرابط الأصلي للإطار ما لم تتغير الخطوة قبل أن يجهز
    const first = s.seq === 0 && view === initial.view && tripId === initial.trip;
    const seq = first ? 1 : Math.max(2, s.seq + 1); // 1 محجوز لتحميل الرابط الأصلي
    s.seq = seq;
    s.view = view;
    s.trip = tripId;
    s.loading = (async () => {
      if (!first) {
        setHidden(true);
        await wait(FADE_MS);
        if (seq !== s.seq) return false;
        frame.current?.contentWindow?.location.replace(frameUrl(view, tripId, seq));
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

  const go = useCallback(
    async (key: DemoStep) => {
      const s = st.current;
      if (!size.w) return;
      const run = ++s.run;
      const def = STEPS[key];
      setZoomed(null);

      const entering = s.view !== def.view || s.trip !== tripId;
      if (entering) load(def.view);
      const ok = await s.loading;
      if (run !== s.run || !ok) return;

      const d = doc();
      if (entering) {
        // الدخول: تقريب على وسط أعلى الصفحة، أو على عنصر (بطاقة الرحلة عند الرجوع)، ثم ابتعاد ناعم
        const base = overview(size);
        const enterRect = def.enter && def.enter !== 'zoomIn' && d ? rectOf(def.enter(d, tripId)) : null;
        const from = def.enter === 'zoomIn' ? { s: base.s * 1.5, tx: size.w / 2 - base.s * 1.5 * (PAGE_W / 2), ty: -base.s * 40 } : enterRect ? focus(enterRect, size, pageHRef.current) : null;
        if (from) {
          setCam({ ...from, instant: true });
          await nextFrame();
          if (run !== s.run) return;
        }
      }
      setHidden(false);
      const r = def.target && d ? rectOf(def.target(d, tripId)) : null;
      setCam({ ...(r ? focus(r, size, pageHRef.current, { pad: 40 }) : overview(size)), instant: false });
      setSpot(r);
    },
    [size.w, size.h, tripId],
  );

  useEffect(() => {
    go(stepKey);
  }, [stepKey, tripId, size.w, size.h]); // eslint-disable-line react-hooks/exhaustive-deps

  // النقر بالفأرة على بطاقة يقرّبها، والنقر عليها مرة أخرى أو على فراغ يرجع لمشهد الخطوة
  const onClick = (e: React.MouseEvent) => {
    const d = doc();
    const box = root.current?.getBoundingClientRect();
    if (!d || !box) return;
    e.stopPropagation();
    const x = (e.clientX - box.left - cam.tx) / cam.s;
    const y = (e.clientY - box.top - cam.ty) / cam.s;
    const el = d.elementFromPoint(x, y)?.closest(ZOOMABLE) ?? null;
    if (!el || el === zoomed) {
      setZoomed(null);
      go(stepKey);
      return;
    }
    const r = rectOf(el);
    if (!r) return;
    setZoomed(el);
    setSpot(r);
    setCam({ ...focus(r, size, pageH, { pad: 28, maxZoom: 3.2 }), instant: false });
  };

  if (failed) return <Fallback title={seg.title} reason="تعذّر تحميل شاشات المنصة" />;

  return (
    <div ref={root} className="show-bg absolute inset-0 overflow-hidden" onClick={onClick} onPointerUp={(e) => e.pointerType === 'mouse' && e.stopPropagation()}>
      <div
        className="absolute left-0 top-0 origin-top-left will-change-transform"
        style={{ width: PAGE_W, height: pageH, transform: camTransform(cam), transition: cam.instant ? 'none' : `transform ${CAM_MS}ms ${EASE}` }}
      >
        <iframe
          ref={frame}
          src={initial.src}
          title="ديمو المنصة"
          tabIndex={-1}
          className="pointer-events-none block border-0 bg-ink-50"
          style={{ width: PAGE_W, height: 900, opacity: hidden ? 0 : 1, transition: `opacity ${FADE_MS}ms ease` }}
        />
        {/* إضاءة البطاقة المقرّبة: حلقة بلون صقل وتعتيم خفيف لما حولها */}
        <div
          className="pointer-events-none absolute rounded-[22px]"
          style={{
            left: (spot?.x ?? 0) - 10,
            top: (spot?.y ?? 0) - 10,
            width: (spot?.w ?? PAGE_W) + 20,
            height: (spot?.h ?? 900) + 20,
            opacity: spot && !hidden ? 1 : 0,
            boxShadow: '0 0 0 3px rgb(var(--c-brand-400) / .9), 0 0 0 9999px rgb(5 56 74 / .28), 0 20px 60px rgb(0 114 142 / .35)',
            transition: `opacity 500ms ease, left ${CAM_MS}ms ${EASE}, top ${CAM_MS}ms ${EASE}, width ${CAM_MS}ms ${EASE}, height ${CAM_MS}ms ${EASE}`,
          }}
        />
      </div>
      {hidden && st.current.seq <= 1 && (
        <div className="absolute inset-0 grid place-items-center">
          <img src="./brand/logo-vertical.svg" alt="" className="h-[24vh] w-auto animate-pulse opacity-80" draggable={false} />
        </div>
      )}
    </div>
  );
}
