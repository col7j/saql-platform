// لوحة المهام (قسم 12.2): لوحة عامة للإدارة مع نقاش، ومهام المشارك
import { useState } from 'react';
import { taskStatusLabel } from '@/domain/labels';
import { taskDisplayStatus } from '@/domain/workflow';
import type { Task } from '@/domain/types';
import { useDB, useMe } from '@/state/store';
import { Button, Empty, Icons, PageHeader, Select, Tabs } from '@/ui';
import { TaskModal, TaskRow } from './TaskParts';

export default function TasksPage() {
  const db = useDB();
  const me = useMe();
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<'all' | Task['scope'] | 'mine'>(me.isStaff ? 'all' : 'mine');
  const [view, setView] = useState<'board' | 'list'>('board');
  const visible = db.tasks.filter((t) => {
    if (me.isLeader) return true;
    if (t.assigneeId === me.person.id || t.createdBy === me.person.id) return true;
    if (me.isStaff && (t.scope === 'general' || t.scope === 'trip_team')) return true;
    if (t.committeeId && me.committees.some((c) => c.committee.id === t.committeeId)) return true;
    if (t.scope === 'group' && t.groupId === me.group?.id) return true;
    return false;
  });
  const list = visible.filter((t) => (scope === 'all' ? true : scope === 'mine' ? t.assigneeId === me.person.id : t.scope === scope));
  const cols: (Task['status'] | 'late')[] = ['new', 'in_progress', 'late', 'done'];
  const assignees = me.isStaff
    ? db.persons.filter((p) => p.kind === 'staff').map((p) => p.id)
    : (me.group?.memberIds ?? []).filter((id) => id !== me.person.id);

  return (
    <div>
      <PageHeader title={me.isStaff ? 'لوحة المهام' : 'مهامي'} subtitle="الحالات: جديدة، قيد التنفيذ، منتهية، ومتأخرة تلقائياً عند فوات الموعد. الإثبات إلزامي عند طلبه"
        actions={<Button onClick={() => setOpen(true)} icon={<Icons.Plus className="h-4 w-4" />}>{me.isStaff ? 'أنشئ مهمة' : 'أسند مهمة لزميل'}</Button>} />
      <div className="flex flex-wrap items-start justify-between gap-2">
        <Tabs value={view} onChange={setView} tabs={[{ key: 'board', label: 'لوحة' }, { key: 'list', label: 'قائمة' }]} />
        <Select className="mb-4 w-48" value={scope} onChange={(e) => setScope(e.target.value as typeof scope)} options={[{ value: 'all', label: 'كل المهام' }, { value: 'mine', label: 'المسندة لي' }, { value: 'general', label: 'عامة (الإدارة)' }, { value: 'committee', label: 'اللجان' }, { value: 'trip_team', label: 'تجهيز الرحلات' }, { value: 'group', label: 'المجموعة' }]} />
      </div>
      {list.length === 0 ? <Empty title="لا مهام" /> : view === 'list' ? (
        <div className="space-y-2">{list.map((t) => <TaskRow key={t.id} task={t} />)}</div>
      ) : (
        <div className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-4 xl:grid xl:grid-cols-4 xl:overflow-visible">
          {cols.map((c) => {
            const items = list.filter((t) => taskDisplayStatus(t) === c);
            const dot = { new: 'bg-ink-300', in_progress: 'bg-brand-500', late: 'bg-red-500', done: 'bg-emerald-500' }[c];
            return (
              <section key={c} aria-label={taskStatusLabel[c]} className="flex w-[290px] shrink-0 flex-col rounded-2xl border border-ink-100 bg-ink-50/70 p-3 xl:w-auto xl:min-w-0">
                <header className="mb-3 flex items-center gap-2 px-1">
                  <span className={`h-2.5 w-2.5 rounded-full ${dot}`} aria-hidden />
                  <h2 className="text-sm font-bold text-ink-800">{taskStatusLabel[c]}</h2>
                  <span className="num ms-auto rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-ink-600 shadow-sm">{items.length}</span>
                </header>
                <div className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto pe-1">
                  {items.map((t) => <TaskRow key={t.id} task={t} card />)}
                  {!items.length && <p className="rounded-xl border border-dashed border-ink-200 px-3 py-6 text-center text-xs text-ink-400">لا مهام هنا</p>}
                </div>
              </section>
            );
          })}
        </div>
      )}
      <TaskModal open={open} onClose={() => setOpen(false)} assignees={assignees} defaults={me.isStaff ? { scope: 'general' } : { scope: 'group', groupId: me.group?.id }} />
    </div>
  );
}
