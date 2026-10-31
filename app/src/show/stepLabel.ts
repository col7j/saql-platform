// وصف الخطوة داخل الفقرة بالعربية، للمحرّر والجوال فقط (لا يظهر على شاشة العرض)
import { agreementAt, rosterPages, whoAt } from './ceremony/logic';
import { DEMO_PAGE_LABELS, DEMO_SCENE_LABELS, demoSteps, type Segment } from './model';
import { stepCount } from './nav';

export function stepSub(seg: Segment | undefined, step: number): string | undefined {
  if (!seg) return undefined;
  switch (seg.type) {
    case 'whoami': {
      const at = whoAt(seg.settings, step);
      if (at.kind === 'intro') return `شاشة البداية · ${at.total} مشاركاً`;
      if (at.kind === 'reveal') return `${at.index + 1} من ${at.total} · كُشف`;
      return `${at.index + 1} من ${at.total} · المعلومة${at.hints.length ? ` · تلميح ${at.hintsShown} من ${at.hints.length}` : ''}`;
    }
    case 'roster': {
      const n = rosterPages(seg.settings).length;
      return n > 1 ? `صفحة ${step + 1} من ${n}` : undefined;
    }
    case 'agreements': {
      const at = agreementAt(seg.settings, step);
      return at.kind === 'intro' ? 'الافتتاح' : at.kind === 'all' ? 'شبكة الشعارات' : `اتفاقية ${at.index + 1} من ${seg.settings.parties.length}`;
    }
    case 'launch': return ['شاشة الانتظار', 'حركة التدشين', 'تم التدشين'][step];
    case 'demo': {
      const d = demoSteps(seg.settings)[step];
      return d ? `${DEMO_SCENE_LABELS[d.scene]} · ${DEMO_PAGE_LABELS[d.page]}` : undefined;
    }
    default: {
      const n = stepCount(seg);
      return n > 1 ? `نقرة ${step} من ${n - 1}` : undefined;
    }
  }
}
