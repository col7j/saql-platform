// تحديث بند تنفيذ (لقطة أو مقابلة أو مخرج): الحالة، والسبب الإلزامي للمتعذرة، وروابط الإثبات (http/https)، والملاحظات.
// يُستخدم في لوحة المتابعة وفي رابط المتابعة للزائر، والفاعل يُسجَّل في الحالتين.
import { useState } from 'react';
import { fmtDateTime } from '@/domain/dates';
import { itemStatusLabel } from '@/domain/media';
import type { BriefItemExec, MediaItemStatus } from '@/domain/types';
import { act } from '@/state/store';
import { Button, Input, Tabs } from '@/ui';

export type ExecPatch = { status?: MediaItemStatus; reason?: string; addProof?: string; note?: string };
const STATUSES = (Object.keys(itemStatusLabel) as MediaItemStatus[]).map((k) => ({ key: k, label: itemStatusLabel[k] }));
export const statusTone = { not_started: 'gray', in_progress: 'blue', done: 'green', failed: 'red' } as const;

export function ItemPanel({ exec, onPatch, readOnly }: { exec: BriefItemExec; onPatch: (p: ExecPatch) => void; readOnly?: boolean }) {
  const [pickFailed, setPickFailed] = useState(false);
  const [reason, setReason] = useState(exec.reason ?? '');
  const [proof, setProof] = useState('');
  const [note, setNote] = useState('');
  const apply = (p: ExecPatch, ok?: string) => act(() => onPatch(p), ok);
  return (
    <div className="space-y-3 text-sm">
      {!readOnly && (
        <Tabs size="sm" className="!mb-0" value={pickFailed ? 'failed' : exec.status} onChange={(k) => {
          if (k === 'failed') { setPickFailed(true); return; }
          setPickFailed(false);
          apply({ status: k });
        }} tabs={STATUSES} />
      )}
      {(pickFailed || exec.status === 'failed') && !readOnly && (
        <div className="flex gap-2">
          <Input value={reason} placeholder="سبب التعذّر (إلزامي)" aria-label="سبب التعذّر" onChange={(e) => setReason(e.target.value)} />
          <Button size="sm" onClick={() => apply({ status: 'failed', reason }, 'سُجّلت الحالة') && setPickFailed(false)}>احفظ</Button>
        </div>
      )}
      {exec.status === 'failed' && exec.reason && readOnly && <p className="text-bad-700">سبب التعذّر: {exec.reason}</p>}
      <div>
        <span className="label">روابط الإثبات</span>
        {exec.proofs.length > 0 && <ul className="mb-2 space-y-1">{exec.proofs.map((u) => <li key={u}><a href={u} target="_blank" rel="noreferrer noopener" dir="ltr" className="break-all text-brand-700 underline">{u}</a></li>)}</ul>}
        {!readOnly && (
          <div className="flex gap-2"><Input dir="ltr" value={proof} placeholder="https://drive.google.com/…" aria-label="رابط إثبات" onChange={(e) => setProof(e.target.value)} />
            <Button size="sm" variant="secondary" disabled={!proof.trim()} onClick={() => apply({ addProof: proof }, 'أُضيف الإثبات') && setProof('')}>أضف</Button></div>
        )}
      </div>
      <div>
        <span className="label">ملاحظات</span>
        {exec.notes.length > 0 && <ul className="mb-2 space-y-1">{exec.notes.map((n) => <li key={n.id} className="rounded-lg bg-ink-50 px-3 py-1.5"><b>{n.by}</b> · <span className="text-xs text-ink-500">{fmtDateTime(n.at)}</span><br />{n.text}</li>)}</ul>}
        {!readOnly && (
          <div className="flex gap-2"><Input value={note} placeholder="اكتب ملاحظة" aria-label="ملاحظة" onChange={(e) => setNote(e.target.value)} />
            <Button size="sm" variant="secondary" disabled={!note.trim()} onClick={() => apply({ note }, 'أُضيفت الملاحظة') && setNote('')}>أضف</Button></div>
        )}
      </div>
      {exec.updatedBy && <p className="text-xs text-ink-500">آخر تحديث: {exec.updatedBy} · {fmtDateTime(exec.updatedAt)}</p>}
    </div>
  );
}
