// الملف الشخصي. أول دخول للمشارك: يعبّئ ملفه ويضيف صورته وبياناته المالية (لتظهر لمسؤول المالية عند التحويل)، ثم الاستبيان العام القبلي
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
        {me.isParticipant && (
          <Card title="البيانات المالية" subtitle="تظهر لمسؤول المالية فقط عند تحويل عهدة أو مستحق لك">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="رقم الآيبان"><Input dir="ltr" placeholder="SA00 0000 0000 0000 0000 0000" value={f.iban} onChange={(e) => setF({ ...f, iban: e.target.value })} /></Field>
              <Field label="البنك"><Input value={f.bankName} onChange={(e) => setF({ ...f, bankName: e.target.value })} /></Field>
              <div className="sm:col-span-2"><AttachmentInput value={barcode} onChange={setBarcode} label="باركود البنك (اختياري)" /></div>
            </div>
          </Card>
        )}
        <Button onClick={save}>{first ? 'احفظ وتابع' : 'احفظ'}</Button>
      </div>
    </div>
  );
}
