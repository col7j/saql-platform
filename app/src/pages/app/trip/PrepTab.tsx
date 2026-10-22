// المسار 2: التجهيز (مهام الفريق + التنسيقات للرحلات الخارجية + مهام اللجان التلقائية)
import { useState } from 'react';
import { coordinationLabel } from '@/domain/labels';
import { tripTeamIds, tripTeamLeaderId } from '@/domain/permissions';
import type { Trip } from '@/domain/types';
import { act, repos, useDB, useMe } from '@/state/store';
import { Badge, Button, Card, Empty, Icons, Input, Progress, Select } from '@/ui';
import { PersonChip } from '@/ui/domain';
import { TaskModal, TaskRow } from '../TaskParts';

export default function PrepTab({ trip }: { trip: Trip }) {
  const db = useDB();
  const me = useMe();
  const [open, setOpen] = useState(false);
  const isLead = tripTeamLeaderId(db, trip) === me.person.id;
  const team = tripTeamIds(db, trip);
  const teamTasks = db.tasks.filter((t) => t.tripId === trip.id && t.scope === 'trip_team');
  const committeeTasks = db.tasks.filter((t) => t.tripId === trip.id && t.scope === 'committee');
  const done = teamTasks.filter((t) => t.status === 'done').length;
  const canCoord = isLead || trip.coordinationOwnerId === me.person.id;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Card title="مهام فريق الرحلة" subtitle="قائد الفريق يسند المهام، وكل أعضاء الفريق يرونها" action={isLead && <Button size="sm" onClick={() => setOpen(true)} icon={<Icons.Plus className="h-4 w-4" />}>أسند مهمة</Button>}>
          {teamTasks.length > 0 && <Progress value={(done / teamTasks.length) * 100} label className="mb-4" />}
          <div className="space-y-2">
            {teamTasks.length === 0 ? <Empty title="لم تُسند مهام بعد" /> : teamTasks.map((t) => <TaskRow key={t.id} task={t} showContext={false} />)}
          </div>
          <p className="mt-3 text-xs text-ink-400">ملاحظة: قد يسند القائد مهاماً مالية لعضو، لكن مسؤولية العهدة الكاملة تبقى عليه.</p>
        </Card>
        {me.isStaff && (
          <Card title="مهام اللجان لهذه الرحلة" subtitle="تُنشأ تلقائياً من قالب المهام عند إنشاء الرحلة">
            <div className="space-y-2">{committeeTasks.map((t) => <TaskRow key={t.id} task={t} />)}</div>
          </Card>
        )}
      </div>
      <div className="space-y-4">
        {trip.type === 'external' && (
          <Card title="قسم التنسيقات" subtitle="يُكلّف به شخص محدد ويتابعه الجميع">
            <div className="mb-3"><PersonChip id={trip.coordinationOwnerId} sub="مسؤول التنسيقات" /></div>
            <div className="space-y-3">
              {trip.coordinations.map((c) => (
                <div key={c.key} className="rounded-xl border border-ink-100 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold">{coordinationLabel[c.key]}</span>
                    {canCoord ? (
                      <Select className="w-32 py-1 text-xs" value={c.status} onChange={(e) => repos.trips.updateCoordination(trip.id, c.key, { status: e.target.value as any })} options={[{ value: 'pending', label: 'لم يبدأ' }, { value: 'in_progress', label: 'جارٍ' }, { value: 'done', label: 'مكتمل' }]} />
                    ) : <Badge tone={c.status === 'done' ? 'green' : c.status === 'in_progress' ? 'blue' : 'gray'}>{{ pending: 'لم يبدأ', in_progress: 'جارٍ', done: 'مكتمل' }[c.status]}</Badge>}
                  </div>
                  {canCoord ? <Input className="mt-2 text-xs" defaultValue={c.note} placeholder="ملاحظات" onBlur={(e) => act(() => repos.trips.updateCoordination(trip.id, c.key, { note: e.target.value }))} /> : c.note && <p className="mt-1 text-xs text-ink-500">{c.note}</p>}
                </div>
              ))}
            </div>
          </Card>
        )}
        {trip.type === 'internal' && (
          <Card title="التنسيقات">
            <div className="space-y-2">
              {trip.coordinations.map((c) => (
                <div key={c.key} className="flex items-center justify-between text-sm">
                  <span>{coordinationLabel[c.key]}</span>
                  {isLead ? <Select className="w-28 py-1 text-xs" value={c.status} onChange={(e) => repos.trips.updateCoordination(trip.id, c.key, { status: e.target.value as any })} options={[{ value: 'pending', label: 'لم يبدأ' }, { value: 'in_progress', label: 'جارٍ' }, { value: 'done', label: 'مكتمل' }]} /> : <Badge>{{ pending: 'لم يبدأ', in_progress: 'جارٍ', done: 'مكتمل' }[c.status]}</Badge>}
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
      <TaskModal open={open} onClose={() => setOpen(false)} assignees={team} defaults={{ scope: 'trip_team', tripId: trip.id }} />
    </div>
  );
}
