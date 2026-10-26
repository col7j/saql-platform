// المرفقات الحقيقية: قراءة الملف، وبصمته (SHA-256 لمحتواه)، ومعاينة مصغّرة للصور تُحفظ في البيانات.
// مكان جاهز لقراءة الرقم التسلسلي بـ OCR لاحقاً: readSerial يعيد undefined في النموذج الأولي.
import { useState } from 'react';
import { sha256Hex } from '@/domain/crypto';
import type { Attachment } from '@/domain/types';
import { Icons } from './index';

async function hashFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  if (globalThis.crypto?.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', buf);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  return sha256Hex(String.fromCharCode(...new Uint8Array(buf)));
}

/** معاينة مصغّرة (أقصى بُعد 640px) حتى لا تمتلئ مساحة المتصفح */
function previewOf(file: File): Promise<string | undefined> {
  if (!file.type.startsWith('image/')) return Promise.resolve(undefined);
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, 640 / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.6));
    };
    img.onerror = () => resolve(undefined);
    img.src = url;
  });
}

export async function readAttachment(file: File): Promise<Attachment> {
  const [hash, preview] = await Promise.all([hashFile(file), previewOf(file)]);
  return { name: file.name, type: file.type || 'application/octet-stream', size: file.size, hash, preview };
}

/** مكان OCR: عند التحول لمنصة حقيقية يقرأ الخادم الرقم التسلسلي من الصورة */
export async function readSerial(_a: Attachment): Promise<string | undefined> {
  return undefined;
}

export function AttachmentInput({ value, onChange, label = 'المرفق (إلزامي)', onSerial }: { value?: Attachment; onChange: (a?: Attachment) => void; label?: string; onSerial?: (s: string) => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <span className="label">{label}</span>
      <input
        type="file"
        accept="image/*,.pdf"
        className="input"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return onChange(undefined);
          setBusy(true);
          const a = await readAttachment(f);
          setBusy(false);
          onChange(a);
          const serial = await readSerial(a);
          if (serial) onSerial?.(serial);
        }}
      />
      {busy && <p className="mt-1 text-xs text-ink-400">يُقرأ الملف…</p>}
      {value && !busy && <AttachmentView a={value} />}
    </div>
  );
}

export function AttachmentView({ a, compact }: { a?: Attachment; compact?: boolean }) {
  if (!a) return null;
  return (
    <span className="mt-1 inline-flex items-center gap-2 text-xs text-ink-500">
      {a.preview && !compact ? <img src={a.preview} alt={a.name} className="h-12 w-12 rounded-lg border border-ink-100 object-cover" /> : <Icons.Paperclip className="h-3.5 w-3.5 text-brand-600" />}
      <span className="max-w-[180px] truncate" title={a.name}>{a.name}</span>
      <span className="font-mono text-[10px] text-ink-300" dir="ltr" title="بصمة الملف">#{a.hash.slice(0, 8)}</span>
    </span>
  );
}
