// الجانب المالي (قسم 11): البنود، العهد، الفواتير، طلبات الميزانية، الرسوم، التحليل
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { addDays, fmtDate, todayISO } from '@/domain/dates';
import { uid } from '@/domain/id';
import { SAR, custodyStatusLabel, custodyStatusTone } from '@/domain/labels';
import { canManageFinance, canSeeFinance, tripTeamLeaderId } from '@/domain/permissions';
import { budgetTotal, custodyFigures, custodyOwnerTitle, isApproved } from '@/domain/workflow';
import type { BudgetOwnerKind } from '@/domain/types';
import { act, personName, repos, useDB, useMe } from '@/state/store';
import { Badge, Button, Card, Empty, Field, Icons, Input, Modal, Notice, PageHeader, Progress, ReasonModal, Select, Table, Tabs, Toggle, cx } from '@/ui';
import { PersonChip } from '@/ui/domain';
import { BudgetEditor } from './BudgetEditor';
import { CustodyCard } from './CustodyCard';

type Tab = 'custody' | 'invoices' | 'focus' | 'categories' | 'fees' | 'analysis';

export default function FinancePage() {
  const db = useDB();
  const me = useMe();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'custody';
  const manage = canManageFinance(db, me.person.id);
  if (!canSeeFinance(db, me.person.id)) return <Empty title="البيانات المالية لأعضاء اللجنة المالية والقائد العام فقط" />;
  const pendingInv = db.invoices.filter((i) => i.status === 'pending').length;
  const pendingFocus = db.focusMeetings.filter((f) => f.budget.status === 'pending').length;
  return (
    <div>
      <PageHeader title="المالية" subtitle={manage ? 'مسؤول اللجنة المالية يملك الإعداد المالي كله' : 'عرض للقائد العام (الإدارة المالية للجنة المالية)'} />
      {me.isLeader && (
        <Card className="mb-4">
          <Toggle checked={db.settings.budgetVisibleToStaff} onChange={(v) => act(() => repos.settings.update({ budgetVisibleToStaff: v }), v ? 'أصبحت الموازنة التقديرية ظاهرة لأعضاء الإدارة' : 'أُخفيت الموازنة عن أعضاء الإدارة')} label="عرض الموازنة التقديرية لأعضاء الإدارة" />
          <p className="mt-1 text-xs text-ink-400">المبالغ المصروفة والبنود التفصيلية تبقى للجنة المالية دائماً.</p>
        </Card>
      )}
      <Tabs value={tab} onChange={(t) => setParams({ tab: t })} tabs={[
        { key: 'custody', label: 'العهد' },
        { key: 'invoices', label: 'مراجعة الفواتير', badge: pendingInv ? <span className="num rounded-full bg-accent-500 px-1.5 text-[10px] text-white">{pendingInv}</span> : undefined },
        { key: 'focus', label: 'ميزانيات لقاءات التركيز', badge: pendingFocus ? <span className="num rounded-full bg-accent-500 px-1.5 text-[10px] text-white">{pendingFocus}</span> : undefined },
        { key: 'categories', label: 'البنود الرئيسية' },
        { key: 'fees', label: 'رسوم المشاركين' },
        { key: 'analysis', label: 'التحليل المالي' },
      ]} />
      {tab === 'custody' && <CustodyTab manage={manage} />}
      {tab === 'invoices' && <InvoicesTab manage={manage} />}
      {tab === 'focus' && <FocusBudgets manage={manage} />}
      {tab === 'categories' && <Categories manage={manage} />}
      {tab === 'fees' && <Fees manage={manage} />}
      {tab === 'analysis' && <Analysis />}
    </div>
  );
}

