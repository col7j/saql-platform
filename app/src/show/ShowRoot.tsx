// مدخل وضع «عرض الحفل»: يُحمَّل كحزمة منفصلة خارج موجّه المنصة (انظر main.tsx).
import { lazy, Suspense, useEffect, useState } from 'react';

const ShowPlayer = lazy(() => import('./ShowPlayer'));
const ShowAdmin = lazy(() => import('./ShowAdmin'));
const PreviewFrame = lazy(() => import('./PreviewFrame'));

type Screen = 'player' | 'admin' | 'preview';
const screenOf = (hash: string): Screen => (hash.startsWith('#/show-admin') ? 'admin' : /[?&]preview=/.test(hash) ? 'preview' : 'player');

export default function ShowRoot() {
  const [screen, setScreen] = useState(() => screenOf(window.location.hash));
  useEffect(() => {
    const on = () => setScreen(screenOf(window.location.hash));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return (
    <Suspense fallback={<div className={screen === 'admin' ? 'min-h-screen bg-ink-50' : 'fixed inset-0 bg-black'} />}>
      {screen === 'admin' ? <ShowAdmin /> : screen === 'preview' ? <PreviewFrame /> : <ShowPlayer />}
    </Suspense>
  );
}
