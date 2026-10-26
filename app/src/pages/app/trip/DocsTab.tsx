// نماذج الرحلة الثلاثة (وثيقة القرارات): الوثيقة أولاً، ثم الجدول الزمني، والميزانية، كلٌّ على حدة بدورة اعتماد. ثم التقرير الختامي
import { useEffect, useState } from 'react';
import { fmtDate, fmtDateTime } from '@/domain/dates';
import { docKindLabel, docStatusLabel, docStatusTone } from '@/domain/labels';
import {
  canCommentOnTripDoc, canEditTripDoc, canFacilitatorReview, canLeaderDecide,
} from '@/domain/permissions';
import { approvalSteps, docFor, hasSchedule, isApproved, tripHasEnded } from '@/domain/workflow';
import type { DocKind, Trip, TripDoc } from '@/domain/types';
import { act, personName, repos, useDB, useMe } from '@/state/store';
import { Badge, Button, Card, Field, Icons, Input, Modal, Notice, ReasonModal, Steps, Textarea } from '@/ui';
import { CommentThread } from '@/ui/domain';

const FIELDS: Record<DocKind, { key: string; label: string; long?: boolean }[]> = {
  document: [
    { key: 'location', label: 'المكان' },
    { key: 'titles', label: 'الأهداف والمحاور' },
    { key: 'outline', label: 'وصف الرحلة كاملة (الخطة الواحدة: التنقل، الضيوف، الترتيبات)', long: true },
  ],
  schedule: [
    { key: 'summary', label: 'ملاحظات على الجدول', long: true },
    { key: 'details', label: 'الخطة البديلة ومتى تُفعَّل', long: true },
  ],
  final_report: [
    { key: 'summary', label: 'ملخص التقرير', long: true },
    { key: 'achievements', label: 'ما تم إنجازه', long: true },
    { key: 'recommendations', label: 'التوصيات', long: true },
  ],
};

export default function DocsTab({ trip }: { trip: Trip }) {
  const db = useDB();
  const kinds: DocKind[] = ['document', 'schedule', 'final_report'];
  const docs = kinds.map((k) => docFor(db, trip.id, k)).filter(Boolean) as TripDoc[];
  const [open, setOpen] = useState<string | null>(docs.find((d) => d.status !== 'approved')?.id ?? docs[0]?.id ?? null);
  return (
    <div className="space-y-4">
      <Notice>
        ثلاثة نماذج كلٌّ على حدة: <b>وثيقة الرحلة أولاً</b>، ثم الجدول الزمني، والميزانية (تبويب الميزانية). المسار: {trip.executor.kind === 'group' ? 'الميسّر ثم ' : ''}القائد العام، والرفض يعود لقائد الفريق. النشر لا يعمل إلا باكتمال الاعتمادات وبيانات الرحلة.
      </Notice>
      {docs.map((d) => (
        <DocCard key={d.id} trip={trip} doc={d} open={open === d.id} onToggle={() => setOpen(open === d.id ? null : d.id)} />
      ))}
    </div>
  );
}

