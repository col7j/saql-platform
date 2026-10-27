// تسجيل الدخول باسم الدخول وكلمة المرور (يديرها مسؤول اللجنة التقنية). الشريط العلوي للتجربة فقط
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authenticate, passwordError } from '@/domain/accounts';
import { getCapabilities } from '@/domain/permissions';
import { DEMO_PASSWORD } from '@/data/seed-people';
import { RoleSwitcher } from '@/layout/AppShell';
import { act, repos, useDB, useStore } from '@/state/store';
import { Avatar, Button, Field, Input, Notice, Toasts } from '@/ui';

export default function Login() {
  const db = useDB();
  const setUser = useStore((s) => s.setUser);
  const toast = useStore((s) => s.toast);
  const nav = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [change, setChange] = useState<{ personId: string; next: string; confirm: string } | null>(null);
  const quick = ['p_lead', 's5', 's6', 's7', 's1', 'u1', 'u7', 'u6'];

  const login = (id: string) => {
    setUser(id);
    nav('/app');
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const r = authenticate(db, username, password);
    if ('error' in r) return toast(r.error, 'error');
    if (r.mustChangePassword) return setChange({ personId: r.personId, next: '', confirm: '' });
    login(r.personId);
  };
  const submitChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!change) return;
    const err = passwordError(change.next) ?? (change.next !== change.confirm ? 'الكلمتان غير متطابقتين' : null);
    if (err) return toast(err, 'error');
    if (act(() => repos.accounts.changeOwnPassword(change.personId, password, change.next), 'غُيّرت كلمة المرور')) login(change.personId);
  };

  return (
    <div className="min-h-screen bg-white bg-glow">
      <RoleSwitcher />
      <div className="mx-auto grid min-h-[calc(100vh-36px)] max-w-5xl items-center gap-8 px-4 py-10 md:grid-cols-2">
        <div className="hidden md:block">
          <img src="./brand/logo-vertical.svg" alt="صقل" className="h-64" />
          <p className="mt-6 text-lg leading-[1.8] text-ink-500">المنصة الداخلية لبرنامج صقل: الرحلات، لقاءات التركيز، خطتك الشخصية، ومكتبتك المعرفية في مكان واحد.</p>
        </div>
        <div className="rounded-[28px] border border-ink-100 bg-white p-6 shadow-lift sm:p-8">
          <img src="./brand/logo-horizontal.svg" alt="صقل" className="mb-6 h-10 md:hidden" />
          <h1 className="text-2xl font-bold">تسجيل الدخول</h1>
          <p className="mt-1 text-sm text-ink-500">ادخل باسم الدخول الذي سلّمه لك مسؤول اللجنة التقنية.</p>
          {change ? (
            <form onSubmit={submitChange} className="mt-6 space-y-4">
              <Notice tone="orange">كلمة المرور مؤقتة: اختر كلمة جديدة لتكمل الدخول.</Notice>
              <Field label="كلمة المرور الجديدة"><Input type="password" dir="ltr" value={change.next} onChange={(e) => setChange({ ...change, next: e.target.value })} /></Field>
              <Field label="أعد كتابتها"><Input type="password" dir="ltr" value={change.confirm} onChange={(e) => setChange({ ...change, confirm: e.target.value })} /></Field>
              <Button className="w-full" type="submit">احفظ وادخل</Button>
            </form>
          ) : (
            <form onSubmit={submit} className="mt-6 space-y-4">
              <Field label="اسم الدخول">
                <Input dir="ltr" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="leader" autoComplete="username" />
              </Field>
              <Field label="كلمة المرور" hint="نسيتها؟ يعيد تعيينها مسؤول اللجنة التقنية">
                <Input type="password" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
              </Field>
              <Button className="w-full" type="submit">ادخل</Button>
            </form>
          )}
          <div className="mt-6">
            <Notice>للتجربة: اسم الدخول هو أول البريد (مثل leader أو s6 أو u1) وكلمة المرور <b dir="ltr">{DEMO_PASSWORD}</b>. أو اختر حساباً مما يلي، أو استخدم شريط "الدخول كـ" في الأعلى.</Notice>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {quick.map((id) => {
                const p = db.persons.find((x) => x.id === id)!;
                return (
                  <button key={id} onClick={() => login(id)} className="flex min-h-[48px] items-center gap-2 rounded-xl border border-ink-100 p-2 text-start hover:border-brand-300 hover:bg-brand-50">
                    <Avatar name={p.name} size={30} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{p.name}</span>
                      <span className="block truncate text-xs text-ink-500">{getCapabilities(db, id).labels.join('، ')}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      <Toasts />
    </div>
  );
}
