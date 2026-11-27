#!/usr/bin/env node
// tools/release-verify.js -- THE canonical, provider-neutral release
// qualification gate. CI (whichever provider is eventually authorized)
// MUST invoke this script rather than reinventing its own checks.
// Fail-closed: any mandatory step failing exits non-zero immediately.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const {
  EXPECTED_CANONICAL_SHA256,
  CANONICAL_SOURCE_STATUS,
  evaluateCanonicalSourceEvidence,
} = require('./canonical-source-evidence');
const {
  STATUS: CANONICAL_BASELINE_REGISTRY_GATE_STATUS,
  verifyCanonicalBaselineRegistryFile,
} = require('./canonical-baseline-registry-gate');
const {
  STATUS: COMPOSITE_BASELINE_SHADOW_GATE_STATUS,
  evaluateCompositeBaselineShadowFromEnvironment,
} = require('./composite-baseline-shadow-release-gate');
const {
  STATUS: FRESH_COMPOSITE_SHADOW_GATE_STATUS,
  evaluateFreshCompositeShadowFromEnvironment,
} = require('./fresh-composite-shadow-release-gate');
const {
  STATUS: SUCCESSOR_FRESH_COMPOSITE_SHADOW_GATE_STATUS,
  evaluateSuccessorFreshCompositeShadowFromEnvironment,
} = require('./successor-fresh-composite-shadow-release-gate');
const {
  STATUS: COMPOSITE_CUTOVER_SAFETY_GATE_STATUS,
  evaluateCompositeBaselineCutoverSafetyFromEnvironment,
} = require('./composite-baseline-cutover-safety-gate');

const ROOT = path.join(__dirname, '..');
let failed = false;
let canonicalBuildSucceeded=false;

function step(name, fn) {
  const started=Date.now();
  process.stdout.write(`\n=== ${name} ===\n`);
  try {
    const outcome = fn();
    const displayStatus = outcome && typeof outcome.stepStatus === 'string'
      ? outcome.stepStatus
      : 'PASS';
    console.log(`${name}: ${displayStatus}`);
  } catch (e) {
    console.log(`${name}: FAIL -- ${e.message}`);
    failed = true;
  } finally {
    console.log('QUALIFICATION_STEP_ELAPSED_MS '+name+' '+(Date.now()-started));
  }
}

function printFailureDiagnostic(error) {
  const stdout = error && error.stdout ? String(error.stdout) : '';
  const stderr = error && error.stderr ? String(error.stderr) : '';
  const combined = [stdout, stderr].filter(Boolean).join('\n').trim();
  if (!combined) return;
  const max = 3500;
  const text = combined.length > max ? `${combined.slice(0, max)}\n... [diagnostic truncated]` : combined;
  for (const line of text.split(/\r?\n/)) console.log(`    ${line}`);
}

