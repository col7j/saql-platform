// إعدادات الإشعارات والبريد (مسؤول اللجنة التقنية وحده): جدول القواعد، والنوافذ والسقوف، والقوالب، وسجل البريد
import { useState } from 'react';
import { fmtDateTime } from '@/domain/dates';
import { notificationTypeLabel } from '@/domain/labels';
import { fillTemplate } from '@/domain/notifyRules';
import type { EmailSettings, NotificationRule, NotificationType, RecipientRole } from '@/domain/types';
import { act, repos, useDB, useMe } from '@/state/store';
import { Badge, Button, Card, Empty, Field, Input, Notice, Select, Table, Tabs, Toggle } from '@/ui';
import { PersonChip } from '@/ui/domain';

const ROLE_LABEL: Record<RecipientRole, string> = { participant: 'المشارك', group_leader: 'قائد المجموعة', facilitator: 'الميسّر', staff: 'فريق العمل', leader: 'القائد العام ومساعده', finance: 'المالية', media: 'الإعلامية' };
const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const STATUS = { sent: ['أُرسل', 'green'], deferred: ['مؤجّل', 'orange'], skipped: ['مُخطّى', 'gray'], disabled: ['معطّل', 'red'] } as const;

export default function NotifyAdmin() {
  const [tab, setTab] = useState<'rules' | 'limits' | 'templates' | 'log'>('rules');
  return (
    <div className="space-y-4">
      <Notice tone="orange">لا يُرسل بريد فعلي في النموذج: يُحاكى ويظهر في «سجل البريد». المنصة الحقيقية تحتاج مزوّد بريد وطابور رسائل ومجدوِلاً للتذكيرات.</Notice>
      <Tabs value={tab} onChange={setTab} tabs={[{ key: 'rules', label: 'القواعد' }, { key: 'limits', label: 'النوافذ والسقوف' }, { key: 'templates', label: 'القوالب' }, { key: 'log', label: 'سجل البريد' }]} />
      {tab === 'rules' && <Rules />}
      {tab === 'limits' && <Limits />}
      {tab === 'templates' && <Templates />}
      {tab === 'log' && <Log />}
    </div>
  );
}

