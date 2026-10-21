// تسجيل الدخول (محاكاة: لا كلمات مرور في النموذج الأولي)
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCapabilities } from '@/domain/permissions';
import { RoleSwitcher } from '@/layout/AppShell';
import { useDB, useStore } from '@/state/store';
import { Avatar, Button, Field, Input, Notice, Toasts } from '@/ui';

export default function Login() {
  const db = useDB();
  const setUser = useStore((s) => s.setUser);
  const toast = useStore((s) => s.toast);
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const quick = ['p_lead', 's1', 's2', 's5', 'u1', 'u7', 'u3', 'u6'];

  const login = (id: string) => {
    setUser(id);
    nav('/app');
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const p = db.persons.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
    if (!p) return toast('لا يوجد حساب بهذا البريد في البيانات التجريبية', 'error');
    login(p.id);
  };

  return (
    <div className="min-h-screen bg-ink-50">
      <RoleSwitcher />
      <div className="mx-auto grid min-h-[calc(100vh-36px)] max-w-5xl items-center gap-8 px-4 py-10 md:grid-cols-2">
        <div className="hidden md:block">
          <img src="./brand/logo-vertical.svg" alt="صقل" className="h-64" />
          <p className="mt-6 text-lg leading-8 text-ink-600">المنصة الداخلية لبرنامج صقل: الرحلات، لقاءات التركيز، خطتك الشخصية، ومكتبتك المعرفية في مكان واحد.</p>
        </div>
        <div className="rounded-3xl bg-white p-6 shadow-card sm:p-8">
          <img src="./brand/logo-horizontal.svg" alt="صقل" className="mb-6 h-10 md:hidden" />
          <h1 className="text-2xl font-bold">تسجيل الدخول</h1>
          <p className="mt-1 text-sm text-ink-500">ادخل ببريدك المسجّل في البرنامج.</p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <Field label="البريد الإلكتروني">
              <Input dir="ltr" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
            </Field>
            <Field label="كلمة المرور" hint="في النموذج الأولي لا يلزم إدخال كلمة مرور">
              <Input type="password" disabled placeholder="••••••••" />
            </Field>
            <Button className="w-full" type="submit">دخول</Button>
          </form>
          <div className="mt-6">
            <Notice>للتجربة: اختر أحد الحسابات التالية، أو استخدم شريط "الدخول كـ" في الأعلى للدخول بأي شخص.</Notice>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {quick.map((id) => {
                const p = db.persons.find((x) => x.id === id)!;
                return (
                  <button key={id} onClick={() => login(id)} className="flex items-center gap-2 rounded-xl border border-ink-100 p-2 text-start hover:border-brand-300 hover:bg-brand-50">
                    <Avatar name={p.name} size={30} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{p.name}</span>
                      <span className="block truncate text-[11px] text-ink-400">{getCapabilities(db, id).labels.join('، ')}</span>
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
