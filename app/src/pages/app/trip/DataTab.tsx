// المسار 3: بيانات الرحلة (ما يظهر للمشاركين): الجدول، الضيوف، اللقاءات وموادها، المواد القبلية
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { dateTime, fmtDate, fmtDateTime, fmtTime, now } from '@/domain/dates';
import { uid } from '@/domain/id';
import { materialTypeLabel } from '@/domain/labels';
import { isTripTeam, tripTeamLeaderId, canUploadMaterial, canSeeMaterial } from '@/domain/permissions';
import { isMaterialRevealed, itemEnd, itemStart, materialState, participantScheduleView, sortItems, tripStage } from '@/domain/workflow';
import type { Material, MaterialType, Trip } from '@/domain/types';
import { act, personName, repos, useDB, useMe } from '@/state/store';
import { Badge, Button, Card, Empty, Field, Icons, Input, Modal, Notice, Select, Tabs, Toggle, cx } from '@/ui';
import { PlaceholderImage } from '@/ui/domain';

export default function DataTab({ trip }: { trip: Trip }) {
  const db = useDB();
  const me = useMe();
  const pid = me.person.id;
  const isLead = tripTeamLeaderId(db, trip) === pid;
  const team = isTripTeam(db, pid, trip);
  const insider = team || me.isStaff;
  const view = participantScheduleView(trip, db.settings);
  const [preview, setPreview] = useState<'insider' | 'participant'>(insider ? 'insider' : 'participant');
  const items = preview === 'insider' ? sortItems(trip.schedule.plans[0]?.items ?? []) : view.items;
  const st = tripStage(db, trip);
  const surveys = db.surveys.filter((s) => s.context.kind === 'trip' && s.context.id === trip.id);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        {st === 'closed' && trip.closure.publicReport && (
          <Card title="التقرير العام للرحلة">
            <p className="text-sm leading-7">{trip.closure.publicReport}</p>
            <div className="mt-3 grid grid-cols-3 gap-2">{trip.closure.photos.map((p) => <PlaceholderImage key={p} className="aspect-video" />)}</div>
          </Card>
        )}
        <Card
          title="جدول الرحلة"
          subtitle={trip.type === 'internal' ? 'في الرحلات الداخلية يُعرض الجدول كاملاً' : 'في الرحلات الخارجية: عرض كامل أو مختصر لـ 24 ساعة القادمة'}
          action={insider && <Tabs value={preview} onChange={setPreview} tabs={[{ key: 'insider', label: 'كامل' }, { key: 'participant', label: 'كما يراه المشارك' }]} />}
        >
          {isLead && (
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl bg-brand-50 p-3 text-sm">
              <span className="font-medium text-brand-800">عرض الجدول للمشاركين:</span>
              <Select className="w-auto py-1.5" value={trip.scheduleVisibility} onChange={(e) => act(() => repos.trips.setScheduleVisibility(trip.id, e.target.value as Trip['scheduleVisibility']), 'حُدّث العرض')}
                options={[{ value: 'hidden', label: 'مخفي' }, { value: 'full', label: 'عرض كامل' }, ...(trip.type === 'external' ? [{ value: 'next24', label: 'مختصر: 24 ساعة القادمة' }] : [])]} />
              <span className="text-xs text-brand-700">يُعرض قبل الرحلة بـ {db.settings.scheduleRevealHours} ساعة. ويبقى لك تحرير الجدول حتى بعد العرض.</span>
            </div>
          )}
          {preview === 'participant' && !view.visible ? <Empty title="الجدول غير معروض بعد" text={view.reason} icon={<Icons.EyeOff className="h-8 w-8" />} /> : items.length === 0 ? <Empty title="لا بنود" /> : (
            <ScheduleTimeline trip={trip} items={items} />
          )}
          {preview === 'participant' && view.mode === 'next24' && <p className="mt-2 text-xs text-ink-400">عرض مختصر لـ 24 ساعة القادمة</p>}
        </Card>

        <SessionsCard trip={trip} />
      </div>

      <div className="space-y-6">
        <GuestsCard trip={trip} editable={isLead} />
        <PreMaterials trip={trip} />
        <Card title="الاستبيانات" subtitle="إلزامية في الرحلات">
          {surveys.length === 0 ? <p className="text-sm text-ink-400">لا استبيانات بعد</p> : surveys.map((s) => (
            <Link key={s.id} to="/app/surveys" className="flex items-center justify-between py-1.5 text-sm hover:text-brand-600">
              <span>{s.title}</span>
              {me.isParticipant && (s.responses.some((r) => r.personId === pid) ? <Badge tone="green">عبّأته</Badge> : <Badge tone="orange">مطلوب</Badge>)}
            </Link>
          ))}
        </Card>
      </div>
    </div>
  );
}

