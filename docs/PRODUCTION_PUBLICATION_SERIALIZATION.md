# Production publication coordination — 21 October 2026

The trusted-main deployment workflow previously checked main only when the job
started. Main could advance during release verification while the older job
continued to publish. Concurrent authorized deployment jobs were not serialized.

The authorized deployment job now shares a concurrency group with cancellation
of an active job disabled. It requires provider automatic production deployments
to be disabled, rechecks the exact main SHA immediately before calling Wrangler,
and rechecks it when provider deployment identity is acknowledged. A moved main,
malformed response or failed read blocks successful acknowledgment; a prepublish
failure does not call Wrangler. These are read-only checks and preserve existing
owner authorization, production environment, credential handling and fail-closed
public-provider settings. There is no automatic rollback, retry or activation.

The executable test runs the actual publication shell step against isolated
synthetic Git/CLI stand-ins. Matching main reaches publication with the exact SHA;
moved main exits with no provider publication call. Domain tests cover malformed
responses and untrusted repository/SHA inputs. Existing trusted-main, release,
supply-chain and public acceptance gates remain mandatory.

This closes the identified workflow race window within the cooperating deployment
path. GitHub and Cloudflare are not one atomic transaction: main can change during
provider publication, and noncooperating console/other automation can still race.
The final recheck detects observed drift, rather than silently claiming the old
SHA is current. Evidence from the actual deployment is recorded in the PR.

No evidence identifies this race as the cause of the earlier missing-asset/HTML
incident. That root cause remains open. Asset byte/MIME/404 acceptance proves its
bounded observation, not permanent availability or historical causation.

Primary workflow semantics: [GitHub concurrency documentation](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency).
