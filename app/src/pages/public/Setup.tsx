// معالج «إعداد أول مرة»: اسم البرنامج وحساب مسؤول اللجنة التقنية (الاسم والبريد وكلمة المرور). هو الذي ينشئ بعدها القائد العام وبقية الحسابات
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isFirstRun, setupError } from '@/domain/setup';
import { act, repos, useDB, useStore } from '@/state/store';
import { Button, Card, Field, Input, Notice, Toasts } from '@/ui';

export default function Setup() {
  const db = useDB();
  const setUser = useStore((s) => s.setUser);
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [f, setF] = useState({ programName: 'صقل', name: '', email: '', password: '' });
  const err = setupError(db, f);
  if (!isFirstRun(db)) return <div className="mx-auto max-w-md p-8"><Notice>المنصة معدّة بالفعل. ادخل من صفحة الدخول.</Notice><Button className="mt-4" onClick={() => nav('/login')}>إلى الدخول</Button></div>;
  const finish = () => act(() => { const id = repos.setup.firstRun(f); setUser(id); nav('/app'); }, 'أُعدّت المنصة. أنشئ الآن حساب القائد العام من «الحسابات»');
  return (
    <div className="mx-auto flex min-h-screen max-w-lg items-center px-4">
      <Card title="إعداد أول مرة" subtitle={`الخطوة ${step} من 2`} className="w-full">
        {step === 1 ? (
          <div className="space-y-4">
            <Field label="اسم البرنامج"><Input value={f.programName} onChange={(e) => setF({ ...f, programName: e.target.value })} /></Field>
            <Button disabled={!f.programName.trim()} onClick={() => setStep(2)}>التالي</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Notice>هذا أول حساب في المنصة: مسؤول اللجنة التقنية. هو وحده ينشئ حساب القائد العام وبقية الحسابات.</Notice>
            <Field label="الاسم"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <Field label="البريد"><Input dir="ltr" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
            <Field label="كلمة المرور" hint="6 أحرف على الأقل"><Input dir="ltr" type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
            <div className="flex gap-2"><Button variant="secondary" onClick={() => setStep(1)}>السابق</Button><Button disabled={!!err} onClick={finish}>أنشئ الحساب وابدأ</Button></div>
          </div>
        )}
      </Card>
      <Toasts />
    </div>
  );
}
