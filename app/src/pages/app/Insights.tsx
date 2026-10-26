// الرئيسية: تتشكل حسب صفات المستخدم
import { Link } from 'react-router-dom';
import { pendingActions } from '@/domain/actions';
import { calKindColor, calKindLabel, eventsFor } from '@/domain/calendar';
import { fmtShort, fmtTime, relativeDays, todayISO } from '@/domain/dates';
import { budgetOverview } from '@/domain/ledger';
import { SAR, tripTypeLabel } from '@/domain/labels';
import { groupsPublished, tripTeamLeaderId } from '@/domain/permissions';
import {
  facilitatorTargetProgress, isPlanUnlocked, isTaskLate, kpiValue, planProgress, tripDeadlines, tripProgress, tripStage, tripStageLabel,
} from '@/domain/workflow';
import { useDB, useMe, useScores } from '@/state/store';
import { Badge, Card, Empty, Icons, PageHeader, Progress, Stat } from '@/ui';
import { canViewBudget } from '@/domain/finance';
import { GroupBadge, PersonChip, SectionTitle } from '@/ui/domain';

// المؤشرات: لوحة الإدارة التفصيلية (نُقلت من الرئيسية لتبقى الرئيسية للمطلوب الآن فقط)
export default function InsightsPage() {
  const db = useDB();
  const me = useMe();
  return (
    <div className="space-y-6">
      <PageHeader title="المؤشرات" subtitle="تخطيط المجموعات، والمستهدفات، وتقدم اللجان، والحضور" />
      <AdminKpis />
      {me.isLeader && <LeaderFacilitatorsPanel />}
      {me.facilitatorOf.length > 0 && <FacilitatorPanel />}
      {canViewBudget(db, me.person.id) && <FinancePanel />}
    </div>
  );
}

