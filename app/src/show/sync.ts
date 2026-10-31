// طبقة التزامن بين شاشة التحكم وشاشة العرض. الشاشات لا تعرف إلا الواجهة ShowSync،
// فاستبدال BroadcastChannel بـ Firebase أو Supabase لاحقاً يكون بكتابة تنفيذ جديد لها فقط.
import type { ShowConfig } from './model';
import type { Pos } from './nav';

export type ShowMessage =
  | { type: 'config'; config: ShowConfig } // الأدمن حفظ إعدادات جديدة
  | { type: 'goto'; pos: Pos } // الأدمن ينقل العرض
  | { type: 'nav'; dir: 'next' | 'prev' } // ريموت من الأدمن
  | { type: 'state'; pos: Pos; started: boolean; paused?: boolean; blackout?: boolean; outline?: OutlineItem[]; steps?: number; remote?: RemoteInfo; live?: LiveInfo } // العرض يبلّغ حالته
  | { type: 'cue'; cue: Cue } // أوامر فقرات الحفل: تلميح، كشف، تخطي، تدشين، مؤقت الصورة، تخطي الفيديو
  | { type: 'timing'; action: 'reset' | 'toggle' } // ساعة الحفل
  | { type: 'tour'; action: 'toggle' | 'play' | 'pause' } // تشغيل جولة الديمو أو إيقافها
  | { type: 'blackout' } // الشاشة السوداء (تبديل)
  | { type: 'hello' }; // نافذة فُتحت وتطلب الحالة

export const CUES = ['hint', 'reveal', 'skip', 'launch', 'photo', 'skipVideo'] as const;
export type Cue = (typeof CUES)[number];

/** ما تعرفه شاشة العرض عن اللحظة الحالية، للمحرّر والجوال فقط (لا يظهر شيء منه على شاشة العرض) */
export interface LiveInfo {
  /** وصف الخطوة: «5 من 35 · كُشف»، «جهة 2 من 4»… */
  sub?: string;
  /** الفيديو الجاري: الثانية الحالية والمدة */
  video?: { t: number; d: number };
  /** جدول الحفل: الفقرات بمددها المخططة والزمن الفعلي (ملّي ثانية) والفقرة الحالية */
  agenda?: { title: string; minutes: number; spent: number }[];
  agendaAt?: number;
  clock?: { running: boolean; startedAt: number | null; at: number };
  /** التدشين: 0 انتظار، 1 الحركة، 2 تم */
  launch?: number;
}

export interface OutlineItem {
  title: string;
  type: import('./model').SegmentType;
}
/** حالة الربط كما تراها شاشة العرض. unlinked: لم تُفتح من رابط المحرّر (تعمل محلياً فقط)، off: لا إعداد Firebase */
export type RemoteStatus = 'off' | 'unlinked' | 'connecting' | 'online' | 'offline';
export interface RemoteInfo {
  status: RemoteStatus;
  remotes: number;
}

/** ضم قناتين: ما يُرسل يذهب لكلتيهما، وما يصل من أي منهما يصل للمشتركين */
export function combineSync(...all: ShowSync[]): ShowSync {
  return {
    send: (m) => all.forEach((s) => s.send(m)),
    subscribe: (cb) => {
      const offs = all.map((s) => s.subscribe(cb));
      return () => offs.forEach((off) => off());
    },
    close: () => all.forEach((s) => s.close()),
  };
}

export interface ShowSync {
  send(msg: ShowMessage): void;
  subscribe(cb: (msg: ShowMessage) => void): () => void;
  /** يغلق الاتصال، ويُفتح من جديد تلقائياً عند أول استخدام بعده */
  close(): void;
}

export const SYNC_CHANNEL = 'saql-show';

interface Transport {
  post(m: ShowMessage): void;
  close(): void;
}

/** تزامن على نفس الجهاز: BroadcastChannel، وإلا حدث storage كبديل للمتصفحات القديمة */
export function createLocalSync(channel = SYNC_CHANNEL): ShowSync {
  const subs = new Set<(m: ShowMessage) => void>();
  const emit = (m: ShowMessage) => subs.forEach((cb) => cb(m));
  let t: Transport | null = null;

  const open = (): Transport => {
    if (t) return t;
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(channel);
      bc.onmessage = (e) => emit(e.data as ShowMessage);
      return (t = { post: (m) => bc.postMessage(m), close: () => bc.close() });
    }
    const key = `show-sync:${channel}`;
    const onStorage = (e: StorageEvent) => {
      if (e.key === key && e.newValue) emit(JSON.parse(e.newValue).m);
    };
    window.addEventListener('storage', onStorage);
    return (t = {
      post: (m) => {
        try {
          localStorage.setItem(key, JSON.stringify({ m, t: Date.now() + Math.random() }));
        } catch {
          /* تجاهل */
        }
      },
      close: () => window.removeEventListener('storage', onStorage),
    });
  };

  return {
    send: (m) => open().post(m),
    subscribe: (cb) => {
      open();
      subs.add(cb);
      return () => subs.delete(cb);
    },
    close: () => {
      t?.close();
      t = null;
    },
  };
}
