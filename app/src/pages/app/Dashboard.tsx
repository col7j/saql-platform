// الرئيسية: ترحيب بهوية صقل، ثم المنافسة (ترتيب المجموعات وأعلى 5) والمطلوب منك الآن، ثم القادم
import { Link } from 'react-router-dom';
import { homeFor } from '@/domain/access';
import { pendingActions, type PendingAction } from '@/domain/actions';
import { calKindColor, calKindLabel, eventsFor } from '@/domain/calendar';
import { fmtTime, now, parseDate, relativeDays, todayISO } from '@/domain/dates';
import { groupsPublished } from '@/domain/permissions';
import { tripStage } from '@/domain/workflow';
import { personName, useDB, useMe, useScores } from '@/state/store';
import { Avatar, Icons, LinkButton, cx } from '@/ui';

const groupIcon: Record<string, typeof Icons.Wallet> = {
  'المالية': Icons.Wallet, 'الاعتمادات': Icons.BadgeCheck, 'العهدة': Icons.Receipt, 'طلباتي': Icons.Receipt, 'استبيانات': Icons.ClipboardList,
  'المكتبة': Icons.LibraryBig, 'الخطة الشخصية': Icons.Compass, 'اللقاءات الفردية': Icons.UsersRound, 'لقاءات التركيز': Icons.Target,
  'المهام': Icons.ListChecks, 'إعداد الرحلات': Icons.MapPinned, 'مراجعات': Icons.FileSearch, 'اللجان': Icons.Layers, 'الرحلات': Icons.MapPinned,
  'الاجتماعات': Icons.Presentation, 'متابعة الرحلات': Icons.Radar,
};
const toneStyle = {
  red: { bar: 'bg-red-500', icon: 'bg-red-50 text-red-600', label: 'عاجل' },
  orange: { bar: 'bg-accent-grad', icon: 'bg-accent-50 text-accent-600', label: 'مطلوب' },
  blue: { bar: 'bg-brand-grad', icon: 'bg-brand-50 text-brand-600', label: 'للعلم' },
} as const;
const medal = ['🥇', '🥈', '🥉'];

