// التراجع والإعادة: سجل لقطات بحد أقصى. التعديلات المتتالية على نفس الحقل (الكتابة، تحريك بالأسهم)
// تُدمج في خطوة واحدة إن جاءت خلال COALESCE_MS.

export const HISTORY_LIMIT = 100;
export const COALESCE_MS = 900;

export interface History<T> {
  past: T[];
  present: T;
  future: T[];
  /** مفتاح آخر تعديل ووقته للدمج */
  key?: string;
  at?: number;
}

export const initHistory = <T>(present: T): History<T> => ({ past: [], present, future: [] });

export function record<T>(h: History<T>, next: T, key?: string, now = Date.now()): History<T> {
  if (next === h.present) return h;
  if (key && key === h.key && h.at !== undefined && now - h.at < COALESCE_MS) return { ...h, present: next, future: [], at: now };
  return { past: [...h.past, h.present].slice(-HISTORY_LIMIT), present: next, future: [], key, at: now };
}

export function undo<T>(h: History<T>): History<T> {
  if (!h.past.length) return h;
  return { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] };
}

export function redo<T>(h: History<T>): History<T> {
  if (!h.future.length) return h;
  return { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) };
}

/** تغيّر الحالة من خارج المحرّر (نافذة أخرى): تصبح الحاضر دون مسح السجل */
export const external = <T>(h: History<T>, present: T): History<T> => (present === h.present ? h : { ...h, present, key: undefined });
