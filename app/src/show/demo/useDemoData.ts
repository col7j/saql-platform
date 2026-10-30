// يعيد قراءة بيانات الديمو حين تتغير اللقطة: في هذه النافذة (المحرّر) أو في نافذة أخرى (شاشة العرض)
import { useEffect, useState } from 'react';
import { demoData, invalidateDemoData } from './data';
import { SNAPSHOT_EVENT, SNAPSHOT_KEY } from './snapshot';

export function useDemoData() {
  const [ver, setVer] = useState(0);
  useEffect(() => {
    const bump = () => (invalidateDemoData(), setVer((v) => v + 1));
    const onStorage = (e: StorageEvent) => e.key === SNAPSHOT_KEY && bump();
    window.addEventListener(SNAPSHOT_EVENT, bump);
    window.addEventListener('storage', onStorage);
    return () => (window.removeEventListener(SNAPSHOT_EVENT, bump), window.removeEventListener('storage', onStorage));
  }, []);
  return { ...demoData(), ver };
}