step('TEST_DISCOVERY_AND_REGRESSION', () => {
  const tests = require('./regression-test-discovery').discoverRegressionTests(ROOT);
  const total = tests.length;
  let passed = 0;
  // Emit explicit execution evidence for selected security/recovery regressions.
  // Never forward arbitrary stdout from tests; it may contain sensitive fixture data.
  const evidenceTargets = new Set([
    'tests/architecture/run_riai_ai_assist_client_v1.js',
    'tests/architecture/run_wave12d_investment_financing_metrics.js',
    'tests/architecture/run_wave12a_professional_income_noi.js',
    'tests/defects/c23_governed_live_ai_provider_gateway.js',
    'tests/defects/c26_governed_operator_workspace_rbac.js',
    'tests/architecture/run_c16_historical_auction_recovery.js',
    'tests/architecture/run_c13_historical_closing_recovery.js',
    'tests/architecture/run_c12_historical_regulatory_carry_recovery.js',
    'tests/architecture/run_c14_shared_financing_precision.js',
    'tests/architecture/run_c11_historical_income_asset_recovery.js',
    'tests/architecture/run_c8_c9_input_boundary_hardening.js',
    'tests/architecture/run_c17_c18_land_strategy_recovery.js',
    'tests/architecture/run_c20_urban_growth_recovery.js',
    'tests/architecture/run_c10_c19_market_scenario_recovery.js',
    'tests/architecture/run_c3_sandbox_reconciliation_recovery.js',
    'tests/architecture/run_c2s_source_provenance_recovery.js',
    'tests/architecture/run_c3_c3i_reconciliation_recovery.js',
    'tests/architecture/run_wave8c_property_evidence_bridge.js',
    'tests/architecture/run_wave11b_land_valuation.js',
    'tests/architecture/run_c21_listing_amenity_recovery.js',
    'tests/architecture/run_c58_comparable_provenance_chain.js',
    'tests/architecture/run_market_geospatial_record_boundary.js',
    'tests/architecture/run_guarded_plot_envelope_v1.js',
    'tests/architecture/run_title_cross_document_consistency_v1.js',
    'tests/architecture/run_private_appraisal_vault_namespace_integrity.js',
    'tests/architecture/run_private_appraisal_vault_versioned_keys_restore.js',
    'tests/architecture/run_signed_restore_inventory.js',
    'tests/architecture/run_signed_evidence_custody.js',
    'tests/architecture/run_custody_append_coordinator.js',
    'tests/architecture/run_governed_evidence_intake.js',
    'tests/architecture/run_c49_c40_official_source_rights_recovery.js',
    'tests/architecture/run_c2n_c25_governed_source_recovery.js',
    'tests/architecture/run_structured_source_replay.js',
    'tests/architecture/run_v7_acceleration_contract.js',
    'tests/architecture/run_v7_candidate_diff_census.js',
    'tests/architecture/run_p25_historical_parity_v7.js',
    'tests/architecture/run_performance_calendar_boundary_v7.js',
    'tests/architecture/run_v7_release_calendar_boundaries.js',
    'tests/defects/financial_timing_basis_disclosure_p26.js',
    'tests/defects/financial_timing_basis_report_p26.js',
    'tests/defects/current_model_reference_corpus_p27_v2.js',
    'tests/runtime/run_riai_quota_turnstile_boundary.js',
    'tests/runtime/run_riai_quota_state_boundary.js',
    'tests/architecture/run_authorization_audit_security_v1.js',
    'tests/architecture/run_verified_identity_context_v1.js',
    'tests/architecture/run_v7_cross_lane_hardening.js',
    'tests/architecture/run_orphan_envelope_recovery.js',
    'tests/architecture/run_signed_witness_checkpoint.js',
    'tests/architecture/run_c27_operational_telemetry_recovery.js',
    'tests/runtime/run_postgres_custody_store_tests.js',
    'tests/valuation/private-appraisal-evidence-vault.test.js',
    'tests/architecture/run_legacy_57_manifest_integrity.js',
    'tests/architecture/run_startak_re_historic_source_parity_register.js',
    'tests/architecture/run_wave12b_direct_capitalization.js',
    'tests/architecture/run_wave12c_professional_dcf.js',
    'tests/architecture/run_riai_ai_gateway_guardrails_unit_v1.js',
    'tests/architecture/run_riai_qualitative_output.js',
    'tests/architecture/run_riai_subdivision_gate_v1.js',
    'tests/architecture/run_riai_strategic_evidence_governance_v1.js',
    'tests/architecture/run_residential_income_lifecycle_location_upside_v1.js',
    'tests/runtime/run_riai_openai_responses_adapter.js',
    'tests/runtime/run_riai_client_redirect_boundary.js',
    ...['postgres_runtime_rls_probe','controlled_postgres_migration_runner','controlled_staging_postgres_qualification','controlled_staging_api_security_qualification','controlled_backup_restore_qualification','controlled_dr_failover_qualification','controlled_observability_incident_qualification','independent_security_uat_evidence_gate','productization_release_candidate_evidence_bundle'].map(name=>'tests/runtime/run_'+name+'_tests.js'),
  ]);
  const executedEvidence = new Set();
  // Run named recovery/qualification evidence first, then all remaining tests exactly once.
  // Failed early tests are still recorded; never skip the remaining regression suite.
  const ordered=[...tests].sort((a,b)=>Number(evidenceTargets.has(b.split(path.sep).join('/')))-Number(evidenceTargets.has(a.split(path.sep).join('/'))));
  for (const file of ordered) {
    try {
      execFileSync(process.execPath, [path.join(ROOT, file)], { cwd: ROOT, stdio: 'pipe' }); passed++;
      const normalized = file.split(path.sep).join('/');
      if(evidenceTargets.has(normalized)){executedEvidence.add(normalized);console.log('  REGRESSION_EVIDENCE_PASS='+normalized);}
    }
    catch (e) {
      console.log(`  FAILING TEST: ${file}`);
      printFailureDiagnostic(e);
    }
  }
  console.log(`  REGRESSION_TOTAL=${total} PASSED=${passed}`);
  if (passed !== total) throw new Error(`${total - passed} test(s) failed`);
  const missingEvidence=[...evidenceTargets].filter(file=>!executedEvidence.has(file));
  if(missingEvidence.length)throw new Error('REQUIRED_REGRESSION_EVIDENCE_MISSING: '+missingEvidence.join(','));
  console.log('  REQUIRED_REGRESSION_EVIDENCE_TOTAL='+executedEvidence.size);
});

