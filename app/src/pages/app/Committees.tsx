// اللجان (قسم 12.1): مساحة خاصة لكل لجنة: مهام، مؤشرات حية، إثباتات، أعضاء، شات
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fmtDateTime, timeAgo } from '@/domain/dates';
import { uid } from '@/domain/id';
import { canManageCommittee, canSeeCommittee } from '@/domain/permissions';
import { kpiValue } from '@/domain/workflow';
import type { CommitteeKind } from '@/domain/types';
import { act, personName, repos, useDB, useMe } from '@/state/store';
import { Avatar, Badge, Button, Card, Empty, Field, Icons, Input, Modal, PageHeader, Progress, Select, Tabs, Toggle, cx } from '@/ui';
import { PersonChip } from '@/ui/domain';
import { TaskModal, TaskRow } from './TaskParts';

const kindLabel: Record<CommitteeKind, string> = { finance: 'مالية', media: 'إعلامية', general: 'إدارة عامة', other: 'أخرى' };

export default function CommitteesPage() {
  const db = useDB();
  const me = useMe();
  const [creating, setCreating] = useState(false);
  const list = db.committees.filter((c) => canSeeCommittee(db, me.person.id, c.id));
  return (
    <div>
      <PageHeader title="اللجان" subtitle="لكل لجنة مساحة خاصة لا يراها إلا أعضاؤها" actions={me.isLeader && <Button onClick={() => setCreating(true)} icon={<Icons.Plus className="h-4 w-4" />}>لجنة جديدة</Button>} />
      {list.length === 0 ? <Empty title="لست عضواً في أي لجنة" /> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((c) => {
            const members = db.memberships.filter((m) => m.committeeId === c.id);
            const tasks = db.tasks.filter((t) => t.committeeId === c.id);
            return (
              <Link key={c.id} to={`/app/committees/${c.id}`} className="rounded-2xl border border-ink-100 bg-white p-4 shadow-card hover:border-brand-200">
                <div className="flex items-center justify-between"><h3 className="font-bold">{c.name}</h3><Badge>{kindLabel[c.kind]}</Badge></div>
                <p className="mt-1 text-xs text-ink-500">{c.description}</p>
                <div className="mt-3 flex -space-x-2 space-x-reverse">{members.slice(0, 6).map((m) => <Avatar key={m.id} name={personName(db, m.personId)} size={26} />)}</div>
                <div className="mt-3 text-xs text-ink-500">{members.length} أعضاء · {tasks.filter((t) => t.status !== 'done').length} مهام مفتوحة</div>
                {c.kpis.slice(0, 2).map((k) => { const v = kpiValue(db, c.id, k.taskTag); return <div key={k.id} className="mt-2"><div className="flex justify-between text-[11px]"><span>{k.title}</span><span className="num">{v}/{k.target}</span></div><Progress value={(v / k.target) * 100} /></div>; })}
              </Link>
            );
          })}
        </div>
      )}
      {creating && <CreateCommittee onClose={() => setCreating(false)} />}
    </div>
  );
}

function CreateCommittee({ onClose }: { onClose: () => void }) {
  const [f, setF] = useState({ name: '', kind: 'other' as CommitteeKind, description: '' });
  return (
    <Modal open onClose={onClose} title="لجنة جديدة" footer={<Button disabled={!f.name} onClick={() => act(() => { repos.committees.create(f); onClose(); }, 'أُنشئت اللجنة')}>إنشاء</Button>}>
      <div className="grid gap-3">
        <Field label="الاسم"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="النوع"><Select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as CommitteeKind })} options={Object.entries(kindLabel).map(([value, label]) => ({ value, label }))} /></Field>
        <Field label="الوصف"><Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

