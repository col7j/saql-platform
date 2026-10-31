// جانب شاشة العرض: تتصل بجلسة أنشأها المحرّر بمفتاح العرض من رابطها، وتقدّمها كتنفيذ ShowSync يُضم إلى القناة المحلية.
// أوامر الجوال تصل كرسائل ShowMessage عادية (nav، goto، tour، blackout)، وحالة العرض تُنشر للجوال.
// شاشة العرض لا تعرض أي رمز. بلا رابط أو بلا إعداد Firebase أو بلا إنترنت: العرض يعمل كاملاً محلياً.
import { useEffect, useState } from 'react';
import type { RemoteInfo, ShowMessage, ShowSync } from '../sync';
import { connectFirebase, loadFirebaseConfig } from './firebase';
import { loopbackClient, loopbackEnabled } from './loopback';
import { KEY_RE, openDisplay, type Backend, type DisplaySession, type RemoteCommand, type RemoteState } from './protocol';

/** مفتاح العرض على هذا الجهاز (من رابط شاشة العرض)، بمفتاح مستقل عن مفاتيح المنصة */
export const DISPLAY_KEY = 'show-display-link';
const LINK_RE = /[?&]link=([A-Za-z0-9_-]{22})(?=$|&)/;

const store = {
  get: () => {
    try {
      const v = localStorage.getItem(DISPLAY_KEY) ?? '';
      return KEY_RE.test(v) ? v : '';
    } catch {
      return '';
    }
  },
  set: (v: string | null) => {
    try {
      v ? localStorage.setItem(DISPLAY_KEY, v) : localStorage.removeItem(DISPLAY_KEY);
    } catch {
      /* بلا تخزين: يبقى في الذاكرة لهذه الجلسة */
    }
  },
};

/** يأخذ مفتاح العرض من الرابط ويحفظه محلياً، ثم يحذفه من شريط العنوان فوراً (لا يبقى في السجل ولا يظهر) */
export function takeDisplayKey(loc: Pick<Location, 'hash' | 'pathname' | 'search'> = location, replace = (url: string) => history.replaceState(history.state, '', url)): string | null {
  const m = loc.hash.match(LINK_RE);
  if (!m) return null;
  store.set(m[1]);
  const rest = loc.hash.replace(/[?&]link=[^&]*/, '').replace(/^(#[^?&]*)&/, '$1?');
  replace(`${loc.pathname}${loc.search}${rest}`);
  return m[1];
}

/** أمر الجوال كرسالة ShowSync، فيعامله العرض كأي ريموت */
export function commandToMessage(c: RemoteCommand): ShowMessage {
  switch (c.type) {
    case 'next': return { type: 'nav', dir: 'next' };
    case 'prev': return { type: 'nav', dir: 'prev' };
    case 'tour': return { type: 'tour', action: 'toggle' };
    case 'blackout': return { type: 'blackout' };
    case 'goto': return { type: 'goto', pos: { seg: c.seg, step: 0 } };
    default: return { type: 'cue', cue: c.type };
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
    ...(m.live ? { live: JSON.parse(JSON.stringify(m.live)) } : {}),
  };
}

/** ShowSync فوق جلسة: send ينشر الحالة، وsubscribe يستقبل أوامر الجوال */
export function createRemoteSync(session: Pick<DisplaySession, 'publish' | 'onCommand'>): ShowSync {
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

/** الربط في شاشة العرض: الحالة وعدد الأجوال وقناة ShowSync. لا رمز هنا: الربط من المحرّر */
export function useRemoteDisplay(connect: () => Promise<Backend | null> = defaultConnect) {
  const [info, setInfo] = useState<RemoteInfo>(() => (takeDisplayKey(), { status: store.get() ? 'connecting' : 'unlinked', remotes: 0 }));
  const [sync, setSync] = useState<ShowSync | null>(null);
  const [round, setRound] = useState(0);

  // رابط جديد في نفس النافذة (تغيّر الجزء بعد # فقط، بلا إعادة تحميل)
  useEffect(() => {
    const on = () => takeDisplayKey() && setRound((r) => r + 1);
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  useEffect(() => {
    let alive = true;
    let retry: ReturnType<typeof setTimeout>;
    let session: DisplaySession | null = null;
    const offs: (() => void)[] = [];
    const unlink = () => {
      store.set(null);
      setSync(null);
      setInfo({ status: 'unlinked', remotes: 0 });
    };
    (async () => {
      const dk = store.get();
      if (!dk) return setInfo({ status: 'unlinked', remotes: 0 });
      setInfo({ status: 'connecting', remotes: 0 });
      try {
        const b = await connect();
        if (!alive) return;
        if (!b) return setInfo({ status: 'off', remotes: 0 });
        const s = await openDisplay(b, dk);
        if (!alive) return void s.close();
        session = s;
        setSync(createRemoteSync(s));
        setInfo({ status: 'online', remotes: 0 });
        offs.push(s.onRemotes((n) => setInfo((i) => ({ ...i, remotes: n }))));
        offs.push(b.onConnected((on) => setInfo((i) => ({ ...i, status: on ? 'online' : 'offline' }))));
        offs.push(s.onEnded(() => alive && unlink()));
      } catch (e) {
        if (!alive) return;
        // انتهت الجلسة أو الرابط غير صالح: يُنسى الرابط. وبلا إنترنت: العرض يكمل ونحاول لاحقاً
        const code = (e as { code?: string }).code;
        if (code === 'ended' || code === 'invalid') return unlink();
        setInfo((i) => ({ ...i, status: 'offline' }));
        retry = setTimeout(() => setRound((r) => r + 1), RETRY_MS);
      }
    })();
    return () => {
      alive = false;
      clearTimeout(retry);
      offs.forEach((f) => f());
      setSync(null);
      session?.close();
    };
  }, [round, connect]);

  return { info, sync };
}

async function defaultConnect(): Promise<Backend | null> {
  if (loopbackEnabled()) return loopbackClient();
  const config = await loadFirebaseConfig();
  return config ? connectFirebase(config) : null;
}
