// العهدة: التحويلات (والدفعة المؤجّلة)، نماذج الصرف ومراجعة كل بند، الإغلاق والتسوية. كل زر يظهر لمن يملك صلاحيته فقط.
import { useState } from 'react';
import { fmtDate, fmtDateTime, todayISO } from '@/domain/dates';
import { SAR, custodyStatusLabel, custodyStatusTone } from '@/domain/labels';
import { hasFinancePerm, ownerTitle, spendKindOf } from '@/domain/finance';
import { uid } from '@/domain/id';
import { CONTRACTS_CATEGORY, custodyCloseChecks, custodyFigures, formDuplicateWarnings, openCustodyConflict, splitWarning, walletBalance } from '@/domain/ledger';
import type { Attachment, BudgetOwnerKind, Custody, ProofKind, SpendForm, SpendLine } from '@/domain/types';
import { act, personName, repos, useDB, useMe } from '@/state/store';
import { Badge, Button, Card, Checklist, Field, Icons, Input, Modal, Notice, ReasonModal, Select, askConfirm, cx } from '@/ui';
import { AttachmentInput, AttachmentView } from '@/ui/attachments';
import { PersonChip } from '@/ui/domain';
import { EditRequestButton } from './EditRequest';

export function categoryLabel(db: ReturnType<typeof useDB>, l: { categoryId?: string; customCategory?: string }) {
  if (l.categoryId) return db.budgetCategories.find((x) => x.id === l.categoryId)?.name ?? '—';
  if (l.customCategory === CONTRACTS_CATEGORY) return l.customCategory;
  return `غير موجود: ${l.customCategory ?? '—'}`;
}

