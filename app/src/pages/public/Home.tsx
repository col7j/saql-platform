// الموقع العام التعريفي: أقسام بقوالب من البيانات بالترتيب، وفريق العمل بلا أرقام، والترتيب بالأسماء بعد النشر
import { Link } from 'react-router-dom';
import { RoleSwitcher } from '@/layout/AppShell';
import { useDB, useStore } from '@/state/store';
import { Badge, LinkButton, Toasts, TwoToneTitle } from '@/ui';
import { SiteSectionView } from '@/ui/publicBlocks';

export function PublicHeader() {
  const userId = useStore((s) => s.userId);
  const sections = useDB().settings.site.sections.filter((s) => !s.hidden);
  return (
    <header className="sticky top-[36px] z-30 border-b border-ink-100 bg-white/85 backdrop-blur">
      <div className="container-x flex items-center justify-between py-3">
        <Link to="/"><img src="./brand/logo-horizontal.svg" alt="صقل" className="h-10" /></Link>
        <nav className="hidden items-center gap-8 text-sm text-ink-600 md:flex">
          {sections.slice(0, 4).map((s) => <a key={s.id} href={`#${s.id}`} className="hover:text-brand-700">{s.title}</a>)}
        </nav>
        <LinkButton to={userId ? '/app' : '/login'} variant="primary" size="sm">{userId ? 'دخول المنصة' : 'تسجيل الدخول'}</LinkButton>
      </div>
    </header>
  );
}

export default function PublicHome() {
  const site = useDB().settings.site;
  const visible = site.sections.filter((x) => !x.hidden);
  return (
    <div className="min-h-screen bg-white">
      <RoleSwitcher />
      <PublicHeader />
      {/* البطل: خلفية بيضاء بتوهّج ناعم من الثانوي، عنوان بكلمة ملوّنة، وزر أساسي وثانوي */}
      <section className="relative overflow-hidden bg-glow">
        <div className="container-x section-y grid items-center gap-12 md:grid-cols-[1.25fr_1fr]">
          <div>
            <Badge tone="blue">المدينة المنورة · الشباب الجامعي</Badge>
            <TwoToneTitle as="h1" text={site.heroTitle} accent={site.heroAccent} className="mt-5 text-[34px] leading-[1.25] md:text-5xl lg:text-[56px] lg:leading-[1.2]" />
            <p className="mt-5 max-w-xl text-lg font-normal leading-[1.7] text-ink-500">{site.heroSubtitle}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <LinkButton to="/login" variant="primary">دخول المشاركين والفريق</LinkButton>
              <a href={`#${visible[0]?.id ?? ''}`} className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-brand-600/40 bg-white px-5 text-sm font-medium text-brand-700 transition hover:border-brand-600 hover:bg-brand-50">تعرّف على البرنامج</a>
            </div>
          </div>
          <div className="flex justify-center">
            <div className="rounded-[28px] border border-ink-100 bg-white p-10 shadow-lift">
              <img src="./brand/logo-vertical.svg" alt="" className="h-48 w-48 object-contain md:h-56 md:w-56" />
            </div>
          </div>
        </div>
      </section>

      {visible.map((sec, i) => (
        <section key={sec.id} id={sec.id} className={i % 2 ? 'bg-ink-50 section-y' : 'section-y'}>
          <div className="container-x">
            <h2 className="mb-8 text-[28px] font-bold md:text-2xl lg:text-3xl">{sec.title}</h2>
            <SiteSectionView section={sec} />
          </div>
        </section>
      ))}

      <footer className="border-t border-ink-100 py-10">
        <div className="container-x flex flex-wrap items-center justify-between gap-4 text-sm text-ink-500">
          <img src="./brand/logo-horizontal.svg" alt="صقل" className="h-9" />
          <span>للتواصل: {site.contactEmail}</span>
          <span className="w-full text-xs text-ink-500">تُعرض الأسماء والصور بموافقة ضمنية ضمن الشروط والأحكام العامة للبرنامج.</span>
        </div>
      </footer>
      <Toasts />
    </div>
  );
}
