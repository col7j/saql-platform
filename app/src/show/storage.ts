// تخزين إعدادات العرض بمفتاح خاص (show-config)، مستقل عن مفاتيح المنصة (saql.*) وعن DB_VERSION،
// فلا يُمسح عند رفع نسخة البيانات التجريبية ولا عند «إعادة البيانات».
import { DEFAULT_CONFIG, DEMO_SCENES, SHOW_SCHEMA_VERSION, defaultSettings, type MediaRef, type Segment, type SegmentType, type ShowConfig } from './model';
import { normalize } from './nav';

export const SHOW_KEY = 'show-config';
const TYPES: SegmentType[] = ['video', 'slides', 'demo', 'names', 'blank'];

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

function media(v: unknown): MediaRef | undefined {
  if (typeof v === 'string' && v) return { kind: 'url', src: v };
  if (!isObj(v)) return undefined;
  if (v.kind === 'local' && typeof v.id === 'string') return { kind: 'local', id: v.id, name: str(v.name) || undefined };
  if (typeof v.src === 'string' && v.src) return { kind: 'url', src: v.src };
  return undefined;
}

function segment(v: unknown, i: number): Segment {
  if (!isObj(v)) throw new Error(`الفقرة ${i + 1} ليست كائناً صالحاً`);
  const type = v.type as SegmentType;
  if (!TYPES.includes(type)) throw new Error(`نوع الفقرة ${i + 1} غير معروف: ${String(v.type)}`);
  const s = isObj(v.settings) ? v.settings : {};
  const d = defaultSettings(type) as any;
  let settings: Segment['settings'];
  switch (type) {
    case 'video':
      settings = { media: media(s.media), muted: bool(s.muted, d.muted), showSkip: bool(s.showSkip, d.showSkip), autoAdvance: bool(s.autoAdvance, d.autoAdvance) };
      break;
    case 'slides':
      settings = { slides: (Array.isArray(s.slides) ? s.slides : []).map(media).filter(Boolean) as MediaRef[], fit: s.fit === 'cover' ? 'cover' : 'contain' };
      break;
    case 'demo': {
      // الإعدادات القديمة (خطوات بصفة القائد) تتحول إلى المشاهد الأربعة
      const scenes = (Array.isArray(s.scenes) ? s.scenes : []).filter((x: unknown, i: number, a: unknown[]) => (DEMO_SCENES as readonly unknown[]).includes(x) && a.indexOf(x) === i);
      settings = { scenes: scenes.length ? scenes : [...DEMO_SCENES] };
      break;
    }
    case 'names':
      settings = {
        heading: str(s.heading),
        names: (Array.isArray(s.names) ? s.names : []).map((n: unknown) => str(n).trim()).filter(Boolean),
        perStep: Math.max(1, Math.floor(Number(s.perStep) || 1)),
        columns: ([1, 2, 3].includes(Number(s.columns)) ? Number(s.columns) : d.columns) as 1 | 2 | 3,
      };
      break;
    case 'blank':
      settings = { variant: s.variant === 'black' ? 'black' : 'logo', caption: str(s.caption) || undefined };
      break;
  }
  return { id: str(v.id) || `seg_${i}_${type}`, type, title: str(v.title) || 'فقرة', order: Number.isFinite(v.order) ? v.order : i, settings } as Segment;
}

/** يتحقق من ملف إعدادات (مستورد أو مخزّن) ويكمل الناقص بالقيم الافتراضية. يرمي خطأً بالعربية إن كان غير صالح */
export function parseConfig(raw: unknown): ShowConfig {
  const v = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!isObj(v) || !Array.isArray(v.segments)) throw new Error('الملف لا يحوي إعدادات عرض (segments)');
  if (Number(v.schemaVersion) > SHOW_SCHEMA_VERSION) throw new Error('الملف من نسخة أحدث من هذه الشاشة');
  const segments = normalize(v.segments.map(segment));
  const ids = new Set<string>();
  for (const s of segments) {
    if (ids.has(s.id)) s.id = `${s.id}_${s.order}`;
    ids.add(s.id);
  }
  return { schemaVersion: SHOW_SCHEMA_VERSION, title: str(v.title, DEFAULT_CONFIG.title), segments, updatedAt: str(v.updatedAt, new Date(0).toISOString()) };
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
