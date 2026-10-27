// رابط الداعم: رابط واحد ثابت يفتح بكلمة مرور لكل جهة (داعم أو شريك)، مع حد للمحاولات الخاطئة.
// ترتيب الصفحة من الأعلى: الشعارات، فكرة البرنامج، فريق العمل (بالأرقام)، المتميزون، المجموعات، جدول المشاركين، الرحلات.
import { useState } from 'react';
import { fmtDate, fmtDateTime, fmtTime } from '@/domain/dates';
import { tripTypeLabel } from '@/domain/labels';
import { publicTripView, supporterLocked } from '@/domain/supporter';
import { RoleSwitcher } from '@/layout/AppShell';
import { act, repos, useDB } from '@/state/store';
import { Badge, Button, Card, Field, Icons, Input, Notice, Textarea, Toasts, TwoToneTitle, cx } from '@/ui';
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
    <div className="min-h-screen bg-white bg-glow">
      <RoleSwitcher />
      <div className="mx-auto max-w-md px-4 py-14 lg:py-24">
        <img src="./brand/logo-horizontal.svg" alt="صقل" className="mx-auto mb-8 h-12" />
        <TwoToneTitle as="h1" text="رابط الداعمين والشركاء" accent="الداعمين" className="mb-2 text-center text-[28px] lg:text-2xl" />
        <p className="mb-6 text-center text-ink-500">ادخل بكلمة المرور الخاصة بجهتك</p>
        <Card>
          <form onSubmit={submit} className="space-y-4">
            <Field label="كلمة المرور"><Input type="password" dir="ltr" value={pw} onChange={(e) => setPw(e.target.value)} disabled={!!locked} autoComplete="current-password" /></Field>
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
    <div className="min-h-screen bg-white">
      <RoleSwitcher />
      <header className="bg-glow">
        <div className="container-x space-y-6 py-14 text-center lg:py-20">
          {/* 1) شعارات الداعمين والشركاء فوق شعار البرنامج */}
          <LogoStrip placement="above" />
          <img src="./brand/logo-horizontal.svg" alt="صقل" className="mx-auto h-14" />
          <LogoStrip placement="below" />
          <TwoToneTitle as="h1" text={`أهلاً ${entity.name}`} accent={entity.name} className="text-[32px] lg:text-5xl" />
          <div className="flex items-center justify-center gap-2 text-sm text-ink-500">تتابع هنا البرنامج لحظة بلحظة · <Button variant="text" size="sm" onClick={onOut}>خروج</Button></div>
        </div>
      </header>
      <main>
        <Section title="فكرة البرنامج" accent="فكرة"><p className="max-w-3xl text-lg leading-[1.8] text-ink-600">{db.settings.supporterLink.programIdea}</p></Section>
        <Section title="فريق العمل" accent="فريق" sub="بموافقة ضمنية ضمن الشروط والأحكام العامة" alt><StaffList withPhone /></Section>
        <Section title="المشاركون المتميزون" accent="المتميزون"><TopFive /></Section>
        <Section title="المجموعات" accent="المجموعات" alt><GroupsTable /></Section>
        <Section title="المشاركون" accent="المشاركون"><ParticipantsTable /></Section>
        <Section title="الرحلات" accent="الرحلات" alt>
          <div className="grid gap-6 lg:grid-cols-2">{trips.map((t) => <TripBlock key={t.id} trip={t} />)}</div>
        </Section>
        <Section title="التعليقات" accent="التعليقات" sub="يظهر التعليق بعد موافقة فريق رابط المتابعة">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-3">
              {comments.map((c) => <div key={c.id} className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card"><div className="text-xs text-ink-500"><b className="text-ink-800">{c.name}</b> · {fmtDateTime(c.at)}</div><p className="mt-1 text-sm">{c.text}</p></div>)}
            </div>
            <CommentBox entityId={entityId} />
          </div>
        </Section>
      </main>
      <Toasts />
    </div>
  );
}

