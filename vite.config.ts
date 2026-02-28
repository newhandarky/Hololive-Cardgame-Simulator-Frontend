import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const buildBase = (process.env.VITE_BASE_PATH ?? env.VITE_BASE_PATH ?? '/').trim() || '/';

  return {
    plugins: [react()],
    base: command === 'build' ? buildBase : '/',
  };
});
