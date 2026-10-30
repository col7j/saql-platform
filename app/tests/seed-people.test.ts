// أسماء الديمو وصفاتهم: 28 مشاركاً في أربع مجموعات، وفريق العمل بصفاته المحددة
import { describe, expect, it } from 'vitest';
import { buildSeed } from '@/data/seed';
import { getCapabilities } from '@/domain/permissions';

const db = buildSeed();
const caps = (id: string) => getCapabilities(db, id);
const committeesOf = (id: string) => db.memberships.filter((m) => m.personId === id && db.committees.find((c) => c.id === m.committeeId)?.kind !== 'general');

describe('بيانات الديمو', () => {
  it('28 مشاركاً بأسماء فريدة، سبعة في كل مجموعة', () => {
    const parts = db.persons.filter((p) => p.kind === 'participant');
    expect(parts).toHaveLength(28);
    expect(new Set(parts.map((p) => p.name)).size).toBe(28);
    db.groups.forEach((g) => expect(g.memberIds).toHaveLength(7));
  });
  it('فريق العمل: القائد العام، ومسؤول الإعلامية والتقنية، ومسؤول المالية، والمتابع، وأربعة ميسّرين فقط', () => {
    expect(db.persons.find((p) => p.isGeneralLeader)!.name).toBe('أحمد يحيى الحاج');
    expect(caps('s6').isTechLead).toBe(true);
    expect(committeesOf('s6').map((m) => m.committeeId).sort()).toEqual(['c_media', 'c_tech']);
    expect(caps('s5').isFinanceLead).toBe(true);
    expect(caps('s7').isTracker).toBe(true);
    expect(committeesOf('s7')).toHaveLength(0);
    for (const id of ['s1', 's2', 's3', 's4']) {
      expect(caps(id).facilitatorOf).toHaveLength(1);
      expect(committeesOf(id), id).toHaveLength(0);
    }
  });
});
