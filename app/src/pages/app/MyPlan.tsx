import { fmtDate } from '@/domain/dates';
import { isPlanUnlocked, personalPlanTrip, planUnlockAt } from '@/domain/workflow';
import { fmtDateTime } from '@/domain/dates';
import { AttachmentView } from '@/ui/attachments';
import { useDB, useMe } from '@/state/store';
import { Card, Icons, LinkButton, PageHeader } from '@/ui';
import { PlanView } from './PlanView';

export default function MyPlan() {
  const db = useDB();
  const me = useMe();
  const unlocked = isPlanUnlocked(db, me.person.id);
  const trip = personalPlanTrip(db);
  const at = planUnlockAt(db);
  const final = db.finalFiles.find((f) => f.participantId === me.person.id);
  return (
    <div>
      <PageHeader title="خطتي الشخصية" subtitle="عجلة حياة من ستة جوانب (نموذج صقل)، ولكل جانب رؤية وخطوات عملية. الخطة خاصة بك ويطّلع عليها ميسّرك والقائد العام." />
      {final && (
        <Card title="ملفك الختامي" subtitle={`رفعه ميسّرك ${fmtDateTime(final.at)} · جزء من خطتك الشخصية`} className="mb-4">
          <p className="whitespace-pre-line text-sm leading-7">{final.advice}</p>
          <AttachmentView a={final.attachment} />
        </Card>
      )}
      {unlocked ? <PlanView participantId={me.person.id} editable /> : (
        <Card>
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-ink-100"><Icons.Lock className="h-8 w-8 text-ink-400" /></div>
            <h2 className="text-lg font-bold">القسم مقفل</h2>
            <p className="max-w-md text-sm text-ink-500">
              يُفتح قسم الخطة الشخصية داخل رحلة الخطة الشخصية{trip ? ` (${trip.title} · ${fmtDate(trip.startDate)})` : ''}{at ? `، عند ${fmtDateTime(at.toISOString())}` : ''}. وبعدها تأتي اللقاءات الفردية مع ميسّرك لمناقشتها.
            </p>
            {trip && <LinkButton to={`/app/trips/${trip.id}`}>تفاصيل اللقاء</LinkButton>}
          </div>
        </Card>
      )}
    </div>
  );
}
