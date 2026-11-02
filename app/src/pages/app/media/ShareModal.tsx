// «اعتمد وشارك»: رابط (قراءة أو متابعة) أو PDF. الرمز يظهر مرة واحدة عند الإصدار، ولا يُخزَّن إلا بصمته.
import { useState } from 'react';
import { addDays, todayISO } from '@/domain/dates';
import type { MediaBrief, MediaLinkKind } from '@/domain/types';
import { act, repos, useDB } from '@/state/store';
import { Button, Field, Icons, Input, Modal, Notice, Select, Tabs } from '@/ui';

const linkUrl = (token: string) => `${location.origin}${location.pathname}#/brief/${token}`;

export function ShareModal({ brief, onClose }: { brief: MediaBrief; onClose: () => void }) {
  const db = useDB();
  const [tab, setTab] = useState<'link' | 'pdf'>('link');
  const [kind, setKind] = useState<MediaLinkKind>('read');
  const [days, setDays] = useState(String(db.settings.media.defaultLinkDays));
  const [issued, setIssued] = useState<{ token: string } | null>(null);
  const issue = () => act(() => {
    const expiresAt = +days > 0 ? new Date(`${addDays(todayISO(), +days)}T23:59:59`).toISOString() : undefined;
    const r = repos.media.createLink(brief.id, kind, expiresAt);
    setIssued({ token: r.token });
  });
  const print = (mode: 'full' | 'short') => window.open(`${location.pathname}#/app/media/print/${brief.id}?mode=${mode}`, '_blank');
  return (
    <Modal open onClose={onClose} title="شارك الموجز مع الفريق" footer={<Button variant="secondary" onClick={onClose}>إغلاق</Button>}>
      <Tabs value={tab} onChange={setTab} tabs={[{ key: 'link', label: 'رابط' }, { key: 'pdf', label: 'PDF' }]} />
      {tab === 'link' ? (
        issued ? (
          <div className="space-y-3">
            <Notice tone="orange">انسخ الرابط الآن: لا يظهر مرة أخرى، ويمكنك إلغاؤه من «الروابط».</Notice>
            <div className="flex gap-2"><Input dir="ltr" readOnly value={linkUrl(issued.token)} onFocus={(e) => e.target.select()} aria-label="الرابط" /><Button variant="secondary" icon={<Icons.Copy className="h-4 w-4" />} onClick={() => { navigator.clipboard?.writeText(linkUrl(issued.token)); act(() => {}, 'نُسخ الرابط'); }}>انسخ</Button></div>
          </div>
        ) : (
          <div className="space-y-4">
            <Field label="نوع الرابط">
              <Select value={kind} onChange={(e) => setKind(e.target.value as MediaLinkKind)} options={[{ value: 'read', label: 'قراءة فقط' }, { value: 'track', label: 'متابعة تنفيذ (قراءة وتأشير اللقطات)' }]} />
            </Field>
            <Field label="الصلاحية" hint="الزائر يرى النسخة المعتمدة (الإصدار الأخير) وأقسامها الظاهرة فقط">
              <Select value={days} onChange={(e) => setDays(e.target.value)} options={[{ value: '3', label: '3 أيام' }, { value: '7', label: '7 أيام' }, { value: '14', label: '14 يوماً' }, { value: '30', label: '30 يوماً' }, { value: '0', label: 'بلا انتهاء' }]} />
            </Field>
            <Button onClick={issue} icon={<Icons.Link2 className="h-4 w-4" />}>أصدر الرابط</Button>
          </div>
        )
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-ink-600">تفتح صفحة الطباعة ثم اختر «حفظ كـ PDF» من المتصفح. النسختان من الإصدار المعتمد نفسه.</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => print('full')} icon={<Icons.FileText className="h-4 w-4" />}>نسخة مفصلة</Button>
            <Button variant="secondary" onClick={() => print('short')}>نسخة مختصرة</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