function ScheduleTimeline({ trip, items }: { trip: Trip; items: Trip['schedule']['plans'][number]['items'] }) {
  const db = useDB();
  const n = now();
  const days = [...new Set(items.map((i) => i.date))];
  const cat = (id: string) => db.settings.scheduleCategories.find((c) => c.id === id);
  return (
    <div className="space-y-4">
      {days.map((d) => (
        <div key={d}>
          <div className="mb-2 text-sm font-bold text-brand-700">{fmtDate(d, { weekday: true })}</div>
          <ol className="relative space-y-2 border-s-2 border-brand-100 ps-4">
            {items.filter((i) => i.date === d).map((i) => {
              const live = itemStart(i) <= n && itemEnd(i) > n;
              const past = itemEnd(i) <= n;
              const session = trip.sessions.find((s) => s.id === i.sessionId);
              return (
                <li key={i.id} className={cx('relative rounded-xl p-2.5', live ? 'bg-accent-50 ring-1 ring-accent-300' : 'bg-white', past && 'opacity-60')}>
                  <span className={cx('absolute -start-[23px] top-3.5 h-3 w-3 rounded-full border-2 border-white', live ? 'bg-accent-500' : past ? 'bg-ink-300' : 'bg-brand-500')} />
                  <div className="flex flex-wrap items-center gap-2 text-xs text-ink-500">
                    <span className="num font-medium text-ink-700">{fmtTime(i.start)} – {fmtTime(i.end)}</span>
                    <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: cat(i.categoryId)?.color }} />{cat(i.categoryId)?.name}</span>
                    {live && <Badge tone="orange">الآن</Badge>}
                  </div>
                  <div className="mt-0.5 text-sm">{i.detail}</div>
                  {session && <div className="mt-1 text-xs text-brand-700"><Icons.Presentation className="me-1 inline h-3.5 w-3.5" />{session.title}</div>}
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </div>
  );
}

function GuestsCard({ trip, editable }: { trip: Trip; editable: boolean }) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const save = (g: Trip['guests']) => act(() => repos.trips.updateGuests(trip.id, g));
  return (
    <Card title="الضيوف" subtitle={editable ? 'اكتمال الضيوف وتأكيدهم شرط للنشر' : undefined}>
      {trip.guests.length === 0 && <p className="text-sm text-ink-400">لم يُضف ضيوف</p>}
      <ul className="space-y-2">
        {trip.guests.map((g) => (
          <li key={g.id} className="flex items-center justify-between gap-2 text-sm">
            <span><b>{g.name}</b> <span className="text-ink-500">· {g.role}</span></span>
            {editable ? (
              <span className="flex items-center gap-1">
                <Toggle checked={g.confirmed} onChange={(v) => save(trip.guests.map((x) => (x.id === g.id ? { ...x, confirmed: v } : x)))} label={<span className="text-xs">مؤكد</span>} />
                <button onClick={() => save(trip.guests.filter((x) => x.id !== g.id))} className="text-ink-300 hover:text-red-600"><Icons.X className="h-4 w-4" /></button>
              </span>
            ) : g.confirmed ? <Badge tone="green">مؤكد</Badge> : <Badge tone="orange">بانتظار التأكيد</Badge>}
          </li>
        ))}
      </ul>
      {editable && (
        <div className="mt-3 flex gap-2">
          <Input placeholder="الاسم" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="الصفة" value={role} onChange={(e) => setRole(e.target.value)} />
          <Button size="sm" disabled={!name} onClick={() => { save([...trip.guests, { id: uid('gs'), name, role, confirmed: false }]); setName(''); setRole(''); }}><Icons.Plus className="h-4 w-4" /></Button>
        </div>
      )}
    </Card>
  );
}

function MaterialLine({ m }: { m: Material }) {
  const db = useDB();
  const me = useMe();
  const revealed = isMaterialRevealed(m);
  const state = materialState(db, me.person.id, m.id);
  const own = m.uploaderId === me.person.id;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-ink-100 px-3 py-2 text-sm">
      <Icons.FileText className="h-4 w-4 text-brand-600" />
      <span className="flex-1">{m.title}</span>
      <Badge>{materialTypeLabel[m.type]}</Badge>
      {m.mandatory != null && m.origin === 'pre_trip' && <Badge tone={m.mandatory ? 'orange' : 'gray'}>{m.mandatory ? 'إلزامية' : 'اختيارية'}</Badge>}
      {!revealed && <Badge tone="gray" icon={<Icons.EyeOff className="h-3 w-3" />}>{m.revealMode === 'manual' ? 'مخفية حتى يفتحها الرافع' : `تظهر ${fmtDateTime(m.revealAt)}`}</Badge>}
      {own && m.revealMode === 'manual' && <Button size="sm" variant="secondary" onClick={() => repos.materials.setRevealed(m.id, !m.revealed)}>{m.revealed ? 'إخفاء' : 'إظهار الآن'}</Button>}
      {me.isParticipant && revealed && (state === 'viewed' ? <Badge tone="green">شاهدتها</Badge> : <Button size="sm" variant="secondary" onClick={() => repos.materials.mark(m.id, 'viewed')}>علّم كمشاهَدة</Button>)}
    </div>
  );
}

function SessionsCard({ trip }: { trip: Trip }) {
  const db = useDB();
  const me = useMe();
  const [up, setUp] = useState<string | null>(null);
  const canUp = canUploadMaterial(db, me.person.id) && (isTripTeam(db, me.person.id, trip) || me.isStaff);
  if (trip.sessions.length === 0) return null;
  return (
    <Card title="لقاءات الرحلة وموادها" subtitle="المادة تظهر تلقائياً بعد انتهاء وقت اللقاء، أو تبقى مخفية حتى يفتحها الرافع">
      <div className="space-y-4">
        {trip.sessions.map((s) => {
          const mats = db.materials.filter((m) => m.tripId === trip.id && m.sessionId === s.id && canSeeMaterial(db, me.person.id, m));
          return (
            <div key={s.id}>
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-bold">{s.title}</div>
                  <div className="text-xs text-ink-500">{fmtDate(s.date)} · {fmtTime(s.start)} – {fmtTime(s.end)}{s.presenter && ` · ${s.presenter}`}</div>
                </div>
                {canUp && <Button size="sm" variant="secondary" onClick={() => setUp(s.id)} icon={<Icons.Upload className="h-3.5 w-3.5" />}>ارفع مادة</Button>}
              </div>
              <div className="space-y-1.5">{mats.length === 0 ? <p className="text-xs text-ink-400">لا مواد ظاهرة</p> : mats.map((m) => <MaterialLine key={m.id} m={m} />)}</div>
            </div>
          );
        })}
      </div>
      {up && <UploadModal trip={trip} sessionId={up} onClose={() => setUp(null)} />}
    </Card>
  );
}

function PreMaterials({ trip }: { trip: Trip }) {
  const db = useDB();
  const me = useMe();
  const [up, setUp] = useState(false);
  const canUp = isTripTeam(db, me.person.id, trip) || me.isStaff;
  const mats = db.materials.filter((m) => m.tripId === trip.id && m.origin === 'pre_trip');
  return (
    <Card title="المواد القبلية" action={canUp && <Button size="sm" variant="secondary" onClick={() => setUp(true)} icon={<Icons.Plus className="h-3.5 w-3.5" />}>أضف</Button>}>
      <div className="space-y-1.5">{mats.length === 0 ? <p className="text-sm text-ink-400">لا مواد قبلية</p> : mats.map((m) => <MaterialLine key={m.id} m={m} />)}</div>
      {up && <UploadModal trip={trip} onClose={() => setUp(false)} preTrip />}
    </Card>
  );
}

function UploadModal({ trip, sessionId, onClose, preTrip }: { trip: Trip; sessionId?: string; onClose: () => void; preTrip?: boolean }) {
  const session = trip.sessions.find((s) => s.id === sessionId);
  const [f, setF] = useState({ title: '', type: 'pdf' as MaterialType, url: '', revealMode: 'auto' as 'auto' | 'manual', mandatory: true, points: false });
  const revealAt = session ? dateTime(session.date, session.end).toISOString() : undefined;
  return (
    <Modal open onClose={onClose} title={preTrip ? 'مادة قبلية' : `مادة للقاء: ${session?.title}`}
      footer={<><Button variant="secondary" onClick={onClose}>إلغاء</Button><Button disabled={!f.title} onClick={() => act(() => {
        repos.materials.add({ title: f.title, type: f.type, url: f.url || 'https://example.com', origin: preTrip ? 'pre_trip' : 'session', tripId: trip.id, sessionId, revealMode: preTrip ? 'auto' : f.revealMode, revealAt: preTrip ? undefined : revealAt, revealed: preTrip || f.revealMode === 'auto', audience: { kind: 'all' }, mandatory: preTrip ? f.mandatory : undefined, pointsRequested: preTrip && f.points });
        onClose();
      }, 'رُفعت المادة')}>ارفع</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="العنوان" className="sm:col-span-2"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="النوع"><Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as MaterialType })} options={Object.entries(materialTypeLabel).map(([value, label]) => ({ value, label }))} /></Field>
        <Field label="الرابط أو الملف"><Input dir="ltr" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} placeholder="https://" /></Field>
        {!preTrip && (
          <Field label="الظهور" className="sm:col-span-2">
            <Select value={f.revealMode} onChange={(e) => setF({ ...f, revealMode: e.target.value as 'auto' | 'manual' })} options={[{ value: 'auto', label: `تلقائياً بعد انتهاء اللقاء (${session ? fmtTime(session.end) : ''})` }, { value: 'manual', label: 'مخفية حتى أفتحها' }]} />
          </Field>
        )}
        {preTrip && <Toggle checked={f.mandatory} onChange={(v) => setF({ ...f, mandatory: v })} label="إلزامية" />}
        {preTrip && <Toggle checked={f.points} onChange={(v) => setF({ ...f, points: v })} label="بنقاط (يعتمدها القائد العام)" />}
      </div>
      <Notice>ستظهر المادة أيضاً في المكتبة بوسم "{preTrip ? 'مادة قبلية' : `مخصصة للقاء ${session?.title}`}".</Notice>
    </Modal>
  );
}

export { personName };
