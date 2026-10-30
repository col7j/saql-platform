// خادم محلي للتجربة بلا Firebase: قاعدة بيانات في الذاكرة (أو في localStorage بين تبويبات نفس المتصفح)
// تحاكي قواعد الأمان في firebase/database.rules.json في جوهرها. تستخدمها الاختبارات،
// وتجربة الريموت على نفس الجهاز بإضافة ?remote=loopback للرابط على localhost فقط.
import { KEY_RE, parseCommand, type Backend } from './protocol';

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
const SIX = /^[0-9]{6}$/;
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

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
  session(key: string) {
    return this.at(`sessions/${key}`);
  }

  /** قواعد firebase/database.rules.json للكتابة، مسار بمسار */
  canWrite(uid: string, p: string, v: any): boolean {
    const now = this.now();
    const [top, a, b, c] = p.split('/');
    if (top === 'sessions') {
      if (!KEY_RE.test(a ?? '')) return false;
      const s = this.session(a);
      const owner = s?.owner === uid;
      if (!b) {
        if (!(owner || (!s && v?.owner === uid))) return false;
        return v === null || (typeof v.owner === 'string' && (!s || v.owner === s.owner) && num(v.createdAt) && num(v.expiresAt) && v.expiresAt <= now + 43500000);
      }
      const display = !!s?.displays?.[uid];
      if (b === 'owner') return owner && v === s.owner;
      if (b === 'expiresAt') return (owner || display) && num(v) && v <= now + 43500000;
      if (b === 'online') return (owner || display) && typeof v === 'boolean';
      if (b === 'state') return (owner || display) && (v === null || (num(v.seg) && num(v.step) && 'started' in v));
      if (owner) return ['displays', 'remotes', 'commands'].includes(b);
      if (b === 'displays') return c === undefined ? false : c === uid && v != null && typeof v.via === 'string' && this.at(`displayKeys/${v.via}`)?.session === a && num(v.at);
      if (b === 'remotes') {
        if (c !== uid) return false;
        if (v === null) return true;
        const code = this.at(`codes/${v.code}`);
        return SIX.test(String(v.code)) && num(v.at) && code?.session === a && code.expiresAt > now && this.at(`claims/${v.code}/${uid}`)?.at >= code.createdAt;
      }
      if (b === 'commands') {
        if (!c) return false;
        if (v === null) return display;
        return this.at(p) === undefined && v.uid === uid && !!s?.remotes?.[uid] && s.expiresAt > now && !!parseCommand(v) && num(v.at);
      }
      return false;
    }
    if (top === 'displayKeys') {
      if (!KEY_RE.test(a ?? '') || b) return false;
      const cur = this.at(p);
      const ok = (!cur && v?.owner === uid && typeof v.session === 'string' && this.session(v.session)?.owner === uid) || (cur && cur.owner === uid && (v === null || v.owner === uid));
      return !!ok && (v === null || KEY_RE.test(String(v.session)));
    }
    if (top === 'codes') {
      if (!SIX.test(a ?? '') || b) return false;
      const cur = this.at(p);
      if (v === null) return cur?.owner === uid;
      const may = v.owner === uid && typeof v.session === 'string' && this.session(v.session)?.owner === uid && (cur?.owner === uid || ((!cur || cur.expiresAt < now) && this.at(`attempts/${uid}`)?.code === a));
      return may && num(v.createdAt) && v.createdAt <= now && v.createdAt > now - 60000 && num(v.expiresAt) && v.expiresAt <= now + 660000;
    }
    if (top === 'attempts') {
      if (a !== uid || b || v == null) return false;
      const cur = this.at(p);
      if (!SIX.test(String(v.code)) || !num(v.count) || !num(v.windowStart)) return false;
      const fresh = !cur || cur.windowStart < now - 600000;
      return fresh ? v.count === 1 && v.windowStart <= now && v.windowStart > now - 60000 : v.count === cur.count + 1 && v.count <= 5 && v.windowStart === cur.windowStart;
    }
    if (top === 'claims') {
      if (b !== uid || c || v == null) return false;
      return this.at(`attempts/${uid}`)?.code === a && this.at(`codes/${a}`)?.expiresAt > now && num(v.at) && v.at <= now && v.at > now - 60000;
    }
    return false;
  }

  /** قواعد القراءة (تسري على المسار وكل ما تحته) */
  canRead(uid: string, p: string): boolean {
    const now = this.now();
    const [top, a, b] = p.split('/');
    if (top === 'sessions') {
      const s = KEY_RE.test(a ?? '') ? this.session(a) : null;
      return !!s && (s.owner === uid || !!s.displays?.[uid] || !!s.remotes?.[uid]);
    }
    if (top === 'displayKeys') return KEY_RE.test(a ?? '');
    if (top === 'codes') {
      const cur = this.at(`codes/${a}`);
      return !!cur && (cur.owner === uid || (cur.expiresAt > now && this.at(`claims/${a}/${uid}`)?.at >= cur.createdAt));
    }
    if (top === 'attempts') return a === uid;
    if (top === 'claims') return b === uid;
    return false;
  }

  client(uid: string): Backend {
    const db = this;
    const watch = (fire: () => void) => {
      fire();
      return db.store.subscribe(fire);
    };
    let n = 0;
    return {
      uid,
      now: db.now,
      get: async (p) => (db.canRead(uid, p) ? db.at(p) ?? null : denied()),
      set: async (p, v) => (db.canWrite(uid, p, v ?? null) ? db.write(p, v) : denied()),
      update: async (p, v) => {
        for (const [k, x] of Object.entries(v)) if (!db.canWrite(uid, `${p}/${k}`, x ?? null)) return denied();
        for (const [k, x] of Object.entries(v)) db.write(`${p}/${k}`, x);
      },
      remove: async (p) => (db.canWrite(uid, p, null) ? db.write(p, null) : denied()),
      push: async (p, v) => {
        const key = `${Date.now().toString(36)}${uid.slice(0, 4)}${n++}`;
        if (!db.canWrite(uid, `${p}/${key}`, v)) return denied();
        db.write(`${p}/${key}`, v);
        return key;
      },
      transaction: async (p, fn) => {
        if (!db.canRead(uid, p)) return denied();
        const next = fn(db.at(p) ?? null);
        if (next === undefined) return { committed: false };
        if (!db.canWrite(uid, p, next)) return denied();
        db.write(p, next);
        return { committed: true };
      },
      onValue: (p, cb) => {
        let last = '∅';
        return watch(() => {
          const v = db.canRead(uid, p) ? db.at(p) ?? null : null;
          const j = JSON.stringify(v);
          if (j !== last) (last = j), cb(v);
        });
      },
      onChildAdded: (p, cb) => {
        const seen = new Set<string>();
        return watch(() => {
          if (!db.canRead(uid, p)) return;
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

/** معرّف ثابت لكل نافذة: المحرّر وشاشة العرض والجوال أجهزة مختلفة حتى في إطارات صفحة تجربة واحدة */
export function loopbackClient(): Backend {
  const role = location.hash.startsWith('#/show-admin') ? 'admin' : location.hash.startsWith('#/show-remote') ? 'remote' : 'display';
  const slot = `show-loopback-uid:${role}`;
  let uid = '';
  try {
    uid = sessionStorage.getItem(slot) ?? '';
    if (!uid) sessionStorage.setItem(slot, (uid = `u${Math.random().toString(36).slice(2, 10)}`));
  } catch {
    uid = `u${Math.random().toString(36).slice(2, 10)}`;
  }
  return new LoopbackDB(sharedStore()).client(uid);
}