step('PRODUCTION_BUILD', () => {
  if (fs.existsSync(path.join(ROOT, 'dist'))) fs.rmSync(path.join(ROOT, 'dist'), { recursive: true });
  execFileSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'pipe' });
  if (!fs.existsSync(path.join(ROOT, 'dist', 'assets'))) throw new Error('dist/assets not produced');
  canonicalBuildSucceeded=true;
});

step('VERIFY_PACKAGE', () => {
  // Publish only explicitly allowed summary lines, not arbitrary child output.
  const report = output => {
    const safe = /^(?:REGRESSION_TOTAL=\d+ PASSED=\d+ FAILED=\d+|HARD_CODED_UPLOAD_PATHS=\d+|RELEASE_MANIFEST_PRESENT=(?:true|false)|RELEASE_MANIFEST_VALID=(?:true|false)|FINAL_ASSET_MANIFEST=PASS assets=\d+|VERIFY_PACKAGE=(?:PASS|FAIL))$/;
    for (const line of String(output || '').split(/\r?\n/)) if (safe.test(line)) console.log('  PACKAGE_'+line);
  };
  try {
    // No external skip flag or cache. Reuse only the fresh build successfully
    // created by this exact invocation; all post-build regressions and checks run.
    const args=canonicalBuildSucceeded?['-e',"process.exit(require('./tests/verify_package.js').verifyPackage({reuseExistingBuild:true})?0:1)"]:[path.join(ROOT,'tests','verify_package.js')];
    const output=execFileSync(process.execPath,args,{cwd:ROOT,stdio:'pipe'});
    if(canonicalBuildSucceeded){if(!String(output).split(/\r?\n/).includes('PACKAGE_BUILD_REUSED_IN_CANONICAL_PROCESS=true'))throw Error('PACKAGE_BUILD_REUSE_EVIDENCE_MISSING');console.log('  CANONICAL_BUILD_REUSED=true');}
    report(output);
  } catch (error) {
    report(error.stdout);
    throw new Error('PACKAGE_VERIFICATION_FAILED');
  }
});

step('NPM_AUDIT_RELEASE_THRESHOLD', () => {
  let out;
  try { out = execFileSync('npm', ['audit', '--json'], { cwd: ROOT, encoding: 'utf8' }); }
  catch (e) {
    if (!e.stdout || e.signal || e.status !== 1) throw new Error('NPM_AUDIT_EXECUTION_FAILED');
    out = e.stdout;
  }
  let data;
  try { data = JSON.parse(out); }
  catch (_) { throw new Error('NPM_AUDIT_JSON_INVALID'); }
  const v = require('./npm-audit-response-gate').requireAuditCounts(data);
  console.log(`  critical=${v.critical||0} high=${v.high||0} moderate=${v.moderate||0} low=${v.low||0}`);
  // Emit only public npm package/advisory identifiers and remediation range.
  // Never print the whole audit payload or registry auth, token, headers or config.
  if ((v.critical || 0) > 0 || (v.high || 0) > 0) {
    for (const [name,record] of Object.entries(data.vulnerabilities || {}).slice(0,200)) {
      if (!['high','critical'].includes(record?.severity)) continue;
      const safe = str => typeof str === 'string' && /^[a-zA-Z0-9@/._^-]{1,150}$/.test(str) ? str : 'UNAVAILABLE';
      const version = safe(record?.range);
      const fix = record?.fixAvailable && typeof record.fixAvailable === 'object'
        ? safe(record.fixAvailable.version) : record?.fixAvailable === true ? 'AVAILABLE' : 'NOT_INDICATED';
      console.log(`  vulnerable_package=${safe(name)} severity=${record.severity} range=${version} fix=${fix}`);
    }
    throw new Error('critical/high vulnerability present');
  }
});

