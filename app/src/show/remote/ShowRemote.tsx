// ريموت الجوال (#/show-remote): رمز من 6 أرقام يظهر في لوحة «الربط» في المحرّر فقط، ثم التالي والسابق،
// وإيقاف جولة الديمو، والشاشة السوداء، والانتقال لأي فقرة. حالة الاتصال ظاهرة دائماً.
// بعد الدخول يُحفظ مفتاح الجلسة على الجوال، فإعادة تحميل الصفحة تعود بلا رمز ما دام الجوال لم يُفصل.
import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Eye, Lightbulb, LogOut, MonitorOff, Pause, Play, SkipForward, Timer } from 'lucide-react';
import { LongPress, Schedule } from '../ceremony/controls';
import { fmtClock } from '../ceremony/logic';
import { markLogo } from '../segments/Fallback';
import { connectFirebase, loadFirebaseConfig } from './firebase';
import { loopbackClient, loopbackEnabled } from './loopback';
import { CODE_RE, joinWithCode, KEY_RE, rejoin, type Backend, type RemoteCommand, type RemoteSession, type RemoteState } from './protocol';
import './remote.css';

/** مفتاح الجلسة على الجوال (بعد الدخول بالرمز) */
const REMOTE_KEY = 'show-remote-key';

type Phase =
  | { kind: 'loading' }
  | { kind: 'off' }
  | { kind: 'enter'; error?: string; busy?: boolean }
  | { kind: 'joined'; session: RemoteSession };

const saved = {
  get: () => {
    try {
      const v = localStorage.getItem(REMOTE_KEY) ?? '';
      return KEY_RE.test(v) ? v : '';
    } catch {
      return '';
    }
  },
  set: (k: string | null) => {
    try {
      k ? localStorage.setItem(REMOTE_KEY, k) : localStorage.removeItem(REMOTE_KEY);
    } catch {
      /* بلا تخزين: يُطلب الرمز بعد إعادة التحميل */
    }
  },
};

