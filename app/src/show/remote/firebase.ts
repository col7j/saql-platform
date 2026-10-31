// تنفيذ Backend فوق Firebase Realtime Database مع تسجيل دخول مجهول.
// يُحمَّل عند الحاجة فقط (import ديناميكي)، فالعرض بلا إعداد Firebase أو بلا إنترنت لا يتأثر.
import type { Backend } from './protocol';

export interface FirebaseConfig {
  apiKey: string;
  authDomain?: string;
  databaseURL: string;
  projectId: string;
  appId: string;
  [k: string]: unknown;
}

/** إعداد Firebase العام من public/show-firebase.json (ليس سراً: يحميه تسجيل الدخول وقواعد الأمان). غيابه = لا تحكم من الجوال */
export async function loadFirebaseConfig(fetcher: typeof fetch = fetch): Promise<FirebaseConfig | null> {
  try {
    const res = await fetcher('./show-firebase.json', { cache: 'no-cache' });
    if (!res.ok) return null;
    const c = await res.json();
    return c && typeof c === 'object' && ['apiKey', 'databaseURL', 'projectId', 'appId'].every((k) => typeof c[k] === 'string' && c[k]) ? (c as FirebaseConfig) : null;
  } catch {
    return null;
  }
}

let backend: Promise<Backend> | null = null;

/** اتصال واحد لكل نافذة: تهيئة التطبيق، دخول مجهول، وقاعدة البيانات */
export function connectFirebase(config: FirebaseConfig): Promise<Backend> {
  backend ??= (async () => {
    const [{ initializeApp }, { getAuth, signInAnonymously }, db] = await Promise.all([import('firebase/app'), import('firebase/auth'), import('firebase/database')]);
    const app = initializeApp(config, 'saql-show');
    const auth = getAuth(app);
    const { user } = await signInAnonymously(auth);
    const database = db.getDatabase(app, config.databaseURL);
    let offset = 0;
    db.onValue(db.ref(database, '.info/serverTimeOffset'), (s) => (offset = Number(s.val()) || 0));
    const r = (p: string) => db.ref(database, p);
    const b: Backend = {
      uid: user.uid,
      now: () => Date.now() + offset,
      get: (p) => db.get(r(p)).then((s) => s.val()),
      set: (p, v) => db.set(r(p), v),
      update: (p, v) => db.update(r(p), v),
      remove: (p) => db.remove(r(p)),
      push: (p, v) => db.push(r(p), v).then((x) => x.key ?? ''),
      transaction: (p, fn) => db.runTransaction(r(p), fn, { applyLocally: false }).then((t) => ({ committed: t.committed })),
      // انتهاء الصلاحية (حُذفت الجلسة) يُبلَّغ كقيمة فارغة
      onValue: (p, cb) => db.onValue(r(p), (s) => cb(s.val()), () => cb(null)),
      onChildAdded: (p, cb) => db.onChildAdded(r(p), (s) => cb(s.key ?? '', s.val())),
      onConnected: (cb) => db.onValue(r('.info/connected'), (s) => cb(s.val() === true)),
      onDisconnectSet: (p, v) => void db.onDisconnect(r(p)).set(v),
    };
    return b;
  })();
  backend.catch(() => (backend = null));
  return backend;
}
