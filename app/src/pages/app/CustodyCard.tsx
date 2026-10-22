// العهدة: الدفعات، الآيبان، الفواتير، الفائض، الإغلاق. كل زر يظهر لمن يملك صلاحيته فقط.
import { useState } from 'react';
import { fmtDate, fmtDateTime } from '@/domain/dates';
import { SAR, custodyStatusLabel, custodyStatusTone, installmentStatusLabel } from '@/domain/labels';
import { hasFinancePerm, invoiceError, ownerTitle } from '@/domain/finance';
import { uid } from '@/domain/id';
import { custodyCloseChecks, custodyFigures } from '@/domain/workflow';
import type { Custody, Invoice, InvoiceLine } from '@/domain/types';
import { act, repos, useDB, useMe } from '@/state/store';
import { Badge, Button, Card, Checklist, Field, Icons, Input, Modal, MoreMenu, ReasonModal, Select, StepWizard, askConfirm, cx } from '@/ui';
import { PersonChip } from '@/ui/domain';

export function CustodyCard({ custody: c, embedded }: { custody: Custody; embedded?: boolean }) {
  const db = useDB();
  const me = useMe();
  const pid = me.person.id;
  const isRecipient = c.recipientId === pid;
  const can = (p: Parameters<typeof hasFinancePerm>[2]) => hasFinancePerm(db, pid, p);
  const f = custodyFigures(db, c);
  const [iban, setIban] = useState(c.iban ?? '');
  const [invOpen, setInvOpen] = useState<Invoice | 'new' | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [overOpen, setOverOpen] = useState(false);
  const checks = custodyCloseChecks(db, c, db.settings);
  const catName = (id: string) => db.budgetCategories.find((x) => x.id === id)?.name ?? '—';

  const body = (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm"><Badge tone={custodyStatusTone[c.status]}>عهدة {custodyStatusLabel[c.status]}</Badge> <PersonChip id={c.recipientId} size={22} sub="المستلم والمسؤول عنها" /></span>
        <MoreMenu items={[
          { label: `أرجع الفائض (${SAR(f.remaining)}) برفع الإيصال`, hidden: !(isRecipient && c.status === 'active' && f.remaining > 0.5 && !c.refund), onClick: () => act(() => repos.finance.refund(c.id, f.remaining, 'إيصال-إرجاع.pdf'), 'رُفع إيصال إرجاع الفائض') },
          { label: 'اطلب موافقة على مصروف زائد', hidden: !(isRecipient && c.status === 'active' && f.overspend > 0 && !c.overspend), onClick: () => setOverOpen(true) },
          { label: 'اطلب الإغلاق المالي', hidden: !(isRecipient && c.status === 'active'), onClick: () => act(() => repos.finance.requestClose(c.id), 'أُرسل طلب الإغلاق') },
        ]} />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[['إجمالي العهدة', c.total], ['المستلم منها', f.received], ['فواتير مقبولة', f.accepted], ['المتبقي', f.remaining]].map(([l, v]) => (
          <div key={l as string} className="rounded-xl bg-ink-50 p-3"><div className="text-[11px] text-ink-500">{l}</div><div className="num font-bold">{SAR(v as number)}</div></div>
        ))}
      </div>

      {/* الدفعات */}
      <div>
        <div className="mb-2 text-sm font-bold">الدفعات</div>
        {isRecipient && c.installments.some((i) => i.status === 'awaiting_iban') && (
          <div className="mb-3 flex flex-wrap items-end gap-2 rounded-xl bg-accent-50 p-3">
            <Field label="رقم الآيبان" className="min-w-[220px] flex-1"><Input dir="ltr" value={iban} onChange={(e) => setIban(e.target.value)} placeholder="SA00 0000 0000 0000 0000 0000" /></Field>
            <Button disabled={iban.replace(/\s/g, '').length < 15} onClick={() => act(() => repos.finance.submitIban(c.id, iban.replace(/\s/g, '')), 'أُرسل الآيبان للمالية')}>أرسل الآيبان</Button>
          </div>
        )}
        <div className="space-y-2">
          {c.installments.map((i, idx) => (
            <div key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink-100 px-3 py-2 text-sm">
              <div>
                <b>الدفعة {idx + 1}</b>: <span className="num">{SAR(i.amount)}</span> · <span className="text-ink-500">{fmtDate(i.dueDate)}</span>
                {i.condition && <div className="text-[11px] text-ink-400">الشرط: {i.condition}</div>}
                {i.transferReceipt && <div className="text-[11px] text-ink-400">إيصال التحويل: {i.transferReceipt} · {fmtDateTime(i.transferredAt)}</div>}
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={i.status === 'received' ? 'green' : i.status === 'scheduled' ? 'gray' : 'orange'}>{installmentStatusLabel[i.status]}</Badge>
                {can('disburse') && i.status === 'scheduled' && <Button size="sm" variant="secondary" onClick={() => act(() => repos.finance.releaseInstallment(c.id, i.id), 'تحقق شرط الدفعة')}>تحقق الشرط</Button>}
                {can('disburse') && i.status === 'awaiting_transfer' && (
                  <Button size="sm" onClick={() => askConfirm({ title: 'تأكيد التحويل', body: `ستُسجَّل دفعة ${SAR(i.amount)} كمحوّلة مع إيصالها، ويُطلب من المستلم تأكيد الاستلام.`, cta: 'حوّل الدفعة', run: () => act(() => repos.finance.transfer(c.id, i.id, `إيصال-${idx + 1}.pdf`), 'سُجّل التحويل') })}>حوّل الدفعة</Button>
                )}
                {isRecipient && i.status === 'awaiting_confirm' && <Button size="sm" onClick={() => act(() => repos.finance.confirmReceipt(c.id, i.id), 'تأكد الاستلام')}>أكّد الاستلام</Button>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* الفواتير */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-bold">الفواتير ({f.invoices.length})</span>
          {isRecipient && c.status === 'active' && <Button size="sm" onClick={() => setInvOpen('new')} icon={<Icons.Plus className="h-4 w-4" />}>أضف فاتورة</Button>}
        </div>
        {f.invoices.length === 0 ? <p className="text-sm text-ink-400">لا فواتير بعد{isRecipient && c.status === 'active' ? '. ابدأ بـ "أضف فاتورة" بعد كل مصروف.' : '.'}</p> : (
          <div className="space-y-2">
            {f.invoices.map((i) => (
              <div key={i.id} className={cx('rounded-xl border p-3', i.status === 'rejected' ? 'border-red-200 bg-red-50/40' : 'border-ink-100')}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm"><Icons.Image className="h-4 w-4 text-brand-600" /><b className="num">{SAR(i.total)}</b><span className="text-xs text-ink-400">{i.image}</span></span>
                  <span className="flex items-center gap-2">
                    <Badge tone={i.status === 'accepted' ? 'green' : i.status === 'rejected' ? 'red' : 'orange'}>{{ accepted: 'مقبولة', rejected: 'مرفوضة: تحتاج تعديلاً', pending: 'بانتظار مراجعة المالية' }[i.status]}</Badge>
                    {can('review_invoices') && i.status === 'pending' && <><Button size="sm" variant="secondary" onClick={() => act(() => repos.finance.reviewInvoice(i.id, true), 'قُبلت الفاتورة')}>اقبل</Button><Button size="sm" variant="danger" onClick={() => setRejecting(i.id)}>ارفض</Button></>}
                    {isRecipient && i.status === 'rejected' && <Button size="sm" variant="secondary" onClick={() => setInvOpen(i)}>عدّل الفاتورة</Button>}
                  </span>
                </div>
                <ul className="mt-2 space-y-0.5 text-xs text-ink-600">
                  {i.lines.map((l) => <li key={l.id} className="flex justify-between"><span>{catName(l.categoryId)} · {l.description}</span><span className="num">{SAR(l.amount)}</span></li>)}
                </ul>
                {i.rejectReason && <p className="mt-1 text-xs text-red-700">سبب الرفض: {i.rejectReason}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* الإغلاق */}
      <details className="rounded-2xl border border-ink-100 p-3" open={c.status === 'closing'}>
        <summary className="cursor-pointer text-sm font-bold">متطلبات الإغلاق المالي</summary>
        <div className="mt-3 space-y-3">
          <Checklist items={checks} />
          {c.refund && <p className="text-xs text-ink-500">أُرجع فائض {SAR(c.refund.amount)} · إيصال: {c.refund.receipt}</p>}
          {c.overspend && (
            <div className="rounded-lg bg-accent-50 p-2 text-xs">
              مصروف زائد {SAR(c.overspend.amount)}: {c.overspend.reason}
              <div className="mt-1 flex flex-wrap gap-2">
                <Badge tone={c.overspend.financeApproved ? 'green' : 'gray'}>المالية: {c.overspend.financeApproved ? 'موافقة' : 'بانتظار'}</Badge>
                <Badge tone={c.overspend.adminApproved ? 'green' : 'gray'}>القائد العام: {c.overspend.adminApproved ? 'موافقة' : 'بانتظار'}</Badge>
                {can('close_custody') && !c.overspend.financeApproved && <Button size="sm" variant="secondary" onClick={() => act(() => repos.finance.approveOverspend(c.id, 'finance'))}>وافق (المالية)</Button>}
                {me.isLeader && !c.overspend.adminApproved && <Button size="sm" variant="secondary" onClick={() => act(() => repos.finance.approveOverspend(c.id, 'admin'))}>وافق (القائد العام)</Button>}
              </div>
            </div>
          )}
          {can('close_custody') && c.status !== 'closed' && (
            <Button disabled={!checks.every((x) => x.ok)} onClick={() => askConfirm({ title: 'إغلاق العهدة', body: `ستُغلق عهدة «${ownerTitle(db, c.ownerKind, c.ownerId)}» نهائياً ولا تُقبل بعدها فواتير.`, cta: 'أغلق العهدة', run: () => act(() => repos.finance.closeCustody(c.id), 'أُغلقت العهدة') })}>اعتمد الإغلاق وأغلق العهدة</Button>
          )}
          {c.status === 'closed' && <p className="text-xs text-emerald-700">أُغلقت العهدة {fmtDateTime(c.closedAt)}</p>}
          <p className="text-[11px] text-ink-400">لا يُغلق الملف المالي إلا بإغلاق العهدة بالكامل مع مرفقات الفواتير.</p>
        </div>
      </details>

      {invOpen && <InvoiceWizard custody={c} invoice={invOpen === 'new' ? undefined : invOpen} onClose={() => setInvOpen(null)} />}
      <ReasonModal open={!!rejecting} onClose={() => setRejecting(null)} title="ارفض الفاتورة" label="سبب الرفض (تعود للمستلم ليعدّلها أو يستبدلها)" cta="ارفض وأعدها" onSubmit={(r) => act(() => repos.finance.reviewInvoice(rejecting!, false, r), 'أُعيدت الفاتورة للمستلم')} />
      <ReasonModal open={overOpen} onClose={() => setOverOpen(false)} title={`مصروف زائد ${SAR(f.overspend)}`} label="المبرر" cta="أرسل الطلب" danger={false} onSubmit={(r) => act(() => repos.finance.requestOverspend(c.id, f.overspend, r), 'أُرسل الطلب')} />
    </div>
  );
  if (embedded) return <div className="rounded-2xl border border-ink-100 p-3 sm:p-4">{body}</div>;
  return <Card title={`عهدة: ${ownerTitle(db, c.ownerKind, c.ownerId)}`}>{body}</Card>;
}

/** الفاتورة على 3 خطوات: الصورة والإجمالي، ثم الأسطر، ثم المراجعة. يُمنع الإرسال إن اختلف المجموع */
export function InvoiceWizard({ custody, invoice, onClose }: { custody: Custody; invoice?: Invoice; onClose: () => void }) {
  const db = useDB();
  const cats = db.budgetCategories.filter((x) => !x.hidden);
  const [image, setImage] = useState(invoice?.image ?? '');
  const [total, setTotal] = useState(invoice?.total ?? 0);
  const [lines, setLines] = useState<InvoiceLine[]>(invoice?.lines ?? [{ id: uid('il'), categoryId: cats[0]?.id ?? '', description: '', amount: 0 }]);
  const sum = Math.round(lines.reduce((s, l) => s + (l.amount || 0), 0) * 100) / 100;
  const err = invoiceError(total, lines, image);
  const upd = (id: string, p: Partial<InvoiceLine>) => setLines(lines.map((l) => (l.id === id ? { ...l, ...p } : l)));
  const catName = (id: string) => db.budgetCategories.find((x) => x.id === id)?.name ?? '—';
  const save = () => act(() => { invoice ? repos.finance.updateInvoice(invoice.id, { total, lines, image }) : repos.finance.addInvoice(custody.id, { total, lines, image }); onClose(); }, 'أُرسلت الفاتورة للمراجعة');

  return (
    <Modal open onClose={onClose} title={invoice ? 'عدّل الفاتورة المرفوضة' : 'أضف فاتورة'}>
      {invoice?.rejectReason && <p className="mb-3 rounded-xl bg-red-50 p-2 text-xs text-red-700">سبب الرفض: {invoice.rejectReason}</p>}
      <StepWizard onCancel={onClose} finishLabel="أرسل الفاتورة" onFinish={save} steps={[
        {
          title: 'صورة الفاتورة وإجماليها', valid: !!image && total > 0, hint: 'صورة الفاتورة والإجمالي مطلوبان',
          content: (
            <div className="space-y-3">
              <Field label="صورة الفاتورة (إلزامية)" hint="في النموذج الأولي يُحفظ اسم الملف فقط">
                <Input type="file" accept="image/*,.pdf" onChange={(e) => setImage(e.target.files?.[0]?.name ?? '')} />
              </Field>
              {image && <p className="text-xs text-emerald-700"><Icons.Check className="me-1 inline h-3 w-3" />{image}</p>}
              <Field label="إجمالي الفاتورة (ر.س)"><Input className="num" type="number" min={0} value={total || ''} onChange={(e) => setTotal(+e.target.value)} /></Field>
            </div>
          ),
        },
        {
          title: 'وزّع الفاتورة على التصنيفات', valid: sum === total && lines.every((l) => l.categoryId && l.amount > 0), hint: `مجموع الأسطر ${sum} ويجب أن يساوي الإجمالي ${total}`,
          content: (
            <div className="space-y-2">
              {lines.map((l) => (
                <div key={l.id} className="grid grid-cols-2 gap-2 rounded-xl border border-ink-100 p-2 sm:grid-cols-[1fr_1.4fr_90px_auto]">
                  <Select value={l.categoryId} onChange={(e) => upd(l.id, { categoryId: e.target.value })} options={cats.map((c) => ({ value: c.id, label: c.name }))} aria-label="التصنيف" />
                  <Input placeholder="الوصف (مثال: غداء اليوم الأول)" value={l.description} onChange={(e) => upd(l.id, { description: e.target.value })} />
                  <Input className="num" type="number" min={0} value={l.amount || ''} onChange={(e) => upd(l.id, { amount: +e.target.value })} aria-label="المبلغ" />
                  {lines.length > 1 && <button className="min-h-[44px]" onClick={() => setLines(lines.filter((x) => x.id !== l.id))} aria-label="احذف السطر"><Icons.X className="h-4 w-4 text-ink-400" /></button>}
                </div>
              ))}
              <Button size="sm" variant="secondary" onClick={() => setLines([...lines, { id: uid('il'), categoryId: cats[0]?.id ?? '', description: '', amount: Math.max(0, total - sum) }])} icon={<Icons.Plus className="h-4 w-4" />}>أضف سطراً</Button>
              <div className={cx('rounded-xl px-3 py-2 text-sm font-medium', sum === total ? 'bg-emerald-50 text-emerald-800' : 'bg-accent-50 text-accent-700')}>
                مجموع الأسطر <span className="num">{SAR(sum)}</span> من الإجمالي <span className="num">{SAR(total)}</span>{sum !== total && ` · الفرق ${SAR(Math.abs(total - sum))}`}
              </div>
            </div>
          ),
        },
        {
          title: 'راجع وأرسل', valid: !err, hint: err ?? undefined,
          content: (
            <div className="space-y-2 text-sm">
              <p>الصورة: <b>{image}</b></p>
              <p>الإجمالي: <b className="num">{SAR(total)}</b></p>
              <ul className="space-y-1 rounded-xl bg-ink-50 p-3">{lines.map((l) => <li key={l.id} className="flex justify-between"><span>{catName(l.categoryId)} · {l.description || '—'}</span><span className="num">{SAR(l.amount)}</span></li>)}</ul>
              <p className="text-xs text-ink-500">تذهب الفاتورة لمسؤول اللجنة المالية (أو المفوَّض بالمراجعة) ليقبلها أو يرفضها بسبب.</p>
            </div>
          ),
        },
      ]} />
    </Modal>
  );
}
