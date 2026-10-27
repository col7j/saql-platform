// بانتظار اعتمادي (القائد العام): كل ما ينتظر قراره في مكان واحد. طلبات الاعتماد، وطلبات تعديل السجلات المعتمدة، وتنبيهات تجاوز الميزانية
import { useState } from 'react';
import { canLeaderDecide, ownerLink, ownerTitle, spendKindLabel } from '@/domain/finance';
import { budgetOverview, custodyFigures } from '@/domain/ledger';
import { SAR, docKindLabel } from '@/domain/labels';
import { personName, useDB, useMe } from '@/state/store';
import { Badge, Card, Empty, Icons, LinkButton, PageHeader, cx } from '@/ui';
import { EditRequestsList } from './EditRequest';
import { RequestPanel } from './RequestPanel';

interface Row { id: string; title: string; hint: string; kind: string; to?: string; budget?: { ownerKind: 'trip' | 'focus' | 'meeting' | 'event' | 'need'; ownerId: string } }

export default function ApprovalsPage() {
  const db = useDB();
  const me = useMe();
  const pid = me.person.id;
  const [open, setOpen] = useState<string | null>(null);

  // 1) طلبات الاعتماد
  const rows: Row[] = [
    ...db.budgetRequests.filter((r) => canLeaderDecide(db, pid, r)).map((r) => ({
      id: r.id, kind: 'ميزانية', title: ownerTitle(db, r.ownerKind, r.ownerId),
      hint: `${spendKindLabel[r.spendKind]} · مطلوب ${SAR(r.amount)} والمرصود ${SAR(r.allocated)}`, budget: { ownerKind: r.ownerKind, ownerId: r.ownerId },
    })),
    ...db.docs.filter((d) => {
      const t = db.trips.find((x) => x.id === d.tripId)!;
      return t.executor.kind === 'staff' ? d.status === 'submitted' : d.status === 'facilitator_approved';
    }).map((d) => ({ id: d.id, kind: 'نموذج رحلة', title: `${docKindLabel[d.kind]}: ${db.trips.find((t) => t.id === d.tripId)!.title}`, hint: 'وافق عليه الميسّر ويحتاج قرارك', to: `/app/trips/${d.tripId}?tab=docs` })),
    ...db.trips.filter((t) => t.trackerSubstitute?.status === 'pending').map((t) => ({ id: `ts_${t.id}`, kind: 'متابع بديل', title: t.title, hint: `المرشح: ${personName(db, t.trackerSubstitute!.candidateId)}`, to: `/app/trips/${t.id}` })),
    ...db.memberRequests.filter((r) => r.status === 'pending').map((r) => ({ id: r.id, kind: 'عضوية لجنة', title: personName(db, r.personId), hint: db.committees.find((c) => c.id === r.committeeId)?.name ?? '', to: `/app/committees/${r.committeeId}` })),
  ];

  // 3) تنبيهات تجاوز الميزانية: طلب فوق المرصود، وعهدة صُرف منها أكثر مما حُوّل، ونوع صرف تجاوز مرصوده
  const alerts = [
    ...db.budgetRequests.filter((r) => r.amount > r.allocated && r.status !== 'rejected').map((r) => ({ id: r.id, title: ownerTitle(db, r.ownerKind, r.ownerId), hint: `الطلب ${SAR(r.amount)} يتجاوز المرصود ${SAR(r.allocated)} بـ ${SAR(r.amount - r.allocated)}`, to: ownerLink(r.ownerKind, r.ownerId) })),
    ...db.custodies.filter((c) => c.status !== 'closed' && custodyFigures(db, c).deficit > 0).map((c) => ({ id: c.id, title: ownerTitle(db, c.ownerKind, c.ownerId), hint: `المعتمد من الفواتير يتجاوز المحوَّل بـ ${SAR(custodyFigures(db, c).deficit)}`, to: ownerLink(c.ownerKind, c.ownerId) })),
    ...budgetOverview(db).rows.filter((r) => r.spent > r.allocated && r.allocated > 0).map((r) => ({ id: `bo_${r.key}`, title: r.label, hint: `المصروف ${SAR(r.spent)} من مرصود ${SAR(r.allocated)}`, to: '/app/finance?tab=wallet' })),
  ];

  return (
    <div className="space-y-8">
      <PageHeader title="بانتظار اعتمادي" subtitle="كل ما ينتظر قرارك: افتح الطلب واتخذ القرار من مكانه" />

      <section>
        <h2 className="mb-3 text-lg font-bold">طلبات الاعتماد <span className="num text-ink-500">({rows.length})</span></h2>
        {rows.length === 0 ? <Empty title="لا طلبات تنتظرك" icon={<Icons.Stamp className="h-7 w-7" />} /> : (
          <div className="space-y-3">
            {rows.map((r) => (
              <div key={r.id} className={cx('rounded-2xl border bg-white shadow-card', open === r.id ? 'border-brand-200' : 'border-ink-100')}>
                <div className="flex min-h-[64px] flex-wrap items-center gap-3 px-4 py-3">
                  <Badge tone="orange">{r.kind}</Badge>
                  <div className="min-w-0 flex-1"><div className="font-medium">{r.title}</div><div className="text-xs text-ink-500">{r.hint}</div></div>
                  {r.budget
                    ? <button onClick={() => setOpen(open === r.id ? null : r.id)} className="inline-flex min-h-[44px] items-center gap-1 rounded-full px-3 text-sm font-medium text-brand-700 hover:bg-brand-50">{open === r.id ? 'أغلق' : 'اتخذ القرار'}<Icons.ChevronDown className={cx('h-4 w-4 transition', open === r.id && 'rotate-180')} /></button>
                    : <LinkButton to={r.to!} variant="text" size="sm">افتح</LinkButton>}
                </div>
                {open === r.id && r.budget && <div className="border-t border-ink-100 p-3"><RequestPanel ownerKind={r.budget.ownerKind} ownerId={r.budget.ownerId} title="تفاصيل الطلب" /></div>}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <EditRequestsList />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">تنبيهات تجاوز الميزانية <span className="num text-ink-500">({alerts.length})</span></h2>
        {alerts.length === 0 ? <Empty title="لا تجاوزات" /> : (
          <Card pad={false}>
            <ul className="divide-y divide-ink-100">
              {alerts.map((a) => (
                <li key={a.id} className="flex min-h-[56px] flex-wrap items-center gap-3 px-4 py-3">
                  <Icons.TriangleAlert className="h-5 w-5 shrink-0 text-accent-500" />
                  <div className="min-w-0 flex-1"><div className="font-medium">{a.title}</div><div className="text-xs text-ink-500">{a.hint}</div></div>
                  <LinkButton to={a.to} variant="text" size="sm">افتح</LinkButton>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </div>
  );
}
