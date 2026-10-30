// بيانات الاختبارات: البيانات التجريبية نفسها، مع عضويات لجان تحتاجها الاختبارات لتغطية حالاتها
// (في الديمو الميسّرون ميسّرون فقط، فتُضاف هنا: s3 عضو مالية بلا صلاحيات، و s2 و s4 في الإعلامية، و s7 في التقنية)
import { buildSeed } from '@/data/seed';
import type { DB } from '@/domain/types';

export function fixtureSeed(): DB {
  const db = buildSeed();
  const add = (committeeId: string, personId: string, extra: object = {}) =>
    db.memberships.push({ id: `cm_t_${committeeId}_${personId}`, committeeId, personId, role: 'member', canSeeFinance: false, ...extra });
  add('c_fin', 's3', { financePerms: [] });
  add('c_media', 's2');
  add('c_media', 's4');
  add('c_tech', 's7');
  return db;
}