function CustodyTab({ manage }: { manage: boolean }) {
  const db = useDB();
  const [issuing, setIssuing] = useState<{ kind: BudgetOwnerKind; id: string; recipient: string; total: number; title: string } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const due = [
    ...db.trips.filter((t) => isApproved(db, t.id, 'budget') && !db.custodies.some((c) => c.ownerKind === 'trip' && c.ownerId === t.id))
      .map((t) => ({ kind: 'trip' as const, id: t.id, recipient: tripTeamLeaderId(db, t)!, total: budgetTotal(db.tripBudgets.find((b) => b.tripId === t.id)?.lines ?? []), title: t.title })),
    ...db.focusMeetings.filter((f) => (f.budget.status === 'accepted' || f.budget.status === 'accepted_lower') && !db.custodies.some((c) => c.ownerKind === 'focus' && c.ownerId === f.id) && f.status !== 'closed')
      .map((f) => ({ kind: 'focus' as const, id: f.id, recipient: f.createdBy, total: f.budget.approvedAmount ?? budgetTotal(f.budget.lines), title: f.title })),
  ];
  return (
    <div className="space-y-6">
      {due.length > 0 && (
        <Card title="بانتظار صرف عهدة" subtitle="بعد اعتماد الموازنة يصل مسؤول المالية تنبيه بصرف عهدة">
          <div className="space-y-2">
            {due.map((d) => (
              <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-accent-200 bg-accent-50/50 px-3 py-2">
                <div className="text-sm"><b>{d.title}</b> · <span className="num">{SAR(d.total)}</span> · المستلم: {personName(db, d.recipient)}</div>
                {manage && <Button size="sm" onClick={() => setIssuing(d)}>صرف عهدة</Button>}
              </div>
            ))}
          </div>
        </Card>
      )}
      <Card pad={false} title="كل العهد">
        <div className="divide-y divide-ink-100">
          {db.custodies.map((c) => {
            const f = custodyFigures(db, c);
            return (
              <div key={c.id}>
                <button onClick={() => setOpen(open === c.id ? null : c.id)} className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-start hover:bg-ink-50 sm:px-5">
                  <div className="min-w-0 flex-1"><div className="text-sm font-medium">{custodyOwnerTitle(db, c)}</div><div className="text-xs text-ink-500">{c.ownerKind === 'trip' ? 'رحلة' : 'لقاء تركيز'} · {personName(db, c.recipientId)} · {c.installments.length > 1 ? `${c.installments.length} دفعات` : 'دفعة واحدة'}</div></div>
                  <div className="w-40"><Progress value={(f.accepted / (c.total || 1)) * 100} /><div className="num mt-0.5 text-[11px] text-ink-400">{SAR(f.accepted)} من {SAR(c.total)}</div></div>
                  <Badge tone={custodyStatusTone[c.status]}>{custodyStatusLabel[c.status]}</Badge>
                  <Icons.ChevronDown className={cx('h-4 w-4 transition', open === c.id && 'rotate-180')} />
                </button>
                {open === c.id && <div className="bg-ink-50/50 p-3"><CustodyCard custody={c} /></div>}
              </div>
            );
          })}
        </div>
      </Card>
      {issuing && <IssueModal d={issuing} onClose={() => setIssuing(null)} />}
    </div>
  );
}

function IssueModal({ d, onClose }: { d: { kind: BudgetOwnerKind; id: string; recipient: string; total: number; title: string }; onClose: () => void }) {
  const db = useDB();
  const [recipient, setRecipient] = useState(d.recipient);
  const [inst, setInst] = useState([{ amount: d.total, dueDate: addDays(todayISO(), 2), condition: 'بعد اعتماد الموازنة' }]);
  const total = inst.reduce((s, i) => s + i.amount, 0);
  return (
    <Modal open onClose={onClose} title={`صرف عهدة: ${d.title}`} wide footer={<><Button variant="secondary" onClick={onClose}>إلغاء</Button><Button onClick={() => act(() => { repos.finance.createCustody({ ownerKind: d.kind, ownerId: d.id, recipientId: recipient, installments: inst }); onClose(); }, 'صُرفت العهدة ووصل المستلم تنبيه برفع الآيبان')}>صرف</Button></>}>
      <div className="grid gap-3">
        <Field label="المستلم (المسؤول الكامل عن العهدة)" hint={d.kind === 'trip' ? 'الرحلات: قائد المجموعة أو قائد فريق الرحلة' : 'لقاءات التركيز: الميسّر'}>
          <Select value={recipient} onChange={(e) => setRecipient(e.target.value)} options={db.persons.map((p) => ({ value: p.id, label: p.name }))} />
        </Field>
        <div className="text-sm font-bold">الدفعات</div>
        {inst.map((i, idx) => (
          <div key={idx} className="grid gap-2 sm:grid-cols-[120px_160px_1fr_24px]">
            <Input type="number" value={i.amount} onChange={(e) => setInst(inst.map((x, j) => (j === idx ? { ...x, amount: +e.target.value } : x)))} />
            <Input type="date" value={i.dueDate} onChange={(e) => setInst(inst.map((x, j) => (j === idx ? { ...x, dueDate: e.target.value } : x)))} />
            <Input placeholder="الشرط (مثال: بعد بداية الرحلة)" value={i.condition} onChange={(e) => setInst(inst.map((x, j) => (j === idx ? { ...x, condition: e.target.value } : x)))} />
            {inst.length > 1 && <button onClick={() => setInst(inst.filter((_, j) => j !== idx))}><Icons.X className="h-4 w-4 text-ink-300" /></button>}
          </div>
        ))}
        <Button size="sm" variant="secondary" onClick={() => setInst([...inst, { amount: 0, dueDate: addDays(todayISO(), 10), condition: 'بعد بداية الرحلة' }])}>+ دفعة</Button>
        <div className={cx('text-sm', total !== d.total && 'text-accent-700')}>المجموع {SAR(total)} {total !== d.total && `(الموازنة المعتمدة ${SAR(d.total)})`}</div>
      </div>
    </Modal>
  );
}

