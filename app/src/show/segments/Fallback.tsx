// شاشة البديل: تظهر بدل الفقرة إذا فشل ملف أو حدث خطأ، والعرض يكمل بالتنقل عادياً.
import { Component, type ReactNode } from 'react';

export function Fallback({ title, reason }: { title?: string; reason?: string }) {
  return (
    <div className="show-dark show-fade absolute inset-0 grid place-items-center text-center">
      <div>
        <img src="./brand/logo-vertical.svg" alt="صقل" className="mx-auto h-[28vh] w-auto opacity-90" draggable={false} />
        {title && <p className="mt-[4vh] text-[3.2vw] font-semibold leading-tight text-white">{title}</p>}
        {/* سبب الخطأ للمقدّم بخط صغير، لا يلفت نظر الجمهور */}
        {reason && <p className="show-chrome mt-4 text-xs text-white/40">{reason}</p>}
      </div>
    </div>
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
