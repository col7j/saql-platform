import { Component, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { navFor } from '@/domain/access';
import { getCapabilities } from '@/domain/permissions';
import { todayISO } from '@/domain/dates';
import { repos, useDB, useMe, useStore } from '@/state/store';
import { AccessDenied, Avatar, ConfirmHost, Icons, NavIcon, Toasts, cx } from '@/ui';

/** شريحة الحساب أعلى القائمة: تفتح قائمة منبثقة فيها الجرس والملف الشخصي والأمان والخروج */
export function AccountMenu() {
  const db = useDB();
  const me = useMe();
  const setUser = useStore((s) => s.setUser);
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [bell, setBell] = useState(false);
  const mine = db.notifications.filter((n) => n.toId === me.person.id);
  const unread = mine.filter((n) => !n.read).length;
  const go = (to: string) => { setOpen(false); setBell(false); nav(to); };
  const item = 'flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 text-sm text-ink-800 hover:bg-ink-50';
  return (
    <div className="relative mx-3 mb-4">
      <button onClick={() => { setOpen(!open); setBell(false); }} aria-expanded={open} aria-haspopup="menu" className="flex min-h-[52px] w-full items-center gap-2.5 rounded-2xl border border-ink-100 bg-ink-50 p-2.5 text-start">
        <span className="relative">
          <Avatar name={me.person.name} size={36} color={me.isStaff ? undefined : me.group?.color} />
          {unread > 0 && <span className="absolute -end-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-accent-500" aria-label="إشعارات غير مقروءة" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-ink-900">{me.person.name}</span>
          <span className="block truncate text-xs text-ink-500">{me.labels.slice(0, 2).join(' · ')}</span>
        </span>
        <Icons.ChevronDown className="h-4 w-4 text-ink-400" />
      </button>
      {open && (
        <div role="menu" className="absolute inset-x-0 top-full z-50 mt-2 rounded-2xl border border-ink-100 bg-white p-2 shadow-lift">
          <div className="flex items-center gap-2.5 p-2">
            <Avatar name={me.person.name} size={40} color={me.isStaff ? undefined : me.group?.color} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold">{me.person.name}</div>
              <div className="truncate text-xs text-ink-500" dir="ltr">{me.person.email}</div>
            </div>
            <button onClick={() => setBell(!bell)} aria-label={`الإشعارات${unread ? ` (${unread} جديدة)` : ''}`} aria-expanded={bell} className="relative flex h-11 w-11 items-center justify-center rounded-full text-ink-700 hover:bg-ink-50">
              <Icons.Bell className="h-5 w-5" />
              {unread > 0 && <span className="num absolute end-0.5 top-0.5 rounded-full bg-accent-500 px-1.5 text-xs font-bold leading-5 text-ink-900">{unread}</span>}
            </button>
          </div>
          {bell ? (
            <div className="border-t border-ink-100 pt-2">
              {mine.slice(0, 5).map((n) => (
                <button key={n.id} onClick={() => { try { repos.notifications.markRead(n.id); } catch { /* المشرف: قراءة فقط */ } go(n.link ?? '/app/notifications'); }} className={cx('block w-full rounded-xl px-3 py-2 text-start text-xs hover:bg-ink-50', !n.read && 'font-bold')}>{n.title}</button>
              ))}
              {!mine.length && <p className="px-3 py-2 text-xs text-ink-500">لا إشعارات بعد</p>}
              <button onClick={() => go('/app/notifications')} className={item + ' text-brand-700'}>كل الإشعارات</button>
            </div>
          ) : (
            <div className="border-t border-ink-100 pt-2">
              <button role="menuitem" onClick={() => go('/app/profile')} className={item}><Icons.User className="h-4 w-4" /> الملف الشخصي</button>
              <button role="menuitem" onClick={() => go('/app/profile?tab=security')} className={item}><Icons.Lock className="h-4 w-4" /> الأمان</button>
              <div className="my-1 border-t border-ink-100" />
              <button role="menuitem" onClick={() => { setUser(null); nav('/'); }} className={item}><Icons.LogOut className="h-4 w-4" /> تسجيل الخروج</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

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
    <div className="no-print sticky top-0 z-40 bg-ink-900 text-white">
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
        <button onClick={() => { if (confirm('بدء منصة فارغة بمعالج أول تشغيل؟ ستُفقد البيانات التجريبية الحالية.')) { useStore.getState().resetFirstRun(); nav('/setup'); } }} className="inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-white/10">أول تشغيل</button>
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
  // حد أقصى 6 عناصر ظاهرة لكل دور، والباقي تحت «المزيد»
  const [more, setMore] = useState(false);
  const MAX_VISIBLE = 6;
  let budget = MAX_VISIBLE;
  const visible = sections.map((sec) => { const items = sec.items.slice(0, Math.max(budget, 0)); budget -= items.length; return { ...sec, items }; }).filter((sec) => sec.items.length);
  const hidden = sections.flatMap((sec) => sec.items).slice(MAX_VISIBLE);
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
  const linkCls = (active: boolean) => cx('group flex min-h-[44px] items-center gap-3 rounded-full px-4 text-sm transition', active ? 'bg-brand-600 font-medium text-white shadow-sm' : 'text-ink-700 hover:bg-brand-50 hover:text-brand-700');

  // القائمة الجانبية: كل الأقسام ظاهرة ومقسّمة إلى مجموعات
  const sidebar = (
    <nav className="flex h-full flex-col">
      <Link to="/app" className="flex items-center gap-2 px-5 pb-3 pt-5">
        <img src="./brand/logo-horizontal.svg" alt="صقل" className="h-10" />
      </Link>
      <AccountMenu />
      <div className="flex-1 space-y-4 overflow-y-auto px-3 pb-6">
        {visible.map((sec) => (
          <div key={sec.title}>
            <div className="px-4 pb-1.5 text-xs font-medium text-ink-500">{sec.title}</div>
            <div className="space-y-0.5">
              {sec.items.map((i) => (
                <Link key={i.to} to={i.to} className={linkCls(isActive(i.to))}>
                  <NavIcon name={i.icon} className="h-5 w-5" />
                  <span className="flex-1">{i.label}</span>
                </Link>
              ))}
            </div>
          </div>
        ))}
        {hidden.length > 0 && (
          <div>
            <button onClick={() => setMore(!more)} aria-expanded={more} className={linkCls(false) + ' w-full'}>
              <Icons.MoreHorizontal className="h-5 w-5" />
              <span className="flex-1 text-start">المزيد</span>
            </button>
            {more && (
              <div className="mt-0.5 space-y-0.5">
                {hidden.map((i) => (
                  <Link key={i.to} to={i.to} className={linkCls(isActive(i.to))}>
                    <NavIcon name={i.icon} className="h-5 w-5" />
                    <span className="flex-1">{i.label}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
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
        <aside className="no-print sticky top-[36px] hidden h-[calc(100vh-36px)] w-64 shrink-0 border-e border-ink-100 bg-white lg:block">{sidebar}</aside>
        {drawer && (
          <div className="fixed inset-0 z-50 bg-ink-900/40 lg:hidden" onClick={() => setDrawer(false)}>
            <aside className="h-full w-72 max-w-[85%] overflow-y-auto bg-white shadow-lift" onClick={(e) => e.stopPropagation()}>{sidebar}</aside>
          </div>
        )}
        <div className="min-w-0 flex-1 bg-ink-50">
          <header className="no-print sticky top-[36px] z-30 flex items-center justify-between gap-2 border-b border-ink-100 bg-white/90 px-4 py-2 backdrop-blur">
            <img src="./brand/logo-horizontal.svg" alt="صقل" className="h-8 lg:invisible" />
            {me.isSupervisor && <span className="rounded-full bg-accent-100 px-3 py-1 text-xs font-bold text-ink-900" role="status">وضع القراءة فقط</span>}
          </header>
          <main className="mx-auto max-w-container px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <ErrorBoundary key={loc.pathname + loc.search}>
              {allowed ? (me.isSupervisor ? <fieldset disabled className="min-w-0 border-0 p-0"><Outlet /></fieldset> : <Outlet />) : <AccessDenied />}
            </ErrorBoundary>
          </main>
        </div>
      </div>
      <nav className="no-print fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-ink-100 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {bottom.map((i) => (
          <Link key={i.to} to={i.to} className={cx('flex min-h-[60px] flex-col items-center justify-center gap-0.5 text-xs', isActive(i.to) ? 'font-bold text-brand-700' : 'text-ink-500')}>
            <NavIcon name={i.icon} className="h-5 w-5" />
            <span className="max-w-full truncate px-1">{i.label}</span>
          </Link>
        ))}
        <button onClick={() => setDrawer(true)} className="flex min-h-[60px] flex-col items-center justify-center gap-0.5 text-xs text-ink-500">
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
          <h2 className="mb-3 text-xs font-medium text-ink-500">{sec.title}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {sec.items.map((i) => (
              <Link key={i.to} to={i.to} className="flex min-h-[72px] items-center gap-3 rounded-2xl border border-ink-100 bg-white p-4 shadow-card hover:border-brand-200 hover:shadow-lift">
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
