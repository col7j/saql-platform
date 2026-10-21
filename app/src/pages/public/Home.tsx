// الموقع العام التعريفي (قسم 17): لا ترتيب ولا نقاط ولا رابط متابعة
import { Link } from 'react-router-dom';
import { RoleSwitcher } from '@/layout/AppShell';
import { useDB, useStore } from '@/state/store';
import { Icons, Toasts } from '@/ui';

const pillarIcons = [Icons.Hammer, Icons.Compass, Icons.Target, Icons.MapPinned];

export function PublicHeader() {
  const userId = useStore((s) => s.userId);
  return (
    <header className="sticky top-[36px] z-30 border-b border-ink-100 bg-white/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/"><img src="./brand/logo-horizontal.svg" alt="صقل" className="h-10" /></Link>
        <nav className="hidden items-center gap-6 text-sm text-ink-600 md:flex">
          <a href="#about" className="hover:text-brand-600">عن البرنامج</a>
          <a href="#journey" className="hover:text-brand-600">رحلة المشارك</a>
          <a href="#faq" className="hover:text-brand-600">الأسئلة الشائعة</a>
        </nav>
        <Link to={userId ? '/app' : '/login'} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          {userId ? 'دخول المنصة' : 'تسجيل الدخول'}
        </Link>
      </div>
    </header>
  );
}

export default function PublicHome() {
  const site = useDB().settings.site;
  return (
    <div className="min-h-screen bg-white">
      <RoleSwitcher />
      <PublicHeader />
      <section className="relative overflow-hidden bg-brand-grad text-white">
        <div className="absolute -start-24 -top-24 h-80 w-80 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-32 end-0 h-96 w-96 rounded-full bg-accent-400/30 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-[1.2fr_1fr] md:py-24">
          <div>
            <span className="chip bg-white/15 text-white">المدينة المنورة · الشباب الجامعي</span>
            <h1 className="mt-4 text-5xl font-black leading-tight text-white md:text-6xl">{site.heroTitle}</h1>
            <p className="mt-4 max-w-xl text-lg leading-8 text-white/90">{site.heroSubtitle}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#about" className="rounded-xl bg-white px-5 py-2.5 font-medium text-brand-700 hover:bg-brand-50">تعرّف على البرنامج</a>
              <Link to="/login" className="rounded-xl bg-accent-grad px-5 py-2.5 font-medium text-white shadow">دخول المشاركين والفريق</Link>
            </div>
          </div>
          <div className="flex justify-center">
            <div className="rounded-[2.5rem] bg-white p-8 shadow-2xl">
              <img src="./brand/logo-vertical.svg" alt="" className="h-56 w-56 object-contain" />
            </div>
          </div>
        </div>
      </section>

      <section id="about" className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-10 md:grid-cols-2">
          <div>
            <h2 className="text-3xl font-bold">عن البرنامج</h2>
            <p className="mt-4 whitespace-pre-line text-lg leading-9 text-ink-600">{site.about}</p>
            <p className="mt-4 rounded-2xl bg-brand-50 p-4 text-brand-800"><b>الفئة المستهدفة: </b>{site.audience}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {site.pillars.map((p, i) => {
              const I = pillarIcons[i % pillarIcons.length];
              return (
                <div key={i} className="rounded-2xl border border-ink-100 p-5 shadow-card">
                  <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-accent-50 text-accent-600"><I className="h-5 w-5" /></div>
                  <h3 className="font-bold">{p.title}</h3>
                  <p className="mt-1 text-sm leading-7 text-ink-500">{p.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="journey" className="bg-ink-50 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-3xl font-bold">رحلة المشارك</h2>
          <ol className="mt-8 grid gap-4 md:grid-cols-5">
            {site.journey.map((j, i) => (
              <li key={i} className="relative rounded-2xl bg-white p-5 shadow-card">
                <span className="num flex h-9 w-9 items-center justify-center rounded-full bg-brand-grad font-bold text-white">{i + 1}</span>
                <h3 className="mt-3 font-bold">{j.title}</h3>
                <p className="mt-1 text-sm leading-7 text-ink-500">{j.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="faq" className="mx-auto max-w-3xl px-4 py-16">
        <h2 className="text-3xl font-bold">الأسئلة الشائعة</h2>
        <div className="mt-6 space-y-3">
          {site.faq.map((f, i) => (
            <details key={i} className="group rounded-2xl border border-ink-100 p-4 open:bg-brand-50/40">
              <summary className="cursor-pointer list-none font-medium">{f.q}</summary>
              <p className="mt-2 text-ink-600">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="border-t border-ink-100 py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 text-sm text-ink-500">
          <img src="./brand/logo-horizontal.svg" alt="صقل" className="h-9" />
          <span>للتواصل: {site.contactEmail}</span>
        </div>
      </footer>
      <Toasts />
    </div>
  );
}
