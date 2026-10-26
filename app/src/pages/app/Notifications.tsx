import { useState } from 'react';
import { Link } from 'react-router-dom';
import { timeAgo } from '@/domain/dates';
import { notificationTypeLabel } from '@/domain/labels';
import { repos, useDB, useMe } from '@/state/store';
import { Badge, Button, Card, Empty, Icons, PageHeader, Tabs, cx } from '@/ui';

export default function NotificationsPage() {
  const db = useDB();
  const me = useMe();
  const [tab, setTab] = useState<'all' | 'unread'>('all');
  const mine = db.notifications.filter((n) => n.toId === me.person.id);
  const list = mine.filter((n) => (tab === 'unread' ? !n.read : true));
  return (
    <div>
      <PageHeader
        title="الإشعارات"
        subtitle="كل الإشعارات داخل المنصة فقط"
        actions={<Button variant="secondary" size="sm" onClick={() => repos.notifications.markAllRead()} icon={<Icons.CheckCheck className="h-4 w-4" />}>علّم الكل كمقروء</Button>}
      />
      <Tabs value={tab} onChange={setTab} tabs={[{ key: 'all', label: `الكل (${mine.length})` }, { key: 'unread', label: `غير المقروء (${mine.filter((n) => !n.read).length})` }]} />
      <Card pad={false}>
        {list.length === 0 ? <div className="p-5"><Empty title="لا إشعارات" /></div> : (
          <ul className="divide-y divide-ink-100">
            {list.map((n) => (
              <li key={n.id}>
                <Link to={n.link ?? '#'} onClick={() => repos.notifications.markRead(n.id)} className={cx('flex items-start gap-3 px-4 py-3 hover:bg-ink-50 sm:px-5', !n.read && 'bg-brand-50/40')}>
                  <span className={cx('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.read ? 'bg-ink-200' : 'bg-accent-500')} />
                  <div className="min-w-0 flex-1">
                    <div className={cx('text-sm', !n.read && 'font-bold')}>{n.title}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-ink-400">
                      <span>{timeAgo(n.at)}</span>
                      <Badge>{notificationTypeLabel[n.type]}</Badge>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
