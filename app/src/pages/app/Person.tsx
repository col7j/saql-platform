// ملف شخص للإدارة: سجل الملاحظات (لا يراه المشارك)، التقييم، الحضور، الرسوم
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fmtDateTime } from '@/domain/dates';
import { canSeeFacilitatorNotes, canSeeFinance, canSeePersonalPlan, canWriteFacilitatorNote, getCapabilities, groupOf } from '@/domain/permissions';
import { act, personName, repos, useDB, useMe, useScores } from '@/state/store';
import type { Attachment } from '@/domain/types';
import { Avatar, Badge, Button, Card, Empty, Field, Input, KeyVal, PageHeader, Progress, Textarea, askConfirm } from '@/ui';
import { AttachmentInput } from '@/ui/attachments';
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
          {p.kind === 'participant' && me.isLeader && <LeaderEvalCard participantId={p.id} />}
          {p.kind === 'staff' && me.isLeader && <StaffPublicCard personId={p.id} />}
          {sc && (
            <Card title="التقييم" subtitle={`الترتيب #${sc.rank} · ${sc.total} نقطة`}>
              <div className="space-y-2">
                {sc.individual.map((i) => (
                  <div key={i.key}><div className="mb-0.5 flex justify-between text-sm"><span>{i.name}</span><span className="num">{i.points} / {i.maxPoints}</span></div><Progress value={(i.points / (i.maxPoints || 1)) * 100} /><div className="text-xs text-ink-400">{i.detail}</div></div>
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
            {fee && canSeeFinance(db, me.person.id) && <KeyVal k="الرسوم" v={<Badge tone={fee.status === 'paid' ? 'green' : fee.status === 'partial' ? 'orange' : 'red'}>{{ paid: 'مسددة', partial: `جزئي ${fee.paidAmount}`, unpaid: 'غير مسددة' }[fee.status]}{fee.exemption ? ` (${fee.exemption})` : ''}</Badge>} />}
            {p.kind === 'participant' && canSeePersonalPlan(db, me.person.id, p.id) && <Link to={`/app/plans/${p.id}`} className="mt-2 block text-sm text-brand-600">عرض الخطة الشخصية</Link>}
          </Card>
          {transfers.length > 0 && <Card title="سجل النقل">{transfers.map((t) => <p key={t.id} className="text-sm">{db.groups.find((x) => x.id === t.fromGroupId)?.name} ← {db.groups.find((x) => x.id === t.toGroupId)?.name} <span className="text-xs text-ink-400">({fmtDateTime(t.at)})</span></p>)}</Card>}
        </div>
      </div>
    </div>
  );
}

/** تقييم القائد العام الفردي: مرة واحدة ببنود يحددها في الإعدادات (مجموعها 100) */
function LeaderEvalCard({ participantId }: { participantId: string }) {
  const db = useDB();
  const items = db.settings.leaderEvalItems;
  const ev = db.leaderEvaluations.find((e) => e.participantId === participantId);
  const [scores, setScores] = useState<Record<string, number>>(Object.fromEntries(items.map((i) => [i.key, 0])));
  const [note, setNote] = useState('');
  const total = items.reduce((s, i) => s + (ev ? ev.scores[i.key] ?? 0 : scores[i.key] ?? 0), 0);
  const max = items.reduce((s, i) => s + i.max, 0);
  return (
    <Card title="تقييمك الفردي (مرة واحدة)" subtitle={ev ? `قيّمته ${fmtDateTime(ev.at)} · ${total} من ${max}` : `${total} من ${max}`}>
      <div className="grid gap-2 sm:grid-cols-2">
        {items.map((i) => (
          <label key={i.key} className="flex items-center justify-between gap-2 rounded-xl bg-ink-50 px-3 py-2 text-sm">
            <span>{i.name} <span className="text-xs text-ink-400">/ {i.max}</span></span>
            {ev ? <b className="num">{ev.scores[i.key] ?? 0}</b> : <input type="number" min={0} max={i.max} className="num w-16 rounded-lg border border-ink-200 px-2 py-1" value={scores[i.key] ?? 0} onChange={(e) => setScores({ ...scores, [i.key]: Math.max(0, Math.min(i.max, +e.target.value)) })} />}
          </label>
        ))}
      </div>
      {ev?.note && <p className="mt-2 text-xs text-ink-500">{ev.note}</p>}
      {!ev && (
        <div className="mt-3 flex gap-2">
          <Textarea rows={1} placeholder="ملاحظة (اختياري)" value={note} onChange={(e) => setNote(e.target.value)} />
          <Button onClick={() => askConfirm({ title: 'حفظ التقييم', body: 'التقييم مرة واحدة ولا يُعدَّل بعد الحفظ.', cta: 'احفظ التقييم', run: () => act(() => repos.leaderEval.save(participantId, scores, note || undefined), 'حُفظ التقييم') })}>احفظ</Button>
        </div>
      )}
    </Card>
  );
}

/** القائد العام يضيف بيانات فريق العمل التي تظهر في رابط الداعم (بالأرقام) والموقع العام (بلا أرقام) */
function StaffPublicCard({ personId }: { personId: string }) {
  const db = useDB();
  const p = db.persons.find((x) => x.id === personId)!;
  const [f, setF] = useState({ title: p.title ?? '', phone: p.phone ?? '' });
  const [photo, setPhoto] = useState<Attachment | undefined>(p.photo);
  return (
    <Card title="البيانات العامة" subtitle="تظهر بموافقة ضمنية ضمن الشروط والأحكام العامة">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="المنصب"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="الجوال (رابط الداعم فقط)"><Input dir="ltr" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        <div className="sm:col-span-2"><AttachmentInput value={photo} onChange={setPhoto} label="الصورة" /></div>
      </div>
      <Button className="mt-3" onClick={() => act(() => repos.profile.saveStaff(personId, { title: f.title, phone: f.phone || undefined, photo }), 'حُفظت البيانات')}>احفظ</Button>
    </Card>
  );
}
