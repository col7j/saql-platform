// القسم المالي: يملكه مسؤول اللجنة المالية، ويرى كل عضو ما فُوِّض به فقط
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { financeTabsFor } from '@/domain/access';
import { fmtDateTime } from '@/domain/dates';
import { uid } from '@/domain/id';
import { SAR } from '@/domain/labels';
import {
  ALL_SPEND_KINDS, FINANCE_PERMS, budgetOverview, canOpenFinance, canViewBudget, financeCommitteeId, financePermsOf, hasFinancePerm, isFinanceOwner,
  ownerTitle, requestStage, spendKindLabel,
} from '@/domain/finance';
import type { BudgetRequest } from '@/domain/types';
import { act, personName, repos, useDB, useMe } from '@/state/store';
import { Badge, Button, Card, Empty, Icons, Input, Modal, MoreMenu, Notice, PageHeader, Progress, StatusPill, Table, Tabs, Toggle, cx } from '@/ui';
import { PersonChip } from '@/ui/domain';
import { BudgetWizard } from './BudgetWizard';
import { CustodyCard } from './CustodyCard';
import { RequestPanel } from './RequestPanel';

type Tab = 'requests' | 'custody' | 'invoices' | 'budget' | 'categories' | 'team' | 'audit' | 'fees' | 'analysis';
const tabLabel: Record<Tab, string> = { requests: 'الطلبات', custody: 'العهد', invoices: 'الفواتير', budget: 'الميزانية', categories: 'التصنيفات', team: 'الفريق والصلاحيات', audit: 'سجل التدقيق', fees: 'الرسوم', analysis: 'التحليل' };

export default function FinancePage() {
  const db = useDB();
  const me = useMe();
  const pid = me.person.id;
  const [params, setParams] = useSearchParams();
  const owner = isFinanceOwner(db, pid);
  if (!canOpenFinance(db, pid)) return <Empty title="القسم المالي للجنة المالية والقائد العام" text="تجد ميزانية لقاءاتك أو رحلتك داخل صفحتها، وطلباتك في «طلباتي»." />;

  // أول دخول للمسؤول المالي بلا ميزانية: المعالج
  if (owner && !db.programBudget.setupDone)
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title="أعدّ ميزانية البرنامج" subtitle="سبع خطوات قصيرة. لا تُقبل طلبات الميزانية حتى تحفظها." />
        <Card><BudgetWizard /></Card>
      </div>
    );

  // التبويبات من فحص الوصول نفسه (ما لم يُبنَ بعد يُستبعد)
  const tabs = financeTabsFor(db, pid).filter((t): t is Tab => t in tabLabel);
  const tab = (tabs.includes(params.get('tab') as Tab) ? params.get('tab') : 'requests') as Tab;
  const main = tabs.slice(0, 4);
  const extra = tabs.slice(4);
  const setTab = (t: Tab) => setParams({ tab: t });

  return (
    <div>
      <PageHeader title="المالية" subtitle={owner ? 'أنت مسؤول اللجنة المالية' : me.isLeader ? 'تعتمد ما يتجاوز المرصود، ولا تصرف' : `صلاحياتك: ${financePermsOf(db, pid).map((p) => FINANCE_PERMS.find((x) => x.key === p)!.label).join('، ') || 'لا صلاحيات مفوّضة بعد'}`}
        actions={extra.length > 0 && <MoreMenu label="أقسام أخرى" items={extra.map((t) => ({ label: tabLabel[t], onClick: () => setTab(t) }))} />} />
      {!db.programBudget.setupDone && <Notice tone="orange">لم يُعدّ المسؤول المالي ميزانية البرنامج بعد، لذا لا تُقبل طلبات جديدة.</Notice>}
      <div className="mt-2">
        <Tabs value={main.includes(tab) ? tab : (tab as Tab)} onChange={setTab} tabs={(main.includes(tab) ? main : [...main, tab]).map((t) => ({ key: t, label: tabLabel[t] }))} />
      </div>
      {tab === 'requests' && <Requests focusId={params.get('req')} />}
      {tab === 'custody' && <Custodies />}
      {tab === 'invoices' && <Invoices />}
      {tab === 'budget' && <BudgetTab />}
      {tab === 'categories' && <Categories />}
      {tab === 'team' && <Team />}
      {tab === 'audit' && <Audit />}
      {tab === 'fees' && <Fees />}
      {tab === 'analysis' && <Analysis />}
    </div>
  );
}

