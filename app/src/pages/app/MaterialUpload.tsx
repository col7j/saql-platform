// رفع مادة: نافذة واحدة لكل الأماكن (المكتبة، المواد القبلية للرحلة، مواد لقاءات الرحلة، ملفات لقاء التركيز).
// الحقول المشتركة واحدة، وما يخص كل مكان يظهر حسب السياق
import { useState } from 'react';
import { dateTime, fmtTime } from '@/domain/dates';
import { materialTypeLabel } from '@/domain/labels';
import type { Audience, FocusMeeting, MaterialType, Trip } from '@/domain/types';
import { act, repos, useDB, useMe } from '@/state/store';
import { Button, Field, Input, Modal, Notice, Select, Toggle } from '@/ui';

export type UploadContext =
  | { kind: 'general' }
  | { kind: 'pre_trip'; trip: Trip }
  | { kind: 'session'; trip: Trip; sessionId: string }
  | { kind: 'focus'; focus: FocusMeeting };

export function MaterialUploadModal({ context: c, onClose }: { context: UploadContext; onClose: () => void }) {
  const db = useDB();
  const me = useMe();
  const [f, setF] = useState({ title: '', description: '', type: 'pdf' as MaterialType, url: '', audience: 'all', points: false, mandatory: true, revealMode: 'auto' as 'auto' | 'manual' });
  const session = c.kind === 'session' ? c.trip.sessions.find((s) => s.id === c.sessionId) : undefined;
  const chooser = c.kind === 'general' && (me.isLeader || me.facilitatorOf.length > 0);
  const audienceOpts = [
    { value: 'all', label: 'للكل' },
    ...(me.isLeader ? db.groups : me.facilitatorOf).map((g) => ({ value: `g:${g.id}`, label: `مجموعة: ${g.name}` })),
    ...(me.isLeader ? db.persons.filter((p) => p.kind === 'participant') : me.facilitatorOf.flatMap((g) => g.memberIds).map((id) => db.persons.find((p) => p.id === id)!)).map((p) => ({ value: `p:${p.id}`, label: `شخص: ${p.name}` })),
  ];
  const audience: Audience = f.audience === 'all' ? { kind: 'all' } : f.audience.startsWith('g:') ? { kind: 'group', groupId: f.audience.slice(2) } : { kind: 'person', personId: f.audience.slice(2) };
  const title = { general: 'رفع مادة', pre_trip: 'مادة قبلية', session: `مادة للقاء: ${session?.title ?? ''}`, focus: 'ملف معرفي للقاء' }[c.kind];

  const submit = () => act(() => {
    const base = { title: f.title, description: f.description || undefined, type: f.type, url: f.url || 'https://example.com' };
    if (c.kind === 'general') repos.materials.add({ ...base, origin: chooser && f.audience !== 'all' ? 'attached' : 'general', revealMode: 'auto', revealed: true, audience, pointsRequested: f.points && f.audience === 'all' });
    if (c.kind === 'pre_trip') repos.materials.add({ ...base, origin: 'pre_trip', tripId: c.trip.id, revealMode: 'auto', revealed: true, audience: { kind: 'all' }, mandatory: f.mandatory, pointsRequested: f.points });
    if (c.kind === 'session') repos.materials.add({ ...base, origin: 'session', tripId: c.trip.id, sessionId: c.sessionId, revealMode: f.revealMode, revealAt: session ? dateTime(session.date, session.end).toISOString() : undefined, revealed: f.revealMode === 'auto', audience: { kind: 'all' } });
    if (c.kind === 'focus') repos.materials.add({ ...base, origin: 'focus', focusMeetingId: c.focus.id, revealMode: 'auto', revealed: true, audience: { kind: 'group', groupId: c.focus.groupId } });
    onClose();
  }, 'رُفعت المادة');

  return (
    <Modal open onClose={onClose} title={title}
      footer={<><Button variant="secondary" onClick={onClose}>إلغاء</Button><Button disabled={!f.title.trim()} onClick={submit}>ارفع</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="العنوان" className="sm:col-span-2"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        {c.kind === 'general' && <Field label="وصف" className="sm:col-span-2"><Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>}
        <Field label="النوع"><Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as MaterialType })} options={Object.entries(materialTypeLabel).map(([value, label]) => ({ value, label }))} /></Field>
        <Field label="الرابط أو الملف"><Input dir="ltr" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} placeholder="https://" /></Field>
        {chooser && <Field label="الجمهور" className="sm:col-span-2"><Select value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })} options={audienceOpts} /></Field>}
        {c.kind === 'session' && (
          <Field label="الظهور" className="sm:col-span-2">
            <Select value={f.revealMode} onChange={(e) => setF({ ...f, revealMode: e.target.value as 'auto' | 'manual' })} options={[{ value: 'auto', label: `تلقائياً بعد انتهاء اللقاء (${session ? fmtTime(session.end) : ''})` }, { value: 'manual', label: 'مخفية حتى أفتحها' }]} />
          </Field>
        )}
        {c.kind === 'pre_trip' && <Toggle checked={f.mandatory} onChange={(v) => setF({ ...f, mandatory: v })} label="إلزامية" />}
        {(c.kind === 'pre_trip' || (c.kind === 'general' && me.isStaff)) && (
          <div className="sm:col-span-2"><Toggle checked={f.points} disabled={c.kind === 'general' && f.audience !== 'all'} onChange={(v) => setF({ ...f, points: v })} label="طلب نقاط على هذه المادة (يعتمدها القائد العام)" /></div>
        )}
      </div>
      <div className="mt-3">
        {c.kind === 'general' && me.isStaff && <Notice>تُكسب النقاط على المادة الإثرائية بشرطين: أن تكون عامة (لا تخص شخصاً أو جهة)، وأن يوافق القائد العام.</Notice>}
        {(c.kind === 'pre_trip' || c.kind === 'session') && <Notice>ستظهر المادة أيضاً في المكتبة بوسم "{c.kind === 'pre_trip' ? 'مادة قبلية' : `مخصصة للقاء ${session?.title}`}".</Notice>}
        {c.kind === 'focus' && <Notice>يراها أعضاء المجموعة في المكتبة وفي صفحة اللقاء.</Notice>}
      </div>
    </Modal>
  );
}
