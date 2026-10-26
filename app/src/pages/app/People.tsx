import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getCapabilities, groupOf } from '@/domain/permissions';
import { act, repos, useDB, useMe } from '@/state/store';
import type { PersonKind } from '@/domain/types';
import { Badge, Button, Card, Field, Icons, Input, Modal, PageHeader, Select, Table, Tabs, Toggle } from '@/ui';
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
        actions={me.isLeader && <Button onClick={() => setAdding(true)} icon={<Icons.UserPlus className="h-4 w-4" />}>أضف شخصاً</Button>} />
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
      {adding && <AddPerson onClose={() => setAdding(false)} defaultKind={tab} />}
    </div>
  );
}

/** القائد العام ينشئ الشخص ويحدد نوعه. الصفات تُسند من المجموعات واللجان والإعدادات، والحساب يديره مسؤول اللجنة التقنية */
function AddPerson({ onClose, defaultKind }: { onClose: () => void; defaultKind: PersonKind }) {
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
        <Field label="النوع"><Select value={f.kind} onChange={(e) => set({ kind: e.target.value as PersonKind })} options={[{ value: 'participant', label: 'مشارك' }, { value: 'staff', label: 'عضو فريق عمل' }]} /></Field>
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
