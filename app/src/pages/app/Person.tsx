// ملف شخص للإدارة: سجل الملاحظات (لا يراه المشارك)، التقييم، الحضور، الرسوم
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fmtDateTime } from '@/domain/dates';
import { canSeeFacilitatorNotes, canSeeFinance, canSeePersonalPlan, canWriteFacilitatorNote, getCapabilities, groupOf } from '@/domain/permissions';
import { act, personName, repos, useDB, useMe, useScores } from '@/state/store';
import { Avatar, Badge, Button, Card, Empty, KeyVal, PageHeader, Progress, Textarea } from '@/ui';
import { GroupBadge } from '@/ui/domain';

export default function PersonPage() {
  const { id } = useParams();
  const db = useDB();
  const me = useMe();
  const scores = useScores();
  const [note, setNote] = useState('');
  const p = db.persons.find((x) => x.id === id);
  if (!p) return <Empty title="غير موجود" />;
  if (!me.isStaff && me.person.id !== p.id) return <Empty title="لا تملك صلاحية" />;
  const caps = getCapabilities(db, p.id);
  const g = groupOf(db, p.id);
  const notes = db.facilitatorNotes.filter((n) => n.participantId === p.id).sort((a, b) => b.at.localeCompare(a.at));
  const sc = scores.persons.find((x) => x.personId === p.id);
  const att = db.attendance.filter((a) => a.personId === p.id && a.eventKind !== 'individual');
  const fee = db.fees.find((f) => f.personId === p.id);
  const transfers = db.transfers.filter((t) => t.personId === p.id);

  return (
    <div>
      <PageHeader back={me.isStaff ? '/app/people' : '/app'} title={<span className="flex items-center gap-3"><Avatar name={p.name} size={44} color={g?.color} />{p.name}</span>} subtitle={caps.labels.join(' · ')} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {p.kind === 'participant' && canSeeFacilitatorNotes(db, me.person.id) && (
            <Card title="سجل الملاحظات" subtitle="يكتبه الميسّر، ويراه القائد العام وأعضاء الإدارة. لا يراه المشارك">
              {notes.length === 0 && <p className="text-sm text-ink-400">لا ملاحظات</p>}
              <ul className="space-y-3">
                {notes.map((n) => (
                  <li key={n.id} className="rounded-xl bg-ink-50 p-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-ink-500"><b className="text-ink-800">{personName(db, n.authorId)}</b>{n.groupIdAtTime && <GroupBadge id={n.groupIdAtTime} />}{n.groupIdAtTime && n.groupIdAtTime !== g?.id && <Badge tone="orange">من الميسّر السابق</Badge>}<span>{fmtDateTime(n.at)}</span></div>
                    <p className="mt-1 text-sm">{n.text}</p>
                  </li>
                ))}
              </ul>
              {canWriteFacilitatorNote(db, me.person.id, p.id) && (
                <div className="mt-3 flex gap-2"><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="ملاحظة جديدة" /><Button disabled={!note.trim()} onClick={() => act(() => { repos.groups.addNote(p.id, note); setNote(''); }, 'أُضيفت الملاحظة')}>أضف</Button></div>
              )}
            </Card>
          )}
          {sc && (
            <Card title="التقييم" subtitle={`الترتيب #${sc.rank} · ${sc.total} نقطة`}>
              <div className="space-y-2">
                {sc.individual.map((i) => (
                  <div key={i.key}><div className="mb-0.5 flex justify-between text-sm"><span>{i.name}</span><span className="num">{i.points} / {i.maxPoints}</span></div><Progress value={(i.points / (i.maxPoints || 1)) * 100} /><div className="text-[11px] text-ink-400">{i.detail}</div></div>
                ))}
                <div className="flex justify-between border-t border-ink-100 pt-2 text-sm"><span>نصيبه من الجماعي</span><span className="num font-bold">{sc.groupShare}</span></div>
              </div>
            </Card>
          )}
        </div>
        <div className="space-y-6">
          <Card title="البيانات">
            <KeyVal k="البريد" v={<span dir="ltr">{p.email}</span>} />
            {p.university && <KeyVal k="الجامعة" v={p.university} />}
            {p.major && <KeyVal k="التخصص" v={p.major} />}
            {g && <KeyVal k="المجموعة" v={<GroupBadge id={g.id} />} />}
            {p.kind === 'participant' && <KeyVal k="الحضور" v={`${att.filter((a) => a.present).length} / ${att.length}`} />}
            {fee && canSeeFinance(db, me.person.id) && <KeyVal k="الرسوم" v={<Badge tone={fee.paid ? 'green' : 'red'}>{fee.paid ? 'مسددة' : 'غير مسددة'}</Badge>} />}
            {p.kind === 'participant' && canSeePersonalPlan(db, me.person.id, p.id) && <Link to={`/app/plans/${p.id}`} className="mt-2 block text-sm text-brand-600">عرض الخطة الشخصية</Link>}
          </Card>
          {transfers.length > 0 && <Card title="سجل النقل">{transfers.map((t) => <p key={t.id} className="text-sm">{db.groups.find((x) => x.id === t.fromGroupId)?.name} ← {db.groups.find((x) => x.id === t.toGroupId)?.name} <span className="text-xs text-ink-400">({fmtDateTime(t.at)})</span></p>)}</Card>}
        </div>
      </div>
    </div>
  );
}
