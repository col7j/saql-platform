// مدخل وضع «عرض الحفل»: يُحمَّل كحزمة منفصلة خارج موجّه المنصة (انظر main.tsx).
import './show.css';
import { lazy, Suspense, useEffect, useState } from 'react';

const ShowPlayer = lazy(() => import('./ShowPlayer'));
const ShowAdmin = lazy(() => import('./ShowAdmin'));
const PreviewFrame = lazy(() => import('./PreviewFrame'));
const DemoFrame = lazy(() => import('./demo/DemoFrame'));
const ShowRemote = lazy(() => import('./remote/ShowRemote'));

type Screen = 'player' | 'admin' | 'preview' | 'demo' | 'remote';
const screenOf = (hash: string): Screen =>
  hash.startsWith('#/show-admin') ? 'admin' : hash.startsWith('#/show-remote') ? 'remote' : hash.startsWith('#/show/demo') ? 'demo' : /[?&]preview=/.test(hash) ? 'preview' : 'player';

export default function ShowRoot() {
  const [screen, setScreen] = useState(() => screenOf(window.location.hash));
  useEffect(() => {
    const on = () => setScreen(screenOf(window.location.hash));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return (
    <Suspense fallback={<div className={screen === 'admin' ? 'min-h-screen' : 'show-stage'} />}>
      {screen === 'admin' ? <ShowAdmin /> : screen === 'remote' ? <ShowRemote /> : screen === 'demo' ? <DemoFrame /> : screen === 'preview' ? <PreviewFrame /> : <ShowPlayer />}
    </Suspense>
  );
}
