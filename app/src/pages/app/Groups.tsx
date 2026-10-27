// المجموعات (قسم 4): القوائم مفتوحة للجميع + التشكيل والنشر والنقل للقائد العام
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { fmtDateTime } from '@/domain/dates';
import { groupOf, groupsPublished } from '@/domain/permissions';
import { StaffList } from '@/ui/publicBlocks';
import { act, personName, repos, useDB, useMe } from '@/state/store';
import { Badge, Button, Card, Empty, Field, Icons, Input, Modal, Notice, PageHeader, Select, Tabs, Table } from '@/ui';
import { PersonChip } from '@/ui/domain';

export default function GroupsPage() {
  const db = useDB();
  const me = useMe();
  const [tab, setTab] = useState<'list' | 'formation' | 'transfers'>('list');
  const published = groupsPublished(db);
  if (me.isParticipant && !published)
    return (
      <div>
        <PageHeader title="المجموعات" />
        <Empty title="لم يُنشر تشكيل المجموعات بعد" text="ستعرف مجموعتك يوم النشر، وتصلك التنبيهات. حتى ذلك الحين تعرّف على فريق العمل." />
        <Card title="فريق العمل" className="mt-4"><StaffList /></Card>
      </div>
    );
  return (
    <div>
      <PageHeader title="المجموعات" subtitle="أربع مجموعات، لكل منها قائد من المشاركين وميسّر من فريق العمل" />
      {me.isLeader && <Tabs value={tab} onChange={setTab} tabs={[{ key: 'list', label: 'المجموعات' }, { key: 'formation', label: 'التشكيل والنشر' }, { key: 'transfers', label: `سجل النقل (${db.transfers.length})` }]} />}
      {tab === 'list' && <GroupList />}
      {tab === 'formation' && <Formation />}
      {tab === 'transfers' && (
        <Card pad={false}>
          <Table>
            <thead><tr><th>المشارك</th><th>من</th><th>إلى</th><th>السبب</th><th>التاريخ</th></tr></thead>
            <tbody>{db.transfers.map((t) => <tr key={t.id}><td><PersonChip id={t.personId} size={22} /></td><td>{db.groups.find((g) => g.id === t.fromGroupId)?.name}</td><td>{db.groups.find((g) => g.id === t.toGroupId)?.name}</td><td className="text-xs">{t.reason}</td><td className="text-xs">{fmtDateTime(t.at)}</td></tr>)}</tbody>
          </Table>
        </Card>
      )}
    </div>
  );
}

