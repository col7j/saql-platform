// لوحة طلب الميزانية: تعرض الحالة والخطوة التالية، وتعطي كل شخص إجراءه فقط
import { useState } from 'react';
import { addDays, fmtDateTime, todayISO } from '@/domain/dates';
import {
  allocatedFor, canDisburse, canEditRequest, canFacilitatorDecide, canFinanceDecide, canLeaderDecide, canOpenFinance, custodyForRequest, focusIndex,
  requestFor, requestStage, submitterOf, tripBudgetFacilitatorId,
} from '@/domain/finance';
import { SAR } from '@/domain/labels';
import { tripTeamLeaderId } from '@/domain/permissions';
import type { BudgetLine, BudgetOwnerKind, BudgetRequest, ID } from '@/domain/types';
import { act, personName, repos, useDB, useMe } from '@/state/store';
import { Button, Card, Field, Icons, Input, Modal, Notice, ReasonModal, Select, StatusPill, Textarea, Toggle, askConfirm } from '@/ui';
import { BudgetEditor } from './BudgetEditor';
import { CustodyCard, IssueCustodyModal } from './CustodyCard';

const actionLabel: Record<BudgetRequest['history'][number]['action'], string> = {
  submit: 'أرسل الطلب',
  facilitator_approve: 'اعتمد الميسّر',
  facilitator_reject: 'أعاد الميسّر',
  finance_approve: 'وافقت المالية',
  finance_reject: 'رفضت المالية',
  leader_approve: 'اعتمد القائد العام',
  leader_reject: 'رفض القائد العام',
  leader_request_detail: 'طلب القائد العام موازنة تفصيلية',
  detail_submitted: 'أُرسلت الموازنة التفصيلية',
  disbursed: 'صُرفت العهدة',
};

/** من يرى ميزانية عنصر: المالية والقائد العام، وصاحب الطلب، وميسّر المجموعة للقاءاتها، وقائد الفريق لرحلته، ومسؤول الاجتماع */
export function canSeeOwnerBudget(db: ReturnType<typeof useDB>, pid: ID, ownerKind: BudgetOwnerKind, ownerId: ID) {
  if (canOpenFinance(db, pid)) return true;
  if (requestFor(db, ownerKind, ownerId)?.requestedBy === pid) return true;
  if (ownerKind === 'focus') {
    const fm = db.focusMeetings.find((f) => f.id === ownerId);
    return db.groups.find((g) => g.id === fm?.groupId)?.facilitatorId === pid;
  }
  if (ownerKind === 'trip') {
    const t = db.trips.find((x) => x.id === ownerId);
    return !!t && (tripTeamLeaderId(db, t) === pid || tripBudgetFacilitatorId(db, ownerId) === pid);
  }
  return db.meetings.find((m) => m.id === ownerId)?.ownerId === pid;
}

