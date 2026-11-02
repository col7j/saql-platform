// حجز لقاء فردي واحد نشط، ومنع تحضير الغائب عن الرحلة في جلساتها
import { describe, expect, it } from 'vitest';
import { harness } from './helpers/harness';

describe('اللقاءات الفردية: حجز واحد', () => {
  it('لا حجز ثانٍ حتى يغلق الميسّر الأول، ويستطيع بتجاوز الميسّر', () => {
    const h = harness('s1');
    const pid = 'u2';
    h.db.individualMeetings = h.db.individualMeetings.filter((m) => m.participantId !== pid);
    h.db.slots = h.db.slots.filter((s) => s.facilitatorId !== 's1');
    h.repos.individual.addSlot({ date: '2099-01-01', start: '10:00', end: '10:30', invite: 'open' } as never);
    h.repos.individual.addSlot({ date: '2099-01-02', start: '10:00', end: '10:30', invite: 'open' } as never);
    const [a, b] = h.db.slots.filter((s) => s.facilitatorId === 's1');
    h.as(pid);
    h.repos.individual.book(a.id);
    expect(() => h.repos.individual.book(b.id)).toThrow(/نشط/);
    h.as('s1');
    const im = h.db.individualMeetings.find((m) => m.participantId === pid && m.status === 'booked')!;
    h.repos.individual.complete(im.id, 'ملاحظة على الخطة', 'ملاحظة على اللقاء');
    h.as(pid);
    h.repos.individual.book(b.id); // بعد الإغلاق
    h.as('s1');
    h.repos.individual.setBookingLimit(pid, 2);
    expect(h.db.settings.bookingLimits?.[pid]).toBe(2);
    h.as('s2');
    expect(() => h.repos.individual.setBookingLimit(pid, 3)).toThrow(/ميسّر/);
  });
});

describe('الحضور داخل الرحلة', () => {
  it('الغائب عن الرحلة لا يُحضَّر في جلساتها، والمحاولة البرمجية تُرفض', () => {
    const h = harness('s7');
    const t = h.db.trips.find((x) => h.db.attendance.some((a) => a.eventKind === 'trip_session' && a.eventId === x.id))!;
    const ses = h.db.attendance.find((a) => a.eventKind === 'trip_session' && a.eventId === t.id)!;
    const pid = ses.personId;
    h.repos.trips.setAttendance('trip', t.id, pid, 'absent');
    expect(h.db.attendance.find((a) => a.eventKind === 'trip_session' && a.eventId === t.id && a.personId === pid && a.sessionId === ses.sessionId)!.present).toBe(false);
    expect(() => h.repos.trips.setAttendance('trip_session', t.id, pid, 'present', ses.sessionId)).toThrow(/غائب عن الرحلة/);
  });
});
