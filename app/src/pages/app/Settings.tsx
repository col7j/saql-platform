// الإعدادات: كل القيم القابلة للتعديل مخزّنة في البيانات (قسم 0.10 والقسم 20)
import { useState } from 'react';
import { uid } from '@/domain/id';
import { notificationTypeLabel, proofTypeLabel } from '@/domain/labels';
import type { EvaluationItem, NotificationType, ProofType, Settings, TaskTemplate } from '@/domain/types';
import { act, repos, useDB, useMe } from '@/state/store';
import { Badge, Button, Card, Empty, Field, Icons, Input, Notice, PageHeader, Select, Table, Tabs, Toggle } from '@/ui';

type Tab = 'evaluation' | 'targets' | 'categories' | 'templates' | 'notifications' | 'tracker' | 'open';

export default function SettingsPage() {
  const me = useMe();
  const [tab, setTab] = useState<Tab>('evaluation');
  if (!me.isLeader) return <Empty title="الإعدادات للقائد العام" />;
  return (
    <div>
      <PageHeader title="الإعدادات" subtitle="تعديل أي قيمة هنا لا يكسر أي شاشة أو حساب: كل الحسابات تقرأ من هذه الإعدادات" />
      <Tabs value={tab} onChange={setTab} tabs={[
        { key: 'evaluation', label: 'التقييم والأوزان' }, { key: 'targets', label: 'المستهدفات والأعداد' }, { key: 'categories', label: 'تصنيفات الجدول' },
        { key: 'templates', label: 'قالب المهام التلقائية' }, { key: 'notifications', label: 'الإشعارات المهمة' }, { key: 'tracker', label: 'متابع الرحلات' }, { key: 'open', label: 'النقاط المفتوحة' },
      ]} />
      {tab === 'evaluation' && <Evaluation />}
      {tab === 'targets' && <Targets />}
      {tab === 'categories' && <Categories />}
      {tab === 'templates' && <Templates />}
      {tab === 'notifications' && <Notifications />}
      {tab === 'tracker' && <Tracker />}
      {tab === 'open' && <OpenPoints />}
    </div>
  );
}

const num = (v: string) => (isNaN(+v) ? 0 : Math.max(0, +v));