export function RequestPanel({ ownerKind, ownerId, title = 'الميزانية' }: { ownerKind: BudgetOwnerKind; ownerId: ID; title?: string }) {
  const db = useDB();
  const me = useMe();
  const pid = me.person.id;
  const [reject, setReject] = useState<'facilitator' | 'finance' | 'leader' | 'detail' | null>(null);
  const [disburse, setDisburse] = useState(false);
  if (!canSeeOwnerBudget(db, pid, ownerKind, ownerId)) return null;

  const r = requestFor(db, ownerKind, ownerId);
  const allocated = allocatedFor(db, ownerKind, ownerId);
  const blocked = null as string | null;
  const isSubmitter = submitterOf(db, ownerKind, ownerId) === pid;
  const fm = ownerKind === 'focus' ? db.focusMeetings.find((f) => f.id === ownerId) : undefined;
  const overflow = !!fm && allocated === 0;
  const stage = r ? requestStage(db, r) : null;
  const custody = r ? custodyForRequest(db, r) : undefined;
  const editing = isSubmitter && (!r || canEditRequest(db, pid, r));
  const canSeeCustody = !!custody && (custody.recipientId === pid || canOpenFinance(db, pid));

  return (
    <Card title={title} subtitle={allocated > 0 ? `المرصود: ${SAR(allocated)}` : undefined}>
      <div className="space-y-4">
        {stage && <StatusPill label={stage.label} tone={stage.tone} next={stage.next} waitingOn={stage.waitingOn} />}

        {/* حالات المنع: موضّحة بنص بدل زر معطّل */}
        {!r && overflow && (
          <Notice tone="orange" icon={<Icons.Info className="h-4 w-4" />}>
            هذا اللقاء رقم {focusIndex(db, fm!)} في المجموعة، والحد الأعلى للقاءات بميزانية {db.programBudget.focusLimits.max}. يمكن عقده، لكن بلا ميزانية مرصودة.
          </Notice>
        )}
        {!r && !overflow && blocked && <Notice tone="orange">{blocked}</Notice>}
        {!r && !overflow && !blocked && !db.programBudget.setupDone && isSubmitter && <Notice>لم يُعدّ المسؤول المالي ميزانية البرنامج بعد. يمكنك تقديم الطلب بعد إعدادها.</Notice>}
        {!r && !isSubmitter && !overflow && !blocked && <p className="text-sm text-ink-500">لم يُقدَّم طلب ميزانية بعد. يقدّمه {ownerKind === 'focus' ? 'الميسّر' : ownerKind === 'trip' ? 'قائد الفريق' : 'مسؤول الاجتماع'}.</p>}

        {r && r.lines.length > 0 && !editing && <BudgetEditor lines={r.lines} readOnly allocated={r.allocated} />}
        {r && r.lines.length === 0 && !editing && <p className="num text-sm">المبلغ المطلوب: <b>{SAR(r.amount)}</b> <span className="text-ink-500">من المرصود {SAR(r.allocated)}</span>{r.note && <span className="block text-xs text-ink-500">{r.note}</span>}</p>}

        {editing && !overflow && !blocked && db.programBudget.setupDone && (
          <RequestForm ownerKind={ownerKind} ownerId={ownerId} allocated={allocated} existing={r} forceDetailed={ownerKind === 'trip' || r?.status === 'needs_detail'} />
        )}

        {/* إجراءات من بيده القرار */}
        {r && canFacilitatorDecide(db, pid, r) && (
          <div className="space-y-2">
            {r.amount > r.allocated && <p className="text-sm text-accent-700">الميزانية {SAR(r.amount)} تتجاوز المرصود {SAR(r.allocated)}، وسيُنبَّه القائد العام بذلك.</p>}
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => act(() => repos.finance.facilitatorDecide(r.id, true), 'اعتمدتها وذهبت للقائد العام')} icon={<Icons.Check className="h-4 w-4" />}>اعتمد الميزانية</Button>
              <Button variant="danger" onClick={() => setReject('facilitator')}>أعدها بسبب</Button>
            </div>
          </div>
        )}
        {r && canFinanceDecide(db, pid, r) && (
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => act(() => repos.finance.financeDecide(r.id, true), 'وافقت على الطلب')} icon={<Icons.Check className="h-4 w-4" />}>وافق على الطلب</Button>
            <Button variant="danger" onClick={() => setReject('finance')}>ارفض بسبب</Button>
          </div>
        )}
        {r && canLeaderDecide(db, pid, r) && (
          <div className="space-y-2">
            {r.amount > r.allocated ? <Notice tone="orange" icon={<Icons.TriangleAlert className="h-4 w-4" />}>تنبيه: المطلوب {SAR(r.amount)} يتجاوز المرصود {SAR(r.allocated)} بـ {SAR(r.amount - r.allocated)}. قرّر على هذا الأساس.</Notice> : <p className="text-sm text-ink-600">ضمن المرصود ({SAR(r.allocated)}).</p>}
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => act(() => repos.finance.leaderDecide(r.id, 'approve'), 'اعتُمد الطلب وذهب للمالية للصرف')} icon={<Icons.BadgeCheck className="h-4 w-4" />}>اعتمد الطلب</Button>
              {!r.detailed && <Button variant="secondary" onClick={() => setReject('detail')}>اطلب موازنة تفصيلية</Button>}
              <Button variant="danger" onClick={() => setReject('leader')}>ارفض بسبب</Button>
            </div>
          </div>
        )}
        {r && canDisburse(db, pid, r) && (blocked ? <Notice tone="orange">{blocked}</Notice> : <Button onClick={() => setDisburse(true)} icon={<Icons.Banknote className="h-4 w-4" />}>اصرف العهدة</Button>)}

        {r && r.history.length > 0 && (
          <details className="rounded-xl bg-ink-50 px-3 py-2 text-sm">
            <summary className="cursor-pointer text-xs font-medium text-ink-600">سجل الطلب ({r.history.length})</summary>
            <ol className="mt-2 space-y-1.5">
              {r.history.map((h, i) => (
                <li key={i} className="text-xs"><b>{actionLabel[h.action]}</b> · {personName(db, h.byId)} · <span className="text-ink-400">{fmtDateTime(h.at)}</span>{h.note && <span className="block text-ink-600">{h.note}</span>}</li>
              ))}
            </ol>
          </details>
        )}

        {canSeeCustody && custody && <CustodyCard custody={custody} embedded />}
      </div>

      <ReasonModal open={!!reject} onClose={() => setReject(null)} danger={reject !== 'detail'}
        title={reject === 'detail' ? 'اطلب موازنة تفصيلية' : 'ارفض الطلب'} label={reject === 'detail' ? 'ما المطلوب تفصيله؟' : 'السبب (يظهر لمقدّم الطلب)'} cta={reject === 'detail' ? 'أرسل الطلب لمقدّمه' : 'ارفض وأعده'}
        onSubmit={(reason) => r && act(() => (reject === 'facilitator' ? repos.finance.facilitatorDecide(r.id, false, reason) : reject === 'finance' ? repos.finance.financeDecide(r.id, false, reason) : repos.finance.leaderDecide(r.id, reject === 'detail' ? 'detail' : 'reject', reason)), reject === 'detail' ? 'أُرسل لمقدّم الطلب' : 'أُعيد الطلب لمقدّمه')} />
      {disburse && r && <IssueCustodyModal ownerKind={r.ownerKind} ownerId={r.ownerId} requestId={r.id} approved={r.amount} defaultRecipient={r.requestedBy} onClose={() => setDisburse(false)} />}
    </Card>
  );
}

