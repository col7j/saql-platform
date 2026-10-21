// إدارة رابط المتابعة الحصري (قسم 15)
import { Link } from 'react-router-dom';
import { fmtDateTime } from '@/domain/dates';
import { act, repos, useDB, useMe } from '@/state/store';
import { Badge, Button, Card, Icons, Input, Notice, PageHeader, Toggle } from '@/ui';

export default function TrackingLinkAdmin() {
  const db = useDB();
  const me = useMe();
  const link = db.settings.trackingLink;
  const url = link.token ? `${location.origin}${location.pathname}#/t/${link.token}` : '';
  const pending = db.trackingComments.filter((c) => c.status === 'pending');
  return (
    <div>
      <PageHeader title="رابط المتابعة" subtitle="رابط حصري لصفحة متابعة عامة بدون تسجيل دخول. ليس صفحة في الموقع العام" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="الرابط">
          {link.active && link.token ? (
            <>
              <div className="flex gap-2"><Input dir="ltr" readOnly value={url} onFocus={(e) => e.target.select()} /><Button variant="secondary" onClick={() => { navigator.clipboard?.writeText(url); act(() => {}, 'نُسخ الرابط'); }}><Icons.Copy className="h-4 w-4" /></Button></div>
              <p className="mt-1 text-xs text-ink-400">وُلّد {fmtDateTime(link.createdAt)}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link to={`/t/${link.token}`} target="_blank" className="inline-flex items-center gap-1 rounded-xl bg-brand-600 px-4 py-2 text-sm text-white"><Icons.ExternalLink className="h-4 w-4" />فتح الصفحة</Link>
                <Button variant="secondary" onClick={() => act(() => repos.settings.generateTrackingLink(), 'أُعيد توليد الرابط (القديم لم يعد يعمل)')}>إعادة توليد</Button>
                <Button variant="danger" onClick={() => act(() => repos.settings.revokeTrackingLink(), 'أُلغي الرابط')}>إلغاء الرابط</Button>
              </div>
            </>
          ) : (
            <><Badge>لا يوجد رابط فعّال</Badge><Button className="mt-3 block" onClick={() => act(() => repos.settings.generateTrackingLink(), 'وُلّد الرابط')}>توليد رابط</Button></>
          )}
          <Notice>يظهر فيه: عدد المشاركين وأسماؤهم حسب المجموعات، تقدّم البرنامج ومؤشراته، حالة كل رحلة ولقاء، وتقارير الرحلات المغلقة. ولا يظهر: الترتيب والنقاط، ولا أي بيانات مالية أو شخصية.</Notice>
        </Card>
        <Card title="تعليقات الزوار" subtitle={`${pending.length} بانتظار المراجعة`}>
          {me.isLeader && <Toggle checked={db.settings.trackingCommentsNeedReview} onChange={(v) => repos.settings.update({ trackingCommentsNeedReview: v })} label="التعليقات تحتاج مراجعة قبل الظهور" />}
          <ul className="mt-3 space-y-2">
            {db.trackingComments.map((c) => (
              <li key={c.id} className="rounded-xl border border-ink-100 p-3">
                <div className="flex items-center justify-between text-xs"><b>{c.name}</b><Badge tone={c.status === 'visible' ? 'green' : c.status === 'pending' ? 'orange' : 'gray'}>{{ visible: 'ظاهر', pending: 'بانتظار المراجعة', hidden: 'مخفي' }[c.status]}</Badge></div>
                <p className="mt-1 text-sm">{c.text}</p>
                <div className="mt-2 flex gap-2">
                  {c.status !== 'visible' && <Button size="sm" variant="success" onClick={() => repos.settings.moderateTrackingComment(c.id, 'visible')}>إظهار</Button>}
                  {c.status !== 'hidden' && <Button size="sm" variant="secondary" onClick={() => repos.settings.moderateTrackingComment(c.id, 'hidden')}>إخفاء</Button>}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
