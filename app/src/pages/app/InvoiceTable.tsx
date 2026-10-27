// مراجعة الفواتير: جدول واحد، صف لكل بند صرف. مكوّن واحد يظهر في «مراجعة الفواتير» وداخل بطاقة العهدة.
// - التعديل من الصف على التصنيف والمبلغ فقط، ويبقى سطر «عدّلته المالية: كان…».
// - لكل صف: اعتمد أو ارفض (بسبب)، والمعتمد: «طلب تعديل» يذهب للقائد العام. لا اعتماد جماعي.
// - المراجع لا يرى أزرار المراجعة على عهدته الشخصية.
// - على الجوال: كل صف بطاقة مضغوطة بنفس الحقول.
import { useState } from 'react';
import { fmtDate } from '@/domain/dates';
import { canViewBudget, hasFinancePerm, ownerTitle } from '@/domain/finance';
import { SAR } from '@/domain/labels';
import { custodyFigures, formDuplicateWarnings, splitWarning } from '@/domain/ledger';
import type { Custody, SpendForm, SpendLine } from '@/domain/types';
import { act, personName, repos, useDB, useMe } from '@/state/store';
import { Badge, Button, Empty, Field, FilterPills, Icons, Input, Modal, Notice, ReasonModal, Select, Table, cx } from '@/ui';
import { AttachmentView } from '@/ui/attachments';
import { categoryLabel } from './CustodyCard';
import { EditRequestButton } from './EditRequest';

type Status = SpendLine['status'];
const statusLabel: Record<Status, string> = { pending: 'بانتظار المراجعة', accepted: 'معتمد', rejected: 'مرفوض' };
const statusTone: Record<Status, 'orange' | 'green' | 'red'> = { pending: 'orange', accepted: 'green', rejected: 'red' };

interface Alert { kind: 'duplicate' | 'split' | 'serial'; text: string }
interface Row { line: SpendLine; form: SpendForm; custody: Custody; alerts: Alert[] }

/** تنبيهات النموذج: تكرار (البصمة أو الرقم أو المورد مع التاريخ والمبلغ)، وتجزئة، وبلا رقم تسلسلي */
function formAlerts(db: ReturnType<typeof useDB>, f: SpendForm): Alert[] {
  const out: Alert[] = formDuplicateWarnings(db, f).map((text) => ({ kind: 'duplicate' as const, text }));
  const split = splitWarning(db, f);
  if (split) out.push({ kind: 'split', text: split });
  if (!f.serial) out.push({ kind: 'serial', text: 'الفاتورة بلا رقم تسلسلي: أدخله يدوياً من زر الفاتورة.' });
  return out;
}
const alertIcon = { duplicate: Icons.Copy, split: Icons.Split, serial: Icons.Hash };
const alertLabel = { duplicate: 'تكرار', split: 'تجزئة', serial: 'بلا رقم تسلسلي' };

/**
 * forms: النماذج المعروضة. inCustody: داخل بطاقة العهدة (بلا عمودي النشاط وصاحب العهدة وبلا فلاتر)
 */
