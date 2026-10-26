// الحالة المركزية: قاعدة البيانات الحالية + المستخدم الحالي (مبدّل الأدوار) + التنبيهات المؤقتة.
import { useMemo } from 'react';
import { create } from 'zustand';
import { loadDB, loadViewAs, resetDB, saveDB, saveViewAs } from '@/data/db';
import { createLocalRepositories, type Repositories } from '@/data/repositories';
import { getCapabilities } from '@/domain/permissions';
import { computeScores } from '@/domain/points';
import type { DB } from '@/domain/types';

interface Toast {
  id: number;
  text: string;
  tone: 'ok' | 'error';
}

interface State {
  db: DB;
  userId: string | null; // null = غير مسجّل دخول
  toasts: Toast[];
  setUser: (id: string | null) => void;
  commit: (db: DB) => void;
  reset: () => void;
  toast: (text: string, tone?: Toast['tone']) => void;
  dismiss: (id: number) => void;
}

export const useStore = create<State>((set, get) => ({
  db: loadDB(),
  userId: loadViewAs(),
  toasts: [],
  setUser: (id) => {
    saveViewAs(id);
    set({ userId: id });
  },
  commit: (db) => {
    saveDB(db);
    set({ db });
  },
  reset: () => set({ db: resetDB() }),
  toast: (text, tone = 'ok') => {
    const id = Date.now() + Math.random();
    set({ toasts: [...get().toasts, { id, text, tone }] });
    setTimeout(() => get().dismiss(id), 3500);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

const mutate = (recipe: (d: DB) => unknown) => {
  const draft = structuredClone(useStore.getState().db);
  if (recipe(draft) === false) return;
  useStore.getState().commit(draft);
};

/** واجهة البيانات المستخدمة في الشاشات */
export const repos: Repositories = createLocalRepositories(mutate, () => useStore.getState().userId ?? '', () => useStore.getState().db);

export function useDB() {
  return useStore((s) => s.db);
}
export function useMe() {
  const db = useDB();
  const userId = useStore((s) => s.userId);
  return useMemo(() => getCapabilities(db, userId ?? db.persons[0].id), [db, userId]);
}
export function useScores() {
  const db = useDB();
  return useMemo(() => computeScores(db), [db]);
}

/** تنفيذ إجراء مع رسالة نجاح أو خطأ */
export function act(fn: () => void, ok?: string) {
  try {
    fn();
    if (ok) useStore.getState().toast(ok);
    return true;
  } catch (e) {
    useStore.getState().toast((e as Error).message || 'حدث خطأ', 'error');
    return false;
  }
}

export function personName(db: DB, id?: string) {
  return db.persons.find((p) => p.id === id)?.name ?? '—';
}
