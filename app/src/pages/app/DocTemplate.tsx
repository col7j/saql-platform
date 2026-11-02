// قالب وثيقة الرحلة: الأقسام وترتيبها وأعمدة الجداول بيانات يعدّلها القائد العام أو مساعده. التغيير يخص الرحلات الجديدة فقط
import { useState } from 'react';
import { uid } from '@/domain/id';
import { defaultDocTemplate } from '@/domain/tripDocument';
import type { DocSectionDef } from '@/domain/types';
import { act, repos, useDB, useMe } from '@/state/store';
import { Button, Card, Icons, Input, Notice, Select } from '@/ui';

export default function DocTemplateSettings() {
  const db = useDB();
  const me = useMe();
  const [secs, setSecs] = useState<DocSectionDef[]>(db.settings.docTemplate);
  const edit = (i: number, p: Partial<DocSectionDef>) => setSecs(secs.map((s, j) => (j === i ? { ...s, ...p } : s)));
  const move = (i: number, d: number) => {
    const n = [...secs];
    const [x] = n.splice(i, 1);
    n.splice(i + d, 0, x);
    setSecs(n);
  };
  const toggleType = (i: number, t: 'internal' | 'external') => {
    const cur = secs[i].tripTypes;
    edit(i, { tripTypes: cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t] });
  };
  return (
    <Card title="قالب وثيقة الرحلة" subtitle="أقسام الوثيقة وأعمدة جداولها. التغيير ينعكس على الرحلات الجديدة، والقائمة لا تغيّر الرحلات القائمة">
      <Notice>الخطة المبدئية = الأقسام ذات المرحلة «مبدئية»، والتفصيلية = «تفصيلية». يُخفى السكن والتواصل مع الأسر في الرحلة الداخلية بنوع الرحلة.</Notice>
      <ol className="mt-3 space-y-3">
        {secs.map((s, i) => (
          <li key={s.id} className="rounded-2xl border border-ink-100 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="num w-6 text-sm text-ink-500">{i + 1}</span>
              <Input value={s.title} onChange={(e) => edit(i, { title: e.target.value })} aria-label="عنوان القسم" className="max-w-xs" />
              <Select value={s.stage} onChange={(e) => edit(i, { stage: e.target.value as DocSectionDef['stage'] })} options={[{ value: 'initial', label: 'مبدئية' }, { value: 'detailed', label: 'تفصيلية' }]} aria-label="المرحلة" />
              {(['internal', 'external'] as const).map((t) => (
                <label key={t} className="flex min-h-[36px] items-center gap-1 text-xs"><input type="checkbox" checked={s.tripTypes.includes(t)} onChange={() => toggleType(i, t)} /> {t === 'internal' ? 'داخلية' : 'خارجية'}</label>
              ))}
              <span className="ms-auto flex gap-1">
                <Button variant="ghost" disabled={i === 0} onClick={() => move(i, -1)} aria-label="أعلى"><Icons.ArrowUp className="h-4 w-4" /></Button>
                <Button variant="ghost" disabled={i === secs.length - 1} onClick={() => move(i, 1)} aria-label="أسفل"><Icons.ArrowDown className="h-4 w-4" /></Button>
                <Button variant="ghost" onClick={() => setSecs(secs.filter((_, j) => j !== i))} aria-label="احذف القسم"><Icons.Trash2 className="h-4 w-4 text-red-600" /></Button>
              </span>
            </div>
            {s.kind === 'table' && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {(s.columns ?? []).map((c, k) => (
                  <span key={c.key} className="flex items-center gap-1">
                    <Input value={c.label} onChange={(e) => edit(i, { columns: s.columns!.map((x, j) => (j === k ? { ...x, label: e.target.value } : x)) })} aria-label="عمود" className="w-36" />
                    <button className="text-red-600" aria-label="احذف العمود" onClick={() => edit(i, { columns: s.columns!.filter((_, j) => j !== k) })}><Icons.X className="h-4 w-4" /></button>
                  </span>
                ))}
                <Button variant="secondary" onClick={() => edit(i, { columns: [...(s.columns ?? []), { key: uid('c'), label: 'عمود جديد' }] })}>أضف عموداً</Button>
              </div>
            )}
            {s.kind === 'fields' && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {(s.fields ?? []).map((f, k) => (
                  <span key={f.key} className="flex items-center gap-1">
                    <Input value={f.label} onChange={(e) => edit(i, { fields: s.fields!.map((x, j) => (j === k ? { ...x, label: e.target.value } : x)) })} aria-label="حقل" className="w-44" />
                    <button className="text-red-600" aria-label="احذف الحقل" onClick={() => edit(i, { fields: s.fields!.filter((_, j) => j !== k) })}><Icons.X className="h-4 w-4" /></button>
                  </span>
                ))}
                <Button variant="secondary" onClick={() => edit(i, { fields: [...(s.fields ?? []), { key: uid('f'), label: 'حقل جديد' }] })}>أضف حقلاً</Button>
              </div>
            )}
          </li>
        ))}
      </ol>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => setSecs([...secs, { id: uid('sec'), title: 'قسم جديد', stage: 'detailed', kind: 'table', tripTypes: ['internal', 'external'], columns: [{ key: uid('c'), label: 'البند' }] }])}>أضف قسماً</Button>
        <Button variant="ghost" onClick={() => setSecs(defaultDocTemplate())}>أعد القالب الافتراضي</Button>
        {!me.isSupervisor && <Button onClick={() => act(() => repos.settings.update({ docTemplate: secs }), 'حُفظ القالب للرحلات الجديدة')}>احفظ القالب</Button>}
      </div>
    </Card>
  );
}
