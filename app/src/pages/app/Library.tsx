// المكتبة المعرفية (قسم 10)
import { useState } from 'react';
import { fmtDate } from '@/domain/dates';
import { materialOriginLabel, materialTypeLabel } from '@/domain/labels';
import { canSeeMaterial, canUploadMaterial, isMaterialRevealed } from '@/domain/permissions';
import { materialState } from '@/domain/workflow';
import type { Audience, Material, MaterialType } from '@/domain/types';
import { act, personName, repos, useDB, useMe } from '@/state/store';
import { Badge, Button, Empty, Field, Icons, Input, Modal, Notice, PageHeader, Select, Tabs, Toggle, cx } from '@/ui';

const typeIcon = { file: Icons.File, pdf: Icons.FileText, video: Icons.PlayCircle, link: Icons.Link2 } as const;

export default function LibraryPage() {
  const db = useDB();
  const me = useMe();
  const pid = me.person.id;
  const [tab, setTab] = useState<'suggested' | 'archive' | 'skipped' | 'all' | 'points'>(me.isParticipant ? 'suggested' : 'all');
  const [q, setQ] = useState('');
  const [type, setType] = useState('all');
  const [uploading, setUploading] = useState(false);
  const visible = db.materials.filter((m) => canSeeMaterial(db, pid, m));
  const state = (m: Material) => materialState(db, pid, m.id);
  const filtered = visible
    .filter((m) => (type === 'all' ? true : m.type === type))
    .filter((m) => !q || m.title.includes(q))
    .filter((m) => {
      if (tab === 'suggested') return state(m) === 'new' && isMaterialRevealed(m);
      if (tab === 'archive') return state(m) === 'viewed';
      if (tab === 'skipped') return state(m) === 'skipped';
      if (tab === 'points') return m.pointsRequested;
      return true;
    })
    .sort((a, b) => b.at.localeCompare(a.at));

  const tabs: { key: typeof tab; label: string }[] = me.isParticipant
    ? [{ key: 'suggested', label: 'مقترح لك' }, { key: 'archive', label: 'الأرشيف (شاهدته)' }, { key: 'skipped', label: 'تخطيته' }, { key: 'all', label: 'الكل' }]
    : [{ key: 'all', label: 'كل المواد' }, { key: 'points', label: 'طلبات النقاط' }];

  return (
    <div>
      <PageHeader title="المكتبة المعرفية" subtitle="مكان واحد لكل المحتوى: ملفات، فيديوهات، مقاطع، روابط"
        actions={canUploadMaterial(db, pid) && <Button onClick={() => setUploading(true)} icon={<Icons.Upload className="h-4 w-4" />}>رفع مادة</Button>} />
      <div className="flex flex-wrap items-start justify-between gap-2">
        <Tabs value={tab} onChange={setTab} tabs={tabs} />
        <div className="mb-4 flex gap-2">
          <Input className="w-48" placeholder="بحث" value={q} onChange={(e) => setQ(e.target.value)} />
          <Select className="w-32" value={type} onChange={(e) => setType(e.target.value)} options={[{ value: 'all', label: 'كل الأنواع' }, ...Object.entries(materialTypeLabel).map(([value, label]) => ({ value, label }))]} />
        </div>
      </div>
      {filtered.length === 0 ? <Empty title="لا مواد هنا" icon={<Icons.LibraryBig className="h-8 w-8" />} /> : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((m) => <MaterialCard key={m.id} m={m} />)}
        </div>
      )}
      {uploading && <UploadGeneral onClose={() => setUploading(false)} />}
    </div>
  );
}

