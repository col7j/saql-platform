// الموجزات: قائمة بحالاتها وزر رئيسي واحد «موجز جديد»
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fmtDate } from '@/domain/dates';
import { hasMediaPerm, latestSnapshot, pendingChanges, resolveEvent } from '@/domain/media';
import type { MediaBrief } from '@/domain/types';
import { useDB, useMe } from '@/state/store';
import { Badge, Button, DataTable, FilterPills, Icons, PageHeader } from '@/ui';

const statusLabel = { draft: 'مسودة', approved: 'معتمد', archived: 'مؤرشف' } as const;
const statusTone = { draft: 'orange', approved: 'green', archived: 'gray' } as const;

export default function BriefsPage() {
  const db = useDB();
  const me = useMe();
  const nav = useNavigate();
  const [f, setF] = useState<'all' | MediaBrief['status']>('all');
  const list = [...db.mediaBriefs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).filter((b) => (f === 'all' ? b.status !== 'archived' : b.status === f));
  const count = (s: MediaBrief['status']) => db.mediaBriefs.filter((b) => b.status === s).length;
  return (
    <div>
      <PageHeader title="الموجزات" actions={hasMediaPerm(db, me.person.id, 'edit') && <Button onClick={() => nav('/app/media/briefs/new')} icon={<Icons.Plus className="h-4 w-4" />}>موجز جديد</Button>} />
      <div className="mb-4"><FilterPills value={f} onChange={setF} options={[{ key: 'all', label: 'الكل' }, { key: 'draft', label: `مسودة (${count('draft')})` }, { key: 'approved', label: `معتمد (${count('approved')})` }, { key: 'archived', label: `مؤرشف (${count('archived')})` }]} /></div>
      <DataTable
        rows={list} rowKey={(b) => b.id} minWidth={760}
        columns={[
          { key: 'title', header: 'الموجز', cell: (b) => <button className="min-h-[44px] text-start font-medium text-brand-700 hover:underline md:min-h-0" onClick={() => nav(`/app/media/briefs/${b.id}`)}>{b.content.title}</button> },
          { key: 'kind', header: 'النوع', cell: (b) => (b.kind === 'week' ? 'أسبوعي' : 'لقاء') },
          { key: 'events', header: 'الفعاليات', cell: (b) => b.content.events.map((e) => resolveEvent(db, e.ref)?.title ?? '—').join('، ') },
          { key: 'date', header: 'التاريخ', cell: (b) => { const d = b.content.events.map((e) => resolveEvent(db, e.ref)?.date).filter(Boolean).sort()[0]; return d ? fmtDate(d) : '—'; } },
          { key: 'status', header: 'الحالة', cell: (b) => (
            <span className="flex flex-wrap items-center gap-1">
              <Badge tone={statusTone[b.status]}>{statusLabel[b.status]}{latestSnapshot(b) && b.status === 'approved' ? ` · الإصدار ${latestSnapshot(b).version}` : ''}</Badge>
              {b.status === 'approved' && pendingChanges(db, b).length > 0 && <Badge tone="orange">تغييرات معلّقة</Badge>}
              {b.approvalRequest && <Badge tone="orange">بانتظار القائد العام</Badge>}
            </span>
          ) },
        ]}
      />
    </div>
  );
}
