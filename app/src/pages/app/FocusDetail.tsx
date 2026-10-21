import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { fmtDate, fmtTime, todayISO } from '@/domain/dates';
import { SAR, focusStatusLabel, focusStatusTone, materialTypeLabel } from '@/domain/labels';
import { canManageFocus, canTakeFocusAttendance, canSeeFinance } from '@/domain/permissions';

import type { FocusMeeting } from '@/domain/types';
import { act, personName, repos, useDB, useMe } from '@/state/store';
import { Badge, Button, Card, Empty, Field, Icons, Input, KeyVal, Notice, PageHeader, Select, Stars, Steps, cx } from '@/ui';
import { GroupBadge, PersonChip } from '@/ui/domain';
import { BudgetEditor } from './BudgetEditor';
import { CustodyCard } from './CustodyCard';

export default function FocusDetail() {
  const { id } = useParams();
  const db = useDB();
  const me = useMe();
  const f = db.focusMeetings.find((x) => x.id === id);
  if (!f) return <Empty title="اللقاء غير موجود" />;
  const g = db.groups.find((x) => x.id === f.groupId)!;
  const isFac = canManageFocus(db, me.person.id, f);
  const isPresenter = f.presenterIds.includes(me.person.id);
  const canAttend = canTakeFocusAttendance(db, me.person.id, f);
  const custody = db.custodies.find((c) => c.ownerKind === 'focus' && c.ownerId === f.id);
  const steps = (['draft', 'published', 'held', 'closed'] as const).map((s, i, arr) => ({ label: focusStatusLabel[s], state: (arr.indexOf(f.status) > i ? 'done' : arr.indexOf(f.status) === i ? 'current' : 'todo') as 'done' | 'current' | 'todo' }));

  return (
    <div>
      <PageHeader back="/app/focus" title={f.title}
        subtitle={<span className="flex flex-wrap items-center gap-2"><GroupBadge id={f.groupId} />{f.isUmrah && <Badge tone="green" icon={<Icons.Moon className="h-3 w-3" />}>لقاء العمرة</Badge>}<Badge tone={focusStatusTone[f.status]}>{focusStatusLabel[f.status]}</Badge></span>}
        actions={isFac && f.status === 'draft' && <Button onClick={() => act(() => repos.focus.publish(f.id), 'نُشر اللقاء ووصل التنبيه للمجموعة')} icon={<Icons.Send className="h-4 w-4" />}>نشر اللقاء</Button>}
      />
      <div className="mb-5 rounded-2xl border border-ink-100 bg-white p-3 shadow-card"><Steps steps={steps} /></div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {isPresenter && f.status !== 'closed' && <PresenterPrep f={f} />}
          <AttendanceCard f={f} canAttend={canAttend} isFac={isFac} />
          {(f.status === 'held' || f.status === 'closed') && (isFac || me.isStaff || isPresenter) && <EvaluationCard f={f} isFac={isFac} />}
          <FilesCard f={f} canUpload={isPresenter || isFac} />
        </div>
        <div className="space-y-6">
          <Card title="التفاصيل">
            <KeyVal k="الموضوع" v={f.topic ?? (f.topicMode === 'options' ? `خيارات: ${f.topicOptions.join('، ')}` : 'بحرية المقدّم')} />
            <KeyVal k="التاريخ" v={f.date ? fmtDate(f.date, { hijri: db.settings.showHijri }) : f.dateOptions.length ? f.dateOptions.map((d) => fmtDate(d)).join(' / ') : 'بحرية المقدّم'} />
            <KeyVal k="الوقت" v={`${fmtTime(f.start)} – ${fmtTime(f.end)}`} />
            <KeyVal k="المكان" v={f.location || '—'} />
            <KeyVal k="المقدّم" v={f.presenterMode === 'guest' ? f.guestName : f.presenterMode === 'facilitator' ? personName(db, g.facilitatorId) : f.presenterMode === 'none' ? 'لا أحد' : <div className="space-y-1">{f.presenterIds.map((p) => <PersonChip key={p} id={p} size={22} sub={f.presenterAxes[p]} />)}</div>} />
            <KeyVal k="الميسّر" v={<PersonChip id={g.facilitatorId} size={22} />} />
            <KeyVal k="المحضّر" v={<PersonChip id={f.attendanceTakerId ?? g.leaderId} size={22} sub={f.attendanceTakerId ? 'نائب لهذا اللقاء' : 'قائد المجموعة'} />} />
          </Card>
          {(isFac || canSeeFinance(db, me.person.id)) && (
            <Card title="الميزانية" subtitle={f.isUmrah ? 'لقاء العمرة: ميزانية أعلى ودورة مبسطة' : undefined}>
              {f.budget.lines.length === 0 ? <p className="text-sm text-ink-400">بدون ميزانية</p> : <BudgetEditor lines={f.budget.lines} ownerKind="focus" readOnly />}
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                <Badge tone={f.budget.status === 'accepted' || f.budget.status === 'accepted_lower' ? 'green' : f.budget.status === 'revise' ? 'red' : 'orange'}>
                  {{ none: '—', pending: 'بانتظار المالية', accepted: 'مقبولة', revise: 'مطلوب تعديل البنود', accepted_lower: 'مقبولة بمبلغ أقل' }[f.budget.status]}
                </Badge>
                {f.budget.approvedAmount != null && <span className="num">المعتمد: {SAR(f.budget.approvedAmount)}</span>}
              </div>
              {f.budget.financeNote && <p className="mt-1 text-xs text-ink-500">ملاحظة المالية: {f.budget.financeNote}</p>}
              {isFac && f.budget.status === 'revise' && <Button size="sm" className="mt-2" onClick={() => act(() => repos.focus.update(f.id, { budget: { ...f.budget, status: 'pending' } }), 'أُعيد الإرسال للمالية')}>إعادة الإرسال للمالية</Button>}
            </Card>
          )}
          {custody && (custody.recipientId === me.person.id || canSeeFinance(db, me.person.id)) && <CustodyCard custody={custody} />}
        </div>
      </div>
    </div>
  );
}

