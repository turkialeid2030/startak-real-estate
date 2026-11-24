# STARTAK Real Estate — full 110 open-PR diff footprint and overlap triage

> Inspected 20 November 2026 via authenticated GitHub PR list including complete unified diff strings for the current 110 open PRs. **No approval, merge, close, deletion or deployment**.

## Verified totals

- **110/110** PRs have readable diffs and **8,509,683 characters** of patch text, spanning **849 unique changed file paths**.
- **86 PRs** touch `src/`; 110 reviewed patch headers are *not* 110 independently peer-approved patch semantics.
- **106 direct open-head ancestry links**, **4 roots**, zero detected cycles and **maximum depth 90**.
- **106 Draft** PRs, **4 non-draft** in this snapshot.
- Repeated paths below indicate the need for semantic reconciliation. In a stacked PR history, repeated file modifications are expected and **do not prove conflicts or duplicate features**.

## Complete open-PR family graph (confirmed two-pass ancestry)

| Root open PR | Open PRs in family | Max dependency depth | Base branch of root |
|---|---:|---:|---|
| [#463](https://github.com/turkialeid2030/startak-real-estate/pull/463) | 91 | 90 | `p26-financial-timing-basis-disclosure` |
| [#767](https://github.com/turkialeid2030/startak-real-estate/pull/767) | 15 | 13 | `main` |
| [#763](https://github.com/turkialeid2030/startak-real-estate/pull/763) | 3 | 2 | `main` |
| [#461](https://github.com/turkialeid2030/startak-real-estate/pull/461) | 1 | 0 | `main` |

## Most frequently changed paths

| Path | Open PRs touching path | PRs |
|---|---:|---|
| `package.json` | 10 | [#803](https://github.com/turkialeid2030/startak-real-estate/pull/803), [#638](https://github.com/turkialeid2030/startak-real-estate/pull/638), [#637](https://github.com/turkialeid2030/startak-real-estate/pull/637), [#612](https://github.com/turkialeid2030/startak-real-estate/pull/612), [#611](https://github.com/turkialeid2030/startak-real-estate/pull/611), [#609](https://github.com/turkialeid2030/startak-real-estate/pull/609), [#608](https://github.com/turkialeid2030/startak-real-estate/pull/608), [#607](https://github.com/turkialeid2030/startak-real-estate/pull/607), [#606](https://github.com/turkialeid2030/startak-real-estate/pull/606), [#605](https://github.com/turkialeid2030/startak-real-estate/pull/605) |
| `src/components/PropertyMarketLocationPanel.jsx` | 10 | [#800](https://github.com/turkialeid2030/startak-real-estate/pull/800), [#799](https://github.com/turkialeid2030/startak-real-estate/pull/799), [#798](https://github.com/turkialeid2030/startak-real-estate/pull/798), [#797](https://github.com/turkialeid2030/startak-real-estate/pull/797), [#796](https://github.com/turkialeid2030/startak-real-estate/pull/796), [#773](https://github.com/turkialeid2030/startak-real-estate/pull/773), [#767](https://github.com/turkialeid2030/startak-real-estate/pull/767), [#766](https://github.com/turkialeid2030/startak-real-estate/pull/766), [#764](https://github.com/turkialeid2030/startak-real-estate/pull/764), [#763](https://github.com/turkialeid2030/startak-real-estate/pull/763) |
| `tests/e2e/run_location_market_study_ci.mjs` | 7 | [#800](https://github.com/turkialeid2030/startak-real-estate/pull/800), [#799](https://github.com/turkialeid2030/startak-real-estate/pull/799), [#777](https://github.com/turkialeid2030/startak-real-estate/pull/777), [#773](https://github.com/turkialeid2030/startak-real-estate/pull/773), [#767](https://github.com/turkialeid2030/startak-real-estate/pull/767), [#764](https://github.com/turkialeid2030/startak-real-estate/pull/764), [#763](https://github.com/turkialeid2030/startak-real-estate/pull/763) |
| `src/components/ValuationIntelligencePanel.jsx` | 7 | [#777](https://github.com/turkialeid2030/startak-real-estate/pull/777), [#767](https://github.com/turkialeid2030/startak-real-estate/pull/767), [#655](https://github.com/turkialeid2030/startak-real-estate/pull/655), [#643](https://github.com/turkialeid2030/startak-real-estate/pull/643), [#641](https://github.com/turkialeid2030/startak-real-estate/pull/641), [#483](https://github.com/turkialeid2030/startak-real-estate/pull/483), [#481](https://github.com/turkialeid2030/startak-real-estate/pull/481) |
| `src/app/App.jsx` | 6 | [#777](https://github.com/turkialeid2030/startak-real-estate/pull/777), [#773](https://github.com/turkialeid2030/startak-real-estate/pull/773), [#767](https://github.com/turkialeid2030/startak-real-estate/pull/767), [#766](https://github.com/turkialeid2030/startak-real-estate/pull/766), [#763](https://github.com/turkialeid2030/startak-real-estate/pull/763), [#636](https://github.com/turkialeid2030/startak-real-estate/pull/636) |
| `tests/e2e/run_audit_20261010_remaining_browser.js` | 6 | [#777](https://github.com/turkialeid2030/startak-real-estate/pull/777), [#776](https://github.com/turkialeid2030/startak-real-estate/pull/776), [#773](https://github.com/turkialeid2030/startak-real-estate/pull/773), [#772](https://github.com/turkialeid2030/startak-real-estate/pull/772), [#767](https://github.com/turkialeid2030/startak-real-estate/pull/767), [#763](https://github.com/turkialeid2030/startak-real-estate/pull/763) |
| `src/components/ValuationIntelligenceBasePanel.jsx` | 6 | [#767](https://github.com/turkialeid2030/startak-real-estate/pull/767), [#766](https://github.com/turkialeid2030/startak-real-estate/pull/766), [#640](https://github.com/turkialeid2030/startak-real-estate/pull/640), [#635](https://github.com/turkialeid2030/startak-real-estate/pull/635), [#631](https://github.com/turkialeid2030/startak-real-estate/pull/631), [#630](https://github.com/turkialeid2030/startak-real-estate/pull/630) |
| `src/i18n/research-action-presentation.js` | 5 | [#800](https://github.com/turkialeid2030/startak-real-estate/pull/800), [#797](https://github.com/turkialeid2030/startak-real-estate/pull/797), [#773](https://github.com/turkialeid2030/startak-real-estate/pull/773), [#767](https://github.com/turkialeid2030/startak-real-estate/pull/767), [#766](https://github.com/turkialeid2030/startak-real-estate/pull/766) |
| `src/market/saved-deal-study-sidecar.js` | 5 | [#800](https://github.com/turkialeid2030/startak-real-estate/pull/800), [#799](https://github.com/turkialeid2030/startak-real-estate/pull/799), [#767](https://github.com/turkialeid2030/startak-real-estate/pull/767), [#764](https://github.com/turkialeid2030/startak-real-estate/pull/764), [#763](https://github.com/turkialeid2030/startak-real-estate/pull/763) |
| `src/i18n/market-study-core-labels.js` | 5 | [#799](https://github.com/turkialeid2030/startak-real-estate/pull/799), [#797](https://github.com/turkialeid2030/startak-real-estate/pull/797), [#796](https://github.com/turkialeid2030/startak-real-estate/pull/796), [#767](https://github.com/turkialeid2030/startak-real-estate/pull/767), [#766](https://github.com/turkialeid2030/startak-real-estate/pull/766) |
| `src/components/ResearchEvidenceFusionPanel.jsx` | 5 | [#798](https://github.com/turkialeid2030/startak-real-estate/pull/798), [#797](https://github.com/turkialeid2030/startak-real-estate/pull/797), [#767](https://github.com/turkialeid2030/startak-real-estate/pull/767), [#766](https://github.com/turkialeid2030/startak-real-estate/pull/766), [#764](https://github.com/turkialeid2030/startak-real-estate/pull/764) |
| `src/components/LocalDocumentEvidenceWorkspace.jsx` | 5 | [#777](https://github.com/turkialeid2030/startak-real-estate/pull/777), [#772](https://github.com/turkialeid2030/startak-real-estate/pull/772), [#767](https://github.com/turkialeid2030/startak-real-estate/pull/767), [#766](https://github.com/turkialeid2030/startak-real-estate/pull/766), [#764](https://github.com/turkialeid2030/startak-real-estate/pull/764) |
| `src/main.jsx` | 5 | [#777](https://github.com/turkialeid2030/startak-real-estate/pull/777), [#773](https://github.com/turkialeid2030/startak-real-estate/pull/773), [#767](https://github.com/turkialeid2030/startak-real-estate/pull/767), [#764](https://github.com/turkialeid2030/startak-real-estate/pull/764), [#538](https://github.com/turkialeid2030/startak-real-estate/pull/538) |
| `src/components/PersonalInvestmentResearchPanel.jsx` | 5 | [#776](https://github.com/turkialeid2030/startak-real-estate/pull/776), [#767](https://github.com/turkialeid2030/startak-real-estate/pull/767), [#766](https://github.com/turkialeid2030/startak-real-estate/pull/766), [#764](https://github.com/turkialeid2030/startak-real-estate/pull/764), [#655](https://github.com/turkialeid2030/startak-real-estate/pull/655) |
| `.github/workflows/location-market-study-verify.yml` | 5 | [#773](https://github.com/turkialeid2030/startak-real-estate/pull/773), [#767](https://github.com/turkialeid2030/startak-real-estate/pull/767), [#766](https://github.com/turkialeid2030/startak-real-estate/pull/766), [#764](https://github.com/turkialeid2030/startak-real-estate/pull/764), [#763](https://github.com/turkialeid2030/startak-real-estate/pull/763) |
| `tests/valuation/appraisal-sidecar-gate.test.js` | 4 | [#800](https://github.com/turkialeid2030/startak-real-estate/pull/800), [#799](https://github.com/turkialeid2030/startak-real-estate/pull/799), [#767](https://github.com/turkialeid2030/startak-real-estate/pull/767), [#764](https://github.com/turkialeid2030/startak-real-estate/pull/764) |
| `src/components/CrossMethodEvidencePanel.jsx` | 4 | [#798](https://github.com/turkialeid2030/startak-real-estate/pull/798), [#767](https://github.com/turkialeid2030/startak-real-estate/pull/767), [#766](https://github.com/turkialeid2030/startak-real-estate/pull/766), [#763](https://github.com/turkialeid2030/startak-real-estate/pull/763) |
| `src/components/MarketOfferResearchPanel.jsx` | 4 | [#798](https://github.com/turkialeid2030/startak-real-estate/pull/798), [#767](https://github.com/turkialeid2030/startak-real-estate/pull/767), [#766](https://github.com/turkialeid2030/startak-real-estate/pull/766), [#763](https://github.com/turkialeid2030/startak-real-estate/pull/763) |
| `src/app/governed-decision-operational.js` | 4 | [#777](https://github.com/turkialeid2030/startak-real-estate/pull/777), [#642](https://github.com/turkialeid2030/startak-real-estate/pull/642), [#483](https://github.com/turkialeid2030/startak-real-estate/pull/483), [#481](https://github.com/turkialeid2030/startak-real-estate/pull/481) |
| `src/components/SaudiNationalIntelligenceSourcesPanel.jsx` | 4 | [#777](https://github.com/turkialeid2030/startak-real-estate/pull/777), [#767](https://github.com/turkialeid2030/startak-real-estate/pull/767), [#766](https://github.com/turkialeid2030/startak-real-estate/pull/766), [#764](https://github.com/turkialeid2030/startak-real-estate/pull/764) |
| `tests/e2e/run_audit_20261020_local_ocr_browser.js` | 4 | [#776](https://github.com/turkialeid2030/startak-real-estate/pull/776), [#773](https://github.com/turkialeid2030/startak-real-estate/pull/773), [#772](https://github.com/turkialeid2030/startak-real-estate/pull/772), [#767](https://github.com/turkialeid2030/startak-real-estate/pull/767) |
| `tests/e2e/run_appraisal_assurance_ci.mjs` | 4 | [#773](https://github.com/turkialeid2030/startak-real-estate/pull/773), [#767](https://github.com/turkialeid2030/startak-real-estate/pull/767), [#766](https://github.com/turkialeid2030/startak-real-estate/pull/766), [#764](https://github.com/turkialeid2030/startak-real-estate/pull/764) |
| `tests/e2e/run_c75_real_chromium_personal_study.js` | 4 | [#773](https://github.com/turkialeid2030/startak-real-estate/pull/773), [#767](https://github.com/turkialeid2030/startak-real-estate/pull/767), [#766](https://github.com/turkialeid2030/startak-real-estate/pull/766), [#655](https://github.com/turkialeid2030/startak-real-estate/pull/655) |

## Full 110-PR per-patch matrix

| PR | Root | Depth | Diff files | Source | Tests | Workflows | Docs | Package | Other overlapping PRs* | Patch chars | Draft | Mergeable** |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|
| [#461](https://github.com/turkialeid2030/startak-real-estate/pull/461) | 461 | 0 | 15 | 10 | 5 | 0 | 0 | 0 | 3 | 72548 | no | no |
| [#463](https://github.com/turkialeid2030/startak-real-estate/pull/463) | 463 | 0 | 2 | 0 | 2 | 0 | 0 | 0 | 1 | 22384 | no | yes |
| [#466](https://github.com/turkialeid2030/startak-real-estate/pull/466) | 463 | 1 | 7 | 4 | 2 | 0 | 1 | 0 | 1 | 47945 | yes | yes |
| [#469](https://github.com/turkialeid2030/startak-real-estate/pull/469) | 463 | 2 | 7 | 4 | 2 | 0 | 1 | 0 | 1 | 70354 | yes | yes |
| [#471](https://github.com/turkialeid2030/startak-real-estate/pull/471) | 463 | 3 | 7 | 3 | 2 | 1 | 1 | 0 | 2 | 73179 | yes | yes |
| [#473](https://github.com/turkialeid2030/startak-real-estate/pull/473) | 463 | 4 | 8 | 4 | 2 | 1 | 1 | 0 | 1 | 97253 | yes | yes |
| [#476](https://github.com/turkialeid2030/startak-real-estate/pull/476) | 463 | 5 | 7 | 3 | 1 | 1 | 1 | 1 | 4 | 63604 | yes | yes |
| [#477](https://github.com/turkialeid2030/startak-real-estate/pull/477) | 463 | 6 | 6 | 3 | 1 | 1 | 1 | 0 | 4 | 60887 | yes | yes |
| [#479](https://github.com/turkialeid2030/startak-real-estate/pull/479) | 463 | 7 | 6 | 3 | 1 | 1 | 1 | 0 | 3 | 45926 | yes | yes |
| [#481](https://github.com/turkialeid2030/startak-real-estate/pull/481) | 463 | 8 | 11 | 7 | 2 | 1 | 1 | 0 | 8 | 60822 | yes | yes |
| [#483](https://github.com/turkialeid2030/startak-real-estate/pull/483) | 463 | 9 | 15 | 9 | 3 | 1 | 1 | 0 | 9 | 82912 | yes | yes |
| [#485](https://github.com/turkialeid2030/startak-real-estate/pull/485) | 463 | 10 | 5 | 2 | 1 | 1 | 1 | 0 | 1 | 49449 | yes | yes |
| [#487](https://github.com/turkialeid2030/startak-real-estate/pull/487) | 463 | 11 | 5 | 2 | 1 | 1 | 1 | 0 | 0 | 46674 | yes | yes |
| [#489](https://github.com/turkialeid2030/startak-real-estate/pull/489) | 463 | 12 | 5 | 2 | 1 | 1 | 1 | 0 | 0 | 45046 | yes | yes |
| [#491](https://github.com/turkialeid2030/startak-real-estate/pull/491) | 463 | 13 | 5 | 2 | 1 | 1 | 1 | 0 | 2 | 46047 | yes | yes |
| [#493](https://github.com/turkialeid2030/startak-real-estate/pull/493) | 463 | 14 | 5 | 2 | 1 | 1 | 1 | 0 | 0 | 49929 | yes | yes |
| [#495](https://github.com/turkialeid2030/startak-real-estate/pull/495) | 463 | 15 | 4 | 1 | 1 | 1 | 1 | 0 | 0 | 39528 | yes | yes |
| [#498](https://github.com/turkialeid2030/startak-real-estate/pull/498) | 463 | 16 | 4 | 1 | 1 | 1 | 1 | 0 | 0 | 34738 | yes | yes |
| [#501](https://github.com/turkialeid2030/startak-real-estate/pull/501) | 463 | 17 | 4 | 1 | 1 | 1 | 1 | 0 | 0 | 50990 | yes | yes |
| [#503](https://github.com/turkialeid2030/startak-real-estate/pull/503) | 463 | 18 | 4 | 1 | 1 | 1 | 1 | 0 | 0 | 58362 | yes | yes |
| [#505](https://github.com/turkialeid2030/startak-real-estate/pull/505) | 463 | 19 | 5 | 2 | 1 | 1 | 1 | 0 | 3 | 48252 | yes | yes |
| [#507](https://github.com/turkialeid2030/startak-real-estate/pull/507) | 463 | 20 | 4 | 1 | 1 | 1 | 1 | 0 | 0 | 51597 | yes | yes |
| [#509](https://github.com/turkialeid2030/startak-real-estate/pull/509) | 463 | 21 | 4 | 1 | 1 | 1 | 1 | 0 | 0 | 43498 | yes | yes |
| [#511](https://github.com/turkialeid2030/startak-real-estate/pull/511) | 463 | 22 | 4 | 1 | 1 | 1 | 1 | 0 | 0 | 54821 | yes | yes |
| [#514](https://github.com/turkialeid2030/startak-real-estate/pull/514) | 463 | 23 | 4 | 1 | 1 | 1 | 1 | 0 | 0 | 44852 | yes | yes |
| [#516](https://github.com/turkialeid2030/startak-real-estate/pull/516) | 463 | 24 | 4 | 1 | 1 | 1 | 1 | 0 | 0 | 61870 | yes | yes |
| [#518](https://github.com/turkialeid2030/startak-real-estate/pull/518) | 463 | 25 | 4 | 1 | 1 | 1 | 1 | 0 | 0 | 46184 | yes | yes |
| [#520](https://github.com/turkialeid2030/startak-real-estate/pull/520) | 463 | 26 | 4 | 1 | 1 | 1 | 1 | 0 | 1 | 43376 | yes | yes |
| [#523](https://github.com/turkialeid2030/startak-real-estate/pull/523) | 463 | 27 | 5 | 2 | 1 | 1 | 1 | 0 | 2 | 48429 | yes | yes |
| [#525](https://github.com/turkialeid2030/startak-real-estate/pull/525) | 463 | 28 | 4 | 1 | 1 | 1 | 1 | 0 | 1 | 28599 | yes | yes |
| [#527](https://github.com/turkialeid2030/startak-real-estate/pull/527) | 463 | 29 | 4 | 1 | 1 | 1 | 1 | 0 | 0 | 24159 | yes | yes |
| [#530](https://github.com/turkialeid2030/startak-real-estate/pull/530) | 463 | 30 | 4 | 1 | 1 | 1 | 1 | 0 | 1 | 23809 | yes | yes |
| [#532](https://github.com/turkialeid2030/startak-real-estate/pull/532) | 463 | 31 | 4 | 1 | 1 | 1 | 1 | 0 | 0 | 20233 | yes | yes |
| [#536](https://github.com/turkialeid2030/startak-real-estate/pull/536) | 463 | 32 | 4 | 1 | 1 | 1 | 1 | 0 | 0 | 20378 | yes | yes |
| [#537](https://github.com/turkialeid2030/startak-real-estate/pull/537) | 463 | 33 | 4 | 1 | 1 | 1 | 1 | 0 | 1 | 27062 | yes | yes |
| [#538](https://github.com/turkialeid2030/startak-real-estate/pull/538) | 463 | 34 | 6 | 3 | 1 | 1 | 1 | 0 | 4 | 55677 | yes | yes |
| [#539](https://github.com/turkialeid2030/startak-real-estate/pull/539) | 463 | 35 | 4 | 1 | 1 | 1 | 1 | 0 | 0 | 32506 | yes | yes |
| [#542](https://github.com/turkialeid2030/startak-real-estate/pull/542) | 463 | 36 | 6 | 1 | 3 | 1 | 0 | 0 | 1 | 28100 | yes | yes |
| [#544](https://github.com/turkialeid2030/startak-real-estate/pull/544) | 463 | 37 | 4 | 0 | 2 | 1 | 0 | 0 | 2 | 5078 | yes | yes |
| [#553](https://github.com/turkialeid2030/startak-real-estate/pull/553) | 463 | 38 | 5 | 0 | 1 | 1 | 1 | 0 | 0 | 20092 | yes | yes |
| [#554](https://github.com/turkialeid2030/startak-real-estate/pull/554) | 463 | 39 | 5 | 0 | 1 | 1 | 1 | 0 | 0 | 20663 | yes | yes |
| [#555](https://github.com/turkialeid2030/startak-real-estate/pull/555) | 463 | 40 | 5 | 0 | 1 | 1 | 1 | 0 | 0 | 25158 | yes | yes |
| [#557](https://github.com/turkialeid2030/startak-real-estate/pull/557) | 463 | 41 | 5 | 0 | 1 | 1 | 1 | 0 | 0 | 16119 | yes | yes |
| [#565](https://github.com/turkialeid2030/startak-real-estate/pull/565) | 463 | 42 | 5 | 0 | 1 | 1 | 1 | 0 | 0 | 28058 | yes | yes |
| [#567](https://github.com/turkialeid2030/startak-real-estate/pull/567) | 463 | 43 | 5 | 0 | 1 | 1 | 1 | 0 | 0 | 25614 | yes | yes |
| [#569](https://github.com/turkialeid2030/startak-real-estate/pull/569) | 463 | 44 | 5 | 0 | 1 | 1 | 1 | 0 | 0 | 21825 | yes | yes |
| [#589](https://github.com/turkialeid2030/startak-real-estate/pull/589) | 463 | 45 | 6 | 0 | 1 | 1 | 1 | 0 | 0 | 31037 | yes | yes |
| [#591](https://github.com/turkialeid2030/startak-real-estate/pull/591) | 463 | 46 | 6 | 0 | 1 | 1 | 1 | 0 | 0 | 24431 | yes | yes |
| [#593](https://github.com/turkialeid2030/startak-real-estate/pull/593) | 463 | 47 | 6 | 0 | 1 | 1 | 1 | 0 | 0 | 26677 | yes | yes |
| [#595](https://github.com/turkialeid2030/startak-real-estate/pull/595) | 463 | 48 | 6 | 0 | 1 | 1 | 1 | 0 | 0 | 38701 | yes | yes |
| [#597](https://github.com/turkialeid2030/startak-real-estate/pull/597) | 463 | 49 | 35 | 5 | 22 | 3 | 2 | 0 | 3 | 172456 | yes | yes |
| [#600](https://github.com/turkialeid2030/startak-real-estate/pull/600) | 463 | 50 | 5 | 0 | 1 | 1 | 1 | 0 | 0 | 24904 | yes | yes |
| [#601](https://github.com/turkialeid2030/startak-real-estate/pull/601) | 463 | 51 | 5 | 0 | 1 | 1 | 1 | 0 | 0 | 30908 | yes | yes |
| [#602](https://github.com/turkialeid2030/startak-real-estate/pull/602) | 463 | 52 | 5 | 0 | 1 | 1 | 1 | 0 | 0 | 24331 | yes | yes |
| [#603](https://github.com/turkialeid2030/startak-real-estate/pull/603) | 463 | 53 | 5 | 0 | 1 | 1 | 1 | 0 | 0 | 23038 | yes | yes |
| [#604](https://github.com/turkialeid2030/startak-real-estate/pull/604) | 463 | 54 | 6 | 0 | 1 | 2 | 1 | 0 | 0 | 22798 | yes | yes |
| [#605](https://github.com/turkialeid2030/startak-real-estate/pull/605) | 463 | 55 | 7 | 2 | 1 | 1 | 1 | 1 | 11 | 26905 | yes | yes |
| [#606](https://github.com/turkialeid2030/startak-real-estate/pull/606) | 463 | 56 | 6 | 1 | 1 | 1 | 1 | 1 | 10 | 39762 | yes | yes |
| [#607](https://github.com/turkialeid2030/startak-real-estate/pull/607) | 463 | 57 | 6 | 1 | 1 | 1 | 1 | 1 | 9 | 38219 | yes | yes |
| [#608](https://github.com/turkialeid2030/startak-real-estate/pull/608) | 463 | 58 | 6 | 1 | 1 | 1 | 1 | 1 | 9 | 24764 | yes | yes |
| [#609](https://github.com/turkialeid2030/startak-real-estate/pull/609) | 463 | 59 | 6 | 1 | 1 | 1 | 1 | 1 | 9 | 26353 | yes | yes |
| [#611](https://github.com/turkialeid2030/startak-real-estate/pull/611) | 463 | 60 | 8 | 2 | 1 | 2 | 1 | 1 | 10 | 33961 | yes | yes |
| [#612](https://github.com/turkialeid2030/startak-real-estate/pull/612) | 463 | 61 | 7 | 1 | 1 | 1 | 1 | 1 | 9 | 34180 | yes | yes |
| [#613](https://github.com/turkialeid2030/startak-real-estate/pull/613) | 463 | 62 | 5 | 1 | 1 | 1 | 1 | 1 | 2 | 19770 | yes | yes |
| [#617](https://github.com/turkialeid2030/startak-real-estate/pull/617) | 463 | 63 | 4 | 1 | 1 | 1 | 1 | 0 | 0 | 27435 | yes | yes |
| [#623](https://github.com/turkialeid2030/startak-real-estate/pull/623) | 463 | 64 | 4 | 1 | 1 | 1 | 1 | 0 | 0 | 20474 | yes | yes |
| [#624](https://github.com/turkialeid2030/startak-real-estate/pull/624) | 463 | 65 | 4 | 1 | 1 | 1 | 1 | 0 | 0 | 14207 | yes | yes |
| [#625](https://github.com/turkialeid2030/startak-real-estate/pull/625) | 463 | 66 | 4 | 1 | 1 | 1 | 1 | 0 | 1 | 24373 | yes | yes |
| [#626](https://github.com/turkialeid2030/startak-real-estate/pull/626) | 463 | 67 | 4 | 1 | 1 | 1 | 1 | 0 | 0 | 25364 | yes | yes |
| [#627](https://github.com/turkialeid2030/startak-real-estate/pull/627) | 463 | 68 | 4 | 1 | 1 | 1 | 1 | 0 | 0 | 21747 | yes | yes |
| [#629](https://github.com/turkialeid2030/startak-real-estate/pull/629) | 463 | 69 | 4 | 1 | 1 | 1 | 1 | 0 | 0 | 27373 | yes | yes |
| [#630](https://github.com/turkialeid2030/startak-real-estate/pull/630) | 463 | 70 | 8 | 5 | 1 | 1 | 1 | 0 | 6 | 28287 | yes | yes |
| [#631](https://github.com/turkialeid2030/startak-real-estate/pull/631) | 463 | 71 | 4 | 1 | 1 | 1 | 1 | 0 | 5 | 17022 | yes | yes |
| [#635](https://github.com/turkialeid2030/startak-real-estate/pull/635) | 463 | 72 | 6 | 2 | 2 | 1 | 1 | 0 | 5 | 19595 | yes | yes |
| [#636](https://github.com/turkialeid2030/startak-real-estate/pull/636) | 463 | 73 | 7 | 3 | 2 | 1 | 1 | 0 | 5 | 16780 | yes | yes |
| [#637](https://github.com/turkialeid2030/startak-real-estate/pull/637) | 463 | 74 | 5 | 0 | 1 | 1 | 1 | 1 | 9 | 12869 | yes | yes |
| [#638](https://github.com/turkialeid2030/startak-real-estate/pull/638) | 463 | 75 | 4 | 0 | 1 | 1 | 1 | 1 | 9 | 9512 | yes | yes |
| [#639](https://github.com/turkialeid2030/startak-real-estate/pull/639) | 463 | 76 | 4 | 0 | 1 | 1 | 1 | 0 | 1 | 11644 | yes | yes |
| [#640](https://github.com/turkialeid2030/startak-real-estate/pull/640) | 463 | 77 | 8 | 4 | 2 | 1 | 1 | 0 | 7 | 25438 | yes | yes |
| [#641](https://github.com/turkialeid2030/startak-real-estate/pull/641) | 463 | 78 | 9 | 5 | 2 | 1 | 1 | 0 | 8 | 35518 | yes | yes |
| [#642](https://github.com/turkialeid2030/startak-real-estate/pull/642) | 463 | 79 | 7 | 3 | 2 | 1 | 1 | 0 | 3 | 25284 | yes | yes |
| [#643](https://github.com/turkialeid2030/startak-real-estate/pull/643) | 463 | 80 | 8 | 4 | 2 | 1 | 1 | 0 | 7 | 48952 | yes | yes |
| [#645](https://github.com/turkialeid2030/startak-real-estate/pull/645) | 463 | 81 | 3 | 0 | 1 | 1 | 1 | 0 | 0 | 24298 | yes | yes |
| [#646](https://github.com/turkialeid2030/startak-real-estate/pull/646) | 463 | 82 | 4 | 1 | 1 | 1 | 1 | 0 | 1 | 30789 | yes | yes |
| [#647](https://github.com/turkialeid2030/startak-real-estate/pull/647) | 463 | 83 | 8 | 2 | 3 | 1 | 1 | 0 | 1 | 37343 | yes | yes |
| [#649](https://github.com/turkialeid2030/startak-real-estate/pull/649) | 463 | 84 | 4 | 1 | 1 | 1 | 1 | 0 | 1 | 26011 | yes | yes |
| [#650](https://github.com/turkialeid2030/startak-real-estate/pull/650) | 463 | 85 | 6 | 2 | 2 | 1 | 1 | 0 | 1 | 36347 | yes | yes |
| [#651](https://github.com/turkialeid2030/startak-real-estate/pull/651) | 463 | 86 | 5 | 1 | 2 | 1 | 1 | 0 | 0 | 27647 | yes | yes |
| [#652](https://github.com/turkialeid2030/startak-real-estate/pull/652) | 463 | 87 | 6 | 2 | 2 | 1 | 1 | 0 | 0 | 38397 | yes | yes |
| [#653](https://github.com/turkialeid2030/startak-real-estate/pull/653) | 463 | 88 | 4 | 1 | 1 | 1 | 1 | 0 | 0 | 23913 | yes | yes |
| [#654](https://github.com/turkialeid2030/startak-real-estate/pull/654) | 463 | 89 | 4 | 1 | 1 | 1 | 1 | 0 | 0 | 26671 | yes | yes |
| [#655](https://github.com/turkialeid2030/startak-real-estate/pull/655) | 463 | 90 | 7 | 3 | 2 | 1 | 1 | 0 | 10 | 39726 | yes | yes |
| [#763](https://github.com/turkialeid2030/startak-real-estate/pull/763) | 763 | 0 | 56 | 20 | 16 | 12 | 7 | 0 | 13 | 308534 | no | yes |
| [#764](https://github.com/turkialeid2030/startak-real-estate/pull/764) | 763 | 1 | 83 | 33 | 27 | 3 | 15 | 0 | 16 | 478222 | yes | yes |
| [#766](https://github.com/turkialeid2030/startak-real-estate/pull/766) | 763 | 2 | 113 | 65 | 34 | 3 | 10 | 0 | 20 | 958932 | yes | yes |
| [#767](https://github.com/turkialeid2030/startak-real-estate/pull/767) | 767 | 0 | 233 | 102 | 76 | 15 | 34 | 0 | 26 | 1627162 | no | yes |
| [#772](https://github.com/turkialeid2030/startak-real-estate/pull/772) | 767 | 1 | 5 | 2 | 2 | 1 | 0 | 0 | 7 | 16049 | yes | no |
| [#773](https://github.com/turkialeid2030/startak-real-estate/pull/773) | 767 | 1 | 32 | 9 | 18 | 3 | 0 | 0 | 16 | 145262 | yes | yes |
| [#776](https://github.com/turkialeid2030/startak-real-estate/pull/776) | 767 | 2 | 19 | 8 | 9 | 1 | 1 | 0 | 9 | 88538 | yes | yes |
| [#777](https://github.com/turkialeid2030/startak-real-estate/pull/777) | 767 | 3 | 134 | 56 | 36 | 17 | 21 | 0 | 35 | 1017487 | yes | yes |
| [#795](https://github.com/turkialeid2030/startak-real-estate/pull/795) | 767 | 4 | 3 | 1 | 1 | 0 | 1 | 0 | 1 | 9079 | yes | yes |
| [#796](https://github.com/turkialeid2030/startak-real-estate/pull/796) | 767 | 5 | 7 | 4 | 2 | 1 | 0 | 0 | 9 | 11732 | yes | yes |
| [#797](https://github.com/turkialeid2030/startak-real-estate/pull/797) | 767 | 6 | 10 | 6 | 2 | 1 | 1 | 0 | 9 | 33670 | yes | yes |
| [#798](https://github.com/turkialeid2030/startak-real-estate/pull/798) | 767 | 7 | 7 | 4 | 1 | 1 | 1 | 0 | 9 | 33115 | yes | yes |
| [#799](https://github.com/turkialeid2030/startak-real-estate/pull/799) | 767 | 8 | 9 | 3 | 4 | 1 | 1 | 0 | 10 | 19753 | yes | yes |
| [#800](https://github.com/turkialeid2030/startak-real-estate/pull/800) | 767 | 9 | 6 | 3 | 2 | 0 | 1 | 0 | 10 | 16369 | yes | yes |
| [#801](https://github.com/turkialeid2030/startak-real-estate/pull/801) | 767 | 10 | 3 | 0 | 1 | 0 | 2 | 0 | 0 | 38017 | yes | yes |
| [#802](https://github.com/turkialeid2030/startak-real-estate/pull/802) | 767 | 11 | 2 | 1 | 1 | 0 | 0 | 0 | 0 | 7791 | yes | yes |
| [#803](https://github.com/turkialeid2030/startak-real-estate/pull/803) | 767 | 12 | 28 | 8 | 13 | 1 | 1 | 2 | 14 | 137577 | yes | yes |
| [#805](https://github.com/turkialeid2030/startak-real-estate/pull/805) | 767 | 13 | 6 | 0 | 0 | 0 | 6 | 0 | 0 | 191597 | yes | yes |

\* Same-path edits, not necessarily conflicting lines. \*\* Mergeability is a temporal technical snapshot, not review or production authorization.

## Controlled next actions

1. Examine root #767 (233 paths) and root #763 (56 paths) against current main's source to identify behavior not present at the qualified security-branch head. Historical roots are **not** guaranteed to be production-safe.
2. Review the 91-deep #463 financial/governance chain in dependency order, preserving signed evidence and canonical model controls; rebasing onto main requires exact new-head qualification.
3. Audit sibling #772 against #773: the modern `DiagnosticText[data-diagnostic-code]` contract already renders and tests localized OCR/manual/verification messages; old parent `data-reason-code` requires compatibility only if a real consumer depends on it.
4. Treat weak authentication, actual production IdP→HTTP→DB tenant A/B, key management, 17 private-case engine parity, Saudi licensed market data, licensed valuer and external Q01–Q12 signatures as *separate non-code acceptance gates*.
5. For each PR assign the independent reviewer and record one of KEEP/PORT/REBASE/SUPERSEDED_CANDIDATE/HOLD with diff-level evidence. This matrix does **not** choose those dispositions for the user.

## Authority decision

**HOLD_NOT_AUTHORIZED** — no change to protected main, PR status, credential management, professional valuation certification, production deployment or release authority.
