// صفحة شبكة لعدة لقطات (لمراجعتها دفعة واحدة): node scripts/contact.mjs dir out.html [cols]
import { readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
const [dir, out, cols = 3] = process.argv.slice(2);
const files = readdirSync(dir).filter((f) => f.endsWith('.png')).sort();
const cells = files.map((f) => `<figure><img src="file://${resolve(join(dir, f))}"><figcaption>${f}</figcaption></figure>`).join('');
writeFileSync(out, `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#222;font:14px sans-serif;color:#eee}main{display:grid;grid-template-columns:repeat(${cols},1fr);gap:8px;padding:8px}img{width:100%;display:block}figure{margin:0}</style><main>${cells}</main>`);
