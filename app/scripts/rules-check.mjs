// فحص قواعد الأمان على Firebase الحقيقي بعد نشرها: node scripts/rules-check.mjs
// يقرأ public/show-firebase.json، وينشئ مستخدمين مجهولين (محرّر، شاشة عرض، جوال، غريب، مخمّن)،
// ويجرّب ما يجب أن يُقبل وما يجب أن يُرفض عبر REST، ثم يحذف الجلسة التي أنشأها.
import { readFileSync } from 'node:fs';
import { randomBytes, randomInt } from 'node:crypto';

const cfg = JSON.parse(readFileSync(new URL('../public/show-firebase.json', import.meta.url), 'utf8'));
const DB = cfg.databaseURL.replace(/\/$/, '');
const TS = { '.sv': 'timestamp' };
const key = () => randomBytes(16).toString('base64url');
const six = () => String(randomInt(0, 1_000_000)).padStart(6, '0');

async function user() {
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${cfg.apiKey}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"returnSecureToken":true}' });
  const j = await r.json();
  if (!j.idToken) throw new Error('تعذّر إنشاء مستخدم مجهول: ' + JSON.stringify(j));
  const call = async (method, path, body) => {
    const res = await fetch(`${DB}/${path}.json?auth=${j.idToken}`, { method, body: body === undefined ? undefined : JSON.stringify(body) });
    return { ok: res.ok, val: await res.json().catch(() => null) };
  };
  return { uid: j.localId, get: (p) => call('GET', p), put: (p, v) => call('PUT', p, v), post: (p, v) => call('POST', p, v), del: (p) => call('DELETE', p) };
}

let failed = 0;
const expect = async (label, p, ok) => {
  const r = await p;
  const pass = r.ok === ok;
  if (!pass) failed++;
  console.log(`${pass ? '✓' : '✗'} ${label}: ${r.ok ? 'مقبول' : 'مرفوض'}${pass ? '' : ` (المتوقع ${ok ? 'مقبول' : 'مرفوض'}) ${JSON.stringify(r.val)}`}`);
  return r;
};
const anon = async (label, path) => {
  const res = await fetch(`${DB}/${path}.json`);
  const pass = !res.ok;
  if (!pass) failed++;
  console.log(`${pass ? '✓' : '✗'} ${label}: ${res.ok ? 'مقبول' : 'مرفوض'}`);
};

const [admin, screen, phone, stranger, guesser] = await Promise.all([user(), user(), user(), user(), user()]);
const K = key();
const D = key();
const C = six();
const wrong = C === '000000' ? '000001' : '000000';
const now = Date.now();

console.log('— المحرّر ينشئ الجلسة');
await expect('إنشاء الجلسة', admin.put(`sessions/${K}`, { owner: admin.uid, createdAt: now, expiresAt: now + 12 * 3600e3 }), true);
await expect('مفتاح شاشة العرض', admin.put(`displayKeys/${D}`, { session: K, owner: admin.uid }), true);
await expect('محاولة لحجز الرمز', admin.put(`attempts/${admin.uid}`, { count: 1, windowStart: TS, code: C }), true);
await expect('حجز الرمز', admin.put(`codes/${C}`, { session: K, owner: admin.uid, createdAt: TS, expiresAt: Date.now() + 9 * 60e3 }), true);

console.log('— شاشة العرض بمفتاح العرض');
await expect('تسجيل شاشة العرض', screen.put(`sessions/${K}/displays/${screen.uid}`, { at: now, via: D }), true);
await expect('حالة العرض', screen.put(`sessions/${K}/state`, { seg: 0, step: 0, started: true }), true);

console.log('— بلا مفتاح لا شيء');
await anon('زائر بلا دخول يقرأ الجلسات', 'sessions');
await anon('زائر بلا دخول يقرأ الجلسة', `sessions/${K}`);
await expect('غريب يستعرض الجلسات', stranger.get('sessions'), false);
await expect('غريب يستعرض الرموز', stranger.get('codes'), false);
await expect('غريب يستعرض مفاتيح العرض', stranger.get('displayKeys'), false);
await expect('غريب يقرأ الجلسة بمفتاحها', stranger.get(`sessions/${K}`), false);
await expect('غريب يقرأ الرمز', stranger.get(`codes/${C}`), false);
await expect('غريب يكتب الحالة', stranger.put(`sessions/${K}/state`, { seg: 1, step: 0, started: true }), false);
await expect('غريب يطالب بالرمز بلا محاولة', stranger.put(`claims/${C}/${stranger.uid}`, { at: TS }), false);

