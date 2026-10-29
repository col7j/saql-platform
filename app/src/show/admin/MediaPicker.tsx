// اختيار وسيط: مسار في public/show-media، أو رفع محلي إلى IndexedDB على هذا الجهاز
import { useRef, useState } from 'react';
import { Badge, Button, Icons, Input } from '@/ui';
import { useStore } from '@/state/store';
import { putLocalFile } from '../media';
import type { MediaRef } from '../model';

export const fmtSize = (b: number) => (b > 1e6 ? `${(b / 1e6).toFixed(1)} م.ب` : `${Math.ceil(b / 1e3)} ك.ب`);
export const toast = (text: string, tone: 'ok' | 'error' = 'ok') => useStore.getState().toast(text, tone);

export function MediaPicker({ value, onChange, accept, placeholder }: { value?: MediaRef; onChange: (m?: MediaRef) => void; accept: string; placeholder: string }) {
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const upload = async (f?: File) => {
    if (!f) return;
    setBusy(true);
    try {
      onChange(await putLocalFile(f));
      toast(`رُفع «${f.name}» (${fmtSize(f.size)}) على هذا الجهاز`);
    } catch {
      toast('تعذّر حفظ الملف على هذا الجهاز (المساحة ممتلئة؟)', 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-2">
      {value?.kind === 'local' ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-ink-200 bg-ink-50 px-3.5 py-2 text-sm">
          <Icons.HardDrive className="h-4 w-4 text-ink-400" />
          <span className="min-w-0 flex-1 truncate">{value.name ?? value.id}</span>
          <Badge tone="orange">على هذا الجهاز فقط</Badge>
          <Button size="sm" variant="ghost" onClick={() => onChange(undefined)}>إزالة</Button>
        </div>
      ) : (
        <Input dir="ltr" className="text-left" value={value?.src ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value.trim() ? { kind: 'url', src: e.target.value.trim() } : undefined)} />
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" disabled={busy} icon={<Icons.Upload className="h-4 w-4" />} onClick={() => file.current?.click()}>
          {busy ? 'جارٍ الرفع…' : 'رفع من الجهاز'}
        </Button>
        <input ref={file} type="file" accept={accept} hidden onChange={(e) => (upload(e.target.files?.[0]), (e.target.value = ''))} />
      </div>
    </div>
  );
}