function RequestForm({ ownerKind, ownerId, allocated, existing, forceDetailed }: { ownerKind: BudgetOwnerKind; ownerId: ID; allocated: number; existing?: BudgetRequest; forceDetailed: boolean }) {
  const [detailed, setDetailed] = useState(forceDetailed || !!existing?.lines.length);
  const [amount, setAmount] = useState(existing?.amount ?? allocated);
  const [note, setNote] = useState(existing?.note ?? '');
  const [lines, setLines] = useState<BudgetLine[]>(existing?.lines ?? []);
  const send = () => act(() => repos.finance.submitRequest({ ownerKind, ownerId, amount, lines: detailed ? lines : [], detailed, note }), 'أُرسل الطلب');
  const value = detailed ? lines.reduce((s, l) => s + l.qty * l.price, 0) : amount;
  return (
    <div className="space-y-3 rounded-2xl border border-brand-100 bg-brand-50/30 p-3">
      {existing?.status === 'rejected' && <Notice tone="red">سبب الإعادة: {existing.history[existing.history.length - 1]?.note}</Notice>}
      {existing?.status === 'needs_detail' && <Notice tone="orange">طلب القائد العام: {existing.history[existing.history.length - 1]?.note}</Notice>}
      {!forceDetailed && (
        <>
          <Field label="المبلغ المطلوب (ر.س)" hint="المبلغ الافتراضي هو المرصود الذي حدده المسؤول المالي، ويمكنك تعديله">
            <Input className="num" type="number" min={0} value={amount} onChange={(e) => setAmount(Math.max(0, +e.target.value))} />
          </Field>
          <Toggle checked={detailed} onChange={setDetailed} label="أضف تفاصيل البنود (اختياري)" />
        </>
      )}
      {detailed && <BudgetEditor lines={lines} onChange={setLines} allocated={allocated} />}
      <Field label="ملاحظة للمالية (اختياري)"><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      <p className="text-xs text-ink-500">
        {ownerKind === 'trip' ? `يمر بالميسّر ثم القائد العام${value > allocated ? '، وسيُنبَّه أنها تتجاوز المرصود' : ''}، ثم يحوّل مسؤول المالية العهدة.` : value <= allocated ? 'ضمن المرصود: يذهب الطلب لمسؤول المالية مباشرة.' : 'يتجاوز المرصود: يذهب الطلب للقائد العام أولاً.'}
      </p>
      <Button onClick={send} disabled={!(value > 0)} icon={<Icons.Send className="h-4 w-4" />}>{existing && existing.status !== 'draft' ? 'أعد إرسال الطلب' : 'أرسل الطلب'}</Button>
    </div>
  );
}
