import { Component, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { getCapabilities, navFor } from '@/domain/permissions';
import { todayISO } from '@/domain/dates';
import { useDB, useMe, useStore } from '@/state/store';
import { Avatar, ConfirmHost, Icons, NavIcon, Toasts, cx } from '@/ui';

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

  const { primary, more } = navFor(db, me.person.id);
  const unread = db.notifications.filter((n) => n.toId === me.person.id && !n.read).length;
  const moreActive = more.some((i) => loc.pathname.startsWith(i.to)) || loc.pathname === '/app/more';
  const linkCls = (active: boolean) => cx('flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-[15px] transition', active ? 'bg-brand-600 font-medium text-white shadow-sm' : 'text-ink-700 hover:bg-ink-100');

  // القائمة الجانبية: 5 عناصر حسب الدور + "المزيد" (6 كحد أقصى)
  const sidebar = (
    <nav className="flex h-full flex-col">
      <Link to="/app" className="flex items-center gap-2 px-5 pb-4 pt-5">
        <img src="./brand/logo-horizontal.svg" alt="صقل" className="h-10" />
      </Link>
      <div className="flex-1 space-y-1 overflow-y-auto px-3 pb-6">
        {primary.map((i) => (
          <NavLink key={i.to} to={i.to} end={i.to === '/app'} className={({ isActive }) => linkCls(isActive)}>
            <NavIcon name={i.icon} className="h-5 w-5" />
            <span className="flex-1">{i.label}</span>
          </NavLink>
        ))}
        {more.length > 0 && (
          <NavLink to="/app/more" className={() => linkCls(moreActive)}>
            <NavIcon name="more" className="h-5 w-5" />
            <span className="flex-1">المزيد</span>
          </NavLink>
        )}
      </div>
      <div className="border-t border-ink-100 p-3">
        <div className="flex items-center gap-2.5 px-2 pb-2">
          <Avatar name={me.person.name} size={32} color={me.isStaff ? 'linear-gradient(135deg,#f79845,#fbb42b)' : me.group?.color} />
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-ink-900">{me.person.name}</div>
            <div className="truncate text-[11px] text-ink-500">{me.labels.slice(0, 2).join(' · ')}</div>
          </div>
        </div>
        <button onClick={() => { setUser(null); nav('/'); }} className="flex min-h-[44px] w-full items-center gap-2 rounded-xl px-3 text-sm text-ink-500 hover:bg-ink-100">
          <Icons.LogOut className="h-4 w-4" /> سجّل الخروج
        </button>
      </div>
    </nav>
  );
  const bottom = [...primary.slice(0, 4)];

  return (
    <div className="min-h-screen pb-20 lg:pb-0">
      <RoleSwitcher />
      <div className="mx-auto flex max-w-[1500px]">
        <aside className="sticky top-[36px] hidden h-[calc(100vh-36px)] w-60 shrink-0 border-e border-ink-100 bg-white lg:block">{sidebar}</aside>
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
              <Outlet />
            </ErrorBoundary>
          </main>
        </div>
      </div>
      {/* شريط سفلي للجوال: يُستخدم بإبهام واحد */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-ink-100 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {bottom.map((i) => (
          <NavLink key={i.to} to={i.to} end={i.to === '/app'} className={({ isActive }) => cx('flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px]', isActive ? 'font-bold text-brand-700' : 'text-ink-500')}>
            <NavIcon name={i.icon} className="h-5 w-5" />
            <span className="max-w-full truncate px-1">{i.label}</span>
          </NavLink>
        ))}
        <NavLink to="/app/more" className={() => cx('flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px]', moreActive ? 'font-bold text-brand-700' : 'text-ink-500')}>
          <NavIcon name="more" className="h-5 w-5" />
          المزيد
        </NavLink>
      </nav>
      <Toasts />
      <ConfirmHost />
    </div>
  );
}

/** صفحة "المزيد": بقية الأقسام حسب الدور */
export function MorePage() {
  const db = useDB();
  const me = useMe();
  const { primary, more } = navFor(db, me.person.id);
  const mobileExtra = primary.slice(4); // العنصر الخامس لا يتسع في الشريط السفلي
  const items = [...mobileExtra.map((i) => ({ ...i, mobileOnly: true })), ...more.map((i) => ({ ...i, mobileOnly: false }))];
  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">المزيد</h1>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map((i) => (
          <Link key={i.to} to={i.to} className={cx('flex min-h-[72px] items-center gap-3 rounded-2xl border border-ink-100 bg-white p-4 shadow-card hover:border-brand-200', i.mobileOnly && 'lg:hidden')}>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><NavIcon name={i.icon} className="h-5 w-5" /></span>
            <span className="font-medium">{i.label}</span>
          </Link>
        ))}
      </div>
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
