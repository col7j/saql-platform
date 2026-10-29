// إطار الديمو (#/show/demo?view=…&trip=…&seq=…): شاشات المنصة الحقيقية داخل iframe بعرض 1440،
// فوق لقطة بيانات ثابتة ومتجر للقراءة فقط. لا يتفاعل معه أحد مباشرة: الكاميرا في النافذة الأم.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { AppShell } from '@/layout/AppShell';
import TripsPage from '@/pages/app/Trips';
import TripDetail from '@/pages/app/trip/TripDetail';
import ScheduleTab from '@/pages/app/trip/ScheduleTab';
import { useDB } from '@/state/store';
import { DEMO_READY, enterReadOnly, type DemoViewKey } from './data';

// قبل أول رسم: كل ما تكتبه الشاشات يُهمل، والمستخدم هو القائد العام
enterReadOnly();

const params = () => {
  const q = new URLSearchParams(window.location.hash.split('?')[1] ?? '');
  return { view: (q.get('view') ?? 'list') as DemoViewKey, trip: q.get('trip') ?? '', seq: q.get('seq') ?? '0' };
};

const pathFor = (view: DemoViewKey, trip: string) =>
  view === 'list' ? '/app/trips' : `/app/trips/${trip}?tab=${view === 'trip' ? 'overview' : view === 'plans' ? 'schedule' : view}`;

/** الخطتان أ وب جنباً إلى جنب: نسختان من شاشة الجدول الحقيقية، والثانية على الخطة ب */
function PlansSplit() {
  const { id } = useParams();
  const trip = useDB().trips.find((t) => t.id === id);
  const second = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const name = trip?.schedule.plans[1]?.name;
    const tab = [...(second.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? [])].find((b) => name && b.textContent?.startsWith(name));
    tab?.click(); // تبديل محلي في الشاشة فقط، لا يكتب شيئاً
  }, [trip?.id]);
  if (!trip) return null;
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-ink-900">{trip.title}</h1>
      <div id="demo-plans" className="grid grid-cols-2 items-start gap-6">
        <div id="demo-plan-a" className="min-w-0"><ScheduleTab trip={trip} /></div>
        <div id="demo-plan-b" ref={second} className="min-w-0"><ScheduleTab trip={trip} /></div>
      </div>
    </div>
  );
}

export default function DemoFrame() {
  const [p, setP] = useState(params);
  useEffect(() => {
    const on = () => setP(params());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  // بعد اكتمال الرسم والخطوط: نُبلغ النافذة الأم لتقيس العناصر وتحرّك الكاميرا
  useEffect(() => {
    // مؤقّت لا requestAnimationFrame: المتصفح قد يوقف إطارات الرسم في iframe مخفي (شفافيته صفر أثناء الانتقال)
    let t: ReturnType<typeof setTimeout>;
    let alive = true;
    document.fonts.ready.then(() => {
      t = setTimeout(() => alive && window.parent.postMessage({ type: DEMO_READY, seq: p.seq }, window.location.origin), 40);
    });
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [p.seq, p.view, p.trip]);

  return (
    <div className="demo-frame">
      {/* شريط «الدخول كـ» للنموذج الأولي لا يظهر في العرض، ولا تُظهر الصفحة أشرطة تمرير */}
      <style>{`.demo-frame > div > :first-child{display:none!important} html,body{overflow:hidden!important} *{scrollbar-width:none} .demo-frame a, .demo-frame button{cursor:default}`}</style>
      <MemoryRouter key={p.view + p.trip} initialEntries={[pathFor(p.view, p.trip)]}>
        <Routes>
          <Route path="/app" element={<AppShell />}>
            <Route path="trips" element={<TripsPage />} />
            <Route path="trips/:id" element={p.view === 'plans' ? <PlansSplit /> : <TripDetail />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </div>
  );
}
