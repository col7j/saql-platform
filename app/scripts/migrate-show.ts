// يحوّل ملف إعدادات عرض (show.json) إلى آخر إصدار من النموذج: npx vite-node scripts/migrate-show.ts public/show.json
import { readFileSync, writeFileSync } from 'node:fs';
import { exportConfig, parseConfig } from '../src/show/storage';

const file = process.argv[2] ?? 'public/show.json';
const cfg = parseConfig(JSON.parse(readFileSync(file, 'utf8')));
writeFileSync(file, exportConfig({ ...cfg, updatedAt: new Date().toISOString() }) + '\n');
console.log(cfg.segments.map((s) => `${s.order + 1}. ${s.type} · ${s.title}`).join('\n'));