console.log('— الجوال بالرمز');
await expect('محاولة', phone.put(`attempts/${phone.uid}`, { count: 1, windowStart: TS, code: C }), true);
await expect('مطالبة', phone.put(`claims/${C}/${phone.uid}`, { at: TS }), true);
const got = await expect('قراءة الرمز بعد المطالبة', phone.get(`codes/${C}`), true);
if (got.val?.session !== K) (failed++, console.log('✗ الرمز لا يشير إلى الجلسة'));
await expect('تسجيل الجوال', phone.put(`sessions/${K}/remotes/${phone.uid}`, { at: now, code: C }), true);
await expect('أمر «التالي»', phone.post(`sessions/${K}/commands`, { uid: phone.uid, type: 'next', at: now }), true);
await expect('أمر «تلميح» (فقرات الحفل)', phone.post(`sessions/${K}/commands`, { uid: phone.uid, type: 'hint', at: now }), true);
await expect('أمر «تدشين»', phone.post(`sessions/${K}/commands`, { uid: phone.uid, type: 'launch', at: now }), true);
await expect('أمر غير معروف', phone.post(`sessions/${K}/commands`, { uid: phone.uid, type: 'config', at: now }), false);
await expect('الجوال يكتب الحالة', phone.put(`sessions/${K}/state`, { seg: 3, step: 0, started: true }), false);
await expect('الجوال يسجّل نفسه شاشة عرض', phone.put(`sessions/${K}/displays/${phone.uid}`, { at: now, via: K }), false);
await expect('الجوال ينشئ مفتاح عرض لنفسه', phone.put(`displayKeys/${key()}`, { session: K, owner: phone.uid }), false);
await expect('الجوال يحذف الجلسة', phone.del(`sessions/${K}`), false);

console.log('— حد المحاولات');
for (let i = 1; i <= 5; i++) {
  const cur = (await guesser.get(`attempts/${guesser.uid}`)).val;
  await expect(`محاولة ${i}`, guesser.put(`attempts/${guesser.uid}`, i === 1 ? { count: 1, windowStart: TS, code: wrong } : { count: cur.count + 1, windowStart: cur.windowStart, code: wrong }), true);
  await expect(`مطالبة خاطئة ${i}`, guesser.put(`claims/${wrong}/${guesser.uid}`, { at: TS }), false);
}
const cur = (await guesser.get(`attempts/${guesser.uid}`)).val;
await expect('المحاولة السادسة', guesser.put(`attempts/${guesser.uid}`, { count: cur.count + 1, windowStart: cur.windowStart, code: C }), false);
await expect('تصفير العدّاد', guesser.put(`attempts/${guesser.uid}`, { count: 1, windowStart: TS, code: C }), false);
await expect('حذف العدّاد', guesser.del(`attempts/${guesser.uid}`), false);
await expect('مطالبة بالرمز الصحيح بعد الحد', guesser.put(`claims/${C}/${guesser.uid}`, { at: TS }), false);
await expect('كشف الرموز النشطة بمحاولة حجزها', guesser.put(`codes/${C}`, { session: K, owner: guesser.uid, createdAt: TS, expiresAt: Date.now() + 60e3 }), false);

console.log('— فصل كل الأجهزة وإنهاء الجلسة');
await expect('المحرّر يفصل الأجوال', admin.del(`sessions/${K}/remotes`), true);
await expect('الجوال المفصول يرسل أمراً', phone.post(`sessions/${K}/commands`, { uid: phone.uid, type: 'next', at: now }), false);
await expect('الجوال المفصول يقرأ الحالة', phone.get(`sessions/${K}/state`), false);
await expect('حذف الرمز', admin.del(`codes/${C}`), true);
await expect('حذف مفتاح العرض', admin.del(`displayKeys/${D}`), true);
await expect('إنهاء الجلسة', admin.del(`sessions/${K}`), true);

console.log(failed ? `\n${failed} فحصاً لم يطابق المتوقع` : '\nكل الفحوص طابقت المتوقع');
process.exit(failed ? 1 : 0);
