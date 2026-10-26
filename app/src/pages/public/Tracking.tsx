// رابط الداعم: رابط واحد ثابت يفتح بكلمة مرور لكل جهة (داعم أو شريك)، مع حد للمحاولات الخاطئة.
// ترتيب الصفحة من الأعلى: الشعارات، فكرة البرنامج، فريق العمل (بالأرقام)، المتميزون، المجموعات، جدول المشاركين، الرحلات.
import { useState } from 'react';
import { fmtDate, fmtDateTime, fmtTime } from '@/domain/dates';
import { tripTypeLabel } from '@/domain/labels';
import { publicTripView, supporterLocked } from '@/domain/supporter';
import { RoleSwitcher } from '@/layout/AppShell';
import { act, repos, useDB } from '@/state/store';
import { Badge, Button, Card, Icons, Input, Notice, Textarea, Toasts, cx } from '@/ui';
import { PlaceholderImage } from '@/ui/domain';
import { GroupsTable, LogoStrip, ParticipantsTable, StaffList, TopFive } from '@/ui/publicBlocks';
import type { Trip } from '@/domain/types';

const SESSION_KEY = 'saql.supporter';
function readSession(): string | null {
  try { return sessionStorage.getItem(SESSION_KEY); } catch { return null; }
}
function writeSession(id: string | null) {
  try { if (id) sessionStorage.setItem(SESSION_KEY, id); else sessionStorage.removeItem(SESSION_KEY); } catch { /* تجاهل */ }
}

export default function SupporterPage() {
  const db = useDB();
  const [entityId, setEntityId] = useState<string | null>(readSession());
  const entity = db.supporters.find((s) => s.id === entityId && s.active);
  if (!entity) return <SupporterLogin onIn={(id) => { writeSession(id); setEntityId(id); }} />;
  return <SupporterView entityId={entity.id} onOut={() => { writeSession(null); setEntityId(null); }} />;
}

function SupporterLogin({ onIn }: { onIn: (id: string) => void }) {
  const db = useDB();
  const [pw, setPw] = useState('');
  const locked = supporterLocked(db);
  const left = db.settings.supporterLink.maxAttempts - db.supporterAccess.failed;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    act(() => {
      const id = repos.supporters.login(pw);
      if (!id) throw new Error('كلمة المرور غير صحيحة');
      onIn(id);
    });
  };
  return (
    <div className="min-h-screen bg-ink-50">
      <RoleSwitcher />
      <div className="mx-auto max-w-sm px-4 py-20">
        <img src="./brand/logo-horizontal.svg" alt="صقل" className="mx-auto mb-8 h-12" />
        <Card title="رابط الداعمين والشركاء" subtitle="ادخل بكلمة المرور الخاصة بجهتك">
          <form onSubmit={submit} className="space-y-3">
            <Input type="password" dir="ltr" value={pw} onChange={(e) => setPw(e.target.value)} disabled={!!locked} autoComplete="current-password" aria-label="كلمة المرور" />
            {locked ? <Notice tone="red">{locked}</Notice> : db.supporterAccess.failed > 0 && <p className="text-xs text-accent-700">بقي {left} محاولات قبل القفل المؤقت</p>}
            <Button className="w-full" type="submit" disabled={!pw || !!locked}>ادخل</Button>
          </form>
        </Card>
      </div>
      <Toasts />
    </div>
  );
}

function SupporterView({ entityId, onOut }: { entityId: string; onOut: () => void }) {
  const db = useDB();
  const entity = db.supporters.find((s) => s.id === entityId)!;
  const trips = [...db.trips].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const comments = db.trackingComments.filter((c) => c.status === 'visible');
  return (
    <div className="min-h-screen bg-ink-50">
      <RoleSwitcher />
      <header className="bg-white">
        <div className="mx-auto max-w-6xl space-y-4 px-4 py-6 text-center">
          {/* 1) شعارات الداعمين والشركاء فوق شعار البرنامج */}
          <LogoStrip placement="above" />
          <img src="./brand/logo-horizontal.svg" alt="صقل" className="mx-auto h-12" />
          <LogoStrip placement="below" />
          <div className="flex items-center justify-center gap-2 text-xs text-ink-500">مرحباً {entity.name} · <button className="text-brand-600" onClick={onOut}>خروج</button></div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <Card title="فكرة البرنامج"><p className="leading-8 text-ink-700">{db.settings.supporterLink.programIdea}</p></Card>
        <Card title="فريق العمل" subtitle="بموافقة ضمنية ضمن الشروط والأحكام العامة"><StaffList withPhone /></Card>
        <Card title="المشاركون المتميزون"><TopFive /></Card>
        <Card title="المجموعات"><GroupsTable /></Card>
        <Card title="المشاركون"><ParticipantsTable /></Card>
        <Card title="الرحلات">
          <div className="space-y-3">{trips.map((t) => <TripBlock key={t.id} trip={t} />)}</div>
        </Card>
        <Card title="التعليقات" subtitle="يظهر التعليق بعد موافقة فريق رابط المتابعة">
          <div className="space-y-3">
            {comments.map((c) => <div key={c.id} className="rounded-2xl bg-ink-50 p-3"><div className="text-xs text-ink-500"><b className="text-ink-800">{c.name}</b> · {fmtDateTime(c.at)}</div><p className="mt-1 text-sm">{c.text}</p></div>)}
            <CommentBox entityId={entityId} />
          </div>
        </Card>
      </main>
      <Toasts />
    </div>
  );
}