function DocCard({ trip, doc, open, onToggle }: { trip: Trip; doc: TripDoc; open: boolean; onToggle: () => void }) {
  const db = useDB();
  const me = useMe();
  const pid = me.person.id;
  const isStaffTrip = trip.executor.kind === 'staff';
  const editable = canEditTripDoc(db, pid, trip, doc);
  const [fields, setFields] = useState(doc.fields);
  const [rejectAs, setRejectAs] = useState<'facilitator' | 'leader' | null>(null);
  const [editApprove, setEditApprove] = useState(false);
  useEffect(() => setFields(doc.fields), [doc.fields]);

  const prereq =
    doc.kind === 'document' ? null
      : doc.kind === 'final_report' ? (tripHasEnded(trip) ? null : 'يُرفع التقرير الختامي بعد انتهاء الرحلة')
        : docFor(db, trip.id, 'document')?.submittedAt ? null : 'ارفع وثيقة الرحلة أولاً: هي أول ما يُرفع';
  const needsSchedule = doc.kind === 'schedule' && !hasSchedule(trip);
  const deadline = doc.kind === 'document' ? trip.deadlines.document : doc.kind === 'final_report' ? undefined : trip.deadlines.schedule;

  const save = () => act(() => {
    repos.trips.updateDocFields(doc.id, fields);
  }, 'حُفظت المسودة');
  const submit = () => act(() => {
    if (prereq) throw new Error(prereq);
    if (needsSchedule) throw new Error('أضف الجدول الزمني أولاً من تبويب الجدول');
    repos.trips.updateDocFields(doc.id, fields);
    repos.trips.docAction(doc.id, { type: 'submit' });
  }, 'رُفعت للمراجعة');

  return (
    <Card pad={false}>
      <button onClick={onToggle} className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-start sm:px-5">
        <span className="flex items-center gap-2">
          <Icons.FileText className="h-5 w-5 text-brand-600" />
          <span className="font-bold">{docKindLabel[doc.kind]}</span>
          {doc.version > 1 && <Badge>نسخة {doc.version}</Badge>}
        </span>
        <span className="flex items-center gap-2">
          {deadline && <span className="text-xs text-ink-400">الموعد: {fmtDate(deadline)}</span>}
          <Badge tone={docStatusTone[doc.status]}>{docStatusLabel[doc.status]}</Badge>
          <Icons.ChevronDown className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {open && (
        <div className="space-y-4 border-t border-ink-100 px-4 py-4 sm:px-5">
          <Steps steps={approvalSteps(doc.status, isStaffTrip)} />
          {prereq && doc.status === 'draft' && <Notice tone="orange">{prereq}</Notice>}
          {(doc.status === 'returned_by_facilitator' || doc.status === 'returned_by_leader') && (
            <Notice tone="red" icon={<Icons.Undo2 className="h-4 w-4" />}>
              <b>{doc.status === 'returned_by_leader' ? 'أعادها القائد العام' : 'أعادها الميسّر'}:</b> {doc.history[doc.history.length - 1]?.reason}
            </Notice>
          )}

          {(
            <div className="grid gap-3">
              {FIELDS[doc.kind].map((f) =>
                editable ? (
                  <Field key={f.key} label={f.label}>
                    {f.long ? <Textarea rows={4} value={fields[f.key] ?? ''} onChange={(e) => setFields({ ...fields, [f.key]: e.target.value })} /> : <Input value={fields[f.key] ?? ''} onChange={(e) => setFields({ ...fields, [f.key]: e.target.value })} />}
                  </Field>
                ) : (
                  <div key={f.key}>
                    <div className="text-xs text-ink-500">{f.label}</div>
                    <p className="mt-0.5 whitespace-pre-line text-sm text-ink-800">{doc.fields[f.key] || <span className="text-ink-300">—</span>}</p>
                  </div>
                ),
              )}
              {doc.kind === 'schedule' && (
                <div className="rounded-xl bg-ink-50 p-3 text-sm">
                  <Icons.CalendarRange className="me-1 inline h-4 w-4 text-brand-600" />
                  محتوى هذا النموذج هو الجدول: {trip.schedule.plans.map((p) => `${p.name} (${p.items.length} بنداً)`).join('، ')}. عدّله من تبويب "الجدول الزمني" بتصنيفات يحددها القائد العام.
                  {needsSchedule && <span className="mt-1 block text-red-600">لم يُضف الجدول بعد.</span>}
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {editable && <Button variant="secondary" onClick={save}>احفظ المسودة</Button>}
            {editable && <Button onClick={submit} icon={<Icons.Upload className="h-4 w-4" />}>رفع {isStaffTrip ? 'للقائد العام' : 'للميسّر'}</Button>}
            {canFacilitatorReview(db, pid, trip, doc) && (
              <>
                <Button variant="success" onClick={() => act(() => repos.trips.docAction(doc.id, { type: 'facilitator_approve' }), 'وافقت ورُفعت للإدارة')} icon={<Icons.Check className="h-4 w-4" />}>وافق وارفع للإدارة</Button>
                <Button variant="danger" onClick={() => setRejectAs('facilitator')} icon={<Icons.X className="h-4 w-4" />}>ارفض بسبب</Button>
              </>
            )}
            {canLeaderDecide(db, pid, trip, doc) && (
              <>
                <Button variant="success" onClick={() => act(() => repos.trips.docAction(doc.id, { type: 'leader_approve' }), 'اعتُمدت')} icon={<Icons.BadgeCheck className="h-4 w-4" />}>اعتمد</Button>
                {<Button variant="secondary" onClick={() => setEditApprove(true)} icon={<Icons.PenLine className="h-4 w-4" />}>عدّل واعتمد</Button>}
                <Button variant="danger" onClick={() => setRejectAs('leader')}>ارفض بسبب</Button>
              </>
            )}
            {me.isStaff && !me.isLeader && ['facilitator_approved', 'submitted'].includes(doc.status) && <span className="self-center text-xs text-ink-400">أعضاء الإدارة يناقشون ويعلّقون، والاعتماد للقائد العام فقط.</span>}
          </div>

          {doc.history.length > 0 && (
            <div>
              <div className="mb-2 text-xs font-bold text-ink-500">سجل القرارات</div>
              <ol className="space-y-1.5 border-s-2 border-ink-100 ps-3">
                {doc.history.map((h) => (
                  <li key={h.id} className="text-sm">
                    <span className="font-medium">{personName(db, h.byId)}</span>
                    <span className="text-ink-500"> ({h.role === 'leader' ? 'القائد العام' : 'الميسّر'}) </span>
                    <Badge tone={h.decision === 'reject' ? 'red' : 'green'}>{h.decision === 'approve' ? 'موافقة' : h.decision === 'edit' ? 'تعديل واعتماد' : 'رفض'}</Badge>
                    <span className="ms-2 text-xs text-ink-400">{fmtDateTime(h.at)} · نسخة {h.version}</span>
                    {h.reason && <p className="text-xs text-ink-600">{h.reason}</p>}
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="rounded-2xl bg-ink-50/60 p-3">
            <div className="mb-2 flex items-center gap-1 text-xs font-bold text-ink-500"><Icons.MessagesSquare className="h-4 w-4" /> التعليقات والاقتراحات (منفصلة عن التعديلات)</div>
            <CommentThread target={{ kind: 'doc', id: doc.id }} canComment={canCommentOnTripDoc(db, pid, trip)} />
          </div>
        </div>
      )}
      <ReasonModal open={!!rejectAs} onClose={() => setRejectAs(null)} title={rejectAs === 'leader' ? 'رفض القائد العام (يرجع لقائد الفريق)' : 'رفض الميسّر (يرجع للفريق قابلاً للتعديل)'} label="سبب الرفض" cta="رفض وإرجاع"
        onSubmit={(reason) => act(() => repos.trips.docAction(doc.id, { type: rejectAs === 'leader' ? 'leader_reject' : 'facilitator_reject', reason }), 'أُعيدت للفريق')} />
      <EditApproveModal open={editApprove} onClose={() => setEditApprove(false)} doc={doc} />
    </Card>
  );
}

function EditApproveModal({ open, onClose, doc }: { open: boolean; onClose: () => void; doc: TripDoc }) {
  const [fields, setFields] = useState(doc.fields);
  const [note, setNote] = useState('');
  return (
    <Modal open={open} onClose={onClose} title={`تعديل واعتماد: ${docKindLabel[doc.kind]}`} wide
      footer={<><Button variant="secondary" onClick={onClose}>إلغاء</Button><Button disabled={!note.trim()} onClick={() => act(() => { repos.trips.updateDocFields(doc.id, fields); repos.trips.docAction(doc.id, { type: 'leader_edit_approve', reason: note }); onClose(); }, 'عُدّلت واعتُمدت')}>اعتمد بالتعديلات</Button></>}>
      <div className="grid gap-3">
        {FIELDS[doc.kind].map((f) => (
          <Field key={f.key} label={f.label}><Textarea rows={3} value={fields[f.key] ?? ''} onChange={(e) => setFields({ ...fields, [f.key]: e.target.value })} /></Field>
        ))}
        <Field label="ملاحظة التعديل (تظهر للفريق)"><Input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}
