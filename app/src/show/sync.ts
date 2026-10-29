// طبقة التزامن بين شاشة التحكم وشاشة العرض. الشاشات لا تعرف إلا الواجهة ShowSync،
// فاستبدال BroadcastChannel بـ Firebase أو Supabase لاحقاً يكون بكتابة تنفيذ جديد لها فقط.
import type { ShowConfig } from './model';
import type { Pos } from './nav';

export type ShowMessage =
  | { type: 'config'; config: ShowConfig } // الأدمن حفظ إعدادات جديدة
  | { type: 'goto'; pos: Pos } // الأدمن ينقل العرض
  | { type: 'nav'; dir: 'next' | 'prev' } // ريموت من الأدمن
  | { type: 'state'; pos: Pos; started: boolean } // العرض يبلّغ موضعه
  | { type: 'hello' }; // نافذة فُتحت وتطلب الحالة

export interface ShowSync {
  send(msg: ShowMessage): void;
  subscribe(cb: (msg: ShowMessage) => void): () => void;
  close(): void;
}

export const SYNC_CHANNEL = 'saql-show';

/** تزامن على نفس الجهاز: BroadcastChannel، وإلا حدث storage كبديل للمتصفحات القديمة */
export function createLocalSync(channel = SYNC_CHANNEL): ShowSync {
  const subs = new Set<(m: ShowMessage) => void>();
  const emit = (m: ShowMessage) => subs.forEach((cb) => cb(m));

  if (typeof BroadcastChannel !== 'undefined') {
    const bc = new BroadcastChannel(channel);
    bc.onmessage = (e) => emit(e.data as ShowMessage);
    return {
      send: (m) => bc.postMessage(m),
      subscribe: (cb) => (subs.add(cb), () => subs.delete(cb)),
      close: () => (bc.close(), subs.clear()),
    };
  }

  const key = `show-sync:${channel}`;
  const onStorage = (e: StorageEvent) => {
    if (e.key === key && e.newValue) emit(JSON.parse(e.newValue).m);
  };
  window.addEventListener('storage', onStorage);
  return {
    send: (m) => {
      try {
        localStorage.setItem(key, JSON.stringify({ m, t: Date.now() + Math.random() }));
      } catch {
        /* تجاهل */
      }
    },
    subscribe: (cb) => (subs.add(cb), () => subs.delete(cb)),
    close: () => (window.removeEventListener('storage', onStorage), subs.clear()),
  };
}
