// التنسيقات (للرحلة الخارجية): عرض متابعة للموافقات والسكن والمواصلات والضيافة. لا يُدخَل فيه شيء: المصدر وثيقة الرحلة
import { coordinationView } from '@/domain/tripDocument';
import { docFor } from '@/domain/workflow';
import type { Trip } from '@/domain/types';
import { personName, useDB } from '@/state/store';
import { Badge, Card, Empty, Notice } from '@/ui';
import { fmtDate } from '@/domain/dates';

const st = { pending: 'لم يبدأ', in_progress: 'قيد التنفيذ', done: 'تم' } as const;
const tone = { pending: 'gray', in_progress: 'orange', done: 'green' } as const;

export default function CoordinationTab({ trip }: { trip: Trip }) {
  const db = useDB();
  const v = coordinationView(db, trip, docFor(db, trip.id, 'detailed'), (id) => personName(db, id));
  return (
    <div className="space-y-4">
      <Notice>عرض متابعة فقط: تُعبَّأ الموافقات والسكن في «النماذج والاعتماد» (الخطة التفصيلية) فلا تتكرر البيانات.</Notice>
      <Card title="الموافقات">
        {!v.approvals.length ? <Empty title="لا موافقات مسجّلة" text="تُضاف من الخطة التفصيلية" /> : (
          <ul className="divide-y divide-ink-100 text-sm">
            {v.approvals.map((a, i) => (
              <li key={i} className="flex flex-wrap items-center gap-3 py-2">
                <span className="font-medium">{a.name}</span><span className="text-ink-600">{a.authority}</span>
                <span className="text-xs text-ink-500">المسؤول: {a.owner}</span>{a.due && <span className="num text-xs text-ink-500">الموعد: {fmtDate(a.due)}</span>}
                <Badge tone={a.done ? 'green' : 'orange'}>{a.done ? 'تمت' : 'لم تتم'}</Badge>{!a.done && a.reason && <span className="text-xs text-ink-500">{a.reason}</span>}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="السكن">
        {!v.housing.length ? <Empty title="لا سكن مسجّل" text="يُضاف من الخطة التفصيلية" /> : <ul className="text-sm">{v.housing.map((h, i) => <li key={i} className="py-1">{h.type} — {h.location} ({h.units} وحدات)</li>)}</ul>}
      </Card>
      <Card title="المواصلات والضيافة">
        <div className="flex flex-wrap gap-4 text-sm">
          {[['المواصلات', v.transport], ['الضيافة', v.hosting]].map(([label, c]) => (
            <div key={label as string}>{label as string}: {c ? <Badge tone={tone[(c as { status: keyof typeof st }).status]}>{st[(c as { status: keyof typeof st }).status]}</Badge> : '—'}</div>
          ))}
        </div>
      </Card>
    </div>
  );
}
