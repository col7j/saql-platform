// يكتب public/show.json من العرض الافتراضي لحفل «صقل 7» (بلا أي بيانات شخصية): npx vite-node scripts/build-ceremony.ts
import { writeFileSync } from 'node:fs';
import { ceremonyConfig } from '../src/show/ceremony/defaults';
import { exportConfig, parseConfig } from '../src/show/storage';

const cfg = parseConfig(exportConfig(ceremonyConfig()));
writeFileSync(new URL('../public/show.json', import.meta.url), exportConfig(cfg) + '\n');
console.log(`show.json: ${cfg.segments.length} شريحة`);
