// القسم المالي: يملكه مسؤول اللجنة المالية، ويرى كل عضو ما فُوِّض به فقط
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { financeTabsFor } from '@/domain/access';
import { fmtDateTime } from '@/domain/dates';
import { uid } from '@/domain/id';
import { SAR } from '@/domain/labels';
import {
  ALL_SPEND_KINDS, FINANCE_PERMS, canOpenFinance, financeCommitteeId, financePermsOf, hasFinancePerm, isFinanceOwner,
  ownerTitle, requestStage, spendKindGroup, spendKindLabel, spendKindOf,
} from '@/domain/finance';
import { activitySpend, budgetOverview, custodyTitle, openCustodyConflict, spentLines, walletBalance, walletFigures, WALLET_IN, walletKindLabel } from '@/domain/ledger';
import { custodyStatusLabel, custodyStatusTone } from '@/domain/labels';
import { fmtDate, todayISO } from '@/domain/dates';
import type { Attachment, BudgetOwnerKind, BudgetRequest, FeeRecord, FeeStatus, ProofKind, SpendKind } from '@/domain/types';
import { AttachmentInput, AttachmentView } from '@/ui/attachments';
import { EditRequestButton, EditRequestsList } from './EditRequest';
import { act, personName, repos, useDB, useMe } from '@/state/store';
import { Badge, Button, Card, Empty, Field, Icons, Input, Modal, MoreMenu, Notice, PageHeader, Progress, Select, StatusPill, Table, Tabs, Toggle, askConfirm, cx } from '@/ui';
import { PersonChip } from '@/ui/domain';
import { BudgetWizard } from './BudgetWizard';
import { CustodyCard, IssueCustodyModal, LinesEditor, SpendFormView, categoryLabel, newLine, toLines } from './CustodyCard';
import { RequestPanel } from './RequestPanel';

