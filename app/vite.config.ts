import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { homedir } from 'node:os';

export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  // الحزم مثبتة خارج مجلد iCloud ومربوطة برابط رمزي (انظر README)
  server: { port: 5173, fs: { allow: ['.', homedir() + '/.saql-platform-deps'] }, watch: { ignored: ['**/node_modules/**', '**/dist/**'] } },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
} as any);
