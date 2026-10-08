'use strict';

/**
 * C66: explicit development fallback for source CommonJS while the native
 * Vite module server remains broken (issue #632). This is NOT native HMR:
 * Vite builds a watched, deployable bundle and Vite preview serves it;
 * source edits rebuild and require a manual browser refresh.
 *
 * Node's native child_process API preserves genuine CommonJS Node semantics.
 * Never inject a global require into browsers or customer contexts.
 */
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const vite = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
const distIndex = path.join(root, 'dist', 'index.html');
const userArgs = process.argv.slice(2);
const children = [];
let stopped = false;
let preview = null;
let starting = false;

if (!fs.existsSync(vite)) {
  console.error('C66_DEV_STABLE_NPM_CI_REQUIRED: Vite is not installed.');
  process.exit(1);
}

function stopChildren() {
  if (stopped) return;
  stopped = true;
  for (const child of children) {
    if (child && !child.killed) {
      try { child.kill('SIGTERM'); } catch (_) {}
    }
  }
}
process.on('SIGINT', () => { stopChildren(); process.exit(130); });
process.on('SIGTERM', () => { stopChildren(); process.exit(143); });

const build = spawn(process.execPath, [vite, 'build', '--watch'], {
  cwd: root,
  env: {
    ...process.env,
    // Metadata remains explicitly NOT a production authorization.
    STARTAK_BUILD_ENVIRONMENT: 'local-watched-developer-preview',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
children.push(build);
let buildOutput = '';
build.stdout.on('data', chunk => {
  const s = String(chunk);
  process.stdout.write(s);
  buildOutput = (buildOutput + s).slice(-12000);
  if (/(?:built in|watching for changes)/i.test(s)) {
    startPreview();
  }
});
build.stderr.on('data', chunk => {
  const s = String(chunk);
  process.stderr.write(s);
  buildOutput = (buildOutput + s).slice(-12000);
});
build.on('error', error => {
  console.error('C66_DEV_STABLE_WATCH_SPAWN_ERROR', error);
  stopChildren();
  process.exitCode = 1;
});
build.on('exit', (code, signal) => {
  if (!stopped) {
    console.error('C66_DEV_STABLE_BUILD_WATCH_STOPPED', code, signal);
    stopChildren();
    process.exitCode = 1;
  }
});

function startPreview() {
  if (stopped || preview || starting) return;
  starting = true;
  // The compiled HTML must actually exist. No fallback to unbundled /src/main.
  if (!fs.existsSync(distIndex)) {
    starting = false;
    return;
  }
  preview = spawn(process.execPath, [vite, 'preview', ...userArgs], {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
  });
  children.push(preview);
  console.log('C66_DEV_STABLE_WATCHED_PRODUCTION_PARITY=TRUE');
  console.log('C66_NATIVE_VITE_HMR=FALSE');
  console.log('C66_EXTERNAL_PROFESSIONAL_APPROVAL=FALSE');
  preview.on('error', error => {
    console.error('C66_DEV_STABLE_PREVIEW_SPAWN_ERROR', error);
    stopChildren();
    process.exitCode = 1;
  });
  preview.on('exit', (code, signal) => {
    if (!stopped) {
      console.error('C66_DEV_STABLE_PREVIEW_STOPPED', code, signal);
      stopChildren();
      process.exitCode = 1;
    }
  });
}

setTimeout(() => {
  if (!preview && !stopped) {
    console.error('C66_DEV_STABLE_INITIAL_BUILD_TIMEOUT: no serveable bundle after two minutes');
    console.error(buildOutput.slice(-1500));
    stopChildren();
    process.exitCode = 1;
  }
}, 120000).unref();
