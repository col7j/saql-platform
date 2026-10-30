// إطار الديمو (#/show/demo?view=…&id=…&seq=…): شاشات المنصة الحقيقية داخل iframe بصفة مشارك،
// فوق لقطة بيانات ثابتة ومتجر للقراءة فقط. لا يتفاعل معه أحد مباشرة: الكاميرا في النافذة الأم.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { AppShell } from '@/layout/AppShell';
import CalendarPage from '@/pages/app/Calendar';
import IndividualPage from '@/pages/app/Individual';
import TripDetail from '@/pages/app/trip/TripDetail';
import ScheduleTab from '@/pages/app/trip/ScheduleTab';
import FocusPage from '@/pages/app/Focus';
import FocusDetail from '@/pages/app/FocusDetail';
import PlansPage from '@/pages/app/Plans';
import { useDB } from '@/state/store';
import { DEMO_READY, enterReadOnly, type DemoViewKey } from './data';

// قبل أول رسم: كل ما تكتبه الشاشات يُهمل، والمستخدم هو المشارك
enterReadOnly();

const params = () => {
  const q = new URLSearchParams(window.location.hash.split('?')[1] ?? '');
  return { view: (q.get('view') ?? 'calendar') as DemoViewKey, id: q.get('id') ?? '', seq: q.get('seq') ?? '0' };
};

const TRIP_TAB: Partial<Record<DemoViewKey, string>> = { trip: 'overview', docs: 'docs', plans: 'schedule', attendance: 'attendance', closure: 'closure' };

export const pathFor = (view: DemoViewKey, id: string) => {
  if (TRIP_TAB[view]) return `/app/trips/${id}?tab=${TRIP_TAB[view]}`;
  if (view === 'focusDetail') return `/app/focus/${id}`;
  return { calendar: '/app/calendar', individual: '/app/individual', focus: '/app/focus', plan: '/app/plans' }[view as 'calendar'] ?? '/app/calendar';
};

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

  // بعد اكتمال الرسم والخطوط: نُبلغ النافذة الأم لتقيس العناصر وتحرّك الكاميرا.
  // مؤقّت لا requestAnimationFrame: المتصفح قد يوقف إطارات الرسم في iframe مخفي أثناء الانتقال
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    let alive = true;
    document.fonts.ready.then(() => {
      t = setTimeout(() => alive && window.parent.postMessage({ type: DEMO_READY, seq: p.seq }, window.location.origin), 60);
    });
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [p.seq, p.view, p.id]);

  return (
    <div className="demo-frame">
      {/* شريط «الدخول كـ» للنموذج الأولي لا يظهر في العرض، ولا تُظهر الصفحة أشرطة تمرير */}
      <style>{`.demo-frame > div > :first-child{display:none!important} html,body{overflow:hidden!important} *{scrollbar-width:none} .demo-frame a, .demo-frame button{cursor:default}`}</style>
      <MemoryRouter key={p.view + p.id} initialEntries={[pathFor(p.view, p.id)]}>
        <Routes>
          <Route path="/app" element={<AppShell />}>
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="individual" element={<IndividualPage />} />
            <Route path="trips/:id" element={p.view === 'plans' ? <PlansSplit /> : <TripDetail />} />
            <Route path="focus" element={<FocusPage />} />
            <Route path="focus/:id" element={<FocusDetail />} />
            <Route path="plans" element={<PlansPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </div>
  );
}
