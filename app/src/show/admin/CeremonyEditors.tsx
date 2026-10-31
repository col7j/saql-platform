// محرّرات فقرات الحفل في لوحة الخصائص: «من أنا؟»، شبكة الأسماء، الاتفاقيات، التدشين، الصورة الجماعية،
// وحقل «بداية فقرة في جدول الحفل» لأي شريحة. الأسماء تُسحب من لقطة المنصة، والمعلومات تبقى في show-config فقط.
import { useRef, useState } from 'react';
import { Button, Icons, Input, Notice, Select, Textarea, Toggle, cx } from '@/ui';
import type { AgreementParty, AgreementsSettings, LaunchSettings, PhotoSettings, RosterSettings, Section, Segment, WhoAmISettings, WhoEntry } from '../model';
import { demoData } from '../demo/data';
import { participantsOf } from '../demo/snapshot';
import { newId } from '../slides/templates';
import { activeEntries, mergeEntries, parseCsv, parsePasted, shuffled } from '../ceremony/logic';
import { MediaPicker, toast } from './MediaPicker';

/** أشخاص المنصة من اللقطة (أو البيانات التجريبية إن لم تُلتقط) */
function platformPeople() {
  const { db, source } = demoData();
  const groupOf = (id: string) => db.groups.find((g) => g.memberIds.includes(id))?.name;
  const participants = participantsOf(db).map((p) => ({ personId: p.id, name: p.name, group: groupOf(p.id) }));
  const staff = db.persons.filter((p) => p.kind === 'staff').map((p) => ({ name: p.name, role: p.title }));
  return { participants, staff, source };
}

const SourceNote = ({ source }: { source: 'snapshot' | 'seed' }) =>
  source === 'seed' ? (
    <Notice tone="orange" icon={<Icons.TriangleAlert className="h-4 w-4" />}>
      <span className="text-xs">لا توجد لقطة لبيانات المنصة: الأسماء ستُسحب من البيانات التجريبية. التقط البيانات أولاً من فقرة «ديمو المنصة».</span>
    </Notice>
  ) : null;

// ───────────── جدول الحفل ─────────────

export function SectionField({ seg, onChange }: { seg: Segment; onChange: (s: Section | undefined) => void }) {
  const s = seg.section;
  return (
    <div className="space-y-2 rounded-xl border border-ink-100 p-3" data-section-field>
      <Toggle checked={!!s} onChange={(v) => onChange(v ? { title: seg.title, minutes: 5 } : undefined)} label={<span className="text-sm">تبدأ فقرة في جدول الحفل</span>} />
      {s && (
        <div className="flex items-center gap-2">
          <Input value={s.title} onChange={(e) => onChange({ ...s, title: e.target.value })} className="!min-h-0 flex-1 !py-1 text-sm" aria-label="اسم الفقرة في الجدول" />
          <input type="number" dir="ltr" min={0} max={600} className="input !min-h-0 w-16 !py-1 text-left text-sm num" value={s.minutes} onChange={(e) => onChange({ ...s, minutes: Math.max(0, Math.min(600, +e.target.value || 0)) })} aria-label="المدة بالدقائق" />
          <span className="text-xs text-ink-500">د</span>
        </div>
      )}
      <p className="text-[11px] text-ink-500">المدد للمنظمين فقط: تظهر هنا وفي «التشغيل» والجوال، ولا تظهر على شاشة العرض.</p>
    </div>
  );
}

// ───────────── «من أنا؟» ─────────────