type Tab = 'requests' | 'invoices' | 'custody' | 'wallet' | 'direct' | 'needs' | 'budget' | 'edits' | 'categories' | 'team' | 'settings' | 'audit' | 'fees' | 'analysis';
const tabLabel: Record<Tab, string> = {
  requests: 'الطلبات', invoices: 'الفواتير', custody: 'العهد والإغلاق', wallet: 'المحفظة', direct: 'الصرف المباشر', needs: 'احتياجات البرنامج', budget: 'الموازنة',
  edits: 'طلبات التعديل', categories: 'التصنيفات', team: 'الفريق والصلاحيات', settings: 'الإعدادات المالية', audit: 'سجل التدقيق', fees: 'الرسوم', analysis: 'التحليلات',
};

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
        <PageHeader title="أعدّ الموازنة العامة" subtitle="خطوات قصيرة. لا تُقبل طلبات الميزانية حتى تحفظها، وبعد الحفظ تُقفل." />
        <Card><BudgetWizard /></Card>
      </div>
    );

  // التبويبات من فحص الوصول نفسه (ما لم يُبنَ بعد يُستبعد)
  const tabs = financeTabsFor(db, pid).filter((t): t is Tab => t in tabLabel);
  const tab = (tabs.includes(params.get('tab') as Tab) ? params.get('tab') : 'requests') as Tab;
  const main = tabs.slice(0, 5);
  const extra = tabs.slice(4);
  const setTab = (t: Tab) => setParams({ tab: t });

  return (
    <div>
      <PageHeader title="المالية" subtitle={owner ? `أنت مسؤول المالية · رصيدك الفعلي ${SAR(walletBalance(db))}` : me.isLeader ? 'تراقب المالية: تعتمد التجاوزات وتعديل السجلات المعتمدة، ولا تصرف' : `صلاحياتك: ${financePermsOf(db, pid).map((p) => FINANCE_PERMS.find((x) => x.key === p)!.label).join('، ') || 'لا صلاحيات مفوّضة بعد'}`}
        actions={extra.length > 0 && <MoreMenu label="أقسام أخرى" items={extra.map((t) => ({ label: tabLabel[t], onClick: () => setTab(t) }))} />} />
      {!db.programBudget.setupDone && <Notice tone="orange">لم يُعدّ مسؤول المالية الموازنة العامة بعد، لذا لا تُقبل طلبات جديدة.</Notice>}
      <div className="mt-2">
        <Tabs value={main.includes(tab) ? tab : (tab as Tab)} onChange={setTab} tabs={(main.includes(tab) ? main : [...main, tab]).map((t) => ({ key: t, label: tabLabel[t] }))} />
      </div>
      {tab === 'requests' && <Requests focusId={params.get('req')} />}
      {tab === 'custody' && <Custodies />}
      {tab === 'invoices' && <Invoices />}
      {tab === 'wallet' && <Wallet />}
      {tab === 'direct' && <Direct />}
      {tab === 'needs' && <Needs />}
      {tab === 'edits' && <EditRequestsList />}
      {tab === 'settings' && <FinanceSettings />}
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
  if (!list.length) return <Empty title="لا عهد بعد" text="تُحوَّل العهدة من الطلب المعتمد في تبويب «الطلبات»، أو مباشرة للافتتاحي والختامي واحتياجات البرنامج." />;
  return (
    <div className="space-y-3">
      {list.map((c) => {
        const req = db.budgetRequests.find((r) => r.id === c.requestId);
        const st = req ? requestStage(db, req) : null;
        return (
          <div key={c.id} className="rounded-2xl border border-ink-100 bg-white shadow-card">
            <button onClick={() => setOpen(open === c.id ? null : c.id)} className="flex min-h-[64px] w-full flex-wrap items-center gap-3 px-4 py-3 text-start">
              <div className="min-w-0 flex-1"><div className="font-medium">{ownerTitle(db, c.ownerKind, c.ownerId)}</div><div className="text-xs text-ink-500">{spendKindLabel[c.spendKind]} · {personName(db, c.recipientId)} · <span className="num">{SAR(c.approved)}</span></div></div>
              {!st && <Badge tone={custodyStatusTone[c.status]}>{custodyStatusLabel[c.status]}</Badge>}
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

// ───────────── الفواتير (مراجعة بنود الصرف) ─────────────
function Invoices() {
  const db = useDB();
  const forms = db.spendForms.filter((f) => f.lines.some((l) => l.status === 'pending'));
  if (!forms.length) return <Empty title="لا بنود بانتظار المراجعة" text="كل بند يُراجَع وحده: يُعدَّل التصنيف والمبلغ ثم يُعتمد أو يُرفض." icon={<Icons.ReceiptText className="h-8 w-8" />} />;
  return (
    <div className="space-y-4">
      {forms.map((f) => {
        const c = db.custodies.find((x) => x.id === f.custodyId)!;
        return (
          <Card key={f.id} title={ownerTitle(db, c.ownerKind, c.ownerId)} subtitle={`${personName(db, c.recipientId)} · ${spendKindLabel[c.spendKind]}`}>
            <SpendFormView form={f} custody={c} />
          </Card>
        );
      })}
    </div>
  );
}

// ───────────── المحفظة ─────────────
function Wallet() {
  const db = useDB();
  const me = useMe();
  const w = walletFigures(db);
  const canAct = hasFinancePerm(db, me.person.id, 'disburse');
  const [open, setOpen] = useState(false);
  const list = [...db.wallet].sort((a, b) => b.at.localeCompare(a.at));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([['الرصيد الفعلي', w.balance], ['الداخل', w.in], ['المصروف الفعلي', w.out], ['منه للعهد', w.toCustody]] as [string, number][]).map(([l, v]) => (
          <div key={l} className="rounded-2xl border border-ink-100 bg-white p-4 shadow-card"><div className="text-xs text-ink-500">{l}</div><div className="num text-lg font-bold">{SAR(v)}</div></div>
        ))}
      </div>
      <Card pad={false} title="حركة المحفظة" subtitle="لا يُسجَّل مبلغ بلا مرفق: الإيداع بإيصال الحوالة، والصرف بفاتورة أو إيصال تحويل" action={canAct && <Button onClick={() => setOpen(true)} icon={<Icons.Plus className="h-4 w-4" />}>سجّل إيداعاً</Button>}>
        <Table>
          <thead><tr><th>متى</th><th>الحركة</th><th>التفاصيل</th><th>المرفق</th><th>المبلغ</th><th /></tr></thead>
          <tbody>
            {list.map((e) => {
              const into = WALLET_IN.includes(e.kind);
              return (
                <tr key={e.id}>
                  <td className="whitespace-nowrap text-xs">{fmtDateTime(e.at)}</td>
                  <td><Badge tone={into ? 'green' : 'gray'}>{walletKindLabel[e.kind]}</Badge></td>
                  <td className="text-xs text-ink-600">{e.source ?? (e.ref?.custodyId ? custodyTitle(db, e.ref.custodyId) : e.ref?.directSpendId ? 'صرف مباشر' : e.ref?.contractId ? db.contracts.find((c) => c.id === e.ref?.contractId)?.title : '')}{e.note ? ` · ${e.note}` : ''}</td>
                  <td><AttachmentView a={e.attachment} compact /></td>
                  <td className={cx('num font-bold', into ? 'text-emerald-700' : 'text-ink-700')}>{into ? '+' : '−'}{SAR(e.amount)}</td>
                  <td>{e.kind === 'deposit' && <EditRequestButton target={{ kind: 'deposit', id: e.id }} current={{ amount: e.amount }} title={`إيداع ${e.source ?? ''}`} amountOnly />}</td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>
      {open && <DepositModal onClose={() => setOpen(false)} />}
    </div>
  );
}
function DepositModal({ onClose }: { onClose: () => void }) {
  const [f, setF] = useState({ amount: 0, source: 'جمعية البرنامج', note: '' });
  const [attachment, setAttachment] = useState<Attachment>();
  return (
    <Modal open onClose={onClose} title="إيداع في المحفظة" footer={<Button disabled={!attachment || !(f.amount > 0)} onClick={() => act(() => { repos.finance.deposit({ ...f, attachment: attachment! }); onClose(); }, 'سُجّل الإيداع وتعبّأ رصيدك')}>سجّل الإيداع</Button>}>
      <div className="grid gap-3">
        <Field label="المبلغ (ر.س)"><Input className="num" type="number" value={f.amount || ''} onChange={(e) => setF({ ...f, amount: +e.target.value })} /></Field>
        <Field label="الجهة المحوِّلة"><Input value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} /></Field>
        <Field label="التفاصيل"><Input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
        <AttachmentInput value={attachment} onChange={setAttachment} label="إيصال الحوالة (إلزامي)" />
      </div>
    </Modal>
  );
}

// ───────────── الصرف المباشر ─────────────
function ownerOptions(db: ReturnType<typeof useDB>) {
  return [
    ...db.trips.map((t) => ({ value: `trip:${t.id}`, label: `${spendKindLabel[spendKindOf(db, 'trip', t.id)]}: ${t.title}` })),
    ...db.focusMeetings.map((f) => ({ value: `focus:${f.id}`, label: `لقاء تركيز: ${f.title} (${db.groups.find((g) => g.id === f.groupId)?.name})` })),
    ...db.meetings.map((m) => ({ value: `meeting:${m.id}`, label: `اجتماع: ${m.title}` })),
    ...db.programNeeds.map((n) => ({ value: `need:${n.id}`, label: `احتياجات البرنامج: ${n.title}` })),
  ];
}
const parseOwner = (v: string) => { const [ownerKind, ownerId] = v.split(':'); return { ownerKind: ownerKind as BudgetOwnerKind, ownerId }; };

function Direct() {
  const db = useDB();
  const me = useMe();
  const canAct = hasFinancePerm(db, me.person.id, 'disburse');
  const [open, setOpen] = useState(false);
  const list = [...db.directSpends].reverse();
  return (
    <Card pad={false} title="الصرف المباشر" subtitle="يصرفه مسؤول المالية بنفسه بفاتورة إلزامية، بلا اعتماد حتى لو تجاوز. يُربط بالنشاط ويظهر مع العهدة في إغلاقه" action={canAct && <Button onClick={() => setOpen(true)} icon={<Icons.Plus className="h-4 w-4" />}>اصرف مباشرة</Button>}>
      {list.length === 0 ? <div className="p-5"><Empty title="لا صرف مباشر بعد" /></div> : (
        <Table>
          <thead><tr><th>متى</th><th>النشاط</th><th>المورد</th><th>البنود</th><th>الفاتورة</th><th>المبلغ</th></tr></thead>
          <tbody>
            {list.map((d) => (
              <tr key={d.id}>
                <td className="whitespace-nowrap text-xs">{fmtDate(d.invoiceDate)}</td>
                <td className="text-xs">{d.allocations.map((a) => <div key={a.ownerId}>{ownerTitle(db, a.ownerKind, a.ownerId)}{d.allocations.length > 1 && <span className="num text-ink-500"> ({SAR(a.amount)})</span>}</div>)}</td>
                <td className="text-xs">{d.vendor}{d.serial && <span className="block text-ink-400">#{d.serial}</span>}</td>
                <td className="text-xs">{d.lines.map((l) => <div key={l.id}>{categoryLabel(db, l)} · {l.item}</div>)}</td>
                <td><AttachmentView a={d.attachment} compact /></td>
                <td className="num font-bold">{SAR(d.total)} <EditRequestButton target={{ kind: 'direct_spend', id: d.id }} current={{ amount: d.total, categoryId: d.lines[0]?.categoryId }} title={`صرف مباشر ${d.vendor}`} /></td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {open && <DirectModal onClose={() => setOpen(false)} />}
    </Card>
  );
}
function DirectModal({ onClose }: { onClose: () => void }) {
  const db = useDB();
  const opts = ownerOptions(db);
  const [p, setP] = useState({ vendor: '', serial: '', invoiceDate: todayISO(), proofKind: 'invoice' as ProofKind });
  const [attachment, setAttachment] = useState<Attachment>();
  const [lines, setLines] = useState([newLine(db.budgetCategories[0]?.id ?? '')]);
  const total = Math.round(lines.reduce((s, l) => s + (l.amount || 0), 0) * 100) / 100;
  const [alloc, setAlloc] = useState<{ owner: string; amount: number }[]>([{ owner: opts[0]?.value ?? '', amount: 0 }]);
  const shared = alloc.length > 1;
  const allocations = (shared ? alloc : [{ owner: alloc[0].owner, amount: total }]).map((a) => ({ ...parseOwner(a.owner), amount: a.amount }));
  const sum = Math.round(allocations.reduce((s, a) => s + a.amount, 0) * 100) / 100;
  return (
    <Modal open onClose={onClose} wide title="صرف مباشر" footer={<><Button variant="ghost" onClick={onClose}>إلغاء</Button><Button disabled={!attachment} onClick={() => act(() => { repos.finance.directSpend({ ...p, attachment: attachment!, lines: toLines(lines), allocations }); onClose(); }, 'سُجّل الصرف المباشر')}>اصرف</Button></>}>
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="نوع الإثبات"><Select value={p.proofKind} onChange={(e) => setP({ ...p, proofKind: e.target.value as ProofKind })} options={[{ value: 'invoice', label: 'فاتورة' }, { value: 'transfer_receipt', label: 'إيصال تحويل' }]} /></Field>
          <AttachmentInput value={attachment} onChange={setAttachment} label="الفاتورة أو إيصال التحويل (إلزامي)" onSerial={(serial) => setP((x) => ({ ...x, serial }))} />
          <Field label="المورد"><Input value={p.vendor} onChange={(e) => setP({ ...p, vendor: e.target.value })} /></Field>
          <Field label="تاريخ الفاتورة"><Input type="date" value={p.invoiceDate} onChange={(e) => setP({ ...p, invoiceDate: e.target.value })} /></Field>
          <Field label="الرقم التسلسلي"><Input dir="ltr" value={p.serial} onChange={(e) => setP({ ...p, serial: e.target.value })} /></Field>
        </div>
        <LinesEditor lines={lines} onChange={setLines} />
        <div className="space-y-2 rounded-xl bg-ink-50 p-3">
          <div className="text-sm font-medium">النشاط{shared ? ' (مصروف مشترك موزّع)' : ''}</div>
          {alloc.map((a, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_120px_auto]">
              <Select value={a.owner} onChange={(e) => setAlloc(alloc.map((x, j) => (j === i ? { ...x, owner: e.target.value } : x)))} options={opts} aria-label="النشاط" />
              {shared ? <Input className="num" type="number" value={a.amount || ''} onChange={(e) => setAlloc(alloc.map((x, j) => (j === i ? { ...x, amount: +e.target.value } : x)))} aria-label="الحصة" /> : <span />}
              {shared && <button onClick={() => setAlloc(alloc.filter((_, j) => j !== i))} aria-label="احذف"><Icons.X className="h-4 w-4 text-ink-400" /></button>}
            </div>
          ))}
          <Button size="sm" variant="secondary" onClick={() => setAlloc([...alloc.map((x) => ({ ...x, amount: x.amount || (alloc.length === 1 ? total : 0) })), { owner: opts[0]?.value ?? '', amount: 0 }])}>وزّع على نشاط آخر</Button>
          {shared && <p className={cx('text-xs', Math.abs(sum - total) < 0.01 ? 'text-emerald-700' : 'text-accent-700')}>مجموع التوزيع {SAR(sum)} من مبلغ الفاتورة {SAR(total)}: يجب أن يتساويا بالضبط</p>}
          <p className="text-xs text-ink-500">رصيدك الفعلي {SAR(walletBalance(db))}</p>
        </div>
      </div>
    </Modal>
  );
}

// ───────────── احتياجات البرنامج والعقود ─────────────
function Needs() {
  const db = useDB();
  const me = useMe();
  const canAct = hasFinancePerm(db, me.person.id, 'disburse');
  const [title, setTitle] = useState('');
  const [contractFor, setContractFor] = useState<string | null>(null);
  const [custodyFor, setCustodyFor] = useState<{ ownerKind: BudgetOwnerKind; ownerId: string } | null>(null);
  const [paying, setPaying] = useState<{ contractId: string; paymentId: string } | null>(null);
  const [payAtt, setPayAtt] = useState<Attachment>();
  const milestones = db.trips.filter((t) => t.milestone);
  return (
    <div className="space-y-4">
      <Notice>احتياجات البرنامج والافتتاحي والختامي: صرف مباشر، أو عهدة لشخص يقفلها، والعقود في احتياجات البرنامج فقط.</Notice>
      {canAct && (
        <Card>
          <div className="flex gap-2"><Input placeholder="احتياج جديد (مثال: المطبوعات)" value={title} onChange={(e) => setTitle(e.target.value)} /><Button disabled={!title.trim()} onClick={() => act(() => { repos.finance.createNeed(title); setTitle(''); }, 'أُضيف الاحتياج')}>أضف</Button></div>
        </Card>
      )}
      {db.programNeeds.map((n) => {
        const spend = activitySpend(db, 'need', n.id);
        return (
          <Card key={n.id} title={n.title} subtitle={`${n.description ?? ''} · المصروف ${SAR(spend.total)} (عهدة ${SAR(spend.custody)} + مباشر ${SAR(spend.direct)} + عقود ${SAR(spend.contracts)})`}
            action={canAct && <span className="flex gap-2"><Button size="sm" variant="secondary" onClick={() => setCustodyFor({ ownerKind: 'need', ownerId: n.id })}>عهدة لشخص</Button><Button size="sm" variant="secondary" onClick={() => setContractFor(n.id)}>عقد</Button></span>}>
            {db.contracts.filter((c) => c.needId === n.id).map((c) => {
              const paid = c.payments.filter((p) => p.paidAt).reduce((s, p) => s + p.amount, 0);
              return (
                <div key={c.id} className="mb-2 rounded-xl border border-ink-100 p-3 text-sm">
                  <div className="flex flex-wrap justify-between gap-2"><b>{c.title} — {c.vendor}</b><Badge tone={paid >= c.total ? 'green' : 'orange'}>{paid >= c.total ? 'مقفل بالكامل' : `مدفوع ${SAR(paid)} من ${SAR(c.total)}`}</Badge></div>
                  <ul className="mt-2 space-y-1 text-xs">
                    {c.payments.map((p, i) => (
                      <li key={p.id} className="flex flex-wrap items-center justify-between gap-2">
                        <span>الدفعة {i + 1}: <span className="num">{SAR(p.amount)}</span> · موعدها {fmtDate(p.dueDate)}</span>
                        {p.paidAt ? <AttachmentView a={p.attachment} compact /> : canAct && <Button size="sm" variant="secondary" onClick={() => setPaying({ contractId: c.id, paymentId: p.id })}>ادفع بفاتورة</Button>}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
            {db.custodies.filter((c) => c.ownerKind === 'need' && c.ownerId === n.id).map((c) => <CustodyCard key={c.id} custody={c} embedded />)}
          </Card>
        );
      })}
      <Card title="الافتتاحي والختامي" subtitle="صرف مباشر من تبويبه، أو عهدة لشخص يقفلها">
        <ul className="space-y-2">
          {milestones.map((t) => <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 text-sm"><span>{t.title} <span className="text-xs text-ink-500">· المصروف {SAR(activitySpend(db, 'trip', t.id).total)}</span></span>{canAct && <Button size="sm" variant="secondary" onClick={() => setCustodyFor({ ownerKind: 'trip', ownerId: t.id })}>عهدة لشخص</Button>}</li>)}
        </ul>
      </Card>
      {contractFor && <ContractModal needId={contractFor} onClose={() => setContractFor(null)} />}
      {custodyFor && <IssueCustodyModal {...custodyFor} onClose={() => setCustodyFor(null)} />}
      <Modal open={!!paying} onClose={() => setPaying(null)} title="دفع دفعة العقد" footer={<Button disabled={!payAtt} onClick={() => act(() => { repos.finance.payContract(paying!.contractId, paying!.paymentId, payAtt!); setPaying(null); setPayAtt(undefined); }, 'سُجّلت الدفعة')}>ادفع</Button>}>
        <AttachmentInput value={payAtt} onChange={setPayAtt} label="فاتورة الدفعة أو إيصال تحويلها (إلزامي)" />
      </Modal>
    </div>
  );
}
function ContractModal({ needId, onClose }: { needId: string; onClose: () => void }) {
  const [f, setF] = useState({ vendor: '', title: '', total: 0 });
  const [payments, setPayments] = useState([{ amount: 0, dueDate: todayISO() }]);
  const sum = payments.reduce((s, p) => s + p.amount, 0);
  return (
    <Modal open onClose={onClose} title="عقد جديد" footer={<Button onClick={() => act(() => { repos.finance.createContract({ needId, ...f, payments }); onClose(); }, 'أُنشئ العقد')}>أنشئ العقد</Button>}>
      <div className="grid gap-3">
        <Field label="موضوع العقد"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="المورد"><Input value={f.vendor} onChange={(e) => setF({ ...f, vendor: e.target.value })} /></Field>
        <Field label="القيمة الإجمالية"><Input className="num" type="number" value={f.total || ''} onChange={(e) => setF({ ...f, total: +e.target.value })} /></Field>
        {payments.map((p, i) => (
          <div key={i} className="grid grid-cols-2 gap-2">
            <Input className="num" type="number" placeholder="مبلغ الدفعة" value={p.amount || ''} onChange={(e) => setPayments(payments.map((x, j) => (j === i ? { ...x, amount: +e.target.value } : x)))} />
            <Input type="date" value={p.dueDate} onChange={(e) => setPayments(payments.map((x, j) => (j === i ? { ...x, dueDate: e.target.value } : x)))} />
          </div>
        ))}
        <Button size="sm" variant="secondary" onClick={() => setPayments([...payments, { amount: Math.max(0, f.total - sum), dueDate: todayISO() }])}>أضف دفعة</Button>
        <p className={cx('text-xs', Math.abs(sum - f.total) < 0.01 ? 'text-emerald-700' : 'text-accent-700')}>مجموع الدفعات {SAR(sum)} من {SAR(f.total)}: يجب أن تُقفل القيمة كاملة</p>
      </div>
    </Modal>
  );
}
// ───────────── الإعدادات المالية ─────────────
function FinanceSettings() {
  const db = useDB();
  const [f, setF] = useState(structuredClone(db.settings.finance));
  return (
    <Card title="الإعدادات المالية" subtitle="قوالب يملكها مسؤول المالية">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="عدد العهد المفتوحة المتزامنة للشخص" hint="بشرط ألا يتكرر النوع (عهدة للرحلات وأخرى للقاءات التركيز مسموح)"><Input className="num" type="number" min={1} value={f.maxOpenCustodies} onChange={(e) => setF({ ...f, maxOpenCustodies: +e.target.value })} /></Field>
        <Field label="تنبيه التجزئة: الفاتورة الصغيرة حتى (ر.س)"><Input className="num" type="number" value={f.splitAlert.maxAmount} onChange={(e) => setF({ ...f, splitAlert: { ...f.splitAlert, maxAmount: +e.target.value } })} /></Field>
        <Field label="خلال (أيام)"><Input className="num" type="number" value={f.splitAlert.windowDays} onChange={(e) => setF({ ...f, splitAlert: { ...f.splitAlert, windowDays: +e.target.value } })} /></Field>
        <Field label="عدد الفواتير لنفس المورد والنشاط"><Input className="num" type="number" value={f.splitAlert.minCount} onChange={(e) => setF({ ...f, splitAlert: { ...f.splitAlert, minCount: +e.target.value } })} /></Field>
      </div>
      <Button className="mt-4" onClick={() => act(() => repos.finance.setFinanceSettings(f), 'حُفظت الإعدادات المالية')}>احفظ</Button>
    </Card>
  );
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
      <Card title="الموازنة العامة" subtitle={`المرصود ${SAR(o.total)} · المصروف ${SAR(o.spent)} · ${db.programBudget.setupDone ? 'معتمدة ومقفلة' : 'غير معدّة'}`} action={owner && <Button onClick={() => setEdit(true)} icon={<Icons.Pencil className="h-4 w-4" />}>{db.programBudget.setupDone ? 'اطلب تعديل الموازنة' : 'أعدّ الموازنة'}</Button>}>
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
      <Card title="أنواع الصرف السبعة" subtitle="لكل نوع طريقان: عهدة أو صرف مباشر">
        <div className="grid gap-2 sm:grid-cols-2">
          {ALL_SPEND_KINDS.map((k) => <div key={k} className="flex min-h-[44px] items-center justify-between rounded-xl border border-ink-100 px-3 text-sm"><span>{spendKindLabel[k]}</span><Badge>{spendKindGroup[k]}</Badge></div>)}
        </div>
      </Card>
      <Modal open={edit} onClose={() => setEdit(false)} title={db.programBudget.setupDone ? 'طلب تعديل الموازنة (يوافق عليه القائد العام)' : 'إعداد الموازنة'} wide><BudgetWizard onDone={() => setEdit(false)} onCancel={() => setEdit(false)} /></Modal>
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
  const used = (id: string) => db.spendForms.some((f) => f.lines.some((l) => l.categoryId === id)) || db.directSpends.some((x) => x.lines.some((l) => l.categoryId === id)) || db.budgetRequests.some((r) => r.lines.some((l) => l.categoryId === id));
  // ما كتبه الرافعون «غير موجود»: اقتراحات لتصنيفات جديدة
  const custom = [...new Set(db.spendForms.flatMap((f) => f.lines).filter((l) => l.customCategory && l.status === 'pending').map((l) => l.customCategory!))];
  return (
    <div className="space-y-3">
      {manage && (
        <Card>
          <div className="flex gap-2"><Input placeholder="تصنيف جديد (مثال: السكن)" value={name} onChange={(e) => setName(e.target.value)} /><Button disabled={!name.trim()} onClick={() => act(() => { repos.finance.saveCategory({ id: uid('bc'), name, items: [] }); setName(''); }, 'أُضيف التصنيف')}>أضف التصنيف</Button></div>
        </Card>
      )}
      {custom.length > 0 && <Notice tone="orange">تصنيفات مقترحة من نماذج الصرف («غير موجود»): {custom.join('، ')}. أضفها إن لزم، أو اختر لها تصنيفاً موجوداً عند المراجعة.</Notice>}
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
  const counted = (f: (typeof db.fees)[number]) => f.status === 'paid';
  const collected = db.fees.filter((f) => !f.exemption).reduce((s, f) => s + f.paidAmount, 0);
  const label = { paid: 'مسدد', partial: 'جزئي', unpaid: 'غير مسدد' } as const;
  return (
    <Card title="رسوم البرنامج" subtitle={`مسدد ${db.fees.filter(counted).length} · جزئي ${db.fees.filter((f) => f.status === 'partial').length} · غير مسدد ${db.fees.filter((f) => f.status === 'unpaid').length} · المحصّل ${SAR(collected)} · الاستثناء يُعتبر سداداً`}>
      <Table>
        <thead><tr><th>المشارك</th><th>المبلغ</th><th>المدفوع</th><th>الحالة</th><th>الاستثناء</th></tr></thead>
        <tbody>{db.fees.map((f) => <FeeRow key={f.personId} fee={f} owner={owner} label={label} />)}</tbody>
      </Table>
    </Card>
  );
}
function FeeRow({ fee: f, owner, label }: { fee: FeeRecord; owner: boolean; label: Record<FeeStatus, string> }) {
  const [paid, setPaid] = useState(f.paidAmount);
  const [ex, setEx] = useState(f.exemption ?? '');
  const save = (status: FeeStatus, patch: { paidAmount?: number; exemption?: string } = {}) => act(() => repos.finance.setFee(f.personId, { status, paidAmount: patch.paidAmount ?? paid, exemption: patch.exemption ?? ex, note: f.note }), 'حُدّثت الرسوم');
  return (
    <tr>
      <td><PersonChip id={f.personId} size={22} /></td>
      <td className="num">{SAR(f.amount)}</td>
      <td>{owner && f.status === 'partial' ? <Input className="num w-24" type="number" value={paid} onChange={(e) => setPaid(+e.target.value)} onBlur={() => paid !== f.paidAmount && save('partial', { paidAmount: paid })} /> : <span className="num">{SAR(f.paidAmount)}</span>}</td>
      <td>{owner ? <Select value={f.status} onChange={(e) => save(e.target.value as FeeStatus, { paidAmount: e.target.value === 'partial' ? Math.round(f.amount / 2) : undefined })} options={(['paid', 'partial', 'unpaid'] as FeeStatus[]).map((k) => ({ value: k, label: label[k] }))} aria-label="الحالة" /> : <Badge tone={f.status === 'paid' ? 'green' : f.status === 'partial' ? 'orange' : 'red'}>{label[f.status]}</Badge>}</td>
      <td>{owner ? <Input className="w-44" placeholder="مثل: جمعية البر" value={ex} onChange={(e) => setEx(e.target.value)} onBlur={() => ex !== (f.exemption ?? '') && save(ex.trim() ? 'paid' : f.status, { exemption: ex })} /> : <span className="text-xs">{f.exemption ?? '—'}</span>}</td>
    </tr>
  );
}

function Analysis() {
  const db = useDB();
  const [by, setBy] = useState<'category' | 'kind'>('category');
  const [kind, setKind] = useState<SpendKind | 'all'>('all');
  const lines = spentLines(db).filter((l) => kind === 'all' || l.spendKind === kind);
  const groups = by === 'category'
    ? [...new Set(lines.map((l) => categoryLabel(db, l)))].map((name) => ({ name, ls: lines.filter((l) => categoryLabel(db, l) === name) }))
    : ALL_SPEND_KINDS.map((k) => ({ name: spendKindLabel[k], ls: lines.filter((l) => l.spendKind === k) }));
  const rows = groups.map((g) => ({ ...g, spent: Math.round(g.ls.reduce((s, l) => s + l.amount, 0) * 100) / 100 })).filter((x) => x.spent > 0).sort((a, b) => b.spent - a.spent);
  const max = Math.max(1, ...rows.map((x) => x.spent));
  const tripLines = spentLines(db).filter((l) => l.ownerKind === 'trip').sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div className="space-y-4">
      <Card title="الصرف الفعلي" subtitle="من البنود المعتمدة في العهد + الصرف المباشر (بحسب التوزيع) + دفعات العقود"
        action={<span className="flex gap-2"><Select value={by} onChange={(e) => setBy(e.target.value as 'category' | 'kind')} options={[{ value: 'category', label: 'حسب التصنيف' }, { value: 'kind', label: 'حسب نوع الصرف' }]} aria-label="الفرز" /><Select value={kind} onChange={(e) => setKind(e.target.value as SpendKind | 'all')} options={[{ value: 'all', label: 'كل الأنواع' }, ...ALL_SPEND_KINDS.map((k) => ({ value: k, label: spendKindLabel[k] }))]} aria-label="النوع" /></span>}>
        {rows.length === 0 ? <Empty title="لا صرف معتمد بعد" /> : (
          <div className="space-y-4">
            {rows.map(({ name, spent, ls }) => (
              <div key={name}>
                <div className="mb-1 flex justify-between text-sm"><b>{name}</b><span className="num">{SAR(spent)}</span></div>
                <div className="h-2.5 overflow-hidden rounded-full bg-ink-100"><div className="h-full bg-brand-grad" style={{ width: `${(spent / max) * 100}%` }} /></div>
                <details className="mt-1 text-[11px] text-ink-500"><summary className="cursor-pointer">حسب النشاط</summary>{[...new Set(ls.map((l) => ownerTitle(db, l.ownerKind, l.ownerId)))].map((t) => <div key={t} className="flex justify-between"><span>{t}</span><span className="num">{SAR(ls.filter((l) => ownerTitle(db, l.ownerKind, l.ownerId) === t).reduce((s, l) => s + l.amount, 0))}</span></div>)}</details>
              </div>
            ))}
          </div>
        )}
      </Card>
      <Card pad={false} title="جدول فواتير الرحلات" subtitle="كل بند معتمد بمورده وفاتورته ومصدره (عهدة أو مباشر)">
        <Table>
          <thead><tr><th>الرحلة</th><th>التاريخ</th><th>المورد</th><th>البند</th><th>التصنيف</th><th>المصدر</th><th>الفاتورة</th><th>المبلغ</th></tr></thead>
          <tbody>{tripLines.map((l, i) => <tr key={i}><td className="text-xs">{ownerTitle(db, l.ownerKind, l.ownerId)}</td><td className="text-xs">{fmtDate(l.date)}</td><td className="text-xs">{l.vendor}</td><td className="text-xs">{l.item}</td><td className="text-xs">{categoryLabel(db, l)}</td><td><Badge>{{ custody: 'عهدة', direct: 'مباشر', contract: 'عقد' }[l.source]}</Badge></td><td><AttachmentView a={l.attachment} compact /></td><td className="num">{SAR(l.amount)}</td></tr>)}</tbody>
        </Table>
      </Card>
    </div>
  );
}
