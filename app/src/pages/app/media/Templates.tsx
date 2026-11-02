// القوالب: بيانات قابلة للتحرير (إنشاء ونسخ وتعديل وحذف). تعديل قالب يؤثر على الموجزات الجديدة فقط:
// الموجز يحمل نسخة من القالب وقت إنشائه، ولا يشير إليه.
import { useState } from 'react';
import { uid } from '@/domain/id';
import { emptySections, sectionsFor, AUTO_SECTIONS } from '@/domain/media';
import type { BriefDeliverable, BriefInterview, BriefShot, MediaTemplate } from '@/domain/types';
import { act, repos, useDB } from '@/state/store';
import { Button, Card, Empty, Field, Icons, Input, Modal, MoreMenu, PageHeader, Textarea, askConfirm } from '@/ui';
import { InterviewsEditor, SectionList, ShotsEditor } from './editors';

type Draft = { id?: string; name: string; description: string; sections: MediaTemplate['sections']; shots: BriefShot[]; interviews: BriefInterview[]; deliverables: (Omit<BriefDeliverable, 'dueDate'> & { offset: number })[] };
const toDraft = (t?: MediaTemplate): Draft => ({
  id: t?.id, name: t?.name ?? '', description: t?.description ?? '', sections: t ? t.sections.map((s) => ({ ...s })) : emptySections(),
  shots: (t?.shots ?? []).map((s) => ({ id: uid('sh'), ...s })), interviews: (t?.interviews ?? []).map((i) => ({ id: uid('iv'), ...i })),
  deliverables: (t?.deliverables ?? []).map((d) => ({ id: uid('dv'), title: d.title, type: d.type, spec: d.spec, required: d.required, offset: d.dueOffsetDays })),
});

export default function TemplatesPage() {
  const db = useDB();
  const [draft, setDraft] = useState<Draft | null>(null);
  return (
    <div>
      <PageHeader title="القوالب" subtitle="تعديل القالب يؤثر على الموجزات الجديدة فقط" actions={<Button onClick={() => setDraft(toDraft())} icon={<Icons.Plus className="h-4 w-4" />}>قالب جديد</Button>} />
      {db.mediaTemplates.length === 0 ? <Empty title="لا قوالب" /> : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {db.mediaTemplates.map((t) => (
            <Card key={t.id} title={t.name} subtitle={t.description} action={<MoreMenu items={[
              { label: 'انسخ', onClick: () => act(() => { repos.media.duplicateTemplate(t.id); }, 'نُسخ القالب') },
              { label: 'احذف', danger: true, onClick: () => askConfirm({ title: 'حذف القالب', body: 'الموجزات التي أُنشئت منه لا تتأثر.', cta: 'احذف', danger: true, run: () => act(() => repos.media.removeTemplate(t.id), 'حُذف القالب') }) },
            ]} />}>
              <div className="text-sm text-ink-600">{sectionsFor('week', t.sections).filter((s) => s.visible).length} أقسام ظاهرة · {t.shots.length} لقطات · {t.interviews.length} مقابلات · {t.deliverables.length} مخرجات</div>
              <Button className="mt-3" variant="secondary" size="sm" onClick={() => setDraft(toDraft(t))}>عدّل</Button>
            </Card>
          ))}
        </div>
      )}
      {draft && <TemplateEditor draft={draft} onClose={() => setDraft(null)} />}
    </div>
  );
}

