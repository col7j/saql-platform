// الإعدادات: كل القيم القابلة للتعديل مخزّنة في البيانات (قسم 0.10 والقسم 20)
import { useState } from 'react';
import { uid } from '@/domain/id';
import { capacityKeyLabel } from '@/domain/capacities';
import { fmtDateTime } from '@/domain/dates';
import { notificationTypeLabel, proofTypeLabel } from '@/domain/labels';
import { canEditEvaluation, canUnlockEvaluation, EVALUATION_KEYS } from '@/domain/settings';
import type { EvaluationItem, NotificationType, ProofType, Settings, TaskTemplate } from '@/domain/types';
import { act, personName, repos, useDB, useMe } from '@/state/store';
import { Badge, Button, Card, Empty, Field, Icons, Input, Notice, PageHeader, ReasonModal, Select, Table, Tabs, Toggle } from '@/ui';
import { PersonChip } from '@/ui/domain';

type Tab = 'evaluation' | 'targets' | 'categories' | 'templates' | 'notifications' | 'roles' | 'tracker' | 'audit' | 'open';

export default function SettingsPage() {
  const me = useMe();
  const leader = me.isLeader;
  const tech = me.isTechLead;
  // كل تبويب لصاحبه: القائد العام، مسؤول اللجنة التقنية، أو من فُوّض بتصنيفات الجدول
  const tabs: { key: Tab; label: string }[] = [
    ...(leader || tech ? [{ key: 'evaluation' as const, label: 'التقييم والأوزان' }] : []),
    ...(leader ? [{ key: 'targets' as const, label: 'المستهدفات والأعداد' }] : []),
    ...(me.canManageScheduleCategories ? [{ key: 'categories' as const, label: 'تصنيفات الجدول' }] : []),
    ...(leader ? [{ key: 'templates' as const, label: 'قالب المهام التلقائية' }] : []),
    ...(tech ? [{ key: 'notifications' as const, label: 'الإشعارات' }] : []),
    ...(leader || tech ? [{ key: 'roles' as const, label: 'قواعد التعارض' }] : []),
    ...(leader ? [{ key: 'tracker' as const, label: 'متابع الرحلات' }] : []),
    ...(leader || tech ? [{ key: 'audit' as const, label: 'سجل التدقيق' }] : []),
    ...(leader ? [{ key: 'open' as const, label: 'النقاط المفتوحة' }] : []),
  ];
  const [picked, setTab] = useState<Tab>(tabs[0]?.key ?? 'evaluation');
  const tab = tabs.some((t) => t.key === picked) ? picked : tabs[0]?.key;
  if (!tabs.length) return <Empty title="الإعدادات للقائد العام ومسؤول اللجنة التقنية" />;
  return (
    <div>
      <PageHeader title="الإعدادات" subtitle="كل القيم القابلة للضبط مخزّنة في البيانات، ويعدّل كل إعداد صاحبه" />
      <Tabs value={tab!} onChange={setTab} tabs={tabs} />
      {tab === 'evaluation' && <Evaluation />}
      {tab === 'targets' && <Targets />}
      {tab === 'categories' && <Categories />}
      {tab === 'templates' && <Templates />}
      {tab === 'notifications' && <Notifications />}
      {tab === 'roles' && <Roles />}
      {tab === 'tracker' && <Tracker />}
      {tab === 'audit' && <Audit />}
      {tab === 'open' && <OpenPoints />}
    </div>
  );
}

const num = (v: string) => (isNaN(+v) ? 0 : Math.max(0, +v));