function EntryRow({ e, i, n, onChange, onMove, onDelete }: { e: WhoEntry; i: number; n: number; onChange: (e: WhoEntry) => void; onMove: (d: -1 | 1) => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <li className={cx('rounded-xl border p-2', e.skip ? 'border-ink-100 opacity-50' : e.fact ? 'border-ink-100' : 'border-accent-100 bg-accent-50/40')} data-who-entry>
      <div className="flex items-center gap-1.5">
        <span className="w-6 text-center text-xs text-ink-400 num">{i + 1}</span>
        <button className="min-w-0 flex-1 truncate text-start text-sm font-medium text-ink-900" onClick={() => setOpen((v) => !v)}>
          {e.name || 'بلا اسم'}
          {e.group && <span className="ms-1.5 text-xs font-normal text-ink-500">{e.group}</span>}
          {!e.fact && <span className="ms-1.5 text-xs font-normal text-accent-700">بلا معلومة</span>}
        </button>
        <button className="p-1 text-ink-400 hover:text-ink-900 disabled:opacity-30" disabled={i === 0} onClick={() => onMove(-1)} title="أعلى"><Icons.ChevronUp className="h-3.5 w-3.5" /></button>
        <button className="p-1 text-ink-400 hover:text-ink-900 disabled:opacity-30" disabled={i === n - 1} onClick={() => onMove(1)} title="أسفل"><Icons.ChevronDown className="h-3.5 w-3.5" /></button>
        <button className={cx('p-1', e.skip ? 'text-brand-700' : 'text-ink-400 hover:text-ink-900')} onClick={() => onChange({ ...e, skip: !e.skip || undefined })} title={e.skip ? 'إعادته للعرض' : 'تخطيه'}><Icons.EyeOff className="h-3.5 w-3.5" /></button>
        <button className="p-1 text-ink-400 hover:text-bad-600" onClick={onDelete} title="حذف"><Icons.X className="h-3.5 w-3.5" /></button>
      </div>
      {open && (
        <div className="mt-2 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Input value={e.name} onChange={(x) => onChange({ ...e, name: x.target.value })} placeholder="الاسم" className="!min-h-0 !py-1 text-sm" />
            <Input value={e.group ?? ''} onChange={(x) => onChange({ ...e, group: x.target.value || undefined })} placeholder="المجموعة" className="!min-h-0 !py-1 text-sm" />
          </div>
          <Textarea rows={2} value={e.fact} onChange={(x) => onChange({ ...e, fact: x.target.value })} placeholder="المعلومة الغريبة أو الطريفة" className="text-sm" />
          <Textarea rows={2} value={e.hints.join('\n')} onChange={(x) => onChange({ ...e, hints: x.target.value.split('\n') })} placeholder="تلميحات إضافية (سطر لكل تلميح، اختيارية)" className="text-sm" />
          <MediaPicker value={e.photo} onChange={(m) => onChange({ ...e, photo: m })} accept="image/*" placeholder="الصورة (اختيارية)" />
        </div>
      )}
    </li>
  );
}

export function WhoAmIEditor({ s, patch }: { s: WhoAmISettings; patch: (p: Partial<WhoAmISettings>) => void }) {
  const [paste, setPaste] = useState('');
  const csv = useRef<HTMLInputElement>(null);
  const { source } = demoData();
  const set = (entries: WhoEntry[]) => patch({ entries: entries.map((e) => ({ ...e, hints: e.hints.map((h) => h.trimStart()) })) });
  const pull = () => {
    const { participants } = platformPeople();
    set(mergeEntries(s.entries, participants, () => newId('who')));
    toast(`سُحب ${participants.length} مشاركاً من ${source === 'snapshot' ? 'لقطة المنصة' : 'البيانات التجريبية'}`);
  };
  const active = activeEntries(s).length;
  return (
    <div className="space-y-3">
      <Input value={s.heading} onChange={(e) => patch({ heading: e.target.value })} className="!min-h-0 !py-1.5" aria-label="عنوان شاشة البداية" />
      <SourceNote source={source} />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" icon={<Icons.Users className="h-4 w-4" />} onClick={pull}>سحب الأسماء من المنصة</Button>
        <Button size="sm" variant="secondary" icon={<Icons.Shuffle className="h-4 w-4" />} disabled={s.entries.length < 2} onClick={() => set(shuffled(s.entries))}>خلط</Button>
        <Button size="sm" variant="secondary" icon={<Icons.Upload className="h-4 w-4" />} onClick={() => csv.current?.click()}>CSV</Button>
        <input
          ref={csv}
          type="file"
          accept=".csv,text/csv,text/plain"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            const rows = parseCsv(await f.text(), () => newId('who'));
            set([...s.entries, ...rows]);
            toast(`أُضيف ${rows.length} من «${f.name}»`);
          }}
        />
      </div>
      <p className="text-xs text-ink-500 num">{active} في العرض من {s.entries.length}. التالي يكشف ثم ينتقل، و«تلميح» (H) يعرض التلميح التالي، و«تخطي» (S).</p>
      <ol className="max-h-[42vh] space-y-1.5 overflow-y-auto">
        {s.entries.map((e, i) => (
          <EntryRow
            key={e.id}
            e={e}
            i={i}
            n={s.entries.length}
            onChange={(x) => set(s.entries.map((y) => (y.id === e.id ? x : y)))}
            onMove={(d) => {
              const a = [...s.entries];
              [a[i], a[i + d]] = [a[i + d], a[i]];
              set(a);
            }}
            onDelete={() => set(s.entries.filter((y) => y.id !== e.id))}
          />
        ))}
      </ol>
      <details className="rounded-xl border border-ink-100 p-2">
        <summary className="cursor-pointer text-sm text-ink-700">إضافة سريعة أو لصق قائمة</summary>
        <Textarea rows={4} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={'سطر لكل مشارك: الاسم - المعلومة | تلميح | تلميح\nأو المعلومة وحدها'} className="mt-2 text-sm" />
        <Button size="sm" className="mt-2" disabled={!paste.trim()} onClick={() => (set([...s.entries, ...parsePasted(paste, () => newId('who'))]), setPaste(''))}>أضف</Button>
      </details>
      <p className="text-[11px] text-ink-500">الأسماء والمعلومات تُحفظ في هذا المتصفح وتنتقل مع «تصدير العرض كاملاً» فقط، ولا تدخل في تصدير JSON ولا في المستودع.</p>
    </div>
  );
}