function TemplateEditor({ draft: init, onClose }: { draft: Draft; onClose: () => void }) {
  const [d, setD] = useState(init);
  const save = () => act(() => {
    repos.media.saveTemplate({
      id: d.id, name: d.name, description: d.description, kind: 'both', sections: d.sections,
      shots: d.shots.map((s) => ({ title: s.title, priority: s.priority, required: s.required })),
      interviews: d.interviews.map((i) => ({ who: i.who, questions: i.questions.filter((q) => q.trim()), required: i.required })),
      deliverables: d.deliverables.map((v) => ({ title: v.title, type: v.type, spec: v.spec, dueOffsetDays: v.offset, required: v.required })),
    });
    onClose();
  }, 'حُفظ القالب');
  return (
    <Modal open wide onClose={onClose} title={d.id ? 'تعديل القالب' : 'قالب جديد'} footer={<><Button variant="secondary" onClick={onClose}>إلغاء</Button><Button disabled={!d.name.trim()} onClick={save}>احفظ</Button></>}>
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="اسم القالب"><Input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} /></Field>
          <Field label="وصف مختصر"><Input value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} /></Field>
        </div>
        <SectionList sections={d.sections} auto={AUTO_SECTIONS} onChange={(sections) => setD({ ...d, sections })} renderBody={(s, set) => {
          if (s.key === 'shots') return <ShotsEditor shots={d.shots} onChange={(shots) => setD({ ...d, shots })} />;
          if (s.key === 'interviews') return <InterviewsEditor items={d.interviews} onChange={(interviews) => setD({ ...d, interviews })} />;
          if (s.key === 'deliverables') {
            return (
              <div className="space-y-2">
                {d.deliverables.map((v) => (
                  <div key={v.id} className="grid gap-2 rounded-xl border border-ink-100 bg-ink-50/50 p-3">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Input value={v.title} placeholder="المخرج" aria-label="المخرج" onChange={(e) => setD({ ...d, deliverables: d.deliverables.map((x) => (x.id === v.id ? { ...x, title: e.target.value } : x)) })} />
                      <Input value={v.type} placeholder="النوع" aria-label="النوع" onChange={(e) => setD({ ...d, deliverables: d.deliverables.map((x) => (x.id === v.id ? { ...x, type: e.target.value } : x)) })} />
                    </div>
                    <Input value={v.spec} placeholder="المقاس والصيغة" aria-label="المقاس والصيغة" onChange={(e) => setD({ ...d, deliverables: d.deliverables.map((x) => (x.id === v.id ? { ...x, spec: e.target.value } : x)) })} />
                    <div className="grid items-center gap-2 sm:grid-cols-[1fr_auto_auto]">
                      <label className="flex items-center gap-2 text-xs text-ink-600">التسليم بعد الفعالية بـ (أيام)<Input type="number" className="w-24" value={v.offset} onChange={(e) => setD({ ...d, deliverables: d.deliverables.map((x) => (x.id === v.id ? { ...x, offset: +e.target.value } : x)) })} /></label>
                      <label className="flex min-h-[44px] items-center gap-2 text-sm"><input type="checkbox" checked={v.required} onChange={(e) => setD({ ...d, deliverables: d.deliverables.map((x) => (x.id === v.id ? { ...x, required: e.target.checked } : x)) })} />مطلوب</label>
                      <button type="button" aria-label="احذف" onClick={() => setD({ ...d, deliverables: d.deliverables.filter((x) => x.id !== v.id) })} className="flex h-11 w-11 items-center justify-center rounded-full text-bad-700 hover:bg-bad-50"><Icons.Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                ))}
                <Button variant="secondary" size="sm" icon={<Icons.Plus className="h-4 w-4" />} onClick={() => setD({ ...d, deliverables: [...d.deliverables, { id: uid('dv'), title: '', type: '', spec: '', required: true, offset: 1 }] })}>أضف مخرجاً</Button>
              </div>
            );
          }
          if (['info', 'schedule', 'contacts', 'responsibilities', 'deadlines'].includes(s.key)) return <p className="text-sm text-ink-500">يُعبَّأ من الفعالية أو يضيفه المسؤول في الموجز نفسه.</p>;
          return <Textarea rows={4} aria-label="النص الأولي" value={s.body} placeholder="النص الأولي لهذا القسم" onChange={(e) => set({ body: e.target.value })} />;
        }} />
      </div>
    </Modal>
  );
}
