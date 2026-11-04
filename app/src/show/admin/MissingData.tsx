// «بيانات ناقصة»: ما لم يُملأ بعد في العرض (أسماء وشعارات وصور وفيديو وروابط)، داخل المحرّر فقط.
// النقر على فقرة يفتحها للتعبئة. شاشة العرض لا تُظهر الأماكن الفارغة أبداً.
import { useState } from 'react';
import { Icons, Modal } from '@/ui';
import type { Segment } from '../model';
import { missingData } from '../ext';

export function MissingData({ segments, onOpen }: { segments: Segment[]; onOpen: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const list = missingData(segments);
  const n = list.reduce((k, s) => k + s.fields.length, 0);
  if (!n) return null;
  return (
    <>
      <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 rounded-full border border-accent-100 bg-accent-50 px-2.5 py-1 text-xs text-accent-700" data-missing-badge>
        <Icons.ListTodo className="h-3.5 w-3.5" /> بيانات ناقصة <span className="num">({n})</span>
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="بيانات ناقصة">
        <p className="mb-3 text-sm text-ink-600">حقول لم تُملأ بعد. تظهر هنا وفي المحرّر فقط، ولا يظهر مكانها الفارغ على شاشة العرض.</p>
        <ul className="space-y-2" data-missing-list>
          {list.map((s) => (
            <li key={s.id}>
              <button onClick={() => (onOpen(s.id), setOpen(false))} className="w-full rounded-xl border border-ink-100 p-3 text-start hover:border-brand-600 hover:bg-brand-50">
                <span className="block text-sm font-semibold text-ink-900">{s.title}</span>
                <span className="mt-1 flex flex-wrap gap-1.5">
                  {s.fields.map((f) => <span key={f} className="rounded-full bg-accent-50 px-2 py-0.5 text-xs text-accent-700">{f}</span>)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Modal>
    </>
  );
}