export default function Dashboard() {
  const db = useDB();
  const me = useMe();
  const pid = me.person.id;
  const actions = pendingActions(db, pid);
  const live = db.trips.find((t) => tripStage(db, t) === 'live');
  const hour = now().getHours();
  const greeting = hour < 12 ? 'صباح الخير' : 'مساء الخير';
  const first = me.person.name.split(' ')[0];
  // محتوى الرئيسية لكل دور من الإعدادات (بيانات)
  const home = homeFor(db, pid);
  const showCompetition = home.includes('competition') && groupsPublished(db);
  const competitionFirst = showCompetition && home.indexOf('competition') < home.indexOf('actions');
  const mainWidgets = home.filter((w) => w === 'actions' || w === 'upcoming');

  return (
    <div className="space-y-6">
      {/* الترحيب */}
      <section className="relative overflow-hidden rounded-3xl bg-brand-deep p-5 text-white shadow-lg shadow-brand-700/20 sm:p-7">
        <div className="pointer-events-none absolute -bottom-24 -start-10 h-64 w-64 rounded-full bg-accent-400/35 blur-3xl" />
        <div className="pointer-events-none absolute -top-16 end-10 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <img src="./brand/logo-icon.svg" alt="" className="pointer-events-none absolute -end-6 -top-6 h-40 opacity-[0.07] sm:h-52" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm text-white/80">{greeting}</p>
            <h1 className="mt-1 text-2xl font-black text-white sm:text-3xl">{first} 👋</h1>
            <div className="mt-2 flex flex-wrap gap-1.5">{me.labels.slice(0, 3).map((l) => <span key={l} className="chip bg-white/15 text-white">{l}</span>)}</div>
            <p className="mt-3 text-sm text-white/90">{actions.length ? `لديك ${actions.length} ${actions.length === 1 ? 'أمر ينتظرك' : 'أمور تنتظرك'}، ابدأ بالأول.` : 'لا شيء ينتظرك الآن. أحسنت!'}</p>
          </div>
          {me.isParticipant && <MyRankBadge />}
        </div>
        {live && (
          <Link to={`/app/trips/${live.id}`} className="relative mt-5 flex min-h-[52px] items-center gap-3 rounded-2xl bg-white/95 px-4 text-sm text-ink-800 hover:bg-white">
            <span className="relative flex h-3 w-3"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-400 opacity-75" /><span className="relative inline-flex h-3 w-3 rounded-full bg-accent-500" /></span>
            <span className="flex-1"><b>تجري الآن:</b> {live.title}</span>
            <Icons.ChevronLeft className="h-4 w-4" />
          </Link>
        )}
      </section>

      {home.includes('contact_notice') && me.isParticipant && !groupsPublished(db) && (
        <div className="rounded-2xl border border-accent-200 bg-accent-50 p-4 text-sm">
          لم تُشكَّل المجموعات بعد. شارك في فعاليات فريق العمل، وراسل الإدارة إن احتجت شيئاً.
          <LinkButton to="/app/contact" variant="accent" size="sm" className="ms-2">راسل الإدارة</LinkButton>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        {/* المنافسة: لمن تتضمنها رئيسيته، وأولاً على الجوال إن سبقت المطلوب */}
        {showCompetition && (
          <div className={cx('space-y-6 lg:col-span-2', competitionFirst ? 'order-first lg:order-last' : 'order-last')}>
            <Competition />
          </div>
        )}
        <div className={cx('space-y-6', showCompetition ? 'lg:col-span-3' : 'lg:col-span-5')}>
          {mainWidgets.map((w) => (w === 'actions' ? <ActionsSection key={w} actions={actions} /> : <Upcoming key={w} />))}
        </div>
      </div>
    </div>
  );
}

function MyRankBadge() {
  const scores = useScores();
  const me = useMe();
  const mine = scores.persons.find((p) => p.personId === me.person.id);
  const myGroup = scores.groups.find((g) => g.groupId === me.group?.id);
  if (!mine) return null;
  return (
    <Link to="/app/leaderboard" className="flex items-center gap-4 rounded-2xl bg-white/15 px-4 py-3 backdrop-blur hover:bg-white/20">
      <div className="text-center">
        <div className="text-[11px] text-white/80">ترتيبك</div>
        <div className="num text-3xl font-black text-white">#{mine.rank}</div>
      </div>
      <div className="h-10 w-px bg-white/25" />
      <div className="text-sm">
        <div className="num font-bold text-white">{mine.total} نقطة</div>
        {myGroup && <div className="text-xs text-white/80">مجموعتك في المركز {myGroup.rank}</div>}
      </div>
    </Link>
  );
}

/** المنافسة: ترتيب المجموعات وأعلى 5 أفراد، مع إبراز مكانك */
function Competition() {
  const db = useDB();
  const me = useMe();
  const scores = useScores();
  const groups = [...scores.groups].sort((a, b) => a.rank - b.rank);
  const persons = [...scores.persons].sort((a, b) => a.rank - b.rank);
  const top = persons.slice(0, 5);
  const maxG = Math.max(1, ...groups.map((g) => g.total));
  const mine = persons.find((p) => p.personId === me.person.id);
  const fifth = top[4];
  return (
    <>
      <section className="overflow-hidden rounded-3xl border border-ink-100 bg-white shadow-card">
        <div className="flex items-center justify-between bg-gradient-to-l from-accent-50 to-white px-5 py-3">
          <h2 className="flex items-center gap-2 font-bold"><Icons.Trophy className="h-5 w-5 text-accent-500" />سباق المجموعات</h2>
          <Link to="/app/leaderboard" className="text-xs text-brand-600">الترتيب الكامل</Link>
        </div>
        <ol className="space-y-3 p-5">
          {groups.map((g) => {
            const gr = db.groups.find((x) => x.id === g.groupId)!;
            const isMine = me.group?.id === g.groupId;
            return (
              <li key={g.groupId} className={cx('rounded-2xl p-2.5 transition', isMine && 'bg-brand-50 ring-2 ring-brand-200')}>
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="w-7 text-center text-lg">{medal[g.rank - 1] ?? <span className="num text-sm font-bold text-ink-400">{g.rank}</span>}</span>
                  <span className="flex-1 font-bold" style={{ color: gr.color }}>{gr.name}</span>
                  {isMine && <span className="chip bg-brand-600 text-white">مجموعتك</span>}
                  <span className="num text-sm font-black">{g.total}</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-ink-100">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(g.total / maxG) * 100}%`, background: `linear-gradient(90deg, ${gr.color}aa, ${gr.color})` }} />
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="overflow-hidden rounded-3xl border border-ink-100 bg-white shadow-card">
        <div className="flex items-center justify-between bg-gradient-to-l from-brand-50 to-white px-5 py-3">
          <h2 className="flex items-center gap-2 font-bold"><Icons.Crown className="h-5 w-5 text-accent-500" />أعلى 5 مشاركين</h2>
        </div>
        {/* منصة التتويج للثلاثة الأوائل */}
        <div className="flex items-end justify-center gap-3 px-4 pt-5">
          {[top[1], top[0], top[2]].filter(Boolean).map((p) => {
            const place = p.rank;
            const g = db.groups.find((x) => x.id === p.groupId);
            const h = place === 1 ? 'h-20' : place === 2 ? 'h-14' : 'h-10';
            return (
              <div key={p.personId} className="flex w-24 flex-col items-center text-center">
                <span className="text-xl">{medal[place - 1]}</span>
                <div className={cx('rounded-full p-0.5', place === 1 ? 'bg-accent-grad' : 'bg-ink-200')}>
                  <Avatar name={personName(db, p.personId)} size={place === 1 ? 52 : 44} color={g?.color} />
                </div>
                <div className={cx('mt-1 line-clamp-1 text-xs font-bold', p.personId === me.person.id && 'text-brand-700')}>{personName(db, p.personId)}</div>
                <div className="num text-[11px] text-ink-500">{p.total}</div>
                <div className={cx('mt-1 w-full rounded-t-xl', h, place === 1 ? 'bg-accent-grad' : 'bg-brand-grad opacity-80')} />
              </div>
            );
          })}
        </div>
        <ol className="divide-y divide-ink-100 border-t border-ink-100">
          {top.slice(3).map((p) => (
            <li key={p.personId} className={cx('flex min-h-[52px] items-center gap-3 px-5', p.personId === me.person.id && 'bg-brand-50')}>
              <span className="num w-6 text-center font-bold text-ink-400">{p.rank}</span>
              <Avatar name={personName(db, p.personId)} size={28} color={db.groups.find((x) => x.id === p.groupId)?.color} />
              <span className="flex-1 text-sm">{personName(db, p.personId)}</span>
              <span className="num text-sm font-bold">{p.total}</span>
            </li>
          ))}
          {mine && mine.rank > 5 && fifth && (
            <li className="flex min-h-[56px] items-center gap-3 bg-accent-50 px-5">
              <span className="num w-6 text-center font-black text-accent-700">{mine.rank}</span>
              <span className="flex-1 text-sm"><b>مكانك</b> · ينقصك <span className="num font-bold">{Math.max(0.01, Math.round((fifth.total - mine.total) * 100) / 100)}</span> نقطة لتدخل الخمسة الأوائل 🔥</span>
            </li>
          )}
          {mine && mine.rank <= 5 && <li className="bg-emerald-50 px-5 py-3 text-sm text-emerald-800">أنت ضمن الخمسة الأوائل، حافظ على مكانك 💪</li>}
        </ol>
      </section>
    </>
  );
}

function ActionsSection({ actions }: { actions: PendingAction[] }) {
  const me = useMe();
  const top = actions.slice(0, 5);
  const rest = actions.slice(5);
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-lg font-bold"><span className="h-6 w-1.5 rounded-full bg-accent-grad" />ما المطلوب منك الآن</h2>
      {top.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-brand-200 bg-brand-50/40 p-6 text-center">
          <Icons.PartyPopper className="mx-auto h-9 w-9 text-accent-500" />
          <p className="mt-2 font-bold">أنجزت كل شيء</p>
          <p className="mt-1 text-sm text-ink-500">{me.isParticipant ? 'وقت مناسب لتصفح المكتبة أو مراجعة خطتك.' : 'راجع التقويم لما هو قادم.'}</p>
          <LinkButton to={me.isParticipant ? '/app/library' : '/app/calendar'} variant="secondary" className="mt-3">{me.isParticipant ? 'افتح المكتبة' : 'افتح التقويم'}</LinkButton>
        </div>
      ) : (
        <ul className="space-y-3">
          {top.map((a, i) => {
            const t = toneStyle[a.tone];
            const I = groupIcon[a.group] ?? Icons.Sparkles;
            return (
              <li key={a.id} className="flex overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-card transition hover:-translate-y-0.5 hover:shadow-md">
                <span className={cx('w-1.5 shrink-0', t.bar)} />
                <div className="flex flex-1 flex-wrap items-center gap-3 p-4">
                  <span className={cx('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl', t.icon)}><I className="h-5 w-5" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-medium text-ink-400">{t.label} · {a.group}</div>
                    <div className="font-bold leading-6">{a.title}</div>
                    {a.hint && <div className="mt-0.5 text-xs text-ink-500">{a.hint}</div>}
                  </div>
                  <LinkButton to={a.link} variant={i === 0 ? 'accent' : 'secondary'}>{a.cta}</LinkButton>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {rest.length > 0 && (
        <details className="mt-3 rounded-2xl border border-ink-100 bg-white">
          <summary className="flex min-h-[48px] cursor-pointer items-center px-4 text-sm font-medium text-ink-600">أمور أخرى ({rest.length})</summary>
          <ul className="divide-y divide-ink-100 border-t border-ink-100">
            {rest.map((a) => (
              <li key={a.id}>
                <Link to={a.link} className="flex min-h-[48px] items-center gap-3 px-4 text-sm hover:bg-ink-50">
                  <span className={cx('h-2 w-2 shrink-0 rounded-full', toneStyle[a.tone].bar)} />
                  <span className="flex-1">{a.title}</span>
                  <span className="text-xs text-brand-700">{a.cta}</span>
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function Upcoming() {
  const db = useDB();
  const me = useMe();
  const upcoming = eventsFor(db, me.person.id).filter((e) => (e.endDate ?? e.date) >= todayISO()).slice(0, 4);
  if (!upcoming.length) return null;
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-bold"><span className="h-6 w-1.5 rounded-full bg-brand-grad" />القادم</h2>
        <Link to="/app/calendar" className="text-sm text-brand-600">التقويم</Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {upcoming.map((e) => {
          const d = parseDate(e.date);
          return (
            <Link key={e.id} to={e.link} className="flex items-center gap-3 rounded-2xl border border-ink-100 bg-white p-3 shadow-card hover:border-brand-200">
              <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl text-white" style={{ background: calKindColor[e.kind] }}>
                <span className="num text-lg font-black leading-none">{d.getDate()}</span>
                <span className="text-[10px]">{d.toLocaleDateString('ar-SA-u-ca-gregory', { month: 'short' })}</span>
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-bold">{e.title}</div>
                <div className="text-xs text-ink-500">{calKindLabel[e.kind]} · {relativeDays(e.date)}{e.start ? ` · ${fmtTime(e.start)}` : ''}</div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
