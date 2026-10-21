import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { addDays, fmtDate, relativeDays, todayISO } from '@/domain/dates';
import { tripTypeLabel } from '@/domain/labels';
import { isTripTeam, tripTeamLeaderId, trackerConflict } from '@/domain/permissions';
import { tripDeadlines, tripProgress, tripStage, tripStageLabel } from '@/domain/workflow';
import type { Trip, TripType } from '@/domain/types';
import { act, repos, useDB, useMe } from '@/state/store';
import { Badge, Button, Card, Empty, Field, Icons, Input, Modal, Notice, PageHeader, Progress, Select, Tabs, Textarea, Toggle, cx } from '@/ui';
import { GroupBadge } from '@/ui/domain';

export default function TripsPage() {
  const db = useDB();
  const me = useMe();
  const [tab, setTab] = useState<'upcoming' | 'mine' | 'past' | 'all'>('upcoming');
  const [creating, setCreating] = useState(false);
  const today = todayISO();
  const sorted = [...db.trips].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const list = sorted.filter((t) =>
    tab === 'upcoming' ? t.endDate >= today : tab === 'past' ? t.endDate < today : tab === 'mine' ? isTripTeam(db, me.person.id, t) : true,
  );
  const counts = db.settings.programCounts;

  return (
    <div>
      <PageHeader
        title="الرحلات"
        subtitle={`داخلية بفريق العمل (لقاء تطويري): ${counts.staffInternal} · داخلية بالمجموعات: ${counts.groupInternal * db.groups.length} · خارجية بالمجموعات: ${counts.groupExternal * db.groups.length} · خارجية بفريق العمل: ${counts.staffExternal}`}
        actions={me.isLeader && <Button onClick={() => setCreating(true)} icon={<Icons.Plus className="h-4 w-4" />}>إنشاء رحلة</Button>}
      />
      <Tabs value={tab} onChange={setTab} tabs={[{ key: 'upcoming', label: 'القادمة والجارية' }, { key: 'mine', label: 'ما أنفّذه' }, { key: 'past', label: 'السابقة' }, { key: 'all', label: 'الكل' }]} />
      {list.length === 0 ? <Empty title="لا رحلات هنا" /> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((t) => <TripCard key={t.id} trip={t} />)}
        </div>
      )}
      {creating && <CreateTripModal onClose={() => setCreating(false)} />}
    </div>
  );
}

export function TripCard({ trip: t }: { trip: Trip }) {
  const db = useDB();
  const me = useMe();
  const st = tripStage(db, t);
  const team = isTripTeam(db, me.person.id, t);
  const next = tripDeadlines(db, t).find((d) => !d.done);
  const showPrep = team || me.isStaff;
  return (
    <Link to={`/app/trips/${t.id}`} className="group flex flex-col rounded-2xl border border-ink-100 bg-white p-4 shadow-card transition hover:-translate-y-0.5 hover:border-brand-200">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone={t.type === 'external' ? 'orange' : 'blue'}>{tripTypeLabel[t.type]}</Badge>
        {t.executor.kind === 'staff' ? <Badge tone="purple">{t.type === 'internal' ? 'لقاء تطويري' : 'فريق العمل'}</Badge> : <GroupBadge id={t.executor.groupId} />}
        {t.isPersonalPlanMeeting && <Badge tone="green">لقاء الخطة الشخصية</Badge>}
        {team && <Badge tone="brand">فريقي</Badge>}
      </div>
      <h3 className="mt-3 font-bold leading-7 group-hover:text-brand-700">{t.title}</h3>
      <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-ink-500">
        <span className="inline-flex items-center gap-1"><Icons.Calendar className="h-3.5 w-3.5" />{fmtDate(t.startDate)}{t.endDate !== t.startDate && ` — ${fmtDate(t.endDate)}`}</span>
        {t.location && <span className="inline-flex items-center gap-1"><Icons.MapPin className="h-3.5 w-3.5" />{t.location}</span>}
      </div>
      <div className="mt-auto pt-4">
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className={cx('font-medium', st === 'live' ? 'text-accent-600' : st === 'closed' ? 'text-emerald-600' : 'text-brand-700')}>{showPrep || ['published', 'live', 'closing', 'closed'].includes(st) ? tripStageLabel[st] : 'قيد التجهيز'}</span>
          <span className="text-ink-400">{relativeDays(t.startDate)}</span>
        </div>
        <Progress value={tripProgress(db, t)} tone={st === 'live' ? 'accent' : 'brand'} />
        {showPrep && next && <div className={cx('mt-2 text-[11px]', next.late ? 'font-bold text-red-600' : 'text-ink-400')}>{next.late ? 'متأخر · ' : ''}{next.label}: {fmtDate(next.date)}</div>}
      </div>
    </Link>
  );
}