function PresenterPrep({ f }: { f: FocusMeeting }) {
  const [topic, setTopic] = useState(f.topic ?? '');
  const [date, setDate] = useState(f.date ?? f.dateOptions[0] ?? '');
  const [start, setStart] = useState(f.start ?? '20:00');
  return (
    <Card title="تجهيزي كمقدّم" subtitle="جهّز وحدد التفاصيل (الموضوع والتوقيت) حسب ما سمح به الميسّر">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="الموضوع">
          {f.topicMode === 'fixed' ? <Input value={f.topic ?? ''} disabled /> : f.topicMode === 'options' ? <Select value={topic} onChange={(e) => setTopic(e.target.value)} options={[{ value: '', label: 'اختر' }, ...f.topicOptions.map((o) => ({ value: o, label: o }))]} /> : <Input value={topic} onChange={(e) => setTopic(e.target.value)} />}
        </Field>
        <Field label="التاريخ">
          {f.dateMode === 'fixed' ? <Input value={fmtDate(f.date)} disabled /> : f.dateMode === 'options' ? <Select value={date} onChange={(e) => setDate(e.target.value)} options={f.dateOptions.map((o) => ({ value: o, label: fmtDate(o) }))} /> : <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />}
        </Field>
        <Field label="الوقت"><Input type="time" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
      </div>
      <Button className="mt-3" onClick={() => act(() => repos.focus.update(f.id, { topic: topic || f.topic, date: date || f.date, start }), 'حُفظت التفاصيل')}>حفظ التفاصيل</Button>
    </Card>
  );
}

function AttendanceCard({ f, canAttend, isFac }: { f: FocusMeeting; canAttend: boolean; isFac: boolean }) {
  const db = useDB();
  const me = useMe();
  const g = db.groups.find((x) => x.id === f.groupId)!;
  const isLeader = g.leaderId === me.person.id;
  const rec = (pid: string) => db.attendance.find((a) => a.eventKind === 'focus' && a.eventId === f.id && a.personId === pid);
  const dayCame = f.date ? f.date <= todayISO() : false;
  const open = f.status === 'published' && dayCame;
  return (
    <Card title="الحضور" subtitle="قائد المجموعة يحضّر (لأن المقدّم قد يكون الميسّر أو ضيفاً). إن تعذّر حضوره يكلّف نائباً لهذا اللقاء فقط">
      {(isLeader || isFac) && f.status !== 'closed' && (
        <Field label="نائب التحضير لهذا اللقاء فقط" className="mb-3 max-w-xs">
          <Select value={f.attendanceTakerId ?? ''} onChange={(e) => repos.focus.update(f.id, { attendanceTakerId: e.target.value || undefined })} options={[{ value: '', label: 'قائد المجموعة' }, ...g.memberIds.filter((m) => m !== g.leaderId).map((m) => ({ value: m, label: personName(db, m) }))]} />
        </Field>
      )}
      {!dayCame && f.status === 'published' && <Notice>يُفتح التحضير يوم اللقاء.</Notice>}
      <div className="grid gap-2 sm:grid-cols-2">
        {g.memberIds.map((pid) => {
          const r = rec(pid);
          return (
            <div key={pid} className="flex items-center justify-between rounded-xl border border-ink-100 px-3 py-2">
              <PersonChip id={pid} size={24} />
              {canAttend && open ? (
                <div className="flex overflow-hidden rounded-lg border border-ink-200 text-xs">
                  <button onClick={() => repos.trips.setAttendance('focus', f.id, pid, true)} className={cx('px-2.5 py-1', r?.present === true ? 'bg-emerald-600 text-white' : '')}>حاضر</button>
                  <button onClick={() => repos.trips.setAttendance('focus', f.id, pid, false)} className={cx('px-2.5 py-1', r?.present === false ? 'bg-red-600 text-white' : '')}>غائب</button>
                </div>
              ) : r ? <Badge tone={r.present ? 'green' : 'red'}>{r.present ? 'حاضر' : 'غائب'}</Badge> : <span className="text-xs text-ink-300">—</span>}
            </div>
          );
        })}
      </div>
      {canAttend && open && <Button className="mt-3" onClick={() => act(() => repos.focus.markHeld(f.id), 'أُغلق التحضير وأُرسل الاستبيان الاختياري')}>تأكيد التحضير وإنهاء اللقاء</Button>}
    </Card>
  );
}

