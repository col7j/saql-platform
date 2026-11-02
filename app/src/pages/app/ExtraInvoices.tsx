// فواتير إضافية: يرفعها صاحب العهدة بعد الشراء ويُستفاد منها لاحقاً. لا تُحتسب ضمن العهدة:
// لا في مصروفها ولا فائضها ولا إغلاقها. تظهر في تبويب العهدة، وفي «مراجعة الفواتير» لمن يراجع.
// المراجع يضع علامة «تمت مراجعتها» وملاحظة اختيارية، ولا يرفضها ولا يعتمدها كصرف.
import { useState } from 'react';
import { fmtDate, todayISO } from '@/domain/dates';
import { hasFinancePerm, ownerTitle } from '@/domain/finance';
import { SAR } from '@/domain/labels';
import { visibleExtraInvoices } from '@/domain/media';
import type { Attachment, Custody, ExtraInvoice } from '@/domain/types';
import { act, personName, repos, useDB, useMe } from '@/state/store';
import { Badge, Button, DataTable, Empty, Field, Icons, Input, Modal, Notice, Select, Textarea, askConfirm, type Column } from '@/ui';
import { AttachmentInput, AttachmentView } from '@/ui/attachments';
import { categoryLabel } from './CustodyCard';

const NOTE = 'لا تُحتسب ضمن العهدة: لا في مصروفها ولا فائضها ولا إغلاقها، وتبقى للاستفادة منها لاحقاً.';

function InvoiceForm({ custody, edit, onClose }: { custody: Custody; edit?: ExtraInvoice; onClose: () => void }) {
  const db = useDB();
  const [att, setAtt] = useState<Attachment | undefined>(edit?.attachment);
  const [amount, setAmount] = useState(edit?.amount ?? 0);
  const [date, setDate] = useState(edit?.date ?? todayISO());
  const [cat, setCat] = useState(edit?.categoryId ?? '');
  const [desc, setDesc] = useState(edit?.description ?? '');
  const save = () => act(() => {
    if (edit) repos.media.updateExtraInvoice(edit.id, { attachment: att, amount, date, categoryId: cat || undefined, description: desc });
    else repos.media.addExtraInvoice(custody.id, { attachment: att!, amount, date, categoryId: cat || undefined, description: desc });
    onClose();
  }, edit ? 'حُفظ التعديل' : 'أُضيفت الفاتورة الإضافية');
  return (
    <Modal open onClose={onClose} title={edit ? 'تعديل فاتورة إضافية' : 'فاتورة إضافية'} footer={<><Button variant="secondary" onClick={onClose}>إلغاء</Button><Button onClick={save} disabled={!att || !(amount > 0)}>احفظ</Button></>}>
      <div className="space-y-3">
        <Notice>{NOTE}</Notice>
        <AttachmentInput value={att} onChange={setAtt} label="صورة الفاتورة (إلزامية)" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="المبلغ (ر.س)"><Input className="num" type="number" value={amount || ''} onChange={(e) => setAmount(+e.target.value)} /></Field>
          <Field label="تاريخ الفاتورة"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        </div>
        <Field label="التصنيف"><Select value={cat} onChange={(e) => setCat(e.target.value)} options={[{ value: '', label: 'غير مصنف' }, ...db.budgetCategories.filter((c) => !c.hidden).map((c) => ({ value: c.id, label: c.name }))]} /></Field>
        <Field label="الوصف"><Textarea rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="ما الذي اشتريته؟" /></Field>
        <p className="text-xs text-ink-500">النشاط المرتبط: {ownerTitle(db, custody.ownerKind, custody.ownerId)} (تلقائي من العهدة)</p>
      </div>
    </Modal>
  );
}

function ReviewModal({ inv, onClose }: { inv: ExtraInvoice; onClose: () => void }) {
  const [note, setNote] = useState('');
  return (
    <Modal open onClose={onClose} title="تمت مراجعتها" footer={<><Button variant="secondary" onClick={onClose}>إلغاء</Button><Button onClick={() => act(() => { repos.media.reviewExtraInvoice(inv.id, note); onClose(); }, 'سُجّلت المراجعة')}>ضع العلامة</Button></>}>
      <p className="mb-3 text-sm text-ink-600">علامة مراجعة فقط: لا تُرفض الفاتورة ولا تُعتمد كصرف، وبعدها لا يعدّلها صاحبها ولا يحذفها.</p>
      <Field label="ملاحظة (اختيارية)"><Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
    </Modal>
  );
}

