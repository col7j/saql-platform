// الحضور: التحضير العام للرحلة بحالاته (مبكر، في الوقت، متأخر، غائب)، ولقاءات الرحلة التي يلزمها تحضير (حاضر، غائب).
// يسجّله مسؤول التحضير الذي يعيّنه قائد المجموعة (أو القائد نفسه). قائد المجموعة لا يقيّم أحداً.
import { useState } from 'react';
import { canTakeTripAttendance, tripTeamIds, tripTeamLeaderId } from '@/domain/permissions';
import { tripHasStarted } from '@/domain/workflow';
import type { AttendanceStatus, Trip } from '@/domain/types';
import { act, repos, useDB, useMe } from '@/state/store';
import { Badge, Card, Field, Icons, Notice, Select, Tabs, cx } from '@/ui';
import { GroupBadge, PersonChip } from '@/ui/domain';

const tripStates: { key: AttendanceStatus; label: string; tone: string }[] = [
  { key: 'early', label: 'مبكر', tone: 'bg-emerald-700 text-white' },
  { key: 'on_time', label: 'في الوقت', tone: 'bg-emerald-600 text-white' },
  { key: 'late', label: 'متأخر', tone: 'bg-accent-500 text-white' },
  { key: 'absent', label: 'غائب', tone: 'bg-red-600 text-white' },
];
const statusLabel: Record<AttendanceStatus, string> = { early: 'مبكر', on_time: 'في الوقت', late: 'متأخر', present: 'حاضر', absent: 'غائب' };

export default function AttendanceTab({ trip }: { trip: Trip }) {
  const db = useDB();
  const me = useMe();
  const canTake = canTakeTripAttendance(db, me.person.id, trip);
  const isLead = tripTeamLeaderId(db, trip) === me.person.id;
  const started = tripHasStarted(trip);
  const prep = new Set(db.settings.scheduleCategories.filter((c) => c.requiresPrep).map((c) => c.id));
  const sessions = (trip.schedule.plans[0]?.items ?? []).filter((i) => i.sessionId && prep.has(i.categoryId)).map((i) => ({ item: i, session: trip.sessions.find((s) => s.id === i.sessionId)! })).filter((x) => x.session);
  const [view, setView] = useState<string>('trip');
  const sessionId = view === 'trip' ? undefined : view;
  const kind = sessionId ? 'trip_session' : 'trip';
  const rec = (pid: string) => db.attendance.find((a) => a.eventKind === kind && a.eventId === trip.id && a.personId === pid && a.sessionId === sessionId);
  const all = db.attendance.filter((a) => a.eventKind === kind && a.eventId === trip.id && a.sessionId === sessionId);
  const states = sessionId ? tripStates.filter((s) => s.key === 'absent').concat([{ key: 'present', label: 'حاضر', tone: 'bg-emerald-600 text-white' }]).reverse() : tripStates;
  const team = tripTeamIds(db, trip);

  return (
    <div className="space-y-4">
      {isLead && (
        <Card title="مسؤول التحضير" subtitle="يعيّنه قائد المجموعة من فريق الرحلة (أو تحضّر بنفسك)، ويسجّل الحضور في الرحلة وفي لقاءاتها">
          <Field label="المسؤول" className="max-w-sm">
            <Select value={trip.attendanceTakerId ?? ''} onChange={(e) => act(() => repos.trips.update(trip.id, { attendanceTakerId: e.target.value || undefined }), 'عُيّن مسؤول التحضير')} options={[{ value: '', label: 'أنا (قائد الفريق)' }, ...team.filter((x) => x !== me.person.id).map((x) => ({ value: x, label: db.persons.find((p) => p.id === x)?.name ?? x }))]} />
          </Field>
        </Card>
      )}
      <Card title="الحضور" subtitle={`حاضر ${all.filter((a) => a.present).length} · غائب ${all.filter((a) => !a.present).length} · الحضور يؤثر على التقييم الفردي فقط`}>
        <Tabs value={view} onChange={setView} tabs={[{ key: 'trip', label: 'التحضير العام' }, ...sessions.map((x) => ({ key: x.session.id, label: `لقاء: ${x.session.title}` }))]} />
        {!started && <Notice tone="orange">يبدأ التحضير يوم الرحلة.</Notice>}
        {sessionId && <Notice>لقاءات التصنيفات التي يلزمها تحضير: حاضر أو غائب، بلا تأخير أو تبكير.</Notice>}
        <div className="mt-3 space-y-4">
          {db.groups.map((g) => (
            <div key={g.id}>
              <div className="mb-2"><GroupBadge id={g.id} /></div>
              <div className="grid gap-2 md:grid-cols-2">
                {g.memberIds.map((pid) => {
                  const r = rec(pid);
                  return (
                    <div key={pid} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink-100 px-3 py-2">
                      <PersonChip id={pid} size={26} />
                      {canTake && started ? (
                        <div className="flex overflow-hidden rounded-lg border border-ink-200 text-xs">
                          {states.map((st) => (
                            <button key={st.key} onClick={() => act(() => repos.trips.setAttendance(kind, trip.id, pid, st.key, sessionId))} className={cx('px-2 py-1', r?.status === st.key ? st.tone : 'hover:bg-ink-50')}>{st.label}</button>
                          ))}
                        </div>
                      ) : r ? <Badge tone={r.present ? 'green' : 'red'}>{statusLabel[r.status]}</Badge> : <Icons.Minus className="h-4 w-4 text-ink-300" />}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
