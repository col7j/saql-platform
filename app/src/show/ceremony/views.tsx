// شاشات فقرات الحفل الخاصة على لوحة 1920×1080 بهوية البرنامج (رموز --t-* و--b-* فقط):
// «من أنا؟»، شبكة الأسماء، توقيع الاتفاقيات، التدشين، الصورة الجماعية، ومؤثرات الشرائح (قصاصات وتوهّج).
// كل شاشة تأخذ الخطوة الحالية فقط، والتنقل في nav.ts. لا تظهر أي مدة على هذه الشاشات.
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import type { AgreementsSegment, LaunchSegment, MediaRef, PhotoSegment, RosterSegment, ShowTheme, WhoAmISegment } from '../model';
import { FitStage } from '../slides/SlideView';
import { heroLogo } from '../segments/Fallback';
import { LOGOS } from '../brand/brand';
import { useMediaUrl } from '../segments/useMedia';
import { LAUNCH_ANIM_MS, agreementAt, rosterGrid, rosterGroups, rosterPages, whoAt } from './logic';
import { Confetti } from './fx';
import './ceremony.css';

export interface CeremonyProps<S> {
  seg: S;
  step: number;
  theme: ShowTheme;
  active: boolean;
  animate?: boolean;
  /** التدشين: انتهت الحركة (لتنتقل الشاشة إلى «تم التدشين») */
  onAdvance?: () => void;
  /** عدّ الصورة الجماعية: يتغير مع كل تشغيل */
  photoRun?: number;
}

/** لوحة 1920×1080 بخلفية القالب */
function Stage({ theme, children, glow = true, className }: { theme: ShowTheme; children: ReactNode; glow?: boolean; className?: string }) {
  return (
    <div className="absolute inset-0" style={{ background: 'rgb(var(--t-bg))' }}>
      <FitStage>
        {(scale) => (
          <div className={`sl-canvas cv ${className ?? ''}`} data-show-theme={theme} style={{ transform: `scale(${scale})` }}>
            <div className="show-bg">{glow && <div className="show-glow" />}</div>
            {children}
          </div>
        )}
      </FitStage>
    </div>
  );
}

function Img({ media, className, style, alt = '' }: { media?: MediaRef; className?: string; style?: CSSProperties; alt?: string }) {
  const { url } = useMediaUrl(media);
  return url ? <img src={url} alt={alt} className={className} style={style} draggable={false} /> : null;
}

const initials = (name: string) => name.trim().charAt(0);

// ───────────── «من أنا؟» ─────────────