function Rules() {
  const db = useDB();
  const rules = db.settings.notifyRules;
  const save = (next: NotificationRule[]) => act(() => repos.settings.update({ notifyRules: next }));
  const patch = (t: NotificationType, p: Partial<NotificationRule>) => save(rules.map((r) => (r.type === t ? { ...r, ...p } : r)));
  return (
    <Card pad={false}>
      <Table>
        <thead><tr><th>الحدث</th><th>يعمل</th><th>بريد</th><th>التذكيرات (ساعات قبل الموعد)</th><th>المستلمون</th></tr></thead>
        <tbody>
          {rules.map((r) => (
            <tr key={r.type}>
              <td>{notificationTypeLabel[r.type]}</td>
              <td><Toggle checked={r.enabled} onChange={(v) => patch(r.type, { enabled: v })} label={<span className="sr-only">تشغيل</span>} /></td>
              <td><Toggle checked={r.email} onChange={(v) => patch(r.type, { email: v })} label={<span className="sr-only">بريد</span>} /></td>
              <td>
                <div className="flex flex-wrap items-center gap-1">
                  {r.reminders.map((h) => <button key={h} className="rounded-full bg-brand-50 px-2 py-1 text-xs" title="احذف التذكير" onClick={() => patch(r.type, { reminders: r.reminders.filter((x) => x !== h) })}>{h} ساعة ✕</button>)}
                  <AddHours onAdd={(h) => patch(r.type, { reminders: [...new Set([...r.reminders, h])].sort((a, b) => b - a) })} />
                </div>
              </td>
              <td>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(ROLE_LABEL) as RecipientRole[]).map((role) => (
                    <label key={role} className="flex items-center gap-1 text-xs"><input type="checkbox" checked={r.recipients.includes(role)} onChange={() => patch(r.type, { recipients: r.recipients.includes(role) ? r.recipients.filter((x) => x !== role) : [...r.recipients, role] })} />{ROLE_LABEL[role]}</label>
                  ))}
                </div>
                <div className="text-[11px] text-ink-400">بلا اختيار = كل المستلمين</div>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}
function AddHours({ onAdd }: { onAdd: (h: number) => void }) {
  const [v, setV] = useState('');
  return (
    <form className="flex items-center gap-1" onSubmit={(e) => { e.preventDefault(); const h = +v; if (h > 0) { onAdd(h); setV(''); } }}>
      <Input className="num w-16" type="number" min={1} value={v} onChange={(e) => setV(e.target.value)} placeholder="ساعات" aria-label="تذكير جديد بالساعات" />
      <Button type="submit" variant="secondary">أضف</Button>
    </form>
  );
}

function Limits() {
  const db = useDB();
  const e = db.settings.email;
  const set = (p: Partial<EmailSettings>) => act(() => repos.settings.update({ email: { ...e, ...p } }), 'حُفظ');
  const [ex, setEx] = useState('');
  return (
    <div className="space-y-4">
      <Card title="حدود الإرسال">
        <div className="grid gap-3 sm:grid-cols-4">
          <Toggle checked={e.masterOff} onChange={(v) => set({ masterOff: v })} label="إيقاف كل البريد" />
          <Field label="سقف اليوم (عام)"><Input type="number" min={0} className="num" value={e.dailyCap} onChange={(x) => set({ dailyCap: +x.target.value })} /></Field>
          <Field label="سقف اليوم للمستخدم"><Input type="number" min={0} className="num" value={e.perUserCap} onChange={(x) => set({ perUserCap: +x.target.value })} /></Field>
          <Field label="عند بلوغ السقف"><Select value={e.onCap} onChange={(x) => set({ onCap: x.target.value as 'defer' | 'skip' })} options={[{ value: 'defer', label: 'تأجيل للنافذة التالية' }, { value: 'skip', label: 'تخطٍّ' }]} /></Field>
        </div>
      </Card>
      <Card title="نوافذ الإرسال" subtitle="أيام وساعات مسموحة، وما خارجها يُؤجَّل">
        {e.windows.map((w, i) => (
          <div key={i} className="mb-2 flex flex-wrap items-center gap-2 text-sm">
            {DAYS.map((d, k) => <label key={d} className="flex items-center gap-1 text-xs"><input type="checkbox" checked={w.days.includes(k)} onChange={() => set({ windows: e.windows.map((x, j) => (j === i ? { ...x, days: x.days.includes(k) ? x.days.filter((y) => y !== k) : [...x.days, k] } : x)) })} />{d}</label>)}
            <Input type="time" value={w.from} onChange={(x) => set({ windows: e.windows.map((y, j) => (j === i ? { ...y, from: x.target.value } : y)) })} aria-label="من" />
            <Input type="time" value={w.to} onChange={(x) => set({ windows: e.windows.map((y, j) => (j === i ? { ...y, to: x.target.value } : y)) })} aria-label="إلى" />
            <Button variant="ghost" onClick={() => set({ windows: e.windows.filter((_, j) => j !== i) })}>احذف</Button>
          </div>
        ))}
        <Button variant="secondary" onClick={() => set({ windows: [...e.windows, { days: [0, 1, 2, 3, 4], from: '08:00', to: '22:00' }] })}>أضف نافذة</Button>
        <div className="mt-4 border-t border-ink-100 pt-3">
          <div className="mb-2 text-sm font-medium">استثناءات بتواريخ (يوم بلا إرسال)</div>
          <div className="flex flex-wrap items-center gap-2">
            {e.exceptions.map((x) => <button key={x.date} className="rounded-full bg-ink-100 px-3 py-1 text-xs" onClick={() => set({ exceptions: e.exceptions.filter((y) => y.date !== x.date) })}>{x.date} ✕</button>)}
            <Input type="date" value={ex} onChange={(x) => setEx(x.target.value)} aria-label="تاريخ الاستثناء" />
            <Button variant="secondary" disabled={!ex} onClick={() => { set({ exceptions: [...e.exceptions, { date: ex, closed: true }] }); setEx(''); }}>أضف</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function Templates() {
  const db = useDB();
  const me = useMe();
  const e = db.settings.email;
  const rules = db.settings.notifyRules.filter((r) => r.email);
  const [type, setType] = useState<NotificationType>(rules[0]?.type ?? 'general');
  const tpl = e.templates[type] ?? { subject: '', body: '' };
  const set = (p: Partial<typeof tpl>) => act(() => repos.settings.update({ email: { ...e, templates: { ...e.templates, [type]: { ...tpl, ...p } } } }));
  const preview = fillTemplate(tpl.body, { اسم_اللقاء: 'لقاء تجريبي', الموعد: 'السبت 10:00', الرابط: '#/app' });
  return (
    <Card title="قوالب البريد" subtitle="المتغيرات: {اسم_اللقاء} {الموعد} {الرابط}">
      <div className="grid gap-3">
        <Select value={type} onChange={(x) => setType(x.target.value as NotificationType)} options={rules.map((r) => ({ value: r.type, label: notificationTypeLabel[r.type] }))} aria-label="الحدث" />
        <Field label="العنوان"><Input value={tpl.subject} onChange={(x) => set({ subject: x.target.value })} /></Field>
        <Field label="النص"><Input value={tpl.body} onChange={(x) => set({ body: x.target.value })} /></Field>
        <div className="rounded-xl bg-ink-50 p-3 text-sm"><b>المعاينة:</b> {fillTemplate(tpl.subject, { اسم_اللقاء: 'لقاء تجريبي', الموعد: '', الرابط: '' })}<p className="mt-1 text-ink-600">{preview}</p></div>
        <div><Button variant="secondary" onClick={() => act(() => repos.settings.testEmail(type, me.person.id), 'أُضيف إرسال تجريبي إلى السجل')}>إرسال تجريبي</Button></div>
      </div>
    </Card>
  );
}

function Log() {
  const db = useDB();
  const [status, setStatus] = useState('');
  const list = db.emailLog.filter((x) => !status || x.status === status);
  return (
    <div>
      <div className="mb-3 max-w-xs"><Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="الحالة" options={[{ value: '', label: 'كل الحالات' }, ...Object.entries(STATUS).map(([k, v]) => ({ value: k, label: v[0] }))]} /></div>
      {!list.length ? <Empty title="لا رسائل بعد" text="تظهر هنا كل رسالة بريد أنشأتها المنصة وحالتها" /> : (
        <Card pad={false}><Table>
          <thead><tr><th>الوقت</th><th>إلى</th><th>الحدث</th><th>العنوان</th><th>الحالة</th><th>السبب</th></tr></thead>
          <tbody>{list.slice(0, 200).map((x) => <tr key={x.id}><td className="num text-xs">{fmtDateTime(x.at)}</td><td><PersonChip id={x.toId} size={22} /></td><td className="text-xs">{notificationTypeLabel[x.type]}</td><td className="text-xs">{x.subject}</td><td><Badge tone={STATUS[x.status][1]}>{STATUS[x.status][0]}{x.test ? ' (تجريبي)' : ''}</Badge></td><td className="text-xs text-ink-500">{x.reason}</td></tr>)}</tbody>
        </Table></Card>
      )}
    </div>
  );
}