function Evaluation() {
  const db = useDB();
  const [s, setS] = useState<Settings>(structuredClone(db.settings));
  const save = () => act(() => repos.settings.update({ split: s.split, groupTripSplit: s.groupTripSplit, evaluationItems: s.evaluationItems, presentationCriteria: s.presentationCriteria, repeatPresentationFactor: s.repeatPresentationFactor, presentingMaxMultiplier: s.presentingMaxMultiplier, lateFactor: s.lateFactor, enrichmentPointsPerMaterial: s.enrichmentPointsPerMaterial }), 'حُفظت إعدادات التقييم وأُعيد حساب النقاط');
  const updItem = (key: string, p: Partial<EvaluationItem>) => setS({ ...s, evaluationItems: s.evaluationItems.map((i) => (i.key === key ? { ...i, ...p } : i)) });
  const section = (scope: 'individual' | 'group') => {
    const items = s.evaluationItems.filter((i) => i.scope === scope);
    const sum = items.filter((i) => i.enabled && i.key !== 'enrichment').reduce((a, i) => a + i.weight, 0);
    return (
      <Card title={scope === 'individual' ? `البنود الفردية (${s.split.individual}%)` : `البنود الجماعية (${s.split.group}%)`} subtitle={`مجموع الأوزان ${sum} · تُطبَّع الأوزان تلقائياً إلى النصيب الكامل`}
        action={<Button size="sm" variant="secondary" onClick={() => setS({ ...s, evaluationItems: [...s.evaluationItems, { key: uid('ev'), name: 'بند جديد', scope, weight: 10, mode: 'manual', enabled: true }] })} icon={<Icons.Plus className="h-4 w-4" />}>أضف بنداً</Button>}>
        <div className="space-y-3">
          {items.map((i) => (
            <div key={i.key} className="rounded-2xl border border-ink-100 p-3">
              <div className="grid items-end gap-2 sm:grid-cols-[1fr_90px_120px_auto_auto]">
                <Field label="البند"><Input value={i.name} onChange={(e) => updItem(i.key, { name: e.target.value })} /></Field>
                <Field label="الوزن"><Input type="number" value={i.weight} disabled={i.key === 'enrichment'} onChange={(e) => updItem(i.key, { weight: num(e.target.value) })} /></Field>
                <Field label="الطريقة"><Select value={i.mode} onChange={(e) => updItem(i.key, { mode: e.target.value as EvaluationItem['mode'] })} options={[{ value: 'auto', label: 'تلقائي' }, { value: 'manual', label: 'يدوي' }, { value: 'mixed', label: 'مختلط' }]} /></Field>
                <div className="pb-2"><Toggle checked={i.enabled} onChange={(v) => updItem(i.key, { enabled: v })} label="مفعّل" /></div>
                <button className="pb-2.5 text-ink-300 hover:text-red-600" onClick={() => setS({ ...s, evaluationItems: s.evaluationItems.filter((x) => x.key !== i.key) })}><Icons.Trash2 className="h-4 w-4" /></button>
              </div>
              {i.description && <p className="mt-1 text-[11px] text-ink-400">{i.description}</p>}
              {i.subItems && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {i.subItems.map((sub) => (
                    <label key={sub.key} className="flex items-center gap-1 rounded-lg bg-ink-50 px-2 py-1 text-xs">
                      {sub.name}
                      <input type="number" className="num w-12 rounded border border-ink-200 px-1" value={sub.weight} onChange={(e) => updItem(i.key, { subItems: i.subItems!.map((x) => (x.key === sub.key ? { ...x, weight: num(e.target.value) } : x)) })} />
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>
    );
  };
  return (
    <div className="space-y-6">
      <Notice>المبدأ 50% فردي و50% جماعي (ثابتان في الوثيقة، ومخزّنان هنا كقيمة). النقاط كسب فقط: لا خصم أبداً.</Notice>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="التوزيع">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="نصيب الفردي"><Input type="number" value={s.split.individual} onChange={(e) => setS({ ...s, split: { ...s.split, individual: num(e.target.value) } })} /></Field>
            <Field label="نصيب الجماعي"><Input type="number" value={s.split.group} onChange={(e) => setS({ ...s, split: { ...s.split, group: num(e.target.value) } })} /></Field>
            <Field label="من الجماعي: الرحلات الداخلية"><Input type="number" value={s.groupTripSplit.internal} onChange={(e) => setS({ ...s, groupTripSplit: { ...s.groupTripSplit, internal: num(e.target.value) } })} /></Field>
            <Field label="من الجماعي: الرحلات الخارجية"><Input type="number" value={s.groupTripSplit.external} onChange={(e) => setS({ ...s, groupTripSplit: { ...s.groupTripSplit, external: num(e.target.value) } })} /></Field>
          </div>
        </Card>
        <Card title="معاملات">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="معامل التميّز عند تكرار التقديم" hint="20.2 · مثال 0.5 = نصف النقاط في المرة الثانية"><Input type="number" step={0.1} value={s.repeatPresentationFactor} onChange={(e) => setS({ ...s, repeatPresentationFactor: num(e.target.value) })} /></Field>
            <Field label="الحد الأعلى لمضاعف التقديم"><Input type="number" step={0.1} value={s.presentingMaxMultiplier} onChange={(e) => setS({ ...s, presentingMaxMultiplier: num(e.target.value) })} /></Field>
            <Field label="ما يُكسب عند التأخر عن الموعد" hint="نسبة من النقطة (0 إلى 1)"><Input type="number" step={0.1} value={s.lateFactor} onChange={(e) => setS({ ...s, lateFactor: Math.min(1, num(e.target.value)) })} /></Field>
            <Field label="نقاط المادة الإثرائية"><Input type="number" value={s.enrichmentPointsPerMaterial} onChange={(e) => setS({ ...s, enrichmentPointsPerMaterial: num(e.target.value) })} /></Field>
          </div>
          <div className="mt-3">
            <span className="label">معايير تقييم المقدّم</span>
            <div className="flex flex-wrap gap-2">
              {s.presentationCriteria.map((c, i) => <Input key={c.key} className="w-44" value={c.name} onChange={(e) => setS({ ...s, presentationCriteria: s.presentationCriteria.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />)}
              <Button size="sm" variant="secondary" onClick={() => setS({ ...s, presentationCriteria: [...s.presentationCriteria, { key: uid('cr'), name: 'معيار جديد' }] })}>+</Button>
            </div>
          </div>
        </Card>
      </div>
      {section('individual')}
      {section('group')}
      <div className="sticky bottom-3 flex justify-end"><Button onClick={save}>احفظ إعدادات التقييم</Button></div>
    </div>
  );
}

function Targets() {
  const db = useDB();
  const [s, setS] = useState(structuredClone(db.settings));
  const n = (path: (x: Settings) => Record<string, number>, k: string, label: string, hint?: string) => (
    <Field label={label} hint={hint}><Input type="number" value={path(s)[k]} onChange={(e) => { const c = structuredClone(s); path(c)[k] = num(e.target.value); setS(c); }} /></Field>
  );
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card title="المستهدفات">
        <div className="grid gap-3 sm:grid-cols-2">
          {n((x) => x.targets as any, 'focusMeetingsPerGroup', 'الحد الأدنى للقاءات التركيز لكل مجموعة')}
          {n((x) => x.targets as any, 'individualMeetingsPerParticipant', 'اللقاءات الفردية لكل مشارك')}
        </div>
      </Card>
      <Card title="أعداد الرحلات">
        <div className="grid gap-3 sm:grid-cols-2">
          {n((x) => x.programCounts as any, 'staffInternal', 'داخلية بفريق العمل (لقاء تطويري)')}
          {n((x) => x.programCounts as any, 'groupInternal', 'داخلية لكل مجموعة')}
          {n((x) => x.programCounts as any, 'groupExternal', 'خارجية لكل مجموعة')}
          {n((x) => x.programCounts as any, 'staffExternal', 'خارجية بفريق العمل')}
        </div>
      </Card>
      <Card title="المواعيد النهائية الافتراضية (بالأيام)">
        <div className="grid gap-3 sm:grid-cols-2">
          {n((x) => x.deadlineDefaults as any, 'initialDaysBefore', 'الخطة المبسطة قبل الرحلة بـ')}
          {n((x) => x.deadlineDefaults as any, 'detailedDaysBefore', 'التفصيلية والموازنة قبل الرحلة بـ')}
          {n((x) => x.deadlineDefaults as any, 'finalReportDaysAfter', 'التقرير الختامي بعد الرحلة بـ')}
          {n((x) => x.deadlineDefaults as any, 'reminderDaysBefore', 'التنبيه قبل الموعد بـ')}
          {n((x) => x as any, 'scheduleRevealHours', 'عرض الجدول قبل الرحلة بـ (ساعات)')}
        </div>
      </Card>
      <Card title="البرنامج" subtitle="20.10: العدد الفعلي والتواريخ">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="اسم الدفعة"><Input value={s.program.cohort} onChange={(e) => setS({ ...s, program: { ...s.program, cohort: e.target.value } })} /></Field>
          {n((x) => x.program as any, 'participantsCount', 'عدد المشاركين المتوقع')}
          <Field label="بداية البرنامج"><Input type="date" value={s.program.startDate} onChange={(e) => setS({ ...s, program: { ...s.program, startDate: e.target.value } })} /></Field>
          <Field label="نهاية البرنامج"><Input type="date" value={s.program.endDate} onChange={(e) => setS({ ...s, program: { ...s.program, endDate: e.target.value } })} /></Field>
        </div>
      </Card>
      <div className="lg:col-span-2"><Button onClick={() => act(() => repos.settings.update({ targets: s.targets, programCounts: s.programCounts, deadlineDefaults: s.deadlineDefaults, scheduleRevealHours: s.scheduleRevealHours, program: s.program }), 'حُفظت الإعدادات')}>احفظ</Button></div>
    </div>
  );
}

function Categories() {
  const db = useDB();
  const [cats, setCats] = useState(db.settings.scheduleCategories);
  return (
    <Card title="التصنيفات العامة لبنود الجدول" subtitle="تخدم التحليل: نسبة كل تصنيف من وقت الرحلة، ومقارنة المخطط بالفعلي">
      <div className="space-y-2">
        {cats.map((c, i) => (
          <div key={c.id} className="flex items-center gap-2">
            <input type="color" value={c.color} onChange={(e) => setCats(cats.map((x, j) => (j === i ? { ...x, color: e.target.value } : x)))} className="h-9 w-10 rounded border border-ink-200" />
            <Input value={c.name} onChange={(e) => setCats(cats.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
            <button onClick={() => setCats(cats.filter((_, j) => j !== i))} className="text-ink-300 hover:text-red-600"><Icons.Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <Button variant="secondary" onClick={() => setCats([...cats, { id: uid('cat'), name: 'تصنيف جديد', color: '#00b9d1' }])}>أضف تصنيفاً</Button>
        <Button onClick={() => act(() => repos.settings.update({ scheduleCategories: cats }), 'حُفظت التصنيفات')}>احفظ</Button>
      </div>
    </Card>
  );
}

function Templates() {
  const db = useDB();
  const [t, setT] = useState<TaskTemplate>({ id: '', committeeId: db.committees[0].id, title: '', proofType: 'link', tag: '', dueOffsetDays: 3, appliesTo: 'all' });
  return (
    <Card title="قالب المهام التلقائية" subtitle="عند إنشاء أي رحلة تُنشأ هذه المهام تلقائياً لكل لجنة">
      <Table>
        <thead><tr><th>المهمة</th><th>اللجنة</th><th>الإثبات</th><th>وسم المؤشر</th><th>الموعد</th><th>تنطبق على</th><th /></tr></thead>
        <tbody>
          {db.taskTemplates.map((x) => (
            <tr key={x.id}>
              <td>{x.title}</td><td>{db.committees.find((c) => c.id === x.committeeId)?.name}</td><td>{proofTypeLabel[x.proofType]}</td><td><Badge>{x.tag}</Badge></td>
              <td className="text-xs">{x.dueOffsetDays >= 0 ? `بعد نهاية الرحلة بـ ${x.dueOffsetDays} يوم` : `قبلها بـ ${-x.dueOffsetDays} يوم`}</td>
              <td>{{ all: 'كل الرحلات', internal: 'الداخلية', external: 'الخارجية' }[x.appliesTo]}</td>
              <td><button onClick={() => repos.tasks.removeTemplate(x.id)} className="text-ink-300 hover:text-red-600"><Icons.Trash2 className="h-4 w-4" /></button></td>
            </tr>
          ))}
        </tbody>
      </Table>
      <div className="mt-4 grid gap-2 rounded-xl bg-ink-50 p-3 sm:grid-cols-3 lg:grid-cols-7">
        <Input className="lg:col-span-2" placeholder="المهمة" value={t.title} onChange={(e) => setT({ ...t, title: e.target.value })} />
        <Select value={t.committeeId} onChange={(e) => setT({ ...t, committeeId: e.target.value })} options={db.committees.map((c) => ({ value: c.id, label: c.name }))} />
        <Select value={t.proofType} onChange={(e) => setT({ ...t, proofType: e.target.value as ProofType })} options={(['none', 'link', 'file', 'text'] as ProofType[]).map((p) => ({ value: p, label: proofTypeLabel[p] }))} />
        <Input dir="ltr" placeholder="tag" value={t.tag} onChange={(e) => setT({ ...t, tag: e.target.value })} />
        <Input type="number" value={t.dueOffsetDays} onChange={(e) => setT({ ...t, dueOffsetDays: +e.target.value })} title="أيام بالنسبة لنهاية الرحلة" />
        <Button disabled={!t.title} onClick={() => act(() => { repos.tasks.saveTemplate({ ...t, id: uid('tpl') }); setT({ ...t, title: '', tag: '' }); }, 'أُضيف للقالب')}>أضف</Button>
      </div>
    </Card>
  );
}

function Notifications() {
  const db = useDB();
  const imp = db.settings.importantNotifications;
  const toggle = (t: NotificationType, on: boolean) => repos.settings.update({ importantNotifications: on ? [...imp, t] : imp.filter((x) => x !== t) });
  return (
    <Card title="الإشعارات المهمة" subtitle="كل الإشعارات داخل المنصة، والمهم فقط يصل على البريد أيضاً (20.9)">
      <div className="grid gap-2 sm:grid-cols-2">
        {(Object.keys(notificationTypeLabel) as NotificationType[]).map((t) => (
          <div key={t} className="flex items-center justify-between rounded-xl border border-ink-100 px-3 py-2 text-sm">
            <span>{notificationTypeLabel[t]}</span>
            <Toggle checked={imp.includes(t)} onChange={(v) => toggle(t, v)} label={<span className="text-xs text-ink-500">بريد</span>} />
          </div>
        ))}
      </div>
    </Card>
  );
}

function Tracker() {
  const db = useDB();
  const staff = db.persons.filter((p) => p.kind === 'staff' && !p.isGeneralLeader);
  const facIds = db.groups.map((g) => g.facilitatorId);
  return (
    <Card title="متابع الرحلات" subtitle="شخص واحد ثابت من أعضاء الإدارة لكل الرحلات. لا يجوز أن يكون ميسّر الرحلة، ولا القائد العام في رحلات فريق العمل">
      <Field label="المتابع" className="max-w-sm"><Select value={db.settings.trackerId ?? ''} onChange={(e) => act(() => repos.settings.setTracker(e.target.value), 'عُيّن المتابع')} options={[{ value: '', label: '—' }, ...staff.map((p) => ({ value: p.id, label: `${p.name}${facIds.includes(p.id) ? ' (ميسّر: يلزم بديل لرحلات مجموعته)' : ''}` }))]} /></Field>
      <p className="mt-2 text-xs text-ink-400">إذا كان المتابع ميسّراً لمجموعة، تحتاج رحلات مجموعته متابعاً بديلاً يعتمده القائد العام.</p>
    </Card>
  );
}

function OpenPoints() {
  const db = useDB();
  const s = db.settings;
  const row = (label: string, ref: string, checked: boolean, k: keyof Settings) => (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink-100 px-3 py-3">
      <div><div className="text-sm font-medium">{label}</div><div className="text-[11px] text-ink-400">النقطة المفتوحة {ref}</div></div>
      <Toggle checked={checked} onChange={(v) => repos.settings.update({ [k]: v } as Partial<Settings>)} />
    </div>
  );
  return (
    <Card title="النقاط المفتوحة (القسم 20)" subtitle="مبنية قابلة للتعديل حتى تُحسم">
      <div className="grid gap-2 md:grid-cols-2">
        {row('تعديل الجدول بعد الانطلاق يحتاج موافقة الإدارة', '20.6', s.scheduleEditAfterStartNeedsApproval, 'scheduleEditAfterStartNeedsApproval')}
        {row('المصروف الزائد عن الموازنة يحتاج موافقة المالية والقائد العام', '20.7', s.overspendNeedsApproval, 'overspendNeedsApproval')}
        {row('تعليقات رابط المتابعة تحتاج مراجعة قبل الظهور', '20.8', s.trackingCommentsNeedReview, 'trackingCommentsNeedReview')}
        {row('عرض التاريخ الهجري مع الميلادي', '20.11', s.showHijri, 'showHijri')}
        {row('دفع الرسوم داخل المنصة (وإلا تُسجَّل فقط)', '20.12', s.feesInPlatform, 'feesInPlatform')}
        <div className="flex items-center justify-between gap-2 rounded-xl border border-ink-100 px-3 py-3">
          <div><div className="text-sm font-medium">قيمة رسوم البرنامج</div><div className="text-[11px] text-ink-400">ر.س</div></div>
          <Input type="number" className="w-28" value={s.feeAmount} onChange={(e) => repos.settings.update({ feeAmount: num(e.target.value) })} />
        </div>
        <div className="rounded-xl border border-ink-100 px-3 py-3 text-sm">
          <div className="font-medium">الإبداع والابتكار (20.3)</div>
          <div className="text-[11px] text-ink-400">فعّله من تبويب "التقييم والأوزان" كبند جماعي.</div>
        </div>
        <div className="rounded-xl border border-ink-100 px-3 py-3 text-sm">
          <div className="font-medium">جلسات الكوتشينج وملف المشارك الختامي (20.4 و20.5)</div>
          <div className="text-[11px] text-ink-400">مؤجلة. نموذج الخطة الشخصية مبني قابلاً للتوسع لإضافتها لاحقاً.</div>
        </div>
      </div>
    </Card>
  );
}