export function CommitteeDetail() {
  const { id } = useParams();
  const db = useDB();
  const me = useMe();
  const [tab, setTab] = useState<'tasks' | 'kpis' | 'proofs' | 'members' | 'chat'>('tasks');
  const [taskOpen, setTaskOpen] = useState(false);
  const c = db.committees.find((x) => x.id === id);
  if (!c || !canSeeCommittee(db, me.person.id, c.id)) return <Empty title="لا تملك صلاحية رؤية هذه اللجنة" text="عضو اللجنة يرى بيانات لجنته فقط." />;
  const manage = canManageCommittee(db, me.person.id, c.id);
  const members = db.memberships.filter((m) => m.committeeId === c.id);
  const tasks = db.tasks.filter((t) => t.committeeId === c.id);
  const proofs = tasks.filter((t) => t.status === 'done' && t.proof);

  return (
    <div>
      <PageHeader back="/app/committees" title={c.name} subtitle={c.description} actions={manage && tab === 'tasks' && <Button onClick={() => setTaskOpen(true)} icon={<Icons.Plus className="h-4 w-4" />}>مهمة</Button>} />
      <Tabs value={tab} onChange={setTab} tabs={[{ key: 'tasks', label: `المهام (${tasks.length})` }, { key: 'kpis', label: 'المؤشرات' }, { key: 'proofs', label: `الإثباتات (${proofs.length})` }, { key: 'members', label: `الأعضاء (${members.length})` }, { key: 'chat', label: 'النقاش' }]} />
      {tab === 'tasks' && <div className="space-y-2">{tasks.length === 0 ? <Empty title="لا مهام" /> : tasks.map((t) => <TaskRow key={t.id} task={t} />)}</div>}
      {tab === 'kpis' && <Kpis committeeId={c.id} manage={me.isLeader} />}
      {tab === 'proofs' && (
        <Card pad={false}>
          <ul className="divide-y divide-ink-100">
            {proofs.map((t) => <li key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm sm:px-5"><Icons.Paperclip className="h-4 w-4 text-brand-600" /><span className="flex-1">{t.title}</span><span className="max-w-[260px] truncate text-xs text-brand-700" dir="auto">{t.proof}</span><PersonChip id={t.assigneeId} size={22} /></li>)}
            {proofs.length === 0 && <li className="p-5 text-sm text-ink-400">لا إثباتات بعد</li>}
          </ul>
        </Card>
      )}
      {tab === 'members' && <Members committeeId={c.id} manage={manage} />}
      {tab === 'chat' && <Chat committeeId={c.id} />}
      <TaskModal open={taskOpen} onClose={() => setTaskOpen(false)} assignees={members.map((m) => m.personId)} defaults={{ scope: 'committee', committeeId: c.id }} />
    </div>
  );
}

function Kpis({ committeeId, manage }: { committeeId: string; manage: boolean }) {
  const db = useDB();
  const c = db.committees.find((x) => x.id === committeeId)!;
  const [f, setF] = useState({ title: '', target: 5, taskTag: '' });
  return (
    <Card title="المستهدفات ومؤشرات الأداء" subtitle="المؤشر يتحدث تلقائياً كلما أُغلقت مهمة بالوسم المحدد">
      <div className="space-y-4">
        {c.kpis.map((k) => {
          const v = kpiValue(db, c.id, k.taskTag);
          return (
            <div key={k.id}>
              <div className="mb-1 flex items-center justify-between text-sm"><span>{k.title} <Badge className="ms-1">وسم: {k.taskTag}</Badge></span><span className="flex items-center gap-2"><span className="num font-bold">{v}/{k.target}</span>{manage && <button onClick={() => repos.committees.removeKpi(c.id, k.id)} className="text-ink-300 hover:text-red-600"><Icons.X className="h-4 w-4" /></button>}</span></div>
              <Progress value={(v / k.target) * 100} label />
            </div>
          );
        })}
        {c.kpis.length === 0 && <p className="text-sm text-ink-400">لا مؤشرات</p>}
      </div>
      {manage && (
        <div className="mt-4 grid gap-2 rounded-xl bg-ink-50 p-3 sm:grid-cols-[1fr_90px_140px_auto]">
          <Input placeholder="المؤشر (مثال: تغريدة لكل رحلة)" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          <Input type="number" value={f.target} onChange={(e) => setF({ ...f, target: +e.target.value })} />
          <Input placeholder="وسم المهام" dir="ltr" value={f.taskTag} onChange={(e) => setF({ ...f, taskTag: e.target.value })} />
          <Button disabled={!f.title || !f.taskTag} onClick={() => act(() => { repos.committees.saveKpi(c.id, { id: uid('k'), ...f }); setF({ title: '', target: 5, taskTag: '' }); }, 'أُضيف المؤشر')}>إضافة</Button>
        </div>
      )}
    </Card>
  );
}

function Members({ committeeId, manage }: { committeeId: string; manage: boolean }) {
  const db = useDB();
  const me = useMe();
  const members = db.memberships.filter((m) => m.committeeId === committeeId);
  const requests = db.memberRequests.filter((r) => r.committeeId === committeeId);
  const [cand, setCand] = useState('');
  const [note, setNote] = useState('');
  const [decide, setDecide] = useState<{ id: string; role: 'leader' | 'member'; fin: boolean } | null>(null);
  const others = db.persons.filter((p) => !members.some((m) => m.personId === p.id));
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card title="الأعضاء">
        <ul className="space-y-2">
          {members.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-2">
              <PersonChip id={m.personId} sub={m.role === 'leader' ? 'قائد اللجنة' : 'عضو'} />
              <span className="flex items-center gap-2">
                {m.canSeeFinance && <Badge tone="orange">يرى المالية</Badge>}
                {me.isLeader && m.role !== 'leader' && <button onClick={() => act(() => repos.committees.removeMember(committeeId, m.personId), 'أُزيل العضو')} className="text-ink-300 hover:text-red-600"><Icons.UserMinus className="h-4 w-4" /></button>}
              </span>
            </li>
          ))}
        </ul>
      </Card>
      <Card title="طلبات إضافة عضو" subtitle="قائد اللجنة يرفع طلباً بشخص (من الإدارة أو المشاركين)، والقائد العام يوافق ويحدد دوره وصلاحياته">
        {manage && !me.isLeader && (
          <div className="mb-4 grid gap-2">
            <Select value={cand} onChange={(e) => setCand(e.target.value)} options={[{ value: '', label: 'اختر شخصاً' }, ...others.map((p) => ({ value: p.id, label: `${p.name} (${p.kind === 'staff' ? 'إدارة' : 'مشارك'})` }))]} />
            <Input placeholder="لماذا؟" value={note} onChange={(e) => setNote(e.target.value)} />
            <Button disabled={!cand} onClick={() => act(() => { repos.committees.requestMember(committeeId, cand, note); setCand(''); setNote(''); }, 'رُفع الطلب للقائد العام')}>رفع الطلب</Button>
          </div>
        )}
        {me.isLeader && (
          <div className="mb-4 flex gap-2">
            <Select value={cand} onChange={(e) => setCand(e.target.value)} options={[{ value: '', label: 'إضافة مباشرة' }, ...others.map((p) => ({ value: p.id, label: p.name }))]} />
            <Button disabled={!cand} onClick={() => act(() => { repos.committees.addMember(committeeId, cand, 'member', false); setCand(''); }, 'أُضيف العضو')}>إضافة</Button>
          </div>
        )}
        <ul className="space-y-2">
          {requests.map((r) => (
            <li key={r.id} className="rounded-xl border border-ink-100 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2"><PersonChip id={r.personId} sub={`بطلب ${personName(db, r.requestedBy)} · ${timeAgo(r.at)}`} /><Badge tone={r.status === 'approved' ? 'green' : r.status === 'rejected' ? 'red' : 'orange'}>{{ pending: 'بانتظار القائد العام', approved: 'موافق', rejected: 'مرفوض' }[r.status]}</Badge></div>
              {r.note && <p className="mt-1 text-xs text-ink-500">{r.note}</p>}
              {me.isLeader && r.status === 'pending' && (
                <div className="mt-2 flex gap-2">
                  <Button size="sm" variant="success" onClick={() => setDecide({ id: r.id, role: 'member', fin: false })}>موافقة</Button>
                  <Button size="sm" variant="secondary" onClick={() => act(() => repos.committees.decideRequest(r.id, false), 'رُفض الطلب')}>رفض</Button>
                </div>
              )}
            </li>
          ))}
          {requests.length === 0 && <li className="text-sm text-ink-400">لا طلبات</li>}
        </ul>
      </Card>
      <Modal open={!!decide} onClose={() => setDecide(null)} title="الموافقة وتحديد الدور والصلاحيات" footer={<Button onClick={() => act(() => { repos.committees.decideRequest(decide!.id, true, decide!.role, decide!.fin); setDecide(null); }, 'أُضيف العضو')}>موافقة</Button>}>
        {decide && (
          <div className="grid gap-3">
            <Field label="الدور"><Select value={decide.role} onChange={(e) => setDecide({ ...decide, role: e.target.value as 'leader' | 'member' })} options={[{ value: 'member', label: 'عضو' }, { value: 'leader', label: 'قائد لجنة' }]} /></Field>
            <Toggle checked={decide.fin} onChange={(v) => setDecide({ ...decide, fin: v })} label="يرى البيانات المالية" />
          </div>
        )}
      </Modal>
    </div>
  );
}

