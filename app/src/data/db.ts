// تخزين قاعدة البيانات التجريبية في المتصفح. هذا الملف وحده يعرف localStorage.
import type { DB } from '@/domain/types';
import { buildSeed, DB_VERSION } from './seed';

const KEY = 'saql.db.v' + DB_VERSION;
const USER_KEY = 'saql.viewAs';

export function loadDB(): DB {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const db = JSON.parse(raw) as DB;
      if (db.version === DB_VERSION) return db;
    }
  } catch {
    /* بيانات تالفة: نعيد التوليد */
  }
  const db = buildSeed();
  saveDB(db);
  return db;
}

export function saveDB(db: DB) {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    /* المساحة ممتلئة أو التخزين غير متاح: نكمل في الذاكرة */
  }
}

export function resetDB(): DB {
  const db = buildSeed();
  saveDB(db);
  return db;
}

export function loadViewAs(): string | null {
  try {
    return localStorage.getItem(USER_KEY);
  } catch {
    return null;
  }
}
export function saveViewAs(id: string | null) {
  try {
    if (id) localStorage.setItem(USER_KEY, id);
    else localStorage.removeItem(USER_KEY);
  } catch {
    /* تجاهل */
  }
}
