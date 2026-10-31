// تخزين إعدادات العرض بمفتاح خاص (show-config)، مستقل عن مفاتيح المنصة (saql.*) وعن DB_VERSION،
// فلا يُمسح عند رفع نسخة البيانات التجريبية ولا عند «إعادة البيانات».
import { DEFAULT_CONFIG, DEMO_DEFAULTS, DEMO_SCENES, LAUNCH_DEFAULTS, PHOTO_DEFAULTS, SHOW_SCHEMA_VERSION, type AgreementParty, type LegacySegment, type LegacySegmentType, type MediaRef, type RosterPerson, type Section, type Segment, type ShowConfig, type WhoEntry } from './model';
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

const num = (v: unknown, d: number, min: number, max: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d);
const strs = (v: unknown) => (Array.isArray(v) ? v.map((x) => str(x).trim()).filter(Boolean) : []);
const list = <T,>(v: unknown, fn: (x: Record<string, any>, i: number) => T | null, max = 500): T[] =>
  (Array.isArray(v) ? v : []).slice(0, max).map((x, i) => (isObj(x) ? fn(x, i) : null)).filter((x): x is T => x !== null);

function section(v: unknown): Section | undefined {
  if (!isObj(v)) return undefined;
  return { title: str(v.title).trim() || 'فقرة', minutes: num(v.minutes, 0, 0, 600) };
}

const whoEntry = (x: Record<string, any>, i: number): WhoEntry | null => {
  const e: WhoEntry = { id: str(x.id) || `who_${i}`, name: str(x.name).trim(), fact: str(x.fact).trim(), hints: strs(x.hints).slice(0, 10) };
  if (str(x.personId)) e.personId = str(x.personId);
  if (str(x.group).trim()) e.group = str(x.group).trim();
  const photo = media(x.photo);
  if (photo) e.photo = photo;
  if (x.skip === true) e.skip = true;
  return e.name || e.fact ? e : null;
};
const rosterPerson = (x: Record<string, any>): RosterPerson | null => {
  const name = str(x.name).trim();
  if (!name) return null;
  const p: RosterPerson = { name };
  if (str(x.group).trim()) p.group = str(x.group).trim();
  if (str(x.role).trim()) p.role = str(x.role).trim();
  return p;
};
const party = (x: Record<string, any>, i: number): AgreementParty => ({
  id: str(x.id) || `party_${i}`,
  name: str(x.name).trim(),
  ...(media(x.logo) ? { logo: media(x.logo) } : {}),
  title: str(x.title).trim(),
  rep: str(x.rep).trim(),
  repTitle: str(x.repTitle).trim(),
});

/** فقرات الحفل الخاصة (غير الشرائح الحرة والديمو) */
function ceremonySegment(type: unknown, s: Record<string, any>): Pick<Segment, 'type' | 'settings'> | null {
  switch (type) {
    case 'whoami':
      return { type, settings: { heading: str(s.heading) || 'من أنا؟', entries: list(s.entries, whoEntry, 300) } };
    case 'roster':
      return { type, settings: { heading: str(s.heading) || 'المشاركون', source: s.source === 'staff' ? 'staff' : 'participants', people: list(s.people, rosterPerson, 400), perPage: num(s.perPage, 35, 1, 60) } };
    case 'agreements':
      return { type, settings: { heading: str(s.heading) || 'توقيع اتفاقيات التعاون', hostName: str(s.hostName), ...(media(s.hostLogo) ? { hostLogo: media(s.hostLogo) } : {}), parties: list(s.parties, party, 8) } };
    case 'launch':
      return { type, settings: { waitTitle: str(s.waitTitle, LAUNCH_DEFAULTS.waitTitle), waitSub: str(s.waitSub, LAUNCH_DEFAULTS.waitSub), doneTitle: str(s.doneTitle, LAUNCH_DEFAULTS.doneTitle), autoNext: num(s.autoNext, LAUNCH_DEFAULTS.autoNext, 0, 120) } };
    case 'photo':
      return { type, settings: { heading: str(s.heading, PHOTO_DEFAULTS.heading), sub: str(s.sub, PHOTO_DEFAULTS.sub), seconds: num(s.seconds, PHOTO_DEFAULTS.seconds, 1, 10) } };
  }
  return null;
}

function readSegment(v: unknown, i: number): Segment[] {
  if (!isObj(v)) throw new Error(`الفقرة ${i + 1} ليست كائناً صالحاً`);
  const out = readSegmentBody(v, i);
  const sec = section(v.section);
  return sec ? out.map((s, k) => (k === 0 ? { ...s, section: sec } : s)) : out;
}

function readSegmentBody(v: Record<string, any>, i: number): Segment[] {
  const type = v.type;
  const id = str(v.id) || `seg_${i}_${String(type)}`;
  const title = str(v.title) || 'فقرة';
  const order = Number.isFinite(v.order) ? v.order : i;
  if (type === 'slide') return [{ id, type, title, order, settings: slideSettings(v.settings, id) }];
  const c = ceremonySegment(type, isObj(v.settings) ? v.settings : {});
  if (c) return [{ id, title, order, ...c } as Segment];
  if (type === 'demo') {
    const s = isObj(v.settings) ? v.settings : {};
    // الإعدادات القديمة (خطوات بصفة القائد) تتحول إلى المشاهد الأربعة
    const scenes = (Array.isArray(s.scenes) ? s.scenes : []).filter((x: unknown, k: number, a: unknown[]) => (DEMO_SCENES as readonly unknown[]).includes(x) && a.indexOf(x) === k);
    const durations: Record<string, number> = {};
    if (isObj(s.durations)) for (const [k, v] of Object.entries(s.durations)) if (typeof v === 'number' && v >= 0 && v <= 120) durations[k] = v; // 0 = تخطّي الخطوة
    return [{ id, type, title, order, settings: {
      scenes: scenes.length ? scenes : [...DEMO_SCENES],
      autoplay: bool(s.autoplay, DEMO_DEFAULTS.autoplay),
      dwell: typeof s.dwell === 'number' && s.dwell >= 1 && s.dwell <= 120 ? s.dwell : DEMO_DEFAULTS.dwell,
      durations,
    } }];
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

/** يحذف البيانات الشخصية: أسماء المشاركين ومعلومات «من أنا؟» وشبكة الأسماء. تبقى في show-config وملف العرض الكامل فقط */
export function withoutPersonalData(cfg: ShowConfig): ShowConfig {
  return {
    ...cfg,
    segments: cfg.segments.map((s) => {
      if (s.type === 'whoami') return { ...s, settings: { ...s.settings, entries: [] } };
      if (s.type === 'roster') return { ...s, settings: { ...s.settings, people: [] } };
      return s;
    }),
  };
}

/** JSON الإعدادات. بلا personal: بلا أسماء ولا معلومات (تصدير JSON وshow.json في المستودع العلني).
 *  personal: كاملاً (داخل ملف العرض الكامل فقط) */
export const exportConfig = (cfg: ShowConfig, opts: { personal?: boolean } = {}) => {
  const c = opts.personal ? cfg : withoutPersonalData(cfg);
  return JSON.stringify({ ...c, segments: normalize(c.segments) }, null, 2);
};

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
