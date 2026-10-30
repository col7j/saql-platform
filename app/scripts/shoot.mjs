// لقطات مراجعة بدقة 1920×1080 من Chrome الحقيقي (بلا اعتماديات): node --experimental-websocket scripts/shoot.mjs plan.json outDir
// plan.json: [{ "name": "01-start", "url": "http://localhost:5173/#/show", "wait": 2500, "keys": ["ArrowRight"], "eval": "js", "fresh": true, "setupFile": "scripts/review-deck.js" }]
// كل لقطة تُنفَّذ بالترتيب في نفس الصفحة ما لم تحمل url جديداً. fresh يمسح التخزين قبل التحميل.
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [planFile, outDir] = process.argv.slice(2);
const plan = JSON.parse(readFileSync(planFile, 'utf8'));
mkdirSync(outDir, { recursive: true });
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const port = 9300 + Math.floor(Math.random() * 500);
const profile = mkdtempSync(join(tmpdir(), 'shoot-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--hide-scrollbars', '--force-device-scale-factor=1', '--window-size=1920,1080', '--autoplay-policy=no-user-gesture-required', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let ws;
for (let i = 0; i < 50 && !ws; i++) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
    const page = list.find((t) => t.type === 'page');
    if (page) ws = new WebSocket(page.webSocketDebuggerUrl);
  } catch { await sleep(200); }
}
await new Promise((r) => ws.addEventListener('open', r));
let id = 0;
const pending = new Map();
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
});
const send = (method, params = {}) => new Promise((res, rej) => {
  const i = ++id;
  pending.set(i, (m) => (m.error ? rej(new Error(method + ': ' + m.error.message)) : res(m.result)));
  ws.send(JSON.stringify({ id: i, method, params }));
});
const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.value;

const KEYS = { ArrowRight: 39, ArrowLeft: 37, ArrowDown: 40, ArrowUp: 38, Enter: 13, ' ': 32, PageDown: 34, PageUp: 33, Escape: 27, Home: 36, End: 35 };
async function press(key) {
  const code = KEYS[key] ?? key.toUpperCase().charCodeAt(0);
  const isChar = key.length === 1;
  const codeName = /^[0-9]$/.test(key) ? 'Digit' + key : isChar && key !== ' ' ? 'Key' + key.toUpperCase() : key === ' ' ? 'Space' : key;
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code: codeName, windowsVirtualKeyCode: code, text: isChar ? key : undefined });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code: codeName, windowsVirtualKeyCode: code });
}

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
// التنزيلات (تصدير الملفات) إلى مجلد اللقطات
await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: outDir, eventsEnabled: true }).catch(() => send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: outDir }));
const results = [];
for (const s of plan) {
  if (s.url) {
    if (s.fresh) {
      await send('Page.navigate', { url: new URL(s.url).origin + '/favicon.ico' }).catch(() => {});
      await sleep(300);
      await evaluate('localStorage.clear(); indexedDB.databases?.().then(d => Promise.all(d.map(x => new Promise(r => { const q = indexedDB.deleteDatabase(x.name); q.onsuccess = q.onerror = q.onblocked = r; }))))');
    }
    // setup: نص JS أو ملف (setupFile) يُنفَّذ في صفحة من نفس الأصل قبل فتح الرابط (لتجهيز التخزين)
    const setup = [s.setup, s.setupFile && readFileSync(s.setupFile, 'utf8')].filter(Boolean).join(';\n');
    if (setup) {
      await send('Page.navigate', { url: new URL(s.url).origin + '/show-media/README.md' });
      await sleep(500);
      console.log('setup:', JSON.stringify(await evaluate(setup)));
    }
    await send('Page.navigate', { url: s.url });
    await sleep(800);
    await evaluate('document.fonts.ready.then(() => true)');
  }
  for (const k of s.keys ?? []) { await press(k); await sleep(s.keyGap ?? 300); }
  // upload: { selector, file } يضع ملفاً في حقل ملف (كاختيار المستخدم)
  if (s.upload) {
    const { root } = await send('DOM.getDocument', { depth: -1, pierce: true });
    const { nodeId } = await send('DOM.querySelector', { nodeId: root.nodeId, selector: s.upload.selector });
    await send('DOM.setFileInputFiles', { nodeId, files: [s.upload.file] });
    await sleep(300);
  }
  // clickAt: تعبير JS يعيد [x, y] (أو [x1, y1, x2, y2] للسحب) فيُضاف إلى clicks
  const clicks = [...(s.clicks ?? [])];
  if (s.clickAt) clicks.push(await evaluate(s.clickAt));
  // clicks: [[x, y], …] أو [[x1, y1, x2, y2]] للسحب
  for (const c of clicks) {
    const [x, y, x2, y2] = c;
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1, pointerType: 'mouse' });
    if (x2 !== undefined) for (let i = 1; i <= 10; i++) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x + ((x2 - x) * i) / 10, y: y + ((y2 - y) * i) / 10, button: 'left', buttons: 1 }); await sleep(20); }
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x2 ?? x, y: y2 ?? y, button: 'left', clickCount: 1 });
    await sleep(s.clickGap ?? 300);
  }
  if (s.eval && !s.evalAfter) results.push({ name: s.name, value: await evaluate(s.eval) });
  await sleep(s.wait ?? 2000);
  if (s.eval && s.evalAfter) results.push({ name: s.name, value: await evaluate(s.eval) });
  if (s.name) {
    const { data } = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 1920, height: 1080, scale: 1 } });
    writeFileSync(join(outDir, s.name + '.png'), Buffer.from(data, 'base64'));
    console.log('shot', s.name);
  }
}
if (results.length) console.log(JSON.stringify(results, null, 1));
ws.close();
chrome.kill();
process.exit(0);