function CommentBox({ entityId }: { entityId: string }) {
  const [text, setText] = useState('');
  const [name, setName] = useState('');
  return (
    <div className="grid gap-2 rounded-2xl border border-ink-100 p-3">
      <Input placeholder="الاسم (اختياري، الافتراضي اسم الجهة)" value={name} onChange={(e) => setName(e.target.value)} />
      <Textarea placeholder="اكتب تعليقك" value={text} onChange={(e) => setText(e.target.value)} />
      <Button size="sm" disabled={!text.trim()} onClick={() => act(() => { repos.supporters.comment(entityId, name, text); setText(''); }, 'أُرسل التعليق للمراجعة')}>أرسل</Button>
    </div>
  );
}

/** حالات الرحلة: قبلها ضبابية مع قفل، ويومها الجدول الفعلي حياً، وبعدها (بعد الإغلاق الكامل واعتماد التقرير) الصور والتقرير والتوثيق */
function TripBlock({ trip: t }: { trip: Trip }) {
  const db = useDB();
  const v = publicTripView(db, t);
  return (
    <div className={cx('relative overflow-hidden rounded-2xl border border-ink-100 bg-white p-4', v.state === 'before' && 'bg-ink-50')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-bold">{t.title}</div>
          <div className="text-xs text-ink-500">{tripTypeLabel[t.type]} · {fmtDate(t.startDate)}{t.endDate !== t.startDate ? ` — ${fmtDate(t.endDate)}` : ''}{v.executor ? ` · ${v.executor}` : ''}{t.location ? ` · ${t.location}` : ''}</div>
        </div>
        <Badge tone={v.state === 'live' ? 'orange' : v.state === 'after' ? 'green' : 'gray'}>{{ before: 'قادمة', live: 'تجري الآن', awaiting_close: 'بانتظار الإغلاق', after: 'مكتملة' }[v.state]}</Badge>
      </div>
      {v.state === 'before' && (
        <div className="mt-3 flex items-center gap-3">
          <div className="relative flex-1 select-none blur-[3px]" aria-hidden><p className="text-sm text-ink-600">{v.brief ?? 'تفاصيل الرحلة تظهر عند انطلاقها'}</p></div>
          <Icons.Lock className="h-5 w-5 shrink-0 text-ink-400" />
        </div>
      )}
      {v.state === 'before' && v.brief && <p className="mt-2 text-xs text-ink-500">نبذة: {v.brief}</p>}
      {v.state === 'live' && (
        <div className="mt-3">
          <div className="mb-1 text-xs font-bold text-accent-700">الجدول الفعلي (حي)</div>
          <ul className="space-y-1 text-sm">{v.actual.map((r) => <li key={r.item.id} className="flex gap-2"><span className="num w-24 text-xs text-ink-500">{fmtTime(r.actual!.start ?? r.item.start)} — {fmtTime(r.actual!.end ?? r.item.end)}</span><span>{r.actual!.detail || r.item.detail}</span></li>)}</ul>
          {v.actual.length === 0 && <p className="text-sm text-ink-400">يبدأ التحديث مع أول بند</p>}
          <p className="mt-2 text-xs text-ink-500">الحضور حتى الآن: {v.attended}</p>
        </div>
      )}
      {v.state === 'after' && (
        <div className="mt-3 space-y-2 rounded-xl bg-emerald-50/60 p-3">
          <p className="text-sm text-ink-700">{v.report}</p>
          <div className="grid grid-cols-4 gap-2">{v.photos.slice(0, 4).map((p) => <PlaceholderImage key={p} className="aspect-video" />)}</div>
          <div className="flex flex-wrap gap-3 text-xs">
            {v.driveLink && <a href={v.driveLink} target="_blank" rel="noreferrer" className="text-brand-700 underline">ملف التوثيق (درايف)</a>}
            {v.tweets.map((tw) => <a key={tw} href={tw} target="_blank" rel="noreferrer" className="text-brand-700 underline">تغريدة</a>)}
            <span className="text-ink-500">الحضور: {v.attended}</span>
          </div>
        </div>
      )}
    </div>
  );
}
