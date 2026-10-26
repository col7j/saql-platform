// قاعدة بيانات تجريبية في الذاكرة مع طبقة البيانات، بهوية مستخدم قابلة للتبديل
import { buildSeed } from '@/data/seed';
import { createLocalRepositories } from '@/data/repositories';
import type { DB } from '@/domain/types';

export function harness(as: string) {
  let db: DB = buildSeed();
  let user = as;
  const mutate = (recipe: (d: DB) => unknown) => {
    const draft = structuredClone(db);
    if (recipe(draft) === false) return;
    db = draft;
  };
  return {
    repos: createLocalRepositories(mutate, () => user, () => db),
    get db() { return db; },
    as(id: string) { user = id; },
  };
}
