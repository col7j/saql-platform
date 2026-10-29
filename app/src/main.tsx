import './show/guard'; // أولاً: في نوافذ العرض يمنع أي كتابة في مخزن المنصة قبل تحميلها
import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { isShowHash } from './show/guard';
import './index.css';

// وضع «عرض الحفل» (#/show و#/show-admin) حزمة منفصلة خارج موجّه المنصة
const ShowRoot = lazy(() => import('./show/ShowRoot'));
const showMode = isShowHash(window.location.hash);
// popstate يسبق hashchange ويلتقطه موجّه المنصة (يحوّل المسار المجهول إلى /)، فنسجّل قبله
const switchMode = () => {
  if (isShowHash(window.location.hash) !== showMode) window.location.reload();
};
window.addEventListener('popstate', switchMode);
window.addEventListener('hashchange', switchMode);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {showMode ? (
      <Suspense fallback={null}>
        <ShowRoot />
      </Suspense>
    ) : (
      <App />
    )}
  </React.StrictMode>,
);