function EvaluationCard({ f, isFac }: { f: FocusMeeting; isFac: boolean }) {
  const db = useDB();
  const crit = db.settings.presentationCriteria;
  const [scores, setScores] = useState<Record<string, Record<string, number>>>(f.presenterEvaluations);
  const editable = isFac && f.status === 'held';
  return (
    <Card title="تقييم أداء المقدّمين" subtitle="المشاركون لا يقيّمون بل يعبّئون استبياناً اختيارياً. الميسّر يقيّم المقدّم فيكسب نقاط التقديم ثم يغلق اللقاء">
      {f.presenterIds.length === 0 ? <p className="text-sm text-ink-400">لا مقدّمون من المشاركين في هذا اللقاء</p> : (
        <div className="space-y-4">
          {f.presenterIds.map((p) => (
            <div key={p} className="rounded-2xl border border-ink-100 p-3">
              <PersonChip id={p} sub={f.presenterAxes[p]} />
              <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                {crit.map((c) => (
                  <div key={c.key} className="flex items-center justify-between text-sm">
                    <span>{c.name}</span>
                    <Stars value={scores[p]?.[c.key]} onChange={editable ? (v) => setScores({ ...scores, [p]: { ...scores[p], [c.key]: v } }) : undefined} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {editable && (
        <Button className="mt-4" onClick={() => act(() => {
          f.presenterIds.forEach((p) => { if (crit.some((c) => !scores[p]?.[c.key])) throw new Error('أكمل تقييم كل المعايير'); });
          f.presenterIds.forEach((p) => repos.focus.evaluatePresenter(f.id, p, scores[p]));
          repos.focus.close(f.id);
        }, 'حُفظ التقييم وأُغلق اللقاء')} icon={<Icons.Lock className="h-4 w-4" />}>حفظ التقييم وإغلاق اللقاء</Button>
      )}
    </Card>
  );
}

function FilesCard({ f, canUpload }: { f: FocusMeeting; canUpload: boolean }) {
  const db = useDB();
  const [title, setTitle] = useState('');
  const files = db.materials.filter((m) => m.focusMeetingId === f.id);
  return (
    <Card title="الملفات المعرفية" subtitle="اختياري: يرفعها المقدّم بعد اللقاء">
      {files.length === 0 && <p className="text-sm text-ink-400">لا ملفات</p>}
      <div className="space-y-1.5">
        {files.map((m) => <div key={m.id} className="flex items-center gap-2 rounded-xl border border-ink-100 px-3 py-2 text-sm"><Icons.FileText className="h-4 w-4 text-brand-600" />{m.title}<Badge className="ms-auto">{materialTypeLabel[m.type]}</Badge></div>)}
      </div>
      {canUpload && (
        <div className="mt-3 flex gap-2">
          <Input placeholder="عنوان الملف" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Button disabled={!title} onClick={() => act(() => { repos.materials.add({ title, type: 'pdf', url: 'https://example.com', origin: 'focus', focusMeetingId: f.id, revealMode: 'auto', revealed: true, audience: { kind: 'group', groupId: f.groupId } }); setTitle(''); }, 'رُفع الملف')}>رفع</Button>
        </div>
      )}
    </Card>
  );
}
