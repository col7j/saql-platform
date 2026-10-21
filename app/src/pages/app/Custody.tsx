import { useDB, useMe } from '@/state/store';
import { Empty, Notice, PageHeader } from '@/ui';
import { CustodyCard } from './CustodyCard';

export default function CustodyPage() {
  const db = useDB();
  const me = useMe();
  const mine = db.custodies.filter((c) => c.recipientId === me.person.id);
  return (
    <div>
      <PageHeader title="عهدتي" subtitle="أنت المسؤول الكامل عن العهدة: الآيبان، تأكيد الاستلام، الفواتير، إرجاع الفائض، وطلب الإغلاق" />
      <Notice>الرحلات: قائد المجموعة (أو قائد فريق الرحلة) · لقاءات التركيز ومنها العمرة: الميسّر · اللقاءات الفردية: غالباً بلا ميزانية.</Notice>
      <div className="mt-4 space-y-6">
        {mine.length === 0 ? <Empty title="لا عهد باسمك" text="تُصرف العهدة بعد اعتماد الموازنة" /> : mine.map((c) => <CustodyCard key={c.id} custody={c} />)}
      </div>
    </div>
  );
}
