// بروفة كاملة بزمن الحفل على Chrome الحقيقي: node --experimental-websocket scripts/rehearsal.mjs outDir [scale] [setup.js]
// تفتح شاشة العرض، وتبدأ العرض، وتمرّ على فقرات الجدول بمددها المخططة (scale=1 زمن حقيقي، 0.1 أسرع عشر مرات):
// تتقدّم بين شرائح كل فقرة بالتساوي، وتشغّل التدشين (L) والتلميح والكشف في «من أنا؟» ومؤقت الصورة (T)،
// وتلتقط صورة عند بداية كل فقرة، وتسجّل أخطاء الصفحة، وتقارن الزمن الفعلي في ساعة الحفل بالمخطط.
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [outDir, scaleArg = '1', setupFile] = process.argv.slice(2);
const scale = Number(scaleArg) || 1;
const BASE = process.env.BASE || 'http://localhost:5173';
mkdirSync(outDir, { recursive: true });
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const port = 9800 + Math.floor(Math.random() * 150);
const profile = mkdtempSync(join(tmpdir(), 'rehearsal-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--hide-scrollbars', '--force-device-scale-factor=1', '--window-size=1920,1080', '--autoplay-policy=no-user-gesture-required', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = [];
const note = (m) => (log.push(`${new Date().toISOString().slice(11, 19)} ${m}`), console.log(m));

let ws;
for (let i = 0; i < 50 && !ws; i++) {
  try {
    const page = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page');
    if (page) ws = new WebSocket(page.webSocketDebuggerUrl);
  } catch { await sleep(200); }
}
await new Promise((r) => ws.addEventListener('open', r));
let id = 0;
const pending = new Map();
const errors = [];
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map((a) => a.value ?? a.description).join(' '));
});
const send = (method, params = {}) => new Promise((res, rej) => {
  const i = ++id;
  pending.set(i, (m) => (m.error ? rej(new Error(method + ': ' + m.error.message)) : res(m.result)));
  ws.send(JSON.stringify({ id: i, method, params }));
});
const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.value;
const key = (code, k) => evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(k)}, code: ${JSON.stringify(code)} })), 1`);
const shot = async (name) => {
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(outDir, name + '.png'), Buffer.from(data, 'base64'));
};

await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
// تخزين فارغ ثم إعداد العرض (بيانات وهمية للبروفة فقط)
await send('Page.navigate', { url: `${BASE}/show-media/README.md` });
await sleep(1200);
await evaluate('localStorage.clear(), 1');
if (setupFile) {
  await send('Page.navigate', { url: `${BASE}/#/show-admin` });
  await sleep(3000);
  note(`setup: ${await evaluate(readFileSync(setupFile, 'utf8'))}`);
}
await send('Page.navigate', { url: `${BASE}/#/show` });
await sleep(3500);

// الجدول من إعدادات العرض نفسها
const plan = JSON.parse(await evaluate(`(async () => {
  const { loadSavedConfig, loadRepoConfig } = await import('/src/show/storage.ts');
  const { sortSegments, stepCount } = await import('/src/show/nav.ts');
  const { agenda, whoBlocks } = await import('/src/show/ceremony/logic.ts');
  const cfg = loadSavedConfig() ?? (await loadRepoConfig());
  const list = sortSegments(cfg.segments);
  return JSON.stringify(agenda(list).map((a) => ({ ...a, segs: list.slice(a.from, a.to + 1).map((s) => ({ type: s.type, title: s.title, steps: stepCount(s), who: s.type === 'whoami' ? whoBlocks(s.settings).map((b) => b.hints) : null })) })));
})()`));
const planned = plan.reduce((n, a) => n + a.minutes, 0);
note(`الجدول: ${plan.length} فقرة، ${planned} دقيقة، مقياس الزمن ${scale}`);

await evaluate("document.querySelector('.show-cta')?.click(), 1");
await sleep(1500);
const t0 = Date.now();

for (const [i, a] of plan.entries()) {
  const budget = Math.max(a.minutes, 0.5) * 60000 * scale;
  const start = Date.now();
  note(`▶ ${i + 1}. ${a.title} (${a.minutes} د)`);
  // كما يفعل المقدّم من «انتقل إلى شريحة»: بداية الفقرة (للخروج من جولة الديمو مثلاً)
  await evaluate(`new BroadcastChannel('saql-show').postMessage({ type: 'goto', pos: { seg: ${a.from}, step: 0 } }), 1`);
  await sleep(1500);
  await shot(`${String(i + 1).padStart(2, '0')}-${a.segs[0].type}`);
  // نقرات الفقرة موزّعة على مدتها (انتظار ثم نقرة)، والانتقال للفقرة التالية في بداية دورتها
  const actions = [];
  a.segs.forEach((s, k) => {
    const last = k === a.segs.length - 1;
    if (s.type === 'launch') actions.push(['launch'], ['wait', 16000]);
    else if (s.type === 'demo') actions.push(['wait', 30000 * scale]);
    else if (s.type === 'photo') actions.push(['photo'], ['wait', 6000]);
    else if (s.type === 'whoami') s.who.forEach((hints, w) => { actions.push(['next']); for (let h = 0; h < hints; h++) actions.push(['hint']); actions.push(['reveal']); if (w === s.who.length - 1 && !last) actions.push(['next']); });
    else if (a.segs[0].type !== 'launch') for (let j = 0; j < s.steps - (last ? 1 : 0); j++) actions.push(['next']);
  });
  const presses = actions.filter(([x]) => x !== 'wait').length;
  const waits = actions.filter(([x]) => x === 'wait').reduce((n, [, ms]) => n + ms, 0);
  const gap = Math.max(300, (budget - waits) / (presses + 1));
  for (const [act, ms] of actions) {
    if (act === 'wait') { await sleep(ms); continue; }
    await sleep(gap);
    if (act === 'launch') await key('KeyL', 'l');
    else if (act === 'hint') await key('KeyH', 'h');
    else if (act === 'reveal') await key('KeyR', 'r');
    else if (act === 'photo') await key('KeyT', 't');
    else await key('ArrowRight', 'ArrowRight');
  }
  const left = budget - (Date.now() - start);
  if (left > 0) await sleep(left);
  // تأكد أن العرض وصل أول الفقرة التالية (التدشين يتقدّم وحده إلى الديمو)
  const state = await evaluate(`(() => { const t = JSON.parse(localStorage.getItem('show-timing') || '{}'); return JSON.stringify({ current: t.current, spent: t.spent }); })()`);
  note(`  ساعة الحفل: ${state}`);
}

const total = Date.now() - t0;
await shot('99-end');
const timing = JSON.parse(await evaluate(`localStorage.getItem('show-timing')`) || '{}');
note(`انتهت البروفة: ${(total / 60000).toFixed(1)} دقيقة فعلية مقابل ${(planned * scale).toFixed(1)} مخططة (بالمقياس)`);
note(`أخطاء الصفحة: ${errors.length}`);
for (const e of errors.slice(0, 20)) note(`  ✗ ${e}`);
writeFileSync(join(outDir, 'rehearsal-log.txt'), log.join('\n') + '\n');
writeFileSync(join(outDir, 'timing.json'), JSON.stringify(timing, null, 2));
ws.close();
chrome.kill();
process.exit(errors.length ? 1 : 0);
