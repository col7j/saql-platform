// صفحة الطباعة (A4، عربية RTL، بخط IBM Plex Sans Arabic وبهوية صقل) مع زر «تصدير PDF».
// نسخة مفصلة (كل الأقسام الظاهرة) ونسخة مختصرة (اللقطات الضرورية، والمخرجات ومواعيدها، والتواصل).
// رأس وتذييل بالإصدار والتاريخ يتكرران في كل صفحة، وبلا قطع للصفوف والعناوين بين الصفحات.
// في المنصة الحقيقية يولّد الخادم الملف بمتصفح بلا واجهة من هذه الصفحة نفسها.
import { useParams, useSearchParams } from 'react-router-dom';
import { fmtDate } from '@/domain/dates';
import { freezeBrief, latestSnapshot, publicContent, shortContent } from '@/domain/media';
import { useDB } from '@/state/store';
import { Button, Empty, Icons, Tabs } from '@/ui';
import { BriefDocument } from './BriefDocument';

export default function PrintBrief() {
  const { id } = useParams();
  const db = useDB();
  const [params, setParams] = useSearchParams();
  const mode = params.get('mode') === 'short' ? 'short' : 'full';
  const brief = db.mediaBriefs.find((b) => b.id === id);
  if (!brief) return <Empty title="الموجز غير موجود" />;
  const snap = latestSnapshot(brief);
  const frozen = snap ? snap.data : freezeBrief(db, brief);
  const data = mode === 'short' ? shortContent(frozen) : publicContent(frozen);
  const meta = snap ? `الإصدار ${snap.version} · آخر تحديث ${fmtDate(snap.at)}` : 'مسودة غير معتمدة';
  return (
    <div>
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs className="!mb-0" value={mode} onChange={(m) => setParams({ mode: m })} tabs={[{ key: 'full', label: 'نسخة مفصلة' }, { key: 'short', label: 'نسخة مختصرة' }]} />
        <Button onClick={() => window.print()} icon={<Icons.Printer className="h-4 w-4" />}>تصدير PDF</Button>
      </div>
      <div className="print-doc mx-auto max-w-[794px] rounded-2xl border border-ink-100 bg-white p-8 shadow-card">
        <table className="print-table w-full">
          <thead><tr><td>
            <div className="mb-4 flex items-center justify-between border-b border-brand-600 pb-2"><img src="./brand/logo-horizontal.svg" alt="صقل" className="h-9" /><span className="text-xs text-ink-500">{meta}</span></div>
          </td></tr></thead>
          <tfoot><tr><td><div className="mt-4 flex justify-between border-t border-ink-100 pt-2 text-xs text-ink-500"><span>{data.title}</span><span>{meta}</span></div></td></tr></tfoot>
          <tbody><tr><td>
            <h1 className="mb-1 text-[26px] font-bold leading-[1.3]">{data.title}</h1>
            <p className="mb-6 text-sm text-ink-500">{mode === 'short' ? 'نسخة مختصرة' : 'نسخة مفصلة'}</p>
            <BriefDocument data={data} />
          </td></tr></tbody>
        </table>
      </div>
    </div>
  );
}
