// لقاءات التركيز (قسم 7)
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { addDays, fmtDate, fmtTime, todayISO } from '@/domain/dates';
import { focusStatusLabel, focusStatusTone } from '@/domain/labels';
import { facilitatorTargetProgress, focusDone } from '@/domain/workflow';
import type { FocusMeeting } from '@/domain/types';
import { focusCounter, perItem } from '@/domain/finance';
import { act, personName, repos, useDB, useMe } from '@/state/store';
import { Badge, Button, Card, Empty, Field, Icons, Input, Modal, Notice, PageHeader, Progress, Select, StepWizard, Tabs, Toggle, cx } from '@/ui';
import { GroupBadge } from '@/ui/domain';

export default function FocusPage() {
  const db = useDB();
  const me = useMe();
  const [tab, setTab] = useState<'upcoming' | 'past' | 'mine'>('upcoming');
  const [group, setGroup] = useState<string>(me.group?.id ?? me.facilitatorOf[0]?.id ?? 'all');
  const [creating, setCreating] = useState(false);
  const today = todayISO();
  const visible = db.focusMeetings.filter((f) => me.isStaff || f.groupId === me.group?.id || f.presenterIds.includes(me.person.id)).filter((f) => me.isStaff || f.status !== 'draft' || f.presenterIds.includes(me.person.id));
  const inGroup = visible.filter((f) => group === 'all' || f.groupId === group);
  const list = inGroup
    .filter((f) => (tab === 'mine' ? f.presenterIds.includes(me.person.id) : tab === 'past' ? focusDone(f) || (f.date ?? '9') < today : !focusDone(f) && (f.date ?? '9') >= today))
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));

  return (
    <div>
      <PageHeader
        title="لقاءات التركيز"
        subtitle="لقاءات قصيرة على مستوى المجموعة، وفيها يكسب المشارك نقاط التقديم"
        actions={me.facilitatorOf.length > 0 && <Button onClick={() => setCreating(true)} icon={<Icons.Plus className="h-4 w-4" />}>أنشئ لقاء تركيز</Button>}
      />
      {me.facilitatorOf.length > 0 && (() => {
        const p = facilitatorTargetProgress(db, me.person.id);
        return (
          <Card className="mb-5">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex-1"><div className="mb-1 flex justify-between text-sm"><span>المستهدف الأدنى من الإدارة</span><span className="num">{p.focusDone} / {p.focusTarget}</span></div><Progress value={(p.focusDone / p.focusTarget) * 100} /></div>
              {me.facilitatorOf.map((g) => { const c = focusCounter(db, g.id); return <Badge key={g.id} tone={c.withBudget >= c.max ? 'orange' : 'blue'}>بميزانية: {c.withBudget} من {c.max}{c.overflow ? ` (+${c.overflow} بلا ميزانية)` : ''}</Badge>; })}
              <Badge tone={p.umrahDone ? 'green' : 'orange'} icon={<Icons.Moon className="h-3 w-3" />}>لقاء العمرة: {p.umrahDone ? 'نُفّذ' : 'لم يُنفّذ'}</Badge>
            </div>
          </Card>
        );
      })()}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={tab} onChange={setTab} tabs={[{ key: 'upcoming', label: 'القادمة' }, { key: 'past', label: 'السابقة' }, { key: 'mine', label: 'تقديمي' }]} />
        {me.isStaff && <Select className="mb-4 w-auto" value={group} onChange={(e) => setGroup(e.target.value)} options={[{ value: 'all', label: 'كل المجموعات' }, ...db.groups.map((g) => ({ value: g.id, label: g.name }))]} />}
      </div>
      {list.length === 0 ? <Empty title="لا لقاءات" /> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((f) => <FocusCard key={f.id} f={f} />)}
        </div>
      )}
      {creating && <CreateFocusModal onClose={() => setCreating(false)} />}
    </div>
  );
}

function FocusCard({ f }: { f: FocusMeeting }) {
  const db = useDB();
  const presenters = f.presenterMode === 'guest' ? f.guestName : f.presenterMode === 'facilitator' ? 'الميسّر' : f.presenterMode === 'none' ? 'بدون مقدّم' : f.presenterIds.map((p) => personName(db, p)).join('، ');
  return (
    <Link to={`/app/focus/${f.id}`} className={cx('flex flex-col rounded-2xl border bg-white p-4 shadow-card transition hover:-translate-y-0.5', f.isUmrah ? 'border-emerald-200' : 'border-ink-100')}>
      <div className="flex flex-wrap items-center gap-1.5">
        <GroupBadge id={f.groupId} />
        <Badge tone={focusStatusTone[f.status]}>{focusStatusLabel[f.status]}</Badge>
        {f.isUmrah && <Badge tone="green" icon={<Icons.Moon className="h-3 w-3" />}>لقاء العمرة</Badge>}
      </div>
      <h3 className="mt-3 font-bold">{f.title}</h3>
      <div className="mt-1 space-y-0.5 text-xs text-ink-500">
        <div><Icons.Calendar className="me-1 inline h-3.5 w-3.5" />{f.date ? `${fmtDate(f.date)} · ${fmtTime(f.start)}` : f.dateOptions.length ? `خيارات: ${f.dateOptions.map((d) => fmtDate(d)).join(' / ')}` : 'التاريخ بحرية المقدّم'}</div>
        <div><Icons.Mic className="me-1 inline h-3.5 w-3.5" />{presenters || '—'}</div>
        {f.location && <div><Icons.MapPin className="me-1 inline h-3.5 w-3.5" />{f.location}</div>}
      </div>
    </Link>
  );
}

