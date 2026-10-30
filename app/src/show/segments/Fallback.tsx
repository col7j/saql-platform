// الخلفية المشتركة، وشاشة البديل: تظهر بدل الفقرة إذا فشل ملف، بأسلوب شاشة عنوان لا رسالة خطأ.
import { Component, type ReactNode } from 'react';

export const LOGO_ONDARK = './brand/logo-vertical-ondark.svg';
export const LOGO_MARK = './brand/logo-icon.svg';

/** التدرّج العميق مع التوهّج خلف العنصر الرئيسي */
export function Backdrop({ children, glow = true }: { children?: ReactNode; glow?: boolean }) {
  return (
    <div className="show-bg">
      {glow && <div className="show-glow" />}
      {children}
    </div>
  );
}

export function Fallback({ title, reason }: { title?: string; reason?: string }) {
  return (
    <Backdrop>
      <div className="show-center">
        {/* شاشة عنوان الفقرة نفسها، والشعار في زاويته الثابتة */}
        <div className="flex flex-col items-center gap-[4vh]">
          <h1 className="show-title show-in" style={{ ['--i' as string]: 0 }}>{title || 'برنامج صقل'}</h1>
          <div className="show-rule show-in" style={{ ['--i' as string]: 1 }} />
        </div>
      </div>
      {/* سبب الخطأ للمقدّم فقط: يظهر مع حركة الفأرة ويختفي معها */}
      {reason && <p className="show-chrome absolute bottom-[4vh] left-0 right-0 text-center text-sm text-white/45">{reason}</p>}
    </Backdrop>
  );
}

export class SegmentBoundary extends Component<{ title: string; children: ReactNode }, { error?: string }> {
  state: { error?: string } = {};
  static getDerivedStateFromError(e: Error) {
    return { error: e.message || 'خطأ غير متوقع' };
  }
  render() {
    return this.state.error ? <Fallback title={this.props.title} reason={this.state.error} /> : this.props.children;
  }
}
