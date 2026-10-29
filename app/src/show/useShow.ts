// الحالة المشتركة لشاشتي العرض والتحكم: الإعدادات وقناة التزامن
import { useEffect, useMemo, useState } from 'react';
import type { ShowConfig } from './model';
import { SHOW_KEY, loadInitialConfig, loadSavedConfig } from './storage';
import { createLocalSync, type ShowSync } from './sync';

/** قناة تزامن واحدة لكل نافذة. للانتقال إلى Firebase/Supabase يُستبدل createLocalSync هنا فقط */
export function useSync(): ShowSync {
  const sync = useMemo(() => createLocalSync(), []);
  useEffect(() => () => sync.close(), [sync]);
  return sync;
}

/** الإعدادات: تُحمَّل عند الفتح، وتُحدَّث عند الحفظ من نافذة أخرى (رسالة config أو حدث storage) */
export function useShowConfig(sync: ShowSync): [ShowConfig | null, (c: ShowConfig) => void] {
  const [cfg, setCfg] = useState<ShowConfig | null>(null);
  useEffect(() => {
    let alive = true;
    loadInitialConfig().then((c) => alive && setCfg((cur) => cur ?? c));
    const off = sync.subscribe((m) => m.type === 'config' && setCfg(m.config));
    const onStorage = (e: StorageEvent) => {
      if (e.key !== SHOW_KEY) return;
      const saved = loadSavedConfig();
      if (saved) setCfg(saved);
    };
    window.addEventListener('storage', onStorage);
    return () => {
      alive = false;
      off();
      window.removeEventListener('storage', onStorage);
    };
  }, [sync]);
  return [cfg, setCfg];
}
