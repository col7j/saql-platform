// بطاقة العهدة الكاملة: الدفعات، الآيبان، الإيصالات، الفواتير، الفائض، الإغلاق (قسم 11.5 و11.6)
import { useState } from 'react';
import { fmtDate, fmtDateTime } from '@/domain/dates';
import { SAR, custodyStatusLabel, custodyStatusTone, installmentStatusLabel } from '@/domain/labels';
import { canManageFinance } from '@/domain/permissions';
import { budgetTotal, custodyCloseChecks, custodyFigures, custodyOwnerTitle } from '@/domain/workflow';
import type { Custody, Invoice } from '@/domain/types';
import { act, repos, useDB, useMe } from '@/state/store';
import { Badge, Button, Card, Checklist, Field, Icons, Input, Modal, Notice, ReasonModal, Select, Table } from '@/ui';
import { PersonChip } from '@/ui/domain';

export function CustodyCard({ custody: c }: { custody: Custody }) {
  const db = useDB();
  const me = useMe();
  const isRecipient = c.recipientId === me.person.id;
  const isFin = canManageFinance(db, me.person.id);
  const f = custodyFigures(db, c);
  const [iban, setIban] = useState(c.iban ?? '');
  const [invOpen, setInvOpen] = useState<Invoice | 'new' | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [overOpen, setOverOpen] = useState(false);
  const budgetLines = c.ownerKind === 'trip' ? db.tripBudgets.find((b) => b.tripId === c.ownerId)?.lines ?? [] : db.focusMeetings.find((x) => x.id === c.ownerId)?.budget.lines ?? [];
  const cats = db.budgetCategories.filter((x) => x.appliesTo.includes(c.ownerKind));
  const checks = custodyCloseChecks(db, c, db.settings);

  return (
    <Card
      title={<span className="flex flex-wrap items-center gap-2">عهدة: {custodyOwnerTitle(db, c)} <Badge tone={custodyStatusTone[c.status]}>{custodyStatusLabel[c.status]}</Badge></span>}
      subtitle={<span className="flex flex-wrap items-center gap-2">المستلم والمسؤول الكامل: <PersonChip id={c.recipientId} size={20} /></span>}
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[['إجمالي العهدة', c.total], ['المستلم', f.received], ['فواتير مقبولة', f.accepted], ['فواتير معلقة', f.pending], ['المتبقي', f.remaining]].map(([l, v]) => (
          <div key={l as string} className="rounded-xl bg-ink-50 p-3"><div className="text-[11px] text-ink-500">{l}</div><div className="num font-bold">{SAR(v as number)}</div></div>
        ))}
      </div>

      <div className="mt-5">
        <div className="mb-2 text-sm font-bold">الدفعات</div>
        {isRecipient && c.installments.some((i) => i.status === 'awaiting_iban') && (
          <div className="mb-3 flex flex-wrap items-end gap-2 rounded-xl bg-accent-50 p-3">
            <Field label="رقم الآيبان" className="min-w-[240px] flex-1"><Input dir="ltr" value={iban} onChange={(e) => setIban(e.target.value)} placeholder="SA00 0000 0000 0000 0000 0000" /></Field>
            <Button disabled={iban.replace(/\s/g, '').length < 15} onClick={() => act(() => repos.finance.submitIban(c.id, iban.replace(/\s/g, '')), 'رُفع الآيبان للمالية')}>رفع الآيبان</Button>
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
                {isFin && i.status === 'scheduled' && <Button size="sm" variant="secondary" onClick={() => act(() => repos.finance.releaseInstallment(c.id, i.id), 'تحقق الشرط')}>تحقق الشرط</Button>}
                {isFin && i.status === 'awaiting_transfer' && <Button size="sm" onClick={() => act(() => repos.finance.transfer(c.id, i.id, `إيصال-${idx + 1}.pdf`), 'رُفع إيصال التحويل')}>تحويل ورفع الإيصال</Button>}
                {isRecipient && i.status === 'awaiting_confirm' && <Button size="sm" variant="success" onClick={() => act(() => repos.finance.confirmReceipt(c.id, i.id), 'تأكد الاستلام')}>تأكيد الاستلام</Button>}
              </div>
            </div>
          ))}
        </div>
        {c.iban && <p className="mt-1 text-[11px] text-ink-400" dir="ltr">IBAN: {c.iban.slice(0, 6)}••••{c.iban.slice(-4)}</p>}
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-bold">الفواتير (مرتبة حسب البنود)</span>
          {isRecipient && c.status !== 'closed' && c.status !== 'setup' && <Button size="sm" onClick={() => setInvOpen('new')} icon={<Icons.Plus className="h-3.5 w-3.5" />}>رفع فاتورة</Button>}
        </div>
        <Table>
          <thead><tr><th>البند</th><th>البيان</th><th>المبلغ</th><th>الصورة</th><th>الحالة</th><th /></tr></thead>
          <tbody>
            {cats.filter((cat) => f.invoices.some((i) => i.categoryId === cat.id) || budgetLines.some((l) => l.categoryId === cat.id)).map((cat) => {
              const invs = f.invoices.filter((i) => i.categoryId === cat.id);
              const planned = budgetTotal(budgetLines.filter((l) => l.categoryId === cat.id));
              const spent = invs.filter((i) => i.status === 'accepted').reduce((s, i) => s + i.amount, 0);
              return [
                <tr key={cat.id} className="bg-brand-50/40"><td colSpan={6} className="text-xs font-bold text-brand-800">{cat.name} · المخطط {SAR(planned)} · المقبول {SAR(spent)}</td></tr>,
                ...invs.map((i) => (
                  <tr key={i.id}>
                    <td className="text-xs text-ink-400">{cat.name}</td>
                    <td>{i.statement}{i.rejectReason && <div className="text-[11px] text-red-600">سبب الرفض: {i.rejectReason}</div>}</td>
                    <td className="num">{SAR(i.amount)}</td>
                    <td><span className="inline-flex items-center gap-1 text-xs text-brand-600"><Icons.Image className="h-3.5 w-3.5" />{i.image}</span></td>
                    <td><Badge tone={i.status === 'accepted' ? 'green' : i.status === 'rejected' ? 'red' : 'orange'}>{{ accepted: 'مقبولة', rejected: 'مرفوضة', pending: 'بانتظار المراجعة' }[i.status]}</Badge></td>
                    <td className="whitespace-nowrap">
                      {isFin && i.status === 'pending' && (
                        <span className="flex gap-1">
                          <Button size="sm" variant="success" onClick={() => act(() => repos.finance.reviewInvoice(i.id, true), 'قُبلت الفاتورة')}>قبول</Button>
                          <Button size="sm" variant="danger" onClick={() => setRejecting(i.id)}>رفض</Button>
                        </span>
                      )}
                      {isRecipient && i.status === 'rejected' && <Button size="sm" variant="secondary" onClick={() => setInvOpen(i)}>تعديل/استبدال</Button>}
                    </td>
                  </tr>
                )),
              ];
            })}
          </tbody>
        </Table>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-ink-100 p-3">
          <div className="mb-2 text-sm font-bold">متطلبات الإغلاق المالي</div>
          <Checklist items={checks} />
          {c.refund && <p className="mt-2 text-xs text-ink-500">أُرجع فائض {SAR(c.refund.amount)} · إيصال: {c.refund.receipt}</p>}
          {c.overspend && (
            <div className="mt-2 rounded-lg bg-accent-50 p-2 text-xs">
              مصروف زائد {SAR(c.overspend.amount)}: {c.overspend.reason}
              <div className="mt-1 flex gap-2">
                <Badge tone={c.overspend.financeApproved ? 'green' : 'gray'}>المالية {c.overspend.financeApproved ? '✓' : '…'}</Badge>
                <Badge tone={c.overspend.adminApproved ? 'green' : 'gray'}>الإدارة {c.overspend.adminApproved ? '✓' : '…'}</Badge>
                {isFin && !c.overspend.financeApproved && <Button size="sm" onClick={() => repos.finance.approveOverspend(c.id, 'finance')}>موافقة المالية</Button>}
                {me.isLeader && !c.overspend.adminApproved && <Button size="sm" onClick={() => repos.finance.approveOverspend(c.id, 'admin')}>موافقة الإدارة</Button>}
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2 rounded-2xl border border-ink-100 p-3">
          <div className="text-sm font-bold">إجراءات</div>
          {isRecipient && c.status === 'active' && f.remaining > 0.5 && !c.refund && <Button variant="secondary" onClick={() => act(() => repos.finance.refund(c.id, f.remaining, 'إيصال-إرجاع.pdf'), 'رُفع إيصال إرجاع الفائض')}>إرجاع الفائض ({SAR(f.remaining)}) برفع الإيصال</Button>}
          {isRecipient && c.status === 'active' && f.overspend > 0 && !c.overspend && <Button variant="secondary" onClick={() => setOverOpen(true)}>طلب موافقة على مصروف زائد</Button>}
          {isRecipient && c.status === 'active' && <Button onClick={() => act(() => repos.finance.requestClose(c.id), 'أُرسل طلب الإغلاق')}>طلب الإغلاق المالي</Button>}
          {isFin && c.status !== 'closed' && <Button variant="success" disabled={!checks.every((x) => x.ok)} onClick={() => act(() => repos.finance.closeCustody(c.id), 'أُغلقت العهدة')}>اعتماد الإغلاق وإغلاق العهدة</Button>}
          {c.status === 'closed' && <Notice tone="green">أُغلقت العهدة {fmtDateTime(c.closedAt)}</Notice>}
          <p className="text-[11px] text-ink-400">لا يُغلق الملف المالي إلا بإغلاق العهدة بالكامل مع مرفقات الفواتير.</p>
        </div>
      </div>

      {invOpen && <InvoiceModal custody={c} invoice={invOpen === 'new' ? undefined : invOpen} onClose={() => setInvOpen(null)} />}
      <ReasonModal open={!!rejecting} onClose={() => setRejecting(null)} title="رفض الفاتورة" label="سبب الرفض (يعود للمستلم ليعدّلها أو يستبدلها)" cta="رفض" onSubmit={(r) => act(() => repos.finance.reviewInvoice(rejecting!, false, r), 'رُفضت الفاتورة')} />
      <ReasonModal open={overOpen} onClose={() => setOverOpen(false)} title={`مصروف زائد ${SAR(f.overspend)}`} label="المبرر" cta="إرسال" danger={false} onSubmit={(r) => act(() => repos.finance.requestOverspend(c.id, f.overspend, r), 'أُرسل الطلب')} />
    </Card>
  );
}