function GroupList() {
  const db = useDB();
  const me = useMe();
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {db.groups.map((g) => (
        <Card key={g.id} title={<span style={{ color: g.color }}>{g.name}</span>} subtitle={`${g.memberIds.length} أعضاء`} action={me.group?.id === g.id && <Badge tone="brand">مجموعتي</Badge>}>
          <div className="mb-3 grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl bg-brand-50 p-2"><div className="mb-1 text-xs text-brand-700">الميسّر</div><PersonChip id={g.facilitatorId} size={26} /></div>
            <div className="rounded-xl bg-accent-50 p-2"><div className="mb-1 text-xs text-accent-700">قائد المجموعة</div><PersonChip id={g.leaderId} size={26} /></div>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {g.memberIds.filter((m) => m !== g.leaderId).map((m) => (
              <li key={m}>{me.isStaff ? <Link to={`/app/people/${m}`} className="block rounded-lg hover:bg-ink-50"><PersonChip id={m} size={26} sub={db.persons.find((p) => p.id === m)?.university} /></Link> : <PersonChip id={m} size={26} sub={db.persons.find((p) => p.id === m)?.university} />}</li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}

function Formation() {
  const db = useDB();
  const published = groupsPublished(db);
  const [publishAt, setPublishAt] = useState(db.formation.publishAt?.slice(0, 16) ?? '');
  const [transfer, setTransfer] = useState<{ personId: string; to: string } | null>(null);
  const [reason, setReason] = useState('');
  const participants = db.persons.filter((p) => p.kind === 'participant');
  const staff = db.persons.filter((p) => p.kind === 'staff' && !p.isGeneralLeader);
  const unassigned = participants.filter((p) => !groupOf(db, p.id));

  return (
    <div className="space-y-6">
      <Card title="حالة التشكيل">
        <div className="flex flex-wrap items-end gap-3">
          <Badge tone={published ? 'green' : db.formation.status === 'scheduled' ? 'orange' : 'gray'} className="text-sm">{published ? `منشور ${fmtDateTime(db.formation.publishedAt ?? db.formation.publishAt)}` : db.formation.status === 'scheduled' ? `مجدول للنشر ${fmtDateTime(db.formation.publishAt)}` : 'مسودة (لا يراها المشاركون)'}</Badge>
          {!published && (
            <>
              <Field label="تاريخ ووقت النشر"><Input type="datetime-local" value={publishAt} onChange={(e) => setPublishAt(e.target.value)} /></Field>
              <Button variant="secondary" disabled={!publishAt} onClick={() => act(() => repos.groups.schedulePublish(new Date(publishAt).toISOString()), 'جُدول النشر')}>جدول النشر</Button>
              <Button onClick={() => act(() => repos.groups.publishNow(), 'نُشرت المجموعات ووصلت التنبيهات')}>انشر الآن</Button>
            </>
          )}
        </div>
        <div className="mt-3">
          {published ? <Notice tone="orange">بعد النشر: تغيير مجموعة المشارك يُعد <b>نقلاً</b> ويُسجَّل، والميسّر الجديد يرى سجله القديم وملاحظات الميسّر السابق.</Notice> : <Notice>قبل النشر: عدّل بحرية على التشكيل، ولا يُعد ذلك نقلاً.</Notice>}
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {db.groups.map((g) => (
          <Card key={g.id} title={<Input className="font-bold" defaultValue={g.name} onBlur={(e) => e.target.value !== g.name && repos.groups.update(g.id, { name: e.target.value })} />}>
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="الميسّر"><Select value={g.facilitatorId ?? ''} onChange={(e) => repos.groups.update(g.id, { facilitatorId: e.target.value })} options={[{ value: '', label: '—' }, ...staff.map((p) => ({ value: p.id, label: p.name }))]} /></Field>
              <Field label="قائد المجموعة"><Select value={g.leaderId ?? ''} onChange={(e) => repos.groups.update(g.id, { leaderId: e.target.value })} options={[{ value: '', label: '—' }, ...g.memberIds.map((m) => ({ value: m, label: personName(db, m) }))]} /></Field>
            </div>
            <ul className="mt-3 space-y-1.5">
              {g.memberIds.map((m) => (
                <li key={m} className="flex items-center justify-between gap-2">
                  <PersonChip id={m} size={24} />
                  <Select className="w-36 py-1 text-xs" value={g.id} onChange={(e) => (published ? setTransfer({ personId: m, to: e.target.value }) : repos.groups.assignDraft(m, e.target.value || null))}
                    options={[...(!published ? [{ value: '', label: 'بدون مجموعة' }] : []), ...db.groups.map((x) => ({ value: x.id, label: x.name }))]} />
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
      {unassigned.length > 0 && (
        <Card title="بدون مجموعة">
          <div className="grid gap-2 sm:grid-cols-2">
            {unassigned.map((p) => (
              <div key={p.id} className="flex items-center justify-between"><PersonChip id={p.id} size={24} />
                <Select className="w-36 py-1 text-xs" value="" onChange={(e) => repos.groups.assignDraft(p.id, e.target.value)} options={[{ value: '', label: 'اختر' }, ...db.groups.map((x) => ({ value: x.id, label: x.name }))]} /></div>
            ))}
          </div>
        </Card>
      )}
      <Modal open={!!transfer} onClose={() => setTransfer(null)} title={`نقل ${personName(db, transfer?.personId)}`}
        footer={<Button onClick={() => act(() => { repos.groups.transfer(transfer!.personId, transfer!.to, reason); setTransfer(null); setReason(''); }, 'تم النقل وسُجّل')}>أكّد النقل</Button>}>
        <p className="text-sm">إلى: <b>{db.groups.find((g) => g.id === transfer?.to)?.name}</b></p>
        <Field label="سبب النقل" className="mt-3"><Input value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        <p className="mt-2 text-xs text-ink-400">سيرى الميسّر الجديد سجل الملاحظات السابق.</p>
      </Modal>
    </div>
  );
}