function CreateFocusModal({ onClose }: { onClose: () => void }) {
  const db = useDB();
  const me = useMe();
  const nav = useNavigate();
  const [groupId, setGroupId] = useState(me.facilitatorOf[0].id);
  const group = db.groups.find((g) => g.id === groupId)!;
  const [f, setF] = useState({
    title: '', isUmrah: false, topicMode: 'fixed' as FocusMeeting['topicMode'], topic: '', topicOptions: '', dateMode: 'fixed' as FocusMeeting['dateMode'], date: addDays(todayISO(), 7), dateOptions: '',
    start: '20:00', end: '21:00', location: '', presenterMode: 'members' as FocusMeeting['presenterMode'], presenterIds: [] as string[], axes: {} as Record<string, string>, guestName: '',
  });
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  // ترتيب اللقاء القادم في المجموعة، ومرصوده الافتراضي
  const nextIndex = db.focusMeetings.filter((x) => x.groupId === groupId).length + 1;
  const { max } = db.programBudget.focusLimits;
  const hasSlot = nextIndex <= max;
  const defaultAmount = f.isUmrah ? db.programBudget.umrahPerGroup : perItem(db.programBudget.focus);
  const [requestBudget, setRequestBudget] = useState(true);
  const [amount, setAmount] = useState<number | null>(null);
  const finalAmount = amount ?? defaultAmount;
  const budgetReady = db.programBudget.setupDone;

  const submit = () => act(() => {
    const id = repos.focus.create({
      groupId, title: f.title, isUmrah: f.isUmrah, topicMode: f.topicMode, topic: f.topicMode === 'fixed' ? f.topic : undefined, topicOptions: f.topicMode === 'options' ? f.topicOptions.split('،').map((x) => x.trim()).filter(Boolean) : [],
      dateMode: f.dateMode, date: f.dateMode === 'fixed' ? f.date : undefined, dateOptions: f.dateMode === 'options' ? f.dateOptions.split('،').map((x) => x.trim()).filter(Boolean) : [], start: f.start, end: f.end, location: f.location,
      presenterMode: f.presenterMode, presenterIds: f.presenterMode === 'members' ? f.presenterIds : [], presenterAxes: f.axes, guestName: f.presenterMode === 'guest' ? f.guestName : undefined,
    }, hasSlot && budgetReady && requestBudget ? { amount: finalAmount } : undefined);
    onClose();
    nav(`/app/focus/${id}`);
  }, hasSlot && budgetReady && requestBudget ? 'أُنشئ اللقاء وأُرسل طلب الميزانية' : 'أُنشئ اللقاء');

  return (
    <Modal open onClose={onClose} title="لقاء تركيز جديد">
      <StepWizard onCancel={onClose} finishLabel="أنشئ اللقاء" onFinish={submit} steps={[
        {
          title: 'العنوان', valid: !!f.title.trim(), hint: 'اكتب عنوان اللقاء',
          content: (
            <div className="space-y-3">
              {me.facilitatorOf.length > 1 && <Field label="المجموعة"><Select value={groupId} onChange={(e) => setGroupId(e.target.value)} options={me.facilitatorOf.map((g) => ({ value: g.id, label: g.name }))} /></Field>}
              <Field label="عنوان اللقاء"><Input value={f.title} onChange={(e) => set({ title: e.target.value })} /></Field>
              <Toggle checked={f.isUmrah} onChange={(v) => { set({ isUmrah: v, title: v && !f.title ? 'لقاء العمرة' : f.title }); setAmount(null); }} label="لقاء العمرة (علامة خاصة وميزانية مستقلة)" />
              <p className="text-xs text-ink-500">هذا اللقاء رقم {nextIndex} في {group.name}.</p>
            </div>
          ),
        },
        {
          title: 'المقدّم', valid: f.presenterMode !== 'members' || f.presenterIds.length > 0, hint: 'اختر مقدّماً واحداً على الأقل',
          content: (
            <div className="space-y-3">
              <Select value={f.presenterMode} onChange={(e) => set({ presenterMode: e.target.value as FocusMeeting['presenterMode'] })} options={[{ value: 'members', label: 'عضو أو أكثر من المجموعة' }, { value: 'guest', label: 'ضيف' }, { value: 'facilitator', label: 'أنا (الميسّر)' }, { value: 'none', label: 'بلا مقدّم' }]} aria-label="نوع المقدّم" />
              {f.presenterMode === 'guest' && <Field label="اسم الضيف"><Input value={f.guestName} onChange={(e) => set({ guestName: e.target.value })} /></Field>}
              {f.presenterMode === 'members' && group.memberIds.map((m) => {
                const on = f.presenterIds.includes(m);
                return (
                  <div key={m} className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => set({ presenterIds: on ? f.presenterIds.filter((x) => x !== m) : [...f.presenterIds, m] })} className={cx('chip min-h-[40px] border px-3', on ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink-200 text-ink-500')}>{on && <Icons.Check className="h-3 w-3" />}{personName(db, m)}</button>
                    <span className="text-xs text-ink-400">قدّم {db.focusMeetings.filter((x) => x.presenterIds.includes(m)).length} مرة</span>
                    {on && <Input className="flex-1" placeholder="المحور" value={f.axes[m] ?? ''} onChange={(e) => set({ axes: { ...f.axes, [m]: e.target.value } })} />}
                  </div>
                );
              })}
            </div>
          ),
        },
        {
          title: 'الموضوع والموعد', valid: (f.topicMode !== 'fixed' || !!f.topic.trim()) && f.end > f.start, hint: 'اكتب الموضوع، وتأكد أن النهاية بعد البداية',
          content: (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="الموضوع"><Select value={f.topicMode} onChange={(e) => set({ topicMode: e.target.value as FocusMeeting['topicMode'] })} options={[{ value: 'fixed', label: 'إلزامي' }, { value: 'options', label: 'خيارات' }, { value: 'free', label: 'حرية للمقدّم' }]} /></Field>
              {f.topicMode === 'fixed' ? <Field label="الموضوع الإلزامي"><Input value={f.topic} onChange={(e) => set({ topic: e.target.value })} /></Field>
                : f.topicMode === 'options' ? <Field label="الخيارات (افصل بـ ،)"><Input value={f.topicOptions} onChange={(e) => set({ topicOptions: e.target.value })} /></Field> : <div />}
              <Field label="التاريخ"><Select value={f.dateMode} onChange={(e) => set({ dateMode: e.target.value as FocusMeeting['dateMode'] })} options={[{ value: 'fixed', label: 'موعد إلزامي' }, { value: 'options', label: 'خيارات' }, { value: 'free', label: 'حرية للمقدّم' }]} /></Field>
              {f.dateMode === 'fixed' ? <Field label="الموعد"><Input type="date" value={f.date} onChange={(e) => set({ date: e.target.value })} /></Field>
                : f.dateMode === 'options' ? <Field label="التواريخ YYYY-MM-DD (افصل بـ ،)"><Input dir="ltr" value={f.dateOptions} onChange={(e) => set({ dateOptions: e.target.value })} /></Field> : <div />}
              <Field label="من"><Input type="time" value={f.start} onChange={(e) => set({ start: e.target.value })} /></Field>
              <Field label="إلى"><Input type="time" value={f.end} onChange={(e) => set({ end: e.target.value })} /></Field>
              <Field label="المكان" className="sm:col-span-2"><Input value={f.location} onChange={(e) => set({ location: e.target.value })} /></Field>
            </div>
          ),
        },
        {
          title: 'الميزانية',
          content: !hasSlot ? (
            <Notice tone="orange">هذا اللقاء رقم {nextIndex}، والحد الأعلى للقاءات بميزانية {max} لكل مجموعة. سيُنشأ اللقاء بلا ميزانية مرصودة، فلا يُطلب له ميزانية.</Notice>
          ) : !budgetReady ? (
            <Notice>{db.programBudget.setupDone ? 'الصرف على لقاءات التركيز غير مسموح حالياً.' : 'لم يُعدّ المسؤول المالي الميزانية بعد. أنشئ اللقاء الآن، واطلب الميزانية من صفحته بعد إعدادها.'}</Notice>
          ) : (
            <div className="space-y-3">
              <Toggle checked={requestBudget} onChange={setRequestBudget} label="أرسل طلب الميزانية مع إنشاء اللقاء" />
              {requestBudget && (
                <>
                  <Field label="المبلغ (ر.س)" hint={`المبلغ الافتراضي ${defaultAmount} حدده المسؤول المالي، ويمكنك تعديله`}>
                    <Input className="num" type="number" min={0} value={finalAmount} onChange={(e) => setAmount(Math.max(0, +e.target.value))} />
                  </Field>
                  <p className="text-xs text-ink-500">{finalAmount <= defaultAmount ? 'ضمن المرصود: يذهب الطلب لمسؤول اللجنة المالية مباشرة.' : 'يتجاوز المرصود: يذهب الطلب للقائد العام أولاً.'}</p>
                </>
              )}
            </div>
          ),
        },
      ]} />
    </Modal>
  );
}
