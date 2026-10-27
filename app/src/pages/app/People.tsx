// الأشخاص والصلاحيات: شاشة واحدة لإدارة الشخص. القائد العام: الأشخاص وفريق العمل واللجان والصلاحيات المؤقتة والمتابع الدائم وقواعد التعارض.
// مسؤول التقنية: الحساب واسم الدخول وإعادة تعيين الكلمة في بطاقة الشخص نفسها، وقواعد التعارض
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { accountOf, canManageAccounts } from '@/domain/accounts';
import { getCapabilities, groupOf } from '@/domain/permissions';
import { act, personName, repos, useDB, useMe } from '@/state/store';
import { addDays, fmtDate, todayISO } from '@/domain/dates';
import { isGrantActive, tempPermissionLabel } from '@/domain/grants';
import type { Account, Person, PersonKind, TempPermission } from '@/domain/types';
import { Badge, Button, Card, DataTable, Empty, Field, FilterPills, Icons, Input, Modal, Notice, PageHeader, Select, Tabs, Toggle, type Column } from '@/ui';
import { GroupBadge, PersonChip } from '@/ui/domain';
import { CommitteesList } from './Committees';
import { Roles, Tracker } from './Settings';

type Tab = 'participant' | 'staff' | 'committees' | 'grants' | 'tracker' | 'roles';

/** الصفات التي تميّز الشخص فقط: لا «مشارك» ولا «عضو إدارة» (النوع الأساسي) */
const BASE_LABELS = ['مشارك', 'عضو إدارة'];
export const distinctLabels = (labels: string[]) => labels.filter((l) => !BASE_LABELS.includes(l));

export default function PeoplePage() {
  const db = useDB();
  const me = useMe();
  const accounts = canManageAccounts(db, me.person.id);
  const [params, setParams] = useSearchParams();
  const tabs: { key: Tab; label: string }[] = [
    { key: 'participant', label: 'الأشخاص' },
    { key: 'staff', label: 'فريق العمل' },
    ...(me.isLeader ? [{ key: 'committees' as const, label: 'اللجان' }, { key: 'grants' as const, label: 'الصلاحيات المؤقتة' }, { key: 'tracker' as const, label: 'متابع الرحلات الدائم' }] : []),
    ...(me.isLeader || me.isTechLead ? [{ key: 'roles' as const, label: 'قواعد التعارض' }] : []),
  ];
  const tab = (tabs.some((t) => t.key === params.get('tab')) ? params.get('tab') : 'participant') as Tab;
  const [adding, setAdding] = useState(false);
  const canAdd = me.isLeader || me.canRegisterParticipants;
  const title = me.isLeader ? 'الأشخاص والصلاحيات' : accounts ? 'الأشخاص والحسابات' : 'الأشخاص';
  return (
    <div>
      <PageHeader title={title} subtitle={accounts ? 'بطاقة لكل شخص: صفاته، واسم دخوله، وإعادة تعيين كلمة مروره' : 'لكل شخص نوع أساسي وصفات إضافية تجتمع عليه بلا تعارض، وتُحسب صلاحياته من مجموعها'}
        actions={canAdd && (tab === 'participant' || tab === 'staff') && <Button onClick={() => setAdding(true)} icon={<Icons.UserPlus className="h-4 w-4" />}>أضف شخصاً</Button>} />
      <Tabs value={tab} onChange={(t) => setParams({ tab: t })} tabs={tabs} />
      {(tab === 'participant' || tab === 'staff') && <PeopleList kind={tab} accounts={accounts} />}
      {tab === 'committees' && <CommitteesList />}
      {tab === 'grants' && <Grants />}
      {tab === 'tracker' && <Tracker />}
      {tab === 'roles' && <Roles />}
      {adding && <AddPerson onClose={() => setAdding(false)} defaultKind={me.isLeader ? (tab === 'staff' ? 'staff' : 'participant') : 'participant'} staffAllowed={me.isLeader} />}
    </div>
  );
}

