// الرئيسية: تتشكل حسب صفات المستخدم
import { Link } from 'react-router-dom';
import { pendingActions } from '@/domain/actions';
import { calKindColor, calKindLabel, eventsFor } from '@/domain/calendar';
import { fmtShort, fmtTime, relativeDays, todayISO } from '@/domain/dates';
import { SAR, tripTypeLabel } from '@/domain/labels';
import { groupsPublished, tripTeamLeaderId } from '@/domain/permissions';
import {
  custodyFigures, facilitatorTargetProgress, isPlanUnlocked, isTaskLate, kpiValue, planProgress, tripDeadlines, tripProgress, tripStage, tripStageLabel,
} from '@/domain/workflow';
import { useDB, useMe, useScores } from '@/state/store';
import { Badge, Card, Empty, Icons, Progress, Stat } from '@/ui';
import { GroupBadge, PersonChip, SectionTitle } from '@/ui/domain';

export default function Dashboard() {
  const db = useDB();
  const me = useMe();
  const scores = useScores();
  const pid = me.person.id;
  const today = todayISO();
  const upcoming = eventsFor(db, pid).filter((e) => (e.endDate ?? e.date) >= today).slice(0, 6);
  const actions = pendingActions(db, pid);
  const myScore = scores.persons.find((p) => p.personId === pid);
  const myGroupScore = scores.groups.find((g) => g.groupId === me.group?.id);
  const liveTrip = db.trips.find((t) => tripStage(db, t) === 'live');

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl bg-brand-grad p-5 text-white sm:p-7">
        <div className="absolute -bottom-20 -start-10 h-56 w-56 rounded-full bg-accent-400/30 blur-2xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-white/80">أهلاً بك</p>
            <h1 className="mt-1 text-2xl font-bold text-white sm:text-3xl">{me.person.name}</h1>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {me.labels.map((l) => <span key={l} className="chip bg-white/15 text-white">{l}</span>)}
            </div>
          </div>
          {me.isParticipant && myScore && (
            <Link to="/app/leaderboard" className="rounded-2xl bg-white/15 px-4 py-3 backdrop-blur hover:bg-white/20">
              <div className="text-xs text-white/80">ترتيبك الحالي</div>
              <div className="num text-2xl font-black text-white">#{myScore.rank} <span className="text-sm font-medium text-white/80">· {myScore.total} نقطة</span></div>
            </Link>
          )}
        </div>
        {liveTrip && (
          <Link to={`/app/trips/${liveTrip.id}`} className="relative mt-5 flex items-center gap-3 rounded-2xl bg-white/95 p-3 text-ink-800 hover:bg-white">
            <span className="relative flex h-3 w-3"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-400 opacity-75" /><span className="relative inline-flex h-3 w-3 rounded-full bg-accent-500" /></span>
            <span className="text-sm"><b>جارية الآن:</b> {liveTrip.title}</span>
            <Icons.ChevronLeft className="ms-auto h-4 w-4" />
          </Link>
        )}
      </div>

      {me.isParticipant && !groupsPublished(db) && (
        <Card><Empty title="مرحلة ما قبل تشكيل المجموعات" text="ستظهر مجموعتك بعد نشر التشكيل. يمكنك المشاركة في فعاليات فريق العمل والتواصل مع الإدارة." action={<Link to="/app/contact" className="text-sm text-brand-600">تواصل مع الإدارة</Link>} /></Card>
      )}

      {me.isStaff && <AdminKpis />}
      {me.facilitatorOf.length > 0 && <FacilitatorPanel />}
      {me.isFinance && <FinancePanel />}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="المطلوب مني" subtitle={actions.length ? `${actions.length} إجراء` : undefined} pad={false}>
            {actions.length === 0 ? (
              <div className="p-5"><Empty title="لا شيء مطلوب الآن" icon={<Icons.PartyPopper className="h-8 w-8" />} /></div>
            ) : (
              <ul className="divide-y divide-ink-100">
                {actions.slice(0, 12).map((a) => (
                  <li key={a.id}>
                    <Link to={a.link} className="flex items-center gap-3 px-4 py-3 hover:bg-ink-50 sm:px-5">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${a.tone === 'red' ? 'bg-red-500' : a.tone === 'orange' ? 'bg-accent-500' : 'bg-brand-400'}`} />
                      <span className="flex-1 text-sm">{a.title}</span>
                      <Badge>{a.group}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {(me.leaderOf || me.staffTripsLed.length > 0) && <MyTripsPrep />}
        </div>

        <div className="space-y-6">
          <Card title="القادم" action={<Link to="/app/calendar" className="text-xs text-brand-600">التقويم</Link>} pad={false}>
            {upcoming.length === 0 ? <div className="p-5 text-sm text-ink-400">لا مواعيد قادمة</div> : (
              <ul className="divide-y divide-ink-100">
                {upcoming.map((e) => (
                  <li key={e.id}>
                    <Link to={e.link} className="flex items-center gap-3 px-4 py-3 hover:bg-ink-50">
                      <div className="w-12 shrink-0 rounded-xl bg-ink-50 py-1 text-center">
                        <div className="num text-sm font-bold">{fmtShort(e.date)}</div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{e.title}</div>
                        <div className="flex items-center gap-1.5 text-[11px] text-ink-400">
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: calKindColor[e.kind] }} />
                          {calKindLabel[e.kind]} · {relativeDays(e.date)} {e.start && `· ${fmtTime(e.start)}`}
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {me.isParticipant && myScore && (
            <Card title="تقييمي" action={<Link to="/app/leaderboard" className="text-xs text-brand-600">التفاصيل</Link>}>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="rounded-xl bg-brand-50 p-3"><div className="num text-xl font-bold text-brand-700">{myScore.individualTotal}</div><div className="text-xs text-ink-500">فردي من {db.settings.split.individual}</div></div>
                <div className="rounded-xl bg-accent-50 p-3"><div className="num text-xl font-bold text-accent-700">{myScore.groupShare}</div><div className="text-xs text-ink-500">جماعي من {db.settings.split.group}</div></div>
              </div>
              {me.group && myGroupScore && <div className="mt-3 flex items-center justify-between text-sm"><GroupBadge id={me.group.id} /><span className="text-ink-500">ترتيب المجموعة #{myGroupScore.rank}</span></div>}
            </Card>
          )}

          {me.isParticipant && (
            <Card title="خطتي الشخصية" action={<Link to="/app/plan" className="text-xs text-brand-600">فتح</Link>}>
              {isPlanUnlocked(db, pid) ? (() => {
                const pr = planProgress(db.personalPlans.find((p) => p.participantId === pid));
                return <><Progress value={pr.ratio * 100} label /><p className="mt-2 text-xs text-ink-500">{pr.done} خطوات منجزة من {pr.total}</p></>;
              })() : (
                <div className="flex items-center gap-2 text-sm text-ink-500"><Icons.Lock className="h-4 w-4" /> مقفلة حتى لقاء الخطة الشخصية</div>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function MyTripsPrep() {
  const db = useDB();
  const me = useMe();
  const trips = db.trips.filter((t) => tripTeamLeaderId(db, t) === me.person.id);
  return (
    <div>
      <SectionTitle to="/app/trips">رحلات أعدّها</SectionTitle>
      <div className="grid gap-3 md:grid-cols-2">
        {trips.map((t) => {
          const st = tripStage(db, t);
          const next = tripDeadlines(db, t).find((d) => !d.done);
          return (
            <Link key={t.id} to={`/app/trips/${t.id}`} className="rounded-2xl border border-ink-100 bg-white p-4 shadow-card hover:border-brand-200">
              <div className="flex items-center justify-between gap-2">
                <Badge tone={t.type === 'external' ? 'orange' : 'blue'}>{tripTypeLabel[t.type]}</Badge>
                <Badge tone={st === 'closed' ? 'green' : 'gray'}>{tripStageLabel[st]}</Badge>
              </div>
              <div className="mt-2 font-bold">{t.title}</div>
              <Progress value={tripProgress(db, t)} className="mt-3" />
              {next && <div className={`mt-2 text-xs ${next.late ? 'text-red-600' : 'text-ink-500'}`}>{next.label}: {fmtShort(next.date)} ({relativeDays(next.date)})</div>}
            </Link>
          );
        })}
      </div>
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
      {me.isLeader && <LeaderFacilitatorsPanel />}
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
  const pending = db.invoices.filter((i) => i.status === 'pending');
  const unpaid = db.fees.filter((f) => !f.paid);
  const spent = db.custodies.reduce((s, c) => s + custodyFigures(db, c).accepted, 0);
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Stat label="عهد مفتوحة" value={open.length} icon={<Icons.Wallet className="h-5 w-5" />} to="/app/finance?tab=custody" />
      <Stat label="فواتير معلقة" value={pending.length} hint={SAR(pending.reduce((s, i) => s + i.amount, 0))} icon={<Icons.Receipt className="h-5 w-5" />} tone="accent" to="/app/finance?tab=invoices" />
      <Stat label="رسوم غير مسددة" value={unpaid.length} icon={<Icons.BadgeAlert className="h-5 w-5" />} tone="red" to="/app/finance?tab=fees" />
      <Stat label="إجمالي المصروف المعتمد" value={SAR(spent)} icon={<Icons.ChartPie className="h-5 w-5" />} tone="green" to="/app/finance?tab=analysis" />
    </div>
  );
}
