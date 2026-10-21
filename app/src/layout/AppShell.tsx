import { Component, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { getCapabilities, navFor } from '@/domain/permissions';
import { todayISO } from '@/domain/dates';
import { useDB, useMe, useStore } from '@/state/store';
import { Avatar, Icons, NavIcon, Toasts, cx } from '@/ui';

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
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [loc.pathname]);
  useEffect(() => {
    if (!userId) nav('/login');
  }, [userId, nav]);

  const items = navFor(db, me.person.id);
  const sections = [...new Set(items.map((i) => i.section))];
  const unread = db.notifications.filter((n) => n.toId === me.person.id && !n.read).length;

  const sidebar = (
    <nav className="flex h-full flex-col">
      <Link to="/app" className="flex items-center gap-2 px-5 pb-4 pt-5">
        <img src="./brand/logo-horizontal.svg" alt="صقل" className="h-10" />
      </Link>
      <div className="mx-3 mb-3 rounded-2xl bg-brand-50 p-3">
        <div className="flex items-center gap-2.5">
          <Avatar name={me.person.name} size={36} color={me.isStaff ? 'linear-gradient(135deg,#f79845,#fbb42b)' : me.group?.color} />
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-ink-900">{me.person.name}</div>
            <div className="truncate text-[11px] text-brand-700">{me.labels.slice(0, 2).join(' · ')}</div>
          </div>
        </div>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto px-3 pb-6">
        {sections.map((s) => (
          <div key={s}>
            <div className="px-2 pb-1 text-[11px] font-medium text-ink-400">{s}</div>
            {items.filter((i) => i.section === s).map((i) => (
              <NavLink
                key={i.to}
                to={i.to}
                end={i.to === '/app'}
                className={({ isActive }) => cx('flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition', isActive ? 'bg-brand-600 font-medium text-white shadow-sm' : 'text-ink-600 hover:bg-ink-100')}
              >
                <NavIcon name={i.icon} className="h-[18px] w-[18px]" />
                <span className="flex-1">{i.label}</span>
                {i.to === '/app/notifications' && unread > 0 && <span className="num rounded-full bg-accent-500 px-1.5 text-[10px] font-bold text-white">{unread}</span>}
              </NavLink>
            ))}
          </div>
        ))}
      </div>
      <div className="border-t border-ink-100 p-3">
        <button onClick={() => { setUser(null); nav('/'); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-ink-500 hover:bg-ink-100">
          <Icons.LogOut className="h-4 w-4" /> تسجيل الخروج
        </button>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen">
      <RoleSwitcher />
      <div className="mx-auto flex max-w-[1500px]">
        <aside className="sticky top-[36px] hidden h-[calc(100vh-36px)] w-64 shrink-0 border-e border-ink-100 bg-white lg:block">{sidebar}</aside>
        {open && (
          <div className="fixed inset-0 z-40 bg-ink-900/40 lg:hidden" onClick={() => setOpen(false)}>
            <aside className="h-full w-72 max-w-[85%] bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>{sidebar}</aside>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <header className="sticky top-[36px] z-30 flex items-center justify-between gap-2 border-b border-ink-100 bg-white/90 px-4 py-2.5 backdrop-blur lg:hidden">
            <button onClick={() => setOpen(true)} className="rounded-lg p-1.5 hover:bg-ink-100"><Icons.Menu className="h-5 w-5" /></button>
            <img src="./brand/logo-horizontal.svg" alt="صقل" className="h-8" />
            <Link to="/app/notifications" className="relative rounded-lg p-1.5 hover:bg-ink-100">
              <Icons.Bell className="h-5 w-5" />
              {unread > 0 && <span className="absolute -top-0.5 end-0 h-2.5 w-2.5 rounded-full bg-accent-500" />}
            </Link>
          </header>
          <main className="px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
            <ErrorBoundary key={loc.pathname + loc.search}>
              <Outlet />
            </ErrorBoundary>
          </main>
        </div>
      </div>
      <Toasts />
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
