// لوحة «الربط» في المحرّر: الربط كله من هنا، وشاشة العرض لا تعرض أي رمز.
// (أ) رمز من 6 خانات للجوال، (ب) رابط شاشة العرض مع QR وزر نسخ، وحالة الأجهزة، وتجديد الرمز وفصل الأجهزة وإنهاء الجلسة.
import { useEffect, useMemo, useState } from 'react';
import qrcode from 'qrcode-generator';
import { Button, Icons, Modal, Notice } from '@/ui';
import { displayUrl, type useHostLink } from '../remote/host';
import { toast } from './MediaPicker';

type Host = ReturnType<typeof useHostLink>;

/** QR كـ SVG بمسار واحد (يتبع لون النص، بهامش هادئ) */
function Qr({ text, size = 176 }: { text: string; size?: number }) {
  const d = useMemo(() => {
    const q = qrcode(0, 'M');
    q.addData(text);
    q.make();
    const n = q.getModuleCount();
    let path = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) path += `M${c + 4} ${r + 4}h1v1h-1z`;
    return { path, n: n + 8 };
  }, [text]);
  return (
    <svg viewBox={`0 0 ${d.n} ${d.n}`} width={size} height={size} role="img" aria-label="رمز QR لرابط شاشة العرض" className="rounded-lg bg-white text-ink-900" shapeRendering="crispEdges">
      <path d={d.path} fill="currentColor" />
    </svg>
  );
}

/** الوقت المتبقي للرمز، يتحدث كل ثانية */
function useLeft(until: number | undefined) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!until) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [until]);
  return until ? Math.max(0, until - now) : 0;
}

const mmss = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;

/** شارة الربط في رأس المحرّر */
export function LinkBadge({ host, onOpen }: { host: Host; onOpen: () => void }) {
  if (host.phase === 'off')
    return (
      <button onClick={onOpen} className="flex items-center gap-1.5 rounded-full border border-accent-100 bg-accent-50 px-2.5 py-1 text-xs text-accent-700" data-link-badge>
        <Icons.Smartphone className="h-3.5 w-3.5" /> أضف إعدادات Firebase لتفعيل الجوال
      </button>
    );
  const { remotes, online } = host.status;
  return (
    <button onClick={onOpen} className="flex items-center gap-1.5 rounded-full border border-ink-100 px-2.5 py-1 text-xs text-ink-700 hover:bg-ink-50" data-link-badge>
      <Icons.Smartphone className="h-3.5 w-3.5" />
      {host.phase === 'active' ? (
        <>
          الربط
          <span className={online ? 'text-ok-700' : 'text-ink-400'}>· العرض {online ? 'متصل' : 'غير متصل'}</span>
          <span className="num">· {remotes} جوال</span>
        </>
      ) : (
        'الربط بالجوال'
      )}
    </button>
  );
}

export function LinkPanel({ host, open, onClose }: { host: Host; open: boolean; onClose: () => void }) {
  const { phase, link, status, busy, error } = host;
  const left = useLeft(link?.codeExpiresAt);
  const url = link ? displayUrl(link.displayKey) : '';
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast('نُسخ رابط شاشة العرض');
    } catch {
      toast('تعذّر النسخ، انسخ الرابط يدوياً', 'error');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="الربط: شاشة العرض والجوال">
      <div className="space-y-4 text-sm text-ink-700" data-link-panel>
        {phase === 'loading' && <p className="text-ink-500">جارٍ الاتصال…</p>}
        {phase === 'off' && <Notice tone="orange">أضف إعدادات Firebase لتفعيل الجوال: الصق قيم firebaseConfig في app/public/show-firebase.json (الخطوات في README). حتى ذلك يعمل التحكم من هذا المحرّر على نفس الجهاز.</Notice>}
        {phase === 'error' && <Notice tone="red">{error}</Notice>}
        {phase === 'none' && (
          <>
            <p>جلسة ربط واحدة تجمع شاشة العرض وأجوال التحكم. شاشة العرض لا تعرض أي رمز: تُفتح من رابط تنسخه من هنا، والجوال يدخل برمز يظهر هنا فقط.</p>
            <p className="text-xs text-ink-500">بلا ربط تبقى شاشة العرض تعمل وتُدار من هذا المحرّر على نفس الجهاز كالمعتاد.</p>
            <Button icon={<Icons.Link className="h-4 w-4" />} disabled={busy} onClick={host.create}>{busy ? 'جارٍ الإنشاء…' : 'إنشاء جلسة ربط'}</Button>
          </>
        )}
        {phase === 'active' && link && (
          <>
            <section className="rounded-xl border border-ink-100 p-3">
              <h4 className="mb-2 text-xs font-semibold text-ink-500">(أ) رمز الجوال</h4>
              <div className="flex flex-wrap items-center gap-3">
                <b className="text-4xl tracking-[.25em] text-ink-900 num" dir="ltr" data-link-code>{link.code}</b>
                <span className={left ? 'text-xs text-ink-500' : 'text-xs font-semibold text-bad-700'}>{left ? <>ينتهي بعد <span className="num">{mmss(left)}</span></> : 'انتهت صلاحية الرمز'}</span>
              </div>
              <p className="mt-1 text-xs text-ink-500">على الجوال افتح <span dir="ltr" className="font-mono">#/show-remote</span> من رابط الموقع وأدخل الرمز. الجوال المتصل يبقى متصلاً بعد انتهاء الرمز.</p>
            </section>

            <section className="rounded-xl border border-ink-100 p-3">
              <h4 className="mb-2 text-xs font-semibold text-ink-500">(ب) رابط شاشة العرض</h4>
              <div className="flex flex-wrap items-start gap-3">
                <Qr text={url} />
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="break-all rounded-lg bg-ink-50 p-2 font-mono text-[11px] text-ink-600" dir="ltr">{url}</p>
                  <Button size="sm" variant="secondary" icon={<Icons.Copy className="h-4 w-4" />} onClick={copy}>نسخ الرابط</Button>
                  <p className="text-xs text-ink-500">افتحه على جهاز العرض: تحفظ الشاشة المفتاح ثم تحذفه من شريط العنوان، ولا تعرضه.</p>
                </div>
              </div>
            </section>

            <ul className="grid grid-cols-2 gap-2 text-center text-xs">
              <li className="rounded-lg bg-ink-50 py-2">
                <b className={status.online ? 'block text-sm text-ok-700' : 'block text-sm text-ink-500'}>{status.online ? 'متصلة' : 'غير متصلة'}</b>
                شاشة العرض
              </li>
              <li className="rounded-lg bg-ink-50 py-2">
                <b className="block text-sm text-ink-900 num">{status.remotes}</b>
                جوال متصل
              </li>
            </ul>

            {error && <Notice tone="red">{error}</Notice>}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" disabled={busy} icon={<Icons.RefreshCw className="h-4 w-4" />} onClick={host.renewCode}>تجديد الرمز</Button>
              <Button size="sm" variant="secondary" disabled={busy || !status.remotes} icon={<Icons.Unplug className="h-4 w-4" />} onClick={host.disconnectAll}>فصل كل الأجهزة</Button>
              <div className="flex-1" />
              <Button size="sm" variant="secondary" disabled={busy} onClick={host.end}>إنهاء الجلسة</Button>
            </div>
            <p className="text-[11px] text-ink-500">«فصل كل الأجهزة» يفصل الأجوال ويجدّد الرمز، وتبقى شاشة العرض متصلة. «إنهاء الجلسة» يفصل الجميع، وشاشة العرض تكمل محلياً.</p>
          </>
        )}
      </div>
    </Modal>
  );
}
