'use strict';

const { version: packageVersion } = require('../../package.json');

const FALLBACK_METADATA = Object.freeze({
  schemaVersion: 1,
  appVersion: packageVersion,
  buildId: `${packageVersion}-UNVERIFIED_LOCAL`,
  sourceCommit: null,
  sourceCommitBound: false,
  buildEnvironment: 'unverified-local',
  deploymentVerified: false,
  productionDeploymentAuthorized: false,
  evidenceBoundary: 'BUILD_TRACE_ONLY_NOT_DEPLOYMENT_PROOF',
});

function normalizeMetadata(raw) {
  if (!raw || typeof raw !== 'object') return FALLBACK_METADATA;
  const sourceCommit = typeof raw.sourceCommit === 'string' && /^[0-9a-f]{40}$/i.test(raw.sourceCommit)
    ? raw.sourceCommit.toLowerCase()
    : null;
  const buildId = typeof raw.buildId === 'string' && raw.buildId.trim()
    ? raw.buildId.trim().slice(0, 200)
    : `${packageVersion}-UNVERIFIED_LOCAL`;
  const buildEnvironment = typeof raw.buildEnvironment === 'string' && raw.buildEnvironment.trim()
    ? raw.buildEnvironment.trim().slice(0, 100)
    : 'unverified-local';

  return Object.freeze({
    schemaVersion: 1,
    appVersion: typeof raw.appVersion === 'string' && raw.appVersion.trim() ? raw.appVersion.trim() : packageVersion,
    buildId,
    sourceCommit,
    sourceCommitBound: Boolean(sourceCommit),
    buildEnvironment,
    // A build can bind itself to source. It cannot certify its own deployment.
    deploymentVerified: false,
    productionDeploymentAuthorized: false,
    evidenceBoundary: 'BUILD_TRACE_ONLY_NOT_DEPLOYMENT_PROOF',
  });
}

function readInjectedMetadata() {
  // Vite replaces this identifier at build time. `typeof` preserves Node/test
  // execution when no build-time define exists.
  if (typeof __STARTAK_BUILD_METADATA__ !== 'undefined') {
    return normalizeMetadata(__STARTAK_BUILD_METADATA__);
  }
  return FALLBACK_METADATA;
}

const BUILD_METADATA = readInjectedMetadata();

function getBuildMetadata() {
  return BUILD_METADATA;
}

function installRuntimeBuildMetadata(targetWindow = typeof window !== 'undefined' ? window : null) {
  if (!targetWindow) return BUILD_METADATA;

  const defineImmutable = (name, value) => {
    try {
      Object.defineProperty(targetWindow, name, {
        value,
        writable: false,
        configurable: false,
        enumerable: false,
      });
    } catch (_) {
      // Runtime metadata must never break application startup. Internal callers
      // use BUILD_METADATA directly and never trust mutable window input.
    }
  };

  defineImmutable('__STARTAK_RUNTIME_METADATA__', BUILD_METADATA);
  // Backward-compatible diagnostic alias; read-only and sourced from the
  // compile-time metadata, not from caller/browser injection.
  defineImmutable('__STARTAK_BUILD_ID__', BUILD_METADATA.buildId);
  return BUILD_METADATA;
}

module.exports = {
  FALLBACK_METADATA,
  BUILD_METADATA,
  getBuildMetadata,
  installRuntimeBuildMetadata,
  normalizeMetadata,
};
