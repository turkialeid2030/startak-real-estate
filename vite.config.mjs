import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const packageJson = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
const browserCryptoShim = fileURLToPath(new URL('./src/runtime/browser-crypto-shim.js', import.meta.url));
const c66DevEntrypoint = fileURLToPath(new URL('./src/main.jsx', import.meta.url));

/**
 * C66: Vite native development serving cannot execute repo-owned static
 * CommonJS require statements (confirmed by real Chromium, issue #632).
 * Let Vite's dependency optimizer/Rolldown translate the *whole* local
 * source graph through one explicit synthetic bare module instead of
 * injecting window.require or rewriting financial/authenticated modules.
 * Applies only to dev; production entry/build is unchanged.
 */
function startakDevelopmentCommonJsBridge() {
  return {
    name: 'startak-dev-local-commonjs-bridge',
    apply: 'serve',
    transformIndexHtml(html) {
      return html.replace('src="/src/main.jsx"', 'src="/src/dev-bridge-entry.mjs"');
    },
  };
}

function normalizeCommit(value) {
  const raw = String(value || '').trim().toLowerCase();
  return /^[0-9a-f]{40}$/.test(raw) ? raw : null;
}

function resolveBuildMetadata() {
  const sourceCommit = normalizeCommit(
    process.env.STARTAK_SOURCE_COMMIT
      || process.env.CF_PAGES_COMMIT_SHA
      || process.env.VERCEL_GIT_COMMIT_SHA
      || process.env.GITHUB_SHA,
  );
  const buildEnvironment = String(
    process.env.STARTAK_BUILD_ENVIRONMENT
      || (process.env.CF_PAGES_BRANCH ? `cloudflare:${process.env.CF_PAGES_BRANCH}` : '')
      || (process.env.GITHUB_ACTIONS === 'true' ? 'github-actions' : '')
      || 'unverified-local',
  ).slice(0, 100);
  const defaultBuildId = sourceCommit
    ? `${packageJson.version}-${sourceCommit.slice(0, 12)}`
    : `${packageJson.version}-UNVERIFIED_LOCAL`;
  const buildId = String(process.env.STARTAK_BUILD_ID || defaultBuildId).slice(0, 200);

  return Object.freeze({
    schemaVersion: 1,
    appVersion: packageJson.version,
    buildId,
    sourceCommit,
    sourceCommitBound: Boolean(sourceCommit),
    buildEnvironment,
    // Build metadata binds source to an artifact. It does not prove that the
    // artifact was deployed, reviewed, authorized, or is currently serving.
    deploymentVerified: false,
    productionDeploymentAuthorized: false,
    evidenceBoundary: 'BUILD_TRACE_ONLY_NOT_DEPLOYMENT_PROOF',
  });
}

const buildMetadata = resolveBuildMetadata();

function releaseManifestPlugin() {
  return {
    name: 'startak-release-manifest',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'release-manifest.json',
        source: `${JSON.stringify(buildMetadata, null, 2)}\n`,
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), startakDevelopmentCommonJsBridge(), releaseManifestPlugin()],
  optimizeDeps: {
    // The aliased bare entry is intentionally selected as an optimized CJS
    // dependency: the dev server otherwise leaves require() in source ESM.
    include: ['@startak-local-app'],
    force: true,
  },
  resolve: {
    // These aliases affect browser bundling only. Node qualification and test
    // execution keep using the native Node `crypto` implementation. The shim
    // intentionally exposes SHA-256 hashing only, which is the full browser
    // requirement of the currently reachable governance modules.
    alias: {
      '@startak-local-app': c66DevEntrypoint,
      crypto: browserCryptoShim,
      'node:crypto': browserCryptoShim,
    },
  },
  build: {
    // Post-C30 bundle hardening is deliberately a bundler-only partition. The
    // product keeps its existing synchronous imports and governed workspace
    // wiring; architecture regressions therefore continue to validate the same
    // source graph. strictExecutionOrder prevents manual chunk boundaries from
    // reordering side-effectful module initialization.
    rolldownOptions: {
      output: {
        strictExecutionOrder: true,
        codeSplitting: {
          groups: [
            {
              name: 'vendor-initial',
              test: /node_modules[\\/]/,
              tags: ['$initial'],
              maxSize: 450 * 1024,
              priority: 20,
            },
            {
              name: 'startak-initial',
              test: /[\\/]src[\\/]/,
              tags: ['$initial'],
              maxSize: 450 * 1024,
              priority: 10,
            },
          ],
        },
      },
    },
  },
  define: {
    __STARTAK_BUILD_METADATA__: JSON.stringify(buildMetadata),
  },
});
