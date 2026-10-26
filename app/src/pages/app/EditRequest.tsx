// تعديل السجلات المعتمدة: لا يُعدَّل مباشرة، بل يُرفع طلب يوافق عليه القائد العام أو يرفضه (ويُحفظ في سجل التدقيق)
import { useState } from 'react';
import { fmtDateTime } from '@/domain/dates';
import { financePermsOf } from '@/domain/finance';
import { SAR } from '@/domain/labels';
import type { EditTarget } from '@/domain/types';
import { act, personName, repos, useDB, useMe } from '@/state/store';
import { Badge, Button, Card, Empty, Field, Input, Modal, ReasonModal, Select, Textarea } from '@/ui';

export function EditRequestButton({ target, current, title, amountOnly }: { target: EditTarget; current: { amount?: number; categoryId?: string; note?: string }; title: string; amountOnly?: boolean }) {
  const db = useDB();
  const me = useMe();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(current.amount ?? 0);
  const [categoryId, setCategoryId] = useState(current.categoryId ?? '');
  const [reason, setReason] = useState('');
  if (!financePermsOf(db, me.person.id).some((p) => p !== 'view_budget')) return null;
  const pending = db.editRequests.some((e) => e.status === 'pending' && JSON.stringify(e.target) === JSON.stringify(target));
  if (pending) return <Badge tone="purple">طلب تعديل قائم</Badge>;
  const cat = (id?: string) => db.budgetCategories.find((c) => c.id === id)?.name ?? '—';
  const send = () => act(() => {
    const patch: Record<string, unknown> = {};
    const parts: string[] = [];
    if (current.amount != null && amount !== current.amount) { patch.amount = amount; parts.push(`المبلغ ${SAR(current.amount)} ← ${SAR(amount)}`); }
    if (!amountOnly && categoryId && categoryId !== current.categoryId) { patch.categoryId = categoryId; parts.push(`التصنيف ${cat(current.categoryId)} ← ${cat(categoryId)}`); }
    if (!parts.length) throw new Error('لم تغيّر شيئاً');
    repos.finance.requestEdit({ target, patch, summary: `${title}: ${parts.join('، ')}`, reason });
    setOpen(false);
  }, 'رُفع طلب التعديل للقائد العام');
  return (
    <>
      <button className="text-[11px] text-brand-600 underline" onClick={() => setOpen(true)}>اطلب تعديلاً</button>
      <Modal open={open} onClose={() => setOpen(false)} title={`طلب تعديل سجل معتمد: ${title}`} footer={<Button disabled={!reason.trim()} onClick={send}>أرسل للقائد العام</Button>}>
        <div className="space-y-3">
          {current.amount != null && <Field label="المبلغ الجديد"><Input className="num" type="number" value={amount} onChange={(e) => setAmount(+e.target.value)} /></Field>}
          {!amountOnly && current.categoryId !== undefined && <Field label="التصنيف"><Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} options={db.budgetCategories.map((c) => ({ value: c.id, label: c.name }))} /></Field>}
          <Field label="سبب التعديل"><Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
          <p className="text-xs text-ink-500">السجل المعتمد مقفل. يُطبَّق التعديل تلقائياً بعد موافقة القائد العام، ويبقى الطلب وقراره في سجل التدقيق.</p>
        </div>
      </Modal>
    </>
  );
}

export function EditRequestsList() {
  const db = useDB();
  const me = useMe();
  const [rejecting, setRejecting] = useState<string | null>(null);
  const list = [...db.editRequests].reverse();
  if (!list.length) return <Empty title="لا طلبات تعديل" text="السجلات المعتمدة تُعدَّل بطلب من هنا يوافق عليه القائد العام." />;
  return (
    <Card pad={false} title="طلبات تعديل السجلات المعتمدة" subtitle="يوافق عليها القائد العام أو يرفضها، وتبقى في السجل">
      <ul className="divide-y divide-ink-100">
        {list.map((e) => (
          <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
            <div className="min-w-0">
              <div className="font-medium">{e.summary}</div>
              <div className="text-xs text-ink-500">{personName(db, e.requestedBy)} · {fmtDateTime(e.at)} · السبب: {e.reason}</div>
              {e.decidedAt && <div className="text-xs text-ink-400">قرار {personName(db, e.decidedBy)} {fmtDateTime(e.decidedAt)}{e.decisionNote ? ` — ${e.decisionNote}` : ''}</div>}
            </div>
            <span className="flex items-center gap-2">
              <Badge tone={e.status === 'approved' ? 'green' : e.status === 'rejected' ? 'red' : 'orange'}>{{ pending: 'بانتظار القائد العام', approved: 'وُوفق وطُبّق', rejected: 'مرفوض' }[e.status]}</Badge>
              {me.isLeader && e.status === 'pending' && <><Button size="sm" onClick={() => act(() => repos.finance.decideEdit(e.id, true), 'وُوفق وطُبّق التعديل')}>وافق</Button><Button size="sm" variant="danger" onClick={() => setRejecting(e.id)}>ارفض</Button></>}
            </span>
          </li>
        ))}
      </ul>
      <ReasonModal open={!!rejecting} onClose={() => setRejecting(null)} title="ارفض طلب التعديل" onSubmit={(r) => act(() => repos.finance.decideEdit(rejecting!, false, r), 'رُفض الطلب')} />
    </Card>
  );
}
