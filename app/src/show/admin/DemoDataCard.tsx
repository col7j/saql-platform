// بطاقة «بيانات الديمو» في المحرّر: التقاط بيانات المنصة الفعلية (للقراءة فقط)، والمعاينة،
// واختيار المشارك الذي يُعرض الديمو بمنظوره، والتحذير إن عُرضت البيانات التجريبية. لا يظهر شيء منها على شاشة العرض.
import { useEffect, useState } from 'react';
import { Button, Icons, Notice, Select } from '@/ui';
import { demoGaps } from '../demo/data';
import { captureSnapshot, clearSnapshot, loadSnapshotStatus, notifySnapshotChanged, participantsOf, saveSnapshot, summarize, SNAPSHOT_EVENT, type DemoSnapshot } from '../demo/snapshot';
import { useDemoData } from '../demo/useDemoData';
import { toast } from './MediaPicker';

const fmtDate = (iso: string) => (iso ? new Date(iso).toLocaleString('ar-SA-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' }) : '');

/** حالة اللقطة المحفوظة، وتتحدث مع كل تغيير في هذه النافذة أو غيرها */
export function useSnapshotStatus() {
  const [status, setStatus] = useState(loadSnapshotStatus);
  useEffect(() => {
    const on = () => setStatus(loadSnapshotStatus());
    window.addEventListener(SNAPSHOT_EVENT, on);
    window.addEventListener('storage', on);
    return () => (window.removeEventListener(SNAPSHOT_EVENT, on), window.removeEventListener('storage', on));
  }, []);
  return status;
}

function persist(s: DemoSnapshot) {
  try {
    saveSnapshot(s);
  } catch {
    toast('تعذّر حفظ اللقطة على هذا الجهاز (المساحة ممتلئة؟)', 'error');
    return false;
  }
  notifySnapshotChanged();
  return true;
}

export function DemoDataCard() {
  const status = useSnapshotStatus();
  const data = useDemoData();
  const snap = status.state === 'ok' ? status.snapshot : null;

  const capture = () => {
    let s: DemoSnapshot;
    try {
      s = captureSnapshot(snap?.participantId);
    } catch (e) {
      toast((e as Error).message, 'error');
      return;
    }
    if (persist(s)) toast(s.origin === 'platform' ? 'التُقطت بيانات المنصة' : 'التُقطت البيانات الافتراضية: لا بيانات محفوظة للمنصة في هذا المتصفح');
  };

  const gaps = demoGaps(data);
  const people = snap ? participantsOf(snap.db) : [];
  const groupOf = (id: string) => snap?.db.groups.find((g) => g.memberIds.includes(id))?.name;
  const n = snap ? summarize(snap.db) : null;

  return (
    <div className="space-y-3 rounded-xl border border-ink-100 p-3" data-demo-data>
      <div className="flex items-center gap-2">
        <Icons.Database className="h-4 w-4 text-brand-700" />
        <h4 className="flex-1 text-sm font-semibold text-ink-900">بيانات الديمو</h4>
        {snap && <Button size="sm" variant="secondary" icon={<Icons.RefreshCw className="h-4 w-4" />} onClick={capture}>إعادة الالتقاط</Button>}
      </div>

      {!snap && (
        <Notice tone="orange" icon={<Icons.TriangleAlert className="h-4 w-4" />}>
          <b>الديمو يعرض البيانات التجريبية</b>
          <span className="block text-xs">
            {status.state === 'stale'
              ? `اللقطة المحفوظة${status.capturedAt ? ` (${fmtDate(status.capturedAt)})` : ''} من نسخة أقدم من بيانات المنصة، فلا تُستخدم. أعد الالتقاط.`
              : 'لم تُلتقط بيانات المنصة بعد. افتح المنصة في هذا المتصفح بالبيانات التي تريد عرضها، ثم التقطها هنا.'}
          </span>
        </Notice>
      )}
      {!snap && <Button icon={<Icons.Camera className="h-4 w-4" />} onClick={capture}>التقاط بيانات الديمو</Button>}

      {snap && n && (
        <>
          <ul className="grid grid-cols-3 gap-2 text-center">
            {[['مشاركون', n.participants], ['مجموعات', n.groups], ['رحلات', n.trips]].map(([l, v]) => (
              <li key={l} className="rounded-lg bg-ink-50 py-1.5">
                <b className="block text-base text-ink-900 num">{v}</b>
                <span className="text-[11px] text-ink-500">{l}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-ink-500">
            التُقطت <span className="num">{fmtDate(snap.capturedAt)}</span>
            {snap.origin === 'default' && ' من البيانات الافتراضية (لم تُحفظ بيانات للمنصة في هذا المتصفح)'}
          </p>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-ink-700">الديمو بمنظور</span>
            <Select
              value={snap.participantId}
              onChange={(e) => persist({ ...snap, participantId: e.target.value })}
              options={people.map((p) => ({ value: p.id, label: groupOf(p.id) ? `${p.name} · ${groupOf(p.id)}` : p.name }))}
            />
          </label>
        </>
      )}

      {gaps.length > 0 && (
        <Notice tone="orange" icon={<Icons.TriangleAlert className="h-4 w-4" />}>
          <span className="text-xs font-semibold">قد يظهر في الجولة:</span>
          <ul className="mt-1 list-disc space-y-0.5 ps-4 text-xs">{gaps.map((g) => <li key={g}>{g}</li>)}</ul>
        </Notice>
      )}

      <p className="text-[11px] leading-relaxed text-ink-500">
        تُقرأ بيانات المنصة في هذا المتصفح للقراءة فقط، وتُحذف منها الجوالات والإيميلات والبيانات البنكية والمالية والسجلات. تنتقل مع «تصدير العرض كاملاً» فقط، ولا تدخل في show.json ولا تُرسل للريموت. بعد تغيير الأسماء في المنصة أعد الالتقاط.
      </p>
      {snap && (
        <button className="text-xs text-bad-700 hover:underline" onClick={() => (clearSnapshot(), notifySnapshotChanged())}>
          حذف اللقطة والرجوع للبيانات التجريبية
        </button>
      )}
    </div>
  );
}
