// الربط والتكاملات: حقول كتابة فقط بقناع. القيمة لا تُعرض بعد الحفظ ولا تُقرأ من الواجهة (الخزنة: data/secrets.ts)
import { useState } from 'react';
import { fmtDateTime } from '@/domain/dates';
import { INTEGRATION_KEYS } from '@/domain/integrations';
import { act, repos, useDB } from '@/state/store';
import { Badge, Button, Card, Input, Notice, PageHeader } from '@/ui';
import { PersonChip } from '@/ui/domain';

export default function IntegrationsPage() {
  const db = useDB();
  const [vals, setVals] = useState<Record<string, string>>({});
  return (
    <div className="space-y-4">
      <PageHeader title="الربط والتكاملات" subtitle="مفاتيح البريد والتخزين وقاعدة البيانات: يملكها ويديرها مسؤول اللجنة التقنية وحده" />
      <Notice>الحقول للكتابة فقط: بعد الحفظ لا تُعرض القيمة. في المنصة الحقيقية تُحفظ في متغيرات بيئة على الخادم لا في الكود ولا في ملفات الواجهة.</Notice>
      <Card>
        <ul className="divide-y divide-ink-100">
          {INTEGRATION_KEYS.map((k) => {
            const m = db.integrations?.[k.key];
            return (
              <li key={k.key} className="grid gap-2 py-3 sm:grid-cols-[1fr_1.2fr_auto] sm:items-center">
                <div><div className="font-medium">{k.label}</div><div className="text-xs text-ink-500">{k.hint}</div>
                  {m?.set && <div className="mt-1 text-xs text-ink-500">آخر ضبط {fmtDateTime(m.updatedAt)} {m.updatedBy && <PersonChip id={m.updatedBy} size={18} />}</div>}</div>
                <div className="flex items-center gap-2">
                  <Input type="password" autoComplete="off" dir="ltr" placeholder={m?.set ? '••••••••••••' : 'غير مضبوط'} value={vals[k.key] ?? ''} onChange={(e) => setVals({ ...vals, [k.key]: e.target.value })} aria-label={k.label} />
                  <Badge tone={m?.set ? 'green' : 'gray'}>{m?.set ? 'مضبوط' : 'غير مضبوط'}</Badge>
                </div>
                <div className="flex gap-2">
                  <Button disabled={!vals[k.key]?.trim()} onClick={() => act(() => { repos.integrations.save(k.key, vals[k.key]); setVals({ ...vals, [k.key]: '' }); }, 'حُفظ المفتاح')}>احفظ</Button>
                  {m?.set && <Button variant="ghost" onClick={() => act(() => repos.integrations.remove(k.key), 'حُذف المفتاح')}>احذف</Button>}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