/** قسم واسع بعنوان ثنائي اللون (96 بين الأقسام على الشاشة الكبيرة و56 على الجوال) */
function Section({ title, accent, sub, alt, children }: { title: string; accent: string; sub?: string; alt?: boolean; children: React.ReactNode }) {
  return (
    <section className={cx('section-y', alt && 'bg-ink-50')}>
      <div className="container-x">
        <TwoToneTitle text={title} accent={accent} className="text-[28px] lg:text-2xl" />
        {sub && <p className="mt-2 text-ink-500">{sub}</p>}
        <div className="mt-8">{children}</div>
      </div>
    </section>
  );
}

function CommentBox({ entityId }: { entityId: string }) {
  const [text, setText] = useState('');
  const [name, setName] = useState('');
  return (
    <div className="grid content-start gap-3 rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
      <Input placeholder="الاسم (اختياري، الافتراضي اسم الجهة)" value={name} onChange={(e) => setName(e.target.value)} />
      <Textarea placeholder="اكتب تعليقك" value={text} onChange={(e) => setText(e.target.value)} />
      <Button className="justify-self-start" disabled={!text.trim()} onClick={() => act(() => { repos.supporters.comment(entityId, name, text); setText(''); }, 'أُرسل التعليق للمراجعة')}>أرسل</Button>
    </div>
  );
}

/** حالات الرحلة: قبلها ضبابية مع قفل، ويومها الجدول الفعلي حياً، وبعدها (بعد الإغلاق الكامل واعتماد التقرير) الصور والتقرير والتوثيق */
function TripBlock({ trip: t }: { trip: Trip }) {
  const db = useDB();
  const v = publicTripView(db, t);
  return (
    <div className={cx('relative overflow-hidden rounded-2xl border border-ink-100 bg-white p-5 shadow-card sm:p-6')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-lg font-bold">{t.title}</div>
          <div className="text-xs text-ink-500">{tripTypeLabel[t.type]} · {fmtDate(t.startDate)}{t.endDate !== t.startDate ? ` — ${fmtDate(t.endDate)}` : ''}{v.executor ? ` · ${v.executor}` : ''}{t.location ? ` · ${t.location}` : ''}</div>
        </div>
        <Badge tone={v.state === 'live' ? 'orange' : v.state === 'after' ? 'green' : 'gray'}>{{ before: 'قادمة', live: 'تجري الآن', awaiting_close: 'بانتظار الإغلاق', after: 'مكتملة' }[v.state]}</Badge>
      </div>
      {v.state === 'before' && (
        <div className="mt-3 flex items-center gap-3">
          <div className="relative flex-1 select-none blur-[3px]" aria-hidden><p className="text-sm text-ink-600">{v.brief ?? 'تفاصيل الرحلة تظهر عند انطلاقها'}</p></div>
          <Icons.Lock className="h-5 w-5 shrink-0 text-ink-300" />
        </div>
      )}
      {v.state === 'before' && v.brief && <p className="mt-2 text-xs text-ink-500">نبذة: {v.brief}</p>}
      {v.state === 'live' && (
        <div className="mt-3">
          <div className="mb-1 text-xs font-bold text-accent-700">الجدول الفعلي (حي)</div>
          <ul className="space-y-1 text-sm">{v.actual.map((r) => <li key={r.item.id} className="flex gap-2"><span className="num w-24 text-xs text-ink-500">{fmtTime(r.actual!.start ?? r.item.start)} — {fmtTime(r.actual!.end ?? r.item.end)}</span><span>{r.actual!.detail || r.item.detail}</span></li>)}</ul>
          {v.actual.length === 0 && <p className="text-sm text-ink-500">يبدأ التحديث مع أول بند</p>}
          <p className="mt-2 text-xs text-ink-500">الحضور حتى الآن: {v.attended}</p>
        </div>
      )}
      {v.state === 'after' && (
        <div className="mt-3 space-y-2 rounded-xl bg-ok-50 p-4">
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
