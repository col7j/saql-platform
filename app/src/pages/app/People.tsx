import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getCapabilities, groupOf } from '@/domain/permissions';
import { act, repos, useDB, useMe } from '@/state/store';
import { Badge, Card, Input, PageHeader, Table, Tabs, Toggle } from '@/ui';
import { GroupBadge, PersonChip } from '@/ui/domain';

export default function PeoplePage() {
  const db = useDB();
  const me = useMe();
  const [tab, setTab] = useState<'participant' | 'staff'>('participant');
  const [q, setQ] = useState('');
  const list = db.persons.filter((p) => p.kind === tab && (!q || p.name.includes(q)));
  return (
    <div>
      <PageHeader title="الأشخاص" subtitle="لكل شخص نوع أساسي وصفات إضافية تتجمع عليه، وتُحسب صلاحياته من مجموعها" />
      <div className="flex flex-wrap items-start justify-between gap-2">
        <Tabs value={tab} onChange={setTab} tabs={[{ key: 'participant', label: 'المشاركون' }, { key: 'staff', label: 'فريق العمل' }]} />
        <Input className="mb-4 w-56" placeholder="بحث بالاسم" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <Card pad={false}>
        <Table>
          <thead><tr><th>الاسم</th>{tab === 'participant' && <th>المجموعة</th>}<th>الصفات</th>{me.isLeader && <th>محرّر الموقع</th>}</tr></thead>
          <tbody>
            {list.map((p) => {
              const c = getCapabilities(db, p.id);
              return (
                <tr key={p.id}>
                  <td><Link to={`/app/people/${p.id}`}><PersonChip id={p.id} sub={p.university ?? p.title} /></Link></td>
                  {tab === 'participant' && <td><GroupBadge id={groupOf(db, p.id)?.id} /></td>}
                  <td><div className="flex flex-wrap gap-1">{c.labels.map((l) => <Badge key={l}>{l}</Badge>)}</div></td>
                  {me.isLeader && <td>{!p.isGeneralLeader && <Toggle checked={c.isSiteEditor} onChange={(v) => act(() => repos.people.setSiteEditor(p.id, v), v ? 'مُنحت صلاحية تحرير الموقع' : 'سُحبت الصلاحية')} />}</td>}
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
