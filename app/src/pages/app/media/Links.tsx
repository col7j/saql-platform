// الروابط: كل روابط المشاركة بنوعها وتاريخ انتهائها وآخر دخول، وزر إلغاء فوري
import { useState } from 'react';
import { fmtDate, fmtDateTime } from '@/domain/dates';
import { linkState } from '@/domain/media';
import type { MediaLink } from '@/domain/types';
import { MEDIA_DEMO_TOKENS } from '@/data/seed-media';
import { act, repos, useDB } from '@/state/store';
import { Badge, Button, DataTable, Empty, FilterPills, Notice, PageHeader, askConfirm } from '@/ui';

const stateLabel = { active: 'نشط', expired: 'منتهٍ', revoked: 'ملغى' } as const;
const stateTone = { active: 'green', expired: 'gray', revoked: 'red' } as const;

export default function LinksPage() {
  const db = useDB();
  const [f, setF] = useState<'active' | 'all'>('active');
  const rows = db.mediaLinks.filter((l) => f === 'all' || linkState(l) === 'active');
  const base = `${location.origin}${location.pathname}#/brief/`;
  const demo = db.mediaLinks.filter((l) => linkState(l) === 'active' && (l.id === 'ml_read' || l.id === 'ml_track'));
  return (
    <div>
      <PageHeader title="الروابط" subtitle="يظهر الرابط مرة واحدة عند إصداره. هنا تتابع الدخول وتلغي ما تشاء" />
      <div className="mb-4"><FilterPills value={f} onChange={setF} options={[{ key: 'active', label: 'النشطة' }, { key: 'all', label: 'الكل' }]} /></div>
      <DataTable
        rows={rows} rowKey={(l) => l.id} minWidth={820} actionsKey="act" empty={<Empty title="لا روابط" text="تُصدر الروابط من «اعتمد وشارك» في صفحة الموجز." />}
        columns={[
          { key: 'brief', header: 'الموجز', cell: (l) => <span className="font-medium">{db.mediaBriefs.find((b) => b.id === l.briefId)?.content.title ?? '—'}</span> },
          { key: 'kind', header: 'النوع', cell: (l) => (l.kind === 'track' ? 'متابعة تنفيذ' : 'قراءة فقط') },
          { key: 'exp', header: 'ينتهي', cell: (l) => (l.expiresAt ? fmtDate(l.expiresAt) : 'بلا انتهاء') },
          { key: 'last', header: 'آخر دخول', cell: (l) => (l.lastAccessAt ? <span>{fmtDateTime(l.lastAccessAt)}{l.lastVisitor && <span className="block text-xs text-ink-500">{l.lastVisitor}</span>}</span> : 'لم يُفتح') },
          { key: 'n', header: 'الدخول', cell: (l) => <span className="num">{l.accessCount}</span> },
          { key: 'state', header: 'الحالة', cell: (l: MediaLink) => <Badge tone={stateTone[linkState(l)]}>{stateLabel[linkState(l)]}</Badge> },
          { key: 'act', header: '', cell: (l) => linkState(l) === 'active' && (
            <Button size="sm" variant="danger" onClick={() => askConfirm({ title: 'إلغاء الرابط', body: 'يمنع الدخول فوراً ولا يمكن التراجع.', cta: 'ألغِ الرابط', danger: true, run: () => act(() => repos.media.revokeLink(l.id), 'أُلغي الرابط') })}>ألغِ</Button>
          ) },
        ]}
      />
      {demo.length > 0 && (
        <div className="mt-6"><Notice tone="orange">
          <b>للتجربة فقط:</b> الرابطان التجريبيان يعملان بلا تسجيل دخول.
          <ul className="mt-1 space-y-1" dir="ltr">
            {demo.map((l) => <li key={l.id} className="break-all text-xs">{l.kind === 'read' ? 'read' : 'track'}: {base}{l.kind === 'read' ? MEDIA_DEMO_TOKENS.read : MEDIA_DEMO_TOKENS.track}</li>)}
          </ul>
        </Notice></div>
      )}
    </div>
  );
}
