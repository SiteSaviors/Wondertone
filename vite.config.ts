import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { componentTagger } from 'lovable-tagger';
import { visualizer } from 'rollup-plugin-visualizer';

const resolveReleaseSha = (): string => {
  const fromEnv =
    process.env.VITE_RELEASE_SHA ||
    process.env.GITHUB_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA;
  if (fromEnv && fromEnv.trim().length > 0) {
    return fromEnv.trim();
  }
  try {
    return execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return 'unknown';
  }
};

const resolveBuildId = (releaseSha: string): string => {
  const fromEnv =
    process.env.VITE_BUILD_ID ||
    process.env.GITHUB_RUN_ID ||
    process.env.VERCEL_DEPLOYMENT_ID;
  if (fromEnv && fromEnv.trim().length > 0) {
    return fromEnv.trim();
  }
  return releaseSha;
};

export default defineConfig(({ mode }) => {
  const enableVerboseSourcemaps = process.env.VERBOSE_SOURCEMAPS === 'true';
  const releaseSha = resolveReleaseSha();
  const buildId = resolveBuildId(releaseSha);

  return {
  server: {
    host: '::',
    port: 4175,
  },
  plugins: [
    react(),
    ...(mode === 'development' ? [componentTagger()] : []),
    ...(process.env.ANALYZE
      ? [
          visualizer({
            filename: 'dist/stats.html',
            template: 'treemap',
            open: true,
            gzipSize: true,
            brotliSize: true,
          }),
        ]
      : []),
  ],
  define: {
    'import.meta.env.VITE_RELEASE_SHA': JSON.stringify(releaseSha),
    'import.meta.env.VITE_BUILD_ID': JSON.stringify(buildId),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    sourcemap: enableVerboseSourcemaps,
    rollupOptions: {
      output: {
        manualChunks: (id: string) => {
          // Keep Prism ingest/client out of the lazy StyleAccordion chunk so the
          // accordion budget stays independent of funnel payload code.
          if (
            id.includes('/src/utils/telemetry') ||
            id.includes('/src/utils/funnelAnalytics') ||
            id.includes('/src/utils/analyticsClient') ||
            id.includes('/src/config/releaseInfo')
          ) {
            return 'funnel-analytics';
          }

          if (!id.includes('node_modules')) {
            return undefined;
          }

          if (id.includes('react-dom') || id.includes('react/jsx-runtime')) {
            return 'react-vendors';
          }

          if (id.includes('react-router-dom')) {
            return 'router-vendors';
          }

          if (id.includes('framer-motion')) {
            return 'motion-vendors';
          }

          if (id.includes('@radix-ui')) {
            return 'radix-vendors';
          }

          if (id.includes('zustand')) {
            return 'state-vendors';
          }

          if (id.includes('@tanstack/react-query')) {
            return 'query-vendors';
          }

          return undefined;
        },
      },
    },
  },
  css: {
    devSourcemap: enableVerboseSourcemaps,
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.spec.ts', 'tests/**/*.spec.tsx'],
  },
};
});
