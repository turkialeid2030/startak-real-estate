# City historical rolling evaluation — 2026-11-25

The exact parser and existing baseline algorithm were executed on the 13 pinned city source files (19,954 aggregate observations, 2019–2024). Development comparison: 2020–2023 (6,921 common of 10,239 eligible). Retrospective temporal holdout: 2024 (2,616 common of 3,372 eligible). This is a city-only diagnostic, not a district or contract-level independent AVM validation.

| Baseline | Development MAPE | 2024 MAPE | 2024 MAE SAR | 2024 within 20% |
|---|---:|---:|---:|---:|
| Prior quarter | 13.78% | 13.74% | 1,854.63 | 80.62% |
| Seasonal naive | 17.28% | 18.96% | 2,701.51 | 68.31% |
| Four-quarter median | 11.96% | 13.67% | 1,972.81 | 79.59% |

Pooled metrics are approximate, calculated from rounded quarter-level results and weighted by common observation counts, not transaction counts. 2024 coverage 77.58%; no imputation. Median lowest development MAPE, but prior-quarter lower 2024 MAE and better within-20% rate. Do not automatically select or authorize a production model based on this retrospective comparison. Source rights and independent contract evidence remain distinct gates. The new runner saves aggregate diagnostics only, not raw city records in published artifacts.
