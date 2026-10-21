import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { calKindColor, calKindLabel, eventsFor, type CalEvent } from '@/domain/calendar';
import { fmtDate, fmtHijri, fmtTime, toISODate, todayISO } from '@/domain/dates';
import { useDB, useMe } from '@/state/store';
import { Button, Card, Icons, PageHeader, Tabs, cx } from '@/ui';

const WEEK = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

export default function CalendarPage() {
  const db = useDB();
  const me = useMe();
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [scope, setScope] = useState<'all' | CalEvent['scope']>('all');
  const [view, setView] = useState<'month' | 'list'>('month');
  const hijri = db.settings.showHijri;
  const events = useMemo(() => eventsFor(db, me.person.id).filter((e) => scope === 'all' || e.scope === scope), [db, me.person.id, scope]);
  const today = todayISO();

  const days = useMemo(() => {
    const first = new Date(cursor);
    const start = new Date(first);
    start.setDate(1 - first.getDay());
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  }, [cursor]);
  const on = (iso: string) => events.filter((e) => e.date <= iso && (e.endDate ?? e.date) >= iso);
  const monthLabel = cursor.toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { month: 'long', year: 'numeric' });
  const hijriLabel = cursor.toLocaleDateString('ar-SA-u-ca-islamic-umalqura-nu-latn', { month: 'long', year: 'numeric' });

  return (
    <div>
      <PageHeader title="التقويم" subtitle="عام: الرحلات واللقاءات التطويرية · خاص بالمجموعة: لقاءات التركيز · خاص بك: اللقاءات الفردية وخطوات خطتك" />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs value={scope} onChange={setScope} tabs={[{ key: 'all', label: 'الكل' }, { key: 'general', label: 'عام' }, { key: 'group', label: 'المجموعة' }, { key: 'personal', label: 'خاص بي' }]} />
        <Tabs value={view} onChange={setView} tabs={[{ key: 'month', label: 'شهري' }, { key: 'list', label: 'قائمة' }]} />
      </div>
      <div className="mb-4 flex flex-wrap gap-3 text-xs text-ink-500">
        {(Object.keys(calKindLabel) as CalEvent['kind'][]).map((k) => (
          <span key={k} className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: calKindColor[k] }} />{calKindLabel[k]}</span>
        ))}
      </div>

      {view === 'month' ? (
        <Card pad={false}>
          <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
            <Button variant="ghost" size="sm" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}><Icons.ChevronRight className="h-4 w-4" /></Button>
            <div className="text-center">
              <div className="font-bold">{monthLabel}</div>
              {hijri && <div className="text-xs text-ink-400">{hijriLabel}</div>}
            </div>
            <Button variant="ghost" size="sm" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}><Icons.ChevronLeft className="h-4 w-4" /></Button>
          </div>
          <div className="grid grid-cols-7 border-b border-ink-100 text-center text-[11px] text-ink-500">
            {WEEK.map((w) => <div key={w} className="py-2"><span className="hidden sm:inline">{w}</span><span className="sm:hidden">{w.slice(0, 2)}</span></div>)}
          </div>
          <div className="grid grid-cols-7">
            {days.map((d) => {
              const iso = toISODate(d);
              const evs = on(iso);
              const inMonth = d.getMonth() === cursor.getMonth();
              return (
                <div key={iso} className={cx('min-h-[72px] border-b border-e border-ink-100 p-1 sm:min-h-[104px] sm:p-1.5', !inMonth && 'bg-ink-50/60')}>
                  <div className="flex items-center justify-between">
                    <span className={cx('num flex h-6 w-6 items-center justify-center rounded-full text-xs', iso === today ? 'bg-brand-600 font-bold text-white' : inMonth ? 'text-ink-700' : 'text-ink-300')}>{d.getDate()}</span>
                    {hijri && inMonth && <span className="hidden text-[9px] text-ink-300 sm:inline">{fmtHijri(iso).split(' ')[0]}</span>}
                  </div>
                  <div className="mt-0.5 space-y-0.5">
                    {evs.slice(0, 3).map((e) => (
                      <Link key={e.id} to={e.link} title={e.title} className="block truncate rounded px-1 py-0.5 text-[10px] font-medium text-white sm:text-[11px]" style={{ background: calKindColor[e.kind] }}>
                        <span className="hidden sm:inline">{e.title}</span><span className="sm:hidden">•</span>
                      </Link>
                    ))}
                    {evs.length > 3 && <div className="text-[10px] text-ink-400">+{evs.length - 3}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ) : (
        <Card pad={false}>
          <ul className="divide-y divide-ink-100">
            {events.filter((e) => (e.endDate ?? e.date) >= today).map((e) => (
              <li key={e.id}>
                <Link to={e.link} className="flex items-center gap-3 px-4 py-3 hover:bg-ink-50 sm:px-5">
                  <span className="h-10 w-1 rounded-full" style={{ background: calKindColor[e.kind] }} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{e.title}</div>
                    <div className="text-xs text-ink-500">{fmtDate(e.date, { hijri, weekday: true })}{e.start && ` · ${fmtTime(e.start)}`} · {calKindLabel[e.kind]}</div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
