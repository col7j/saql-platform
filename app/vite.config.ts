import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { homedir } from 'node:os';

// وضع bia2026: بناء مستقل لحفل ختام «بيئات التطوع 2026» (bia2026.html وpublic-bia2026) يُنشر في المجلد الفرعي /saql-platform/bia2026/.
// بلا --mode bia2026 يبقى بناء «صقل» كما هو تماماً.
const bia2026 = { base: '/saql-platform/bia2026/', publicDir: 'public-bia2026', build: { outDir: 'dist-bia2026', emptyOutDir: true, rollupOptions: { input: 'bia2026.html' } } };

export default defineConfig(({ mode }) => ({
  ...(mode === 'bia2026' ? bia2026 : {}),
  base: mode === 'bia2026' ? bia2026.base : './',
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  // الحزم مثبتة خارج مجلد iCloud ومربوطة برابط رمزي (انظر README)
  server: { port: 5173, fs: { allow: ['.', homedir() + '/.saql-platform-deps'] }, watch: { ignored: ['**/node_modules/**', '**/dist/**', '**/dist-bia2026/**'] } },
  test: { environment: 'node', include: ['tests/**/*.test.ts'], css: { include: [/src\/show\/.*\.css/] } },
}) as any);
