// يكتب public-bia2026/show.json من العرض الافتراضي لحفل «بيئات التطوع 2026» (بلا أسماء فائزين ولا مكرَّمين):
// npx vite-node scripts/build-bia2026-show.ts
import { writeFileSync } from 'node:fs';
import { registerExt } from '../src/show/ext';
import { exportConfig, parseConfig } from '../src/show/storage';
import { KINDS } from '../src/events/bia2026/kinds';
import { biaConfig } from '../src/events/bia2026/defaults';

registerExt(...KINDS);
const cfg = parseConfig(exportConfig(biaConfig()));
writeFileSync(new URL('../public-bia2026/show.json', import.meta.url), exportConfig(cfg) + '\n');
console.log(`show.json: ${cfg.segments.length} شريحة، ${cfg.segments.filter((s) => s.section).length} فقرة`);