function MaterialCard({ m }: { m: Material }) {
  const db = useDB();
  const me = useMe();
  const I = typeIcon[m.type];
  const st = materialState(db, me.person.id, m.id);
  const revealed = isMaterialRevealed(m);
  const trip = db.trips.find((t) => t.id === m.tripId);
  const session = trip?.sessions.find((s) => s.id === m.sessionId);
  const tag = m.origin === 'session' && session ? `مخصصة للقاء "${session.title}"` : m.origin === 'attached' ? `مرفقة من ${db.persons.find((p) => p.id === m.uploaderId)?.isGeneralLeader ? 'القائد العام' : 'الميسّر'}` : m.origin === 'pre_trip' && trip ? `مادة قبلية: ${trip.title}` : materialOriginLabel[m.origin];
  return (
    <div className={cx('flex flex-col rounded-2xl border bg-white p-4 shadow-card', st === 'skipped' ? 'border-ink-100 opacity-70' : 'border-ink-100')}>
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><I className="h-5 w-5" /></div>
        <div className="min-w-0">
          <h3 className="font-bold leading-6">{m.title}</h3>
          <div className="mt-1 flex flex-wrap gap-1"><Badge tone="blue">{tag}</Badge>{m.mandatory && <Badge tone="orange">إلزامية</Badge>}{!revealed && <Badge icon={<Icons.EyeOff className="h-3 w-3" />}>مخفية</Badge>}</div>
        </div>
      </div>
      {m.description && <p className="mt-2 text-xs text-ink-500">{m.description}</p>}
      <div className="mt-2 text-[11px] text-ink-400">{personName(db, m.uploaderId)} · {fmtDate(m.at)} · {materialTypeLabel[m.type]}{m.audience.kind !== 'all' && ` · ${m.audience.kind === 'group' ? db.groups.find((g) => g.id === (m.audience as { groupId: string }).groupId)?.name : `لـ ${personName(db, (m.audience as { personId: string }).personId)}`}`}</div>
      {m.pointsRequested && <div className="mt-2"><Badge tone={m.pointsStatus === 'approved' ? 'green' : m.pointsStatus === 'rejected' ? 'red' : 'orange'}>نقاط: {{ approved: 'معتمدة', rejected: 'مرفوضة', pending: 'بانتظار القائد العام' }[m.pointsStatus ?? 'pending']}</Badge></div>}
      <div className="mt-auto flex flex-wrap gap-2 pt-3">
        {me.isParticipant && revealed && st === 'new' && <><Button size="sm" onClick={() => repos.materials.mark(m.id, 'viewed')} icon={<Icons.Eye className="h-3.5 w-3.5" />}>مشاهدة</Button><Button size="sm" variant="ghost" onClick={() => repos.materials.mark(m.id, 'skipped')}>تخطي</Button></>}
        {me.isParticipant && st !== 'new' && <Button size="sm" variant="ghost" onClick={() => repos.materials.unmark(m.id)}>إرجاع للمقترح</Button>}
        {m.uploaderId === me.person.id && m.revealMode === 'manual' && <Button size="sm" variant="secondary" onClick={() => repos.materials.setRevealed(m.id, !m.revealed)}>{m.revealed ? 'إخفاء' : 'إظهار'}</Button>}
        {me.isLeader && m.pointsStatus === 'pending' && (
          <>
            <Button size="sm" variant="success" disabled={m.audience.kind !== 'all'} title={m.audience.kind !== 'all' ? 'تُمنح النقاط للمواد العامة فقط' : ''} onClick={() => act(() => repos.materials.decidePoints(m.id, true), 'اعتُمدت النقاط')}>اعتماد النقاط</Button>
            <Button size="sm" variant="secondary" onClick={() => act(() => repos.materials.decidePoints(m.id, false))}>رفض</Button>
          </>
        )}
      </div>
    </div>
  );
}

function UploadGeneral({ onClose }: { onClose: () => void }) {
  const db = useDB();
  const me = useMe();
  const [f, setF] = useState({ title: '', description: '', type: 'pdf' as MaterialType, url: '', audience: 'all', points: false });
  const audienceOpts = [
    { value: 'all', label: 'للكل' },
    ...(me.isLeader ? db.groups : me.facilitatorOf).map((g) => ({ value: `g:${g.id}`, label: `مجموعة: ${g.name}` })),
    ...(me.isLeader ? db.persons.filter((p) => p.kind === 'participant') : me.facilitatorOf.flatMap((g) => g.memberIds).map((id) => db.persons.find((p) => p.id === id)!)).map((p) => ({ value: `p:${p.id}`, label: `شخص: ${p.name}` })),
  ];
  const audience: Audience = f.audience === 'all' ? { kind: 'all' } : f.audience.startsWith('g:') ? { kind: 'group', groupId: f.audience.slice(2) } : { kind: 'person', personId: f.audience.slice(2) };
  const attached = f.audience !== 'all' && (me.isLeader || me.facilitatorOf.length > 0);
  return (
    <Modal open onClose={onClose} title="رفع مادة"
      footer={<><Button variant="secondary" onClick={onClose}>إلغاء</Button><Button disabled={!f.title} onClick={() => act(() => { repos.materials.add({ title: f.title, description: f.description, type: f.type, url: f.url || 'https://example.com', origin: attached ? 'attached' : 'general', revealMode: 'auto', revealed: true, audience, pointsRequested: f.points && f.audience === 'all' }); onClose(); }, 'رُفعت المادة')}>رفع</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="العنوان" className="sm:col-span-2"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="وصف" className="sm:col-span-2"><Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <Field label="النوع"><Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as MaterialType })} options={Object.entries(materialTypeLabel).map(([value, label]) => ({ value, label }))} /></Field>
        <Field label="الرابط/الملف"><Input dir="ltr" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} /></Field>
        {(me.isLeader || me.facilitatorOf.length > 0) && <Field label="الجمهور" className="sm:col-span-2"><Select value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })} options={audienceOpts} /></Field>}
        {me.isStaff && <div className="sm:col-span-2"><Toggle checked={f.points} disabled={f.audience !== 'all'} onChange={(v) => setF({ ...f, points: v })} label="طلب نقاط على هذه المادة الإثرائية" /></div>}
      </div>
      {me.isStaff && <Notice>تُكسب النقاط على المادة الإثرائية بشرطين: أن تكون عامة (لا تخص شخصاً أو جهة)، وأن يوافق القائد العام.</Notice>}
    </Modal>
  );
}
