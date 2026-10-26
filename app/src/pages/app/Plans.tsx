// الخطط الشخصية: الميسّر يرى مجموعته فقط، والقائد العام يرى الكل ويتابع بها أداء الميسّرين
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ASPECT_KEYS, aspectColor, aspectLabel } from '@/domain/labels';
import { canSeePersonalPlan } from '@/domain/permissions';
import { isPlanUnlocked, planProgress } from '@/domain/workflow';
import { act, personName, repos, useDB, useMe } from '@/state/store';
import type { Attachment } from '@/domain/types';
import { Badge, Button, Card, Empty, Icons, PageHeader, Progress, Textarea } from '@/ui';
import { AttachmentInput, AttachmentView } from '@/ui/attachments';
import { GroupBadge, PersonChip } from '@/ui/domain';
import { PlanView } from './PlanView';

export default function PlansPage() {
  const db = useDB();
  const me = useMe();
  const groups = me.isLeader ? db.groups : me.facilitatorOf;
  return (
    <div>
      <PageHeader title="الخطط الشخصية" subtitle={me.isLeader ? 'كل الخطط، ومتابعة أداء الميسّرين من خلالها' : 'خطط مجموعتك: ما أُنجز وما لم يُنجز'} />
      <div className="space-y-6">
        {groups.map((g) => (
          <Card key={g.id} title={<GroupBadge id={g.id} />} subtitle={<>الميسّر: {personName(db, g.facilitatorId)}</>} pad={false}>
            <div className="divide-y divide-ink-100">
              {g.memberIds.map((pid) => {
                const plan = db.personalPlans.find((p) => p.participantId === pid);
                const unlocked = isPlanUnlocked(db, pid);
                const pr = planProgress(plan);
                const help = plan?.aspects.flatMap((a) => a.steps).filter((s) => s.followUps.some((f) => f.needHelp) && s.status === 'challenged').length ?? 0;
                return (
                  <div key={pid} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                    <div className="w-44"><PersonChip id={pid} /></div>
                    {unlocked ? (
                      <>
                        <div className="flex gap-1">
                          {ASPECT_KEYS.map((k) => {
                            const lv = plan?.aspects.find((a) => a.key === k)?.level ?? 0;
                            return <span key={k} title={`${aspectLabel[k]}: ${lv}`} className="flex h-8 w-3 items-end overflow-hidden rounded bg-ink-100"><span className="w-full" style={{ height: `${lv * 10}%`, background: aspectColor[k] }} /></span>;
                          })}
                        </div>
                        <div className="min-w-[140px] flex-1"><Progress value={pr.ratio * 100} tone="green" label /></div>
                        <span className="text-xs text-ink-500">{pr.done}/{pr.total} خطوة</span>
                        {help > 0 && <Badge tone="red" icon={<Icons.LifeBuoy className="h-3 w-3" />}>يحتاج مساعدة ({help})</Badge>}
                        <Link to={`/app/plans/${pid}`} className="text-sm text-brand-600">عرض</Link>
                      </>
                    ) : (
                      <>
                        <Badge icon={<Icons.Lock className="h-3 w-3" />}>مقفلة (لم يحضر لقاء الخطة الشخصية)</Badge>
                        {me.isLeader && <Button size="sm" variant="secondary" onClick={() => act(() => repos.plans.unlock(pid), 'فُتحت الخطة')}>افتح يدوياً</Button>}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function PlanOf() {
  const { id } = useParams();
  const db = useDB();
  const me = useMe();
  if (!id || !canSeePersonalPlan(db, me.person.id, id)) return <Empty title="لا تملك صلاحية رؤية هذه الخطة" text="الخطط الشخصية خاصة بأصحابها، ويراها ميسّر المجموعة والقائد العام فقط." />;
  return (
    <div>
      <PageHeader back="/app/plans" title={`خطة ${personName(db, id)}`} subtitle="عرض للمتابعة (لا تعديل)" />
      <FinalFileCard participantId={id} />
      <PlanView participantId={id} editable={false} />
    </div>
  );
}

/** الملف الختامي: يرفعه الميسّر في نهاية البرنامج (يوم الختام قبل الحفل)، ويُحسب جزءاً من الخطة الشخصية */
function FinalFileCard({ participantId }: { participantId: string }) {
  const db = useDB();
  const me = useMe();
  const f = db.finalFiles.find((x) => x.participantId === participantId);
  const isFac = db.groups.find((g) => g.memberIds.includes(participantId))?.facilitatorId === me.person.id;
  const [advice, setAdvice] = useState(f?.advice ?? '');
  const [att, setAtt] = useState<Attachment | undefined>(f?.attachment);
  if (!f && !isFac) return null;
  return (
    <Card title="الملف الختامي" subtitle="نصائح وبيانات يحمّلها المشارك ويستفيد منها" className="mb-4">
      {isFac ? (
        <div className="grid gap-3">
          <Textarea rows={3} placeholder="نصائح ختامية للمشارك" value={advice} onChange={(e) => setAdvice(e.target.value)} />
          <AttachmentInput value={att} onChange={setAtt} label="الملف (PDF أو صورة)" />
          <Button disabled={!att || !advice.trim()} onClick={() => act(() => repos.finalFiles.upload(participantId, advice, att!), 'رُفع الملف الختامي')}>{f ? 'حدّث الملف' : 'ارفع الملف الختامي'}</Button>
        </div>
      ) : (
        <><p className="whitespace-pre-line text-sm">{f!.advice}</p><AttachmentView a={f!.attachment} /></>
      )}
    </Card>
  );
}
