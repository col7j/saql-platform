// مكونات المهام المشتركة: صف مهمة بإثبات، ونافذة إنشاء مهمة
import { useState } from 'react';
import { fmtShort, relativeDays, todayISO, addDays } from '@/domain/dates';
import { proofTypeLabel } from '@/domain/labels';
import { isTaskLate } from '@/domain/workflow';
import type { ID, ProofType, Task } from '@/domain/types';
import { act, personName, repos, useDB, useMe } from '@/state/store';
import { Badge, Button, Field, Icons, Input, Modal, Select, Toggle, cx } from '@/ui';
import { CommentThread, PersonChip, TaskStatusBadge } from '@/ui/domain';

export function TaskRow({ task, showContext = true }: { task: Task; showContext?: boolean }) {
  const db = useDB();
  const me = useMe();
  const [open, setOpen] = useState(false);
  const [proof, setProof] = useState(task.proof ?? '');
  const mine = task.assigneeId === me.person.id;
  const canManage = mine || task.createdBy === me.person.id || me.isLeader;
  const trip = db.trips.find((t) => t.id === task.tripId);
  const committee = db.committees.find((c) => c.id === task.committeeId);
  const comments = db.comments.filter((c) => c.target.kind === 'task' && c.target.id === task.id).length;
  return (
    <div className={cx('rounded-2xl border bg-white', isTaskLate(task) ? 'border-red-200' : 'border-ink-100')}>
      <button onClick={() => setOpen(!open)} className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-start">
        {task.status === 'done' ? <Icons.CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" /> : <Icons.Circle className="h-5 w-5 shrink-0 text-ink-300" />}
        <div className="min-w-0 flex-1">
          <div className={cx('text-sm font-medium', task.status === 'done' && 'text-ink-400 line-through')}>{task.title}</div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-400">
            <span className={isTaskLate(task) ? 'font-bold text-red-600' : ''}>{fmtShort(task.dueDate)} · {relativeDays(task.dueDate)}</span>
            {task.mandatory && <Badge tone="orange">إلزامية</Badge>}
            {task.proofType !== 'none' && <Badge icon={<Icons.Paperclip className="h-3 w-3" />}>إثبات: {proofTypeLabel[task.proofType]}</Badge>}
            {task.autoFromTemplateId && <Badge tone="purple">تلقائية</Badge>}
            {showContext && trip && <Badge tone="blue">{trip.title}</Badge>}
            {showContext && committee && <Badge>{committee.name}</Badge>}
            {comments > 0 && <span className="inline-flex items-center gap-0.5"><Icons.MessageCircle className="h-3 w-3" />{comments}</span>}
          </div>
        </div>
        <PersonChip id={task.assigneeId} size={24} />
        <TaskStatusBadge task={task} />
      </button>
      {open && (
        <div className="space-y-3 border-t border-ink-100 px-4 py-3">
          {task.description && <p className="text-sm text-ink-600">{task.description}</p>}
          <div className="text-xs text-ink-500">أنشأها: {personName(db, task.createdBy)}</div>
          {task.proof && <div className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800"><b>الإثبات:</b> {task.proof}</div>}
          {canManage && task.status !== 'done' && (
            <div className="flex flex-wrap items-end gap-2">
              {task.status === 'new' && <Button size="sm" variant="secondary" onClick={() => act(() => repos.tasks.update(task.id, { status: 'in_progress' }))}>ابدأ التنفيذ</Button>}
              {task.proofType !== 'none' && (
                <Field label={`الإثبات (${proofTypeLabel[task.proofType]})`} className="min-w-[220px] flex-1">
                  <Input value={proof} onChange={(e) => setProof(e.target.value)} placeholder={task.proofType === 'link' ? 'https://' : task.proofType === 'file' ? 'اسم الملف المرفوع' : 'اكتب الإثبات'} />
                </Field>
              )}
              <Button size="sm" variant="success" onClick={() => act(() => repos.tasks.update(task.id, { status: 'done', proof: proof || undefined }), 'أُغلقت المهمة')}>أنهِ المهمة</Button>
            </div>
          )}
          <CommentThread target={{ kind: 'task', id: task.id }} canComment allowSuggestion={false} />
        </div>
      )}
    </div>
  );
}

export function TaskModal({ open, onClose, assignees, defaults }: { open: boolean; onClose: () => void; assignees: ID[]; defaults: Partial<Task> & Pick<Task, 'scope'> }) {
  const db = useDB();
  const [f, setF] = useState({ title: '', description: '', assigneeId: assignees[0] ?? '', dueDate: addDays(todayISO(), 7), proofType: 'none' as ProofType, mandatory: false, tag: '' });
  return (
    <Modal open={open} onClose={onClose} title="مهمة جديدة"
      footer={<><Button variant="secondary" onClick={onClose}>إلغاء</Button><Button disabled={!f.title.trim() || !f.assigneeId} onClick={() => act(() => { repos.tasks.create({ ...defaults, ...f, tag: f.tag || defaults.tag }); onClose(); }, 'أُسندت المهمة')}>أسند</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="المهمة" className="sm:col-span-2"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="مثال: الضيافة، الشؤون المالية، التنسيق مع الضيوف" /></Field>
        <Field label="الوصف" className="sm:col-span-2"><Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <Field label="المسؤول"><Select value={f.assigneeId} onChange={(e) => setF({ ...f, assigneeId: e.target.value })} options={assignees.map((a) => ({ value: a, label: personName(db, a) }))} /></Field>
        <Field label="الموعد"><Input type="date" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} /></Field>
        <Field label="الإثبات المطلوب" hint="لا تُغلق المهمة إلا به"><Select value={f.proofType} onChange={(e) => setF({ ...f, proofType: e.target.value as ProofType })} options={(['none', 'link', 'file', 'text'] as ProofType[]).map((p) => ({ value: p, label: proofTypeLabel[p] }))} /></Field>
        <Field label="وسم المؤشر (اختياري)" hint="يُحدّث مؤشرات اللجنة الحية"><Input value={f.tag} onChange={(e) => setF({ ...f, tag: e.target.value })} placeholder="مثال: doc_file" /></Field>
        <div className="sm:col-span-2"><Toggle checked={f.mandatory} onChange={(v) => setF({ ...f, mandatory: v })} label="مهمة إلزامية بمسؤول محدد" /></div>
      </div>
    </Modal>
  );
}
