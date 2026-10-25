import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import {localOcrAssets,localOcrAssetsPlugin} from './tools/local-ocr-assets.mjs';

const packageJson = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

/**
 * Experimental native Vite 8 bundled development on repo-owned CommonJS source.
 * Tailwind's serve generator can receive Vite bundledDev's reduced hotUpdate
 * event (no server property). The upstream Tailwind plugin cannot consume that
 * event. Suppress only this incompatible Tailwind hook for that case; preserve
 * React's actual HMR, all transforms, normal Vite and production builds.
 */
function tailwindBundledDevCompatibility(plugins) {
  if (!process.argv.includes('--experimental-bundle')) return plugins;
  const list=Array.isArray(plugins)?plugins:[plugins];
  return list.map(plugin=>{
    if(!plugin||plugin.name!=='@tailwindcss/vite:generate:serve'
        ||typeof plugin.hotUpdate!=='function')return plugin;
    const original=plugin.hotUpdate;
    return {...plugin,hotUpdate(options){
      if(!options||!options.server)return undefined;
      return original.call(this,options);
    }};
  });
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
const ocrAssets=localOcrAssets();

function releaseManifestPlugin() {
  return {
    name: 'startak-release-manifest',
    transformIndexHtml() {
      return [{ tag: 'meta', attrs: { name: 'startak-source-commit',
        content: buildMetadata.sourceCommit || 'UNVERIFIED_LOCAL' }, injectTo: 'head' }];
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'release-manifest.json',
        source: `${JSON.stringify(buildMetadata, null, 2)}\n`,
      });
    },
    writeBundle(options, bundle) {
      const directory = options.dir;
      if (!directory) throw new Error('Asset manifest requires a build output directory');
      const assets = Object.values(bundle).filter(item => item.fileName.startsWith('assets/')).map(item => {
        // Read final written bytes: Vite can rewrite preload references after
        // user generateBundle hooks have run.
        const bytes = fs.readFileSync(path.join(directory, item.fileName));
        return { path: item.fileName, sizeBytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
      }).sort((a, b) => a.path.localeCompare(b.path));
      fs.writeFileSync(path.join(directory, 'asset-manifest.json'), `${JSON.stringify({
        schemaVersion: 1, sourceCommit: buildMetadata.sourceCommit, assets,
        evidenceBoundary: 'BUILD_ASSET_BYTES_NOT_DELIVERY_PROOF',
      }, null, 2)}\n`);
    },
  };
}

export default defineConfig({
  plugins: [react(), ...tailwindBundledDevCompatibility(tailwindcss()), localOcrAssetsPlugin(ocrAssets), releaseManifestPlugin()],
  define: {
    __STARTAK_BUILD_METADATA__: JSON.stringify(buildMetadata),
    __STARTAK_OCR_ASSET_BASE__:JSON.stringify(ocrAssets.base),
  },
});