export default function ShowRemote() {
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [code, setCode] = useState('');
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
          const key = saved.get();
          if (key) {
            setPhase({ kind: 'enter', busy: true });
            rejoin(b, key).then(
              (s) => alive && setPhase({ kind: 'joined', session: s }),
              (e) => {
                if (!alive) return;
                if ((e as { code?: string }).code === 'ended') saved.set(null);
                setPhase({ kind: 'enter', error: (e as { code?: string }).code === 'ended' ? 'انتهت الجلسة أو فُصل هذا الجوال. أدخل الرمز الجديد من المحرّر.' : (e as Error).message });
              },
            );
          }
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
      const s = await joinWithCode(b, c);
      saved.set(s.key);
      setCode('');
      setPhase({ kind: 'joined', session: s });
    } catch (e) {
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
          <p className="rm-note">أضف إعدادات Firebase لتفعيل الجوال (ملف show-firebase.json). خطوات الإعداد في README المشروع.</p>
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
          <label className="rm-big" htmlFor="rm-code">أدخل رمز الربط (6 أرقام) من لوحة «الربط» في المحرّر</label>
          <input
            id="rm-code"
            className="rm-code num"
            dir="ltr"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
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
            saved.set(null);
            await phase.session.leave();
            setPhase({ kind: 'enter' });
          }}
          onEnded={() => {
            saved.set(null);
            setPhase({ kind: 'enter', error: 'انتهت الجلسة أو فُصل هذا الجوال. أدخل الرمز الجديد من المحرّر.' });
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
  const nxt = st?.outline[st.seg + 1];
  const live = net && display;
  const v = st?.live?.video;
  const hasLaunch = !!st?.outline.some((o) => o.type === 'launch');
  return (
    <div className="rm-controls">
      <div className="rm-status" data-live={live}>
        <span className="rm-dot" />
        {!net ? 'انقطع اتصال الجوال، يُعاد تلقائياً' : !display ? 'شاشة العرض غير متصلة الآن' : 'متصل بالعرض'}
      </div>
      <div className="rm-now">
        <p className="rm-kicker num">{st ? `الآن على الشاشة · ${st.seg + 1} من ${st.outline.length}${st.steps > 1 ? ` · خطوة ${st.step + 1}/${st.steps}` : ''}` : '…'}</p>
        <p className="rm-big">{st ? (st.started ? cur?.title || '—' : 'لم يبدأ العرض بعد') : 'بانتظار حالة العرض…'}</p>
        {st?.live?.sub && <p className="rm-note">{st.live.sub}</p>}
        {nxt && <p className="rm-kicker">التالي: {nxt.title}</p>}
        {v && (
          <div className="rm-video">
            <div className="rm-video-bar"><div style={{ width: `${(v.t / Math.max(1, v.d)) * 100}%` }} /></div>
            <span className="num">{fmtClock(v.t * 1000)} / {fmtClock(v.d * 1000)}</span>
          </div>
        )}
      </div>
      <div className="rm-nav">
        <button className="rm-btn rm-next" disabled={!live || sending} onClick={() => send({ type: 'next' })} aria-label="التالي">
          {cur?.type === 'whoami' ? 'التالي / كشف' : 'التالي'} <ChevronLeft className="rm-ico" />
        </button>
        <button className="rm-btn rm-prev" disabled={!live || sending} onClick={() => send({ type: 'prev' })} aria-label="السابق">
          <ChevronRight className="rm-ico" /> السابق
        </button>
      </div>
      {cur?.type === 'whoami' && (
        <div className="rm-row">
          <button className="rm-btn" disabled={!live} onClick={() => send({ type: 'hint' })}><Lightbulb className="rm-ico" /> تلميح</button>
          <button className="rm-btn" disabled={!live} onClick={() => send({ type: 'reveal' })}><Eye className="rm-ico" /> كشف</button>
          <button className="rm-btn" disabled={!live} onClick={() => send({ type: 'skip' })}><SkipForward className="rm-ico" /> تخطي</button>
        </div>
      )}
      <div className="rm-row">
        {cur?.type === 'demo' && (
          <button className="rm-btn" disabled={!live} onClick={() => send({ type: 'tour' })}>
            {st?.paused ? <Play className="rm-ico" /> : <Pause className="rm-ico" />} {st?.paused ? 'شغّل الجولة' : 'أوقف الجولة'}
          </button>
        )}
        {cur?.type === 'photo' && (
          <button className="rm-btn" disabled={!live} onClick={() => send({ type: 'photo' })}><Timer className="rm-ico" /> مؤقت الصورة</button>
        )}
        {v && (
          <button className="rm-btn" disabled={!live} onClick={() => send({ type: 'skipVideo' })}><SkipForward className="rm-ico" /> تخطي الفيديو</button>
        )}
        <button className="rm-btn" data-on={!!st?.blackout} disabled={!live} onClick={() => send({ type: 'blackout' })}>
          <MonitorOff className="rm-ico" /> {st?.blackout ? 'أعد الشاشة' : 'شاشة سوداء'}
        </button>
      </div>
      {hasLaunch && (
        <LongPress label="تدشين: اضغط مطوّلاً ثانيتين" disabled={!live || (cur?.type === 'launch' && (st?.step ?? 0) > 0)} onDone={() => send({ type: 'launch' })} className="rm-btn rm-launch">
          تدشين (اضغط مطوّلاً)
        </LongPress>
      )}
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
      <details className="rm-list">
        <summary>جدول الحفل</summary>
        <div className="rm-sched-wrap">
          <Schedule
            live={st?.live}
            classes={{ root: 'rm-sched', head: 'rm-sched-head', bar: 'rm-video-bar', fill: 'rm-sched-fill', list: 'rm-sched-list', row: 'rm-sched-row', now: 'rm-sched-now', over: 'rm-over', btn: 'rm-sched-btn' }}
          />
        </div>
      </details>
      <button className="rm-leave" onClick={onLeave}>
        <LogOut className="rm-ico" /> خروج
      </button>
    </div>
  );
}
