// رابط المتابعة (رابط الداعم): جهات بكلمة مرور لكل منها، وشعاراتها بترتيب وتصنيف، ومراجعة التعليقات قبل ظهورها
import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { SupporterEntity } from '@/domain/types';
import { act, repos, useDB, useMe } from '@/state/store';
import { Badge, Button, Card, Field, Icons, Input, Modal, Notice, PageHeader, Select, Toggle } from '@/ui';
import { AttachmentInput } from '@/ui/attachments';

export default function TrackingLinkAdmin() {
  const db = useDB();
  const me = useMe();
  const url = `${location.origin}${location.pathname}#/supporter`;
  const pending = db.trackingComments.filter((c) => c.status === 'pending');
  const [adding, setAdding] = useState(false);
  const [pwFor, setPwFor] = useState<SupporterEntity | null>(null);
  const list = [...db.supporters].sort((a, b) => a.order - b.order);
  return (
    <div>
      <PageHeader title="رابط المتابعة" subtitle="رابط داعم واحد ثابت يُرسل من البداية، ويفتح بكلمة مرور خاصة لكل جهة" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="الرابط الثابت">
          <div className="flex gap-2"><Input dir="ltr" readOnly value={url} onFocus={(e) => e.target.select()} /><Button variant="secondary" onClick={() => { navigator.clipboard?.writeText(url); act(() => {}, 'نُسخ الرابط'); }}><Icons.Copy className="h-4 w-4" /></Button></div>
          <Link to="/supporter" target="_blank" className="mt-3 inline-flex items-center gap-1 text-sm text-brand-700"><Icons.ExternalLink className="h-4 w-4" />افتح الصفحة</Link>
          <Notice>يظهر فيه: الشعارات، فكرة البرنامج، فريق العمل بأرقامهم، المتميزون والمجموعات والمشاركون بالأسماء (بعد النشر)، والرحلات بحالاتها. حد المحاولات الخاطئة {db.settings.supporterLink.maxAttempts} ثم قفل {db.settings.supporterLink.lockMinutes} دقيقة.</Notice>
        </Card>
        <Card title="الجهات" subtitle="كلمة مرور لكل جهة لنفس الرابط، وتعطيل جهة لا يمس غيرها" action={me.isLeader && <Button size="sm" onClick={() => setAdding(true)} icon={<Icons.Plus className="h-4 w-4" />}>أضف جهة</Button>}>
          <ul className="space-y-3">
            {list.map((s) => (
              <li key={s.id} className="rounded-xl border border-ink-100 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2"><b>{s.name}</b><Badge>{s.kind === 'supporter' ? 'داعم' : 'شريك'}</Badge>{s.primary && <Badge tone="orange">أساسي</Badge>}</span>
                  {me.isLeader && <span className="flex items-center gap-2"><Toggle checked={s.active} onChange={(v) => act(() => repos.supporters.update(s.id, { active: v }), v ? 'فُعّلت الجهة' : 'عُطّلت كلمة الجهة')} label={<span className="text-xs">مفعّلة</span>} /><Button size="sm" variant="secondary" onClick={() => setPwFor(s)}>كلمة المرور</Button></span>}
                </div>
                {me.isLeader && (
                  <div className="mt-2 grid gap-2 sm:grid-cols-4">
                    <Select value={s.placement} onChange={(e) => repos.supporters.update(s.id, { placement: e.target.value as 'above' })} options={[{ value: 'above', label: 'فوق شعار البرنامج' }, { value: 'below', label: 'تحت شعار البرنامج' }]} aria-label="المكان" />
                    <Select value={s.orientation} onChange={(e) => repos.supporters.update(s.id, { orientation: e.target.value as 'horizontal' })} options={[{ value: 'horizontal', label: 'أفقي' }, { value: 'vertical', label: 'عمودي' }]} aria-label="الاتجاه" />
                    <Input className="num" type="number" value={s.order} onChange={(e) => repos.supporters.update(s.id, { order: +e.target.value })} aria-label="الترتيب" />
                    <Toggle checked={s.primary} onChange={(v) => repos.supporters.update(s.id, { primary: v })} label={<span className="text-xs">أساسي</span>} />
                    <div className="sm:col-span-4"><AttachmentInput value={s.logo} onChange={(logo) => act(() => repos.supporters.update(s.id, { logo }), 'حُدّث الشعار')} label="الشعار" /></div>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-ink-400">التصنيف (المكان والاتجاه والأساسي) لا يراه الزائر. كلمات المرور تُخزَّن مشفّرة ولا يُشترط تعقيدها.</p>
        </Card>
        <Card title="تعليقات الزوار" subtitle={`${pending.length} بانتظار الموافقة`} className="lg:col-span-2">
          {me.isLeader && <Toggle checked={db.settings.trackingCommentsNeedReview} onChange={(v) => repos.settings.update({ trackingCommentsNeedReview: v })} label="التعليقات تحتاج موافقة قبل الظهور" />}
          <ul className="mt-3 space-y-2">
            {db.trackingComments.map((c) => (
              <li key={c.id} className="rounded-xl border border-ink-100 p-3">
                <div className="flex items-center justify-between text-xs"><b>{c.name}{c.entityId && ` · ${db.supporters.find((s) => s.id === c.entityId)?.name ?? ''}`}</b><Badge tone={c.status === 'visible' ? 'green' : c.status === 'pending' ? 'orange' : 'gray'}>{{ visible: 'ظاهر', pending: 'بانتظار الموافقة', hidden: 'مخفي' }[c.status]}</Badge></div>
                <p className="mt-1 text-sm">{c.text}</p>
                <div className="mt-2 flex gap-2">
                  {c.status !== 'visible' && <Button size="sm" onClick={() => act(() => repos.settings.moderateTrackingComment(c.id, 'visible'))}>وافق وأظهر</Button>}
                  {c.status !== 'hidden' && <Button size="sm" variant="secondary" onClick={() => act(() => repos.settings.moderateTrackingComment(c.id, 'hidden'))}>أخفِ</Button>}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      {adding && <AddEntity onClose={() => setAdding(false)} />}
      {pwFor && <PasswordModal entity={pwFor} onClose={() => setPwFor(null)} />}
    </div>
  );
}

function AddEntity({ onClose }: { onClose: () => void }) {
  const [f, setF] = useState({ name: '', kind: 'supporter' as SupporterEntity['kind'], password: '' });
  return (
    <Modal open onClose={onClose} title="جهة جديدة" footer={<Button onClick={() => act(() => { repos.supporters.create(f); onClose(); }, 'أُضيفت الجهة')}>أضف</Button>}>
      <div className="grid gap-3">
        <Field label="الاسم"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="التصنيف"><Select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as SupporterEntity['kind'] })} options={[{ value: 'supporter', label: 'داعم' }, { value: 'partner', label: 'شريك' }]} /></Field>
        <Field label="كلمة المرور" hint="لا يُشترط تعقيدها، وتُسلَّم للجهة"><Input dir="ltr" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}
function PasswordModal({ entity, onClose }: { entity: SupporterEntity; onClose: () => void }) {
  const [pw, setPw] = useState('');
  return (
    <Modal open onClose={onClose} title={`كلمة مرور: ${entity.name}`} footer={<Button disabled={!pw} onClick={() => act(() => { repos.supporters.setPassword(entity.id, pw); onClose(); }, 'غُيّرت كلمة المرور')}>احفظ</Button>}>
      <Field label="كلمة المرور الجديدة"><Input dir="ltr" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
    </Modal>
  );
}
