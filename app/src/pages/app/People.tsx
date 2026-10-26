import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getCapabilities, groupOf } from '@/domain/permissions';
import { act, repos, useDB, useMe } from '@/state/store';
import { addDays, fmtDate, todayISO } from '@/domain/dates';
import { isGrantActive, tempPermissionLabel } from '@/domain/grants';
import type { PersonKind, TempPermission } from '@/domain/types';
import { Badge, Button, Card, Field, Icons, Input, Modal, PageHeader, Select, Table, Tabs } from '@/ui';
import { GroupBadge, PersonChip } from '@/ui/domain';

export default function PeoplePage() {
  const db = useDB();
  const me = useMe();
  const [tab, setTab] = useState<'participant' | 'staff'>('participant');
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const list = db.persons.filter((p) => p.kind === tab && (!q || p.name.includes(q)));
  return (
    <div>
      <PageHeader title="الأشخاص" subtitle="لكل شخص نوع أساسي وصفات إضافية تجتمع عليه بلا تعارض، وتُحسب صلاحياته من مجموعها"
        actions={(me.isLeader || me.canRegisterParticipants) && <Button onClick={() => setAdding(true)} icon={<Icons.UserPlus className="h-4 w-4" />}>أضف شخصاً</Button>} />
      <div className="flex flex-wrap items-start justify-between gap-2">
        <Tabs value={tab} onChange={setTab} tabs={[{ key: 'participant', label: 'المشاركون' }, { key: 'staff', label: 'فريق العمل' }]} />
        <Input className="mb-4 w-56" placeholder="بحث بالاسم" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <Card pad={false}>
        <Table>
          <thead><tr><th>الاسم</th>{tab === 'participant' && <th>المجموعة</th>}<th>الصفات</th></tr></thead>
          <tbody>
            {list.map((p) => {
              const c = getCapabilities(db, p.id);
              return (
                <tr key={p.id}>
                  <td><Link to={`/app/people/${p.id}`}><PersonChip id={p.id} sub={p.university ?? p.title} /></Link></td>
                  {tab === 'participant' && <td><GroupBadge id={groupOf(db, p.id)?.id} /></td>}
                  <td><div className="flex flex-wrap gap-1">{c.labels.map((l) => <Badge key={l}>{l}</Badge>)}</div></td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>
      {me.isLeader && <Grants />}
      {adding && <AddPerson onClose={() => setAdding(false)} defaultKind={me.isLeader ? tab : 'participant'} staffAllowed={me.isLeader} />}
    </div>
  );
}

/** القائد العام ينشئ الشخص ويحدد نوعه. الصفات تُسند من المجموعات واللجان والإعدادات، والحساب يديره مسؤول اللجنة التقنية */
function AddPerson({ onClose, defaultKind, staffAllowed }: { onClose: () => void; defaultKind: PersonKind; staffAllowed: boolean }) {
  const [f, setF] = useState({ kind: defaultKind, name: '', email: '', phone: '', university: '', major: '', title: '' });
  const set = (p: Partial<typeof f>) => setF({ ...f, ...p });
  const save = () => act(() => {
    repos.people.create({
      kind: f.kind, name: f.name, email: f.email, phone: f.phone || undefined,
      ...(f.kind === 'participant' ? { university: f.university || undefined, major: f.major || undefined } : { title: f.title || undefined }),
    });
    onClose();
  }, 'أُضيف الشخص. يصدر مسؤول اللجنة التقنية كلمة مروره');
  return (
    <Modal open onClose={onClose} title="شخص جديد" footer={<Button disabled={!f.name || !f.email} onClick={save}>أضف</Button>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="النوع"><Select value={f.kind} onChange={(e) => set({ kind: e.target.value as PersonKind })} options={[{ value: 'participant', label: 'مشارك' }, ...(staffAllowed ? [{ value: 'staff', label: 'عضو فريق عمل' }] : [])]} /></Field>
        <Field label="الاسم"><Input value={f.name} onChange={(e) => set({ name: e.target.value })} /></Field>
        <Field label="البريد"><Input dir="ltr" type="email" value={f.email} onChange={(e) => set({ email: e.target.value })} /></Field>
        <Field label="الجوال"><Input dir="ltr" value={f.phone} onChange={(e) => set({ phone: e.target.value })} /></Field>
        {f.kind === 'participant' ? (
          <>
            <Field label="الجامعة"><Input value={f.university} onChange={(e) => set({ university: e.target.value })} /></Field>
            <Field label="التخصص"><Input value={f.major} onChange={(e) => set({ major: e.target.value })} /></Field>
          </>
        ) : <Field label="المنصب" className="sm:col-span-2"><Input value={f.title} onChange={(e) => set({ title: e.target.value })} /></Field>}
      </div>
    </Modal>
  );
}

/** الصلاحيات المؤقتة: يمنحها القائد العام لأشخاص يحددهم حتى تاريخ، ويسحبها متى شاء */
function Grants() {
  const db = useDB();
  const staff = db.persons.filter((p) => p.kind === 'staff' && !p.isGeneralLeader);
  const [f, setF] = useState({ personId: staff[0]?.id ?? '', permission: 'register_participants' as TempPermission, expiresAt: addDays(todayISO(), 30) });
  const list = [...db.tempGrants].sort((a, b) => b.at.localeCompare(a.at));
  return (
    <Card title="الصلاحيات المؤقتة" subtitle="تسجيل المشاركين، تحرير الموقع العام، تصنيفات الجدول. تنتهي تلقائياً في تاريخها" className="mt-6">
      <div className="grid gap-2 rounded-xl bg-ink-50 p-3 sm:grid-cols-[1fr_1fr_160px_auto]">
        <Select value={f.personId} onChange={(e) => setF({ ...f, personId: e.target.value })} options={staff.map((p) => ({ value: p.id, label: p.name }))} />
        <Select value={f.permission} onChange={(e) => setF({ ...f, permission: e.target.value as TempPermission })} options={(Object.keys(tempPermissionLabel) as TempPermission[]).map((k) => ({ value: k, label: tempPermissionLabel[k] }))} />
        <Input type="date" value={f.expiresAt} onChange={(e) => setF({ ...f, expiresAt: e.target.value })} title="آخر يوم صالح" />
        <Button disabled={!f.personId} onClick={() => act(() => repos.grants.grant(f.personId, f.permission, f.expiresAt), 'مُنحت الصلاحية')}>امنح</Button>
      </div>
      <ul className="mt-3 space-y-2">
        {list.map((g) => {
          const active = isGrantActive(g);
          return (
            <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink-100 px-3 py-2">
              <PersonChip id={g.personId} sub={`${tempPermissionLabel[g.permission]} · حتى ${fmtDate(g.expiresAt)}`} />
              <span className="flex items-center gap-2">
                <Badge tone={active ? 'green' : 'gray'}>{g.revokedAt ? 'مسحوبة' : active ? 'سارية' : 'منتهية'}</Badge>
                {active && <Button size="sm" variant="danger" onClick={() => act(() => repos.grants.revoke(g.id), 'سُحبت الصلاحية')}>اسحب</Button>}
              </span>
            </li>
          );
        })}
        {list.length === 0 && <li className="text-sm text-ink-400">لا صلاحيات مؤقتة</li>}
      </ul>
    </Card>
  );
}