function Chat({ committeeId }: { committeeId: string }) {
  const db = useDB();
  const me = useMe();
  const [text, setText] = useState('');
  const msgs = db.chat.filter((m) => m.committeeId === committeeId);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ block: 'nearest' }), [msgs.length]);
  return (
    <Card pad={false}>
      <div className="h-[420px] space-y-3 overflow-y-auto p-4">
        {msgs.map((m) => {
          const mine = m.authorId === me.person.id;
          return (
            <div key={m.id} className={cx('flex gap-2', mine && 'flex-row-reverse')}>
              <Avatar name={personName(db, m.authorId)} size={28} />
              <div className={cx('max-w-[75%] rounded-2xl px-3 py-2', mine ? 'bg-brand-600 text-white' : 'bg-ink-100')}>
                <div className={cx('text-[11px]', mine ? 'text-white/75' : 'text-ink-500')}>{personName(db, m.authorId)} · {fmtDateTime(m.at)}</div>
                <div className="text-sm">{m.text}</div>
              </div>
            </div>
          );
        })}
        <div ref={end} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) { repos.committees.sendChat(committeeId, text); setText(''); } }} className="flex gap-2 border-t border-ink-100 p-3">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="اكتب رسالة للجنة" />
        <Button type="submit" icon={<Icons.Send className="h-4 w-4" />}>إرسال</Button>
      </form>
    </Card>
  );
}
