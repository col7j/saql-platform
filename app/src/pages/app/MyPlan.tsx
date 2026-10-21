import { fmtDate } from '@/domain/dates';
import { isPlanUnlocked, personalPlanTrip } from '@/domain/workflow';
import { useDB, useMe } from '@/state/store';
import { Card, Icons, LinkButton, PageHeader } from '@/ui';
import { PlanView } from './PlanView';

export default function MyPlan() {
  const db = useDB();
  const me = useMe();
  const unlocked = isPlanUnlocked(db, me.person.id);
  const trip = personalPlanTrip(db);
  return (
    <div>
      <PageHeader title="خطتي الشخصية" subtitle="عجلة حياة من ستة جوانب (نموذج صقل)، ولكل جانب رؤية وخطوات عملية. الخطة خاصة بك ويطّلع عليها ميسّرك والقائد العام." />
      {unlocked ? <PlanView participantId={me.person.id} editable /> : (
        <Card>
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-ink-100"><Icons.Lock className="h-8 w-8 text-ink-400" /></div>
            <h2 className="text-lg font-bold">القسم مقفل</h2>
            <p className="max-w-md text-sm text-ink-500">
              يُفتح قسم الخطة الشخصية بعد حضورك "لقاء الخطة الشخصية"{trip ? ` (${trip.title} · ${fmtDate(trip.startDate)})` : ''}. فيه استبيان قبلي عن عجلة الحياة، ومدرب يشرح كيف تعبّئها.
            </p>
            {trip && <LinkButton to={`/app/trips/${trip.id}`}>تفاصيل اللقاء</LinkButton>}
          </div>
        </Card>
      )}
    </div>
  );
}
