import { Component, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { navFor } from '@/domain/access';
import { getCapabilities } from '@/domain/permissions';
import { todayISO } from '@/domain/dates';
import { repos, useDB, useMe, useStore } from '@/state/store';
import { AccessDenied, Avatar, ConfirmHost, Icons, NavIcon, Toasts, cx } from '@/ui';

/** شريط "الدخول كـ" للنموذج الأولي فقط */
export function RoleSwitcher() {
  const db = useDB();
  const userId = useStore((s) => s.userId);
  const setUser = useStore((s) => s.setUser);
  const reset = useStore((s) => s.reset);
  const nav = useNavigate();
  const groups = useMemo(() => {
    const staff = db.persons.filter((p) => p.kind === 'staff');
    const leaders = db.groups.map((g) => g.leaderId).filter(Boolean) as string[];
    const parts = db.persons.filter((p) => p.kind === 'participant');
    return [
      { label: 'الإدارة', items: staff },
      { label: 'قادة المجموعات', items: parts.filter((p) => leaders.includes(p.id)) },
      { label: 'المشاركون', items: parts.filter((p) => !leaders.includes(p.id)) },
    ];
  }, [db]);
  const stale = db.seededAt.slice(0, 10) !== todayISO();
  return (
    <div className="sticky top-0 z-40 bg-ink-900 text-white">
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-2 px-3 py-1.5 text-xs sm:px-4">
        <span className="inline-flex items-center gap-1 rounded-md bg-accent-500/90 px-2 py-0.5 font-bold text-ink-900">
          <Icons.FlaskConical className="h-3.5 w-3.5" /> نموذج أولي
        </span>
        <label className="flex min-w-0 flex-1 items-center gap-2">
          <span className="hidden text-white/70 sm:inline">الدخول كـ</span>
          <select
            value={userId ?? ''}
            onChange={(e) => { setUser(e.target.value || null); nav(e.target.value ? '/app' : '/'); }}
            className="min-w-0 max-w-full flex-1 rounded-md border border-white/15 bg-white/10 px-2 py-1 text-xs text-white outline-none sm:max-w-sm"
          >
            <option value="" className="text-ink-900">— زائر (غير مسجّل) —</option>
            {groups.map((g) => (
              <optgroup key={g.label} label={g.label} className="text-ink-900">
                {g.items.map((p) => (
                  <option key={p.id} value={p.id} className="text-ink-900">
                    {p.name} · {getCapabilities(db, p.id).labels.join('، ')}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        {stale && <span className="hidden text-accent-300 md:inline">البيانات وُلّدت في يوم سابق</span>}
        <button
          onClick={() => { if (confirm('إعادة توليد البيانات التجريبية؟ ستُفقد كل التعديلات.')) { reset(); } }}
          className={cx('inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-white/10', stale && 'bg-accent-500 text-ink-900 hover:bg-accent-400')}
        >
          <Icons.RotateCcw className="h-3.5 w-3.5" /> <span className="hidden sm:inline">إعادة البيانات</span>
        </button>
      </div>
    </div>
  );
}

export function AppShell() {
  const db = useDB();
  const me = useMe();
  const userId = useStore((s) => s.userId);
  const setUser = useStore((s) => s.setUser);
  const nav = useNavigate();
  const loc = useLocation();
  useEffect(() => {
    if (!userId) nav('/login');
  }, [userId, nav]);

  const { sections, all } = navFor(db, me.person.id);
  const unread = db.notifications.filter((n) => n.toId === me.person.id && !n.read).length;
  const [drawer, setDrawer] = useState(false);
  useEffect(() => setDrawer(false), [loc.pathname]);
  // العنصر نشط بالمسار، وإن حمل تبويباً (?tab=) فبالتبويب أيضاً
  const isActive = (to: string) => {
    const [path, query] = to.split('?');
    if (path === '/app') return loc.pathname === '/app';
    if (!(loc.pathname === path || loc.pathname.startsWith(path + '/'))) return false;
    if (!query) return !all.some((x) => x.to !== to && x.to.startsWith(path + '?') && loc.search.includes(x.to.split('?')[1]));
    return loc.search.includes(query);
  };
  const allowed = repos.access.canOpen(loc.pathname, loc.search);
  // أول دخول للمشارك: يُكمل ملفه قبل أي شاشة
  const onboarding = me.isParticipant && !me.person.profileCompletedAt && loc.pathname !== '/app/profile';
  useEffect(() => {
    if (onboarding) nav('/app/profile', { replace: true });
  }, [onboarding, nav]);
  const linkCls = (active: boolean) => cx('group flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-[15px] transition', active ? 'bg-brand-grad font-medium text-white shadow-md shadow-brand-600/20' : 'text-ink-700 hover:bg-brand-50 hover:text-brand-800');

  // القائمة الجانبية: كل الأقسام ظاهرة ومقسّمة إلى مجموعات
  const sidebar = (
    <nav className="flex h-full flex-col">
      <Link to="/app" className="flex items-center gap-2 px-5 pb-3 pt-5">
        <img src="./brand/logo-horizontal.svg" alt="صقل" className="h-10" />
      </Link>
      <div className="relative mx-3 mb-4 overflow-hidden rounded-2xl bg-brand-deep p-3 text-white">
        <div className="absolute -bottom-8 -start-6 h-20 w-20 rounded-full bg-accent-400/40 blur-xl" />
        <div className="relative flex items-center gap-2.5">
          <Avatar name={me.person.name} size={38} color={me.isStaff ? 'linear-gradient(135deg,#f79845,#fbb42b)' : me.group?.color ?? '#f79845'} />
          <div className="min-w-0">
            <div className="truncate text-sm font-bold">{me.person.name}</div>
            <div className="truncate text-[11px] text-white/80">{me.labels.slice(0, 2).join(' · ')}</div>
          </div>
        </div>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto px-3 pb-6">
        {sections.map((sec) => (
          <div key={sec.title}>
            <div className="px-3 pb-1 text-[11px] font-bold tracking-wide text-ink-400">{sec.title}</div>
            <div className="space-y-0.5">
              {sec.items.map((i) => (
                <Link key={i.to} to={i.to} className={linkCls(isActive(i.to))}>
                  <NavIcon name={i.icon} className="h-5 w-5" />
                  <span className="flex-1">{i.label}</span>
                  {i.to === '/app/notifications' && unread > 0 && <span className="num rounded-full bg-accent-500 px-1.5 text-[10px] font-bold text-white">{unread}</span>}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-ink-100 p-3">
        <button onClick={() => { setUser(null); nav('/'); }} className="flex min-h-[44px] w-full items-center gap-2 rounded-xl px-3 text-sm text-ink-500 hover:bg-ink-100">
          <Icons.LogOut className="h-4 w-4" /> سجّل الخروج
        </button>
      </div>
    </nav>
  );
  // الشريط السفلي للجوال: الرئيسية، التقويم، وأهم عنصرين للدور، وزر القائمة الكاملة
  const roleItems = all.filter((i) => !['/app', '/app/calendar', '/app/notifications', '/app/profile'].includes(i.to)).slice(0, 2);
  const bottom = [all.find((i) => i.to === '/app'), all.find((i) => i.to === '/app/calendar'), ...roleItems].filter((x): x is NonNullable<typeof x> => !!x);

  return (
    <div className="min-h-screen pb-20 lg:pb-0">
      <RoleSwitcher />
      <div className="mx-auto flex max-w-[1500px]">
        <aside className="sticky top-[36px] hidden h-[calc(100vh-36px)] w-64 shrink-0 border-e border-ink-100 bg-white lg:block">{sidebar}</aside>
        {drawer && (
          <div className="fixed inset-0 z-50 bg-ink-900/40 lg:hidden" onClick={() => setDrawer(false)}>
            <aside className="h-full w-72 max-w-[85%] overflow-y-auto bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>{sidebar}</aside>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <header className="sticky top-[36px] z-30 flex items-center justify-between gap-2 border-b border-ink-100 bg-white/90 px-4 py-2 backdrop-blur">
            <img src="./brand/logo-horizontal.svg" alt="صقل" className="h-8 lg:invisible" />
            <Link to="/app/notifications" className="relative flex h-11 w-11 items-center justify-center rounded-xl hover:bg-ink-100" aria-label={`الإشعارات${unread ? ` (${unread} جديدة)` : ''}`}>
              <Icons.Bell className="h-5 w-5" />
              {unread > 0 && <span className="num absolute end-1 top-1 rounded-full bg-accent-500 px-1 text-[10px] font-bold text-white">{unread}</span>}
            </Link>
          </header>
          <main className="px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
            <ErrorBoundary key={loc.pathname + loc.search}>
              {allowed ? <Outlet /> : <AccessDenied />}
            </ErrorBoundary>
          </main>
        </div>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-ink-100 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {bottom.map((i) => (
          <Link key={i.to} to={i.to} className={cx('flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px]', isActive(i.to) ? 'font-bold text-brand-700' : 'text-ink-500')}>
            <NavIcon name={i.icon} className="h-5 w-5" />
            <span className="max-w-full truncate px-1">{i.label}</span>
          </Link>
        ))}
        <button onClick={() => setDrawer(true)} className="flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px] text-ink-500">
          <Icons.Menu className="h-5 w-5" />
          القائمة
        </button>
      </nav>
      <Toasts />
      <ConfirmHost />
    </div>
  );
}

/** صفحة القائمة الكاملة (للروابط القديمة) */
export function MorePage() {
  const db = useDB();
  const me = useMe();
  const { sections } = navFor(db, me.person.id);
  return (
    <div className="space-y-5">
      {sections.map((sec) => (
        <div key={sec.title}>
          <h2 className="mb-2 text-sm font-bold text-ink-500">{sec.title}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {sec.items.map((i) => (
              <Link key={i.to} to={i.to} className="flex min-h-[72px] items-center gap-3 rounded-2xl border border-ink-100 bg-white p-4 shadow-card hover:border-brand-200">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><NavIcon name={i.icon} className="h-5 w-5" /></span>
                <span className="font-medium">{i.label}</span>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** يمنع تعطل شاشة واحدة من إسقاط المنصة كلها */
class ErrorBoundary extends Component<{ children: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {};
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        <b>حدث خطأ في هذه الشاشة.</b>
        <pre className="mt-2 whitespace-pre-wrap text-xs" dir="ltr">{this.state.error.message}</pre>
      </div>
    );
  }
}
