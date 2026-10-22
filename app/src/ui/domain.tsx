// مكونات مرتبطة بالمجال: أسماء الأشخاص، شارات المجموعات، التعليقات...
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { timeAgo } from '@/domain/dates';
import { taskStatusLabel, taskStatusTone } from '@/domain/labels';
import { taskDisplayStatus } from '@/domain/workflow';
import type { Comment, ID, Task } from '@/domain/types';
import { act, personName, repos, useDB, useMe } from '@/state/store';
import { Avatar, Badge, Button, Icons, Textarea, cx } from './index';

export function PersonChip({ id, sub, size = 28 }: { id?: ID; sub?: string; size?: number }) {
  const db = useDB();
  const p = db.persons.find((x) => x.id === id);
  if (!p) return <span className="text-ink-400">—</span>;
  const g = db.groups.find((x) => x.memberIds.includes(p.id));
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <Avatar name={p.name} size={size} color={p.kind === 'staff' ? 'linear-gradient(135deg,#f79845,#fbb42b)' : g?.color} />
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-ink-800">{p.name}</span>
        {sub && <span className="block truncate text-[11px] text-ink-400">{sub}</span>}
      </span>
    </span>
  );
}

export function GroupBadge({ id }: { id?: ID }) {
  const db = useDB();
  const g = db.groups.find((x) => x.id === id);
  if (!g) return null;
  return (
    <span className="chip border" style={{ borderColor: g.color + '55', color: g.color, background: g.color + '12' }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: g.color }} />
      {g.name}
    </span>
  );
}

export function TaskStatusBadge({ task }: { task: Task }) {
  const s = taskDisplayStatus(task);
  return <Badge tone={taskStatusTone[s]}>{taskStatusLabel[s]}</Badge>;
}

/** خيط تعليقات منفصل عن التعديلات (قسم 3.3) */
export function CommentThread({ target, canComment, allowSuggestion = true }: { target: Comment['target']; canComment: boolean; allowSuggestion?: boolean }) {
  const db = useDB();
  const me = useMe();
  const [text, setText] = useState('');
  const [kind, setKind] = useState<Comment['kind']>('comment');
  const list = db.comments.filter((c) => c.target.kind === target.kind && c.target.id === target.id);
  return (
    <div className="space-y-3">
      {list.length === 0 && <p className="text-sm text-ink-400">لا تعليقات بعد.</p>}
      {list.map((c) => (
        <div key={c.id} className="flex gap-2.5">
          <Avatar name={personName(db, c.authorId)} size={28} />
          <div className="min-w-0 flex-1 rounded-2xl bg-ink-50 px-3 py-2">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-bold text-ink-800">{personName(db, c.authorId)}</span>
              {c.kind === 'suggestion' && <Badge tone="orange">اقتراح</Badge>}
              <span className="text-ink-400">{timeAgo(c.at)}</span>
            </div>
            <p className="mt-0.5 whitespace-pre-line text-sm text-ink-700">{c.text}</p>
          </div>
        </div>
      ))}
      {canComment && (
        <div className="rounded-2xl border border-ink-100 p-2">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder={me.isParticipant ? 'تعليق أو اقتراح (لا يغيّر الوثيقة)' : 'أضف تعليقاً للنقاش'} className="border-0 focus:ring-0" />
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            {allowSuggestion ? (
              <div className="flex gap-1 text-xs">
                {(['comment', 'suggestion'] as const).map((k) => (
                  <button key={k} onClick={() => setKind(k)} className={cx('rounded-lg px-2 py-1', kind === k ? 'bg-brand-50 text-brand-700' : 'text-ink-500')}>
                    {k === 'comment' ? 'تعليق' : 'اقتراح'}
                  </button>
                ))}
              </div>
            ) : <span />}
            <Button size="sm" variant="secondary" disabled={!text.trim()} onClick={() => act(() => { repos.comments.add(target, text, kind); setText(''); })} icon={<Icons.Send className="h-3.5 w-3.5" />}>
              أرسل التعليق
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function PlaceholderImage({ label, className }: { label?: string; className?: string }) {
  return (
    <div className={cx('flex items-center justify-center rounded-xl bg-gradient-to-br from-brand-100 via-brand-50 to-accent-50 text-brand-600', className)}>
      <Icons.ImageIcon className="h-6 w-6 opacity-60" />
      {label && <span className="ms-1 text-xs">{label}</span>}
    </div>
  );
}

export function SectionTitle({ children, to, more = 'عرض الكل' }: { children: React.ReactNode; to?: string; more?: string }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <h2 className="text-base font-bold text-ink-900">{children}</h2>
      {to && <Link to={to} className="text-xs text-brand-600 hover:underline">{more}</Link>}
    </div>
  );
}