function CreateTripModal({ onClose }: { onClose: () => void }) {
  const db = useDB();
  const nav = useNavigate();
  const dd = db.settings.deadlineDefaults;
  const staff = db.persons.filter((p) => p.kind === 'staff' && !p.isGeneralLeader);
  const [f, setF] = useState({
    title: '', type: 'internal' as TripType, executorKind: 'group' as 'group' | 'staff', groupId: db.groups[0]?.id ?? '', leaderId: staff[0]?.id ?? '', memberIds: [] as string[],
    startDate: addDays(todayISO(), 30), endDate: addDays(todayISO(), 30), location: '', description: '', isPersonalPlanMeeting: false,
  });
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const deadlines = { initial: addDays(f.startDate, -dd.initialDaysBefore), detailed: addDays(f.startDate, -dd.detailedDaysBefore) };
  const [dl, setDl] = useState<typeof deadlines | null>(null);
  const finalDl = dl ?? deadlines;
  const executor = f.executorKind === 'group' ? { kind: 'group' as const, groupId: f.groupId } : { kind: 'staff' as const, leaderId: f.leaderId, memberIds: f.memberIds };
  const trackerWarn = db.settings.trackerId ? trackerConflict(db, db.settings.trackerId, { executor } as Trip) : null;
  const templates = db.taskTemplates.filter((t) => t.appliesTo === 'all' || t.appliesTo === f.type);

  const submit = () =>
    act(() => {
      if (!f.title.trim()) throw new Error('اسم الرحلة مطلوب');
      if (f.endDate < f.startDate) throw new Error('تاريخ النهاية قبل البداية');
      if (f.type === 'internal' && f.endDate !== f.startDate) throw new Error('الرحلة الداخلية لا تتجاوز يوماً');
      const id = repos.trips.create({ title: f.title, type: f.type, executor, startDate: f.startDate, endDate: f.endDate, location: f.location, description: f.description, isPersonalPlanMeeting: f.isPersonalPlanMeeting, deadlines: finalDl });
      onClose();
      nav(`/app/trips/${id}`);
    }, 'أُنشئت الرحلة وأُنشئت مهامها التلقائية');

  return (
    <Modal open onClose={onClose} title="إنشاء رحلة" wide footer={<><Button variant="secondary" onClick={onClose}>إلغاء</Button><Button onClick={submit}>إنشاء</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="اسم الرحلة" className="sm:col-span-2"><Input value={f.title} onChange={(e) => set({ title: e.target.value })} placeholder="مثال: رحلة أُحُد الخارجية" /></Field>
        <Field label="النوع">
          <Select value={f.type} onChange={(e) => { const type = e.target.value as TripType; set({ type, endDate: type === 'internal' ? f.startDate : addDays(f.startDate, 2) }); }} options={[{ value: 'internal', label: 'داخلية (داخل المدينة، يوم واحد)' }, { value: 'external', label: 'خارجية (سفر وسكن، أكثر من يوم)' }]} />
        </Field>
        <Field label="المنفّذ">
          <Select value={f.executorKind} onChange={(e) => set({ executorKind: e.target.value as 'group' | 'staff' })} options={[{ value: 'group', label: 'مجموعة' }, { value: 'staff', label: 'فريق العمل' }]} />
        </Field>
        {f.executorKind === 'group' ? (
          <Field label="المجموعة المنفذة" className="sm:col-span-2"><Select value={f.groupId} onChange={(e) => set({ groupId: e.target.value })} options={db.groups.map((g) => ({ value: g.id, label: g.name }))} /></Field>
        ) : (
          <>
            <Field label="قائد فريق الرحلة" hint="القائد العام هو الميسّر لرحلات فريق العمل"><Select value={f.leaderId} onChange={(e) => set({ leaderId: e.target.value })} options={staff.map((p) => ({ value: p.id, label: p.name }))} /></Field>
            <Field label="أعضاء الفريق">
              <div className="flex flex-wrap gap-1.5">
                {staff.filter((p) => p.id !== f.leaderId).map((p) => {
                  const on = f.memberIds.includes(p.id);
                  return <button key={p.id} type="button" onClick={() => set({ memberIds: on ? f.memberIds.filter((x) => x !== p.id) : [...f.memberIds, p.id] })} className={cx('chip border', on ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink-200 text-ink-500')}>{p.name}</button>;
                })}
              </div>
            </Field>
          </>
        )}
        <Field label="تاريخ البداية"><Input type="date" value={f.startDate} onChange={(e) => set({ startDate: e.target.value, endDate: f.type === 'internal' ? e.target.value : addDays(e.target.value, 2) })} /></Field>
        <Field label="تاريخ النهاية"><Input type="date" value={f.endDate} disabled={f.type === 'internal'} onChange={(e) => set({ endDate: e.target.value })} /></Field>
        <Field label="الموعد النهائي للخطة المبسطة"><Input type="date" value={finalDl.initial} onChange={(e) => setDl({ ...finalDl, initial: e.target.value })} /></Field>
        <Field label="الموعد النهائي للتفصيلية والموازنة"><Input type="date" value={finalDl.detailed} onChange={(e) => setDl({ ...finalDl, detailed: e.target.value })} /></Field>
        <Field label="المكان (مبدئي)"><Input value={f.location} onChange={(e) => set({ location: e.target.value })} /></Field>
        <div className="flex items-end pb-2"><Toggle checked={f.isPersonalPlanMeeting} onChange={(v) => set({ isPersonalPlanMeeting: v })} label="لقاء الخطة الشخصية (يفتح قسم الخطة)" /></div>
        <Field label="وصف" className="sm:col-span-2"><Textarea value={f.description} onChange={(e) => set({ description: e.target.value })} /></Field>
      </div>
      <div className="mt-4 space-y-2">
        {trackerWarn && <Notice tone="orange">{trackerWarn}. عيّن متابعاً بديلاً لهذه الرحلة بعد إنشائها.</Notice>}
        <Notice>
          <b>المهام التلقائية</b> التي ستُنشأ من القالب: {templates.map((t) => `${t.title} (${db.committees.find((c) => c.id === t.committeeId)?.name})`).join('، ') || 'لا شيء'}.
        </Notice>
      </div>
    </Modal>
  );
}

export { tripTeamLeaderId };
