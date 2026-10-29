// مدخل وضع «عرض الحفل»: يُحمَّل كحزمة منفصلة خارج موجّه المنصة (انظر main.tsx).
import { lazy, Suspense } from 'react';

const ShowPlayer = lazy(() => import('./ShowPlayer'));
const ShowAdmin = lazy(() => import('./ShowAdmin'));

export default function ShowRoot() {
  const admin = window.location.hash.startsWith('#/show-admin');
  return (
    <Suspense fallback={<div className={admin ? 'min-h-screen bg-ink-50' : 'fixed inset-0 bg-black'} />}>
      {admin ? <ShowAdmin /> : <ShowPlayer />}
    </Suspense>
  );
}
