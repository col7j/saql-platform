// خادم محلي للتجربة بلا Firebase: قاعدة بيانات في الذاكرة (أو في localStorage بين تبويبات نفس المتصفح)
// تحاكي قواعد الأمان في firebase/database.rules.json في جوهرها. تستخدمها الاختبارات،
// وتجربة الريموت على نفس الجهاز بإضافة ?remote=loopback للرابط على localhost فقط.
import { CODE_RE, parseCommand, type Backend } from './protocol';

export interface Store {
  read(): any;
  write(data: any): void;
  subscribe(cb: () => void): () => void;
}

/** مخزن في الذاكرة (الاختبارات) */
export function memoryStore(): Store {
  let data: any = {};
  const subs = new Set<() => void>();
  return {
    read: () => data,
    write: (d) => ((data = d), subs.forEach((s) => s())),
    subscribe: (cb) => (subs.add(cb), () => subs.delete(cb)),
  };
}

/** مخزن مشترك بين تبويبات المتصفح (التجربة المحلية) */
export function sharedStore(key = 'show-loopback-db'): Store {
  const subs = new Set<() => void>();
  const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(key) : null;
  bc && (bc.onmessage = () => subs.forEach((s) => s()));
  return {
    read: () => {
      try {
        return JSON.parse(localStorage.getItem(key) ?? '{}');
      } catch {
        return {};
      }
    },
    write: (d) => {
      localStorage.setItem(key, JSON.stringify(d));
      bc?.postMessage(1);
      // بعد انتهاء الكتابة الحالية لا في وسطها، كي لا تتداخل الإشعارات
      queueMicrotask(() => subs.forEach((s) => s()));
    },
    subscribe: (cb) => (subs.add(cb), () => subs.delete(cb)),
  };
}

const denied = () => Promise.reject(new Error('PERMISSION_DENIED: Permission denied'));

export class LoopbackDB {
  /** ساعة قابلة للتقديم في الاختبارات */
  offset = 0;
  constructor(readonly store: Store = memoryStore()) {}
  now = () => Date.now() + this.offset;
  get data() {
    return this.store.read();
  }
  at(p: string) {
    return p.split('/').reduce((o: any, k) => (o == null ? undefined : o[k]), this.data);
  }
  write(p: string, v: unknown) {
    const data = this.data;
    const keys = p.split('/');
    let o = data;
    for (const k of keys.slice(0, -1)) o = o[k] ??= {};
    if (v === null || v === undefined) delete o[keys[keys.length - 1]];
    else o[keys[keys.length - 1]] = JSON.parse(JSON.stringify(v));
    this.store.write(data);
  }
  session(code: string) {
    return this.at(`sessions/${code}`);
  }

  client(uid: string): Backend {
    const db = this;
    const canWrite = (p: string, v: any) => {
      const [, code, kind, id] = p.split('/');
      const s = db.session(code);
      const active = s && s.expiresAt > db.now();
      if (!CODE_RE.test(code)) return false;
      if (kind === 'remotes') return id === uid && !!active;
      if (kind === 'commands') return v === null ? s?.owner === uid : !!(active && s.remotes?.[uid] && v.uid === uid && parseCommand(v));
      if (!kind) return v === null ? s?.owner === uid : v.owner === uid && (!s || !active || s.owner === uid);
      return s?.owner === uid;
    };
    const canRead = (p: string) => {
      const [, code] = p.split('/');
      const s = db.session(code);
      return !s || s.expiresAt < db.now() || s.owner === uid || !!s.remotes?.[uid];
    };
    const watch = (fire: () => void) => {
      fire();
      return db.store.subscribe(fire);
    };
    let n = 0;
    return {
      uid,
      now: db.now,
      get: async (p) => (canRead(p) ? db.at(p) : denied()),
      set: async (p, v) => (canWrite(p, v) ? db.write(p, v) : denied()),
      update: async (p, v) => {
        for (const [k, x] of Object.entries(v)) if (!canWrite(`${p}/${k}`, x)) return denied();
        for (const [k, x] of Object.entries(v)) db.write(`${p}/${k}`, x);
      },
      remove: async (p) => (canWrite(p, null) ? db.write(p, null) : denied()),
      push: async (p, v) => {
        const key = `${Date.now().toString(36)}${uid.slice(0, 4)}${n++}`;
        if (!canWrite(`${p}/${key}`, v)) return denied();
        db.write(`${p}/${key}`, v);
        return key;
      },
      transaction: async (p, fn) => {
        if (!canRead(p)) return denied();
        const next = fn(db.at(p) ?? null);
        if (next === undefined) return { committed: false };
        if (!canWrite(p, next)) return denied();
        db.write(p, next);
        return { committed: true };
      },
      onValue: (p, cb) => {
        let last = '∅';
        return watch(() => {
          const v = canRead(p) ? db.at(p) ?? null : null;
          const j = JSON.stringify(v);
          if (j !== last) (last = j), cb(v);
        });
      },
      onChildAdded: (p, cb) => {
        const seen = new Set<string>();
        return watch(() => {
          for (const [k, v] of Object.entries(db.at(p) ?? {})) if (!seen.has(k)) seen.add(k), cb(k, v);
        });
      },
      onConnected: (cb) => (cb(true), () => undefined),
      onDisconnectSet: () => undefined,
    };
  }
}

/** التجربة المحلية مفعّلة؟ (localhost فقط، وبإضافة ?remote=loopback) */
export const loopbackEnabled = () => /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) && new URLSearchParams(location.search).get('remote') === 'loopback';

/** معرّف ثابت لكل تبويب */
export function loopbackClient(): Backend {
  let uid = '';
  try {
    uid = sessionStorage.getItem('show-loopback-uid') ?? '';
    if (!uid) sessionStorage.setItem('show-loopback-uid', (uid = `u${Math.random().toString(36).slice(2, 10)}`));
  } catch {
    uid = `u${Math.random().toString(36).slice(2, 10)}`;
  }
  return new LoopbackDB(sharedStore()).client(uid);
}
