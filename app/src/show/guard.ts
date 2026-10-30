// حارس القراءة فقط: في نوافذ العرض لا يُكتب شيء في مخزن المنصة (مفاتيح saql.*).
// يُركَّب قبل تحميل المنصة (أول استيراد في main.tsx) فيشمل حتى توليد البيانات التجريبية عند أول تحميل.

export const PLATFORM_PREFIX = 'saql.';
export const isShowHash = (hash: string) => /^#\/show(-admin|-remote)?(?=$|[/?])/.test(hash);

interface StorageProto {
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;
}

const guarded = new WeakSet<object>();

/** يمنع الكتابة والحذف لمفاتيح المنصة على هذا المخزن (بالنموذج الأولي Storage.prototype في المتصفح) */
export function guardPlatformWrites(proto: StorageProto) {
  if (guarded.has(proto)) return;
  guarded.add(proto);
  const { setItem, removeItem } = proto;
  proto.setItem = function (key: string, value: string) {
    if (String(key).startsWith(PLATFORM_PREFIX)) return;
    return setItem.call(this, key, value);
  };
  proto.removeItem = function (key: string) {
    if (String(key).startsWith(PLATFORM_PREFIX)) return;
    return removeItem.call(this, key);
  };
  proto.clear = function () {
    /* clear يمسح بيانات المنصة أيضاً، فلا يُسمح به في نوافذ العرض */
  };
}

if (typeof window !== 'undefined' && typeof Storage !== 'undefined' && isShowHash(window.location.hash)) {
  guardPlatformWrites(Storage.prototype);
}
