# Decision Integrity Remediation — Test Matrix

| Area | Defect / Risk | Expected remediation behavior |
|---|---|---|
| Land construction cost | Negative cost could manufacture favorable economics | Reject negative `constructionCostPerSqm` before calculation |
| Land geometry | Negative dimensions could corrupt areas/costs | Reject negative dimensions |
| Structural counts | Fractional floors/basements are not physical | Reject fractional structural counts |
| Fractional financial periods | Monthly financing supports e.g. 2.5 years | Preserve supported fractional periods |
| Existing Building criteria | UI displayed price-basis yield/payback while engine used cost basis | UI and engine use identical criterion basis |
| Land criterion c2 | UI described yield-on-cost while engine evaluated NPV | UI displays NPV ≥ 0 for c2 |
| Hidden hard gates | NOI/NPV gates affected verdict but were not visible | Display every engine criterion affecting analytical result |
| First-year vs stabilized | Building income rows mixed periods | Label and display first-year and stabilized values separately |
| Governed OPEX | Land V2 material OPEX assumptions were not visible | Display governed assumptions and OPEX decomposition |
| Financing semantics | Murabaha/Ijarah proxy could be read as exact contract model | Explicit proxy/term-sheet boundary disclosure |
| Blank numeric editing | Temporary blank input became zero | Do not silently coerce blank edit to zero |
| Incomplete inputs | Hold state could look like negative/no-buy | Render as pending/incomplete state |
| External scope | Financial output could look like final transaction recommendation | Label as financial analytical result; legal/regulatory review remains separate |

## Automated evidence

`tests/defects/decision_integrity_wave.js` verifies arithmetic identities, invalid input rejection, engine/UI criterion bindings, financing proxy semantics, and the absence of silent blank-to-zero handlers.

Qualification is complete only if the ordinary PR CI suite also passes on the exact final branch head.
