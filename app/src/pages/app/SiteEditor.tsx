// الموقع العام: أقسام بقوالب جاهزة (نص، صورة، قائمة أشخاص، جدول) يضيفها القائد العام (أو المفوَّض مؤقتاً)
// ويحذفها ويخفيها ويعيد ترتيبها، بلا محرر مواقع حر. فريق العمل والترتيب يُقرآن من بيانات المنصة.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { uid } from '@/domain/id';
import { canEditSite } from '@/domain/permissions';
import type { SiteContent, SiteSection } from '@/domain/types';
import { act, repos, useDB, useMe } from '@/state/store';
import { Badge, Button, Card, Empty, Field, Icons, Input, PageHeader, Select, Textarea, Toggle } from '@/ui';
import { AttachmentInput } from '@/ui/attachments';

const typeLabel: Record<SiteSection['type'], string> = { text: 'نص', image: 'صورة', people: 'قائمة أشخاص', table: 'جدول' };

function blank(type: SiteSection['type']): SiteSection {
  const base = { id: uid('sec'), type, title: `قسم ${typeLabel[type]} جديد`, hidden: false };
  if (type === 'text') return { ...base, body: '' };
  if (type === 'image') return { ...base, caption: '' };
  if (type === 'people') return { ...base, people: 'staff' };
  return { ...base, table: { source: 'manual', columns: ['العمود الأول', 'العمود الثاني'], rows: [['', '']] } };
}

export default function SiteEditor() {
  const db = useDB();
  const me = useMe();
  const [s, setS] = useState<SiteContent>(structuredClone(db.settings.site));
  if (!canEditSite(db, me.person.id)) return <Empty title="تحرير الموقع للقائد العام أو من يفوّضه بصلاحية مؤقتة" />;
  const upd = (id: string, p: Partial<SiteSection>) => setS({ ...s, sections: s.sections.map((x) => (x.id === id ? { ...x, ...p } : x)) });
  const move = (i: number, dir: -1 | 1) => {
    const list = [...s.sections];
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    setS({ ...s, sections: list });
  };
  return (
    <div>
      <PageHeader title="الموقع العام" subtitle="أقسام بقوالب جاهزة بالترتيب. فريق العمل يظهر بلا أرقام الجوال، والترتيب بالأسماء بعد نشر التشكيل"
        actions={<><Link to="/" target="_blank" className="text-sm text-brand-600">معاينة</Link><Button onClick={() => act(() => repos.settings.update({ site: s }), 'نُشر المحتوى')}>احفظ وانشر</Button></>} />
      <div className="space-y-4">
        <Card title="الواجهة">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="العنوان"><Input value={s.heroTitle} onChange={(e) => setS({ ...s, heroTitle: e.target.value })} /></Field>
            <Field label="كلمة التمييز" hint="كلمة من العنوان تظهر باللون الأساسي"><Input value={s.heroAccent ?? ''} onChange={(e) => setS({ ...s, heroAccent: e.target.value })} /></Field>
            <Field label="بريد التواصل"><Input dir="ltr" value={s.contactEmail} onChange={(e) => setS({ ...s, contactEmail: e.target.value })} /></Field>
            <Field label="النبذة" className="sm:col-span-2"><Textarea rows={2} value={s.heroSubtitle} onChange={(e) => setS({ ...s, heroSubtitle: e.target.value })} /></Field>
          </div>
        </Card>
        {s.sections.map((sec, i) => (
          <Card key={sec.id} title={<span className="flex items-center gap-2"><Badge>{typeLabel[sec.type]}</Badge><Input className="max-w-xs" value={sec.title} onChange={(e) => upd(sec.id, { title: e.target.value })} /></span>}
            action={<span className="flex items-center gap-1">
              <Toggle checked={!sec.hidden} onChange={(v) => upd(sec.id, { hidden: !v })} label={<span className="text-xs">ظاهر</span>} />
              <button onClick={() => move(i, -1)} aria-label="أعلى" className="rounded p-1 hover:bg-ink-100"><Icons.ChevronUp className="h-4 w-4" /></button>
              <button onClick={() => move(i, 1)} aria-label="أسفل" className="rounded p-1 hover:bg-ink-100"><Icons.ChevronDown className="h-4 w-4" /></button>
              <button onClick={() => setS({ ...s, sections: s.sections.filter((x) => x.id !== sec.id) })} aria-label="احذف" className="rounded p-1 text-ink-400 hover:bg-red-50 hover:text-red-600"><Icons.Trash2 className="h-4 w-4" /></button>
            </span>}>
            {sec.type === 'text' && <Textarea rows={4} value={sec.body ?? ''} onChange={(e) => upd(sec.id, { body: e.target.value })} />}
            {sec.type === 'image' && <div className="grid gap-3 sm:grid-cols-2"><AttachmentInput value={sec.image} onChange={(image) => upd(sec.id, { image })} label="الصورة" /><Field label="التعليق"><Input value={sec.caption ?? ''} onChange={(e) => upd(sec.id, { caption: e.target.value })} /></Field></div>}
            {sec.type === 'people' && <Select value={sec.people} onChange={(e) => upd(sec.id, { people: e.target.value as SiteSection['people'] })} options={[{ value: 'staff', label: 'فريق العمل (الأسماء والمناصب والصور، بلا أرقام)' }, { value: 'top5', label: 'المشاركون المتميزون (الخمسة الأوائل بعد النشر)' }]} aria-label="المصدر" />}
            {sec.type === 'table' && sec.table && (
              <div className="space-y-2">
                <Select value={sec.table.source} onChange={(e) => upd(sec.id, { table: { ...sec.table!, source: e.target.value as 'manual' } })} options={[{ value: 'manual', label: 'جدول يدوي' }, { value: 'participants', label: 'المشاركون أبجدياً مع المجموعة (تلقائي)' }, { value: 'groups', label: 'المجموعات وترتيبها (تلقائي)' }]} aria-label="المصدر" />
                {sec.table.source === 'manual' && (
                  <>
                    <div className="flex gap-2">{sec.table.columns.map((c, ci) => <Input key={ci} value={c} onChange={(e) => upd(sec.id, { table: { ...sec.table!, columns: sec.table!.columns.map((x, k) => (k === ci ? e.target.value : x)) } })} />)}</div>
                    {sec.table.rows.map((r, ri) => (
                      <div key={ri} className="flex gap-2">
                        {r.map((c, ci) => <Input key={ci} value={c} onChange={(e) => upd(sec.id, { table: { ...sec.table!, rows: sec.table!.rows.map((row, k) => (k === ri ? row.map((x, m) => (m === ci ? e.target.value : x)) : row)) } })} />)}
                        <button onClick={() => upd(sec.id, { table: { ...sec.table!, rows: sec.table!.rows.filter((_, k) => k !== ri) } })} aria-label="احذف الصف"><Icons.X className="h-4 w-4 text-ink-300" /></button>
                      </div>
                    ))}
                    <Button size="sm" variant="secondary" onClick={() => upd(sec.id, { table: { ...sec.table!, rows: [...sec.table!.rows, sec.table!.columns.map(() => '')] } })}>أضف صفاً</Button>
                  </>
                )}
              </div>
            )}
          </Card>
        ))}
        <Card title="أضف قسماً">
          <div className="flex flex-wrap gap-2">{(Object.keys(typeLabel) as SiteSection['type'][]).map((t) => <Button key={t} variant="secondary" onClick={() => setS({ ...s, sections: [...s.sections, blank(t)] })} icon={<Icons.Plus className="h-4 w-4" />}>{typeLabel[t]}</Button>)}</div>
        </Card>
      </div>
    </div>
  );
}
