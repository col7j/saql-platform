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
        actions={<Button onClick={() => setOpen(true)} icon={<Icons.Plus className="h-4 w-4" />}>{me.isStaff ? 'مهمة جديدة' : 'مهمة لزميل في مجموعتي'}</Button>} />
      <div className="flex flex-wrap items-start justify-between gap-2">
        <Tabs value={view} onChange={setView} tabs={[{ key: 'board', label: 'لوحة' }, { key: 'list', label: 'قائمة' }]} />
        <Select className="mb-4 w-48" value={scope} onChange={(e) => setScope(e.target.value as typeof scope)} options={[{ value: 'all', label: 'كل المهام' }, { value: 'mine', label: 'المسندة لي' }, { value: 'general', label: 'عامة (الإدارة)' }, { value: 'committee', label: 'اللجان' }, { value: 'trip_team', label: 'تجهيز الرحلات' }, { value: 'group', label: 'المجموعة' }]} />
      </div>
      {list.length === 0 ? <Empty title="لا مهام" /> : view === 'list' ? (
        <div className="space-y-2">{list.map((t) => <TaskRow key={t.id} task={t} />)}</div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-4">
          {cols.map((c) => {
            const items = list.filter((t) => taskDisplayStatus(t) === c);
            return (
              <div key={c} className="rounded-2xl bg-ink-100/60 p-2">
                <div className="mb-2 flex items-center justify-between px-2 pt-1 text-sm font-bold"><span className={c === 'late' ? 'text-red-600' : ''}>{taskStatusLabel[c]}</span><span className="num text-xs text-ink-500">{items.length}</span></div>
                <div className="space-y-2">{items.map((t) => <TaskRow key={t.id} task={t} />)}</div>
              </div>
            );
          })}
        </div>
      )}
      <TaskModal open={open} onClose={() => setOpen(false)} assignees={assignees} defaults={me.isStaff ? { scope: 'general' } : { scope: 'group', groupId: me.group?.id }} />
    </div>
  );
}
