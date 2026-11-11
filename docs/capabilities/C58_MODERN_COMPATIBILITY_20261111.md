# C58 source provenance — modern compatibility qualification (2026-11-11)

**Status:** code recovered on a separate staging branch. It is an **untrusted source-chain preflight** and is **not** an independent certification of official transactions, deed identity, source provider, legal permission, or market value.

## Verified provenance

- Original C58 [PR #625](https://github.com/turkialeid2030/startak-real-estate/pull/625) at `d919ce207892f84c93516765fc070928405cbb75`.
- Current staged STARTAK [PR #777](https://github.com/turkialeid2030/startak-real-estate/pull/777) at `03355430d57c3df3e0e0d85020e31f8125717864` (before this branch).
- Original byte-identical restored C58 program `src/market/comparable-provenance-chain.js` blob `f0bf8989577703efb6810baecc2281f19a7df8cf` and adversarial suite blob `3f86c126ee2be8ffd40a732e1688198b657b0aba`.
- **Critical difference from C7:** `src/market/comparable-evidence.js` changed from historic blob `90ceb966f259adc2df572a7d3a8ce484f8b3246c` to modern `a0767ef6c810e852748573786cfe5a62472591cf`; `src/valuation-intelligence/market-comparables.js` changed from `b06726b9d1a82b8702f3478e89a83269f9d09dce` to `bdea7850c151534189221658367492de54dfbc72`. Thus even identical C58 source does **not** prove runtime/semantic compatibility.
- `src/valuation-intelligence/contracts.js` remains byte-identical (`6caa10ffe7c778b00d7d0afe4be66cc5e45e7d1c`).

## Exact verification required

1. Run original [C58 adversarial tests](../../tests/architecture/run_c58_comparable_provenance_chain.js) against **modern** dependencies without replacing them. Cover record hash tampering, source-receipt linkage, duplicate transaction underlying IDs, case/city/asset, executed vs asking, sale/rent basis, chronological and rights restrictions.
2. Run current Wave9A, Wave9B and C54 suites, build, package and release verification at the final exact feature SHA. Do not weaken changed current dependency validation to make old tests pass; adapt the isolated C58 adapter safely or HOLD.
3. Confirm `calculateSourceBoundMarketIndication()` returns `HOLD_EVIDENCE_CONFLICT` even for structurally valid synthetic rights/receipts because no external authority is verified.
4. Verify the C58 source program has **not been connected to unreviewed public/canonical routes**. Source presence is not full UI, persistence, audited report and decision/export routing.
5. For owner-facing activation, design an actual negative end-to-end case across UI → source → save → reload → governed report, ensuring **independent market value and annual market rent** evidence and non-bypass of C58/C54/C57 gates.
6. Independent lawful source, source identity, deed/parcel rights and real Saudi transaction/lease proof are still required for professional valuation; no test synthetic fixture can grant rights.

## State labels

- `CODE_RECOVERED_IN_ISOLATED_BRANCH`: file was added, source SHA verified.
- `MODERN_CONTRACT_TEST_PASS`: C58 original+modern assertions pass at exact SHA.
- `RUNTIME_INTEGRATION_PENDING`: existing app/use-case and saved deal/report surfaces not proven.
- `EXTERNAL_PROOF_NOT_SUPPLIED`: independent transaction identity/provider rights/valuator authorization absent.
- `RELEASE_HOLD`: no `main` mutation, Cloudflare deployment, licensed appraisal or commercial go-live.

**No customer files, deeds, source keys or personal property case data shall be added to public GitHub.**
