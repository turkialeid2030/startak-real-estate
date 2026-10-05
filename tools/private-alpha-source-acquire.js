#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  acquirePublicArtifact,
  acquireWithBrowserAdapter,
  AcquisitionRuntimeError,
} = require('../src/source-intelligence/private-alpha-acquisition-runtime');
const { ACCESS_MODE, ACQUISITION_METHOD } = require('../src/source-intelligence/private-alpha-acquisition-orchestrator');

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) { out[key] = next; i += 1; }
    else out[key] = true;
  }
  return out;
}

function usage() {
  console.error('Usage: node tools/private-alpha-source-acquire.js --provider <ID> --url <https://...> [--mode fetch|file|browser|auth-browser] [--output <path>] [--storage-state <local-path> --authorized-session yes]');
}

function publicBrowserAdapter({ storageState } = {}) {
  return async (contract) => {
    const { chromium } = require('playwright');
    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext(storageState ? { storageState } : {});
      const page = await context.newPage();
      await page.goto(contract.sourceUrl, { waitUntil: 'networkidle', timeout: 30_000 });
      const finalUrl = page.url();
      const html = await page.content();
      await context.close();
      return {
        finalUrl,
        html,
        contentType: 'text/html',
        credentialBypassUsed: false,
        captchaBypassUsed: false,
        accessControlEvasionUsed: false,
        rateLimitEvasionUsed: false,
      };
    } finally {
      await browser.close();
    }
  };
}

function materialize(evidence, outputPath) {
  if (!outputPath) return;
  const resolved = path.resolve(outputPath);
  if (evidence.text != null) fs.writeFileSync(resolved, evidence.text, 'utf8');
  else fs.writeFileSync(resolved, Buffer.from(evidence.artifactBase64, 'base64'));
}

(async () => {
  const args = parseArgs(process.argv);
  if (!args.provider || !args.url) { usage(); process.exitCode = 2; return; }
  const mode = args.mode || 'fetch';
  let evidence;

  if (mode === 'fetch' || mode === 'file') {
    evidence = await acquirePublicArtifact({
      sourceProvider: args.provider,
      sourceUrl: args.url,
      method: mode === 'file' ? ACQUISITION_METHOD.OFFICIAL_FILE_DOWNLOAD : ACQUISITION_METHOD.DIRECT_HTTPS_FETCH,
      contentHints: mode === 'file' ? ['DOWNLOAD'] : [],
    });
  } else if (mode === 'browser') {
    evidence = await acquireWithBrowserAdapter({
      sourceProvider: args.provider,
      sourceUrl: args.url,
      accessMode: ACCESS_MODE.PUBLIC_WEB,
      browserAdapter: publicBrowserAdapter(),
    });
  } else if (mode === 'auth-browser') {
    if (args['authorized-session'] !== 'yes' || !args['storage-state']) {
      throw new AcquisitionRuntimeError('C53_AUTHORIZED_SESSION_CONFIRMATION_REQUIRED', 'auth-browser requires --authorized-session yes and --storage-state <local-path>.');
    }
    evidence = await acquireWithBrowserAdapter({
      sourceProvider: args.provider,
      sourceUrl: args.url,
      accessMode: ACCESS_MODE.USER_AUTHENTICATED,
      userAuthorizedSession: true,
      browserAdapter: publicBrowserAdapter({ storageState: path.resolve(args['storage-state']) }),
    });
  } else {
    throw new AcquisitionRuntimeError('C53_CLI_MODE_INVALID', `Unsupported mode: ${mode}`);
  }

  materialize(evidence, args.output);
  const summary = {
    capability: evidence.capability,
    sourceProvider: evidence.sourceProvider,
    acquisitionMethod: evidence.acquisitionMethod,
    sourceUrl: evidence.sourceUrl,
    finalUrl: evidence.finalUrl,
    retrievedAt: evidence.retrievedAt,
    contentType: evidence.contentType,
    byteLength: evidence.byteLength,
    artifactHashSha256: evidence.artifactHashSha256,
    output: args.output ? path.resolve(args.output) : null,
    apiUsed: false,
    commercialUseAuthorized: false,
  };
  console.log(JSON.stringify(summary, null, 2));
})().catch((error) => {
  if (error instanceof AcquisitionRuntimeError) {
    console.error(JSON.stringify({ error: error.code, message: error.message, details: error.details }, null, 2));
  } else {
    console.error(error);
  }
  process.exitCode = 1;
});
