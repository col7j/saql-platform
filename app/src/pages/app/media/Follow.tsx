// المتابعة: لوحة تنفيذ الموجزات المعتمدة. اللقطات والمقابلات والمخرجات وحالاتها، وما رفعه الفريق باسم فاعله ووقته
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fmtDateTime } from '@/domain/dates';
import { execOf, frozenItems, hasMediaPerm, itemKindLabel, itemStatusLabel, latestSnapshot } from '@/domain/media';
import type { MediaBrief } from '@/domain/types';
import { repos, useDB, useMe } from '@/state/store';
import { Badge, Card, DataTable, Empty, Modal, Select } from '@/ui';
import { ItemPanel, statusTone } from './ItemPanel';

export default function FollowPage() {
  const db = useDB();
  const me = useMe();
  const [params, setParams] = useSearchParams();
  const approved = db.mediaBriefs.filter((b) => b.status === 'approved' && latestSnapshot(b));
  const brief: MediaBrief | undefined = approved.find((b) => b.id === params.get('brief')) ?? approved[0];
  const [open, setOpen] = useState<string | null>(null);
  const canEdit = hasMediaPerm(db, me.person.id, 'edit');
  if (!brief) return <Empty title="لا موجزات معتمدة" text="تظهر هنا لوحة التنفيذ بعد اعتماد أول موجز." />;
  const snap = latestSnapshot(brief);
  const items = frozenItems(snap.data);
  const activity = db.mediaActivity.filter((a) => a.briefId === brief.id).slice(0, 8);
  const current = items.find((i) => i.id === open);
  return (
    <div className="space-y-6">
      <div className="max-w-md"><Select aria-label="الموجز" value={brief.id} onChange={(e) => setParams({ brief: e.target.value })} options={approved.map((b) => ({ value: b.id, label: b.content.title }))} /></div>
      <DataTable
        rows={items} rowKey={(i) => i.id} minWidth={860} actionsKey="open"
        columns={[
          { key: 'title', header: 'البند', cell: (i) => <span><span className="font-medium">{i.title}</span>{i.eventTitle && snap.data.events.length > 1 && <span className="block text-xs text-ink-500">{i.eventTitle}</span>}</span> },
          { key: 'kind', header: 'النوع', cell: (i) => <span>{itemKindLabel[i.kind]}{!i.required && <span className="text-ink-500"> · اختيارية</span>}</span> },
          { key: 'status', header: 'الحالة', cell: (i) => { const e = execOf(brief, i.id); return <span className="flex flex-wrap items-center gap-1"><Badge tone={statusTone[e.status]}>{itemStatusLabel[e.status]}</Badge>{e.status === 'done' && !e.proofs.length && <Badge tone="orange">بلا إثبات</Badge>}</span>; } },
          { key: 'proof', header: 'الإثبات', cell: (i) => execOf(brief, i.id).proofs.length || '—' },
          { key: 'by', header: 'آخر تحديث', cell: (i) => { const e = execOf(brief, i.id); return e.updatedBy ? <span>{e.updatedBy}<span className="block text-xs text-ink-500">{fmtDateTime(e.updatedAt)}</span></span> : '—'; } },
          { key: 'open', header: '', cell: (i) => <button className="inline-flex min-h-[44px] items-center rounded-full px-3 text-sm font-medium text-brand-700 hover:bg-brand-50 md:min-h-[34px]" onClick={() => setOpen(i.id)}>{canEdit ? 'حدّث' : 'التفاصيل'}</button> },
        ]}
      />
      <Card title="آخر نشاط الفريق" subtitle="ما سجّله الزوار عبر رابط المتابعة">
        {activity.length === 0 ? <p className="text-sm text-ink-500">لا نشاط بعد.</p> : (
          <ul className="space-y-2 text-sm">{activity.map((a) => <li key={a.id}><b>{a.actor}</b> {a.action} <span className="text-ink-600">— {a.itemTitle}</span> <span className="text-xs text-ink-500">{fmtDateTime(a.at)}</span></li>)}</ul>
        )}
      </Card>
      {current && (
        <Modal open onClose={() => setOpen(null)} title={`${itemKindLabel[current.kind]}: ${current.title}`}>
          <ItemPanel exec={execOf(brief, current.id)} readOnly={!canEdit} onPatch={(p) => repos.media.setItem(brief.id, current.id, p)} />
        </Modal>
      )}
    </div>
  );
}
