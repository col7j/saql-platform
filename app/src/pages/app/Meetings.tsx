// الاجتماعات: فريق العمل، ومع قادة المجموعات. مسؤول واحد يكتب المحضر.
// الحالات: مخطَّط ← مُنعقد ← محضر مرفوع ← مُغلق
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { addDays, fmtDate, fmtTime, todayISO } from '@/domain/dates';
import { isFinanceOwner, spendBlockReason } from '@/domain/finance';
import { SAR } from '@/domain/labels';
import type { Meeting, MeetingStatus } from '@/domain/types';
import { act, personName, repos, useDB, useMe } from '@/state/store';
import { Badge, Button, Card, Empty, Field, Icons, Input, Modal, Notice, PageHeader, Select, StatusPill, StepWizard, Tabs, Textarea, askConfirm, cx } from '@/ui';
import type { Tone } from '@/domain/labels';
import { PersonChip, TaskStatusBadge } from '@/ui/domain';

const stage: Record<MeetingStatus, { label: string; tone: Tone; next: string }> = {
  planned: { label: 'مخطَّط', tone: 'blue', next: 'يُعقد ثم يسجّل المسؤول الحضور' },
  held: { label: 'مُنعقد', tone: 'orange', next: 'يكتب المسؤول المحضر' },
  minutes: { label: 'محضر مرفوع', tone: 'purple', next: 'يغلق المسؤول الاجتماع' },
  closed: { label: 'مُغلق', tone: 'green', next: 'لا إجراء' },
};
const recurrenceLabel = { none: 'لا يتكرر', weekly: 'أسبوعياً', biweekly: 'كل أسبوعين', monthly: 'شهرياً' } as const;

function useVisibleMeetings() {
  const db = useDB();
  const me = useMe();
  // المسؤول المالي يرى كل الاجتماعات ليضع مرصودها
  return db.meetings.filter((m) => me.isLeader || me.isFinanceLead || m.ownerId === me.person.id || m.createdBy === me.person.id || m.inviteeIds.includes(me.person.id));
}

export default function MeetingsPage() {
  const db = useDB();
  const me = useMe();
  const list = useVisibleMeetings();
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [creating, setCreating] = useState(false);
  const today = todayISO();
  const shown = list.filter((m) => (tab === 'upcoming' ? m.status !== 'closed' : m.status === 'closed')).sort((a, b) => (tab === 'upcoming' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)));
  const canCreate = me.isStaff || !!me.leaderOf;
  return (
    <div>
      <PageHeader title="الاجتماعات" subtitle="اجتماعات فريق العمل، والاجتماعات مع قادة المجموعات" actions={canCreate && <Button onClick={() => setCreating(true)} icon={<Icons.Plus className="h-4 w-4" />}>{me.isStaff ? 'أنشئ اجتماعاً' : 'اطلب اجتماعاً'}</Button>} />
      <Tabs value={tab} onChange={setTab} tabs={[{ key: 'upcoming', label: 'القادمة والمفتوحة' }, { key: 'past', label: 'المغلقة' }]} />
      {shown.length === 0 ? <Empty title="لا اجتماعات" text={canCreate ? 'ابدأ بـ «أنشئ اجتماعاً».' : undefined} /> : (
        <div className="space-y-3">
          {shown.map((m) => (
            <Link key={m.id} to={`/app/meetings/${m.id}`} className="block rounded-2xl border border-ink-100 bg-white p-4 shadow-card hover:border-brand-200">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-bold">{m.title}</div>
                  <div className="text-xs text-ink-500">{fmtDate(m.date)} · {fmtTime(m.start)} · {m.location} · {m.kind === 'periodic' ? `دوري (${recurrenceLabel[m.recurrence]})` : 'طارئ'}{m.date < today && m.status === 'planned' ? ' · مضى موعده' : ''}</div>
                </div>
                <StatusPill {...stage[m.status]} waitingOn={m.status === 'closed' ? undefined : personName(db, m.ownerId)} compact />
              </div>
            </Link>
          ))}
        </div>
      )}
      {creating && <CreateMeeting onClose={() => setCreating(false)} />}
    </div>
  );
}

