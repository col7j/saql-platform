// الخطوة 2: المراجعة والتحرير. قائمة الأقسام بمفتاح إظهار/إخفاء، وتحرير المحتوى، وقسم مخصص.
// ما سحبه النظام من الفعالية (المعلومات والجدول) يُقرأ حياً ويظهر بعلامة «من الجدول» ولا يُنسخ.
import { fmtDate, fmtTime } from '@/domain/dates';
import { uid } from '@/domain/id';
import { AUTO_SECTIONS, refKey, resolveEvent, sectionsFor, weekEvents } from '@/domain/media';
import type { BriefContent, BriefEvent, MediaBrief } from '@/domain/types';
import { useDB } from '@/state/store';
import { Button, Field, Icons, Input, Select, Textarea, Toggle } from '@/ui';
import { DeliverablesEditor, InterviewsEditor, SectionList, ShotsEditor } from './editors';

export function BriefEditor({ kind, content, setContent, internalNotes, setInternalNotes }: {
  kind: MediaBrief['kind']; content: BriefContent; setContent: (c: BriefContent) => void; internalNotes: string; setInternalNotes: (s: string) => void;
}) {
  const db = useDB();
  const patch = (p: Partial<BriefContent>) => setContent({ ...content, ...p });
  const setEvent = (id: string, p: Partial<BriefEvent>) => patch({ events: content.events.map((e) => (e.id === id ? { ...e, ...p } : e)) });
  const live = (e: BriefEvent) => resolveEvent(db, e.ref);
  const many = content.events.length > 1;
  const evTitle = (e: BriefEvent) => many && <h4 className="mb-2 font-bold text-brand-700">{live(e)?.title ?? 'فعالية'}</h4>;

  // الأسبوعي: الفعاليات المضمّنة تُضاف وتُزال
  const included = new Set(content.events.map((e) => refKey(e.ref)));
  const addable = kind === 'week' && content.weekStart ? weekEvents(db, content.weekStart).filter((e) => !included.has(refKey(e.ref))) : [];
  const staff = db.persons.filter((p) => p.kind === 'staff');

  return (
    <div className="space-y-6">
      <Field label="عنوان الموجز"><Input value={content.title} onChange={(e) => patch({ title: e.target.value })} /></Field>

      {kind === 'week' && (
        <div className="rounded-2xl border border-ink-100 bg-white p-4">
          <div className="mb-2 font-bold text-ink-900">الفعاليات المضمّنة في الأسبوع</div>
          <ul className="space-y-2">
            {content.events.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2 rounded-xl bg-ink-50 px-3 py-2">
                <span>{live(e)?.title ?? 'فعالية محذوفة'} <span className="text-xs text-ink-500">{live(e) ? fmtDate(live(e)!.date) : ''}</span></span>
                <button type="button" aria-label="أزل الفعالية" disabled={content.events.length === 1} onClick={() => patch({ events: content.events.filter((x) => x.id !== e.id) })} className="flex h-11 w-11 items-center justify-center rounded-full text-bad-700 hover:bg-bad-50 disabled:opacity-30"><Icons.X className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
          {addable.length > 0 && (
            <div className="mt-3 flex gap-2">
              <Select className="flex-1" aria-label="أضف فعالية" value="" onChange={(ev) => {
                const m = addable.find((x) => refKey(x.ref) === ev.target.value);
                if (m) patch({ events: [...content.events, { id: uid('be'), ref: m.ref, shots: [], interviews: [], notes: '' }] });
              }} options={[{ value: '', label: 'أضف فعالية من الأسبوع…' }, ...addable.map((e) => ({ value: refKey(e.ref), label: `${fmtDate(e.date)} · ${e.title}` }))]} />
            </div>
          )}
        </div>
      )}

      <SectionList
        sections={sectionsFor(kind, content.sections)}
        auto={AUTO_SECTIONS}
        onChange={(next) => {
          // الأقسام المشتركة الأسبوعية تبقى في مكانها حين لا تُعرض
          const hidden = content.sections.filter((s) => !sectionsFor(kind, [s]).length);
          patch({ sections: [...next, ...hidden] });
        }}
        renderBody={(s, set) => {
          const text = (label = 'النص') => <Field label={label}><Textarea rows={4} value={s.body} onChange={(e) => set({ body: e.target.value })} /></Field>;
          switch (s.key) {
            case 'info':
              return (
                <div className="space-y-3">
                  {content.events.map((e) => { const l = live(e); return l ? (
                    <div key={e.id} className="rounded-xl bg-brand-50/60 p-3 text-sm text-ink-700">
                      <b className="text-ink-900">{l.title}</b> · {l.kindLabel}<br />{fmtDate(l.date, { weekday: true })}{l.endDate ? ` — ${fmtDate(l.endDate)}` : ''}{l.start ? ` · ${fmtTime(l.start)}${l.end ? ` – ${fmtTime(l.end)}` : ''}` : ''}{l.location ? ` · ${l.location}` : ''}
                    </div>
                  ) : null; })}
                  {text('إضافة اختيارية')}
                </div>
              );
            case 'schedule':
              return (
                <div className="space-y-3">
                  {content.events.map((e) => { const l = live(e); return (
                    <div key={e.id}>{evTitle(e)}
                      {l?.schedule.length ? <ul className="space-y-1 rounded-xl bg-brand-50/60 p-3 text-sm">{l.schedule.map((i) => <li key={i.id}><span className="num text-ink-500">{fmtTime(i.start)} – {fmtTime(i.end)}</span> · {i.detail}</li>)}</ul> : <p className="text-sm text-ink-500">لا جدول مفصّل لهذه الفعالية.</p>}
                    </div>
                  ); })}
                </div>
              );
            case 'shots':
              return <div className="space-y-5">{content.events.map((e) => <div key={e.id}>{evTitle(e)}<ShotsEditor shots={e.shots} schedule={live(e)?.schedule} onChange={(shots) => setEvent(e.id, { shots })} /></div>)}</div>;
            case 'interviews':
              return <div className="space-y-5">{content.events.map((e) => <div key={e.id}>{evTitle(e)}<InterviewsEditor items={e.interviews} onChange={(interviews) => setEvent(e.id, { interviews })} /></div>)}</div>;
            case 'deliverables':
              return <div className="space-y-3">{text('ملاحظة عامة (اختيارية)')}<DeliverablesEditor items={content.deliverables} onChange={(deliverables) => patch({ deliverables })} /></div>;
            case 'contacts':
              return (
                <div className="space-y-2">
                  {content.contacts.map((c) => (
                    <div key={c.id} className="rounded-xl border border-ink-100 bg-ink-50/50 p-3">
                      <div className="grid gap-2 sm:grid-cols-3">
                        <Input value={c.name} placeholder="الاسم" aria-label="الاسم" onChange={(e) => patch({ contacts: content.contacts.map((x) => (x.id === c.id ? { ...x, name: e.target.value } : x)) })} />
                        <Input value={c.role} placeholder="الدور" aria-label="الدور" onChange={(e) => patch({ contacts: content.contacts.map((x) => (x.id === c.id ? { ...x, role: e.target.value } : x)) })} />
                        <Input dir="ltr" value={c.phone ?? ''} placeholder="الجوال" aria-label="الجوال" onChange={(e) => patch({ contacts: content.contacts.map((x) => (x.id === c.id ? { ...x, phone: e.target.value } : x)) })} />
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <Toggle checked={c.authorized} onChange={(v) => patch({ contacts: content.contacts.map((x) => (x.id === c.id ? { ...x, authorized: v } : x)) })} label={c.authorized ? 'مصرّح بمشاركتها' : 'غير مصرّح: لا تظهر خارج المنصة'} />
                        <button type="button" aria-label="احذف" onClick={() => patch({ contacts: content.contacts.filter((x) => x.id !== c.id) })} className="flex h-11 w-11 items-center justify-center rounded-full text-bad-700 hover:bg-bad-50"><Icons.Trash2 className="h-4 w-4" /></button>
                      </div>
                    </div>
                  ))}
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" size="sm" icon={<Icons.Plus className="h-4 w-4" />} onClick={() => patch({ contacts: [...content.contacts, { id: uid('bc'), name: '', role: '', authorized: false }] })}>أضف جهة</Button>
                    <Select className="max-w-[240px]" aria-label="من فريق العمل" value="" onChange={(e) => {
                      const p = staff.find((x) => x.id === e.target.value);
                      if (p) patch({ contacts: [...content.contacts, { id: uid('bc'), name: p.name, role: p.title ?? 'فريق العمل', phone: p.phone, authorized: false }] });
                    }} options={[{ value: '', label: 'أضف من فريق العمل…' }, ...staff.map((p) => ({ value: p.id, label: p.name }))]} />
                  </div>
                </div>
              );
            case 'responsibilities':
              return (
                <div className="space-y-2">
                  {content.responsibilities.map((r) => (
                    <div key={r.id} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                      <Input value={r.task} placeholder="المهمة" aria-label="المهمة" onChange={(e) => patch({ responsibilities: content.responsibilities.map((x) => (x.id === r.id ? { ...x, task: e.target.value } : x)) })} />
                      <Input value={r.owner} placeholder="المسؤول" aria-label="المسؤول" onChange={(e) => patch({ responsibilities: content.responsibilities.map((x) => (x.id === r.id ? { ...x, owner: e.target.value } : x)) })} />
                      <button type="button" aria-label="احذف" onClick={() => patch({ responsibilities: content.responsibilities.filter((x) => x.id !== r.id) })} className="flex h-11 w-11 items-center justify-center rounded-full text-bad-700 hover:bg-bad-50"><Icons.Trash2 className="h-4 w-4" /></button>
                    </div>
                  ))}
                  <Button variant="secondary" size="sm" icon={<Icons.Plus className="h-4 w-4" />} onClick={() => patch({ responsibilities: [...content.responsibilities, { id: uid('wr'), task: '', owner: '' }] })}>أضف مسؤولية</Button>
                </div>
              );
            case 'deadlines':
              return (
                <div className="space-y-2">
                  {content.deadlines.map((r) => (
                    <div key={r.id} className="grid gap-2 sm:grid-cols-[1fr_180px_auto]">
                      <Input value={r.title} placeholder="ما يُسلَّم" aria-label="ما يُسلَّم" onChange={(e) => patch({ deadlines: content.deadlines.map((x) => (x.id === r.id ? { ...x, title: e.target.value } : x)) })} />
                      <Input type="date" value={r.date} aria-label="الموعد" onChange={(e) => patch({ deadlines: content.deadlines.map((x) => (x.id === r.id ? { ...x, date: e.target.value } : x)) })} />
                      <button type="button" aria-label="احذف" onClick={() => patch({ deadlines: content.deadlines.filter((x) => x.id !== r.id) })} className="flex h-11 w-11 items-center justify-center rounded-full text-bad-700 hover:bg-bad-50"><Icons.Trash2 className="h-4 w-4" /></button>
                    </div>
                  ))}
                  <Button variant="secondary" size="sm" icon={<Icons.Plus className="h-4 w-4" />} onClick={() => patch({ deadlines: [...content.deadlines, { id: uid('wd'), title: '', date: content.weekStart ?? '' }] })}>أضف موعد تسليم</Button>
                </div>
              );
            case 'notes':
              return (
                <div className="space-y-3">
                  {text()}
                  {content.events.map((e) => <div key={e.id}>{evTitle(e)}<Field label="ملاحظات خاصة بالفعالية"><Textarea rows={2} value={e.notes} onChange={(ev) => setEvent(e.id, { notes: ev.target.value })} /></Field></div>)}
                </div>
              );
            default:
              return text();
          }
        }}
      />

      <div className="rounded-2xl border border-accent-300 bg-accent-50/50 p-4">
        <Field label="ملاحظات داخلية" hint="تبقى في المنصة: لا تدخل المعاينة ولا الرابط ولا الـPDF">
          <Textarea rows={3} value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} />
        </Field>
      </div>
    </div>
  );
}