function AdminKpis() {
  const db = useDB();
  const me = useMe();
  const today = todayISO();
  const stages = db.trips.map((t) => tripStage(db, t));
  const lateTasks = db.tasks.filter(isTaskLate);
  const deadlines = db.trips.flatMap((t) => tripDeadlines(db, t).filter((d) => !d.done).map((d) => ({ ...d, trip: t })));
  const late = deadlines.filter((d) => d.late);
  const focusTarget = db.settings.targets.focusMeetingsPerGroup * db.groups.length;
  const focusDoneN = db.focusMeetings.filter((f) => f.status === 'held' || f.status === 'closed').length;
  const heldTrips = db.trips.filter((t) => ['live', 'closing', 'closed'].includes(tripStage(db, t)));
  const att = db.attendance.filter((a) => a.eventKind !== 'individual' && (a.eventKind === 'focus' || heldTrips.some((t) => t.id === a.eventId)));
  const attRate = att.length ? Math.round((att.filter((a) => a.present).length / att.length) * 100) : 0;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="رحلات مغلقة" value={`${stages.filter((s) => s === 'closed').length}/${db.trips.length}`} icon={<Icons.MapPinned className="h-5 w-5" />} to="/app/trips" />
        <Stat label="لقاءات تركيز منعقدة" value={`${focusDoneN}/${focusTarget}`} hint="مقابل المستهدف الأدنى" icon={<Icons.Target className="h-5 w-5" />} tone="accent" to="/app/focus" />
        <Stat label="مواعيد نهائية متأخرة" value={late.length} icon={<Icons.AlarmClock className="h-5 w-5" />} tone="red" />
        <Stat label="نسبة الحضور" value={`${attRate}%`} hint={`${db.persons.filter((p) => p.kind === 'participant').length} مشاركاً`} icon={<Icons.UserCheck className="h-5 w-5" />} tone="green" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="تخطيط المجموعات للرحلات" subtitle="أين وصلوا وأين تعثروا" pad={false}>
          <ul className="divide-y divide-ink-100">
            {db.trips.filter((t) => tripStage(db, t) !== 'closed').map((t) => {
              const st = tripStage(db, t);
              const dl = tripDeadlines(db, t).find((d) => !d.done);
              return (
                <li key={t.id}>
                  <Link to={`/app/trips/${t.id}`} className="block px-4 py-3 hover:bg-ink-50 sm:px-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium">{t.title}</span>
                      <Badge tone={st === 'live' ? 'orange' : st === 'published' ? 'green' : 'blue'}>{tripStageLabel[st]}</Badge>
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <Progress value={tripProgress(db, t)} className="flex-1" />
                      {dl && <span className={`text-[11px] ${dl.late ? 'font-bold text-red-600' : 'text-ink-400'}`}>{dl.late ? 'متأخر: ' : ''}{dl.label} {fmtShort(dl.date)}</span>}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
        <div className="space-y-6">
          <Card title="تقدّم اللجان" action={<Link to="/app/committees" className="text-xs text-brand-600">اللجان</Link>}>
            <div className="space-y-3">
              {db.committees.flatMap((c) => c.kpis.map((k) => ({ c, k }))).map(({ c, k }) => {
                const v = kpiValue(db, c.id, k.taskTag);
                return (
                  <div key={k.id}>
                    <div className="mb-1 flex justify-between text-xs"><span>{k.title} <span className="text-ink-400">· {c.name}</span></span><span className="num text-ink-500">{v}/{k.target}</span></div>
                    <Progress value={(v / k.target) * 100} tone={v / k.target < 0.3 ? 'accent' : 'brand'} />
                  </div>
                );
              })}
            </div>
          </Card>
          <Card title="المهام المتأخرة" subtitle={`${lateTasks.length} مهمة`} action={<Link to="/app/tasks" className="text-xs text-brand-600">لوحة المهام</Link>} pad={false}>
            <ul className="divide-y divide-ink-100">
              {lateTasks.slice(0, 5).map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm sm:px-5">
                  <span className="truncate">{t.title}</span>
                  <PersonChip id={t.assigneeId} size={22} />
                </li>
              ))}
              {lateTasks.length === 0 && <li className="px-5 py-4 text-sm text-ink-400">لا مهام متأخرة</li>}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

function LeaderFacilitatorsPanel() {
  const db = useDB();
  return (
    <Card title="متابعة الميسّرين" subtitle="المستهدفات والخطط الشخصية لكل مجموعة" action={<Link to="/app/plans" className="text-xs text-brand-600">كل الخطط</Link>}>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {db.groups.map((g) => {
          const p = facilitatorTargetProgress(db, g.facilitatorId!);
          const plans = g.memberIds.map((m) => planProgress(db.personalPlans.find((x) => x.participantId === m)).ratio);
          const avg = plans.reduce((a, b) => a + b, 0) / (plans.length || 1);
          return (
            <div key={g.id} className="rounded-2xl border border-ink-100 p-4">
              <div className="flex items-center justify-between"><GroupBadge id={g.id} />{p.umrahDone && <Badge tone="green">العمرة ✓</Badge>}</div>
              <div className="mt-2"><PersonChip id={g.facilitatorId} sub="الميسّر" size={26} /></div>
              <div className="mt-3 space-y-2 text-xs">
                <div><div className="mb-1 flex justify-between"><span>لقاءات التركيز</span><span className="num">{p.focusDone}/{p.focusTarget}</span></div><Progress value={(p.focusDone / p.focusTarget) * 100} /></div>
                <div><div className="mb-1 flex justify-between"><span>اللقاءات الفردية</span><span className="num">{p.individualDone}/{p.individualTarget}</span></div><Progress value={(p.individualDone / p.individualTarget) * 100} tone="accent" /></div>
                <div><div className="mb-1 flex justify-between"><span>تقدم الخطط الشخصية</span><span className="num">{Math.round(avg * 100)}%</span></div><Progress value={avg * 100} tone="green" /></div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function FacilitatorPanel() {
  const db = useDB();
  const me = useMe();
  const p = facilitatorTargetProgress(db, me.person.id);
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Stat label="لقاءات التركيز (المستهدف)" value={`${p.focusDone}/${p.focusTarget}`} icon={<Icons.Target className="h-5 w-5" />} tone="accent" to="/app/focus" />
      <Stat label="اللقاءات الفردية" value={`${p.individualDone}/${p.individualTarget}`} hint={`${p.membersReachedTarget} من ${p.members} بلغوا المستهدف`} icon={<Icons.UsersRound className="h-5 w-5" />} to="/app/individual" />
      <Stat label="لقاء العمرة" value={p.umrahDone ? 'نُفّذ' : 'لم يُنفّذ'} icon={<Icons.Moon className="h-5 w-5" />} tone={p.umrahDone ? 'green' : 'red'} to="/app/focus" />
      <Stat label="مجموعتي" value={me.facilitatorOf.map((g) => g.name).join('، ')} icon={<Icons.LayoutGrid className="h-5 w-5" />} to="/app/groups" />
    </div>
  );
}

function FinancePanel() {
  const db = useDB();
  const open = db.custodies.filter((c) => c.status !== 'closed');
  const pending = db.spendForms.flatMap((f) => f.lines).filter((l) => l.status === 'pending');
  const unpaid = db.fees.filter((f) => f.status !== 'paid');
  const spent = budgetOverview(db).spent;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Stat label="عهد مفتوحة" value={open.length} icon={<Icons.Wallet className="h-5 w-5" />} to="/app/finance?tab=custody" />
      <Stat label="بنود صرف معلقة" value={pending.length} hint={SAR(pending.reduce((s, l) => s + l.amount, 0))} icon={<Icons.Receipt className="h-5 w-5" />} tone="accent" to="/app/finance?tab=invoices" />
      <Stat label="رسوم غير مسددة أو جزئية" value={unpaid.length} icon={<Icons.BadgeAlert className="h-5 w-5" />} tone="red" to="/app/finance?tab=fees" />
      <Stat label="إجمالي المصروف المعتمد" value={SAR(spent)} icon={<Icons.ChartPie className="h-5 w-5" />} tone="green" to="/app/finance?tab=analysis" />
    </div>
  );
}