/** الجدول: داخل بطاقة العهدة (بلا عمودي النشاط وصاحب العهدة)، أو في «مراجعة الفواتير» بكل ما يراه الشخص */
export function ExtraInvoicesTable({ custody }: { custody?: Custody }) {
  const db = useDB();
  const me = useMe();
  const pid = me.person.id;
  const [editing, setEditing] = useState<ExtraInvoice | null>(null);
  const [reviewing, setReviewing] = useState<ExtraInvoice | null>(null);
  const rows = visibleExtraInvoices(db, pid).filter((x) => !custody || x.custodyId === custody.id).sort((a, b) => b.at.localeCompare(a.at));
  const reviewer = hasFinancePerm(db, pid, 'review_invoices');
  const cols: Column<ExtraInvoice>[] = [
    ...(custody ? [] : [{ key: 'act', header: 'النشاط', cell: (x: ExtraInvoice) => <span className="font-medium">{ownerTitle(db, x.ownerKind, x.ownerId)}</span> }, { key: 'who', header: 'صاحب العهدة', cell: (x: ExtraInvoice) => personName(db, x.addedBy) }]),
    { key: 'date', header: 'التاريخ', cell: (x) => fmtDate(x.date) },
    { key: 'desc', header: 'الوصف', cell: (x) => x.description || '—' },
    { key: 'cat', header: 'التصنيف', cell: (x) => (x.categoryId ? categoryLabel(db, x) : 'غير مصنف') },
    { key: 'amt', header: 'المبلغ', cell: (x) => <span className="num font-medium">{SAR(x.amount)}</span> },
    { key: 'inv', header: 'الفاتورة', cell: (x) => <AttachmentView a={x.attachment} compact /> },
    { key: 'st', header: 'الحالة', cell: (x) => (x.review ? <div><Badge tone="green">تمت مراجعتها</Badge>{x.review.note && <div className="mt-1 text-xs text-ink-500">{x.review.note}</div>}</div> : <Badge tone="orange">بانتظار المراجعة</Badge>) },
    { key: 'ops', header: '', cell: (x) => (
      <span className="flex flex-wrap gap-2">
        {x.addedBy === pid && !x.review && (<>
          <Button size="sm" variant="secondary" onClick={() => setEditing(x)}>عدّل</Button>
          <Button size="sm" variant="danger" onClick={() => askConfirm({ title: 'حذف الفاتورة', body: 'تُحذف نهائياً، ويبقى أثرها في سجل التدقيق.', cta: 'احذف', danger: true, run: () => act(() => repos.media.removeExtraInvoice(x.id), 'حُذفت الفاتورة') })}>احذف</Button>
        </>)}
        {reviewer && !x.review && x.addedBy !== pid && <Button size="sm" onClick={() => setReviewing(x)}>تمت مراجعتها</Button>}
      </span>
    ) },
  ];
  return (
    <div>
      <DataTable columns={cols} rows={rows} rowKey={(x) => x.id} minWidth={custody ? 760 : 980} actionsKey="ops" empty={<Empty title="لا فواتير إضافية" text={NOTE} icon={<Icons.ReceiptText className="h-7 w-7" />} />} />
      {editing && <InvoiceForm custody={db.custodies.find((c) => c.id === editing.custodyId)!} edit={editing} onClose={() => setEditing(null)} />}
      {reviewing && <ReviewModal inv={reviewing} onClose={() => setReviewing(null)} />}
    </div>
  );
}

/** تبويب «فواتير إضافية» في العهدة: زر الإضافة لصاحبها، والتوضيح بأنها خارج العهدة */
export function ExtraInvoicesPanel({ custody }: { custody: Custody }) {
  const me = useMe();
  const [adding, setAdding] = useState(false);
  return (
    <div className="space-y-4">
      <Notice>{NOTE}</Notice>
      {custody.recipientId === me.person.id && <Button onClick={() => setAdding(true)} icon={<Icons.Plus className="h-4 w-4" />}>أضف فاتورة إضافية</Button>}
      <ExtraInvoicesTable custody={custody} />
      {adding && <InvoiceForm custody={custody} onClose={() => setAdding(false)} />}
    </div>
  );
}
