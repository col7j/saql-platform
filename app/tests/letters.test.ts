// الخطابات: طلب من عضو عادي في الفريق، إصدار المندوب، الرؤية، والقراءة فقط للمشرف
import { describe, expect, it } from 'vitest';
import { addDays, todayISO } from '@/domain/dates';
import { canSeeLetter } from '@/domain/letters';
import { routeAccess } from '@/domain/access';
import { harness } from './helpers/harness';

const att = { name: 'خطاب.pdf', type: 'application/pdf', size: 10, hash: 'h1' };

describe('الخطابات', () => {
  const setup = () => {
    const h = harness('p_lead');
    const trip = h.db.trips.find((t) => t.executor.kind === 'group' && t.type === 'external')!;
    const gid = (trip.executor as { groupId: string }).groupId;
    const g = h.db.groups.find((x) => x.id === gid)!;
    const member = g.memberIds.find((m) => m !== g.leaderId)!; // عضو عادي (مسؤول عن بند)
    return { h, trip, g, member };
  };
  it('عضو عادي في الفريق يرفع طلباً فيصل المندوب إشعار، ومن خارج الفريق لا يستطيع', () => {
    const { h, trip, member } = setup();
    h.as(member);
    const id = h.repos.letters.request({ tripId: trip.id, typeId: 'lt2', addressee: 'فندق', purpose: 'حجز', neededBy: addDays(todayISO(), 7) });
    expect(h.db.letters.find((l) => l.id === id)!.status).toBe('submitted');
    expect(h.db.notifications.some((n) => n.toId === 's1' && n.type === 'letter_request')).toBe(true);
    const outsider = h.db.persons.find((p) => p.kind === 'participant' && !h.db.groups.find((g) => g.id === (trip.executor as { groupId: string }).groupId)!.memberIds.includes(p.id))!;
    h.as(outsider.id);
    expect(() => h.repos.letters.request({ tripId: trip.id, typeId: 'lt2', addressee: 'x', purpose: 'y', neededBy: todayISO() })).toThrow(/فريق الرحلة/);
    expect(canSeeLetter(h.db, outsider.id, h.db.letters.find((l) => l.id === id)!)).toBe(false);
  });
  it('المندوب يصدر برقم وتاريخ ويصل الطالب، وغيره لا يصدر، ويعيد بسبب إلزامي', () => {
    const { h, trip, member } = setup();
    h.as(member);
    const id = h.repos.letters.request({ tripId: trip.id, typeId: 'lt1', addressee: 'جهة', purpose: 'تسهيل', neededBy: addDays(todayISO(), 3) });
    h.as('s2');
    expect(() => h.repos.letters.issue(id, { number: '1', date: todayISO(), file: att })).toThrow(/مندوب/);
    h.as('s1');
    expect(() => h.repos.letters.needsEdit(id, ' ')).toThrow(/سبب/);
    h.repos.letters.issue(id, { number: '9/1', date: todayISO(), file: att });
    const l = h.db.letters.find((x) => x.id === id)!;
    expect(l).toMatchObject({ status: 'issued', issued: { number: '9/1' } });
    expect(h.db.notifications.some((n) => n.toId === member && n.type === 'letter_issued')).toBe(true);
    h.repos.letters.markDelivered(id);
    expect(h.db.letters.find((x) => x.id === id)!.status).toBe('delivered');
  });
  it('القائد العام يحوّل المندوب لميسّر آخر، والمشرف يقرأ ولا يكتب', () => {
    const { h, trip } = setup();
    h.repos.letters.assignDelegate('s2');
    expect(h.db.settings.societyDelegateId).toBe('s2');
    expect(() => h.repos.letters.assignDelegate('s7')).toThrow(/الميسّرين/);
    h.as('s8');
    expect(routeAccess(h.db, 's8', '/app/letters')).toBe(true);
    expect(h.repos.letters.list().length).toBeGreaterThan(0);
    expect(() => h.repos.letters.request({ tripId: trip.id, typeId: 'lt1', addressee: 'x', purpose: 'y', neededBy: todayISO() })).toThrow(/القراءة فقط/);
  });
});
