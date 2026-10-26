// المستخدمون وكلمات المرور: لمسؤول اللجنة التقنية وحده (القائد العام ينشئ الشخص من صفحة الأشخاص)
import { useState } from 'react';
import { accountOf, canManageAccounts } from '@/domain/accounts';
import { fmtDateTime } from '@/domain/dates';
import type { Account } from '@/domain/types';
import { act, personName, repos, useDB, useMe } from '@/state/store';
import { Badge, Button, Card, Empty, Field, Input, Modal, Notice, PageHeader, Table, Tabs, Toggle } from '@/ui';
import { PersonChip } from '@/ui/domain';

function status(a?: Account) {
  if (!a) return { label: 'بلا حساب', tone: 'gray' as const };
  if (a.disabled) return { label: 'معطّل', tone: 'red' as const };
  if (!a.passwordHash) return { label: 'بلا كلمة مرور', tone: 'orange' as const };
  if (a.mustChangePassword) return { label: 'بانتظار تغيير الكلمة', tone: 'blue' as const };
  return { label: 'مفعّل', tone: 'green' as const };
}

export default function UsersPage() {
  const db = useDB();
  const me = useMe();
  const [tab, setTab] = useState<'staff' | 'participant'>('staff');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ personId: string; password: string } | null>(null);
  if (!canManageAccounts(db, me.person.id)) return <Empty title="إدارة الحسابات لمسؤول اللجنة التقنية" text="القائد العام ينشئ الشخص ويحدد صفته من صفحة الأشخاص، ومسؤول اللجنة التقنية يدير اسم الدخول وكلمة المرور." />;
  const list = db.persons.filter((p) => p.kind === tab && (!q || p.name.includes(q) || accountOf(db, p.id)?.username.includes(q.toLowerCase())));
  const waiting = db.persons.filter((p) => !accountOf(db, p.id)?.passwordHash).length;

  return (
    <div>
      <PageHeader title="المستخدمون" subtitle="اسم الدخول وكلمة المرور وإعادة التعيين والتعطيل" />
      {waiting > 0 && <div className="mb-4"><Notice tone="orange">{waiting} حسابات بلا كلمة مرور بعد: أعد التعيين وسلّم الكلمة المؤقتة لأصحابها.</Notice></div>}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <Tabs value={tab} onChange={setTab} tabs={[{ key: 'staff', label: 'فريق العمل' }, { key: 'participant', label: 'المشاركون' }]} />
        <Input className="mb-4 w-56" placeholder="بحث بالاسم أو اسم الدخول" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <Card pad={false}>
        <Table>
          <thead><tr><th>الشخص</th><th>اسم الدخول</th><th>الحالة</th><th>آخر تعديل</th><th>مفعّل</th><th /></tr></thead>
          <tbody>
            {list.map((p) => {
              const a = accountOf(db, p.id);
              const st = status(a);
              return (
                <tr key={p.id}>
                  <td><PersonChip id={p.id} /></td>
                  <td><span dir="ltr" className="font-mono text-xs">{a?.username ?? '—'}</span></td>
                  <td><Badge tone={st.tone}>{st.label}</Badge></td>
                  <td className="text-xs text-ink-500">{a ? `${fmtDateTime(a.updatedAt)} · ${personName(db, a.updatedBy)}` : '—'}</td>
                  <td>{a && <Toggle checked={!a.disabled} onChange={(v) => act(() => repos.accounts.setDisabled(p.id, !v), v ? 'فُعّل الحساب' : 'عُطّل الحساب')} />}</td>
                  <td className="whitespace-nowrap">
                    {a && (
                      <span className="flex gap-2">
                        <Button size="sm" variant="secondary" onClick={() => setEditing(p.id)}>اسم الدخول</Button>
                        <Button size="sm" variant="secondary" onClick={() => act(() => setIssued({ personId: p.id, password: repos.accounts.resetPassword(p.id) }))}>أعد تعيين الكلمة</Button>
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>
      {editing && <UsernameModal personId={editing} onClose={() => setEditing(null)} />}
      <Modal open={!!issued} onClose={() => setIssued(null)} title="كلمة مرور مؤقتة" footer={<Button onClick={() => setIssued(null)}>تم</Button>}>
        {issued && (
          <div className="space-y-3">
            <p className="text-sm">سلّمها لـ <b>{personName(db, issued.personId)}</b>. تظهر مرة واحدة، وسيُطلب منه تغييرها أول دخول.</p>
            <div dir="ltr" className="rounded-xl bg-ink-50 p-3 text-center font-mono text-lg tracking-widest">{issued.password}</div>
            <p className="text-[11px] text-ink-400">اسم الدخول: <span dir="ltr" className="font-mono">{accountOf(db, issued.personId)?.username}</span>. الإيميل مؤجّل، فالتسليم يدوي حالياً.</p>
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