// ───────────── شبكة الأسماء ─────────────

export function RosterEditor({ s, patch }: { s: RosterSettings; patch: (p: Partial<RosterSettings>) => void }) {
  const { source } = demoData();
  const pull = (src: RosterSettings['source']) => {
    const { participants, staff } = platformPeople();
    const people = src === 'staff' ? staff.map((p) => ({ name: p.name, ...(p.role ? { role: p.role } : {}) })) : participants.map((p) => ({ name: p.name, ...(p.group ? { group: p.group } : {}) }));
    patch({ source: src, people });
    toast(`سُحب ${people.length} اسماً`);
  };
  return (
    <div className="space-y-3">
      <Input value={s.heading} onChange={(e) => patch({ heading: e.target.value })} className="!min-h-0 !py-1.5" aria-label="العنوان" />
      <SourceNote source={source} />
      <Select value={s.source} onChange={(e) => pull(e.target.value as RosterSettings['source'])} options={[{ value: 'participants', label: 'المشاركون بمجموعاتهم' }, { value: 'staff', label: 'فريق العمل بصفاتهم' }]} />
      <div className="flex items-center gap-2">
        <Button size="sm" variant="secondary" icon={<Icons.RefreshCw className="h-4 w-4" />} onClick={() => pull(s.source)}>تحديث الأسماء من المنصة</Button>
      </div>
      <label className="flex items-center gap-2 text-sm text-ink-700">
        أسماء في الصفحة
        <input type="number" dir="ltr" min={1} max={60} className="input !min-h-0 w-20 !py-1 text-left num" value={s.perPage} onChange={(e) => patch({ perPage: Math.max(1, Math.min(60, +e.target.value || 35)) })} />
      </label>
      <p className="text-xs text-ink-500 num">{s.people.length} اسماً · {Math.max(1, Math.ceil(s.people.length / s.perPage))} صفحة. الشبكة تتوزع تلقائياً (35 ← 7×5)، ولكل مجموعة لون.</p>
      <ul className="max-h-[36vh] space-y-0.5 overflow-y-auto text-sm text-ink-700">
        {s.people.map((p, i) => (
          <li key={i} className="flex gap-2">
            <span className="w-6 text-xs text-ink-400 num">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate">{p.name}</span>
            <span className="text-xs text-ink-500">{p.group ?? p.role}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ───────────── الاتفاقيات ─────────────

export function AgreementsEditor({ s, patch }: { s: AgreementsSettings; patch: (p: Partial<AgreementsSettings>) => void }) {
  const setParty = (id: string, p: Partial<AgreementParty>) => patch({ parties: s.parties.map((x) => (x.id === id ? { ...x, ...p } : x)) });
  return (
    <div className="space-y-3">
      <Input value={s.heading} onChange={(e) => patch({ heading: e.target.value })} className="!min-h-0 !py-1.5" aria-label="عنوان الافتتاح" />
      <div className="space-y-2 rounded-xl border border-ink-100 p-3">
        <h5 className="text-xs font-semibold text-ink-500">الجمعية (الطرف الثابت)</h5>
        <Input value={s.hostName} onChange={(e) => patch({ hostName: e.target.value })} placeholder="اسم الجمعية" className="!min-h-0 !py-1 text-sm" />
        <MediaPicker value={s.hostLogo} onChange={(m) => patch({ hostLogo: m })} accept="image/*" placeholder="شعار الجمعية" />
      </div>
      <ol className="space-y-2">
        {s.parties.map((p, i) => (
          <li key={p.id} className="space-y-2 rounded-xl border border-ink-100 p-3" data-party>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-ink-500 num">الجهة {i + 1}</span>
              <div className="flex-1" />
              <button className="p-1 text-ink-400 hover:text-bad-600 disabled:opacity-30" disabled={s.parties.length <= 1} onClick={() => patch({ parties: s.parties.filter((x) => x.id !== p.id) })} title="حذف"><Icons.X className="h-3.5 w-3.5" /></button>
            </div>
            <Input value={p.name} onChange={(e) => setParty(p.id, { name: e.target.value })} placeholder="اسم الجهة" className="!min-h-0 !py-1 text-sm" />
            <Input value={p.title} onChange={(e) => setParty(p.id, { title: e.target.value })} placeholder="عنوان الاتفاقية" className="!min-h-0 !py-1 text-sm" />
            <div className="grid grid-cols-2 gap-2">
              <Input value={p.rep} onChange={(e) => setParty(p.id, { rep: e.target.value })} placeholder="اسم الممثل" className="!min-h-0 !py-1 text-sm" />
              <Input value={p.repTitle} onChange={(e) => setParty(p.id, { repTitle: e.target.value })} placeholder="صفته" className="!min-h-0 !py-1 text-sm" />
            </div>
            <MediaPicker value={p.logo} onChange={(m) => setParty(p.id, { logo: m })} accept="image/*" placeholder="شعار الجهة" />
          </li>
        ))}
      </ol>
      <Button size="sm" variant="secondary" icon={<Icons.Plus className="h-4 w-4" />} disabled={s.parties.length >= 8} onClick={() => patch({ parties: [...s.parties, { id: newId('party'), name: `الجهة ${s.parties.length + 1}`, title: 'اتفاقية تعاون', rep: '', repTitle: '' }] })}>
        جهة ({s.parties.length} من 8)
      </Button>
    </div>
  );
}

// ───────────── التدشين والصورة ─────────────

export function LaunchEditor({ s, patch }: { s: LaunchSettings; patch: (p: Partial<LaunchSettings>) => void }) {
  return (
    <div className="space-y-3">
      <Input value={s.waitTitle} onChange={(e) => patch({ waitTitle: e.target.value })} className="!min-h-0 !py-1.5" aria-label="عنوان الانتظار" />
      <Input value={s.waitSub} onChange={(e) => patch({ waitSub: e.target.value })} className="!min-h-0 !py-1.5" aria-label="نص الانتظار" />
      <Input value={s.doneTitle} onChange={(e) => patch({ doneTitle: e.target.value })} className="!min-h-0 !py-1.5" aria-label="نص بعد التدشين" />
      <label className="flex items-center gap-2 text-sm text-ink-700">
        ثم الفقرة التالية بعد
        <input type="number" dir="ltr" min={0} max={120} className="input !min-h-0 w-16 !py-1 text-left num" value={s.autoNext} onChange={(e) => patch({ autoNext: Math.max(0, Math.min(120, +e.target.value || 0)) })} />
        ثانية (0 = ينتظر)
      </label>
      <p className="text-xs leading-relaxed text-ink-500">زر «تدشين» بالضغط المطوّل ثانيتين في «التشغيل» والجوال (أو L على جهاز العرض). بعده يكمل جهاز العرض وحده بلا إنترنت: الحركة، ثم «تم التدشين»، ثم الفيديو التالي، ثم الديمو.</p>
    </div>
  );
}

export function PhotoEditor({ s, patch }: { s: PhotoSettings; patch: (p: Partial<PhotoSettings>) => void }) {
  return (
    <div className="space-y-3">
      <Input value={s.heading} onChange={(e) => patch({ heading: e.target.value })} className="!min-h-0 !py-1.5" aria-label="العنوان" />
      <Input value={s.sub} onChange={(e) => patch({ sub: e.target.value })} className="!min-h-0 !py-1.5" aria-label="النص" />
      <label className="flex items-center gap-2 text-sm text-ink-700">
        العدّ التنازلي
        <input type="number" dir="ltr" min={1} max={10} className="input !min-h-0 w-16 !py-1 text-left num" value={s.seconds} onChange={(e) => patch({ seconds: Math.max(1, Math.min(10, +e.target.value || 3)) })} />
        ثوانٍ
      </label>
      <p className="text-xs text-ink-500">المؤقت يُشغَّل من «التشغيل» أو الجوال (أو T على جهاز العرض) مع وميض كاميرا.</p>
    </div>
  );
}
