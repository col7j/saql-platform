// شاشة يوم الرحلة لمتابع الرحلات: الساعة الآن مقابل الجدول، تثبيت الفعلي، تقييم الرحلة
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fmtDate, fmtTime, now, timeOf } from '@/domain/dates';
import { effectiveTrackerId } from '@/domain/permissions';
import { actualItems, itemEnd, itemStart, scheduleAdherence, tripStage, tripStageLabel } from '@/domain/workflow';
import type { ScheduleItem, Trip } from '@/domain/types';
import { act, repos, useDB, useMe } from '@/state/store';
import { Badge, Button, Card, Empty, Icons, Input, LinkButton, Notice, PageHeader, Progress, Select, cx } from '@/ui';

export default function TrackerPage() {
  const db = useDB();
  const me = useMe();
  const [params, setParams] = useSearchParams();
  const mine = db.trips.filter((t) => effectiveTrackerId(db, t) === me.person.id && t.published);
  const live = mine.find((t) => tripStage(db, t) === 'live');
  const tripId = params.get('trip') ?? live?.id ?? mine[0]?.id;
  const trip = db.trips.find((t) => t.id === tripId);
  const [, tick] = useState(0);
  useEffect(() => { const i = setInterval(() => tick((x) => x + 1), 30000); return () => clearInterval(i); }, []);
  if (!mine.length) return <Empty title="لا رحلات منشورة لمتابعتها" />;
  return (
    <div>
      <PageHeader title="متابعة الرحلات" subtitle="وثّق لكل بند: هل التزموا بالخطة أ، أم ب، أم لا شيء؟ الجدول الذي تثبّته هو الجدول الفعلي للرحلة"
        actions={<Select className="w-auto" value={tripId} onChange={(e) => setParams({ trip: e.target.value })} options={mine.map((t) => ({ value: t.id, label: `${t.title} · ${tripStageLabel[tripStage(db, t)]}` }))} />} />
      {trip && <TrackTrip trip={trip} />}
    </div>
  );
}

function TrackTrip({ trip }: { trip: Trip }) {
  const db = useDB();
  const rows = actualItems(db, trip);
  const planB = trip.schedule.plans[1]?.items ?? [];
  const n = now();
  const current = rows.find((r) => itemStart(r.item) <= n && itemEnd(r.item) > n);
  const adh = scheduleAdherence(db, trip);
  const documented = rows.filter((r) => r.entry).length;
  const st = tripStage(db, trip);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl bg-brand-grad p-5 text-white">
          <div className="text-sm text-white/80">الساعة الآن</div>
          <div className="num mt-1 text-4xl font-black text-white">{fmtTime(timeOf(n))}</div>
          <div className="mt-1 text-xs text-white/80">{fmtDate(n.toISOString(), { weekday: true })}</div>
        </div>
        <div className="rounded-3xl border border-accent-200 bg-accent-50 p-5 md:col-span-2">
          <div className="text-sm text-accent-700">المفترض الآن حسب الخطة أ</div>
          {current ? (
            <>
              <div className="mt-1 text-xl font-bold">{current.item.detail}</div>
              <div className="num text-sm text-ink-500">{fmtTime(current.item.start)} – {fmtTime(current.item.end)}</div>
            </>
          ) : <div className="mt-1 text-ink-500">{st === 'live' ? 'لا بند في هذا الوقت' : `الرحلة ${tripStageLabel[st]}`}</div>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card><div className="text-xs text-ink-500">البنود الموثّقة</div><div className="num text-xl font-bold">{documented}/{rows.length}</div><Progress value={(documented / (rows.length || 1)) * 100} className="mt-2" /></Card>
        <Card><div className="text-xs text-ink-500">الالتزام بالخطة (أ أو ب)</div><div className="num text-xl font-bold">{adh == null ? '—' : `${Math.round(adh * 100)}%`}</div></Card>
        <Card className="col-span-2"><div className="flex h-full items-center justify-between gap-2"><span className="text-sm">بعد الانتهاء: قيّم الرحلة مع القائد العام</span><LinkButton size="sm" to={`/app/trips/${trip.id}?tab=closure`}>قيّم الرحلة</LinkButton></div></Card>
      </div>

      <Card title="تثبيت الجدول الفعلي" pad={false}>
        <div className="divide-y divide-ink-100">
          {rows.map((r, idx) => <Row key={r.item.id} trip={trip} item={r.item} alt={planB[idx]} entry={r.entry} live={current?.item.id === r.item.id} />)}
        </div>
      </Card>
      {st !== 'live' && st !== 'closing' && st !== 'closed' && <Notice>التوثيق متاح يوم الرحلة، ويمكنك الاطلاع على الجدول الآن.</Notice>}
      <Link to={`/app/trips/${trip.id}?tab=schedule`} className="text-sm text-brand-600">عرض تحليل المخطط مقابل الفعلي ←</Link>
    </div>
  );
}

