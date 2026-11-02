// أول تشغيل: أول حساب هو مسؤول اللجنة التقنية، وهو وحده ينشئ القائد العام
import { describe, expect, it } from 'vitest';
import { buildFirstRunDB } from '@/data/seed';
import { authenticate } from '@/domain/accounts';
import { canManageAccounts } from '@/domain/accounts';
import { isFirstRun } from '@/domain/setup';
import { createLocalRepositories } from '@/data/repositories';
import type { DB } from '@/domain/types';

describe('أول تشغيل', () => {
  it('المعالج ينشئ مسؤول التقنية، وهو وحده ينشئ حساب القائد العام', () => {
    let db: DB = buildFirstRunDB();
    let user = '';
    const repos = createLocalRepositories((r) => { const d = structuredClone(db); if (r(d) !== false) db = d; }, () => user, () => db);
    expect(isFirstRun(db)).toBe(true);
    expect(() => repos.setup.firstRun({ programName: 'صقل', name: 'م', email: 'bad', password: '123456' })).toThrow(/البريد/);
    user = repos.setup.firstRun({ programName: 'صقل 7', name: 'مسؤول التقنية', email: 'tech@saql.example', password: 'secret1' });
    expect(db.accounts).toHaveLength(1);
    expect(canManageAccounts(db, user)).toBe(true);
    expect(authenticate(db, 'tech', 'secret1')).toMatchObject({ personId: user });
    expect(isFirstRun(db)).toBe(false);
    expect(() => repos.setup.firstRun({ programName: 'x', name: 'y', email: 'a@b.co', password: '123456' })).toThrow(/معدّة/);
    const lead = repos.people.createAccount({ role: 'general_leader', name: 'القائد العام', email: 'lead@x.io' });
    expect(db.persons.find((p) => p.id === lead.id)?.isGeneralLeader).toBe(true);
  });
});
