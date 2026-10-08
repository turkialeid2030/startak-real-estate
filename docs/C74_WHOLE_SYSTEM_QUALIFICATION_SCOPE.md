# C74 — Whole-system deterministic simulation and real browser verification

## Scope / control boundary
Candidate is based on technically qualified C72 PR #643, **not** main. The purpose is engineering verification on synthetic data and the compiled production bundle. This document and passing CI do not constitute source-rights proof, regulator certification, Saudi market accuracy validation, customer-file handling permission or production signoff. Master #622, #634 and C73 #644 stay open.

## Acceptance jobs
| Gate | Real execution | Test oracle | Unproven |
|---|---|---|---|
| Finance | 8 deterministic seeds x 40 land + 40 existing-building = **640** instrumented synthetic cases, plus **9,000 Monte Carlo draws** in downside, base, upside; five invalid inputs | engine invariants/determinism, independently recomputed NPV, exact periodic IRR root and minimum DSCR, ordering of scenarios, no invalid READY | independently observed sale prices / rents / cap rates and real forecast accuracy |
| Method / finance | dated DCF/residual, development sensitivity, NOI, capitalization, acquisition financing, Monte Carlo and C58-C62 | fixed fixtures, no double count, methodological holds | valuer-issued Saudi report |
| Browser | actual Chromium against production Vite bundle, C40 accessibility, C41 four viewport/locale combinations (desktop/mobile x Arabic/English), C63 office/retail/residential, C64 land, C69-72 hotel/industrial, C70 evidence refs, Saved Deals reload, C71 C5/C6 export denial | DOM event wiring, save/reload, no console/page errors, withholding authorization, file-byte tamper/race proof | human usability/signoff, performance at production scale, real customer files |
| Security/governance | source rights / PDPL internal readiness, cross-tenant contracts, document case isolation, forged authorities, decision integrity and HOLD paths | no route to official authority from synthetic evidence; fail-closed invalid inputs | actual legal approvals, regulated provider permission, penetration test, server-side vault |
| Release | npm test, decision-integrity, production build, package verification, independent release verification and npm audit | exact-head cross-job pass/fail | sanctioned production deployment |

## Mandatory decision hierarchy
1. Any financial computation, invariant, release, browser, security or governance failure => **FAIL / HOLD**.
2. Four GitHub jobs successful + aggregate successful => **PASS_SYNTHETIC_ENGINEERING_ONLY** for that exact commit; does **not** close G01/G02/G05/G08/G09/G10/G13/G14 in #622.
3. Genuine Saudi executed transaction holdout, data rights, document authenticity, licensed valuer, PDPL review, independent real-user UAT and human launch authority remain **HOLD** until separately independently evidenced and approved.
4. Do not merge C72/C74 into main or deploy. Preview builds are for synthetic files only.
5. Do not infer full model correctness merely because invariants are satisfied: self-consistent formulas can still encode the wrong investment economics.

## Future adversarial cases not proven by this CI
- Real upload + trusted server-scanned/isolated vault + independent signed chain of custody (C73 #644).
- Comprehensive source authentication directly at issuing authorities, professional scope/expiry checks and license revocation.
- Real-world hotel FF&E/intangible vs property-interest separation, industrial contamination/fire/energy/load engineering certificates, genuine mixed-use double counting checks.
- Real Saudi historical out-of-sample MAE, tail and calibration by city, asset class, market cycle; thresholds must be preregistered.
- Capacity / soak / concurrency benchmarks on production-like hosting, distributed storage failures, regional outage/recovery, abuse-resistant uploads.
- Manual Arabic RTL accessibility by assistive technology, WCAG audit, customer UAT, independent penetration test and a separate legal go-live authorization.

## Reproducibility
Run `node tests/architecture/run_c74_financial_reproducible_simulation.js` after `npm ci`; evidence in `runtime-evidence/c74/financial-simulation.json`. The CI uses the exact pull-request head checkout in each job, stores evidence where available, and never manufactures external evidence.