// ───────────── الطلبات ─────────────
function Requests({ focusId }: { focusId: string | null }) {
  const db = useDB();
  const me = useMe();
  const [filter, setFilter] = useState<'mine' | 'all'>('mine');
  const [open, setOpen] = useState<string | null>(focusId);
  const pid = me.person.id;
  const waitingOnMe = (r: BudgetRequest) => requestStage(db, r).waitingOnId === pid;
  const list = [...db.budgetRequests].reverse().filter((r) => (filter === 'mine' ? waitingOnMe(r) : true));
  return (
    <div className="space-y-3">
      <Tabs value={filter} onChange={setFilter} tabs={[{ key: 'mine', label: `تنتظرني (${db.budgetRequests.filter(waitingOnMe).length})` }, { key: 'all', label: `كل الطلبات (${db.budgetRequests.length})` }]} />
      {list.length === 0 ? <Empty title="لا طلبات تنتظرك" text="ستظهر هنا طلبات الميزانية التي تحتاج قرارك أو صرفك." icon={<Icons.Inbox className="h-8 w-8" />} /> : list.map((r) => {
        const st = requestStage(db, r);
        const isOpen = open === r.id;
        return (
          <div key={r.id} className={cx('rounded-2xl border bg-white shadow-card', isOpen ? 'border-brand-200' : 'border-ink-100')}>
            <button onClick={() => setOpen(isOpen ? null : r.id)} className="flex min-h-[64px] w-full flex-wrap items-center gap-3 px-4 py-3 text-start">
              <div className="min-w-0 flex-1">
                <div className="font-medium">{ownerTitle(db, r.ownerKind, r.ownerId)}</div>
                <div className="mt-0.5 text-xs text-ink-500">{spendKindLabel[r.spendKind]} · {personName(db, r.requestedBy)} · <span className="num">{SAR(r.amount)}</span> من المرصود <span className="num">{SAR(r.allocated)}</span>{r.amount > r.allocated && <span className="text-accent-700"> (تجاوز)</span>}</div>
              </div>
              <StatusPill label={st.label} tone={st.tone} next={st.next} waitingOn={st.waitingOn} compact />
              <Icons.ChevronDown className={cx('h-4 w-4 transition', isOpen && 'rotate-180')} />
            </button>
            {isOpen && <div className="border-t border-ink-100 p-3"><RequestPanel ownerKind={r.ownerKind} ownerId={r.ownerId} title="تفاصيل الطلب" /></div>}
          </div>
        );
      })}
    </div>
  );
}

// ───────────── العهد ─────────────
function Custodies() {
  const db = useDB();
  const [open, setOpen] = useState<string | null>(null);
  const list = [...db.custodies].sort((a, b) => Number(a.status === 'closed') - Number(b.status === 'closed'));
  if (!list.length) return <Empty title="لا عهد بعد" text="تُصرف العهدة من الطلب المعتمد في تبويب «الطلبات»." />;
  return (
    <div className="space-y-3">
      {list.map((c) => {
        const req = db.budgetRequests.find((r) => r.id === c.requestId);
        const st = req ? requestStage(db, req) : null;
        return (
          <div key={c.id} className="rounded-2xl border border-ink-100 bg-white shadow-card">
            <button onClick={() => setOpen(open === c.id ? null : c.id)} className="flex min-h-[64px] w-full flex-wrap items-center gap-3 px-4 py-3 text-start">
              <div className="min-w-0 flex-1"><div className="font-medium">{ownerTitle(db, c.ownerKind, c.ownerId)}</div><div className="text-xs text-ink-500">{personName(db, c.recipientId)} · <span className="num">{SAR(c.total)}</span></div></div>
              {st && <StatusPill label={st.label} tone={st.tone} next={st.next} waitingOn={st.waitingOn} compact />}
              <Icons.ChevronDown className={cx('h-4 w-4', open === c.id && 'rotate-180')} />
            </button>
            {open === c.id && <div className="border-t border-ink-100 p-3"><CustodyCard custody={c} embedded /></div>}
          </div>
        );
      })}
    </div>
  );
}

