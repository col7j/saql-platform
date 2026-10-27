// سجل التدقيق: مكوّن واحد لكل المجالات (الأدوار، الحسابات، الإعدادات، المالية). لا يُحذف منه شيء
import { useState } from 'react';
import { fmtDateTime } from '@/domain/dates';
import type { AuditEntry } from '@/domain/types';
import { useDB, useMe } from '@/state/store';
import { Badge, Card, DataTable, Empty, FilterPills, PageHeader } from '@/ui';
import { PersonChip } from '@/ui/domain';

type Area = NonNullable<AuditEntry['area']>;
const areaLabel: Record<Area, string> = { roles: 'الأدوار والصفات', accounts: 'الحسابات', settings: 'الإعدادات', finance: 'المالية' };

/** السجل بفلتر المجال. areas تحدد المجالات المعروضة لصاحب الشاشة */
export function AuditLog({ areas, title = 'سجل التدقيق', subtitle }: { areas: Area[]; title?: string; subtitle?: string }) {
  const db = useDB();
  const [f, setF] = useState<Area | 'all'>('all');
  const list = db.audit.filter((a) => areas.includes(a.area ?? 'finance') && (f === 'all' || (a.area ?? 'finance') === f));
  return (
    <Card title={title} subtitle={subtitle ?? 'من، ماذا، متى. لا يُحذف منه شيء'}>
      {areas.length > 1 && <FilterPills value={f} onChange={setF} options={[{ key: 'all' as const, label: 'الكل' }, ...areas.map((a) => ({ key: a, label: areaLabel[a] }))]} />}
      <div className="mt-2">
        <DataTable
          rows={[...list].reverse()}
          rowKey={(a) => a.id}
          empty={<Empty title="لا سجلات بعد" />}
          columns={[
            { key: 'what', header: 'الإجراء', cell: (a) => <span className="font-medium">{a.action}</span> },
            { key: 'at', header: 'متى', cell: (a) => <span className="num whitespace-nowrap">{fmtDateTime(a.at)}</span> },
            { key: 'by', header: 'من', cell: (a) => <PersonChip id={a.byId} size={22} /> },
            ...(areas.length > 1 ? [{ key: 'area', header: 'المجال', cell: (a: AuditEntry) => <Badge>{areaLabel[a.area ?? 'finance']}</Badge> }] : []),
            { key: 'detail', header: 'التفاصيل', cell: (a) => <span className="text-ink-600">{a.detail}</span> },
          ]}
        />
      </div>
    </Card>
  );
}

/** شاشة السجل لمسؤول التقنية والقائد العام: كل المجالات عدا المالية (سجلها في تقارير المالية) */
export default function AuditPage() {
  const me = useMe();
  return (
    <div>
      <PageHeader title="سجل التدقيق" subtitle="الأدوار والحسابات والإعدادات" />
      <AuditLog areas={me.isLeader ? ['roles', 'accounts', 'settings', 'finance'] : ['roles', 'accounts', 'settings']} />
    </div>
  );
}
