// تحرير محتوى الموقع العام (صلاحية "محرّر الموقع" يمنحها القائد العام)
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { canEditSite } from '@/domain/permissions';
import type { SiteContent } from '@/domain/types';
import { act, repos, useDB, useMe } from '@/state/store';
import { Button, Card, Empty, Field, Icons, Input, PageHeader, Textarea } from '@/ui';

export default function SiteEditor() {
  const db = useDB();
  const me = useMe();
  const [s, setS] = useState<SiteContent>(db.settings.site);
  if (!canEditSite(db, me.person.id)) return <Empty title="صلاحية تحرير الموقع يمنحها القائد العام" />;
  const list = <K extends 'pillars' | 'journey'>(k: K) => (
    <div className="space-y-2">
      {s[k].map((x, i) => (
        <div key={i} className="grid gap-2 sm:grid-cols-[200px_1fr_24px]">
          <Input value={x.title} onChange={(e) => setS({ ...s, [k]: s[k].map((y, j) => (j === i ? { ...y, title: e.target.value } : y)) })} />
          <Input value={x.text} onChange={(e) => setS({ ...s, [k]: s[k].map((y, j) => (j === i ? { ...y, text: e.target.value } : y)) })} />
          <button onClick={() => setS({ ...s, [k]: s[k].filter((_, j) => j !== i) })}><Icons.X className="h-4 w-4 text-ink-300" /></button>
        </div>
      ))}
      <Button size="sm" variant="secondary" onClick={() => setS({ ...s, [k]: [...s[k], { title: '', text: '' }] })}>أضف</Button>
    </div>
  );
  return (
    <div>
      <PageHeader title="تحرير الموقع العام" subtitle="الموقع تعريفي فقط. لا يحتوي الترتيب ولا النقاط ولا رابط المتابعة"
        actions={<><Link to="/" target="_blank" className="text-sm text-brand-600">معاينة</Link><Button onClick={() => act(() => repos.settings.update({ site: s }), 'نُشر المحتوى')}>احفظ وانشر</Button></>} />
      <div className="space-y-6">
        <Card title="الواجهة">
          <div className="grid gap-3">
            <Field label="العنوان"><Input value={s.heroTitle} onChange={(e) => setS({ ...s, heroTitle: e.target.value })} /></Field>
            <Field label="الوصف المختصر"><Textarea value={s.heroSubtitle} onChange={(e) => setS({ ...s, heroSubtitle: e.target.value })} /></Field>
          </div>
        </Card>
        <Card title="عن البرنامج">
          <Field label="النص"><Textarea rows={5} value={s.about} onChange={(e) => setS({ ...s, about: e.target.value })} /></Field>
          <Field label="الفئة المستهدفة" className="mt-3"><Input value={s.audience} onChange={(e) => setS({ ...s, audience: e.target.value })} /></Field>
        </Card>
        <Card title="ركائز البرنامج">{list('pillars')}</Card>
        <Card title="رحلة المشارك">{list('journey')}</Card>
        <Card title="الأسئلة الشائعة">
          <div className="space-y-2">
            {s.faq.map((x, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_24px]">
                <Input value={x.q} onChange={(e) => setS({ ...s, faq: s.faq.map((y, j) => (j === i ? { ...y, q: e.target.value } : y)) })} />
                <Input value={x.a} onChange={(e) => setS({ ...s, faq: s.faq.map((y, j) => (j === i ? { ...y, a: e.target.value } : y)) })} />
                <button onClick={() => setS({ ...s, faq: s.faq.filter((_, j) => j !== i) })}><Icons.X className="h-4 w-4 text-ink-300" /></button>
              </div>
            ))}
            <Button size="sm" variant="secondary" onClick={() => setS({ ...s, faq: [...s.faq, { q: '', a: '' }] })}>أضف سؤالاً</Button>
          </div>
          <Field label="بريد التواصل" className="mt-3"><Input dir="ltr" value={s.contactEmail} onChange={(e) => setS({ ...s, contactEmail: e.target.value })} /></Field>
        </Card>
      </div>
    </div>
  );
}
