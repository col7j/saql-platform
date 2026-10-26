// الموقع العام التعريفي: أقسام بقوالب من البيانات بالترتيب، وفريق العمل بلا أرقام، والترتيب بالأسماء بعد النشر
import { Link } from 'react-router-dom';
import { RoleSwitcher } from '@/layout/AppShell';
import { useDB, useStore } from '@/state/store';
import { Toasts } from '@/ui';
import { SiteSectionView } from '@/ui/publicBlocks';

export function PublicHeader() {
  const userId = useStore((s) => s.userId);
  const sections = useDB().settings.site.sections.filter((s) => !s.hidden);
  return (
    <header className="sticky top-[36px] z-30 border-b border-ink-100 bg-white/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/"><img src="./brand/logo-horizontal.svg" alt="صقل" className="h-10" /></Link>
        <nav className="hidden items-center gap-6 text-sm text-ink-600 md:flex">
          {sections.slice(0, 4).map((s) => <a key={s.id} href={`#${s.id}`} className="hover:text-brand-600">{s.title}</a>)}
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
              <a href={`#${site.sections.find((x) => !x.hidden)?.id ?? ''}`} className="rounded-xl bg-white px-5 py-2.5 font-medium text-brand-700 hover:bg-brand-50">تعرّف على البرنامج</a>
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

      {site.sections.filter((x) => !x.hidden).map((sec, i) => (
        <section key={sec.id} id={sec.id} className={i % 2 ? 'bg-ink-50 py-14' : 'py-14'}>
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="mb-6 text-3xl font-bold">{sec.title}</h2>
            <SiteSectionView section={sec} />
          </div>
        </section>
      ))}

      <footer className="border-t border-ink-100 py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 text-sm text-ink-500">
          <img src="./brand/logo-horizontal.svg" alt="صقل" className="h-9" />
          <span>للتواصل: {site.contactEmail}</span>
          <span className="w-full text-[11px] text-ink-400">تُعرض الأسماء والصور بموافقة ضمنية ضمن الشروط والأحكام العامة للبرنامج.</span>
        </div>
      </footer>
      <Toasts />
    </div>
  );
}
