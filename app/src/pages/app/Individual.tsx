// اللقاءات الفردية (قسم 8.1)
import { useState } from 'react';
import { addDays, fmtDate, fmtTime, todayISO } from '@/domain/dates';
import { groupOf } from '@/domain/permissions';
import type { IndividualMeeting } from '@/domain/types';
import { act, personName, repos, useDB, useMe } from '@/state/store';
import { Badge, Button, Card, Empty, Field, Icons, Input, Modal, PageHeader, Progress, Select, Table, Textarea } from '@/ui';
import { PersonChip } from '@/ui/domain';

export default function IndividualPage() {
  const me = useMe();
  return me.facilitatorOf.length ? <FacilitatorView /> : <ParticipantView />;
}

function ParticipantView() {
  const db = useDB();
  const me = useMe();
  const [reqOpen, setReqOpen] = useState(false);
  const g = groupOf(db, me.person.id);
  const today = todayISO();
  const target = db.settings.targets.individualMeetingsPerParticipant;
  const mine = db.individualMeetings.filter((m) => m.participantId === me.person.id && m.status !== 'cancelled');
  const done = mine.filter((m) => m.status === 'done');
  const slots = db.slots.filter((s) => s.facilitatorId === g?.facilitatorId && !s.bookedBy && s.date >= today && (s.invite === 'open' || s.invite === me.person.id));
  return (
    <div>
      <PageHeader title="اللقاءات الفردية" subtitle="لقاء مع ميسّر مجموعتك لمتابعة خطتك الشخصية" actions={<Button onClick={() => setReqOpen(true)} icon={<Icons.CalendarPlus className="h-4 w-4" />}>طلب موعد</Button>} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="أوقات متاحة للحجز" subtitle="إذا حُجز موعد لا يظهر لغيرك">
            {slots.length === 0 ? <Empty title="لا أوقات متاحة الآن" text="اطلب موعداً وسيتواصل معك الميسّر" /> : (
              <div className="grid gap-2 sm:grid-cols-2">
                {slots.map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded-xl border border-ink-100 px-3 py-2.5">
                    <div><div className="text-sm font-medium">{fmtDate(s.date, { weekday: true })}</div><div className="num text-xs text-ink-500">{fmtTime(s.start)} – {fmtTime(s.end)}</div>{s.invite === me.person.id && <Badge tone="orange" className="mt-1">طلب منك الميسّر الحجز</Badge>}</div>
                    <Button size="sm" onClick={() => act(() => repos.individual.book(s.id), 'حُجز الموعد')}>حجز</Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Card title="لقاءاتي">
            <MeetingList list={mine} viewer="participant" />
          </Card>
        </div>
        <div className="space-y-6">
          <Card title="ميسّري"><PersonChip id={g?.facilitatorId} sub={g?.name} /></Card>
          <Card title="المستهدف"><div className="mb-1 flex justify-between text-sm"><span>لقاءات منجزة</span><span className="num">{done.length}/{target}</span></div><Progress value={(done.length / target) * 100} /><p className="mt-2 text-xs text-ink-400">الميسّر يجلس مع كل مشارك {target} مرات على الأقل</p></Card>
        </div>
      </div>
      <RequestModal open={reqOpen} onClose={() => setReqOpen(false)} />
    </div>
  );
}

function MeetingList({ list, viewer }: { list: IndividualMeeting[]; viewer: 'participant' | 'facilitator' }) {
  const db = useDB();
  const [completing, setCompleting] = useState<IndividualMeeting | null>(null);
  const [approving, setApproving] = useState<IndividualMeeting | null>(null);
  const sorted = [...list].sort((a, b) => b.date.localeCompare(a.date));
  if (!sorted.length) return <p className="text-sm text-ink-400">لا لقاءات</p>;
  return (
    <div className="space-y-2">
      {sorted.map((m) => {
        const mat = db.materials.find((x) => x.id === m.attachmentMaterialId);
        return (
          <div key={m.id} className="rounded-xl border border-ink-100 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                {viewer === 'facilitator' ? <PersonChip id={m.participantId} size={26} /> : <Icons.CalendarCheck className="h-5 w-5 text-brand-600" />}
                <div className="text-sm"><span className="font-medium">{fmtDate(m.date)}</span> <span className="num text-ink-500">{m.status !== 'requested' && fmtTime(m.start)}</span></div>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={m.status === 'done' ? 'green' : m.status === 'requested' ? 'orange' : 'blue'}>{{ requested: 'طلب بانتظار الميسّر', booked: 'محجوز', done: 'تم', cancelled: 'ملغى' }[m.status]}</Badge>
                {viewer === 'facilitator' && m.status === 'requested' && <Button size="sm" onClick={() => setApproving(m)}>تأكيد موعد</Button>}
                {viewer === 'facilitator' && m.status === 'booked' && <Button size="sm" onClick={() => setCompleting(m)}>رفع الملاحظات</Button>}
                {m.status === 'booked' && <Button size="sm" variant="ghost" onClick={() => act(() => repos.individual.cancel(m.id), 'أُلغي اللقاء')}>إلغاء</Button>}
              </div>
            </div>
            {m.requestNote && <p className="mt-2 text-xs text-ink-500">ملاحظة الطلب: {m.requestNote}</p>}
            {m.status === 'done' && (
              <div className="mt-2 space-y-1 rounded-lg bg-ink-50 p-2 text-sm">
                {m.notesOnPlan && <p><b className="text-xs text-ink-500">على الخطة: </b>{m.notesOnPlan}</p>}
                {m.notesOnMeeting && <p><b className="text-xs text-ink-500">على اللقاء: </b>{m.notesOnMeeting}</p>}
                {mat && <p className="text-xs text-brand-700"><Icons.Paperclip className="me-1 inline h-3 w-3" />{mat.title} (في المكتبة)</p>}
              </div>
            )}
          </div>
        );
      })}
      {completing && <CompleteModal m={completing} onClose={() => setCompleting(null)} />}
      {approving && <ApproveModal m={approving} onClose={() => setApproving(null)} />}
    </div>
  );
}

function FacilitatorView() {
  const db = useDB();
  const me = useMe();
  const [f, setF] = useState({ date: addDays(todayISO(), 2), start: '17:00', end: '17:45', invite: 'open' });
  const members = me.facilitatorOf.flatMap((g) => g.memberIds);
  const target = db.settings.targets.individualMeetingsPerParticipant;
  const meetings = db.individualMeetings.filter((m) => m.facilitatorId === me.person.id && m.status !== 'cancelled');
  const slots = db.slots.filter((s) => s.facilitatorId === me.person.id && s.date >= todayISO()).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  return (
    <div>
      <PageHeader title="جدول اللقاءات الفردية" subtitle="انشر أوقات إتاحتك: دعوة عامة للمجموعة، أو طلب من شخص معين، أو استقبل طلبات المشاركين" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="نشر وقت إتاحة">
            <div className="grid gap-3 sm:grid-cols-5">
              <Field label="التاريخ" className="sm:col-span-2"><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
              <Field label="من"><Input type="time" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></Field>
              <Field label="إلى"><Input type="time" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} /></Field>
              <Field label="الدعوة"><Select value={f.invite} onChange={(e) => setF({ ...f, invite: e.target.value })} options={[{ value: 'open', label: 'دعوة عامة' }, ...members.map((m) => ({ value: m, label: personName(db, m) }))]} /></Field>
            </div>
            <Button className="mt-3" onClick={() => act(() => repos.individual.addSlot(f), 'نُشر الوقت')}>نشر</Button>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {slots.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-xl border border-ink-100 px-3 py-2 text-sm">
                  <div><div>{fmtDate(s.date)} · <span className="num">{fmtTime(s.start)}</span></div><div className="text-xs text-ink-500">{s.bookedBy ? `محجوز: ${personName(db, s.bookedBy)}` : s.invite === 'open' ? 'دعوة عامة' : `مخصص لـ ${personName(db, s.invite)}`}</div></div>
                  {!s.bookedBy && <button onClick={() => repos.individual.removeSlot(s.id)} className="text-ink-300 hover:text-red-600"><Icons.Trash2 className="h-4 w-4" /></button>}
                </div>
              ))}
            </div>
          </Card>
          <Card title="اللقاءات والطلبات"><MeetingList list={meetings} viewer="facilitator" /></Card>
        </div>
        <Card title="المستهدف لكل مشارك" subtitle={`${target} لقاءات على الأقل`}>
          <Table>
            <thead><tr><th>المشارك</th><th>المنجز</th></tr></thead>
            <tbody>
              {members.map((m) => {
                const n = meetings.filter((x) => x.participantId === m && x.status === 'done').length;
                return <tr key={m}><td><PersonChip id={m} size={22} /></td><td className="w-32"><div className="flex items-center gap-2"><Progress value={(n / target) * 100} tone={n >= target ? 'green' : 'brand'} className="flex-1" /><span className="num text-xs">{n}/{target}</span></div></td></tr>;
              })}
            </tbody>
          </Table>
        </Card>
      </div>
    </div>
  );
}

function RequestModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [f, setF] = useState({ date: addDays(todayISO(), 3), start: '17:00', note: '' });
  return (
    <Modal open={open} onClose={onClose} title="طلب لقاء فردي" footer={<><Button variant="secondary" onClick={onClose}>إلغاء</Button><Button onClick={() => act(() => { repos.individual.request(f.date, f.start, f.note); onClose(); }, 'أُرسل الطلب للميسّر')}>إرسال</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="التاريخ المقترح"><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        <Field label="الوقت المقترح"><Input type="time" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></Field>
        <Field label="ماذا تريد أن تناقش؟" className="sm:col-span-2"><Textarea value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

function ApproveModal({ m, onClose }: { m: IndividualMeeting; onClose: () => void }) {
  const [f, setF] = useState({ date: m.date, start: m.start, end: m.start.replace(/^(\d\d)/, (h) => String(Math.min(23, +h + 1)).padStart(2, '0')) });
  return (
    <Modal open onClose={onClose} title="تأكيد موعد" footer={<Button onClick={() => act(() => { repos.individual.approveRequest(m.id, f.date, f.start, f.end); onClose(); }, 'تأكد الموعد')}>تأكيد</Button>}>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="التاريخ"><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        <Field label="من"><Input type="time" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></Field>
        <Field label="إلى"><Input type="time" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

function CompleteModal({ m, onClose }: { m: IndividualMeeting; onClose: () => void }) {
  const db = useDB();
  const [f, setF] = useState({ plan: '', meeting: '', attTitle: '', attUrl: '', attType: 'pdf' as 'pdf' | 'video' | 'link' });
  return (
    <Modal open onClose={onClose} title={`ملاحظات اللقاء مع ${personName(db, m.participantId)}`}
      footer={<Button onClick={() => act(() => { repos.individual.complete(m.id, f.plan, f.meeting, f.attTitle ? { title: f.attTitle, url: f.attUrl, type: f.attType } : undefined); onClose(); }, 'حُفظت الملاحظات')}>حفظ وإنهاء</Button>}>
      <div className="grid gap-3">
        <Field label="ملاحظات على الخطة"><Textarea value={f.plan} onChange={(e) => setF({ ...f, plan: e.target.value })} /></Field>
        <Field label="ملاحظات على اللقاء"><Textarea value={f.meeting} onChange={(e) => setF({ ...f, meeting: e.target.value })} /></Field>
        <div className="grid gap-2 sm:grid-cols-3">
          <Field label="مرفق (اختياري)"><Input value={f.attTitle} onChange={(e) => setF({ ...f, attTitle: e.target.value })} placeholder="العنوان" /></Field>
          <Field label="النوع"><Select value={f.attType} onChange={(e) => setF({ ...f, attType: e.target.value as 'pdf' })} options={[{ value: 'pdf', label: 'ملف PDF' }, { value: 'video', label: 'رابط مقطع' }, { value: 'link', label: 'رابط' }]} /></Field>
          <Field label="الرابط"><Input dir="ltr" value={f.attUrl} onChange={(e) => setF({ ...f, attUrl: e.target.value })} /></Field>
        </div>
        <p className="text-xs text-ink-400">يظهر المرفق في المكتبة الخاصة بالمشارك.</p>
      </div>
    </Modal>
  );
}