export function WhoAmIView({ seg, step, theme }: CeremonyProps<WhoAmISegment>) {
  const at = whoAt(seg.settings, step);
  if (at.kind === 'intro') {
    return (
      <Stage theme={theme}>
        <div className="cv-center">
          <p className="cv-kicker cv-in" style={{ ['--d' as string]: '0ms' }}>فقرة التعارف</p>
          <h1 className="cv-mega cv-in" style={{ ['--d' as string]: '180ms' }}>{seg.settings.heading || 'من أنا؟'}</h1>
          <span className="cv-rule cv-wipe" style={{ ['--d' as string]: '520ms' }} />
          <p className="cv-lead cv-in" style={{ ['--d' as string]: '700ms' }}>معلومةٌ واحدة… وعليكم أن تعرفوا صاحبها</p>
        </div>
      </Stage>
    );
  }
  const counter = <p className="cv-counter num">{at.index + 1} من {at.total}</p>;
  if (at.kind === 'fact') {
    return (
      <Stage theme={theme}>
        {counter}
        <div className="cv-center">
          <p className="cv-ask cv-in" key={`q${at.index}`}>من أنا؟</p>
          <p className="cv-fact cv-in" key={`f${at.index}`} style={{ ['--d' as string]: '150ms' }}>{at.entry.fact || '…'}</p>
          {at.hintsShown > 0 && (
            <ul className="cv-hints">
              {at.hints.slice(0, at.hintsShown).map((h, i) => (
                <li key={i} className="cv-in" style={{ ['--d' as string]: i === at.hintsShown - 1 ? '0ms' : '0ms' }}>
                  <span className="cv-hint-n num">{i + 1}</span>
                  {h}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Stage>
    );
  }
  // الكشف: الشاشة تتحول إلى بطاقة الاسم بحركة سينمائية
  const e = at.entry;
  return (
    <Stage theme={theme} className="cv-reveal">
      {counter}
      <div className="cv-flash" key={`x${at.index}`} />
      <div className="cv-card" key={`c${at.index}`}>
        <div className="cv-avatar">{e.photo ? <Img media={e.photo} className="cv-photo" alt={e.name} /> : <span>{initials(e.name)}</span>}</div>
        <div className="cv-card-body">
          {e.group && <p className="cv-group">{e.group}</p>}
          <h2 className="cv-name">{e.name || '—'}</h2>
          <p className="cv-card-fact">{e.fact}</p>
        </div>
      </div>
    </Stage>
  );
}

// ───────────── شبكة الأسماء ─────────────

export function RosterView({ seg, step, theme }: CeremonyProps<RosterSegment>) {
  const s = seg.settings;
  const pages = rosterPages(s);
  const page = pages[Math.min(step, pages.length - 1)] ?? [];
  const groups = useMemo(() => rosterGroups(s.people), [s.people]);
  const tone = (g?: string) => groups.find((x) => x.name === g)?.tone;
  const { cols, rows } = rosterGrid(page.length);
  // أكبر خط يتسع للخلية (والاسم يلتف على سطرين عند الحاجة)، ولا يقل عن 30px
  const cellW = 1728 / cols;
  const cellH = 700 / rows;
  const size = Math.max(30, Math.min(64, Math.floor(Math.min(cellW / 6.2, cellH / (s.source === 'staff' ? 2.6 : 2.1)))));
  return (
    <Stage theme={theme}>
      <header className="cv-roster-head">
        <h1 className="cv-title cv-in">{s.heading}</h1>
        <span className="cv-rule cv-wipe" style={{ ['--d' as string]: '300ms' }} />
        {pages.length > 1 && <p className="cv-page num">{step + 1} / {pages.length}</p>}
      </header>
      {!page.length ? (
        <p className="cv-empty">تُسحب الأسماء من لقطة المنصة في المحرّر</p>
      ) : (
        <ol className="cv-grid" key={step} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)`, ['--fs' as string]: `${size}px` }}>
          {page.map((p, i) => (
            <li key={i} className="cv-person cv-in" data-tone={tone(p.group)} style={{ ['--d' as string]: `${400 + i * 70}ms` }}>
              <span className="cv-person-name">{p.name}</span>
              {s.source === 'staff' && p.role && <span className="cv-person-role">{p.role}</span>}
            </li>
          ))}
        </ol>
      )}
      {groups.length > 1 && s.source === 'participants' && (
        <ul className="cv-legend">
          {groups.map((g) => (
            <li key={g.name} data-tone={g.tone}>
              <span className="cv-dot" />
              {g.name}
            </li>
          ))}
        </ul>
      )}
    </Stage>
  );
}

// ───────────── توقيع الاتفاقيات ─────────────

/** شعار الجمعية، وإن لم يُرفع فشعار البرنامج (الملوّن داخل البطاقات البيضاء) */
function HostLogo({ s, theme, className, onCard }: { s: AgreementsSegment['settings']; theme: ShowTheme; className?: string; onCard?: boolean }) {
  return s.hostLogo ? <Img media={s.hostLogo} className={className} alt={s.hostName} /> : <img src={onCard ? LOGOS.vertical.color : heroLogo(theme)} className={className} alt="" draggable={false} />;
}

function PartyLogo({ p, className }: { p: { name: string; logo?: MediaRef }; className?: string }) {
  const { url } = useMediaUrl(p.logo);
  return url ? <img src={url} className={className} alt={p.name} draggable={false} /> : <span className={`${className} cv-logo-ph`}>{p.name || 'شعار الجهة'}</span>;
}

export function AgreementsView({ seg, step, theme }: CeremonyProps<AgreementsSegment>) {
  const s = seg.settings;
  const at = agreementAt(s, step);
  if (at.kind === 'intro') {
    return (
      <Stage theme={theme}>
        <div className="cv-center">
          <div className="cv-in cv-host-big" style={{ ['--d' as string]: '0ms' }}><HostLogo s={s} theme={theme} className="cv-host-img" /></div>
          {s.hostName && <p className="cv-lead cv-in" style={{ ['--d' as string]: '500ms' }}>{s.hostName}</p>}
          <span className="cv-rule cv-wipe" style={{ ['--d' as string]: '800ms' }} />
          <h1 className="cv-title cv-in" style={{ ['--d' as string]: '1000ms' }}>{s.heading}</h1>
          {s.parties.length > 0 && <p className="cv-sub cv-in num" style={{ ['--d' as string]: '1300ms' }}>مع {s.parties.length === 1 ? 'جهة واحدة' : s.parties.length === 2 ? 'جهتين' : `${s.parties.length} جهات`}</p>}
        </div>
      </Stage>
    );
  }
  if (at.kind === 'party') {
    const p = at.party;
    return (
      <Stage theme={theme}>
        <p className="cv-counter num">اتفاقية {at.index + 1} من {s.parties.length}</p>
        <div className="cv-meet" key={p.id}>
          <div className="cv-meet-logo cv-from-start"><PartyLogo p={p} className="cv-meet-img" /></div>
          <span className="cv-meet-join" />
          <div className="cv-meet-logo cv-from-end"><HostLogo s={s} theme={theme} className="cv-meet-img" onCard /></div>
        </div>
        <div className="cv-meet-text">
          <p className="cv-kicker cv-in" style={{ ['--d' as string]: '1200ms' }}>{p.name}</p>
          <h2 className="cv-title cv-in" style={{ ['--d' as string]: '1400ms' }}>{p.title || 'اتفاقية تعاون'}</h2>
          {(p.rep || p.repTitle) && <p className="cv-sub cv-in" style={{ ['--d' as string]: '1700ms' }}>{[p.rep, p.repTitle].filter(Boolean).join(' · ')}</p>}
        </div>
      </Stage>
    );
  }
  const n = s.parties.length;
  const cols = n <= 4 ? Math.max(1, n) : Math.ceil(n / 2);
  return (
    <Stage theme={theme}>
      <header className="cv-roster-head">
        <h1 className="cv-title cv-in">شركاء التعاون</h1>
        <span className="cv-rule cv-wipe" style={{ ['--d' as string]: '300ms' }} />
      </header>
      <div className="cv-host-row cv-in" style={{ ['--d' as string]: '200ms' }}><HostLogo s={s} theme={theme} className="cv-host-small" /></div>
      <ul className="cv-logos" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {s.parties.map((p, i) => (
          <li key={p.id} className="cv-logo-card cv-in" style={{ ['--d' as string]: `${500 + i * 140}ms` }}>
            <PartyLogo p={p} className="cv-logo-img" />
            <span className="cv-logo-name">{p.name}</span>
          </li>
        ))}
      </ul>
    </Stage>
  );
}

// ───────────── التدشين ─────────────

export function LaunchView({ seg, step, theme, active, onAdvance }: CeremonyProps<LaunchSegment>) {
  const s = seg.settings;
  // الحركة الانتقالية تنتهي إلى «تم التدشين» وحدها
  useEffect(() => {
    if (!active || step !== 1) return;
    const t = setTimeout(() => onAdvance?.(), LAUNCH_ANIM_MS);
    return () => clearTimeout(t);
  }, [active, step, onAdvance]);
  return (
    <Stage theme={theme} glow={step !== 1} className={`cv-launch cv-launch-${step}`}>
      {step === 0 && (
        <div className="cv-center">
          <div className="cv-orbit">
            <span className="cv-ring" />
            <span className="cv-ring cv-ring-2" />
            <img src={heroLogo(theme)} alt="" className="cv-orbit-logo" draggable={false} />
          </div>
          <h1 className="cv-title cv-in" style={{ ['--d' as string]: '300ms' }}>{s.waitTitle}</h1>
          <p className="cv-sub cv-in cv-breathe" style={{ ['--d' as string]: '600ms' }}>{s.waitSub}</p>
        </div>
      )}
      {step === 1 && (
        <div className="cv-burst">
          {Array.from({ length: 14 }, (_, i) => <span key={i} className="cv-ray" style={{ ['--a' as string]: `${(360 / 14) * i}deg`, ['--d' as string]: `${(i % 4) * 90}ms` }} />)}
          <span className="cv-shock" />
          <span className="cv-shock cv-shock-2" />
          <img src={heroLogo(theme)} alt="" className="cv-burst-logo" draggable={false} />
        </div>
      )}
      {step === 2 && (
        <>
          <Confetti />
          <div className="cv-center">
            <img src={heroLogo(theme)} alt="" className="cv-done-logo cv-in" draggable={false} />
            <span className="cv-rule cv-wipe" style={{ ['--d' as string]: '400ms' }} />
            <h1 className="cv-mega cv-in cv-done" style={{ ['--d' as string]: '600ms' }}>{s.doneTitle}</h1>
          </div>
        </>
      )}
    </Stage>
  );
}

// ───────────── الصورة الجماعية ─────────────

export function PhotoView({ seg, theme, active, photoRun = 0 }: CeremonyProps<PhotoSegment>) {
  const s = seg.settings;
  const [count, setCount] = useState<number | null>(null);
  const [flash, setFlash] = useState(0);
  useEffect(() => {
    if (!active || !photoRun) return;
    let n = s.seconds;
    setCount(n);
    const t = setInterval(() => {
      n -= 1;
      if (n <= 0) {
        clearInterval(t);
        setCount(null);
        setFlash((f) => f + 1);
      } else setCount(n);
    }, 1000);
    return () => clearInterval(t);
  }, [photoRun, active, s.seconds]);
  return (
    <Stage theme={theme}>
      <div className="cv-center">
        <div className="cv-camera cv-in">
          <span className="cv-camera-lens" />
        </div>
        <h1 className="cv-title cv-in" style={{ ['--d' as string]: '200ms' }}>{s.heading}</h1>
        <p className="cv-sub cv-in" style={{ ['--d' as string]: '400ms' }}>{s.sub}</p>
      </div>
      {count !== null && (
        <div className="cv-count" key={count}>
          <span className="num">{count}</span>
        </div>
      )}
      {flash > 0 && <div className="cv-camflash" key={`f${flash}`} />}
    </Stage>
  );
}

