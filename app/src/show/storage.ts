// تخزين إعدادات العرض بمفتاح خاص (show-config)، مستقل عن مفاتيح المنصة (saql.*) وعن DB_VERSION،
// فلا يُمسح عند رفع نسخة البيانات التجريبية ولا عند «إعادة البيانات».
import { DEFAULT_CONFIG, DEMO_SCENES, SHOW_SCHEMA_VERSION, type LegacySegment, type LegacySegmentType, type MediaRef, type Segment, type ShowConfig } from './model';
import { normalize } from './nav';
import { media, slideSettings } from './slides/sanitize';
import { migrateLegacy } from './slides/templates';

export const SHOW_KEY = 'show-config';
const LEGACY: LegacySegmentType[] = ['video', 'slides', 'names', 'blank'];

type KV = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const local = (): KV | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
};

const isObj = (v: unknown): v is Record<string, any> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, d = '') => (typeof v === 'string' ? v : d);
const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);

/** فقرة من الإصدار 1 بعد التحقق من إعداداتها */
function legacy(type: LegacySegmentType, v: Record<string, any>, id: string, title: string, order: number): LegacySegment {
  const s = isObj(v.settings) ? v.settings : {};
  switch (type) {
    case 'video':
      return { id, type, title, order, settings: { media: media(s.media), muted: bool(s.muted, false), showSkip: bool(s.showSkip, true), autoAdvance: bool(s.autoAdvance, true) } };
    case 'slides':
      return { id, type, title, order, settings: { slides: (Array.isArray(s.slides) ? s.slides : []).map(media).filter(Boolean) as MediaRef[], fit: s.fit === 'cover' ? 'cover' : 'contain' } };
    case 'names':
      return {
        id, type, title, order,
        settings: { heading: str(s.heading), names: (Array.isArray(s.names) ? s.names : []).map((n: unknown) => str(n).trim()).filter(Boolean), perStep: Math.max(1, Math.floor(Number(s.perStep) || 1)), columns: 2 },
      };
    case 'blank':
      return { id, type, title, order, settings: { variant: s.variant === 'black' ? 'black' : 'logo', caption: str(s.caption) || undefined } };
  }
}

function readSegment(v: unknown, i: number): Segment[] {
  if (!isObj(v)) throw new Error(`الفقرة ${i + 1} ليست كائناً صالحاً`);
  const type = v.type;
  const id = str(v.id) || `seg_${i}_${String(type)}`;
  const title = str(v.title) || 'فقرة';
  const order = Number.isFinite(v.order) ? v.order : i;
  if (type === 'slide') return [{ id, type, title, order, settings: slideSettings(v.settings, id) }];
  if (type === 'demo') {
    const s = isObj(v.settings) ? v.settings : {};
    // الإعدادات القديمة (خطوات بصفة القائد) تتحول إلى المشاهد الأربعة
    const scenes = (Array.isArray(s.scenes) ? s.scenes : []).filter((x: unknown, k: number, a: unknown[]) => (DEMO_SCENES as readonly unknown[]).includes(x) && a.indexOf(x) === k);
    return [{ id, type, title, order, settings: { scenes: scenes.length ? scenes : [...DEMO_SCENES] } }];
  }
  if (LEGACY.includes(type)) return migrateLegacy(legacy(type, v, id, title, order));
  throw new Error(`نوع الفقرة ${i + 1} غير معروف: ${String(type)}`);
}

/** يتحقق من ملف إعدادات (مستورد أو مخزّن) ويكمل الناقص بالقيم الافتراضية. يرمي خطأً بالعربية إن كان غير صالح */
export function parseConfig(raw: unknown): ShowConfig {
  const v = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!isObj(v) || !Array.isArray(v.segments)) throw new Error('الملف لا يحوي إعدادات عرض (segments)');
  if (Number(v.schemaVersion) > SHOW_SCHEMA_VERSION) throw new Error('الملف من نسخة أحدث من هذه الشاشة');
  const segments = normalize(v.segments.flatMap(readSegment));
  const ids = new Set<string>();
  for (const s of segments) {
    if (ids.has(s.id)) s.id = `${s.id}_${s.order}`;
    ids.add(s.id);
  }
  return { schemaVersion: SHOW_SCHEMA_VERSION, title: str(v.title, DEFAULT_CONFIG.title), theme: v.theme === 'light' ? 'light' : 'dark', segments, updatedAt: str(v.updatedAt, new Date(0).toISOString()) };
}

export function loadSavedConfig(store: KV | null = local()): ShowConfig | null {
  try {
    const raw = store?.getItem(SHOW_KEY);
    return raw ? parseConfig(raw) : null;
  } catch {
    return null;
  }
}

export function saveConfig(cfg: ShowConfig, store: KV | null = local()): ShowConfig {
  const out = { ...cfg, schemaVersion: SHOW_SCHEMA_VERSION, segments: normalize(cfg.segments), updatedAt: new Date().toISOString() };
  try {
    store?.setItem(SHOW_KEY, JSON.stringify(out));
  } catch {
    /* المساحة ممتلئة: نكمل في الذاكرة */
  }
  return out;
}

export function clearSavedConfig(store: KV | null = local()) {
  try {
    store?.removeItem(SHOW_KEY);
  } catch {
    /* تجاهل */
  }
}

export const exportConfig = (cfg: ShowConfig) => JSON.stringify({ ...cfg, segments: normalize(cfg.segments) }, null, 2);

/** show.json من المستودع (app/public/show.json)، وإلا الإعدادات المدمجة */
export async function loadRepoConfig(fetcher: typeof fetch = fetch): Promise<ShowConfig> {
  try {
    const res = await fetcher('./show.json', { cache: 'no-cache' });
    if (res.ok) return parseConfig(await res.json());
  } catch {
    /* لا يوجد ملف أو غير صالح */
  }
  return DEFAULT_CONFIG;
}

/** الترتيب: المحفوظ على الجهاز، ثم show.json، ثم المدمج */
export async function loadInitialConfig(store: KV | null = local(), fetcher?: typeof fetch): Promise<ShowConfig> {
  return loadSavedConfig(store) ?? (await loadRepoConfig(fetcher));
}
