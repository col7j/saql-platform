import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { fmtDate, fmtDateTime, relativeDays } from '@/domain/dates';
import { tripTypeLabel } from '@/domain/labels';
import {
  canSeeEstimatedBudget, canSeeFinance, canTakeTripAttendance, canViewTripPlans, effectiveTrackerId, isTripTeam, trackerConflict, tripFacilitatorId, tripTeamIds, tripTeamLeaderId,
} from '@/domain/permissions';
import { canPublish, publishChecks, tripDeadlines, tripHasEnded, tripHasStarted, tripStage, tripStageLabel, tripStageOrder } from '@/domain/workflow';
import { act, personName, repos, useDB, useMe } from '@/state/store';
import { Badge, Button, Card, Checklist, Empty, Field, Icons, Input, KeyVal, Modal, Notice, PageHeader, Select, Tabs, cx } from '@/ui';
import { GroupBadge, PersonChip } from '@/ui/domain';
import DocsTab from './DocsTab';
import ScheduleTab from './ScheduleTab';
import PrepTab from './PrepTab';
import DataTab from './DataTab';
import AttendanceTab from './AttendanceTab';
import ClosureTab from './ClosureTab';
import { RequestPanel, canSeeOwnerBudget } from '../RequestPanel';

type TabKey = 'overview' | 'docs' | 'budget' | 'schedule' | 'prep' | 'data' | 'attendance' | 'closure';

export default function TripDetail() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const db = useDB();
  const me = useMe();
  const trip = db.trips.find((t) => t.id === id);
  const pid = me.person.id;
  const canPlans = trip ? canViewTripPlans(db, pid, trip) : false;
  const [tab, setTabState] = useState<TabKey>((params.get('tab') as TabKey) || (canPlans ? 'overview' : 'data'));
  const setTab = (t: TabKey) => { setTabState(t); setParams({ tab: t }, { replace: true }); };

  // تنبيه "بدأ الجدول" عند حلول وقته
  useEffect(() => {
    if (trip && trip.published && tripHasStarted(trip) && !tripHasEnded(trip) && !trip.scheduleStartedNotified) repos.trips.notifyScheduleStarted(trip.id);
    if (trip && trip.published && tripHasEnded(trip)) repos.trips.ensurePostSurvey(trip.id);
  }, [trip?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!trip) return <Empty title="الرحلة غير موجودة" />;
  const st = tripStage(db, trip);
  const team = isTripTeam(db, pid, trip);

  const tabs: { key: TabKey; label: string }[] = [];
  if (canPlans) {
    tabs.push({ key: 'overview', label: 'نظرة عامة' }, { key: 'docs', label: 'الخطط والاعتماد' });
    if (canSeeOwnerBudget(db, pid, 'trip', trip.id)) tabs.push({ key: 'budget', label: 'الميزانية' });
    tabs.push({ key: 'schedule', label: 'الجدول الزمني' }, { key: 'prep', label: 'التجهيز والمهام' });
  }
  tabs.push({ key: 'data', label: canPlans ? 'بيانات الرحلة (للمشاركين)' : 'تفاصيل الرحلة' });
  if (canTakeTripAttendance(db, pid, trip) || me.isStaff || tripTeamLeaderId(db, trip) === pid) tabs.push({ key: 'attendance', label: 'الحضور' });
  if (canPlans && ['live', 'closing', 'closed'].includes(st)) tabs.push({ key: 'closure', label: 'الإغلاق والتقييم' });
  const activeTab = tabs.some((t) => t.key === tab) ? tab : tabs[0].key;

  return (
    <div>
      <PageHeader
        back="/app/trips"
        title={trip.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={trip.type === 'external' ? 'orange' : 'blue'}>{tripTypeLabel[trip.type]}</Badge>
            {trip.executor.kind === 'group' ? <GroupBadge id={trip.executor.groupId} /> : <Badge tone="purple">{trip.type === 'internal' ? 'لقاء تطويري · فريق العمل' : 'فريق العمل'}</Badge>}
            {trip.isPersonalPlanMeeting && <Badge tone="green">لقاء الخطة الشخصية</Badge>}
            <span>{fmtDate(trip.startDate, { hijri: db.settings.showHijri })}</span>
            {trip.location && <span>· {trip.location}</span>}
          </span>
        }
        actions={<Badge tone={st === 'live' ? 'orange' : st === 'closed' ? 'green' : 'blue'} className="text-sm">{tripStageLabel[st]}</Badge>}
      />

      {canPlans && (
        <div className="mb-5 overflow-x-auto rounded-2xl border border-ink-100 bg-white p-3 shadow-card">
          <ol className="flex min-w-max items-center">
            {tripStageOrder.map((s, i) => {
              const idx = tripStageOrder.indexOf(st);
              const state = i < idx ? 'done' : i === idx ? 'current' : 'todo';
              return (
                <li key={s} className="flex items-center">
                  <span className={cx('flex items-center gap-1 rounded-full px-2.5 py-1 text-xs', state === 'done' && 'text-emerald-700', state === 'current' && 'bg-brand-600 font-bold text-white', state === 'todo' && 'text-ink-400')}>
                    {state === 'done' ? <Icons.Check className="h-3.5 w-3.5" /> : <span className="num">{i + 1}</span>}
                    {tripStageLabel[s]}
                  </span>
                  {i < tripStageOrder.length - 1 && <span className="mx-1 h-px w-5 bg-ink-200" />}
                </li>
              );
            })}
          </ol>
        </div>
      )}

      <Tabs value={activeTab} onChange={setTab} tabs={tabs} />

      {activeTab === 'overview' && <Overview tripId={trip.id} onTab={setTab} />}
      {activeTab === 'docs' && <DocsTab trip={trip} />}
      {activeTab === 'schedule' && <ScheduleTab trip={trip} />}
      {activeTab === 'prep' && <PrepTab trip={trip} />}
      {activeTab === 'data' && <DataTab trip={trip} />}
      {activeTab === 'attendance' && <AttendanceTab trip={trip} />}
      {activeTab === 'budget' && (
        <div className="space-y-4">
          <Notice>الرحلات تُقدَّم دائماً بموازنة تفصيلية (تصنيف ← بند ← عدد × سعر). ضمن المرصود تذهب لمسؤول المالية، وما يتجاوزه يذهب للقائد العام.</Notice>
          <RequestPanel ownerKind="trip" ownerId={trip.id} title="ميزانية الرحلة" />
        </div>
      )}
      {activeTab === 'closure' && <ClosureTab trip={trip} />}
      {!canPlans && !team && activeTab === 'data' && (
        <p className="mt-4 text-xs text-ink-400">خطط الرحلة وجداولها التفصيلية خاصة بالمجموعة المنفذة والإدارة.</p>
      )}
    </div>
  );
}