function InvoicesTab({ manage }: { manage: boolean }) {
  const db = useDB();
  const [rej, setRej] = useState<string | null>(null);
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const list = db.invoices.filter((i) => filter === 'all' || i.status === 'pending');
  return (
    <Card pad={false} title="الفواتير" action={<Select className="w-36" value={filter} onChange={(e) => setFilter(e.target.value as 'pending' | 'all')} options={[{ value: 'pending', label: 'المعلقة' }, { value: 'all', label: 'الكل' }]} />}>
      {list.length === 0 ? <div className="p-5"><Empty title="لا فواتير معلقة" /></div> : (
        <Table>
          <thead><tr><th>العهدة</th><th>البند</th><th>البيان</th><th>المبلغ</th><th>الرافع</th><th>الحالة</th><th /></tr></thead>
          <tbody>
            {list.map((i) => {
              const c = db.custodies.find((x) => x.id === i.custodyId)!;
              return (
                <tr key={i.id}>
                  <td className="text-xs">{custodyOwnerTitle(db, c)}</td>
                  <td>{db.budgetCategories.find((x) => x.id === i.categoryId)?.name}</td>
                  <td>{i.statement}<div className="text-[11px] text-brand-600"><Icons.Image className="me-1 inline h-3 w-3" />{i.image}</div></td>
                  <td className="num">{SAR(i.amount)}</td>
                  <td><PersonChip id={i.uploadedBy} size={20} /></td>
                  <td><Badge tone={i.status === 'accepted' ? 'green' : i.status === 'rejected' ? 'red' : 'orange'}>{{ accepted: 'مقبولة', rejected: 'مرفوضة', pending: 'معلقة' }[i.status]}</Badge></td>
                  <td>{manage && i.status === 'pending' && <span className="flex gap-1"><Button size="sm" variant="success" onClick={() => act(() => repos.finance.reviewInvoice(i.id, true), 'قُبلت')}>قبول</Button><Button size="sm" variant="danger" onClick={() => setRej(i.id)}>رفض</Button></span>}</td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
      <ReasonModal open={!!rej} onClose={() => setRej(null)} title="رفض الفاتورة" onSubmit={(r) => act(() => repos.finance.reviewInvoice(rej!, false, r), 'رُفضت وأُعيدت للمستلم')} />
    </Card>
  );
}

function FocusBudgets({ manage }: { manage: boolean }) {
  const db = useDB();
  const [lower, setLower] = useState<{ id: string; amount: number; note: string } | null>(null);
  const [revise, setRevise] = useState<string | null>(null);
  const list = db.focusMeetings.filter((f) => f.budget.lines.length > 0).sort((a, b) => Number(b.budget.status === 'pending') - Number(a.budget.status === 'pending'));
  return (
    <div className="space-y-3">
      <Notice>عند إنشاء اللقاء يسجل الميسّر المكان والتاريخ والميزانية التقديرية. اللجنة تقبل، أو تطلب تعديل البنود، أو تقبل بمبلغ أقل.</Notice>
      {list.map((f) => (
        <Card key={f.id} title={<span className="flex items-center gap-2">{f.title}{f.isUmrah && <Badge tone="green">العمرة</Badge>}</span>} subtitle={`${db.groups.find((g) => g.id === f.groupId)?.name} · ${fmtDate(f.date)} · ${f.location ?? ''}`}
          action={<Badge tone={f.budget.status === 'pending' ? 'orange' : f.budget.status === 'revise' ? 'red' : 'green'}>{{ none: '—', pending: 'بانتظار القرار', accepted: 'مقبولة', revise: 'طُلب تعديل', accepted_lower: `مقبولة بـ ${SAR(f.budget.approvedAmount ?? 0)}` }[f.budget.status]}</Badge>}>
          <BudgetEditor lines={f.budget.lines} ownerKind="focus" readOnly />
          {manage && f.budget.status === 'pending' && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="success" onClick={() => act(() => repos.focus.financeDecision(f.id, 'accepted', budgetTotal(f.budget.lines)), 'قُبلت الميزانية')}>قبول</Button>
              <Button variant="secondary" onClick={() => setRevise(f.id)}>طلب تعديل البنود</Button>
              <Button variant="secondary" onClick={() => setLower({ id: f.id, amount: Math.round(budgetTotal(f.budget.lines) * 0.8), note: '' })}>قبول بمبلغ أقل</Button>
            </div>
          )}
        </Card>
      ))}
      <ReasonModal open={!!revise} onClose={() => setRevise(null)} title="طلب تعديل البنود" label="ما المطلوب تعديله؟" danger={false} onSubmit={(r) => act(() => repos.focus.financeDecision(revise!, 'revise', undefined, r), 'أُعيدت للميسّر')} />
      <Modal open={!!lower} onClose={() => setLower(null)} title="قبول بمبلغ أقل" footer={<Button onClick={() => act(() => { repos.focus.financeDecision(lower!.id, 'accepted_lower', lower!.amount, lower!.note); setLower(null); }, 'قُبلت بمبلغ أقل')}>اعتماد</Button>}>
        {lower && <div className="grid gap-3"><Field label="المبلغ المعتمد"><Input type="number" value={lower.amount} onChange={(e) => setLower({ ...lower, amount: +e.target.value })} /></Field><Field label="ملاحظة"><Input value={lower.note} onChange={(e) => setLower({ ...lower, note: e.target.value })} /></Field></div>}
      </Modal>
    </div>
  );
}

function Categories({ manage }: { manage: boolean }) {
  const db = useDB();
  const [name, setName] = useState('');
  const kinds: { k: BudgetOwnerKind; l: string }[] = [{ k: 'trip', l: 'الرحلات' }, { k: 'focus', l: 'لقاءات التركيز' }, { k: 'individual', l: 'اللقاءات الفردية' }];
  return (
    <Card title="البنود الرئيسية للميزانية" subtitle="يحددها مسؤول المالية. لكل نوع بنوده. المجموعات لا تضيف بنداً رئيسياً">
      <Table>
        <thead><tr><th>البند</th>{kinds.map((k) => <th key={k.k}>{k.l}</th>)}{manage && <th />}</tr></thead>
        <tbody>
          {db.budgetCategories.map((c) => (
            <tr key={c.id}>
              <td>{manage ? <Input className="py-1" defaultValue={c.name} onBlur={(e) => e.target.value !== c.name && act(() => repos.finance.saveCategory({ ...c, name: e.target.value }), 'عُدّل البند')} /> : c.name}</td>
              {kinds.map((k) => (
                <td key={k.k}><input type="checkbox" disabled={!manage} checked={c.appliesTo.includes(k.k)} onChange={(e) => repos.finance.saveCategory({ ...c, appliesTo: e.target.checked ? [...c.appliesTo, k.k] : c.appliesTo.filter((x) => x !== k.k) })} className="h-4 w-4 accent-brand-600" /></td>
              ))}
              {manage && <td><button onClick={() => act(() => repos.finance.removeCategory(c.id), 'حُذف البند')} className="text-ink-300 hover:text-red-600"><Icons.Trash2 className="h-4 w-4" /></button></td>}
            </tr>
          ))}
        </tbody>
      </Table>
      {manage && <div className="mt-3 flex gap-2"><Input placeholder="بند رئيسي جديد" value={name} onChange={(e) => setName(e.target.value)} /><Button disabled={!name} onClick={() => act(() => { repos.finance.saveCategory({ id: uid('bc'), name, appliesTo: ['trip', 'focus'] }); setName(''); }, 'أُضيف البند')}>إضافة</Button></div>}
    </Card>
  );
}

function Fees({ manage }: { manage: boolean }) {
  const db = useDB();
  const paid = db.fees.filter((f) => f.paid);
  return (
    <Card title="رسوم البرنامج" subtitle={db.settings.feesInPlatform ? 'الدفع داخل المنصة (غير مفعّل في النموذج)' : 'تُسجَّل فقط (الدفع خارج المنصة)'}>
      <div className="mb-4 grid grid-cols-3 gap-3 text-center">
        <div className="rounded-xl bg-emerald-50 p-3"><div className="num text-xl font-bold text-emerald-700">{paid.length}</div><div className="text-xs">سدّدوا</div></div>
        <div className="rounded-xl bg-red-50 p-3"><div className="num text-xl font-bold text-red-700">{db.fees.length - paid.length}</div><div className="text-xs">لم يسدّدوا</div></div>
        <div className="rounded-xl bg-ink-50 p-3"><div className="num text-xl font-bold">{SAR(paid.reduce((s, f) => s + f.amount, 0))}</div><div className="text-xs">المحصّل</div></div>
      </div>
      <Table>
        <thead><tr><th>المشارك</th><th>المبلغ</th><th>الحالة</th><th>تاريخ السداد</th></tr></thead>
        <tbody>
          {db.fees.map((f) => (
            <tr key={f.personId}>
              <td><PersonChip id={f.personId} size={22} /></td>
              <td className="num">{SAR(f.amount)}</td>
              <td>{manage ? <Toggle checked={f.paid} onChange={(v) => repos.finance.setFee(f.personId, v)} label={<span className="text-xs">{f.paid ? 'مسدّد' : 'غير مسدّد'}</span>} /> : <Badge tone={f.paid ? 'green' : 'red'}>{f.paid ? 'مسدّد' : 'غير مسدّد'}</Badge>}</td>
              <td className="text-xs">{f.paidAt ? fmtDate(f.paidAt) : '—'}</td>
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
  const byCat = db.budgetCategories.map((c) => {
    const inv = accepted.filter((i) => i.categoryId === c.id);
    const planned = db.tripBudgets.flatMap((b) => b.lines).concat(db.focusMeetings.flatMap((f) => f.budget.lines)).filter((l) => l.categoryId === c.id);
    const bySource = db.custodies.map((cu) => ({ title: custodyOwnerTitle(db, cu), kind: cu.ownerKind, amount: inv.filter((i) => i.custodyId === cu.id).reduce((s, i) => s + i.amount, 0) })).filter((x) => x.amount > 0);
    return { c, spent: inv.reduce((s, i) => s + i.amount, 0), planned: budgetTotal(planned), bySource };
  }).filter((x) => x.spent || x.planned);
  const max = Math.max(1, ...byCat.map((x) => Math.max(x.spent, x.planned)));
  const totalSpent = accepted.reduce((s, i) => s + i.amount, 0);
  const byKind = (['trip', 'focus', 'individual'] as const).map((k) => ({ k, v: accepted.filter((i) => db.custodies.find((c) => c.id === i.custodyId)?.ownerKind === k).reduce((s, i) => s + i.amount, 0) }));
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card title="الصرف حسب البند على مستوى البرنامج" subtitle="المصروف المعتمد مقابل المخطط في الموازنات" className="lg:col-span-2">
        <div className="space-y-4">
          {byCat.map(({ c, spent, planned, bySource }) => (
            <div key={c.id}>
              <div className="mb-1 flex justify-between text-sm"><b>{c.name}</b><span className="num text-ink-500">{SAR(spent)} من {SAR(planned)}</span></div>
              <div className="h-2.5 overflow-hidden rounded-full bg-ink-100"><div className="h-full bg-brand-grad" style={{ width: `${(spent / max) * 100}%` }} /></div>
              <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-ink-100"><div className="h-full bg-accent-300" style={{ width: `${(planned / max) * 100}%` }} /></div>
              {bySource.length > 0 && <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-ink-500">{bySource.map((s) => <span key={s.title}>{s.title}: <span className="num">{SAR(s.amount)}</span></span>)}</div>}
            </div>
          ))}
          <div className="flex gap-4 text-[11px] text-ink-500"><span className="inline-flex items-center gap-1"><span className="h-2 w-4 rounded bg-brand-500" />المصروف</span><span className="inline-flex items-center gap-1"><span className="h-2 w-4 rounded bg-accent-300" />المخطط</span></div>
        </div>
      </Card>
      <Card title="حسب النوع">
        <div className="num text-2xl font-black">{SAR(totalSpent)}</div>
        <div className="mb-4 text-xs text-ink-500">إجمالي المصروف المعتمد</div>
        {byKind.map(({ k, v }) => (
          <div key={k} className="mb-3"><div className="flex justify-between text-sm"><span>{{ trip: 'الرحلات', focus: 'لقاءات التركيز', individual: 'اللقاءات الفردية' }[k]}</span><span className="num">{SAR(v)}</span></div><Progress value={(v / (totalSpent || 1)) * 100} /></div>
        ))}
      </Card>
    </div>
  );
}
