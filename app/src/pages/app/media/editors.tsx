// محررات صفوف مشتركة بين محرر الموجز ومحرر القالب: اللقطات، والمقابلات، والمخرجات، وقائمة الأقسام
import { priorityLabel, defaultRequired } from '@/domain/media';
import { uid } from '@/domain/id';
import type { BriefDeliverable, BriefInterview, BriefSection, BriefShot, MediaPriority } from '@/domain/types';
import { Button, Icons, Input, Select, Textarea, Toggle } from '@/ui';

const PRIORITIES = (Object.keys(priorityLabel) as MediaPriority[]).map((k) => ({ value: k, label: priorityLabel[k] }));
const Row = ({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) => (
  <div className="rounded-xl border border-ink-100 bg-ink-50/50 p-3">
    <div className="grid gap-2">{children}</div>
    <button type="button" onClick={onRemove} className="mt-2 inline-flex min-h-[44px] items-center gap-1 text-xs text-bad-700 hover:underline sm:min-h-0"><Icons.Trash2 className="h-4 w-4" />احذف</button>
  </div>
);

/** اللقطات: العنوان، والأولوية، وفقرة البرنامج المرتبطة (اختيارية)، وخانة «مطلوبة» (افتراضها من الأولوية) */
export function ShotsEditor({ shots, onChange, schedule }: { shots: BriefShot[]; onChange: (s: BriefShot[]) => void; schedule?: { id: string; start: string; detail: string }[] }) {
  const upd = (id: string, p: Partial<BriefShot>) => onChange(shots.map((s) => (s.id === id ? { ...s, ...p } : s)));
  return (
    <div className="space-y-2">
      {shots.map((s) => (
        <Row key={s.id} onRemove={() => onChange(shots.filter((x) => x.id !== s.id))}>
          <Input value={s.title} placeholder="وصف اللقطة" aria-label="وصف اللقطة" onChange={(e) => upd(s.id, { title: e.target.value })} />
          <div className="grid gap-2 sm:grid-cols-[150px_1fr_auto]">
            <Select value={s.priority} aria-label="الأولوية" options={PRIORITIES} onChange={(e) => { const priority = e.target.value as MediaPriority; upd(s.id, { priority, required: defaultRequired(priority) }); }} />
            {schedule?.length ? (
              <Select value={s.scheduleItemId ?? ''} aria-label="فقرة البرنامج" onChange={(e) => upd(s.id, { scheduleItemId: e.target.value || undefined })}
                options={[{ value: '', label: 'بلا فقرة محددة' }, ...schedule.map((i) => ({ value: i.id, label: `${i.start} ${i.detail}` }))]} />
            ) : <span />}
            <Toggle checked={s.required} onChange={(v) => upd(s.id, { required: v })} label="مطلوبة" />
          </div>
        </Row>
      ))}
      <Button variant="secondary" size="sm" icon={<Icons.Plus className="h-4 w-4" />} onClick={() => onChange([...shots, { id: uid('sh'), title: '', priority: 'important', required: true }])}>أضف لقطة</Button>
    </div>
  );
}

export function InterviewsEditor({ items, onChange }: { items: BriefInterview[]; onChange: (s: BriefInterview[]) => void }) {
  const upd = (id: string, p: Partial<BriefInterview>) => onChange(items.map((s) => (s.id === id ? { ...s, ...p } : s)));
  return (
    <div className="space-y-2">
      {items.map((s) => (
        <Row key={s.id} onRemove={() => onChange(items.filter((x) => x.id !== s.id))}>
          <Input value={s.who} placeholder="من تقابله؟" aria-label="المقابَل" onChange={(e) => upd(s.id, { who: e.target.value })} />
          <Textarea rows={3} value={s.questions.join('\n')} placeholder="الأسئلة المقترحة، سؤال في كل سطر" aria-label="الأسئلة" onChange={(e) => upd(s.id, { questions: e.target.value.split('\n') })} />
          <Toggle checked={s.required} onChange={(v) => upd(s.id, { required: v })} label="مطلوبة" />
        </Row>
      ))}
      <Button variant="secondary" size="sm" icon={<Icons.Plus className="h-4 w-4" />} onClick={() => onChange([...items, { id: uid('iv'), who: '', questions: [], required: true }])}>أضف مقابلة</Button>
    </div>
  );
}

export function DeliverablesEditor({ items, onChange }: { items: BriefDeliverable[]; onChange: (s: BriefDeliverable[]) => void }) {
  const upd = (id: string, p: Partial<BriefDeliverable>) => onChange(items.map((s) => (s.id === id ? { ...s, ...p } : s)));
  return (
    <div className="space-y-2">
      {items.map((s) => (
        <Row key={s.id} onRemove={() => onChange(items.filter((x) => x.id !== s.id))}>
          <div className="grid gap-2 sm:grid-cols-2">
            <Input value={s.title} placeholder="المخرج" aria-label="المخرج" onChange={(e) => upd(s.id, { title: e.target.value })} />
            <Input value={s.type} placeholder="النوع (فيديو، صور، PDF...)" aria-label="النوع" onChange={(e) => upd(s.id, { type: e.target.value })} />
          </div>
          <Input value={s.spec} placeholder="المقاس والصيغة" aria-label="المقاس والصيغة" onChange={(e) => upd(s.id, { spec: e.target.value })} />
          <div className="grid items-center gap-2 sm:grid-cols-[200px_auto]">
            <Input type="date" value={s.dueDate ?? ''} aria-label="موعد التسليم" onChange={(e) => upd(s.id, { dueDate: e.target.value || undefined })} />
            <Toggle checked={s.required} onChange={(v) => upd(s.id, { required: v })} label="مطلوب" />
          </div>
        </Row>
      ))}
      <Button variant="secondary" size="sm" icon={<Icons.Plus className="h-4 w-4" />} onClick={() => onChange([...items, { id: uid('dv'), title: '', type: '', spec: '', required: true }])}>أضف مخرجاً</Button>
    </div>
  );
}

/** ترتيب الأقسام بالأسهم، وإظهار وإخفاء، وتحرير العنوان والنص. renderBody يحدد ما يُعرض داخل كل قسم */
export function SectionList({ sections, onChange, auto, renderBody, canAddCustom = true }: {
  sections: BriefSection[]; onChange: (s: BriefSection[]) => void; auto?: string[]; renderBody: (s: BriefSection, set: (p: Partial<BriefSection>) => void) => React.ReactNode; canAddCustom?: boolean;
}) {
  const set = (key: string, p: Partial<BriefSection>) => onChange(sections.map((s) => (s.key === key ? { ...s, ...p } : s)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= sections.length) return;
    const next = [...sections];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div className="space-y-3">
      {sections.map((s, i) => (
        <div key={s.key} className={`rounded-2xl border bg-white ${s.visible ? 'border-ink-100' : 'border-dashed border-ink-200 opacity-80'}`}>
          <div className="flex flex-wrap items-center gap-2 px-4 py-3">
            <div className="min-w-0 flex-1">
              {s.custom ? <Input value={s.title} aria-label="عنوان القسم" onChange={(e) => set(s.key, { title: e.target.value })} /> : <span className="font-bold text-ink-900">{s.title}</span>}
            </div>
            {auto?.includes(s.key) && <span className="chip bg-brand-50 text-brand-700">من الجدول</span>}
            <button type="button" aria-label="أعلى" disabled={i === 0} onClick={() => move(i, -1)} className="flex h-11 w-11 items-center justify-center rounded-full text-ink-600 hover:bg-ink-50 disabled:opacity-30"><Icons.ChevronUp className="h-4 w-4" /></button>
            <button type="button" aria-label="أسفل" disabled={i === sections.length - 1} onClick={() => move(i, 1)} className="flex h-11 w-11 items-center justify-center rounded-full text-ink-600 hover:bg-ink-50 disabled:opacity-30"><Icons.ChevronDown className="h-4 w-4" /></button>
            <Toggle checked={s.visible} onChange={(v) => set(s.key, { visible: v })} label={s.visible ? 'ظاهر' : 'مخفي'} />
            {s.custom && <button type="button" aria-label="احذف القسم" onClick={() => onChange(sections.filter((x) => x.key !== s.key))} className="flex h-11 w-11 items-center justify-center rounded-full text-bad-700 hover:bg-bad-50"><Icons.Trash2 className="h-4 w-4" /></button>}
          </div>
          {s.visible && <div className="border-t border-ink-100 px-4 py-3">{renderBody(s, (p) => set(s.key, p))}</div>}
        </div>
      ))}
      {canAddCustom && <Button variant="secondary" size="sm" icon={<Icons.Plus className="h-4 w-4" />} onClick={() => onChange([...sections, { key: `custom_${uid('c')}`, title: 'قسم مخصص', visible: true, body: '', custom: true }])}>أضف قسماً مخصصاً</Button>}
    </div>
  );
}
