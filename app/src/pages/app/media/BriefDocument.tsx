// عرض الموجز كما يراه الفريق: المعاينة، وصفحة الرابط، وصفحة الطباعة (PDF). يأخذ المحتوى المجمَّد وحده.
// خانة item تتيح لصفحة المتابعة إلحاق أزرار التنفيذ بكل لقطة أو مقابلة أو مخرج.
import type { ReactNode } from 'react';
import { fmtDate, fmtTime } from '@/domain/dates';
import { itemKindLabel, priorityLabel, type ItemKind } from '@/domain/media';
import type { BriefFrozen, BriefSection, ID, ResolvedBriefEvent } from '@/domain/types';
import { Badge } from '@/ui';

export type ItemSlot = (id: ID, kind: ItemKind, title: string) => ReactNode;

const body = (s: BriefSection) => (s.body.trim() ? <p className="whitespace-pre-line leading-[1.9] text-ink-700">{s.body}</p> : null);
const when = (e: ResolvedBriefEvent) => `${fmtDate(e.date, { weekday: true })}${e.endDate ? ` — ${fmtDate(e.endDate)}` : ''}${e.start ? ` · ${fmtTime(e.start)}${e.end ? ` – ${fmtTime(e.end)}` : ''}` : ''}`;
const req = (r: boolean) => <Badge tone={r ? 'blue' : 'gray'}>{r ? 'مطلوبة' : 'اختيارية'}</Badge>;
const tone = { must: 'red', important: 'orange', extra: 'gray' } as const;

/** هل للقسم ما يُعرض؟ الأقسام الفارغة لا تظهر في الوثيقة */
function hasContent(d: BriefFrozen, s: BriefSection): boolean {
  switch (s.key) {
    case 'info': case 'schedule': return d.events.length > 0 && (s.key === 'info' || d.events.some((e) => e.schedule.length));
    case 'shots': return d.events.some((e) => e.shots.length);
    case 'interviews': return d.events.some((e) => e.interviews.length);
    case 'deliverables': return d.deliverables.length > 0;
    case 'contacts': return d.contacts.length > 0;
    case 'responsibilities': return d.responsibilities.length > 0;
    case 'deadlines': return d.deadlines.length > 0;
    case 'notes': return !!s.body.trim() || d.events.some((e) => e.notes.trim());
    default: return !!s.body.trim();
  }
}