function InvoiceModal({ custody, invoice, onClose }: { custody: Custody; invoice?: Invoice; onClose: () => void }) {
  const db = useDB();
  const cats = db.budgetCategories.filter((x) => x.appliesTo.includes(custody.ownerKind));
  const [f, setF] = useState({ categoryId: invoice?.categoryId ?? cats[0]?.id, statement: invoice?.statement ?? '', amount: invoice?.amount ?? 0, image: invoice?.image ?? '' });
  return (
    <Modal open onClose={onClose} title={invoice ? 'تعديل الفاتورة المرفوضة' : 'رفع فاتورة'}
      footer={<><Button variant="secondary" onClick={onClose}>إلغاء</Button><Button disabled={!f.statement || !f.amount || !f.image} onClick={() => act(() => { invoice ? repos.finance.replaceInvoice(invoice.id, f) : repos.finance.addInvoice(custody.id, f); onClose(); }, 'رُفعت الفاتورة للمراجعة')}>رفع</Button></>}>
      <div className="grid gap-3">
        <Field label="البند"><Select value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value })} options={cats.map((c) => ({ value: c.id, label: c.name }))} /></Field>
        <Field label="البيان"><Input value={f.statement} onChange={(e) => setF({ ...f, statement: e.target.value })} placeholder="مثال: غداء اليوم الأول" /></Field>
        <Field label="المبلغ"><Input type="number" value={f.amount} onChange={(e) => setF({ ...f, amount: +e.target.value })} /></Field>
        <Field label="صورة الفاتورة" hint="في النموذج الأولي يُحفظ اسم الملف فقط">
          <Input type="file" accept="image/*,.pdf" onChange={(e) => setF({ ...f, image: e.target.files?.[0]?.name ?? '' })} />
        </Field>
        {f.image && <p className="text-xs text-ink-500">الملف: {f.image}</p>}
      </div>
    </Modal>
  );
}
