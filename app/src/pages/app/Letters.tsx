// الخطابات: صندوق وارد مندوب الجمعية وسجلّه (قراءة لغيره بحسب الرؤية)، وطلب الخطاب من داخل الرحلة
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fmtDate, todayISO } from '@/domain/dates';
import { canRequestLetter, isDelegate, letterNext, letterStatusLabel, lettersCsv, lettersFor } from '@/domain/letters';
import type { Attachment, Letter, LetterStatus } from '@/domain/types';
import { act, personName, repos, useDB, useMe } from '@/state/store';
import { Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, Select, Table, Textarea } from '@/ui';
import { AttachmentInput } from '@/ui/attachments';

const tone = (s: LetterStatus) => ({ submitted: 'blue', preparing: 'orange', issued: 'green', delivered: 'gray', needs_edit: 'red' } as const)[s];

export function downloadCsv(name: string, text: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  a.download = name;
  a.click();
}

export default function LettersPage() {
  const db = useDB();
  const me = useMe();
  const [f, setF] = useState({ trip: '', type: '', status: '', from: '', to: '' });
  const list = useMemo(
    () => lettersFor(db, me.person.id).filter((l) =>
      (!f.trip || l.tripId === f.trip) && (!f.type || l.typeId === f.type) && (!f.status || l.status === f.status) && (!f.from || l.createdAt.slice(0, 10) >= f.from) && (!f.to || l.createdAt.slice(0, 10) <= f.to),
    ).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [db, me.person.id, f],
  );
  const delegate = isDelegate(db, me.person.id);
  const [open, setOpen] = useState<Letter | null>(null);
  return (
    <div>
      <PageHeader title="الخطابات" subtitle={delegate ? 'طلبات الخطابات من كل الرحلات' : 'سجل الخطابات'}
        actions={<Button variant="secondary" onClick={() => downloadCsv('letters.csv', lettersCsv(db, list))}>صدّر CSV</Button>} />
      {!db.settings.societyDelegateId
        ? <Empty title="لم يُعيَّن مندوب الجمعية بعد" text="يعيّنه القائد العام من بين الميسّرين" />
        : <p className="mb-3 text-xs text-ink-500">مندوب الجمعية: {personName(db, db.settings.societyDelegateId)}</p>}
      <Card className="mb-4">
        <div className="grid gap-2 sm:grid-cols-5">
          <Select value={f.trip} onChange={(e) => setF({ ...f, trip: e.target.value })} aria-label="الرحلة" options={[{ value: '', label: 'كل الرحلات' }, ...db.trips.map((t) => ({ value: t.id, label: t.title }))]} />
          <Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} aria-label="النوع" options={[{ value: '', label: 'كل الأنواع' }, ...db.letterTypes.map((t) => ({ value: t.id, label: t.name }))]} />
          <Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} aria-label="الحالة" options={[{ value: '', label: 'كل الحالات' }, ...(Object.keys(letterStatusLabel) as LetterStatus[]).map((s) => ({ value: s, label: letterStatusLabel[s] }))]} />
          <Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} aria-label="من" />
          <Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} aria-label="إلى" />
        </div>
      </Card>
      {!list.length ? <Empty title="لا خطابات بعد" text="يرفع أعضاء فرق الرحلات طلباتهم من تبويب «الخطابات» داخل الرحلة" /> : (
        <Card pad={false}>
          <Table>
            <thead><tr><th>الرحلة</th><th>النوع</th><th>الجهة</th><th>الحاجة قبل</th><th>الحالة</th><th>الخطوة التالية</th><th /></tr></thead>
            <tbody>
              {list.map((l) => (
                <tr key={l.id}>
                  <td><Link className="text-brand-700" to={`/app/trips/${l.tripId}?tab=letters`}>{db.trips.find((t) => t.id === l.tripId)?.title}</Link></td>
                  <td>{db.letterTypes.find((t) => t.id === l.typeId)?.name}</td>
                  <td>{l.addressee}</td>
                  <td className="num">{fmtDate(l.neededBy)}</td>
                  <td><Badge tone={tone(l.status)}>{letterStatusLabel[l.status]}</Badge></td>
                  <td className="text-xs text-ink-600">{letterNext[l.status]}</td>
                  <td>
                    {delegate && ['submitted', 'preparing'].includes(l.status) && <Button onClick={() => setOpen(l)}>أصدر</Button>}
                    {delegate && l.status === 'issued' && <Button variant="secondary" onClick={() => act(() => repos.letters.markDelivered(l.id), 'سُلّم الخطاب')}>سُلّم</Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
      {open && <IssueModal letter={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function IssueModal({ letter, onClose }: { letter: Letter; onClose: () => void }) {
  const db = useDB();
  const [number, setNumber] = useState('');
  const [date, setDate] = useState(todayISO());
  const [file, setFile] = useState<Attachment>();
  const [reason, setReason] = useState('');
  return (
    <Modal open onClose={onClose} title="إصدار الخطاب" footer={<Button disabled={!number || !file} onClick={() => act(() => { repos.letters.issue(letter.id, { number, date, file: file! }); onClose(); }, 'أُرسل الخطاب للطالب')}>أرسل للطالب</Button>}>
      <p className="mb-1 text-sm font-medium">{db.letterTypes.find((t) => t.id === letter.typeId)?.name} — {letter.addressee}</p>
      <p className="mb-3 whitespace-pre-wrap text-sm text-ink-600">{letter.purpose}</p>
      <p className="mb-3 text-xs text-ink-500">يُصدر الخطاب خارج المنصة بترويسة الجمعية، ثم ارفع الملف هنا برقمه وتاريخه.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="رقم الخطاب"><Input value={number} onChange={(e) => setNumber(e.target.value)} /></Field>
        <Field label="تاريخه"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <div className="sm:col-span-2"><AttachmentInput value={file} onChange={setFile} label="ملف الخطاب (PDF أو Word)" /></div>
      </div>
      <div className="mt-4 border-t border-ink-100 pt-3">
        <Field label="أو أعده للتعديل بسبب"><Textarea value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        <div className="mt-2"><Button variant="danger" disabled={!reason.trim()} onClick={() => act(() => { repos.letters.needsEdit(letter.id, reason); onClose(); }, 'أُعيد الطلب لمقدّمه')}>أعد للتعديل</Button></div>
      </div>
    </Modal>
  );
}

/** تبويب «الخطابات» داخل الرحلة: أي عضو في الفريق يطلب، والفريق يشاهد الطلبات */
export function TripLetters({ tripId }: { tripId: string }) {
  const db = useDB();
  const me = useMe();
  const trip = db.trips.find((t) => t.id === tripId)!;
  const list = lettersFor(db, me.person.id).filter((l) => l.tripId === tripId);
  const [adding, setAdding] = useState(false);
  return (
    <Card title="الخطابات" subtitle="يصدرها مندوب الجمعية ويحفظها في وثائق الرحلة"
      action={canRequestLetter(db, me.person.id, trip) && <Button onClick={() => setAdding(true)}>اطلب خطاباً</Button>}>
      {!list.length ? <Empty title="لا طلبات بعد" text="اطلب خطاباً مثل تسهيل مهمة أو حجز سكن" /> : (
        <ul className="divide-y divide-ink-100">
          {list.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
              <span className="font-medium">{db.letterTypes.find((t) => t.id === l.typeId)?.name}</span>
              <span className="text-ink-600">{l.addressee}</span>
              <Badge tone={tone(l.status)}>{letterStatusLabel[l.status]}</Badge>
              <span className="text-xs text-ink-500">{personName(db, l.requestedBy)} · {letterNext[l.status]}</span>
              {l.status === 'needs_edit' && <span className="text-xs text-red-700">السبب: {l.editReason}</span>}
              {l.issued && <span className="num text-xs text-ink-600">رقم {l.issued.number} · {fmtDate(l.issued.date)} · {l.issued.file.name}</span>}
              {l.status === 'needs_edit' && l.requestedBy === me.person.id && <Button variant="secondary" onClick={() => act(() => repos.letters.resubmit(l.id, {}), 'أُعيد الإرسال')}>أعد الإرسال</Button>}
            </li>
          ))}
        </ul>
      )}
      {adding && <RequestModal tripId={tripId} onClose={() => setAdding(false)} />}
    </Card>
  );
}

function RequestModal({ tripId, onClose }: { tripId: string; onClose: () => void }) {
  const db = useDB();
  const [f, setF] = useState({ typeId: db.letterTypes[0]?.id ?? '', addressee: '', purpose: '', neededBy: '', link: '' });
  const suggested = db.letterTypes.find((t) => t.id === f.typeId)?.suggestedText ?? '';
  const send = () => act(() => {
    repos.letters.request({ tripId, typeId: f.typeId, addressee: f.addressee, purpose: f.purpose, neededBy: f.neededBy, attachments: f.link ? [{ name: 'رابط مرفق', link: f.link }] : [] });
    onClose();
  }, 'رُفع الطلب لمندوب الجمعية');
  return (
    <Modal open onClose={onClose} title="طلب خطاب" footer={<Button onClick={send}>أرسل الطلب</Button>}>
      <div className="grid gap-3">
        <Field label="نوع الخطاب"><Select value={f.typeId} onChange={(e) => setF({ ...f, typeId: e.target.value })} options={db.letterTypes.map((t) => ({ value: t.id, label: t.name }))} /></Field>
        <Field label="الجهة الموجّه إليها"><Input value={f.addressee} onChange={(e) => setF({ ...f, addressee: e.target.value })} /></Field>
        <Field label="الغرض والتفاصيل" hint={suggested ? 'نص مقترح للصياغة، عدّله كما يلزم' : undefined}>
          <Textarea value={f.purpose} onChange={(e) => setF({ ...f, purpose: e.target.value })} placeholder={suggested} />
          {suggested && !f.purpose && <button type="button" className="mt-1 text-xs text-brand-700" onClick={() => setF({ ...f, purpose: suggested })}>استعمل النص المقترح</button>}
        </Field>
        <Field label="الحاجة قبل تاريخ"><Input type="date" value={f.neededBy} onChange={(e) => setF({ ...f, neededBy: e.target.value })} /></Field>
        <Field label="رابط مرفق (اختياري)"><Input dir="ltr" value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}
