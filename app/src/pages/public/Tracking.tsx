// صفحة رابط المتابعة الحصري (قسم 15): بلا تسجيل دخول، بلا نقاط ولا مالية ولا بيانات شخصية
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { diffDays, fmtDate, fmtDateTime, todayISO } from '@/domain/dates';
import { tripTypeLabel } from '@/domain/labels';
import { focusDone, kpiValue, tripProgress, tripStage, tripStageLabel } from '@/domain/workflow';
import { RoleSwitcher } from '@/layout/AppShell';
import { act, repos, useDB } from '@/state/store';
import { Badge, Button, Card, Empty, Icons, Input, Progress, Textarea, Toasts } from '@/ui';
import { PlaceholderImage } from '@/ui/domain';

export default function TrackingPage() {
  const { token } = useParams();
  const db = useDB();
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const link = db.settings.trackingLink;
  const valid = link.active && link.token === token;
  const s = db.settings;

  if (!valid)
    return (
      <div className="min-h-screen bg-ink-50">
        <RoleSwitcher />
        <div className="mx-auto max-w-lg px-4 py-20">
          <img src="./brand/logo-horizontal.svg" alt="صقل" className="mx-auto mb-8 h-12" />
          <Empty title="الرابط غير صالح" text="هذا الرابط ملغى أو أُعيد توليده. اطلب الرابط الحالي من إدارة البرنامج." icon={<Icons.LinkIcon className="h-8 w-8" />} />
        </div>
      </div>
    );

  const total = Math.max(1, diffDays(s.program.endDate, s.program.startDate));
  const elapsed = Math.min(total, Math.max(0, diffDays(todayISO(), s.program.startDate)));
  const trips = [...db.trips].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const closed = trips.filter((t) => tripStage(db, t) === 'closed').length;
  const focusAll = db.focusMeetings;
  const focusTarget = s.targets.focusMeetingsPerGroup * db.groups.length;
  const participants = db.persons.filter((p) => p.kind === 'participant');
  const heldTrips = trips.filter((t) => ['live', 'closing', 'closed'].includes(tripStage(db, t)));
  const att = db.attendance.filter((a) => a.eventKind === 'trip' && heldTrips.some((t) => t.id === a.eventId));
  const attRate = att.length ? Math.round((att.filter((a) => a.present).length / att.length) * 100) : 0;
  const media = db.committees.find((c) => c.kind === 'media');
  const comments = db.trackingComments.filter((c) => c.status === 'visible');

  return (
    <div className="min-h-screen bg-ink-50">
      <RoleSwitcher />
      <header className="bg-brand-grad text-white">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="rounded-2xl bg-white px-4 py-2"><img src="./brand/logo-horizontal.svg" alt="صقل" className="h-10" /></div>
            <Badge className="bg-white/15 text-white">صفحة المتابعة · {s.program.cohort}</Badge>
          </div>
          <h1 className="mt-6 text-3xl font-black text-white">متابعة برنامج صقل</h1>
          <p className="mt-1 text-white/85">{fmtDate(s.program.startDate)} — {fmtDate(s.program.endDate)}</p>
          <div className="mt-5 max-w-xl">
            <div className="mb-1 flex justify-between text-sm text-white/90"><span>تقدّم البرنامج</span><span className="num">{Math.round((elapsed / total) * 100)}%</span></div>
            <div className="h-2.5 overflow-hidden rounded-full bg-white/20"><div className="h-full rounded-full bg-accent-grad" style={{ width: `${(elapsed / total) * 100}%` }} /></div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ['المشاركون', participants.length, Icons.Users],
            ['رحلات مغلقة', `${closed} / ${trips.length}`, Icons.MapPinned],
            ['لقاءات تركيز منعقدة', `${focusAll.filter(focusDone).length} / ${focusTarget}`, Icons.Target],
            ['نسبة حضور الرحلات', `${attRate}%`, Icons.CheckCheck],
          ].map(([l, v, I]: any) => (
            <div key={l} className="rounded-2xl bg-white p-4 shadow-card">
              <I className="h-5 w-5 text-brand-600" />
              <div className="num mt-2 text-2xl font-bold">{v}</div>
              <div className="text-xs text-ink-500">{l}</div>
            </div>
          ))}
        </div>

        {media && media.kpis.length > 0 && (
          <Card title="مؤشرات الأداء العامة">
            <div className="grid gap-4 md:grid-cols-3">
              {media.kpis.map((k) => {
                const v = kpiValue(db, media.id, k.taskTag);
                return (
                  <div key={k.id}>
                    <div className="mb-1 flex justify-between text-sm"><span>{k.title}</span><span className="num text-ink-500">{v}/{k.target}</span></div>
                    <Progress value={(v / k.target) * 100} />
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        <Card title="الرحلات واللقاءات" subtitle="حالة كل رحلة، وأين وصلت، وكم بقي لها">
          <div className="space-y-3">
            {trips.map((t) => {
              const st = tripStage(db, t);
              const left = diffDays(t.startDate, todayISO());
              return (
                <div key={t.id} className="rounded-2xl border border-ink-100 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-bold">{t.title}</div>
                      <div className="text-xs text-ink-500">{tripTypeLabel[t.type]} · {fmtDate(t.startDate)} · {t.executor.kind === 'staff' ? 'فريق العمل' : db.groups.find((g) => g.id === (t.executor as any).groupId)?.name}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={st === 'closed' ? 'green' : st === 'live' ? 'orange' : 'blue'}>{tripStageLabel[st]}</Badge>
                      {left > 0 && <span className="text-xs text-ink-500">بقي {left} يوماً</span>}
                    </div>
                  </div>
                  <Progress value={tripProgress(db, t)} className="mt-3" label />
                  {st === 'closed' && t.closure.publicReport && (
                    <div className="mt-3 rounded-xl bg-emerald-50/60 p-3">
                      <div className="text-xs font-bold text-emerald-800">تقرير الرحلة</div>
                      <p className="mt-1 text-sm text-ink-700">{t.closure.publicReport}</p>
                      <div className="mt-2 grid grid-cols-4 gap-2">
                        {t.closure.photos.slice(0, 4).map((p) => <PlaceholderImage key={p} className="aspect-video" />)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        <Card title="المشاركون حسب المجموعات">
          <div className="grid gap-4 md:grid-cols-4">
            {db.groups.map((g) => (
              <div key={g.id} className="rounded-2xl p-4" style={{ background: g.color + '10' }}>
                <div className="mb-2 font-bold" style={{ color: g.color }}>{g.name}</div>
                <ul className="space-y-1 text-sm text-ink-700">
                  {g.memberIds.map((m) => <li key={m}>{db.persons.find((p) => p.id === m)?.name}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </Card>

        <Card title="التعليقات">
          <div className="space-y-3">
            {comments.map((c) => (
              <div key={c.id} className="rounded-2xl bg-ink-50 p-3">
                <div className="text-xs text-ink-500"><b className="text-ink-800">{c.name}</b> · {fmtDateTime(c.at)}</div>
                <p className="mt-1 text-sm">{c.text}</p>
              </div>
            ))}
            <div className="grid gap-2 rounded-2xl border border-ink-100 p-3">
              <Input placeholder="اسمك (اختياري)" value={name} onChange={(e) => setName(e.target.value)} />
              <Textarea placeholder="اكتب تعليقك" value={text} onChange={(e) => setText(e.target.value)} />
              <div className="flex items-center justify-between">
                <span className="text-xs text-ink-400">{s.trackingCommentsNeedReview ? 'تظهر التعليقات بعد مراجعة الإدارة' : 'يظهر التعليق مباشرة'}</span>
                <Button size="sm" disabled={!text.trim()} onClick={() => act(() => { repos.settings.addTrackingComment(name, text); setText(''); }, s.trackingCommentsNeedReview ? 'أُرسل التعليق للمراجعة' : 'نُشر التعليق')}>إرسال</Button>
              </div>
            </div>
          </div>
        </Card>
      </main>
      <Toasts />
    </div>
  );
}
