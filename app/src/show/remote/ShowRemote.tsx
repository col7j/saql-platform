// ريموت الجوال (#/show-remote): رمز من 4 أرقام يظهر في زاوية شاشة العرض، ثم التالي والسابق،
// وإيقاف جولة الديمو، والشاشة السوداء، والانتقال لأي فقرة. حالة الاتصال ظاهرة دائماً.
import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, LogOut, MonitorOff, Pause, Play } from 'lucide-react';
import { markLogo } from '../segments/Fallback';
import { connectFirebase, loadFirebaseConfig } from './firebase';
import { loopbackClient, loopbackEnabled } from './loopback';
import { CODE_RE, joinSession, type Backend, type RemoteCommand, type RemoteSession, type RemoteState } from './protocol';
import './remote.css';

const LAST_CODE = 'show-remote-last';

type Phase =
  | { kind: 'loading' }
  | { kind: 'off' }
  | { kind: 'enter'; error?: string; busy?: boolean }
  | { kind: 'joined'; session: RemoteSession };

const session = {
  get: () => {
    try {
      return sessionStorage.getItem(LAST_CODE) ?? '';
    } catch {
      return '';
    }
  },
  set: (c: string | null) => {
    try {
      c ? sessionStorage.setItem(LAST_CODE, c) : sessionStorage.removeItem(LAST_CODE);
    } catch {
      /* تفضيل على هذا الجهاز فقط */
    }
  },
};

