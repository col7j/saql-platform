// المؤشرات: للبرنامج كله وللموجز الواحد، من الموجزات المعتمدة. نسبة الاكتمال لا تحتسب اللقطات الاختيارية،
// والناقص بعد الفعالية يفرّق بين «لم تُنفَّذ» و«نُفّذت بلا إثبات»
import { briefMetrics, execOf, itemKindLabel, itemStatusLabel, latestSnapshot, type MissingItem } from '@/domain/media';
import { useDB } from '@/state/store';
import { Card, DataTable, Empty, Icons, PageHeader, Progress, Stat } from '@/ui';

export default function MetricsPage() {
  const db = useDB();
  const approved = db.mediaBriefs.filter((b) => b.status === 'approved' && latestSnapshot(b));
  const all = briefMetrics(approved);
  const missing = (rows: MissingItem[], kind: 'not' | 'proof') => (
    <DataTable
      rows={rows} rowKey={(r) => r.item.id} minWidth={560}
      empty={<Empty title={kind === 'not' ? 'لا عناصر لم تُنفَّذ' : 'لا عناصر بلا إثبات'} icon={<Icons.CheckCheck className="h-7 w-7" />} />}
      columns={[
        { key: 'item', header: 'البند', cell: (r) => <span className="font-medium">{r.item.title}</span> },
        { key: 'kind', header: 'النوع', cell: (r) => itemKindLabel[r.item.kind] },
        { key: 'brief', header: 'الموجز', cell: (r) => r.briefTitle },
        { key: 'st', header: 'الحالة', cell: (r) => (kind === 'not' ? itemStatusLabel[r.status] + (execOf(approved.find((b) => b.id === r.briefId)!, r.item.id).reason ? ` — ${execOf(approved.find((b) => b.id === r.briefId)!, r.item.id).reason}` : '') : 'مكتملة بلا رابط إثبات') },
      ]}
    />
  );
  if (approved.length === 0) return <div><PageHeader title="المؤشرات" /><Empty title="لا موجزات معتمدة" /></div>;
  return (
    <div className="space-y-6">
      <PageHeader title="المؤشرات" subtitle="للبرنامج كله، من الموجزات المعتمدة" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label="نسبة اكتمال التوثيق" value={`${all.completionPct}%`} hint={`${all.shotsDocumented} من ${all.shotsRequired} لقطة مطلوبة مكتملة بإثبات`} icon={<Icons.Camera className="h-5 w-5" />} tone="green" />
        <Stat label="اللقطات المطلوبة والمنفذة" value={`${all.shotsDone} / ${all.shotsRequired}`} hint="الاختيارية خارج الحساب" icon={<Icons.Aperture className="h-5 w-5" />} />
        <Stat label="المقابلات المنفذة" value={`${all.interviewsDone} / ${all.interviewsTotal}`} icon={<Icons.Mic className="h-5 w-5" />} />
        <Stat label="نسبة تسليم المخرجات" value={`${all.deliveryPct}%`} hint={`${all.deliverablesDelivered} من ${all.deliverablesRequired} مطلوبة`} icon={<Icons.PackageCheck className="h-5 w-5" />} />
        <Stat label="الالتزام بالمواعيد" value={`${all.onTimePct}%`} hint="المسلَّم قبل موعده ÷ المسلَّم" icon={<Icons.Timer className="h-5 w-5" />} tone="accent" />
      </div>
      <Card title="لكل موجز" pad={false}>
        <div className="p-4 sm:p-6">
          <DataTable
            rows={approved} rowKey={(b) => b.id} minWidth={760}
            columns={[
              { key: 't', header: 'الموجز', cell: (b) => <span className="font-medium">{b.content.title}</span> },
              { key: 'c', header: 'الاكتمال', cell: (b) => { const m = briefMetrics([b]); return <div className="min-w-[120px]"><span className="num text-xs">{m.completionPct}%</span><Progress value={m.completionPct} tone="green" /></div>; } },
              { key: 's', header: 'اللقطات', cell: (b) => { const m = briefMetrics([b]); return <span className="num">{m.shotsDone} / {m.shotsRequired}</span>; } },
              { key: 'i', header: 'المقابلات', cell: (b) => { const m = briefMetrics([b]); return <span className="num">{m.interviewsDone} / {m.interviewsTotal}</span>; } },
              { key: 'd', header: 'المخرجات', cell: (b) => { const m = briefMetrics([b]); return <span className="num">{m.deliverablesDelivered} / {m.deliverablesRequired}</span>; } },
              { key: 'o', header: 'الالتزام', cell: (b) => <span className="num">{briefMetrics([b]).onTimePct}%</span> },
            ]}
          />
        </div>
      </Card>
      <Card title={`لم تُنفَّذ (${all.notExecuted.length})`} subtitle="مطلوبة وانتهت فعاليتها، وهي متعذرة أو لم تبدأ أو ما زالت قيد التنفيذ"><div>{missing(all.notExecuted, 'not')}</div></Card>
      <Card title={`نُفّذت بلا إثبات (${all.noProof.length})`} subtitle="مكتملة لكن بلا رابط إثبات"><div>{missing(all.noProof, 'proof')}</div></Card>
    </div>
  );
}
