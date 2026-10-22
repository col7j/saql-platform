// طلباتي: طلبات الميزانية التي قدّمتها، والعهد التي استلمتها، بحالة واضحة والخطوة التالية
import { Link } from 'react-router-dom';
import { SAR } from '@/domain/labels';
import { ownerLink, ownerTitle, requestStage, spendKindLabel } from '@/domain/finance';
import { useDB, useMe } from '@/state/store';
import { Card, Empty, Icons, PageHeader, StatusPill } from '@/ui';
import { CustodyCard } from './CustodyCard';

export default function RequestsPage() {
  const db = useDB();
  const me = useMe();
  const pid = me.person.id;
  const mine = [...db.budgetRequests].reverse().filter((r) => r.requestedBy === pid);
  const custodies = db.custodies.filter((c) => c.recipientId === pid && c.status !== 'closed');
  const closed = db.custodies.filter((c) => c.recipientId === pid && c.status === 'closed');
  return (
    <div className="space-y-6">
      <PageHeader title="طلباتي" subtitle="طلبات الميزانية التي قدّمتها، والعهد التي بعهدتك" />
      {custodies.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-bold">عهد مفتوحة بعهدتك</h2>
          {custodies.map((c) => <CustodyCard key={c.id} custody={c} />)}
        </section>
      )}
      <section>
        <h2 className="mb-2 text-base font-bold">طلبات الميزانية</h2>
        {mine.length === 0 ? (
          <Empty title="لا طلبات بعد" text={me.facilitatorOf.length ? 'ابدأ من صفحة لقاء التركيز: «اطلب الميزانية».' : 'ابدأ من صفحة الرحلة: تبويب «الميزانية».'} icon={<Icons.ReceiptText className="h-8 w-8" />} />
        ) : (
          <Card pad={false}>
            <ul className="divide-y divide-ink-100">
              {mine.map((r) => {
                const st = requestStage(db, r);
                return (
                  <li key={r.id}>
                    <Link to={ownerLink(r.ownerKind, r.ownerId)} className="flex min-h-[64px] flex-wrap items-center gap-3 px-4 py-3 hover:bg-ink-50">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">{ownerTitle(db, r.ownerKind, r.ownerId)}</div>
                        <div className="text-xs text-ink-500">{spendKindLabel[r.spendKind]} · <span className="num">{SAR(r.amount)}</span></div>
                      </div>
                      <StatusPill label={st.label} tone={st.tone} next={st.next} waitingOn={st.waitingOn} compact />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </section>
      {closed.length > 0 && (
        <details className="rounded-2xl border border-ink-100 bg-white p-4">
          <summary className="cursor-pointer text-sm font-medium">عهد مغلقة ({closed.length})</summary>
          <div className="mt-3 space-y-3">{closed.map((c) => <CustodyCard key={c.id} custody={c} />)}</div>
        </details>
      )}
    </div>
  );
}
