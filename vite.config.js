import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import fs from 'node:fs';

const packageJson = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

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
  plugins: [react(), tailwindcss(), releaseManifestPlugin()],
  define: {
    __STARTAK_BUILD_METADATA__: JSON.stringify(buildMetadata),
  },
});