function CreateMeeting({ onClose }: { onClose: () => void }) {
  const db = useDB();
  const me = useMe();
  const nav = useNavigate();
  const staff = db.persons.filter((p) => p.kind === 'staff');
  const leaders = db.groups.map((g) => g.leaderId!).filter(Boolean);
  const [f, setF] = useState({
    title: '', kind: 'periodic' as Meeting['kind'], recurrence: 'weekly' as Meeting['recurrence'], withGroupLeaders: !me.isStaff,
    date: addDays(todayISO(), 3), start: '21:00', end: '22:00', location: '', ownerId: me.person.id,
    inviteeIds: me.isStaff ? staff.map((p) => p.id) : [me.person.id, db.persons.find((p) => p.isGeneralLeader)!.id], agenda: [''] as string[],
  });
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const toggle = (id: string) => set({ inviteeIds: f.inviteeIds.includes(id) ? f.inviteeIds.filter((x) => x !== id) : [...f.inviteeIds, id] });
  const pool = [...staff.map((p) => p.id), ...leaders];
  return (
    <Modal open onClose={onClose} title={me.isStaff ? 'اجتماع جديد' : 'طلب اجتماع'}>
      <StepWizard onCancel={onClose} finishLabel="أنشئ الاجتماع" onFinish={() => act(() => { const id = repos.meetings.create({ ...f, agenda: f.agenda.filter(Boolean), inviteeIds: [...new Set([...f.inviteeIds, f.ownerId])] }); onClose(); nav(`/app/meetings/${id}`); }, 'أُنشئ الاجتماع ووصلت الدعوات')} steps={[
        {
          title: 'العنوان والنوع', valid: !!f.title.trim(), hint: 'اكتب عنوان الاجتماع',
          content: (
            <div className="space-y-3">
              <Field label="العنوان"><Input value={f.title} onChange={(e) => set({ title: e.target.value })} placeholder="مثال: اجتماع فريق العمل الأسبوعي" /></Field>
              <div className="grid grid-cols-2 gap-2">
                {([['periodic', 'دوري'], ['urgent', 'طارئ']] as const).map(([k, l]) => <button key={k} type="button" onClick={() => set({ kind: k, recurrence: k === 'urgent' ? 'none' : 'weekly' })} className={cx('min-h-[48px] rounded-xl border text-sm', f.kind === k ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-ink-200')}>{l}</button>)}
              </div>
              {f.kind === 'periodic' && <Field label="يتكرر"><Select value={f.recurrence} onChange={(e) => set({ recurrence: e.target.value as Meeting['recurrence'] })} options={(['weekly', 'biweekly', 'monthly'] as const).map((k) => ({ value: k, label: recurrenceLabel[k] }))} /></Field>}
            </div>
          ),
        },
        {
          title: 'الموعد والمكان', valid: !!f.location.trim() && f.end > f.start, hint: 'حدد المكان، ووقت النهاية بعد البداية',
          content: (
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="التاريخ"><Input type="date" value={f.date} onChange={(e) => set({ date: e.target.value })} /></Field>
              <Field label="من"><Input type="time" value={f.start} onChange={(e) => set({ start: e.target.value })} /></Field>
              <Field label="إلى"><Input type="time" value={f.end} onChange={(e) => set({ end: e.target.value })} /></Field>
              <Field label="المكان" className="sm:col-span-3"><Input value={f.location} onChange={(e) => set({ location: e.target.value })} placeholder="مقر البرنامج، أو عن بعد" /></Field>
            </div>
          ),
        },
        {
          title: 'المدعوون والمسؤول', valid: f.inviteeIds.length > 0,
          content: (
            <div className="space-y-3">
              <Field label="المسؤول عن الاجتماع (يكتب المحضر)"><Select value={f.ownerId} onChange={(e) => set({ ownerId: e.target.value })} options={[...new Set([me.person.id, ...staff.map((p) => p.id)])].map((id) => ({ value: id, label: personName(db, id) }))} /></Field>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="ghost" onClick={() => set({ inviteeIds: [...new Set([...f.inviteeIds, ...staff.map((p) => p.id)])] })}>كل فريق العمل</Button>
                <Button size="sm" variant="ghost" onClick={() => set({ inviteeIds: [...new Set([...f.inviteeIds, ...leaders])], withGroupLeaders: true })}>كل قادة المجموعات</Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {pool.map((id) => <button key={id} type="button" onClick={() => toggle(id)} className={cx('chip min-h-[36px] border px-3', f.inviteeIds.includes(id) ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink-200 text-ink-500')}>{personName(db, id)}</button>)}
              </div>
            </div>
          ),
        },
        {
          title: 'الأجندة', valid: f.agenda.some((a) => a.trim()), hint: 'أضف بنداً واحداً على الأقل',
          content: (
            <div className="space-y-2">
              {f.agenda.map((a, i) => <Input key={i} value={a} placeholder={`البند ${i + 1}`} onChange={(e) => set({ agenda: f.agenda.map((x, j) => (j === i ? e.target.value : x)) })} />)}
              <Button size="sm" variant="secondary" onClick={() => set({ agenda: [...f.agenda, ''] })} icon={<Icons.Plus className="h-4 w-4" />}>أضف بنداً</Button>
            </div>
          ),
        },
      ]} />
    </Modal>
  );
}

export function MeetingDetail() {
  const { id } = useParams();
  const db = useDB();
  const me = useMe();
  const m = db.meetings.find((x) => x.id === id);
  const visible = useVisibleMeetings();
  const [attendees, setAttendees] = useState<string[]>(m?.attendeeIds.length ? m.attendeeIds : m?.inviteeIds ?? []);
  const [minutes, setMinutes] = useState(false);
  if (!m || !visible.some((x) => x.id === m.id)) return <Empty title="الاجتماع غير متاح" text="يرى الاجتماع المدعوون ومسؤوله والقائد العام." />;
  const isOwner = m.ownerId === me.person.id;
  const st = stage[m.status];
  const tasks = db.tasks.filter((t) => t.meetingId === m.id);
  const ownerFin = isFinanceOwner(db, me.person.id);
  const blocked = spendBlockReason(db, 'meeting');

  return (
    <div>
      <PageHeader back="/app/meetings" title={m.title} subtitle={`${fmtDate(m.date, { weekday: true })} · ${fmtTime(m.start)}–${fmtTime(m.end)} · ${m.location}`}
        actions={isOwner && (
          m.status === 'planned' ? <Button onClick={() => act(() => repos.meetings.markHeld(m.id, attendees), 'سُجّل الانعقاد والحضور')}>سجّل الانعقاد والحضور</Button>
            : m.status === 'held' ? <Button onClick={() => setMinutes(true)}>اكتب المحضر</Button>
              : m.status === 'minutes' ? <Button onClick={() => askConfirm({ title: 'إغلاق الاجتماع', body: m.recurrence !== 'none' && m.kind === 'periodic' ? `سيُغلق الاجتماع، ويُجدول الموعد التالي تلقائياً (${recurrenceLabel[m.recurrence]}).` : 'سيُغلق الاجتماع ولا يُعدَّل محضره بعدها.', cta: 'أغلق الاجتماع', run: () => act(() => repos.meetings.close(m.id), 'أُغلق الاجتماع') })}>أغلق الاجتماع</Button> : null
        )} />
      <div className="mb-5"><StatusPill {...st} waitingOn={m.status === 'closed' ? undefined : personName(db, m.ownerId)} /></div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="الأجندة"><ol className="list-decimal space-y-1 ps-5 text-sm">{m.agenda.map((a, i) => <li key={i}>{a}</li>)}</ol></Card>
          {m.status !== 'planned' && (
            <Card title="المحضر">
              {m.status === 'held' ? <p className="text-sm text-ink-500">{isOwner ? 'اكتب المحضر: ما دار، والقرارات، والمخرجات، والمهام.' : `بانتظار أن يكتب ${personName(db, m.ownerId)} المحضر.`}</p> : (
                <div className="space-y-3 text-sm">
                  {m.discussion && <div><div className="text-xs font-bold text-ink-500">ما دار</div><p className="whitespace-pre-line">{m.discussion}</p></div>}
                  {m.decisions.length > 0 && <div><div className="text-xs font-bold text-ink-500">القرارات</div><ul className="list-disc ps-5">{m.decisions.map((d, i) => <li key={i}>{d}</li>)}</ul></div>}
                  {m.outputs.length > 0 && <div><div className="text-xs font-bold text-ink-500">المخرجات</div><ul className="list-disc ps-5">{m.outputs.map((d, i) => <li key={i}>{d}</li>)}</ul></div>}
                </div>
              )}
            </Card>
          )}
          {tasks.length > 0 && (
            <Card title="المهام المرتبطة بالاجتماع" pad={false}>
              <ul className="divide-y divide-ink-100">{tasks.map((t) => <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"><span>{t.title}</span><span className="flex items-center gap-2"><PersonChip id={t.assigneeId} size={22} /><TaskStatusBadge task={t} /></span></li>)}</ul>
            </Card>
          )}
        </div>
        <div className="space-y-6">
          <Card title={m.status === 'planned' ? 'المدعوون' : 'الحضور'}>
            <ul className="space-y-2">
              {m.inviteeIds.map((pid) => (
                <li key={pid} className="flex min-h-[40px] items-center justify-between">
                  <PersonChip id={pid} size={24} sub={pid === m.ownerId ? 'المسؤول' : undefined} />
                  {m.status === 'planned' && isOwner ? <input type="checkbox" className="h-5 w-5 accent-brand-600" checked={attendees.includes(pid)} onChange={(e) => setAttendees(e.target.checked ? [...attendees, pid] : attendees.filter((x) => x !== pid))} aria-label="حضر" />
                    : m.status !== 'planned' && <Badge tone={m.attendeeIds.includes(pid) ? 'green' : 'gray'}>{m.attendeeIds.includes(pid) ? 'حضر' : 'غاب'}</Badge>}
                </li>
              ))}
            </ul>
            {m.status === 'planned' && isOwner && <p className="mt-2 text-xs text-ink-400">علّم الحاضرين ثم اضغط «سجّل الانعقاد والحضور».</p>}
          </Card>
          <Card title="التفاصيل">
            <p className="text-sm">{m.kind === 'periodic' ? `دوري: ${recurrenceLabel[m.recurrence]}` : 'طارئ'}{m.withGroupLeaders && ' · مع قادة المجموعات'}</p>
            {(ownerFin || me.isLeader || isOwner) && (
              <div className="mt-3 space-y-2 border-t border-ink-100 pt-3">
                <div className="text-sm">المرصود (للتخطيط): <b className="num">{SAR(m.allocated ?? db.programBudget.meetingDefault)}</b></div>
                {ownerFin && <AllocationEditor meeting={m} />}
                {blocked && <Notice tone="orange">{blocked}</Notice>}
              </div>
            )}
          </Card>
        </div>
      </div>
      {minutes && <MinutesModal meeting={m} onClose={() => setMinutes(false)} />}
    </div>
  );
}

function AllocationEditor({ meeting }: { meeting: Meeting }) {
  const [v, setV] = useState(meeting.allocated ?? 0);
  return (
    <div className="flex gap-2"><Input className="num" type="number" min={0} value={v} onChange={(e) => setV(Math.max(0, +e.target.value))} aria-label="المرصود" /><Button variant="secondary" onClick={() => act(() => repos.finance.setMeetingAllocation(meeting.id, v), 'حُفظ المرصود')}>احفظ المرصود</Button></div>
  );
}

function MinutesModal({ meeting: m, onClose }: { meeting: Meeting; onClose: () => void }) {
  const db = useDB();
  const [discussion, setDiscussion] = useState('');
  const [decisions, setDecisions] = useState(['']);
  const [outputs, setOutputs] = useState(['']);
  const [tasks, setTasks] = useState<{ title: string; assigneeId: string; dueDate: string }[]>([]);
  const list = (items: string[], setItems: (x: string[]) => void, ph: string) => (
    <div className="space-y-2">
      {items.map((a, i) => <Input key={i} value={a} placeholder={`${ph} ${i + 1}`} onChange={(e) => setItems(items.map((x, j) => (j === i ? e.target.value : x)))} />)}
      <Button size="sm" variant="secondary" onClick={() => setItems([...items, ''])} icon={<Icons.Plus className="h-4 w-4" />}>أضف</Button>
    </div>
  );
  return (
    <Modal open onClose={onClose} title={`محضر: ${m.title}`}>
      <StepWizard onCancel={onClose} finishLabel="ارفع المحضر" onFinish={() => act(() => { repos.meetings.saveMinutes(m.id, { discussion, decisions: decisions.filter(Boolean), outputs: outputs.filter(Boolean), tasks: tasks.filter((t) => t.title.trim()) }); onClose(); }, 'رُفع المحضر وأُنشئت المهام')} steps={[
        { title: 'ما دار', valid: !!discussion.trim(), hint: 'اكتب ملخص ما دار', content: <Textarea rows={6} value={discussion} onChange={(e) => setDiscussion(e.target.value)} placeholder="ملخص النقاش حسب بنود الأجندة" /> },
        { title: 'القرارات', content: list(decisions, setDecisions, 'القرار') },
        { title: 'المخرجات', content: list(outputs, setOutputs, 'المخرج') },
        {
          title: 'المهام', hint: 'كل مهمة تُنشأ في قسم المهام وتُربط بالاجتماع',
          content: (
            <div className="space-y-2">
              {tasks.map((t, i) => (
                <div key={i} className="grid grid-cols-2 gap-2 rounded-xl border border-ink-100 p-2 sm:grid-cols-[1.5fr_1fr_140px]">
                  <Input className="col-span-2 sm:col-span-1" placeholder="المهمة" value={t.title} onChange={(e) => setTasks(tasks.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
                  <Select value={t.assigneeId} onChange={(e) => setTasks(tasks.map((x, j) => (j === i ? { ...x, assigneeId: e.target.value } : x)))} options={m.inviteeIds.map((p) => ({ value: p, label: personName(db, p) }))} />
                  <Input type="date" value={t.dueDate} onChange={(e) => setTasks(tasks.map((x, j) => (j === i ? { ...x, dueDate: e.target.value } : x)))} />
                </div>
              ))}
              <Button size="sm" variant="secondary" onClick={() => setTasks([...tasks, { title: '', assigneeId: m.inviteeIds[0], dueDate: addDays(todayISO(), 7) }])} icon={<Icons.Plus className="h-4 w-4" />}>أضف مهمة</Button>
              {tasks.length === 0 && <p className="text-xs text-ink-400">لا مهام بعد. أضف ما خرج به الاجتماع من مهام.</p>}
            </div>
          ),
        },
      ]} />
    </Modal>
  );
}