function Evaluation() {
  const db = useDB();
  const [s, setS] = useState<Settings>(structuredClone(db.settings));
  const me = useMe();
  const editable = canEditEvaluation(db, me.person.id);
  const [unlocking, setUnlocking] = useState(false);
  const save = () => act(() => repos.settings.saveEvaluation(Object.fromEntries(EVALUATION_KEYS.map((k) => [k, s[k]]))), 'حُفظت إعدادات التقييم وقُفلت، وأُعيد حساب النقاط');
  const lock = db.settings.evaluationLock;
  const dd = (k: keyof Settings['deadlineDefaults'], label: string, hint?: string) => <Field label={label} hint={hint}><Input type="number" value={s.deadlineDefaults[k]} onChange={(e) => setS({ ...s, deadlineDefaults: { ...s.deadlineDefaults, [k]: num(e.target.value) } })} /></Field>;
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
              {i.description && <p className="mt-1 text-xs text-ink-400">{i.description}</p>}
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
      {lock.locked ? (
        <Notice tone="orange" icon={<Icons.Lock className="h-4 w-4" />}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>إعدادات التقييم مقفلة منذ {fmtDateTime(lock.at)} ({personName(db, lock.by)}). لا يفتحها إلا مسؤول اللجنة التقنية.</span>
            {canUnlockEvaluation(db, me.person.id) && <Button size="sm" variant="secondary" onClick={() => setUnlocking(true)} icon={<Icons.LockOpen className="h-4 w-4" />}>افتح القفل</Button>}
          </div>
        </Notice>
      ) : (
        <Notice tone="green" icon={<Icons.LockOpen className="h-4 w-4" />}>الإعدادات مفتوحة للتعديل{lock.at ? ` منذ ${fmtDateTime(lock.at)} (${personName(db, lock.by)})` : ''}. تُقفل تلقائياً عند الحفظ.</Notice>
      )}
      <ReasonModal open={unlocking} onClose={() => setUnlocking(false)} title="فتح قفل إعدادات التقييم" label="سبب الفتح (يُسجَّل ويصل للقائد العام)" cta="افتح القفل" danger={false} onSubmit={(r) => act(() => { repos.settings.unlockEvaluation(r); setUnlocking(false); }, 'فُتح القفل')} />
      <Notice>المبدأ 50% فردي و50% جماعي (ثابتان في الوثيقة، ومخزّنان هنا كقيمة). النقاط كسب فقط: لا خصم أبداً.</Notice>
      <fieldset disabled={!editable} className="space-y-6 disabled:opacity-80">
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
            <Field label="نقاط تميّز التقديم المتكرر" hint="رقم ثابت لا نسبة. بند التقديم يأخذ متوسط مرات التقديم لكل معيار ضمن سقفه، ويُضاف هذا العدد من النقاط عن كل مرة بعد الأولى"><Input type="number" step={0.5} value={s.presentingExtraBonus} onChange={(e) => setS({ ...s, presentingExtraBonus: num(e.target.value) })} /></Field>
            <div className="flex items-end pb-2"><Toggle checked={s.presentingRevealAfterEnd} onChange={(v) => setS({ ...s, presentingRevealAfterEnd: v })} label="تقييم المقدّمين يظهر بعد نهاية البرنامج" /></div>
            <Field label="ما يُكسب عند التسليم في الموعد النهائي" hint="نسبة من وزن البند (0 إلى 1) لمن سلّم بعد موعد التبكير وقبل الموعد النهائي. المبكر يأخذ الوزن كاملاً، وبعد النهائي صفر"><Input type="number" step={0.1} value={s.deadlineFinalCredit} onChange={(e) => setS({ ...s, deadlineFinalCredit: Math.min(1, num(e.target.value)) })} /></Field>
            <Field label="نصاب تقييم فريق العمل للرحلة" hint="نسبة من فريق العمل (0 إلى 1). لا تُغلق الرحلة قبل أن يقيّمها هذا العدد على الأقل، ويدخل المتوسط في درجة المجموعة"><Input type="number" step={0.1} value={s.tripRatingQuorum} onChange={(e) => setS({ ...s, tripRatingQuorum: Math.min(1, num(e.target.value)) })} /></Field>
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
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="مواعيد الرحلة (بالأيام)" subtitle="درجات المواعيد للرحلة نفسها وتذهب للمجموعة المنفِّذة. التسليم حتى موعد التبكير يأخذ وزن البند كاملاً، وحتى النهائي جزءاً، وبعده صفراً">
          <div className="grid gap-3 sm:grid-cols-2">
            {dd('documentEarlyDaysBefore', 'وثيقة الرحلة: التبكير قبلها بـ', 'من سلّم قبل هذا الموعد يأخذ وزن البند كاملاً')}
            {dd('documentDaysBefore', 'وثيقة الرحلة: النهائي قبلها بـ', 'الموعد الافتراضي للرحلات الجديدة، ويمكن تعديله لكل رحلة')}
            {dd('scheduleEarlyDaysBefore', 'الجدول الزمني: التبكير قبلها بـ')}
            {dd('scheduleDaysBefore', 'الجدول الزمني: النهائي قبلها بـ')}
            {dd('budgetEarlyDaysBefore', 'الميزانية: التبكير قبلها بـ')}
            {dd('budgetDaysBefore', 'الميزانية: النهائي قبلها بـ')}
            {dd('tripCloseDaysAfter', 'إغلاق الرحلة: أقصى مدة بعدها', 'إن تأخر الإغلاق عنها تخسر المجموعة نقاط بند الإغلاق')}
            {dd('financeCloseDaysAfter', 'الإغلاق المالي: أقصى مدة بعدها', 'إن تأخر إغلاق العهدة عنها تخسر المجموعة نقاط بند الإغلاق المالي')}
            {dd('finalReportDaysAfter', 'التقرير الختامي بعدها بـ', 'بعده لا يُكسب بند التقرير')}
            {dd('reminderDaysBefore', 'التنبيه قبل الموعد بـ', 'تذكير داخل المنصة فقط')}
          </div>
          <p className="mt-2 text-xs text-ink-400">أوزان هذه البنود في «البنود التلقائية للرحلة» ضمن البنود الجماعية أدناه.</p>
        </Card>
        <Card title="أوزان الحضور" subtitle="وزن الحضور كله يُضبط من بند «الحضور» في البنود الفردية، وهنا نصيب كل نوع منه. الحضور يؤثر على التقييم الفردي فقط">
          <div className="grid gap-3 sm:grid-cols-3">
            {(['focus', 'trip', 'tripSession'] as const).map((k) => (
              <Field key={k} label={{ focus: 'لقاءات التركيز', trip: 'الرحلة (التحضير العام)', tripSession: 'لقاءات الرحلة' }[k]}><Input type="number" value={s.attendanceWeights[k]} onChange={(e) => setS({ ...s, attendanceWeights: { ...s.attendanceWeights, [k]: num(e.target.value) } })} /></Field>
            ))}
          </div>
          <Field label="درجة المتأخر" hint="نسبة من الدرجة (0 إلى 1). المبكر والحاضر في الوقت يأخذان الدرجة كاملة بلا زيادة، والغائب صفر" className="mt-3"><Input type="number" step={0.1} value={s.attendanceLateCredit} onChange={(e) => setS({ ...s, attendanceLateCredit: Math.min(1, num(e.target.value)) })} /></Field>
        </Card>
      </div>
      <Card title="بنود تقييم القائد العام الفردي" subtitle={`يقيّم بها أي مشارك مرة واحدة · المجموع ${s.leaderEvalItems.reduce((a, i) => a + i.max, 0)} (المقترح 100، ومنها الإبداع والابتكار)`}
        action={<Button size="sm" variant="secondary" onClick={() => setS({ ...s, leaderEvalItems: [...s.leaderEvalItems, { key: uid('le'), name: 'بند جديد', max: 10 }] })} icon={<Icons.Plus className="h-4 w-4" />}>أضف بنداً</Button>}>
        <div className="grid gap-2 sm:grid-cols-2">
          {s.leaderEvalItems.map((i, idx) => (
            <div key={i.key} className="flex items-center gap-2">
              <Input value={i.name} onChange={(e) => setS({ ...s, leaderEvalItems: s.leaderEvalItems.map((x, j) => (j === idx ? { ...x, name: e.target.value } : x)) })} />
              <Input className="num w-20" type="number" value={i.max} onChange={(e) => setS({ ...s, leaderEvalItems: s.leaderEvalItems.map((x, j) => (j === idx ? { ...x, max: num(e.target.value) } : x)) })} aria-label="الحد الأعلى" />
              <button onClick={() => setS({ ...s, leaderEvalItems: s.leaderEvalItems.filter((_, j) => j !== idx) })} className="text-ink-300 hover:text-red-600"><Icons.Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      </Card>
      {section('individual')}
      {section('group')}
      </fieldset>
      {editable && <div className="sticky bottom-3 flex justify-end"><Button onClick={save} icon={<Icons.Lock className="h-4 w-4" />}>احفظ واقفل الإعدادات</Button></div>}
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
      <Card title="عرض الجدول للمشاركين">
        <div className="grid gap-3 sm:grid-cols-2">
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
      <div className="lg:col-span-2"><Button onClick={() => act(() => repos.settings.update({ targets: s.targets, programCounts: s.programCounts, scheduleRevealHours: s.scheduleRevealHours, program: s.program }), 'حُفظت الإعدادات')}>احفظ</Button></div>
    </div>
  );
}

function Categories() {
  const db = useDB();
  const [cats, setCats] = useState(db.settings.scheduleCategories);
  return (
    <Card title="التصنيفات العامة لبنود الجدول" subtitle="لكل تصنيف وصف، وهل يلزمه تحضير (لقاءاته يُسجَّل فيها الحضور). تخدم التحليل ومقارنة المخطط بالفعلي">
      <div className="space-y-2">
        {cats.map((c, i) => (
          <div key={c.id} className="grid items-center gap-2 sm:grid-cols-[40px_1fr_2fr_auto_auto]">
            <input type="color" value={c.color} onChange={(e) => setCats(cats.map((x, j) => (j === i ? { ...x, color: e.target.value } : x)))} className="h-9 w-10 rounded border border-ink-200" />
            <Input value={c.name} onChange={(e) => setCats(cats.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
            <Input placeholder="الوصف" value={c.description ?? ''} onChange={(e) => setCats(cats.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} />
            <Toggle checked={c.requiresPrep} onChange={(v) => setCats(cats.map((x, j) => (j === i ? { ...x, requiresPrep: v } : x)))} label={<span className="text-xs">يلزمه تحضير</span>} />
            <button onClick={() => setCats(cats.filter((_, j) => j !== i))} className="text-ink-300 hover:text-red-600"><Icons.Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <Button variant="secondary" onClick={() => setCats([...cats, { id: uid('cat'), name: 'تصنيف جديد', color: '#00b9d1', requiresPrep: false }])}>أضف تصنيفاً</Button>
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
    <Card title="الإشعارات" subtitle="النسخة الأولى: كل الإشعارات داخل المنصة فقط. الإيميل مؤجّل، وهذه القائمة جاهزة لتحديد ما يصل بالإيميل عند ربطه">
      <div className="mb-3"><Notice tone="orange">لا يُرسل أي إيميل حالياً. ما تختاره هنا يُحفظ ويُفعَّل عند ربط خدمة الإيميل.</Notice></div>
      <div className="grid gap-2 sm:grid-cols-2">
        {(Object.keys(notificationTypeLabel) as NotificationType[]).map((t) => (
          <div key={t} className="flex items-center justify-between rounded-xl border border-ink-100 px-3 py-2 text-sm">
            <span>{notificationTypeLabel[t]}</span>
            <Toggle checked={imp.includes(t)} onChange={(v) => toggle(t, v)} label={<span className="text-xs text-ink-500">بالإيميل لاحقاً</span>} />
          </div>
        ))}
      </div>
    </Card>
  );
}

function Tracker() {
  const db = useDB();
  const staff = db.persons.filter((p) => p.kind === 'staff' && !p.isGeneralLeader);
  return (
    <Card title="متابع الرحلات الدائم" subtitle="شخص ثابت لا يكون ميسّراً ولا مسؤول لجنة (يجوز عضواً). عند غيابه عن رحلة يُكلَّف بديل لها فقط">
      <Field label="المتابع" className="max-w-sm"><Select value={db.settings.trackerId ?? ''} onChange={(e) => act(() => repos.settings.setTracker(e.target.value), 'عُيّن المتابع')} options={[{ value: '', label: '—' }, ...staff.map((p) => ({ value: p.id, label: p.name }))]} /></Field>
      <p className="mt-2 text-xs text-ink-400">قواعد التعارض تُطبَّق عند الاختيار: يظهر سبب المنع إن كان للشخص صفة لا تجتمع مع المتابعة.</p>
    </Card>
  );
}

function OpenPoints() {
  const db = useDB();
  const s = db.settings;
  const row = (label: string, ref: string, checked: boolean, k: keyof Settings) => (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink-100 px-3 py-3">
      <div><div className="text-sm font-medium">{label}</div><div className="text-xs text-ink-400">النقطة المفتوحة {ref}</div></div>
      <Toggle checked={checked} onChange={(v) => repos.settings.update({ [k]: v } as Partial<Settings>)} />
    </div>
  );
  return (
    <Card title="النقاط المفتوحة (القسم 20)" subtitle="مبنية قابلة للتعديل حتى تُحسم">
      <div className="grid gap-2 md:grid-cols-2">
        {row('تعليقات رابط المتابعة تحتاج مراجعة قبل الظهور', '20.8', s.trackingCommentsNeedReview, 'trackingCommentsNeedReview')}
        {row('عرض التاريخ الهجري مع الميلادي', '20.11', s.showHijri, 'showHijri')}
        {row('دفع الرسوم داخل المنصة (وإلا تُسجَّل فقط)', '20.12', s.feesInPlatform, 'feesInPlatform')}
        <div className="flex items-center justify-between gap-2 rounded-xl border border-ink-100 px-3 py-3">
          <div><div className="text-sm font-medium">قيمة رسوم البرنامج</div><div className="text-xs text-ink-400">ر.س</div></div>
          <Input type="number" className="w-28" value={s.feeAmount} onChange={(e) => repos.settings.update({ feeAmount: num(e.target.value) })} />
        </div>
        <div className="rounded-xl border border-ink-100 px-3 py-3 text-sm">
          <div className="font-medium">الإبداع والابتكار</div>
          <div className="text-xs text-ink-400">أحد بنود تقييم القائد العام الفردي (تبويب التقييم والأوزان).</div>
        </div>
      </div>
    </Card>
  );
}

function Roles() {
  const db = useDB();
  return (
    <Card title="قواعد تعارض الصفات" subtitle="مخزّنة كبيانات، وتُطبَّق عند إضافة أي صفة: الميسّر، اللجان، المتابع الدائم، فرق رحلات فريق العمل، المتابع البديل. القائد العام مستثنى">
      <Table>
        <thead><tr><th>الصفة</th><th>لا تجتمع مع</th><th>الرسالة عند المنع</th></tr></thead>
        <tbody>
          {db.capacityRules.map((r) => (
            <tr key={r.id}><td>{capacityKeyLabel[r.a] ?? r.a}</td><td>{capacityKeyLabel[r.b] ?? r.b}</td><td className="text-xs text-ink-600">{r.message}</td></tr>
          ))}
        </tbody>
      </Table>
      <p className="mt-3 text-xs text-ink-400">عضو أي لجنة يجوز أن يكون ميسّراً. مسؤول اللجنة التقنية يجوز أن يكون مسؤول الإعلامية، وبديلاً مؤقتاً لمتابع الرحلات.</p>
    </Card>
  );
}

function Audit() {
  const db = useDB();
  const list = db.audit.filter((a) => a.area && a.area !== 'finance');
  const areaLabel = { roles: 'الأدوار والصفات', accounts: 'الحسابات', settings: 'الإعدادات', finance: 'المالية' } as const;
  return (
    <Card pad={false} title="سجل التدقيق" subtitle="الأدوار والحسابات والإعدادات. لا يُحذف. (سجل المالية في قسم المالية)">
      {list.length === 0 ? <div className="p-5"><Empty title="لا سجلات بعد" /></div> : (
        <Table>
          <thead><tr><th>الوقت</th><th>من</th><th>المجال</th><th>الإجراء</th><th>التفاصيل</th></tr></thead>
          <tbody>{list.map((a) => <tr key={a.id}><td className="whitespace-nowrap text-xs">{fmtDateTime(a.at)}</td><td><PersonChip id={a.byId} size={22} /></td><td><Badge>{areaLabel[a.area!]}</Badge></td><td className="font-medium">{a.action}</td><td className="text-xs text-ink-600">{a.detail}</td></tr>)}</tbody>
        </Table>
      )}
    </Card>
  );
}
