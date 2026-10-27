// طلباتي: الشاشة نفسها «الطلبات والعهد» بمنظور صاحب الطلب أو العهدة
import { PageHeader } from '@/ui';
import { RequestsCustody } from './RequestsCustody';

export default function RequestsPage() {
  return (
    <div>
      <PageHeader title="طلباتي" subtitle="طلبات الميزانية التي قدّمتها، والعهد التي بعهدتك" />
      <RequestsCustody perspective="mine" />
    </div>
  );
}