function Row({ trip, item, alt, entry, live }: { trip: Trip; item: ScheduleItem; alt?: ScheduleItem; entry?: ReturnType<typeof actualItems>[number]['entry']; live: boolean }) {
  const db = useDB();
  const [note, setNote] = useState(entry?.note ?? '');
  const [s, setS] = useState(entry?.actualStart ?? item.start);
  const [e, setE] = useState(entry?.actualEnd ?? item.end);
  const [cat, setCat] = useState(entry?.categoryId ?? item.categoryId);
  const [noneOpen, setNoneOpen] = useState(entry?.followed === 'none');
  const past = itemStart(item) <= now();
  const rec = (followed: 'A' | 'B' | 'none') => act(() => repos.trips.recordActual(trip.id, item.id, followed === 'none' ? { followed, note, actualStart: s, actualEnd: e, categoryId: cat } : { followed }), 'ثُبّت البند');
  return (
    <div className={cx('px-4 py-3 sm:px-5', live && 'bg-accent-50/60')}>
      <div className="flex flex-wrap items-start gap-3">
        <div className="num w-24 shrink-0 text-xs text-ink-500">{fmtTime(item.start)}<br />{fmtTime(item.end)}</div>
        <div className="min-w-0 flex-1">
          <div className="text-sm"><b className="text-brand-700">أ:</b> {item.detail} {live && <Badge tone="orange">الآن</Badge>}</div>
          {alt && <div className="text-xs text-ink-500"><b>ب:</b> {alt.detail}</div>}
          {entry && <div className="mt-1"><Badge tone={entry.followed === 'none' ? 'red' : 'green'} icon={<Icons.Check className="h-3 w-3" />}>{entry.followed === 'A' ? 'التزموا بالخطة أ' : entry.followed === 'B' ? 'التزموا بالخطة ب' : `لا شيء: ${entry.note ?? ''}`}</Badge></div>}
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant={entry?.followed === 'A' ? 'primary' : 'secondary'} disabled={!past} onClick={() => { setNoneOpen(false); rec('A'); }}>أ</Button>
          <Button size="sm" variant={entry?.followed === 'B' ? 'primary' : 'secondary'} disabled={!past || !alt} onClick={() => { setNoneOpen(false); rec('B'); }}>ب</Button>
          <Button size="sm" variant={entry?.followed === 'none' ? 'danger' : 'secondary'} disabled={!past} onClick={() => setNoneOpen(!noneOpen)}>لا شيء</Button>
        </div>
      </div>
      {noneOpen && (
        <div className="mt-2 grid gap-2 rounded-xl bg-red-50/60 p-3 sm:grid-cols-[1fr_100px_100px_140px_auto]">
          <Input placeholder="ما الذي حصل فعلاً؟ (مثال: وقت بدل ضائع)" value={note} onChange={(x) => setNote(x.target.value)} />
          <Input type="time" value={s} onChange={(x) => setS(x.target.value)} />
          <Input type="time" value={e} onChange={(x) => setE(x.target.value)} />
          <Select value={cat} onChange={(x) => setCat(x.target.value)} options={db.settings.scheduleCategories.map((c) => ({ value: c.id, label: c.name }))} />
          <Button size="sm" disabled={!note} onClick={() => rec('none')}>ثبّت</Button>
        </div>
      )}
    </div>
  );
}