function Overview({ tripId, onTab }: { tripId: string; onTab: (t: TabKey) => void }) {
  const db = useDB();
  const me = useMe();
  const trip = db.trips.find((t) => t.id === tripId)!;
  const [editDate, setEditDate] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const leadId = tripTeamLeaderId(db, trip);
  const isLead = leadId === me.person.id;
  const checks = publishChecks(db, trip);
  const facId = tripFacilitatorId(db, trip);
  const trackerId = effectiveTrackerId(db, trip);
  const conflict = db.settings.trackerId ? trackerConflict(db, db.settings.trackerId, trip) : null;
  const teamIds = tripTeamIds(db, trip);
  const staffNonFac = db.persons.filter((p) => p.kind === 'staff' && p.id !== facId && !p.isGeneralLeader);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        {!trip.published && (
          <Card title="شروط نشر الرحلة" subtitle="قائد الفريق ينشر بلا اعتماد إضافي، لكن الزر لا يعمل إلا باكتمال الشروط">
            <Checklist items={checks} />
            <div className="mt-4 flex flex-wrap gap-2">
              {isLead && <Button disabled={!canPublish(db, trip)} onClick={() => act(() => repos.trips.publish(trip.id), 'نُشرت الرحلة ووصل التنبيه للجميع')} icon={<Icons.Send className="h-4 w-4" />}>انشر الرحلة</Button>}
              {!checks[3].ok && <Button variant="secondary" onClick={() => onTab('schedule')}>أكمل الجدول</Button>}
              {!checks[4].ok && <Button variant="secondary" onClick={() => onTab('data')}>أضف الضيوف</Button>}
            </div>
          </Card>
        )}
        {trip.published && <Notice tone="green" icon={<Icons.CheckCircle2 className="h-4 w-4" />}>نُشرت الرحلة {fmtDateTime(trip.publishedAt)}. {trip.scheduleVisibility === 'hidden' ? 'الجدول لم يُعرض للمشاركين بعد.' : 'الجدول معروض للمشاركين.'}</Notice>}

        <Card title="المواعيد النهائية" subtitle="التأخر يقلّل النقاط التي تكسبها المجموعة (لا خصم)">
          <div className="divide-y divide-ink-100">
            {tripDeadlines(db, trip).map((d) => (
              <div key={d.kind} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <span>{d.label}</span>
                <span className="flex items-center gap-2">
                  <span className="text-ink-500">{fmtDate(d.date)}</span>
                  {d.done ? <Badge tone={d.onTime ? 'green' : 'orange'}>{d.onTime ? 'رُفعت في وقتها' : 'رُفعت متأخرة'}</Badge> : d.late ? <Badge tone="red">متأخر</Badge> : <Badge>{relativeDays(d.date)}</Badge>}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {trip.description && <Card title="عن الرحلة"><p className="text-sm leading-7 text-ink-600">{trip.description}</p></Card>}
      </div>

      <div className="space-y-6">
        <Card title="الفريق والمسؤوليات">
          <KeyVal k={trip.executor.kind === 'staff' ? 'قائد فريق الرحلة' : 'قائد المجموعة'} v={<PersonChip id={leadId} size={24} />} />
          <KeyVal k={trip.executor.kind === 'staff' ? 'الميسّر (القائد العام)' : 'الميسّر'} v={<PersonChip id={facId} size={24} />} />
          <KeyVal k="مسؤول العهدة" v={<PersonChip id={leadId} size={24} />} />
          <KeyVal k="متابع الرحلة" v={<PersonChip id={trackerId} size={24} sub={trip.trackerSubstitute?.status === 'approved' ? 'بديل معتمد' : undefined} />} />
          <KeyVal k="المحضِّر" v={trip.attendanceTakerId ? <PersonChip id={trip.attendanceTakerId} size={24} /> : 'قائد الفريق'} />
          {trip.type === 'external' && <KeyVal k="مسؤول التنسيقات" v={trip.coordinationOwnerId ? <PersonChip id={trip.coordinationOwnerId} size={24} /> : '—'} />}
          {isLead && (
            <Field label="تحديد المحضِّر" className="mt-3">
              <Select value={trip.attendanceTakerId ?? ''} onChange={(e) => repos.trips.update(trip.id, { attendanceTakerId: e.target.value || undefined })} options={[{ value: '', label: 'أنا (قائد الفريق)' }, ...teamIds.filter((x) => x !== leadId).map((x) => ({ value: x, label: personName(db, x) }))]} />
            </Field>
          )}
          {isLead && trip.type === 'external' && (
            <Field label="مسؤول التنسيقات" className="mt-3">
              <Select value={trip.coordinationOwnerId ?? ''} onChange={(e) => repos.trips.update(trip.id, { coordinationOwnerId: e.target.value || undefined })} options={[{ value: '', label: '—' }, ...teamIds.map((x) => ({ value: x, label: personName(db, x) }))]} />
            </Field>
          )}
          <div className="mt-3 border-t border-ink-100 pt-3">
            <div className="mb-1 text-xs text-ink-500">أعضاء الفريق</div>
            <div className="flex flex-wrap gap-2">{teamIds.map((x) => <PersonChip key={x} id={x} size={22} />)}</div>
          </div>
        </Card>

        {(me.isLeader || me.isTracker) && (
          <Card title="متابع الرحلات">
            {conflict && !trip.trackerSubstitute && <Notice tone="orange">{conflict}: يلزم بديل.</Notice>}
            {trip.trackerSubstitute && (
              <div className="mb-3 text-sm">
                البديل المقترح: <b>{personName(db, trip.trackerSubstitute.candidateId)}</b> <Badge tone={trip.trackerSubstitute.status === 'approved' ? 'green' : trip.trackerSubstitute.status === 'rejected' ? 'red' : 'orange'}>{{ pending: 'بانتظار القائد العام', approved: 'معتمد', rejected: 'مرفوض' }[trip.trackerSubstitute.status]}</Badge>
                {trip.trackerSubstitute.reason && <p className="mt-1 text-xs text-ink-500">السبب: {trip.trackerSubstitute.reason}</p>}
                {me.isLeader && trip.trackerSubstitute.status === 'pending' && (
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant="success" onClick={() => act(() => repos.trips.decideTrackerSubstitute(trip.id, true), 'اعتُمد البديل')}>اعتمد</Button>
                    <Button size="sm" variant="secondary" onClick={() => act(() => repos.trips.decideTrackerSubstitute(trip.id, false))}>ارفض</Button>
                  </div>
                )}
              </div>
            )}
            {(me.isTracker || me.isLeader) && trip.trackerSubstitute?.status !== 'approved' && <Button size="sm" variant="secondary" onClick={() => setSubOpen(true)}>{me.isTracker ? 'اعتذار وترشيح بديل' : 'تعيين بديل'}</Button>}
            <SubstituteModal open={subOpen} onClose={() => setSubOpen(false)} tripId={trip.id} candidates={staffNonFac.filter((p) => p.id !== db.settings.trackerId).map((p) => p.id)} />
          </Card>
        )}

        {me.isLeader && (
          <Card title="إدارة الرحلة (القائد العام)">
            <Button size="sm" variant="secondary" onClick={() => setEditDate(true)} icon={<Icons.CalendarClock className="h-4 w-4" />}>عدّل التاريخ</Button>
            <EditDateModal open={editDate} onClose={() => setEditDate(false)} tripId={trip.id} />
          </Card>
        )}
      </div>
    </div>
  );
}

function SubstituteModal({ open, onClose, tripId, candidates }: { open: boolean; onClose: () => void; tripId: string; candidates: string[] }) {
  const db = useDB();
  const me = useMe();
  const [c, setC] = useState(candidates[0] ?? '');
  const [reason, setReason] = useState('');
  return (
    <Modal open={open} onClose={onClose} title="متابع بديل" footer={<><Button variant="secondary" onClick={onClose}>إلغاء</Button><Button onClick={() => act(() => { repos.trips.requestTrackerSubstitute(tripId, c, reason); if (me.isLeader) repos.trips.decideTrackerSubstitute(tripId, true); onClose(); }, 'أُرسل الطلب')}>أرسل</Button></>}>
      <Notice>البديل من أعضاء الإدارة، ولا يكون ميسّر هذه الرحلة. يوافق القائد العام ثم يتولى البديل المتابعة كاملة.</Notice>
      <Field label="البديل" className="mt-3"><Select value={c} onChange={(e) => setC(e.target.value)} options={candidates.map((x) => ({ value: x, label: personName(db, x) }))} /></Field>
      <Field label="سبب الاعتذار" className="mt-3"><Input value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
    </Modal>
  );
}

function EditDateModal({ open, onClose, tripId }: { open: boolean; onClose: () => void; tripId: string }) {
  const db = useDB();
  const t = db.trips.find((x) => x.id === tripId)!;
  const [s, setS] = useState(t.startDate);
  const [e, setE] = useState(t.endDate);
  return (
    <Modal open={open} onClose={onClose} title="تعديل تاريخ الرحلة" footer={<><Button variant="secondary" onClick={onClose}>إلغاء</Button><Button onClick={() => act(() => { repos.trips.update(tripId, { startDate: s, endDate: t.type === 'internal' ? s : e }); onClose(); }, 'عُدّل التاريخ ووصل التنبيه')}>احفظ</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="البداية"><Input type="date" value={s} onChange={(x) => setS(x.target.value)} /></Field>
        <Field label="النهاية"><Input type="date" value={t.type === 'internal' ? s : e} disabled={t.type === 'internal'} onChange={(x) => setE(x.target.value)} /></Field>
      </div>
      <p className="mt-3 text-xs text-ink-500">تظهر الرحلة في تقويم الجميع، وسيصلهم تنبيه بالتعديل. بنود الجدول لا تُنقل تلقائياً.</p>
    </Modal>
  );
}
