// تحضير المشاركين (من المجموعة ومن المجموعات الأخرى) + رصد الالتزام بالوقت
import { canTakeTripAttendance, tripTeamLeaderId } from '@/domain/permissions';
import { tripHasStarted } from '@/domain/workflow';
import type { Trip } from '@/domain/types';
import { repos, useDB, useMe } from '@/state/store';
import { Badge, Card, Icons, Notice, Stars, cx } from '@/ui';
import { GroupBadge, PersonChip } from '@/ui/domain';

export default function AttendanceTab({ trip }: { trip: Trip }) {
  const db = useDB();
  const me = useMe();
  const canTake = canTakeTripAttendance(db, me.person.id, trip);
  const canPunct = tripTeamLeaderId(db, trip) === me.person.id;
  const started = tripHasStarted(trip);
  const rec = (pid: string) => db.attendance.find((a) => a.eventKind === 'trip' && a.eventId === trip.id && a.personId === pid);
  const present = db.attendance.filter((a) => a.eventKind === 'trip' && a.eventId === trip.id && a.present).length;
  const absent = db.attendance.filter((a) => a.eventKind === 'trip' && a.eventId === trip.id && !a.present).length;

  return (
    <Card title="الحضور" subtitle={`حاضر ${present} · غائب ${absent} · لم يُحضَّر ${db.persons.filter((p) => p.kind === 'participant').length - present - absent}`}>
      {!started && <Notice tone="orange">يبدأ التحضير يوم الرحلة.</Notice>}
      {canPunct && <Notice>بصفتك قائد الفريق: ارصد الالتزام بالوقت والحضور المبكر (من 5). يُحتسب في البند الفردي للمشارك.</Notice>}
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
                    <div className="flex items-center gap-2">
                      {canPunct && r?.present && <Stars value={trip.punctuality[pid]} onChange={(v) => repos.trips.setPunctuality(trip.id, pid, v)} />}
                      {canTake && started ? (
                        <div className="flex overflow-hidden rounded-lg border border-ink-200 text-xs">
                          <button onClick={() => repos.trips.setAttendance('trip', trip.id, pid, true)} className={cx('px-2.5 py-1', r?.present === true ? 'bg-emerald-600 text-white' : 'hover:bg-ink-50')}>حاضر</button>
                          <button onClick={() => repos.trips.setAttendance('trip', trip.id, pid, false)} className={cx('px-2.5 py-1', r?.present === false ? 'bg-red-600 text-white' : 'hover:bg-ink-50')}>غائب</button>
                        </div>
                      ) : r ? <Badge tone={r.present ? 'green' : 'red'}>{r.present ? 'حاضر' : 'غائب'}</Badge> : <Icons.Minus className="h-4 w-4 text-ink-300" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