export function InvoiceTable({ forms, inCustody, defaultStatus = 'all' }: { forms: SpendForm[]; inCustody?: boolean; defaultStatus?: Status | 'all' }) {
  const db = useDB();
  const me = useMe();
  const pid = me.person.id;
  const seesAlerts = hasFinancePerm(db, pid, 'review_invoices') || canViewBudget(db, pid);
  const custodyOf = (f: SpendForm) => db.custodies.find((c) => c.id === f.custodyId)!;
  const all: Row[] = forms.flatMap((form) => {
    const custody = custodyOf(form);
    const alerts = seesAlerts ? formAlerts(db, form) : [];
    return form.lines.map((line) => ({ line, form, custody, alerts }));
  });

  // الفلاتر (أقراص): النشاط، صاحب العهدة، الحالة، من عليه تنبيه
  const [activity, setActivity] = useState('all');
  const [holder, setHolder] = useState('all');
  const [status, setStatus] = useState<Status | 'all'>(defaultStatus);
  const [alerted, setAlerted] = useState<'all' | 'yes'>('all');
  const actKey = (c: Custody) => `${c.ownerKind}:${c.ownerId}`;
  const activities = [...new Map(all.map((r) => [actKey(r.custody), ownerTitle(db, r.custody.ownerKind, r.custody.ownerId)])).entries()];
  const holders = [...new Set(all.map((r) => r.custody.recipientId))];
  const rows = all.filter((r) => (activity === 'all' || actKey(r.custody) === activity) && (holder === 'all' || r.custody.recipientId === holder)
    && (status === 'all' || r.line.status === status) && (alerted === 'all' || r.alerts.length > 0));
  const groups = forms.map((f) => ({ form: f, custody: custodyOf(f), rows: rows.filter((r) => r.form.id === f.id) })).filter((g) => g.rows.length);
  const count = (s: Status) => all.filter((r) => r.line.status === s).length;

  return (
    <div className="space-y-4">
      {!inCustody && (
        <div className="space-y-2">
          <FilterPills label="الحالة" value={status} onChange={setStatus} options={[{ key: 'pending', label: `بانتظار (${count('pending')})` }, { key: 'accepted', label: `معتمد (${count('accepted')})` }, { key: 'rejected', label: `مرفوض (${count('rejected')})` }, { key: 'all', label: 'الكل' }]} />
          <FilterPills label="النشاط" value={activity} onChange={setActivity} options={[{ key: 'all', label: 'الكل' }, ...activities.map(([key, label]) => ({ key, label }))]} />
          <FilterPills label="صاحب العهدة" value={holder} onChange={setHolder} options={[{ key: 'all', label: 'الكل' }, ...holders.map((h) => ({ key: h, label: personName(db, h) }))]} />
          {seesAlerts && <FilterPills label="التنبيه" value={alerted} onChange={setAlerted} options={[{ key: 'all', label: 'الكل' }, { key: 'yes', label: `عليه تنبيه (${all.filter((r) => r.alerts.length).length})` }]} />}
        </div>
      )}
      {groups.length === 0 ? (
        <Empty title={status === 'pending' ? 'لا بنود بانتظار المراجعة' : 'لا بنود هنا'} text="كل بند يُراجَع وحده: يُعدَّل التصنيف والمبلغ ثم يُعتمد أو يُرفض." icon={<Icons.ReceiptText className="h-7 w-7" />} />
      ) : (
        <>
          {/* الشاشة الكبيرة: جدول بصف لكل بند، ورأس لكل نموذج فيه مجموعه ورصيد العهدة */}
          <div className="hidden md:block">
            <Table minWidth={inCustody ? 820 : 1080}>
              <thead>
                <tr>
                  {!inCustody && <th>النشاط</th>}
                  {!inCustody && <th>صاحب العهدة</th>}
                  <th>المورد والتاريخ</th><th>التصنيف</th><th>البند</th><th>المبلغ</th><th>الفاتورة</th>{seesAlerts && <th>تنبيه</th>}<th>الحالة</th><th>الإجراء</th>
                </tr>
              </thead>
              {groups.map((g) => (
                <tbody key={g.form.id}>
                  <tr className="bg-brand-50/50 hover:bg-brand-50/50">
                    <td colSpan={(inCustody ? 7 : 9) + (seesAlerts ? 1 : 0)} className="!py-2">
                      <GroupHead form={g.form} custody={g.custody} inCustody={inCustody} />
                    </td>
                  </tr>
                  {g.rows.map((r) => <LineRow key={r.line.id} row={r} inCustody={inCustody} seesAlerts={seesAlerts} />)}
                </tbody>
              ))}
            </Table>
          </div>
          {/* الجوال: رأس النموذج ثم بطاقة مضغوطة لكل بند بنفس الحقول */}
          <div className="space-y-4 md:hidden">
            {groups.map((g) => (
              <section key={g.form.id} className="space-y-2">
                <div className="rounded-2xl bg-brand-50/60 px-4 py-3"><GroupHead form={g.form} custody={g.custody} inCustody={inCustody} /></div>
                {g.rows.map((r) => <LineCard key={r.line.id} row={r} inCustody={inCustody} seesAlerts={seesAlerts} />)}
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** رأس المجموعة: النموذج ومجموعه، ورصيد العهدة والمتاح منها */
function GroupHead({ form: f, custody: c, inCustody }: { form: SpendForm; custody: Custody; inCustody?: boolean }) {
  const db = useDB();
  const fig = custodyFigures(db, c);
  const total = f.lines.reduce((s, l) => s + l.amount, 0);
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs">
      <span className="font-medium text-ink-900">{inCustody ? `${f.vendor} · ${fmtDate(f.invoiceDate)}` : `${ownerTitle(db, c.ownerKind, c.ownerId)} · ${personName(db, c.recipientId)}`}</span>
      <span className="flex flex-wrap gap-x-4 gap-y-1 text-ink-600">
        <span>مجموع النموذج <b className="num text-ink-900">{SAR(total)}</b></span>
        <span>رصيد العهدة <b className="num text-ink-900">{SAR(fig.balance)}</b></span>
        <span>المتاح بعد المحجوز <b className={cx('num', fig.available < 0 ? 'text-bad-700' : 'text-ink-900')}>{SAR(fig.available)}</b></span>
      </span>
    </div>
  );
}

/** حالة الصف: مسودة التصنيف والمبلغ للمراجع، ونوافذ الرفض والفاتورة والتنبيه */
function useLine(row: Row) {
  const db = useDB();
  const me = useMe();
  const { line: l, form, custody } = row;
  // المراجع لا يرى أزرار المراجعة على عهدته الشخصية
  const reviewer = hasFinancePerm(db, me.person.id, 'review_invoices') && custody.recipientId !== me.person.id;
  const editable = reviewer && l.status === 'pending';
  const [cat, setCat] = useState(l.categoryId ?? '');
  const [amount, setAmount] = useState(l.amount);
  const [modal, setModal] = useState<'reject' | 'invoice' | 'alerts' | null>(null);
  const cats = db.budgetCategories.filter((x) => !x.hidden);
  const category = editable
    ? <Select className="min-w-[140px]" value={cat} onChange={(e) => setCat(e.target.value)} options={[{ value: '', label: l.customCategory ? `اختر بديلاً لـ «${l.customCategory}»` : '—' }, ...cats.map((x) => ({ value: x.id, label: x.name }))]} aria-label="التصنيف" />
    : <span>{categoryLabel(db, l)}</span>;
  const money = editable
    ? <Input className="num w-24" type="number" value={amount} onChange={(e) => setAmount(+e.target.value)} aria-label="المبلغ" />
    : <span className="num font-medium">{SAR(l.amount)}</span>;
  const original = l.original && <div className="mt-1 text-xs text-ink-500">عدّلته المالية: كان {categoryLabel(db, l.original)} · {SAR(l.original.amount)}</div>;
  const statusCell = (
    <div>
      <Badge tone={statusTone[l.status]}>{statusLabel[l.status]}</Badge>
      {l.reviewNote && <div className={cx('mt-1 max-w-[200px] text-xs', l.status === 'rejected' ? 'text-bad-700' : 'text-ink-500')}>{l.reviewNote}</div>}
    </div>
  );
  const invoiceBtn = (
    <button onClick={() => setModal('invoice')} className="inline-flex min-h-[44px] items-center gap-1 rounded-full px-2 text-xs font-medium text-brand-700 hover:bg-brand-50 md:min-h-[34px]">
      <Icons.FileImage className="h-4 w-4" />{form.proofKind === 'invoice' ? 'الفاتورة' : 'الإيصال'}{form.serial && <span className="num text-ink-500" dir="ltr">#{form.serial}</span>}
    </button>
  );
  const alertBtn = row.alerts.length > 0 ? (
    <button onClick={() => setModal('alerts')} className="inline-flex min-h-[44px] items-center gap-1 rounded-full px-2 text-accent-700 hover:bg-accent-50 md:min-h-[34px]" aria-label={`تنبيهات: ${row.alerts.map((a) => alertLabel[a.kind]).join('، ')}`}>
      {[...new Set(row.alerts.map((a) => a.kind))].map((k) => { const I = alertIcon[k]; return <I key={k} className="h-4 w-4" aria-hidden />; })}
    </button>
  ) : <span className="text-ink-500">—</span>;
  const actions = editable ? (
    <span className="flex flex-wrap gap-2">
      <Button size="sm" onClick={() => act(() => repos.finance.reviewLine(form.id, l.id, { accept: true, categoryId: cat || undefined, amount }), 'اعتُمد البند')}>اعتمد</Button>
      <Button size="sm" variant="danger" onClick={() => setModal('reject')}>ارفض</Button>
    </span>
  ) : l.status === 'accepted' ? (
    <EditRequestButton target={{ kind: 'spend_line', formId: form.id, lineId: l.id }} current={{ amount: l.amount, categoryId: l.categoryId }} title={l.item} />
  ) : <span className="text-ink-500">—</span>;
  const modals = (
    <>
      <ReasonModal open={modal === 'reject'} onClose={() => setModal(null)} title="ارفض البند" label="السبب (يصل لصاحب العهدة، ويُفك الحجز)" cta="ارفض البند" onSubmit={(r) => act(() => repos.finance.reviewLine(form.id, l.id, { accept: false, note: r }), 'رُفض البند')} />
      {modal === 'invoice' && <InvoiceModal form={form} reviewer={reviewer && form.lines.some((x) => x.status === 'pending')} onClose={() => setModal(null)} />}
      {modal === 'alerts' && (
        <Modal open onClose={() => setModal(null)} title="تنبيهات النموذج">
          <div className="space-y-2">{row.alerts.map((a) => <Notice key={a.text} tone="orange" icon={(() => { const I = alertIcon[a.kind]; return <I className="h-4 w-4" />; })()}><b>{alertLabel[a.kind]}:</b> {a.text}</Notice>)}</div>
        </Modal>
      )}
    </>
  );
  return { l, form, custody, category, money, original, statusCell, invoiceBtn, alertBtn, actions, modals };
}

function LineRow({ row, inCustody, seesAlerts }: { row: Row; inCustody?: boolean; seesAlerts: boolean }) {
  const db = useDB();
  const x = useLine(row);
  return (
    <tr className={cx(x.l.status === 'rejected' && 'bg-bad-50/40')}>
      {!inCustody && <td className="min-w-[150px] font-medium">{ownerTitle(db, x.custody.ownerKind, x.custody.ownerId)}</td>}
      {!inCustody && <td className="whitespace-nowrap">{personName(db, x.custody.recipientId)}</td>}
      <td className="whitespace-nowrap">{x.form.vendor}<div className="text-xs text-ink-500">{fmtDate(x.form.invoiceDate)}</div></td>
      <td>{x.category}</td>
      <td>{x.l.item}</td>
      <td className="whitespace-nowrap">{x.money}{x.original}</td>
      <td>{x.invoiceBtn}</td>
      {seesAlerts && <td>{x.alertBtn}</td>}
      <td>{x.statusCell}</td>
      <td className="whitespace-nowrap">{x.actions}{x.modals}</td>
    </tr>
  );
}

function LineCard({ row, inCustody, seesAlerts }: { row: Row; inCustody?: boolean; seesAlerts: boolean }) {
  const db = useDB();
  const x = useLine(row);
  return (
    <div className={cx('rounded-2xl border border-ink-100 bg-white p-4 shadow-card', x.l.status === 'rejected' && 'border-bad-100')}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0"><div className="font-medium text-ink-900">{x.l.item}</div><div className="text-xs text-ink-500">{inCustody ? '' : `${ownerTitle(db, x.custody.ownerKind, x.custody.ownerId)} · ${personName(db, x.custody.recipientId)} · `}{x.form.vendor} · {fmtDate(x.form.invoiceDate)}</div></div>
        {x.statusCell}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
        <div><dt className="mb-1 text-ink-500">التصنيف</dt><dd>{x.category}</dd></div>
        <div><dt className="mb-1 text-ink-500">المبلغ</dt><dd>{x.money}{x.original}</dd></div>
        <div><dt className="text-ink-500">الفاتورة</dt><dd>{x.invoiceBtn}</dd></div>
        {seesAlerts && <div><dt className="text-ink-500">تنبيه</dt><dd>{x.alertBtn}</dd></div>}
      </dl>
      <div className="mt-3 border-t border-ink-100 pt-3">{x.actions}</div>
      {x.modals}
    </div>
  );
}

/** الفاتورة: الصورة والرقم التسلسلي (حقل يدوي مع حفظ، مكان جاهز لقراءته آلياً لاحقاً) */
function InvoiceModal({ form: f, reviewer, onClose }: { form: SpendForm; reviewer: boolean; onClose: () => void }) {
  const [serial, setSerial] = useState(f.serial ?? '');
  return (
    <Modal open onClose={onClose} title={`${f.proofKind === 'invoice' ? 'فاتورة' : 'إيصال تحويل'}: ${f.vendor}`}>
      <div className="space-y-4">
        {f.attachment.preview ? <img src={f.attachment.preview} alt={f.attachment.name} className="max-h-[50vh] w-full rounded-xl border border-ink-100 object-contain" /> : <div className="flex h-40 items-center justify-center rounded-xl bg-ink-50 text-ink-500"><Icons.FileImage className="h-8 w-8" /></div>}
        <AttachmentView a={f.attachment} compact />
        <div className="text-sm text-ink-600">التاريخ {fmtDate(f.invoiceDate)}</div>
        {reviewer ? (
          <div className="flex items-end gap-2">
            <Field label="الرقم التسلسلي (يُدخل يدوياً)" className="flex-1"><Input dir="ltr" value={serial} onChange={(e) => setSerial(e.target.value)} placeholder="مكان جاهز لقراءته آلياً لاحقاً" /></Field>
            <Button variant="secondary" disabled={serial === (f.serial ?? '')} onClick={() => act(() => repos.finance.setSerial(f.id, serial), 'حُفظ الرقم')}>احفظ</Button>
          </div>
        ) : <div className="text-sm">الرقم التسلسلي: {f.serial ? <span className="num" dir="ltr">{f.serial}</span> : <Badge tone="orange">بلا رقم تسلسلي</Badge>}</div>}
      </div>
    </Modal>
  );
}
