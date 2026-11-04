// مدخل حفل ختام «بيئات التطوع 2026»: وضع العرض نفسه (#/show و#/show-admin و#/show-remote) بفقرات الحفل وهويته،
// بلا منصة «صقل» ولا بياناتها. ملف التعريف (المفاتيح ومسار Firebase والترويسة) في bia2026.html.
import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { registerExt, registerPresets } from '@/show/ext';
import { KINDS } from './kinds';
import { PRESETS } from './defaults';
import '@/index.css';
import './bia.css';

registerExt(...KINDS);
registerPresets(...PRESETS);

const ShowRoot = lazy(() => import('@/show/ShowRoot'));
// الرابط بلا مسار: شاشة العرض
if (!window.location.hash.startsWith('#/show')) window.location.replace('#/show');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Suspense fallback={null}>
      <ShowRoot />
    </Suspense>
  </React.StrictMode>,
);