export function BriefDocument({ data, item }: { data: BriefFrozen; item?: ItemSlot }) {
  const many = data.events.length > 1;
  const evHead = (e: ResolvedBriefEvent) => many && <h4 className="mb-2 mt-4 font-bold text-brand-700">{e.title}</h4>;
  const sections = data.sections.filter((s) => hasContent(data, s));
  return (
    <div className="brief-doc space-y-8 text-sm" dir="rtl">
      {sections.map((s) => (
        <section key={s.key} className="brief-section">
          <h3 className="mb-3 border-b border-ink-100 pb-2 text-lg font-bold text-ink-900">{s.title}</h3>
          {s.key === 'info' && (
            <div className="space-y-3">
              {data.events.map((e) => (
                <div key={e.id} className="brief-card rounded-2xl border border-ink-100 bg-white p-4">
                  <div className="flex flex-wrap items-center gap-2"><b className="text-base">{e.title}</b>{e.kindLabel && <Badge tone="blue">{e.kindLabel}</Badge>}</div>
                  <dl className="mt-2 grid gap-1 text-ink-700 sm:grid-cols-2">
                    <div><dt className="inline text-ink-500">الموعد: </dt><dd className="inline">{when(e)}</dd></div>
                    {e.location && <div><dt className="inline text-ink-500">الموقع: </dt><dd className="inline">{e.location}</dd></div>}
                  </dl>
                </div>
              ))}
              {body(s)}
            </div>
          )}
          {s.key === 'schedule' && data.events.filter((e) => e.schedule.length).map((e) => (
            <div key={e.id}>
              {evHead(e)}
              <table className="brief-table w-full border-collapse text-sm">
                <tbody>
                  {e.schedule.map((i) => (
                    <tr key={i.id} className="border-b border-ink-100"><td className="num w-40 whitespace-nowrap py-1.5 pe-3 text-ink-500">{many || e.endDate ? `${fmtDate(i.date)} · ` : ''}{fmtTime(i.start)} – {fmtTime(i.end)}</td><td className="py-1.5">{i.detail}</td></tr>
                  ))}
                </tbody>
              </table>
              {body(s)}
            </div>
          ))}
          {s.key === 'shots' && data.events.filter((e) => e.shots.length).map((e) => (
            <div key={e.id}>
              {evHead(e)}
              <ul className="space-y-2">
                {e.shots.map((x) => {
                  const link = x.scheduleItemId ? e.schedule.find((i) => i.id === x.scheduleItemId) : undefined;
                  return (
                    <li key={x.id} className="brief-card rounded-xl border border-ink-100 bg-white p-3">
                      <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{x.title}</span><Badge tone={tone[x.priority]}>{priorityLabel[x.priority]}</Badge>{req(x.required)}</div>
                      {link && <div className="mt-1 text-xs text-ink-500">ضمن البرنامج: {fmtTime(link.start)} · {link.detail}</div>}
                      {item?.(x.id, 'shot', x.title)}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          {s.key === 'interviews' && data.events.filter((e) => e.interviews.length).map((e) => (
            <div key={e.id}>
              {evHead(e)}
              <ul className="space-y-2">
                {e.interviews.map((x) => (
                  <li key={x.id} className="brief-card rounded-xl border border-ink-100 bg-white p-3">
                    <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{x.who}</span>{req(x.required)}</div>
                    {x.questions.length > 0 && <ul className="mt-1 list-disc ps-5 text-ink-700">{x.questions.map((q, i) => <li key={i}>{q}</li>)}</ul>}
                    {item?.(x.id, 'interview', x.who)}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {s.key === 'deliverables' && (
            <div className="space-y-2">
              {body(s)}
              {data.deliverables.map((x) => (
                <div key={x.id} className="brief-card rounded-xl border border-ink-100 bg-white p-3">
                  <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{x.title}</span><Badge>{x.type}</Badge>{req(x.required)}</div>
                  <div className="mt-1 text-ink-700">{x.spec}{x.dueDate && <span className="text-ink-500"> · التسليم: {fmtDate(x.dueDate)}</span>}</div>
                  {item?.(x.id, 'deliverable', x.title)}
                </div>
              ))}
            </div>
          )}
          {s.key === 'contacts' && (
            <ul className="grid gap-2 sm:grid-cols-2">
              {data.contacts.map((c) => (
                <li key={c.id} className="brief-card rounded-xl border border-ink-100 bg-white p-3"><b>{c.name}</b><div className="text-ink-500">{c.role}</div>{c.phone && <div className="num" dir="ltr">{c.phone}</div>}</li>
              ))}
            </ul>
          )}
          {s.key === 'responsibilities' && (
            <table className="brief-table w-full border-collapse text-sm"><thead><tr className="border-b border-ink-200 text-ink-500"><th className="py-1.5 text-start">المهمة</th><th className="py-1.5 text-start">المسؤول</th></tr></thead>
              <tbody>{data.responsibilities.map((r) => <tr key={r.id} className="border-b border-ink-100"><td className="py-1.5">{r.task}</td><td className="py-1.5">{r.owner}</td></tr>)}</tbody></table>
          )}
          {s.key === 'deadlines' && (
            <table className="brief-table w-full border-collapse text-sm"><thead><tr className="border-b border-ink-200 text-ink-500"><th className="py-1.5 text-start">التسليم</th><th className="py-1.5 text-start">الموعد</th></tr></thead>
              <tbody>{data.deadlines.map((r) => <tr key={r.id} className="border-b border-ink-100"><td className="py-1.5">{r.title}</td><td className="py-1.5">{fmtDate(r.date)}</td></tr>)}</tbody></table>
          )}
          {s.key === 'notes' && (
            <div className="space-y-2">
              {body(s)}
              {data.events.filter((e) => e.notes.trim()).map((e) => <p key={e.id} className="whitespace-pre-line leading-[1.9] text-ink-700">{many && <b>{e.title}: </b>}{e.notes}</p>)}
            </div>
          )}
          {['goals', 'visual', 'onsite', 'partners'].includes(s.key) && body(s)}
          {s.custom && body(s)}
        </section>
      ))}
    </div>
  );
}

export { itemKindLabel };
