// المركز الإعلامي: ستة عناصر فقط. تظهر منها ما يملك الشخص صلاحيته، والباقي يُرفض بالعنوان أيضاً
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { hasMediaPerm } from '@/domain/media';
import { useDB, useMe } from '@/state/store';
import { PageHeader, Tabs } from '@/ui';

export default function MediaShell() {
  const db = useDB();
  const me = useMe();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const can = (p: Parameters<typeof hasMediaPerm>[2]) => hasMediaPerm(db, me.person.id, p);
  const items = [
    { key: '/app/media', label: 'الرئيسية', ok: true },
    { key: '/app/media/briefs', label: 'الموجزات', ok: true },
    { key: '/app/media/follow', label: 'المتابعة', ok: true },
    { key: '/app/media/templates', label: 'القوالب', ok: can('edit') },
    { key: '/app/media/links', label: 'الروابط', ok: can('approve') },
    { key: '/app/media/metrics', label: 'المؤشرات', ok: can('metrics') },
  ].filter((i) => i.ok);
  const current = [...items].reverse().find((i) => (i.key === '/app/media' ? pathname === '/app/media' : pathname.startsWith(i.key)))?.key ?? '/app/media';
  const inner = pathname.startsWith('/app/media/print');
  if (inner) return <Outlet />;
  return (
    <div>
      {current === '/app/media' && <PageHeader title="المركز الإعلامي" subtitle="جهّز موجز التغطية، وشاركه مع الفريق المتعاقد، وتابع التنفيذ" />}
      <Tabs value={current} onChange={(k) => nav(k)} tabs={items.map((i) => ({ key: i.key, label: i.label }))} />
      <Outlet />
    </div>
  );
}
