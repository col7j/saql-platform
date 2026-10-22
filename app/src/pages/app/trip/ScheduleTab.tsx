// محرر الجدول الزمني (الخطط أ وب وما بعدها) + تحليل التصنيفات + المخطط مقابل الفعلي
import { useEffect, useState } from 'react';
import { fmtDate, fmtDateTime, fmtTime, minutesOf } from '@/domain/dates';
import { uid } from '@/domain/id';
import { tripTeamLeaderId } from '@/domain/permissions';
import { actualItems, categoryBreakdown, sortItems, tripHasStarted } from '@/domain/workflow';
import type { ScheduleItem, SchedulePlan, Trip, TripSession } from '@/domain/types';
import { act, personName, repos, useDB, useMe } from '@/state/store';
import { Badge, Button, Card, Empty, Field, Icons, Input, Modal, Notice, Select, Tabs } from '@/ui';

export default function ScheduleTab({ trip }: { trip: Trip }) {
  const db = useDB();
  const me = useMe();
  const canEdit = tripTeamLeaderId(db, trip) === me.person.id;
  const [plans, setPlans] = useState<SchedulePlan[]>(trip.schedule.plans);
  const [active, setActive] = useState(plans[0]?.id);
  const [dirty, setDirty] = useState(false);
  const [editing, setEditing] = useState<ScheduleItem | null>(null);
  const [note, setNote] = useState('');
  const [newSessions, setNewSessions] = useState<TripSession[]>([]);
  useEffect(() => { if (!dirty) setPlans(trip.schedule.plans); }, [trip.schedule.plans, dirty]);
  const plan = plans.find((p) => p.id === active) ?? plans[0];
  const cats = db.settings.scheduleCategories;
  const catOf = (id?: string) => cats.find((c) => c.id === id);
  const started = trip.published && tripHasStarted(trip);

  const updatePlan = (fn: (p: SchedulePlan) => SchedulePlan) => { setPlans(plans.map((p) => (p.id === plan.id ? fn(p) : p))); setDirty(true); };
  const saveItem = (item: ScheduleItem) => updatePlan((p) => ({ ...p, items: p.items.some((i) => i.id === item.id) ? p.items.map((i) => (i.id === item.id ? item : i)) : [...p.items, item] }));
  const save = () => act(() => {
    if (started && db.settings.scheduleEditAfterStartNeedsApproval) throw new Error('الإعدادات تتطلب موافقة الإدارة على التعديل بعد الانطلاق');
    repos.trips.saveSchedule(trip.id, plans, note || undefined, newSessions);
    setNewSessions([]);
    setDirty(false);
    setNote('');
  }, started ? 'حُفظ التعديل وسُجّل (يؤثر على التقييم)' : 'حُفظ الجدول');

  const days = [...new Set(sortItems(plan?.items ?? []).map((i) => i.date))];

  return (
    <div className="space-y-6">
      <Card
        title="الجدول الزمني"
        subtitle="كل بند: من ساعة إلى ساعة، تصنيف عام، وتفصيل. يمكن ربط البند بلقاء (محاضرة/دورة) له موادّه"
        action={canEdit && (
          <>
            <Button size="sm" variant="secondary" onClick={() => { const id = uid('pl'); setPlans([...plans, { id, name: `الخطة ${'أبجدهوز'[plans.length] ?? plans.length + 1}`, items: [] }]); setActive(id); setDirty(true); }} icon={<Icons.Plus className="h-4 w-4" />}>أضف خطة</Button>
            {plan && plans[0].id !== plan.id && <Button size="sm" variant="secondary" onClick={() => updatePlan((p) => ({ ...p, items: plans[0].items.map((i) => ({ ...i, id: uid('si'), sessionId: undefined })) }))}>انسخ من الخطة أ</Button>}
            <Button size="sm" onClick={() => setEditing({ id: uid('si'), date: trip.startDate, start: '08:00', end: '09:00', categoryId: cats[0].id, detail: '' })} icon={<Icons.Plus className="h-4 w-4" />}>أضف بنداً</Button>
          </>
        )}
      >
        <Tabs value={plan?.id ?? ''} onChange={setActive} tabs={plans.map((p) => ({ key: p.id, label: `${p.name} (${p.items.length})` }))} />
        {started && <Notice tone="orange">الرحلة انطلقت: أي تعديل الآن يُسجَّل في سجل التعديلات ويؤثر على التقييم{db.settings.scheduleEditAfterStartNeedsApproval ? '، ويتطلب موافقة الإدارة حسب الإعدادات' : ''}.</Notice>}
        {!plan || plan.items.length === 0 ? <Empty title="لا بنود في هذه الخطة" text={canEdit ? 'أضف بنود الجدول' : undefined} /> : (
          <div className="mt-3 space-y-5">
            {days.map((d) => (
              <div key={d}>
                <div className="mb-2 text-sm font-bold text-brand-700">{fmtDate(d, { weekday: true })}</div>
                <div className="space-y-1.5">
                  {sortItems(plan.items.filter((i) => i.date === d)).map((i) => {
                    const c = catOf(i.categoryId);
                    const session = trip.sessions.find((s) => s.id === i.sessionId);
                    return (
                      <div key={i.id} className="flex items-stretch gap-3 rounded-xl border border-ink-100 bg-white">
                        <span className="w-1.5 shrink-0 rounded-s-xl" style={{ background: c?.color }} />
                        <div className="num w-24 shrink-0 py-2 text-xs text-ink-500">{fmtTime(i.start)}<br />{fmtTime(i.end)}</div>
                        <div className="min-w-0 flex-1 py-2">
                          <div className="text-sm">{i.detail}</div>
                          <div className="mt-0.5 flex flex-wrap gap-1.5"><Badge>{c?.name ?? '—'}</Badge>{session && <Badge tone="blue" icon={<Icons.Presentation className="h-3 w-3" />}>لقاء: {session.title}</Badge>}</div>
                        </div>
                        {canEdit && (
                          <div className="flex items-center gap-1 pe-2">
                            <button onClick={() => setEditing(i)} className="rounded p-1 text-ink-400 hover:bg-ink-100"><Icons.Pencil className="h-4 w-4" /></button>
                            <button onClick={() => updatePlan((p) => ({ ...p, items: p.items.filter((x) => x.id !== i.id) }))} className="rounded p-1 text-ink-400 hover:bg-red-50 hover:text-red-600"><Icons.Trash2 className="h-4 w-4" /></button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
        {canEdit && dirty && (
          <div className="sticky bottom-3 mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-brand-200 bg-brand-50 p-3">
            <Input className="min-w-[200px] flex-1" placeholder={trip.published ? 'وصف التعديل (مثال: اعتذر الضيف فاستبدلنا الورشة)' : 'وصف التعديل (اختياري)'} value={note} onChange={(e) => setNote(e.target.value)} />
            <Button onClick={save}>احفظ الجدول</Button>
            <Button variant="ghost" onClick={() => { setPlans(trip.schedule.plans); setDirty(false); }}>تراجع</Button>
          </div>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Analysis trip={trip} />
        <Card title="سجل تعديلات الجدول" subtitle="التعديل بعد الانطلاق يُحتسب في التقييم">
          {trip.schedule.changes.length === 0 ? <p className="text-sm text-ink-400">لا تعديلات مسجّلة</p> : (
            <ul className="space-y-2">
              {trip.schedule.changes.map((c) => (
                <li key={c.id} className="flex items-start gap-2 text-sm">
                  {c.afterStart ? <Icons.AlertTriangle className="mt-0.5 h-4 w-4 text-accent-600" /> : <Icons.History className="mt-0.5 h-4 w-4 text-ink-400" />}
                  <div><div>{c.description}</div><div className="text-xs text-ink-400">{personName(db, c.byId)} · {fmtDateTime(c.at)} {c.afterStart && '· بعد الانطلاق'}</div></div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {editing && (
        <ItemModal item={editing} trip={trip} onClose={() => setEditing(null)}
          onSave={(i, sessionTitle) => {
            let item = i;
            if (sessionTitle && !i.sessionId) {
              const s: TripSession = { id: uid('ss'), title: sessionTitle, date: i.date, start: i.start, end: i.end };
              setNewSessions((x) => [...x, s]);
              item = { ...i, sessionId: s.id };
            }
            saveItem(item);
            setEditing(null);
          }} />
      )}
    </div>
  );
}

function ItemModal({ item, trip, onClose, onSave }: { item: ScheduleItem; trip: Trip; onClose: () => void; onSave: (i: ScheduleItem, sessionTitle?: string) => void }) {
  const db = useDB();
  const [i, setI] = useState(item);
  const [sessionTitle, setSessionTitle] = useState('');
  const days: string[] = [];
  for (let d = trip.startDate; d <= trip.endDate; d = new Date(new Date(d).getTime() + 86400000).toISOString().slice(0, 10)) days.push(d);
  const invalid = minutesOf(i.end) <= minutesOf(i.start) || !i.detail.trim();
  return (
    <Modal open onClose={onClose} title="بند في الجدول" footer={<><Button variant="secondary" onClick={onClose}>إلغاء</Button><Button disabled={invalid} onClick={() => onSave(i, sessionTitle.trim() || undefined)}>احفظ البند</Button></>}>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="اليوم"><Select value={i.date} onChange={(e) => setI({ ...i, date: e.target.value })} options={days.map((d) => ({ value: d, label: fmtDate(d) }))} /></Field>
        <Field label="من"><Input type="time" value={i.start} onChange={(e) => setI({ ...i, start: e.target.value })} /></Field>
        <Field label="إلى"><Input type="time" value={i.end} onChange={(e) => setI({ ...i, end: e.target.value })} /></Field>
        <Field label="التصنيف العام" className="sm:col-span-3"><Select value={i.categoryId} onChange={(e) => setI({ ...i, categoryId: e.target.value })} options={db.settings.scheduleCategories.map((c) => ({ value: c.id, label: c.name }))} /></Field>
        <Field label="التفصيل" className="sm:col-span-3"><Input value={i.detail} onChange={(e) => setI({ ...i, detail: e.target.value })} placeholder="مثال: محاضرة عن القيادة بالقدوة" /></Field>
        {!i.sessionId && <Field label="ربط بلقاء جديد (اختياري)" hint="اللقاء داخل الرحلة له موادّه الخاصة في المكتبة" className="sm:col-span-3"><Input value={sessionTitle} onChange={(e) => setSessionTitle(e.target.value)} placeholder="عنوان اللقاء/المحاضرة" /></Field>}
      </div>
      {minutesOf(i.end) <= minutesOf(i.start) && <p className="mt-2 text-xs text-red-600">وقت النهاية يجب أن يكون بعد البداية</p>}
    </Modal>
  );
}

function Analysis({ trip }: { trip: Trip }) {
  const db = useDB();
  const cats = db.settings.scheduleCategories;
  const planned = categoryBreakdown(trip.schedule.plans[0]?.items ?? []);
  const rows = actualItems(db, trip);
  const actual = categoryBreakdown(rows.filter((r) => r.actual).map((r) => r.actual!));
  const hasActual = actual.sum > 0;
  return (
    <Card title="تحليل التصنيفات" subtitle={hasActual ? 'نسبة كل تصنيف من وقت الرحلة: المخطط مقابل الفعلي' : 'نسبة كل تصنيف من وقت الرحلة (المخطط)'}>
      {planned.sum === 0 ? <p className="text-sm text-ink-400">أضف بنوداً لرؤية التحليل</p> : (
        <div className="space-y-2.5">
          {cats.filter((c) => planned.totals[c.id] || actual.totals[c.id]).map((c) => {
            const p = ((planned.totals[c.id] ?? 0) / planned.sum) * 100;
            const a = hasActual ? ((actual.totals[c.id] ?? 0) / actual.sum) * 100 : 0;
            return (
              <div key={c.id}>
                <div className="mb-1 flex justify-between text-xs"><span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: c.color }} />{c.name}</span><span className="num text-ink-500">{Math.round(p)}%{hasActual && ` ← فعلي ${Math.round(a)}%`}</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-ink-100"><div className="h-full rounded-full" style={{ width: `${p}%`, background: c.color }} /></div>
                {hasActual && <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-ink-100"><div className="h-full rounded-full opacity-50" style={{ width: `${a}%`, background: c.color }} /></div>}
              </div>
            );
          })}
          <p className="pt-1 text-xs text-ink-400">إجمالي المخطط: {Math.round(planned.sum / 60)} ساعة{hasActual && ` · الموثّق فعلياً: ${Math.round(actual.sum / 60)} ساعة`}</p>
        </div>
      )}
    </Card>
  );
}