step('CANONICAL_BASELINE_REGISTRY_VERIFICATION', () => {
  const result = verifyCanonicalBaselineRegistryFile();
  console.log(`  registry_status=${result.status}`);
  if (result.activeMode) console.log(`  active_mode=${result.activeMode}`);
  if (result.registryHashSha256) console.log(`  registry_sha256=${result.registryHashSha256}`);
  if (result.status !== CANONICAL_BASELINE_REGISTRY_GATE_STATUS.VERIFIED || result.verified !== true) {
    const blockers = Array.isArray(result.blockers) && result.blockers.length > 0
      ? ` blockers=${result.blockers.join(',')}`
      : '';
    throw new Error(`${result.reasonCode || 'CANONICAL_BASELINE_REGISTRY_NOT_VERIFIED'}${blockers}`);
  }
  return { stepStatus: 'PASS' };
});

step('COMPOSITE_BASELINE_SHADOW_VERIFICATION', () => {
  const result = evaluateCompositeBaselineShadowFromEnvironment();
  console.log(`  shadow_status=${result.status}`);
  console.log(`  authoritative_mode=${result.authoritativeMode}`);
  console.log(`  shadow_mode=${result.shadowMode}`);
  if (result.shadowEvaluationHashSha256) console.log(`  shadow_evaluation_sha256=${result.shadowEvaluationHashSha256}`);
  if (result.reasonCode) console.log(`  reason_code=${result.reasonCode}`);

  if (result.status === COMPOSITE_BASELINE_SHADOW_GATE_STATUS.HOLD) {
    throw new Error(result.reasonCode || 'COMPOSITE_BASELINE_SHADOW_HOLD');
  }
  if (result.status === COMPOSITE_BASELINE_SHADOW_GATE_STATUS.MISSING_REQUIRED) {
    throw new Error(result.reasonCode || 'COMPOSITE_BASELINE_SHADOW_REQUIRED');
  }
  if (result.status === COMPOSITE_BASELINE_SHADOW_GATE_STATUS.NOT_EVALUATED) {
    return { stepStatus: 'NOT_EVALUATED' };
  }
  if (result.status !== COMPOSITE_BASELINE_SHADOW_GATE_STATUS.VERIFIED || result.verified !== true) {
    throw new Error('COMPOSITE_BASELINE_SHADOW_UNEXPECTED_STATUS');
  }
  return { stepStatus: 'PASS' };
});

step('FRESH_COMPOSITE_SHADOW_VERIFICATION', () => {
  const result = evaluateFreshCompositeShadowFromEnvironment();
  console.log(`  fresh_shadow_status=${result.status}`);
  console.log(`  authoritative_mode=${result.authoritativeMode}`);
  console.log(`  shadow_mode=${result.shadowMode}`);
  if (result.cycleId) console.log(`  cycle_id=${result.cycleId}`);
  if (result.freshShadowEvaluationHashSha256) console.log(`  fresh_shadow_evaluation_sha256=${result.freshShadowEvaluationHashSha256}`);
  if (result.reasonCode) console.log(`  reason_code=${result.reasonCode}`);

  if (result.status === FRESH_COMPOSITE_SHADOW_GATE_STATUS.HOLD) {
    throw new Error(result.reasonCode || 'FRESH_COMPOSITE_SHADOW_HOLD');
  }
  if (result.status === FRESH_COMPOSITE_SHADOW_GATE_STATUS.MISSING_REQUIRED) {
    throw new Error(result.reasonCode || 'FRESH_COMPOSITE_SHADOW_REQUIRED');
  }
  if (result.status === FRESH_COMPOSITE_SHADOW_GATE_STATUS.NOT_EVALUATED) {
    return { stepStatus: 'NOT_EVALUATED' };
  }
  if (result.status !== FRESH_COMPOSITE_SHADOW_GATE_STATUS.VERIFIED || result.verified !== true) {
    throw new Error('FRESH_COMPOSITE_SHADOW_UNEXPECTED_STATUS');
  }
  return { stepStatus: 'PASS' };
});

