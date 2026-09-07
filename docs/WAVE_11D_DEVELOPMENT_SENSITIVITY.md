# Wave 11D — Development Property Sensitivity and Uncertainty

Status: engineering candidate only. No merge to `main`; no production deployment authorization.

Wave 11D adds deterministic, professionally supplied Development Property sensitivity around the qualified Wave 11C residual indication. It introduces no probability distribution and no Monte Carlo simulation.

Each scenario is explicitly reviewed and identified as `BASE`, `UPSIDE`, `DOWNSIDE`, `SEVERE`, or `CUSTOM`. The user supplies GDV, development-cost, finance-cost, fee and developer-return multipliers plus optional GDV/cost timing shifts. Exactly one neutral BASE scenario is required. Scenarios are never generated automatically and probability inputs are rejected.

The canonical sensitivity engine applies the explicit multipliers to the qualified Wave 11C economics and calculates a deterministic residual indication for every scenario. Timing shifts are recorded for development-risk traceability but have no numerical value effect because no discounting is introduced in Wave 11D.

The output records base/minimum/maximum residuals and range spread. These are scenario observations, not confidence intervals, P-values, P10/P50/P90 outputs, or probability-weighted conclusions.

A professional uncertainty assessment can then record one governed level (`LOW`, `MODERATE`, `HIGH`, `EXCEPTIONAL`), explicit drivers, rationale, evidence and reviewer. The system does not infer or auto-classify the uncertainty level.

Safety boundaries remain: no automatic scenario generation, no silent probabilities, no Monte Carlo, no automatic uncertainty classification, no automatic land-value selection or reconciliation, no final/certified valuation, no legal opinion and no transaction authority.

Qualification marker: `WAVE_11D_DEVELOPMENT_SENSITIVITY=PASS`.

Completion target for Wave 11: Cost Approach → governed land sales comparison → Development Property residual → deterministic sensitivity → explicit professional uncertainty, while preserving professional reconciliation for a later controlled wave.
