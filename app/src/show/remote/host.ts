// جانب المحرّر من الربط: ينشئ الجلسة ويحفظها على هذا الجهاز، ويعرض الرمز ورابط شاشة العرض وحالة الأجهزة.
import { useCallback, useEffect, useRef, useState } from 'react';
import { connectFirebase, loadFirebaseConfig } from './firebase';
import { loopbackClient, loopbackEnabled } from './loopback';
import { createSession, KEY_RE, resumeSession, type Backend, type HostLink, type HostSession, type HostStatus } from './protocol';

/** الجلسة الحالية على جهاز المحرّر (مفتاح مستقل عن مفاتيح المنصة) */
export const HOST_KEY = 'show-link-host';

const saved = {
  get: (): HostLink | null => {
    try {
      const v = JSON.parse(localStorage.getItem(HOST_KEY) ?? 'null');
      return v && KEY_RE.test(v.key) && KEY_RE.test(v.displayKey) && typeof v.code === 'string' ? v : null;
    } catch {
      return null;
    }
  },
  set: (v: HostLink | null) => {
    try {
      v ? localStorage.setItem(HOST_KEY, JSON.stringify(v)) : localStorage.removeItem(HOST_KEY);
    } catch {
      /* بلا تخزين: تبقى الجلسة ما دام المحرّر مفتوحاً */
    }
  },
};

/** رابط شاشة العرض: نفس الموقع، ومفتاح العرض بعد #/show (لا يُرسل للخادم، وتحذفه الشاشة فور فتحها) */
export function displayUrl(displayKey: string, loc: Pick<Location, 'origin' | 'pathname' | 'search'> = location) {
  const q = new URLSearchParams(loc.search);
  const keep = q.get('remote') === 'loopback' ? '?remote=loopback' : '';
  return `${loc.origin}${loc.pathname}${keep}#/show?link=${displayKey}`;
}

export type HostPhase = 'loading' | 'off' | 'none' | 'active' | 'error';

export function useHostLink(connect: () => Promise<Backend | null> = defaultConnect) {
  const [phase, setPhase] = useState<HostPhase>('loading');
  const [link, setLink] = useState<HostLink | null>(null);
  const [status, setStatus] = useState<HostStatus>({ remotes: 0, displays: 0, online: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const backend = useRef<Backend | null>(null);
  const session = useRef<HostSession | null>(null);
  const offStatus = useRef<() => void>(() => undefined);

  const attach = useCallback((s: HostSession) => {
    offStatus.current();
    session.current = s;
    setLink(s.link());
    saved.set(s.link());
    offStatus.current = s.onStatus(setStatus);
    setPhase('active');
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const b = await connect();
        if (!alive) return;
        if (!b) return setPhase('off');
        backend.current = b;
        const prev = saved.get();
        const s = prev ? await resumeSession(b, prev) : null;
        if (!alive) return;
        if (s) attach(s);
        else (saved.set(null), setPhase('none'));
      } catch {
        if (alive) (setPhase('error'), setError('تعذّر الاتصال بالإنترنت'));
      }
    })();
    return () => {
      alive = false;
      offStatus.current();
    };
  }, [connect, attach]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message || 'تعذّر الاتصال');
    } finally {
      setBusy(false);
    }
  };

  return {
    phase,
    link,
    status,
    busy,
    error,
    create: () => run(async () => {
      if (backend.current) attach(await createSession(backend.current));
    }),
    renewCode: () => run(async () => {
      const s = session.current;
      if (s) (await s.renewCode(), attach(s));
    }),
    disconnectAll: () => run(async () => {
      const s = session.current;
      if (s) (await s.disconnectAll(), attach(s));
    }),
    end: () => run(async () => {
      const s = session.current;
      if (!s) return;
      await s.end();
      offStatus.current();
      session.current = null;
      saved.set(null);
      setLink(null);
      setStatus({ remotes: 0, displays: 0, online: false });
      setPhase('none');
    }),
  };
}

async function defaultConnect(): Promise<Backend | null> {
  if (loopbackEnabled()) return loopbackClient();
  const config = await loadFirebaseConfig();
  return config ? connectFirebase(config) : null;
}