// ───────────── الفواتير ─────────────
function Invoices() {
  const db = useDB();
  const pending = db.custodies.filter((c) => db.invoices.some((i) => i.custodyId === c.id && i.status === 'pending'));
  if (!pending.length) return <Empty title="لا فواتير بانتظار المراجعة" icon={<Icons.ReceiptText className="h-8 w-8" />} />;
  return <div className="space-y-4">{pending.map((c) => <CustodyCard key={c.id} custody={c} />)}</div>;
}

// ───────────── الميزانية ─────────────
function BudgetTab() {
  const db = useDB();
  const me = useMe();
  const owner = isFinanceOwner(db, me.person.id);
  const [edit, setEdit] = useState(false);
  const o = budgetOverview(db);
  return (
    <div className="space-y-6">
      <Card title="الميزانية العامة" subtitle={`المرصود ${SAR(o.total)} · المصروف ${SAR(o.spent)}`} action={owner && <Button onClick={() => setEdit(true)} icon={<Icons.Pencil className="h-4 w-4" />}>عدّل الميزانية</Button>}>
        <Table>
          <thead><tr><th>النوع</th><th>لكل عنصر</th><th>العدد</th><th>المرصود</th><th>المعتمد</th><th>المصروف</th></tr></thead>
          <tbody>
            {o.rows.map((r) => (
              <tr key={r.key}>
                <td className="font-medium">{r.label}</td>
                <td className="num">{SAR(r.perUnit)}</td>
                <td className="num">{r.units}</td>
                <td className="num">{SAR(r.allocated)}</td>
                <td className="num">{SAR(r.approved)}</td>
                <td className="w-40"><div className="num text-xs">{SAR(r.spent)}</div><Progress value={r.allocated ? (r.spent / r.allocated) * 100 : 0} /></td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
      <Card title="أنواع الصرف المسموح" subtitle="أي طلب صرف أو عهدة خارج هذه الأنواع يُمنع">
        <div className="grid gap-2 sm:grid-cols-2">
          {ALL_SPEND_KINDS.map((k) => (
            <div key={k} className="flex min-h-[44px] items-center justify-between rounded-xl border border-ink-100 px-3">
              <span className="text-sm">{spendKindLabel[k]}</span>
              {owner ? <Toggle checked={db.settings.spendableTypes.includes(k)} onChange={(v) => act(() => repos.finance.setSpendable(v ? [...db.settings.spendableTypes, k] : db.settings.spendableTypes.filter((x) => x !== k)), 'حُدّثت أنواع الصرف')} />
                : <Badge tone={db.settings.spendableTypes.includes(k) ? 'green' : 'gray'}>{db.settings.spendableTypes.includes(k) ? 'مسموح' : 'غير مسموح'}</Badge>}
            </div>
          ))}
        </div>
      </Card>
      <Modal open={edit} onClose={() => setEdit(false)} title="تعديل الميزانية" wide><BudgetWizard onDone={() => setEdit(false)} onCancel={() => setEdit(false)} /></Modal>
    </div>
  );
}

// ───────────── التصنيفات ─────────────
function Categories() {
  const db = useDB();
  const me = useMe();
  const manage = hasFinancePerm(db, me.person.id, 'manage_categories');
  const [name, setName] = useState('');
  const [itemDraft, setItemDraft] = useState<Record<string, string>>({});
  const used = (id: string) => db.invoices.some((i) => i.lines.some((l) => l.categoryId === id)) || db.budgetRequests.some((r) => r.lines.some((l) => l.categoryId === id));
  return (
    <div className="space-y-3">
      {manage && (
        <Card>
          <div className="flex gap-2"><Input placeholder="تصنيف جديد (مثال: السكن)" value={name} onChange={(e) => setName(e.target.value)} /><Button disabled={!name.trim()} onClick={() => act(() => { repos.finance.saveCategory({ id: uid('bc'), name, items: [] }); setName(''); }, 'أُضيف التصنيف')}>أضف التصنيف</Button></div>
        </Card>
      )}
      {db.budgetCategories.map((c) => (
        <Card key={c.id} title={<span className={cx(c.hidden && 'text-ink-400 line-through')}>{c.name}</span>} subtitle={`${c.items.length} بنود`}
          action={manage && <MoreMenu items={[
            { label: c.hidden ? 'أظهر التصنيف' : 'أخفِ التصنيف', onClick: () => act(() => repos.finance.saveCategory({ ...c, hidden: !c.hidden })) },
            { label: 'احذف التصنيف', danger: true, hidden: used(c.id), onClick: () => act(() => repos.finance.removeCategory(c.id), 'حُذف التصنيف') },
          ]} />}>
          <div className="flex flex-wrap gap-1.5">
            {c.items.map((i) => (
              <span key={i.id} className={cx('chip border border-ink-200 py-1', i.hidden && 'text-ink-300 line-through')}>
                {i.name}
                {manage && <button className="ms-1 text-ink-400" onClick={() => repos.finance.saveCategory({ ...c, items: c.items.map((x) => (x.id === i.id ? { ...x, hidden: !x.hidden } : x)) })} aria-label="إظهار أو إخفاء"><Icons.EyeOff className="h-3 w-3" /></button>}
              </span>
            ))}
            {c.items.length === 0 && <span className="text-xs text-ink-400">لا بنود تحته</span>}
          </div>
          {manage && (
            <div className="mt-3 flex gap-2">
              <Input placeholder="بند جديد تحت هذا التصنيف" value={itemDraft[c.id] ?? ''} onChange={(e) => setItemDraft({ ...itemDraft, [c.id]: e.target.value })} />
              <Button variant="secondary" disabled={!itemDraft[c.id]?.trim()} onClick={() => act(() => { repos.finance.saveCategory({ ...c, items: [...c.items, { id: uid('bi'), name: itemDraft[c.id] }] }); setItemDraft({ ...itemDraft, [c.id]: '' }); })}>أضف البند</Button>
            </div>
          )}
          {used(c.id) && <p className="mt-2 text-[11px] text-ink-400">عليه فواتير أو موازنات، فلا يُحذف (يمكن إخفاؤه).</p>}
        </Card>
      ))}
    </div>
  );
}

// ───────────── الفريق والصلاحيات ─────────────
function Team() {
  const db = useDB();
  const me = useMe();
  const owner = isFinanceOwner(db, me.person.id);
  const cid = financeCommitteeId(db);
  const members = db.memberships.filter((m) => m.committeeId === cid && m.role !== 'leader');
  return (
    <Card title="أعضاء اللجنة المالية" subtitle={owner ? 'امنح كل صلاحية أو اسحبها على حدة. العضو بلا صلاحية لا يرى زرها أصلاً.' : 'يمنح الصلاحيات مسؤول اللجنة المالية'}>
      <div className="mb-3"><PersonChip id={db.memberships.find((m) => m.committeeId === cid && m.role === 'leader')?.personId} sub="مسؤول اللجنة المالية: كل الصلاحيات" /></div>
      <div className="space-y-3">
        {members.map((m) => (
          <div key={m.id} className="rounded-2xl border border-ink-100 p-3">
            <PersonChip id={m.personId} />
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {FINANCE_PERMS.map((p) => {
                const on = (m.financePerms ?? []).includes(p.key);
                return (
                  <div key={p.key} className="flex min-h-[44px] items-center justify-between gap-2 rounded-xl bg-ink-50 px-3">
                    <span className="text-sm">{p.label}<span className="block text-[11px] text-ink-400">{p.hint}</span></span>
                    {owner ? <Toggle checked={on} onChange={(v) => act(() => repos.finance.setPermission(m.personId, p.key, v), v ? 'مُنحت الصلاحية وسُجّلت' : 'سُحبت الصلاحية وسُجّلت')} /> : <Badge tone={on ? 'green' : 'gray'}>{on ? 'ممنوحة' : 'لا'}</Badge>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Audit() {
  const db = useDB();
  return (
    <Card title="سجل التدقيق" subtitle="من، ماذا، متى: كل تفويض وكل قرار وكل صرف" pad={false}>
      {db.audit.filter((a) => (a.area ?? 'finance') === 'finance').length === 0 ? <div className="p-5"><Empty title="لا سجلات بعد" /></div> : (
        <Table>
          <thead><tr><th>متى</th><th>من</th><th>ماذا</th><th>التفاصيل</th></tr></thead>
          <tbody>{db.audit.filter((a) => (a.area ?? 'finance') === 'finance').map((a) => <tr key={a.id}><td className="whitespace-nowrap text-xs">{fmtDateTime(a.at)}</td><td><PersonChip id={a.byId} size={22} /></td><td className="font-medium">{a.action}</td><td className="text-xs text-ink-600">{a.detail}</td></tr>)}</tbody>
        </Table>
      )}
    </Card>
  );
}

function Fees() {
  const db = useDB();
  const me = useMe();
  const owner = isFinanceOwner(db, me.person.id);
  const paid = db.fees.filter((f) => f.paid);
  return (
    <Card title="رسوم البرنامج" subtitle={`سدّد ${paid.length} من ${db.fees.length} · المحصّل ${SAR(paid.reduce((s, f) => s + f.amount, 0))} · تُسجَّل فقط ولا تُدفع داخل المنصة`}>
      <Table>
        <thead><tr><th>المشارك</th><th>المبلغ</th><th>الحالة</th></tr></thead>
        <tbody>
          {db.fees.map((f) => (
            <tr key={f.personId}>
              <td><PersonChip id={f.personId} size={22} /></td>
              <td className="num">{SAR(f.amount)}</td>
              <td>{owner ? <Toggle checked={f.paid} onChange={(v) => act(() => repos.finance.setFee(f.personId, v))} label={<span className="text-xs">{f.paid ? 'مسدّد' : 'غير مسدّد'}</span>} /> : <Badge tone={f.paid ? 'green' : 'red'}>{f.paid ? 'مسدّد' : 'غير مسدّد'}</Badge>}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}

function Analysis() {
  const db = useDB();
  const accepted = db.invoices.filter((i) => i.status === 'accepted');
  const lines = accepted.flatMap((i) => i.lines.map((l) => ({ ...l, custodyId: i.custodyId })));
  const byCat = db.budgetCategories.map((c) => {
    const ls = lines.filter((l) => l.categoryId === c.id);
    const bySource = db.custodies.map((cu) => ({ title: ownerTitle(db, cu.ownerKind, cu.ownerId), amount: ls.filter((l) => l.custodyId === cu.id).reduce((s, l) => s + l.amount, 0) })).filter((x) => x.amount > 0);
    return { c, spent: ls.reduce((s, l) => s + l.amount, 0), bySource };
  }).filter((x) => x.spent > 0).sort((a, b) => b.spent - a.spent);
  const max = Math.max(1, ...byCat.map((x) => x.spent));
  return (
    <Card title="الصرف حسب التصنيف على مستوى البرنامج" subtitle="من أسطر الفواتير المقبولة">
      {byCat.length === 0 ? <Empty title="لا مصروفات مقبولة بعد" /> : (
        <div className="space-y-4">
          {byCat.map(({ c, spent, bySource }) => (
            <div key={c.id}>
              <div className="mb-1 flex justify-between text-sm"><b>{c.name}</b><span className="num">{SAR(spent)}</span></div>
              <div className="h-2.5 overflow-hidden rounded-full bg-ink-100"><div className="h-full bg-brand-grad" style={{ width: `${(spent / max) * 100}%` }} /></div>
              <details className="mt-1 text-[11px] text-ink-500"><summary className="cursor-pointer">حسب الرحلة أو اللقاء</summary>{bySource.map((s) => <div key={s.title} className="flex justify-between"><span>{s.title}</span><span className="num">{SAR(s.amount)}</span></div>)}</details>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
