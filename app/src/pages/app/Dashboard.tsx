// الرئيسية: موجّهة بالمهام. "ما المطلوب منك الآن" في 3 إلى 5 بطاقات، لكل بطاقة إجراء واحد.
import { Link } from 'react-router-dom';
import { pendingActions } from '@/domain/actions';
import { calKindColor, eventsFor } from '@/domain/calendar';
import { fmtShort, fmtTime, relativeDays, todayISO } from '@/domain/dates';
import { groupsPublished } from '@/domain/permissions';
import { isPlanUnlocked, tripStage } from '@/domain/workflow';
import { useDB, useMe, useScores } from '@/state/store';
import { Card, Icons, LinkButton, cx } from '@/ui';

const toneBar = { red: 'bg-red-500', orange: 'bg-accent-500', blue: 'bg-brand-400' } as const;
const toneText = { red: 'عاجل', orange: 'مطلوب', blue: 'للعلم' } as const;

export default function Dashboard() {
  const db = useDB();
  const me = useMe();
  const scores = useScores();
  const pid = me.person.id;
  const actions = pendingActions(db, pid);
  const top = actions.slice(0, 5);
  const rest = actions.slice(5);
  const upcoming = eventsFor(db, pid).filter((e) => (e.endDate ?? e.date) >= todayISO()).slice(0, 3);
  const live = db.trips.find((t) => tripStage(db, t) === 'live');
  const myScore = scores.persons.find((p) => p.personId === pid);
  const first = me.person.name.split(' ')[0];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">مرحباً {first}</h1>
        <p className="mt-1 text-sm text-ink-500">{top.length ? `لديك ${actions.length} ${actions.length === 1 ? 'أمر' : 'أمور'} تحتاجك. ابدأ بالأول.` : 'لا شيء ينتظرك الآن.'}</p>
      </div>

      {live && (
        <Link to={`/app/trips/${live.id}`} className="flex min-h-[56px] items-center gap-3 rounded-2xl border border-accent-200 bg-accent-50 px-4 text-sm">
          <span className="relative flex h-3 w-3"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-400 opacity-75" /><span className="relative inline-flex h-3 w-3 rounded-full bg-accent-500" /></span>
          <span className="flex-1"><b>تجري الآن:</b> {live.title}</span>
          <Icons.ChevronLeft className="h-4 w-4" />
        </Link>
      )}

      {me.isParticipant && !groupsPublished(db) && (
        <Card>
          <p className="text-sm">لم تُشكَّل المجموعات بعد. شارك في فعاليات فريق العمل، وراسل الإدارة إن احتجت شيئاً.</p>
          <LinkButton to="/app/contact" variant="primary" className="mt-3">راسل الإدارة</LinkButton>
        </Card>
      )}

      <section>
        <h2 className="mb-3 text-base font-bold">ما المطلوب منك الآن</h2>
        {top.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-ink-200 bg-white p-6 text-center">
            <Icons.PartyPopper className="mx-auto h-8 w-8 text-brand-400" />
            <p className="mt-2 font-medium">أنجزت كل شيء</p>
            <p className="mt-1 text-sm text-ink-500">{me.isParticipant ? 'وقت مناسب لتصفح المكتبة أو مراجعة خطتك.' : 'راجع التقويم لما هو قادم.'}</p>
            <LinkButton to={me.isParticipant ? '/app/library' : '/app/calendar'} variant="secondary" className="mt-3">{me.isParticipant ? 'افتح المكتبة' : 'افتح التقويم'}</LinkButton>
          </div>
        ) : (
          <ul className="space-y-3">
            {top.map((a, i) => (
              <li key={a.id} className="flex overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-card">
                <span className={cx('w-1.5 shrink-0', toneBar[a.tone])} />
                <div className="flex flex-1 flex-wrap items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] text-ink-400">{toneText[a.tone]} · {a.group}</div>
                    <div className="font-medium leading-6">{a.title}</div>
                    {a.hint && <div className="mt-0.5 text-xs text-ink-500">{a.hint}</div>}
                  </div>
                  <LinkButton to={a.link} variant={i === 0 ? 'primary' : 'secondary'}>{a.cta}</LinkButton>
                </div>
              </li>
            ))}
          </ul>
        )}
        {rest.length > 0 && (
          <details className="mt-3 rounded-2xl border border-ink-100 bg-white">
            <summary className="flex min-h-[48px] cursor-pointer items-center px-4 text-sm text-ink-600">أمور أخرى ({rest.length})</summary>
            <ul className="divide-y divide-ink-100 border-t border-ink-100">
              {rest.map((a) => (
                <li key={a.id}>
                  <Link to={a.link} className="flex min-h-[48px] items-center gap-3 px-4 text-sm hover:bg-ink-50">
                    <span className={cx('h-2 w-2 shrink-0 rounded-full', toneBar[a.tone])} />
                    <span className="flex-1">{a.title}</span>
                    <span className="text-xs text-brand-700">{a.cta}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {upcoming.length > 0 && (
        <section>
          <div className="mb-2 flex items-center justify-between"><h2 className="text-base font-bold">القادم</h2><Link to="/app/calendar" className="text-sm text-brand-600">التقويم</Link></div>
          <Card pad={false}>
            <ul className="divide-y divide-ink-100">
              {upcoming.map((e) => (
                <li key={e.id}>
                  <Link to={e.link} className="flex min-h-[56px] items-center gap-3 px-4 hover:bg-ink-50">
                    <span className="h-8 w-1 rounded-full" style={{ background: calKindColor[e.kind] }} />
                    <span className="min-w-0 flex-1 truncate text-sm">{e.title}</span>
                    <span className="num shrink-0 text-xs text-ink-500">{fmtShort(e.date)} · {relativeDays(e.date)}{e.start ? ` · ${fmtTime(e.start)}` : ''}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}

      {me.isParticipant && myScore && (
        <Link to="/app/leaderboard" className="flex min-h-[56px] items-center justify-between rounded-2xl bg-brand-50 px-4 text-sm text-brand-800">
          <span>ترتيبك <b className="num">#{myScore.rank}</b> · <span className="num">{myScore.total}</span> نقطة{isPlanUnlocked(db, pid) ? '' : ' · خطتك الشخصية مقفلة حتى لقائها'}</span>
          <Icons.ChevronLeft className="h-4 w-4" />
        </Link>
      )}
      {me.isStaff && <Link to="/app/insights" className="block text-center text-sm text-brand-600">المؤشرات التفصيلية</Link>}
    </div>
  );
}
