// جانب شاشة العرض: يفتح جلسة التحكم من الجوال ويقدّمها كتنفيذ ShowSync يُضم إلى القناة المحلية.
// أوامر الجوال تصل كرسائل ShowMessage عادية (nav، goto، tour، blackout)، وحالة العرض تُنشر للجوال.
// بلا إعداد Firebase أو بلا إنترنت: العرض يعمل كاملاً، ويُعاد المحاولة بهدوء.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RemoteInfo, ShowMessage, ShowSync } from '../sync';
import { connectFirebase, loadFirebaseConfig } from './firebase';
import { loopbackClient, loopbackEnabled } from './loopback';
import { openSession, type Backend, type DisplaySession, type RemoteCommand, type RemoteState } from './protocol';

/** أمر الجوال كرسالة ShowSync، فيعامله العرض كأي ريموت */
export function commandToMessage(c: RemoteCommand): ShowMessage {
  switch (c.type) {
    case 'next': return { type: 'nav', dir: 'next' };
    case 'prev': return { type: 'nav', dir: 'prev' };
    case 'tour': return { type: 'tour', action: 'toggle' };
    case 'blackout': return { type: 'blackout' };
    case 'goto': return { type: 'goto', pos: { seg: c.seg, step: 0 } };
  }
}

/** حالة العرض للجوال من رسالة state (ولا يُرسل للخادم غيرها: لا إعدادات ولا ملفات) */
export function messageToState(m: ShowMessage): RemoteState | null {
  if (m.type !== 'state' || !m.outline) return null;
  const item = m.outline[m.pos.seg];
  return {
    seg: m.pos.seg,
    step: m.pos.step,
    steps: m.steps ?? 1,
    started: m.started,
    paused: !!m.paused,
    blackout: !!m.blackout,
    title: item?.title ?? '',
    outline: m.outline,
  };
}

/** ShowSync فوق جلسة: send ينشر الحالة، وsubscribe يستقبل أوامر الجوال */
export function createRemoteSync(session: DisplaySession): ShowSync {
  const subs = new Set<(m: ShowMessage) => void>();
  let off: (() => void) | null = null;
  let last = '';
  return {
    send(m) {
      const st = messageToState(m);
      if (!st) return;
      const json = JSON.stringify(st);
      if (json === last) return;
      last = json;
      session.publish(st).catch(() => (last = ''));
    },
    subscribe(cb) {
      subs.add(cb);
      off ??= session.onCommand((c) => subs.forEach((s) => s(commandToMessage(c))));
      return () => {
        subs.delete(cb);
        if (!subs.size) off?.(), (off = null);
      };
    },
    close() {
      off?.();
      off = null;
    },
  };
}

const RETRY_MS = 15000;

/** الجلسة في شاشة العرض: الرمز، والحالة، وعدد الأجوال، وقناة ShowSync لها */
export function useRemoteDisplay(connect: () => Promise<Backend | null> = defaultConnect) {
  const [info, setInfo] = useState<RemoteInfo>({ status: 'connecting', remotes: 0 });
  const [sync, setSync] = useState<ShowSync | null>(null);
  const session = useRef<DisplaySession | null>(null);
  const backend = useRef<Backend | null>(null);
  const [round, setRound] = useState(0);

  useEffect(() => {
    let alive = true;
    let retry: ReturnType<typeof setTimeout>;
    const offs: (() => void)[] = [];
    (async () => {
      try {
        const b = backend.current ?? (await connect());
        if (!alive) return;
        if (!b) return setInfo({ status: 'off', remotes: 0 });
        backend.current = b;
        const s = await openSession(b);
        if (!alive) return void s.close().catch(() => undefined);
        session.current = s;
        setSync(createRemoteSync(s));
        setInfo({ status: 'online', code: s.code, remotes: 0 });
        offs.push(s.onRemotes((n) => setInfo((i) => ({ ...i, remotes: n }))));
        offs.push(b.onConnected((on) => setInfo((i) => ({ ...i, status: on ? 'online' : 'offline' }))));
      } catch {
        // بلا إنترنت أو تعذّر الدخول: العرض يكمل، ونحاول لاحقاً
        if (!alive) return;
        setInfo((i) => ({ ...i, status: 'offline' }));
        retry = setTimeout(() => setRound((r) => r + 1), RETRY_MS);
      }
    })();
    return () => {
      alive = false;
      clearTimeout(retry);
      offs.forEach((f) => f());
    };
  }, [round, connect]);

  /** رمز جديد: يغلق الجلسة الحالية فينفصل كل جوال متصل */
  const renew = useCallback(async () => {
    const old = session.current;
    session.current = null;
    setSync(null);
    setInfo((i) => ({ ...i, status: 'connecting', code: undefined, remotes: 0 }));
    await old?.close().catch(() => undefined);
    setRound((r) => r + 1);
  }, []);

  return { info, sync, renew };
}

async function defaultConnect(): Promise<Backend | null> {
  if (loopbackEnabled()) return loopbackClient();
  const config = await loadFirebaseConfig();
  return config ? connectFirebase(config) : null;
}