export default function ShowRemote() {
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [code, setCode] = useState(session.get);
  const [net, setNet] = useState(true);
  const backend = useRef<Backend | null>(null);

  useEffect(() => {
    document.title = 'ريموت العرض · صقل';
    let alive = true;
    // التجربة المحلية (?remote=loopback على localhost) أو Firebase
    const connect = loopbackEnabled() ? Promise.resolve(true as const) : loadFirebaseConfig();
    connect.then((c) => {
      if (!alive) return;
      if (!c) return setPhase({ kind: 'off' });
      setPhase({ kind: 'enter' });
      (c === true ? Promise.resolve(loopbackClient()) : connectFirebase(c)).then(
        (b) => {
          backend.current = b;
          b.onConnected((on) => alive && setNet(on));
          if (CODE_RE.test(session.get())) join(session.get(), b);
        },
        () => alive && setNet(false),
      );
    });
    const on = () => setNet(navigator.onLine);
    window.addEventListener('online', on);
    window.addEventListener('offline', on);
    return () => {
      alive = false;
      window.removeEventListener('online', on);
      window.removeEventListener('offline', on);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const join = async (c: string, b = backend.current) => {
    if (!b) return setPhase({ kind: 'enter', error: 'لا اتصال بالإنترنت بعد، حاول بعد لحظة' });
    setPhase({ kind: 'enter', busy: true });
    try {
      const s = await joinSession(b, c);
      session.set(c);
      setPhase({ kind: 'joined', session: s });
    } catch (e) {
      session.set(null);
      setPhase({ kind: 'enter', error: (e as Error).message });
    }
  };

  return (
    <div className="rm" data-show-theme="dark">
      <header className="rm-head">
        <img src={markLogo('dark')} alt="" className="rm-logo" />
        <span className="rm-title">ريموت العرض</span>
        <span className="rm-net" data-on={net}>{net ? 'متصل بالإنترنت' : 'بلا إنترنت'}</span>
      </header>
      {phase.kind === 'loading' && <p className="rm-note">جارٍ التحميل…</p>}
      {phase.kind === 'off' && (
        <div className="rm-center">
          <p className="rm-big">التحكم من الجوال غير مُفعَّل</p>
          <p className="rm-note">يحتاج إعداد Firebase (ملف firebase-config.json). خطوات الإعداد في README المشروع.</p>
        </div>
      )}
      {phase.kind === 'enter' && (
        <form
          className="rm-center"
          onSubmit={(e) => {
            e.preventDefault();
            if (CODE_RE.test(code)) join(code);
          }}
        >
          <label className="rm-big" htmlFor="rm-code">أدخل الرمز الظاهر في زاوية شاشة العرض</label>
          <input
            id="rm-code"
            className="rm-code num"
            dir="ltr"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{4}"
            maxLength={4}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
            autoFocus
            aria-describedby="rm-err"
          />
          <button className="rm-btn rm-primary" disabled={!CODE_RE.test(code) || phase.busy}>{phase.busy ? 'جارٍ الاتصال…' : 'اتصل'}</button>
          {phase.error && <p id="rm-err" className="rm-error" role="alert">{phase.error}</p>}
        </form>
      )}
      {phase.kind === 'joined' && (
        <Controls
          s={phase.session}
          net={net}
          onLeave={async () => {
            session.set(null);
            await phase.session.leave();
            setPhase({ kind: 'enter' });
          }}
          onEnded={() => {
            session.set(null);
            setPhase({ kind: 'enter', error: 'انتهت الجلسة أو تغيّر الرمز. أدخل الرمز الجديد من شاشة العرض.' });
          }}
        />
      )}
    </div>
  );
}

function Controls({ s, net, onLeave, onEnded }: { s: RemoteSession; net: boolean; onLeave: () => void; onEnded: () => void }) {
  const [st, setSt] = useState<RemoteState | null>(null);
  const [display, setDisplay] = useState(true);
  const [sending, setSending] = useState(false);
  useEffect(() => {
    const off1 = s.onState((x) => (x ? setSt(x) : onEnded()));
    const off2 = s.onDisplayOnline(setDisplay);
    return () => (off1(), off2());
  }, [s]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = (c: RemoteCommand) => {
    navigator.vibrate?.(12);
    setSending(true);
    s.send(c).finally(() => setSending(false));
  };
  const cur = st?.outline[st.seg];
  const live = net && display;
  return (
    <div className="rm-controls">
      <div className="rm-status" data-live={live}>
        <span className="rm-dot" />
        {!net ? 'انقطع اتصال الجوال، يُعاد تلقائياً' : !display ? 'شاشة العرض غير متصلة الآن' : `متصل بالعرض · الرمز ${s.code}`}
      </div>
      <div className="rm-now">
        <p className="rm-kicker num">{st ? `الفقرة ${st.seg + 1} من ${st.outline.length}${st.steps > 1 ? ` · ${st.step + 1}/${st.steps}` : ''}` : '…'}</p>
        <p className="rm-big">{st ? (st.started ? cur?.title || '—' : 'لم يبدأ العرض بعد') : 'بانتظار حالة العرض…'}</p>
      </div>
      <div className="rm-nav">
        <button className="rm-btn rm-next" disabled={!live || sending} onClick={() => send({ type: 'next' })} aria-label="التالي">
          التالي <ChevronLeft className="rm-ico" />
        </button>
        <button className="rm-btn rm-prev" disabled={!live || sending} onClick={() => send({ type: 'prev' })} aria-label="السابق">
          <ChevronRight className="rm-ico" /> السابق
        </button>
      </div>
      <div className="rm-row">
        {cur?.type === 'demo' && (
          <button className="rm-btn" disabled={!live} onClick={() => send({ type: 'tour' })}>
            {st?.paused ? <Play className="rm-ico" /> : <Pause className="rm-ico" />} {st?.paused ? 'شغّل الجولة' : 'أوقف الجولة'}
          </button>
        )}
        <button className="rm-btn" data-on={!!st?.blackout} disabled={!live} onClick={() => send({ type: 'blackout' })}>
          <MonitorOff className="rm-ico" /> {st?.blackout ? 'أعد الشاشة' : 'شاشة سوداء'}
        </button>
      </div>
      {st && st.outline.length > 1 && (
        <details className="rm-list">
          <summary>انتقل إلى فقرة</summary>
          <ol>
            {st.outline.map((o, i) => (
              <li key={i}>
                <button className="rm-item" data-now={i === st.seg} disabled={!live} onClick={() => send({ type: 'goto', seg: i })}>
                  <span className="num">{i + 1}</span> {o.title}
                </button>
              </li>
            ))}
          </ol>
        </details>
      )}
      <button className="rm-leave" onClick={onLeave}>
        <LogOut className="rm-ico" /> خروج
      </button>
    </div>
  );
}