step('SUCCESSOR_FRESH_COMPOSITE_SHADOW_VERIFICATION', () => {
  const result = evaluateSuccessorFreshCompositeShadowFromEnvironment();
  console.log(`  successor_fresh_shadow_status=${result.status}`);
  console.log(`  authoritative_mode=${result.authoritativeMode}`);
  console.log(`  shadow_mode=${result.shadowMode}`);
  if (result.cycleId) console.log(`  cycle_id=${result.cycleId}`);
  if (result.successorFreshShadowEvaluationHashSha256) console.log(`  successor_fresh_shadow_evaluation_sha256=${result.successorFreshShadowEvaluationHashSha256}`);
  if (result.reasonCode) console.log(`  reason_code=${result.reasonCode}`);

  if (result.status === SUCCESSOR_FRESH_COMPOSITE_SHADOW_GATE_STATUS.HOLD) {
    throw new Error(result.reasonCode || 'SUCCESSOR_FRESH_COMPOSITE_SHADOW_HOLD');
  }
  if (result.status === SUCCESSOR_FRESH_COMPOSITE_SHADOW_GATE_STATUS.MISSING_REQUIRED) {
    throw new Error(result.reasonCode || 'SUCCESSOR_FRESH_COMPOSITE_SHADOW_REQUIRED');
  }
  if (result.status === SUCCESSOR_FRESH_COMPOSITE_SHADOW_GATE_STATUS.NOT_EVALUATED) {
    return { stepStatus: 'NOT_EVALUATED' };
  }
  if (result.status !== SUCCESSOR_FRESH_COMPOSITE_SHADOW_GATE_STATUS.VERIFIED || result.verified !== true) {
    throw new Error('SUCCESSOR_FRESH_COMPOSITE_SHADOW_UNEXPECTED_STATUS');
  }
  return { stepStatus: 'PASS' };
});

step('COMPOSITE_BASELINE_CUTOVER_SAFETY_GUARD', () => {
  const result = evaluateCompositeBaselineCutoverSafetyFromEnvironment();
  console.log(`  cutover_safety_status=${result.status}`);
  console.log(`  authoritative_mode=${result.authoritativeMode}`);
  console.log(`  proposed_mode=${result.proposedMode}`);
  console.log(`  activation_authorization_granted=${result.activationAuthorizationGranted}`);
  if (result.cutoverSafetyGuardHashSha256) console.log(`  cutover_safety_guard_sha256=${result.cutoverSafetyGuardHashSha256}`);
  if (result.reasonCode) console.log(`  reason_code=${result.reasonCode}`);

  if (result.status === COMPOSITE_CUTOVER_SAFETY_GATE_STATUS.HOLD) {
    throw new Error(result.reasonCode || 'COMPOSITE_BASELINE_CUTOVER_SAFETY_HOLD');
  }
  if (result.status === COMPOSITE_CUTOVER_SAFETY_GATE_STATUS.MISSING_REQUIRED) {
    throw new Error(result.reasonCode || 'COMPOSITE_BASELINE_CUTOVER_SAFETY_REQUIRED');
  }
  if (result.status === COMPOSITE_CUTOVER_SAFETY_GATE_STATUS.NOT_EVALUATED) {
    return { stepStatus: 'NOT_EVALUATED' };
  }
  if (result.status !== COMPOSITE_CUTOVER_SAFETY_GATE_STATUS.VERIFIED || result.verified !== true) {
    throw new Error('COMPOSITE_BASELINE_CUTOVER_SAFETY_UNEXPECTED_STATUS');
  }
  return { stepStatus: 'PASS' };
});

step('CANONICAL_SOURCE_HASH_VERIFICATION', () => {
  const result = evaluateCanonicalSourceEvidence({
    filePath: process.env.CANONICAL_ORIGINAL_PATH,
    expectedSha256: EXPECTED_CANONICAL_SHA256,
    requireEvidence: process.env.REQUIRE_CANONICAL_SOURCE_HASH === '1',
  });

  console.log(`  evidence_status=${result.status}`);
  console.log(`  expected=${result.expectedSha256}`);
  if (result.computedSha256) console.log(`  computed=${result.computedSha256}`);

  if (result.status === CANONICAL_SOURCE_STATUS.MISSING_REQUIRED) {
    throw new Error('canonical source evidence is required but CANONICAL_ORIGINAL_PATH is unavailable');
  }
  if (result.status === CANONICAL_SOURCE_STATUS.MISMATCH) {
    throw new Error(`canonical hash mismatch: expected ${result.expectedSha256}, got ${result.computedSha256}`);
  }
  if (result.status === CANONICAL_SOURCE_STATUS.NOT_EVALUATED) {
    console.log('  (external canonical source was not supplied; engineering checks continue, but canonical-source evidence remains open)');
    return { stepStatus: 'NOT_EVALUATED' };
  }

  return { stepStatus: 'PASS' };
});

console.log(`\n${'='.repeat(50)}`);
console.log('RELEASE_VERIFY_RESULT=' + (failed ? 'FAIL' : 'PASS'));
process.exit(failed ? 1 : 0);
