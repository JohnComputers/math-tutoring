import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * GitHub Pages serves *project* sites from https://<user>.github.io/<repo>/, so the
 * built asset URLs must be prefixed with `/<repo>/`. User/organisation sites
 * (https://<user>.github.io) and custom domains are served from the root and need `/`.
 *
 * Rather than hard-coding either, `base` is driven by VITE_BASE_PATH. The GitHub Actions
 * workflow sets it automatically from the repository name, and you can override it in
 * `.env` for local experiments. See README -> "Deploying to GitHub Pages".
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const rawBase = env.VITE_BASE_PATH?.trim() || '/';
  // Normalise: always exactly one leading slash and exactly one trailing slash.
  const base = rawBase === '/' ? '/' : `/${rawBase.replace(/^\/+|\/+$/g, '')}/`;

  return {
    base,
    plugins: [react()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    build: {
      outDir: 'dist',
      // Slightly smaller/faster than terser for our bundle size, and no extra dependency.
      minify: 'esbuild',
      target: 'es2020',
      sourcemap: false,
      // The Firebase SDK is ~530 kB raw (~125 kB gzipped) and cannot be trimmed much
      // further; it already sits in its own chunk so the marketing pages are not blocked
      // on it. Raising the threshold above that keeps the warning meaningful — if it
      // fires again, something genuinely unexpected has grown.
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          // Keep the Firebase SDK in its own chunk so the marketing pages, which are what
          // most visitors see first, are not blocked on it.
          manualChunks(id) {
            if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) {
              return 'firebase';
            }
            if (id.includes('node_modules/react-router')) return 'router';
            if (id.includes('node_modules/react')) return 'react';
            return undefined;
          },
        },
      },
    },
    server: { port: 5173, open: false },
    preview: { port: 4173 },
  };
});