function accountStatus(a?: Account) {
  if (!a) return { label: 'بلا حساب', tone: 'gray' as const };
  if (a.disabled) return { label: 'معطّل', tone: 'red' as const };
  if (!a.passwordHash) return { label: 'بلا كلمة مرور', tone: 'orange' as const };
  if (a.mustChangePassword) return { label: 'بانتظار تغيير الكلمة', tone: 'blue' as const };
  return { label: 'مفعّل', tone: 'green' as const };
}

/** قائمة الأشخاص: جدول على الشاشة الكبيرة وبطاقة لكل شخص على الجوال. ولمسؤول التقنية أعمدة الحساب */
function PeopleList({ kind, accounts }: { kind: PersonKind; accounts: boolean }) {
  const db = useDB();
  const [q, setQ] = useState('');
  const [acc, setAcc] = useState<'all' | 'nopass'>('all');
  const [editing, setEditing] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ personId: string; password: string } | null>(null);
  const list = db.persons.filter((p) => p.kind === kind && (!q || p.name.includes(q) || accountOf(db, p.id)?.username.includes(q.toLowerCase())) && (acc === 'all' || !accountOf(db, p.id)?.passwordHash));
  const waiting = db.persons.filter((p) => !accountOf(db, p.id)?.passwordHash).length;
  const columns: Column<Person>[] = [
    { key: 'name', header: 'الاسم', cell: (p) => <Link to={`/app/people/${p.id}`} className="inline-flex min-h-[44px] items-center"><PersonChip id={p.id} sub={p.university ?? p.title} /></Link> },
    ...(kind === 'participant' ? [{ key: 'group', header: 'المجموعة', cell: (p: Person) => <GroupBadge id={groupOf(db, p.id)?.id} /> }] : []),
    { key: 'labels', header: 'الصفات', cell: (p) => { const l = distinctLabels(getCapabilities(db, p.id).labels); return l.length ? <div className="flex flex-wrap gap-1">{l.map((x) => <Badge key={x}>{x}</Badge>)}</div> : <span className="text-ink-500">—</span>; } },
  ];
  if (accounts)
    columns.push(
      { key: 'user', header: 'اسم الدخول', cell: (p) => <span dir="ltr" className="font-mono text-xs">{accountOf(db, p.id)?.username ?? '—'}</span> },
      { key: 'status', header: 'الحساب', cell: (p) => { const st = accountStatus(accountOf(db, p.id)); return <Badge tone={st.tone}>{st.label}</Badge>; } },
      { key: 'on', header: 'مفعّل', cell: (p) => { const a = accountOf(db, p.id); return a ? <Toggle checked={!a.disabled} onChange={(v) => act(() => repos.accounts.setDisabled(p.id, !v), v ? 'فُعّل الحساب' : 'عُطّل الحساب')} /> : '—'; } },
      { key: 'actions', header: '', cell: (p) => accountOf(db, p.id) && (
        <span className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => setEditing(p.id)}>اسم الدخول</Button>
          <Button size="sm" variant="secondary" onClick={() => act(() => setIssued({ personId: p.id, password: repos.accounts.resetPassword(p.id) }))}>أعد تعيين الكلمة</Button>
        </span>
      ) },
    );
  return (
    <div>
      {accounts && waiting > 0 && <div className="mb-4"><Notice tone="orange">{waiting} حسابات بلا كلمة مرور بعد: أعد التعيين وسلّم الكلمة المؤقتة لأصحابها.</Notice></div>}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {accounts ? <FilterPills value={acc} onChange={setAcc} options={[{ key: 'all', label: 'الكل' }, { key: 'nopass', label: 'بلا كلمة مرور' }]} /> : <span />}
        <Input className="w-full sm:w-64" placeholder={accounts ? 'بحث بالاسم أو اسم الدخول' : 'بحث بالاسم'} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <DataTable columns={columns} rows={list} rowKey={(p) => p.id} actionsKey="actions" minWidth={accounts ? 960 : 560} empty={<Empty title="لا نتائج" />} />
      {editing && <UsernameModal personId={editing} onClose={() => setEditing(null)} />}
      <Modal open={!!issued} onClose={() => setIssued(null)} title="كلمة مرور مؤقتة" footer={<Button onClick={() => setIssued(null)}>تم</Button>}>
        {issued && (
          <div className="space-y-3">
            <p className="text-sm">سلّمها لـ <b>{personName(db, issued.personId)}</b>. تظهر مرة واحدة، وسيُطلب منه تغييرها أول دخول.</p>
            <div dir="ltr" className="rounded-xl bg-ink-50 p-3 text-center font-mono text-lg tracking-widest">{issued.password}</div>
            <p className="text-xs text-ink-500">اسم الدخول: <span dir="ltr" className="font-mono">{accountOf(db, issued.personId)?.username}</span>. الإيميل مؤجّل، فالتسليم يدوي حالياً.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}

function UsernameModal({ personId, onClose }: { personId: string; onClose: () => void }) {
  const db = useDB();
  const [u, setU] = useState(accountOf(db, personId)?.username ?? '');
  return (
    <Modal open onClose={onClose} title={`اسم الدخول: ${personName(db, personId)}`} footer={<Button onClick={() => act(() => { repos.accounts.setUsername(personId, u); onClose(); }, 'حُفظ اسم الدخول')}>احفظ</Button>}>
      <Field label="اسم الدخول" hint="حروف إنجليزية صغيرة وأرقام و . _ -"><Input dir="ltr" value={u} onChange={(e) => setU(e.target.value)} /></Field>
    </Modal>
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
    <Card title="الصلاحيات المؤقتة" subtitle="تسجيل المشاركين، تحرير الموقع العام، تصنيفات الجدول. تنتهي تلقائياً في تاريخها">
      <div className="grid gap-3 rounded-2xl bg-ink-50 p-4 sm:grid-cols-[1fr_1fr_170px_auto]">
        <Select value={f.personId} onChange={(e) => setF({ ...f, personId: e.target.value })} options={staff.map((p) => ({ value: p.id, label: p.name }))} aria-label="الشخص" />
        <Select value={f.permission} onChange={(e) => setF({ ...f, permission: e.target.value as TempPermission })} options={(Object.keys(tempPermissionLabel) as TempPermission[]).map((k) => ({ value: k, label: tempPermissionLabel[k] }))} aria-label="الصلاحية" />
        <Input type="date" value={f.expiresAt} onChange={(e) => setF({ ...f, expiresAt: e.target.value })} title="آخر يوم صالح" aria-label="آخر يوم صالح" />
        <Button disabled={!f.personId} onClick={() => act(() => repos.grants.grant(f.personId, f.permission, f.expiresAt), 'مُنحت الصلاحية')}>امنح</Button>
      </div>
      <ul className="mt-4 space-y-2">
        {list.map((g) => {
          const active = isGrantActive(g);
          return (
            <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink-100 px-4 py-3">
              <PersonChip id={g.personId} sub={`${tempPermissionLabel[g.permission]} · حتى ${fmtDate(g.expiresAt)}`} />
              <span className="flex items-center gap-2">
                <Badge tone={active ? 'green' : 'gray'}>{g.revokedAt ? 'مسحوبة' : active ? 'سارية' : 'منتهية'}</Badge>
                {active && <Button size="sm" variant="danger" onClick={() => act(() => repos.grants.revoke(g.id), 'سُحبت الصلاحية')}>اسحب</Button>}
              </span>
            </li>
          );
        })}
        {list.length === 0 && <li className="text-sm text-ink-500">لا صلاحيات مؤقتة</li>}
      </ul>
    </Card>
  );
}
