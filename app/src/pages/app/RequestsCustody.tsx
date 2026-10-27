// الطلبات والعهد: شاشة واحدة بمنظورين. منظور المالية (كل الطلبات والعهد وما ينتظرني والإغلاق)، ومنظور صاحب الطلب أو العهدة («طلباتي»)
import { useState } from 'react';
import { canDisburse, canFinanceDecide, hasFinancePerm, ownerTitle, requestStage, spendKindLabel } from '@/domain/finance';
import { custodyFigures } from '@/domain/ledger';
import { SAR, custodyStatusLabel, custodyStatusTone } from '@/domain/labels';
import type { BudgetRequest, Custody } from '@/domain/types';
import { personName, useDB, useMe } from '@/state/store';
import { Badge, Empty, FilterPills, Icons, StatusPill, cx } from '@/ui';
import { CustodyCard } from './CustodyCard';
import { RequestPanel } from './RequestPanel';

type Row = { kind: 'request'; r: BudgetRequest } | { kind: 'custody'; c: Custody };
type FinanceFilter = 'waiting' | 'requests' | 'open' | 'closed' | 'mine';
type MineFilter = 'open' | 'requests' | 'closed';

export function RequestsCustody({ perspective, focusId }: { perspective: 'finance' | 'mine'; focusId?: string | null }) {
  const db = useDB();
  const me = useMe();
  const pid = me.person.id;
  const [open, setOpen] = useState<string | null>(focusId ?? null);
  const can = (p: Parameters<typeof hasFinancePerm>[2]) => hasFinancePerm(db, pid, p);

  const requests = [...db.budgetRequests].reverse();
  const custodies = [...db.custodies].reverse();
  const waitingOnMe = (r: BudgetRequest) => requestStage(db, r).waitingOnId === pid || canFinanceDecide(db, pid, r) || canDisburse(db, pid, r);
  const custodyWaiting = (c: Custody) => (c.status === 'closing' && can('close_custody')) || (c.status === 'active' && can('disburse') && custodyFigures(db, c).toTransfer > 0);
  const mineReq = requests.filter((r) => r.requestedBy === pid);
  const mineCus = custodies.filter((c) => c.recipientId === pid);

  const fin: Record<FinanceFilter, Row[]> = {
    waiting: [...requests.filter(waitingOnMe).map((r) => ({ kind: 'request' as const, r })), ...custodies.filter(custodyWaiting).map((c) => ({ kind: 'custody' as const, c }))],
    requests: requests.map((r) => ({ kind: 'request' as const, r })),
    open: custodies.filter((c) => c.status !== 'closed').map((c) => ({ kind: 'custody' as const, c })),
    closed: custodies.filter((c) => c.status === 'closed').map((c) => ({ kind: 'custody' as const, c })),
    mine: [...mineCus.filter((c) => c.status !== 'closed').map((c) => ({ kind: 'custody' as const, c })), ...mineReq.map((r) => ({ kind: 'request' as const, r }))],
  };
  const mine: Record<MineFilter, Row[]> = {
    open: mineCus.filter((c) => c.status !== 'closed').map((c) => ({ kind: 'custody' as const, c })),
    requests: mineReq.map((r) => ({ kind: 'request' as const, r })),
    closed: mineCus.filter((c) => c.status === 'closed').map((c) => ({ kind: 'custody' as const, c })),
  };
  const [ff, setFf] = useState<FinanceFilter>(focusId ? 'requests' : 'waiting');
  const [mf, setMf] = useState<MineFilter>(mine.open.length ? 'open' : 'requests');
  const rows = perspective === 'finance' ? fin[ff] : mine[mf];

  return (
    <div className="space-y-4">
      {perspective === 'finance' ? (
        <FilterPills value={ff} onChange={setFf} options={[
          { key: 'waiting', label: `تنتظرني (${fin.waiting.length})` },
          { key: 'requests', label: `الطلبات (${fin.requests.length})` },
          { key: 'open', label: `العهد المفتوحة (${fin.open.length})` },
          { key: 'closed', label: `المغلقة (${fin.closed.length})` },
          ...(fin.mine.length ? [{ key: 'mine' as const, label: `طلباتي (${fin.mine.length})` }] : []),
        ]} />
      ) : (
        <FilterPills value={mf} onChange={setMf} options={[
          { key: 'open', label: `عهد بعهدتك (${mine.open.length})` },
          { key: 'requests', label: `طلبات الميزانية (${mine.requests.length})` },
          { key: 'closed', label: `عهد مغلقة (${mine.closed.length})` },
        ]} />
      )}
      {rows.length === 0 ? (
        <Empty title={perspective === 'finance' && ff === 'waiting' ? 'لا شيء ينتظرك' : 'لا عناصر هنا'} text={perspective === 'mine' ? (me.facilitatorOf.length ? 'ابدأ طلب الميزانية من صفحة لقاء التركيز.' : 'ابدأ طلب الميزانية من صفحة الرحلة أو الاجتماع.') : undefined} icon={<Icons.ReceiptText className="h-7 w-7" />} />
      ) : perspective === 'mine' && mf === 'open' ? (
        // صاحب العهدة يعمل على بطاقتها مباشرة: يرفع نماذج الصرف ويطلب الإغلاق
        <div className="space-y-4">{mine.open.map((x) => x.kind === 'custody' && <CustodyCard key={x.c.id} custody={x.c} />)}</div>
      ) : (
        <div className="space-y-3">
          {rows.map((x) => {
            const id = x.kind === 'request' ? x.r.id : x.c.id;
            const isOpen = open === id || (x.kind === 'custody' && open === x.c.requestId);
            return (
              <div key={`${x.kind}_${id}`} className={cx('rounded-2xl border bg-white shadow-card', isOpen ? 'border-brand-200' : 'border-ink-100')}>
                <button onClick={() => setOpen(isOpen ? null : id)} aria-expanded={isOpen} className="flex min-h-[64px] w-full flex-wrap items-center gap-3 px-4 py-3 text-start">
                  {x.kind === 'request' ? <RequestHead r={x.r} /> : <CustodyHead c={x.c} />}
                  <Icons.ChevronDown className={cx('h-4 w-4 shrink-0 transition', isOpen && 'rotate-180')} />
                </button>
                {isOpen && (
                  <div className="border-t border-ink-100 p-3">
                    {x.kind === 'request' ? <RequestPanel ownerKind={x.r.ownerKind} ownerId={x.r.ownerId} title="تفاصيل الطلب" /> : <CustodyCard custody={x.c} embedded />}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RequestHead({ r }: { r: BudgetRequest }) {
  const db = useDB();
  const st = requestStage(db, r);
  return (
    <>
      <Badge tone="blue">طلب</Badge>
      <div className="min-w-0 flex-1">
        <div className="font-medium">{ownerTitle(db, r.ownerKind, r.ownerId)}</div>
        <div className="mt-0.5 text-xs text-ink-500">{spendKindLabel[r.spendKind]} · {personName(db, r.requestedBy)} · <span className="num">{SAR(r.amount)}</span> من المرصود <span className="num">{SAR(r.allocated)}</span>{r.amount > r.allocated && <span className="text-accent-700"> (تجاوز)</span>}</div>
      </div>
      <StatusPill label={st.label} tone={st.tone} next={st.next} waitingOn={st.waitingOn} compact />
    </>
  );
}

function CustodyHead({ c }: { c: Custody }) {
  const db = useDB();
  const f = custodyFigures(db, c);
  return (
    <>
      <Badge>عهدة</Badge>
      <div className="min-w-0 flex-1">
        <div className="font-medium">{ownerTitle(db, c.ownerKind, c.ownerId)}</div>
        <div className="mt-0.5 text-xs text-ink-500">{spendKindLabel[c.spendKind]} · {personName(db, c.recipientId)} · المعتمد <span className="num">{SAR(c.approved)}</span> · الرصيد <span className="num">{SAR(f.balance)}</span>{f.pendingLines > 0 && <span className="text-accent-700"> · {f.pendingLines} بنود بانتظار المراجعة</span>}</div>
      </div>
      <Badge tone={custodyStatusTone[c.status]}>{custodyStatusLabel[c.status]}</Badge>
    </>
  );
}
