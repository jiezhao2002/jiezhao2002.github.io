import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, projectRoot, 'NEXT_PUBLIC_');
  const supabaseURL = env.NEXT_PUBLIC_SUPABASE_URL || 'https://ddbpnfmjzprdnmkbvuon.supabase.co';
  const endpoint = new URL(supabaseURL);
  if (endpoint.protocol !== 'https:' || ['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname)) {
    throw new Error('Openworld production builds require a public HTTPS Supabase endpoint.');
  }
  return {
    root: fileURLToPath(new URL('./pages', import.meta.url)),
    base: '/openworld/',
    publicDir: fileURLToPath(new URL('./public', import.meta.url)),
    envDir: projectRoot,
    plugins: [react()],
    resolve: { alias: { '@': projectRoot } },
    // This publishable key is intended for browsers. Ownership is enforced by RLS.
    define: {
      'process.env.NEXT_PUBLIC_SUPABASE_URL': JSON.stringify(supabaseURL),
      'process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_2Oh_6TTYf01pb7iC9USVMw_gnduaWTC'),
    },
    css: { postcss: projectRoot },
    build: { outDir: fileURLToPath(new URL('./dist', import.meta.url)), emptyOutDir: true },
  };
});