export function CustodyCard({ custody: c, embedded }: { custody: Custody; embedded?: boolean }) {
  const db = useDB();
  const me = useMe();
  const pid = me.person.id;
  const isRecipient = c.recipientId === pid;
  const can = (p: Parameters<typeof hasFinancePerm>[2]) => hasFinancePerm(db, pid, p);
  const f = custodyFigures(db, c);
  const forms = db.spendForms.filter((x) => x.custodyId === c.id);
  const [formOpen, setFormOpen] = useState(false);
  const [transfer, setTransfer] = useState(false);
  const [surplus, setSurplus] = useState<Attachment>();
  const [settle, setSettle] = useState(false);
  const checks = custodyCloseChecks(db, c);

  const body = (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm"><Badge tone={custodyStatusTone[c.status]}>عهدة {custodyStatusLabel[c.status]}</Badge> <PersonChip id={c.recipientId} size={22} sub="صاحب العهدة والمسؤول عنها" /></span>
        {isRecipient && c.status === 'active' && <Button size="sm" variant="secondary" onClick={() => askConfirm({ title: 'طلب الإغلاق المالي', body: 'يتوقف الصرف فوراً، وتحسب المنصة الفائض أو العجز، ثم تراجع المالية وتعتمد الإغلاق.', cta: 'أرسل طلب الإغلاق', run: () => act(() => repos.finance.requestClose(c.id), 'أُرسل طلب الإغلاق') })}>اطلب الإغلاق</Button>}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {([['المعتمد', c.approved], ['المحوَّل', f.transferred], ['المقبول', f.accepted], ['محجوز للمراجعة', f.held], [f.deficit > 0 ? 'عجز' : 'الرصيد', f.deficit > 0 ? f.deficit : f.balance]] as [string, number][]).map(([l, v]) => (
          <div key={l} className={cx('rounded-xl p-3', l === 'عجز' ? 'bg-red-50' : 'bg-ink-50')}><div className="text-xs text-ink-500">{l}</div><div className="num font-bold">{SAR(v)}</div></div>
        ))}
      </div>

      {/* التحويلات */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-bold">التحويلات</span>
          {can('disburse') && c.status === 'active' && f.toTransfer > 0 && <Button size="sm" onClick={() => setTransfer(true)} icon={<Icons.Banknote className="h-4 w-4" />}>حوّل الدفعة التالية ({SAR(f.toTransfer)})</Button>}
        </div>
        <ul className="space-y-1 text-sm">
          {c.transfers.map((t, i) => {
            const we = db.wallet.find((e) => e.id === t.walletEntryId);
            return <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink-100 px-3 py-2"><span><b>الدفعة {i + 1}</b>: <span className="num">{SAR(t.amount)}</span> · <span className="text-ink-500">{fmtDateTime(t.at)}</span></span><AttachmentView a={we?.attachment} compact /></li>;
          })}
          {f.toTransfer > 0 && <li className="rounded-xl border border-dashed border-accent-300 px-3 py-2 text-xs text-accent-700">دفعة مؤجّلة: {SAR(f.toTransfer)} تُحوَّل حين يكفي رصيد مسؤول المالية</li>}
        </ul>
      </div>

      {/* نماذج الصرف */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-bold">نماذج الصرف ({forms.length})</span>
          {isRecipient && c.status === 'active' && <Button size="sm" onClick={() => setFormOpen(true)} icon={<Icons.Plus className="h-4 w-4" />}>ارفع نموذج صرف</Button>}
        </div>
        {forms.length === 0 ? <p className="text-sm text-ink-400">لا نماذج بعد{isRecipient && c.status === 'active' ? '. ارفع نموذجاً بعد كل مصروف مع صورة الفاتورة.' : '.'}</p> : (
          <div className="space-y-2">{forms.map((x) => <SpendFormView key={x.id} form={x} custody={c} />)}</div>
        )}
        {f.deficit > 0 && c.status === 'active' && <p className="mt-2 text-xs text-red-700">المقبول تجاوز المحوَّل بـ {SAR(f.deficit)}: يُسجَّل عجزاً ويُسوّى عند الإغلاق.</p>}
      </div>

      {/* الإغلاق */}
      <details className="rounded-2xl border border-ink-100 p-3" open={c.status === 'closing'}>
        <summary className="cursor-pointer text-sm font-bold">الإغلاق المالي</summary>
        <div className="mt-3 space-y-3">
          <Checklist items={checks} />
          {c.status !== 'active' && <CloseTable custody={c} />}
          {isRecipient && c.status === 'closing' && f.surplus > 0.009 && !c.surplusReturn && (
            <div className="space-y-2 rounded-xl bg-accent-50 p-3">
              <p className="text-sm">حوّل الفائض <b className="num">{SAR(f.surplus)}</b> لحساب مسؤول المالية، ثم ارفع الإيصال.</p>
              <AttachmentInput value={surplus} onChange={setSurplus} label="إيصال تحويل الفائض" />
              <Button size="sm" disabled={!surplus} onClick={() => act(() => repos.finance.submitSurplusReturn(c.id, surplus!), 'رُفع الإيصال')}>أرسل الإيصال</Button>
            </div>
          )}
          {c.surplusReturn && !c.settlement && <p className="text-xs text-ink-600">رفع صاحب العهدة إيصال الفائض <AttachmentView a={c.surplusReturn.attachment} compact /></p>}
          {c.settlement && (
            <p className="rounded-xl bg-ink-50 p-2 text-xs">
              {c.settlement.kind === 'surplus' ? `استُلم فائض ${SAR(c.settlement.amount)} في المحفظة` : c.settlement.method === 'transfer' ? `حُوّل العجز ${SAR(c.settlement.amount)} لصاحب العهدة من رصيد المالية` : `سُوّي العجز ${SAR(c.settlement.amount)} من خارج العهدة، ويتحمّله ${c.settlement.bearer === 'holder' ? personName(db, c.recipientId) : 'مسؤول المالية'}`}
              {c.settlement.note && ` · ${c.settlement.note}`} <AttachmentView a={c.settlement.attachment} compact />
            </p>
          )}
          {can('close_custody') && c.status === 'closing' && !c.settlement && f.pendingLines === 0 && (f.surplus > 0.009 ? !!c.surplusReturn : f.deficit > 0.009) && (
            <Button variant="secondary" onClick={() => setSettle(true)}>{f.surplus > 0.009 ? 'أكّد استلام الفائض' : 'سوِّ العجز'}</Button>
          )}
          {can('close_custody') && c.status === 'closing' && (
            <Button disabled={!checks.every((x) => x.ok)} onClick={() => askConfirm({ title: 'اعتماد الإغلاق', body: `تُسجَّل عهدة «${ownerTitle(db, c.ownerKind, c.ownerId)}» مقفلة نهائياً.`, cta: 'اعتمد الإغلاق', run: () => act(() => repos.finance.closeCustody(c.id), 'أُغلقت العهدة') })}>اعتمد الإغلاق</Button>
          )}
          {c.status === 'closed' && <p className="text-xs text-emerald-700">أُغلقت العهدة {fmtDateTime(c.closedAt)} ({personName(db, c.closedBy)})</p>}
        </div>
      </details>

      {formOpen && <SpendFormModal custody={c} onClose={() => setFormOpen(false)} />}
      {transfer && <TransferModal custody={c} onClose={() => setTransfer(false)} />}
      {settle && <SettleModal custody={c} onClose={() => setSettle(false)} />}
    </div>
  );
  if (embedded) return <div className="rounded-2xl border border-ink-100 p-3 sm:p-4">{body}</div>;
  return <Card title={`عهدة: ${ownerTitle(db, c.ownerKind, c.ownerId)}`}>{body}</Card>;
}

/** جدول الإغلاق: كل البنود المعتمدة بفواتيرها، وفي آخره الفائض أو العجز */
function CloseTable({ custody: c }: { custody: Custody }) {
  const db = useDB();
  const f = custodyFigures(db, c);
  const accepted = f.lines.filter((l) => l.status === 'accepted');
  return (
    <div className="overflow-x-auto rounded-xl border border-ink-100">
      <table className="w-full text-xs">
        <thead className="bg-ink-50 text-ink-500"><tr><th className="p-2 text-start">البند</th><th className="p-2 text-start">التصنيف</th><th className="p-2 text-start">المورد</th><th className="p-2 text-start">الفاتورة</th><th className="p-2 text-start">المبلغ</th></tr></thead>
        <tbody>
          {accepted.map((l) => <tr key={l.id} className="border-t border-ink-100"><td className="p-2">{l.item}</td><td className="p-2">{categoryLabel(db, l)}</td><td className="p-2">{l.form.vendor}</td><td className="p-2"><AttachmentView a={l.form.attachment} compact /></td><td className="num p-2">{SAR(l.amount)}</td></tr>)}
          <tr className="border-t border-ink-200 font-bold"><td className="p-2" colSpan={4}>المقبول من المحوَّل {SAR(f.transferred)}</td><td className="num p-2">{SAR(f.accepted)}</td></tr>
          <tr className={cx('font-bold', f.deficit > 0 ? 'text-red-700' : 'text-emerald-700')}><td className="p-2" colSpan={4}>{f.deficit > 0 ? 'العجز' : 'الفائض'}</td><td className="num p-2">{SAR(f.deficit > 0 ? f.deficit : f.surplus)}</td></tr>
        </tbody>
      </table>
    </div>
  );
}

/** نموذج صرف واحد: كل بند يُراجَع وحده، مع تنبيهات التكرار والتجزئة للمراجع */
export function SpendFormView({ form: x, custody: c }: { form: SpendForm; custody: Custody }) {
  const db = useDB();
  const me = useMe();
  const reviewer = hasFinancePerm(db, me.person.id, 'review_invoices') && c.recipientId !== me.person.id;
  const [serial, setSerial] = useState(x.serial ?? '');
  const warnings = reviewer ? [...formDuplicateWarnings(db, x), splitWarning(db, x)].filter((w): w is string => !!w) : [];
  const anyPending = x.lines.some((l) => l.status === 'pending');
  return (
    <div className="rounded-xl border border-ink-100 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span><b>{x.vendor}</b> · {fmtDate(x.invoiceDate)} · {x.proofKind === 'invoice' ? 'فاتورة' : 'إيصال تحويل'} {x.serial ? <span className="text-xs text-ink-500">رقم {x.serial}</span> : <Badge tone="orange">بلا رقم تسلسلي</Badge>}</span>
        <AttachmentView a={x.attachment} />
      </div>
      {warnings.length > 0 && <div className="mt-2 space-y-1">{warnings.map((w) => <Notice key={w} tone="orange" icon={<Icons.TriangleAlert className="h-4 w-4" />}>{w}</Notice>)}</div>}
      {reviewer && anyPending && (
        <div className="mt-2 flex items-end gap-2">
          <Field label="الرقم التسلسلي (يُدخل يدوياً)" className="flex-1"><Input dir="ltr" value={serial} onChange={(e) => setSerial(e.target.value)} placeholder="مكان جاهز لقراءته آلياً لاحقاً" /></Field>
          <Button size="sm" variant="secondary" disabled={serial === (x.serial ?? '')} onClick={() => act(() => repos.finance.setSerial(x.id, serial), 'حُفظ الرقم')}>احفظ</Button>
        </div>
      )}
      <ul className="mt-2 space-y-1.5">{x.lines.map((l) => <LineRow key={l.id} form={x} line={l} reviewer={reviewer} />)}</ul>
    </div>
  );
}

function LineRow({ form, line: l, reviewer }: { form: SpendForm; line: SpendLine; reviewer: boolean }) {
  const db = useDB();
  const cats = db.budgetCategories.filter((x) => !x.hidden);
  const [cat, setCat] = useState(l.categoryId ?? '');
  const [amount, setAmount] = useState(l.amount);
  const [rejecting, setRejecting] = useState(false);
  const tone = l.status === 'accepted' ? 'green' : l.status === 'rejected' ? 'red' : 'orange';
  return (
    <li className={cx('rounded-lg px-2 py-1.5 text-xs', l.status === 'rejected' ? 'bg-red-50/60' : 'bg-ink-50')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>{categoryLabel(db, l)} · {l.item}</span>
        <span className="flex items-center gap-2">
          <span className="num font-bold">{SAR(l.amount)}</span>
          <Badge tone={tone}>{{ accepted: 'معتمد', rejected: 'مرفوض', pending: 'محجوز للمراجعة' }[l.status]}</Badge>
          {l.status === 'accepted' && <EditRequestButton target={{ kind: 'spend_line', formId: form.id, lineId: l.id }} current={{ amount: l.amount, categoryId: l.categoryId }} title={`${l.item}`} />}
        </span>
      </div>
      {l.original && <div className="text-xs text-ink-400">عدّلته المالية: كان {categoryLabel(db, l.original)} · {SAR(l.original.amount)}</div>}
      {l.reviewNote && <div className={cx('text-xs', l.status === 'rejected' ? 'text-red-700' : 'text-ink-500')}>{l.reviewNote}</div>}
      {reviewer && l.status === 'pending' && (
        <div className="mt-1.5 grid gap-2 sm:grid-cols-[1fr_100px_auto_auto]">
          <Select value={cat} onChange={(e) => setCat(e.target.value)} options={[{ value: '', label: l.customCategory ? `اختر بديلاً لـ «${l.customCategory}»` : '—' }, ...cats.map((x) => ({ value: x.id, label: x.name }))]} aria-label="التصنيف" />
          <Input className="num" type="number" value={amount} onChange={(e) => setAmount(+e.target.value)} aria-label="المبلغ" />
          <Button size="sm" onClick={() => act(() => repos.finance.reviewLine(form.id, l.id, { accept: true, categoryId: cat || undefined, amount }), 'اعتُمد البند')}>اعتمد</Button>
          <Button size="sm" variant="danger" onClick={() => setRejecting(true)}>ارفض</Button>
        </div>
      )}
      <ReasonModal open={rejecting} onClose={() => setRejecting(false)} title="ارفض البند" label="السبب (يصل لصاحب العهدة، ويُفك الحجز)" cta="ارفض البند" onSubmit={(r) => act(() => repos.finance.reviewLine(form.id, l.id, { accept: false, note: r }), 'رُفض البند')} />
    </li>
  );
}

type DraftLine = { id: string; categoryId: string; customCategory: string; item: string; amount: number };
export function LinesEditor({ lines, onChange }: { lines: DraftLine[]; onChange: (l: DraftLine[]) => void }) {
  const db = useDB();
  const cats = db.budgetCategories.filter((x) => !x.hidden);
  const upd = (id: string, p: Partial<DraftLine>) => onChange(lines.map((l) => (l.id === id ? { ...l, ...p } : l)));
  return (
    <div className="space-y-2">
      {lines.map((l) => (
        <div key={l.id} className="grid grid-cols-2 gap-2 rounded-xl border border-ink-100 p-2 sm:grid-cols-[1fr_1fr_1.3fr_90px_auto]">
          <Select value={l.categoryId} onChange={(e) => upd(l.id, { categoryId: e.target.value })} options={[...cats.map((c) => ({ value: c.id, label: c.name })), { value: '', label: 'غير موجود (اكتب اسمه)' }]} aria-label="التصنيف" />
          {l.categoryId ? <span /> : <Input placeholder="اسم التصنيف المقترح" value={l.customCategory} onChange={(e) => upd(l.id, { customCategory: e.target.value })} />}
          <Input placeholder="البند (شرح حر)" value={l.item} onChange={(e) => upd(l.id, { item: e.target.value })} />
          <Input className="num" type="number" min={0} value={l.amount || ''} onChange={(e) => upd(l.id, { amount: +e.target.value })} aria-label="المبلغ" />
          {lines.length > 1 && <button className="min-h-[44px]" onClick={() => onChange(lines.filter((x) => x.id !== l.id))} aria-label="احذف البند"><Icons.X className="h-4 w-4 text-ink-400" /></button>}
        </div>
      ))}
      <Button size="sm" variant="secondary" onClick={() => onChange([...lines, newLine(cats[0]?.id ?? '')])} icon={<Icons.Plus className="h-4 w-4" />}>أضف بنداً</Button>
    </div>
  );
}
export const newLine = (categoryId: string): DraftLine => ({ id: uid('dl'), categoryId, customCategory: '', item: '', amount: 0 });
export const toLines = (lines: DraftLine[]) => lines.map((l) => ({ categoryId: l.categoryId || undefined, customCategory: l.categoryId ? undefined : l.customCategory, item: l.item, amount: l.amount }));

/** نموذج الصرف: فاتورة أو إيصال تحويل + المورد والتاريخ والرقم + بنود */
function SpendFormModal({ custody, onClose }: { custody: Custody; onClose: () => void }) {
  const db = useDB();
  const [p, setP] = useState({ vendor: '', serial: '', invoiceDate: todayISO(), proofKind: 'invoice' as ProofKind });
  const [attachment, setAttachment] = useState<Attachment>();
  const [lines, setLines] = useState<DraftLine[]>([newLine(db.budgetCategories[0]?.id ?? '')]);
  const total = Math.round(lines.reduce((s, l) => s + (l.amount || 0), 0) * 100) / 100;
  const f = custodyFigures(db, custody);
  const save = () => act(() => { repos.finance.submitSpendForm(custody.id, { ...p, attachment: attachment!, lines: toLines(lines) }); onClose(); }, 'أُرسل النموذج للمراجعة، والمبلغ محجوز حتى تعتمده المالية');
  return (
    <Modal open onClose={onClose} title="نموذج صرف" wide footer={<><Button variant="ghost" onClick={onClose}>إلغاء</Button><Button disabled={!attachment} onClick={save}>أرسل النموذج</Button></>}>
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="نوع الإثبات"><Select value={p.proofKind} onChange={(e) => setP({ ...p, proofKind: e.target.value as ProofKind })} options={[{ value: 'invoice', label: 'فاتورة' }, { value: 'transfer_receipt', label: 'إيصال تحويل' }]} /></Field>
          <AttachmentInput value={attachment} onChange={setAttachment} label={p.proofKind === 'invoice' ? 'صورة الفاتورة (إلزامية)' : 'إيصال التحويل (إلزامي)'} onSerial={(serial) => setP((x) => ({ ...x, serial }))} />
          <Field label="المورد"><Input value={p.vendor} onChange={(e) => setP({ ...p, vendor: e.target.value })} /></Field>
          <Field label="تاريخ الفاتورة"><Input type="date" value={p.invoiceDate} onChange={(e) => setP({ ...p, invoiceDate: e.target.value })} /></Field>
          <Field label="الرقم التسلسلي (إن وُجد)"><Input dir="ltr" value={p.serial} onChange={(e) => setP({ ...p, serial: e.target.value })} /></Field>
        </div>
        <LinesEditor lines={lines} onChange={setLines} />
        <p className={cx('text-xs', total > f.available ? 'text-accent-700' : 'text-ink-500')}>المجموع {SAR(total)} · المتاح في العهدة {SAR(Math.max(0, f.available))}{total > f.available ? ' · يُقبل ويُسجَّل الفرق عجزاً' : ''}</p>
      </div>
    </Modal>
  );
}

function TransferModal({ custody: c, onClose }: { custody: Custody; onClose: () => void }) {
  const db = useDB();
  const f = custodyFigures(db, c);
  const balance = walletBalance(db);
  const [amount, setAmount] = useState(Math.min(f.toTransfer, Math.max(0, balance)));
  const [attachment, setAttachment] = useState<Attachment>();
  return (
    <Modal open onClose={onClose} title="تحويل الدفعة التالية" footer={<><Button variant="ghost" onClick={onClose}>إلغاء</Button><Button disabled={!attachment || !(amount > 0)} onClick={() => act(() => { repos.finance.transferMore(c.id, amount, attachment!); onClose(); }, 'سُجّل التحويل')}>حوّل</Button></>}>
      <div className="space-y-3">
        <p className="text-sm">المتبقي من المعتمد {SAR(f.toTransfer)} · رصيدك الفعلي {SAR(balance)}</p>
        <Field label="المبلغ"><Input className="num" type="number" value={amount} onChange={(e) => setAmount(+e.target.value)} /></Field>
        <AttachmentInput value={attachment} onChange={setAttachment} label="إيصال التحويل (إلزامي)" />
      </div>
    </Modal>
  );
}

function SettleModal({ custody: c, onClose }: { custody: Custody; onClose: () => void }) {
  const db = useDB();
  const f = custodyFigures(db, c);
  const [method, setMethod] = useState<'transfer' | 'external'>('transfer');
  const [bearer, setBearer] = useState<'finance_officer' | 'holder'>('holder');
  const [attachment, setAttachment] = useState<Attachment>();
  const [note, setNote] = useState('');
  if (f.surplus > 0.009)
    return (
      <Modal open onClose={onClose} title={`استلام الفائض ${SAR(f.surplus)}`} footer={<Button onClick={() => act(() => { repos.finance.settle(c.id, { method: 'transfer' }); onClose(); }, 'أُضيف الفائض لرصيدك')}>أكّد الاستلام</Button>}>
        <p className="text-sm">يُضاف الفائض لرصيد المحفظة مربوطاً بإيصال صاحب العهدة.</p>
      </Modal>
    );
  return (
    <Modal open onClose={onClose} title={`تسوية العجز ${SAR(f.deficit)}`} footer={<Button disabled={!attachment} onClick={() => act(() => { repos.finance.settle(c.id, { method, bearer, attachment, note }); onClose(); }, 'سُوّي العجز')}>سجّل التسوية</Button>}>
      <div className="space-y-3">
        <Select value={method} onChange={(e) => setMethod(e.target.value as 'transfer' | 'external')} options={[{ value: 'transfer', label: `حوّله لـ ${personName(db, c.recipientId)} من رصيدي (${SAR(walletBalance(db))})` }, { value: 'external', label: 'تسوية من خارج العهدة' }]} aria-label="طريقة التسوية" />
        {method === 'external' && <Select value={bearer} onChange={(e) => setBearer(e.target.value as 'finance_officer' | 'holder')} options={[{ value: 'holder', label: `يتحمّلها ${personName(db, c.recipientId)}` }, { value: 'finance_officer', label: 'يتحمّلها مسؤول المالية' }]} aria-label="من يتحمّل" />}
        <AttachmentInput value={attachment} onChange={setAttachment} label={method === 'transfer' ? 'إيصال التحويل (إلزامي)' : 'مستند التسوية: إقرار أو إيصال (إلزامي)'} />
        <Field label="ملاحظة"><Input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

/** تحويل عهدة: لطلب معتمد، أو مباشرة للافتتاحي والختامي واحتياجات البرنامج. كامل أو جزء والباقي دفعة مؤجّلة */
export function IssueCustodyModal({ ownerKind, ownerId, onClose, requestId, approved: fixedApproved, defaultRecipient }: { ownerKind: BudgetOwnerKind; ownerId: string; onClose: () => void; requestId?: string; approved?: number; defaultRecipient?: string }) {
  const db = useDB();
  const balance = walletBalance(db);
  const [recipient, setRecipient] = useState(defaultRecipient ?? db.persons.find((p) => p.isGeneralLeader)!.id);
  const [approved, setApproved] = useState(fixedApproved ?? 1000);
  const [amount, setAmount] = useState(Math.min(fixedApproved ?? 1000, Math.max(0, balance)));
  const [attachment, setAttachment] = useState<Attachment>();
  const kind = spendKindOf(db, ownerKind, ownerId);
  const conflict = openCustodyConflict(db, recipient, kind);
  const go = () => askConfirm({
    title: 'تأكيد تحويل العهدة',
    body: `${SAR(amount)} لـ ${personName(db, recipient)} على «${ownerTitle(db, ownerKind, ownerId)}»${amount < approved ? `، ويبقى ${SAR(approved - amount)} دفعة مؤجّلة` : ''}.`,
    cta: 'حوّل العهدة',
    run: () => act(() => {
      if (requestId) repos.finance.disburse(requestId, { recipientId: recipient, amount, attachment: attachment! });
      else repos.finance.issueCustody({ ownerKind, ownerId, recipientId: recipient, approved, amount, attachment: attachment! });
      onClose();
    }, 'حُوّلت العهدة وتعبّأ رصيد المستلم'),
  });
  return (
    <Modal open onClose={onClose} title={`عهدة: ${ownerTitle(db, ownerKind, ownerId)}`} footer={<><Button variant="ghost" onClick={onClose}>إلغاء</Button><Button disabled={!attachment || !!conflict} onClick={go}>حوّل العهدة</Button></>}>
      <div className="space-y-3">
        <Field label="المستلم (صاحب العهدة)"><Select value={recipient} onChange={(e) => setRecipient(e.target.value)} options={db.persons.map((p) => ({ value: p.id, label: p.name }))} /></Field>
        {(() => { const b = db.persons.find((p) => p.id === recipient)?.bank; return b ? <p className="rounded-xl bg-ink-50 p-2 text-xs">الآيبان: <span dir="ltr" className="font-mono">{b.iban}</span>{b.bankName ? ` · ${b.bankName}` : ''} <AttachmentView a={b.barcode} compact /></p> : <p className="text-xs text-ink-400">لم يضف المستلم بياناته البنكية في ملفه بعد.</p>; })()}
        {conflict && <Notice tone="red">{conflict}</Notice>}
        <Field label="المبلغ المعتمد"><Input className="num" type="number" value={approved} disabled={fixedApproved != null} onChange={(e) => setApproved(+e.target.value)} /></Field>
        <Field label="التحويل الآن" hint={`رصيدك الفعلي ${SAR(balance)}. إن لم يكفِ فاصرف جزءاً والباقي دفعة ثانية`}><Input className="num" type="number" value={amount} onChange={(e) => setAmount(+e.target.value)} /></Field>
        <AttachmentInput value={attachment} onChange={setAttachment} label="إيصال التحويل (إلزامي)" />
      </div>
    </Modal>
  );
}
