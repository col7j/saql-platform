// الملف الشخصي. أول دخول للمشارك: يعبّئ ملفه ويضيف صورته وبياناته المالية (لتظهر لمسؤول المالية عند التحويل)، ثم الاستبيان العام القبلي
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { surveysForPerson } from '@/domain/workflow';
import type { Attachment } from '@/domain/types';
import { act, repos, useDB, useMe } from '@/state/store';
import { Button, Card, Field, Input, Notice, PageHeader } from '@/ui';
import { AttachmentInput } from '@/ui/attachments';

export default function ProfilePage() {
  const db = useDB();
  const me = useMe();
  const nav = useNavigate();
  const p = me.person;
  const first = me.isParticipant && !p.profileCompletedAt;
  const [f, setF] = useState({ phone: p.phone ?? '', university: p.university ?? '', major: p.major ?? '', iban: p.bank?.iban ?? '', bankName: p.bank?.bankName ?? '' });
  const [photo, setPhoto] = useState<Attachment | undefined>(p.photo);
  const [barcode, setBarcode] = useState<Attachment | undefined>(p.bank?.barcode);
  const pre = surveysForPerson(db, p.id).find((s) => s.context.kind === 'program' && s.phase === 'pre' && !s.responses.some((r) => r.personId === p.id));
  const [showIban, setShowIban] = useState(false);
  const [editing, setEditing] = useState(false);
  const ibanOk = !f.iban || /^SA\d{22}$/.test(f.iban.replace(/\s/g, '').toUpperCase());
  const [pw, setPw] = useState({ cur: '', next: '', again: '' });
  const [params] = useSearchParams();
  const savePw = () => act(() => {
    if (pw.next !== pw.again) throw new Error('تأكيد كلمة المرور لا يطابق الجديدة');
    repos.accounts.changeOwnPassword(p.id, pw.cur, pw.next);
    setPw({ cur: '', next: '', again: '' });
  }, 'تغيّرت كلمة المرور');
  const save = () => act(() => {
    repos.profile.saveOwn({
      phone: f.phone || undefined, photo,
      ...(me.isParticipant ? { university: f.university || undefined, major: f.major || undefined, bank: f.iban ? { iban: f.iban, bankName: f.bankName || undefined, barcode } : undefined } : {}),
    }, first);
    if (first) nav(pre ? '/app/surveys' : '/app');
  }, first ? 'اكتمل ملفك. أهلاً بك في صقل' : 'حُفظ ملفك');
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={first ? 'أهلاً بك في صقل: أكمل ملفك' : 'ملفي الشخصي'} subtitle={first ? 'خطوة واحدة قبل الدخول: الصورة والبيانات، ثم الاستبيان العام القبلي' : undefined} />
      {first && <div className="mb-4"><Notice>بإكمالك الملف توافق على الشروط والأحكام العامة للبرنامج، ومنها عرض اسمك وصورتك في المنصة والموقع العام ورابط الداعم.</Notice></div>}
      <div className="space-y-4">
        <Card title="البيانات">
          <div className="grid gap-3 sm:grid-cols-2">
            <AttachmentInput value={photo} onChange={setPhoto} label="صورتك الشخصية" />
            <Field label="الجوال"><Input dir="ltr" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
            {me.isParticipant && <>
              <Field label="الجامعة"><Input value={f.university} onChange={(e) => setF({ ...f, university: e.target.value })} /></Field>
              <Field label="التخصص"><Input value={f.major} onChange={(e) => setF({ ...f, major: e.target.value })} /></Field>
            </>}
          </div>
        </Card>
        {(me.isStaff || !!me.leaderOf) && (
          <Card title="البيانات المالية" subtitle="تظهر لمسؤول المالية فقط عند تحويل عهدة أو مستحق لك">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="رقم الآيبان" hint={ibanOk ? undefined : 'SA متبوعاً بـ 22 رقماً'}>
                <div className="flex gap-2">
                  <Input dir="ltr" type={showIban ? 'text' : 'password'} placeholder="SA00 0000 0000 0000 0000 0000" value={showIban || editing ? f.iban : maskIban(f.iban)} onFocus={() => setEditing(true)} onChange={(e) => setF({ ...f, iban: e.target.value })} />
                  <Button variant="secondary" onClick={() => setShowIban(!showIban)}>{showIban ? 'أخفِ' : 'أظهر'}</Button>
                </div>
              </Field>
              <Field label="البنك"><Input value={f.bankName} onChange={(e) => setF({ ...f, bankName: e.target.value })} /></Field>
              <div className="sm:col-span-2"><AttachmentInput value={barcode} onChange={setBarcode} label="باركود البنك (اختياري)" /></div>
            </div>
          </Card>
        )}
        <Button onClick={save} disabled={!ibanOk}>{first ? 'احفظ وتابع' : 'احفظ'}</Button>
        <Card title="الأمان" subtitle="تغيير كلمة المرور: 6 أحرف على الأقل ومختلفة عن الحالية">
          <div id="security" className={params.get('tab') === 'security' ? 'rounded-xl ring-2 ring-brand-200' : ''}>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="الحالية"><Input type="password" autoComplete="current-password" value={pw.cur} onChange={(e) => setPw({ ...pw, cur: e.target.value })} /></Field>
              <Field label="الجديدة"><Input type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></Field>
              <Field label="تأكيد الجديدة"><Input type="password" autoComplete="new-password" value={pw.again} onChange={(e) => setPw({ ...pw, again: e.target.value })} /></Field>
            </div>
            <div className="mt-3"><Button variant="secondary" disabled={!pw.cur || !pw.next} onClick={savePw}>غيّر كلمة المرور</Button></div>
          </div>
        </Card>
      </div>
    </div>
  );
}

/** الآيبان مخفي جزئياً: أول 4 وآخر 4 */
function maskIban(v: string) {
  const c = v.replace(/\s/g, '');
  return c.length > 8 ? `${c.slice(0, 4)}${'•'.repeat(c.length - 8)}${c.slice(-4)}` : c;
}
