// اللقاء الافتتاحي واللقاء الختامي: شاشتان ونموذجان منفصلان تماماً (لا مكوّن نموذج مشترك، والمشترك أزرار وبطاقات الواجهة فقط)
import { useState } from 'react';
import { fmtDate } from '@/domain/dates';
import { requestFor, spendKindLabel } from '@/domain/finance';
import { act, repos, useDB, useMe } from '@/state/store';
import { Badge, Button, Card, Empty, Field, Input, Notice, PageHeader, Textarea } from '@/ui';

export function OpeningPage() {
  const db = useDB();
  const me = useMe();
  const e = db.events.find((x) => x.kind === 'opening');
  const [f, setF] = useState({ programIntro: e?.opening?.programIntro ?? '', groupsAnnouncement: e?.opening?.groupsAnnouncement ?? '', participantsDistribution: e?.opening?.participantsDistribution ?? '', attendees: String(e?.attendees ?? '') });
  if (!e) return <div><PageHeader title="اللقاء الافتتاحي" /><Empty title="لا يوجد لقاء افتتاحي بعد" text="ينشئه القائد العام من «الرحلات»" /></div>;
  const can = me.isGeneralLeader || me.isAssistant;
  const budget = requestFor(db, 'event', e.id);
  return (
    <div className="space-y-4">
      <PageHeader title="اللقاء الافتتاحي" subtitle={`${fmtDate(e.date)}${e.location ? ` · ${e.location}` : ''}`} actions={<Badge tone={e.status === 'done' ? 'green' : 'blue'}>{e.status === 'done' ? 'انعقد' : 'مخطَّط'}</Badge>} />
      <Notice>بند الميزانية والعهدة: «{spendKindLabel.opening}» (مستقلان عن الختامي). {budget ? '' : 'يصرف مسؤول المالية عهدته مباشرة.'}</Notice>
      <Card title="محتوى اللقاء">
        <div className="grid gap-3">
          <Field label="التعريف بالبرنامج"><Textarea disabled={!can} value={f.programIntro} onChange={(x) => setF({ ...f, programIntro: x.target.value })} /></Field>
          <Field label="إعلان المجموعات"><Textarea disabled={!can} value={f.groupsAnnouncement} onChange={(x) => setF({ ...f, groupsAnnouncement: x.target.value })} /></Field>
          <Field label="توزيع المشاركين"><Textarea disabled={!can} value={f.participantsDistribution} onChange={(x) => setF({ ...f, participantsDistribution: x.target.value })} /></Field>
          <Field label="عدد الحضور"><Input className="num" type="number" disabled={!can} value={f.attendees} onChange={(x) => setF({ ...f, attendees: x.target.value })} /></Field>
        </div>
        {can && <div className="mt-3"><Button onClick={() => act(() => repos.events.saveOpening({ programIntro: f.programIntro, groupsAnnouncement: f.groupsAnnouncement, participantsDistribution: f.participantsDistribution, attendees: f.attendees ? +f.attendees : undefined }), 'حُفظ الافتتاحي')}>احفظ</Button></div>}
      </Card>
    </div>
  );
}

export function ClosingPage() {
  const db = useDB();
  const me = useMe();
  const e = db.events.find((x) => x.kind === 'closing');
  const [f, setF] = useState({ rankingAnnouncement: e?.closing?.rankingAnnouncement ?? '', honorsAndCertificates: e?.closing?.honorsAndCertificates ?? '', finalReport: e?.closing?.finalReport ?? '', attendees: String(e?.attendees ?? '') });
  if (!e) return <div><PageHeader title="اللقاء الختامي" /><Empty title="لا يوجد لقاء ختامي بعد" text="ينشئه القائد العام من «الرحلات»" /></div>;
  const can = me.isGeneralLeader || me.isAssistant;
  return (
    <div className="space-y-4">
      <PageHeader title="اللقاء الختامي" subtitle={`${fmtDate(e.date)}${e.location ? ` · ${e.location}` : ''}`} actions={<Badge tone={e.status === 'done' ? 'green' : 'blue'}>{e.status === 'done' ? 'انعقد' : 'مخطَّط'}</Badge>} />
      <Notice>بند الميزانية والعهدة: «{spendKindLabel.closing}» (مستقلان عن الافتتاحي).</Notice>
      <Card title="محتوى اللقاء">
        <div className="grid gap-3">
          <Field label="إعلان الترتيب والنتائج"><Textarea disabled={!can} value={f.rankingAnnouncement} onChange={(x) => setF({ ...f, rankingAnnouncement: x.target.value })} /></Field>
          <Field label="التكريم والشهادات"><Textarea disabled={!can} value={f.honorsAndCertificates} onChange={(x) => setF({ ...f, honorsAndCertificates: x.target.value })} /></Field>
          <Field label="التقرير الختامي"><Textarea disabled={!can} value={f.finalReport} onChange={(x) => setF({ ...f, finalReport: x.target.value })} /></Field>
          <Field label="عدد الحضور"><Input className="num" type="number" disabled={!can} value={f.attendees} onChange={(x) => setF({ ...f, attendees: x.target.value })} /></Field>
        </div>
        {can && <div className="mt-3"><Button onClick={() => act(() => repos.events.saveClosing({ rankingAnnouncement: f.rankingAnnouncement, honorsAndCertificates: f.honorsAndCertificates, finalReport: f.finalReport, attendees: f.attendees ? +f.attendees : undefined }), 'حُفظ الختامي')}>احفظ</Button></div>}
      </Card>
    </div>
  );
}
