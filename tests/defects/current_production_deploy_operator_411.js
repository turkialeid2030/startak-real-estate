'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const workflowPath = path.resolve(__dirname, '../../.github/workflows/production-deployment-current-release.yml');
const workflow = fs.readFileSync(workflowPath, 'utf8');

assert.match(workflow, /github\.event\.issue\.number == 396/,
  'production deployment owner command must be bound to current production tracker #396');
assert.match(workflow, /github\.event\.comment\.author_association == 'OWNER'/,
  'issue-comment production deployment must require OWNER author association');
assert.match(workflow, /github\.event\.comment\.user\.login == github\.repository_owner/,
  'issue-comment production deployment must require repository owner identity');
assert.match(workflow, /\/startak deploy-production /,
  'production deployment command prefix must remain explicit');
assert.match(workflow, /current_main=.*git ls-remote/,
  'deployment must bind requested SHA to current main');
assert.match(workflow, /\[\[ "\$current_main" == "\$requested" \]\]/,
  'deployment must fail closed when requested SHA is not current main');
assert.match(workflow, /npm run release:verify/,
  'deployment must rerun canonical release verification');
assert.match(workflow, /deployment_configs\.production\.fail_open == false/,
  'deployment must preserve fail-closed Cloudflare production posture');
assert.match(workflow, /RIAI_PUBLIC_AI_ENABLED\.value == "false"/,
  'deployment must preserve public AI disabled posture');
assert.match(workflow, /PRODUCTION_DEPLOYMENT_IDENTITY=PASS/,
  'deployment must verify exact provider deployment identity');
assert.match(workflow, /PRODUCTION_HTTP_SMOKE=PASS/,
  'deployment must verify production HTTP smoke');

const smokePosition = workflow.indexOf('- name: Production HTTP smoke test');
const assetPosition = workflow.indexOf('- name: Verify all public assets after provider acknowledged exact release');
const artifactPosition = workflow.indexOf('- name: Preserve bounded production publication evidence');
const boundaryPosition = workflow.indexOf('- name: Publish deployment boundary');
assert(smokePosition >= 0 && assetPosition > smokePosition && artifactPosition > assetPosition && boundaryPosition > artifactPosition,
  'deployment must fail closed on public asset verification after smoke and before success announcement');
assert.match(workflow, /node tools\/verify-deployed-assets\.mjs --url "https:\/\/\$\{CF_PRODUCTION_HOST\}\/" --expected-sha "\$EXPECTED_MAIN_SHA"/,
  'published assets must be verified using exact reviewed commit SHA on production host');
assert.match(workflow, /PRODUCTION_ASSET_DELIVERY_VERIFIED=PASS/,
  'production success must report actual asset verification');
assert.match(workflow, /if-no-files-found: warn/,
  'asset failure evidence should be best-effort without hiding original failed deployment job');
assert.doesNotMatch(workflow.slice(assetPosition,boundaryPosition), /continue-on-error:\s*true/,
  'production asset verification must not be bypassed');


assert.doesNotMatch(workflow, /github\.event\.issue\.number == 351/,
  'historical #351 command path must not remain active');
assert.doesNotMatch(workflow, /QUALIFIED_CANDIDATE_SHA/,
  'obsolete frozen candidate summary metadata must not remain');
assert.doesNotMatch(workflow, /QUALIFIED_ARTIFACT_SHA256/,
  'obsolete predecessor artifact summary metadata must not remain');

console.log('CURRENT_PRODUCTION_DEPLOY_OPERATOR_411=PASS');
