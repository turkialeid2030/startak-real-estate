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


## Post-provider public-delivery gate — 22 October 2026 (PR #703)

Provider-reported success, a correct release identity and HTTP 200 are not sufficient
to mark a deployment fully delivered: the public CDN may independently return
an earlier HTML entry point or incomplete assets. A real failure of this type was
observed on 21 October 2026 in [acceptance run #39656203282](https://github.com/turkialeid2030/startak-real-estate/actions/runs/39656203282), attempt 1:
the public source read passed; the immediately subsequent asset-read failed
`ASSET_ENTRY_SOURCE_MISMATCH`.

After Wrangler, source confirmation and HTTP smoke, the authorized production
publication workflow now performs a mandatory **single, bounded** public
asset-manifest, HTML source, JS/CSS/Wasm byte/digest/MIME and missing-asset
404 check against the exact main SHA. Any observed failure stops that workflow
before it can announce publication success. The evidence is retained by an
`if: always()` artifact step without changing the failed job's conclusion.
An asset source mismatch records only bounded expected/observed commit IDs,
HTTP/cache/CDN response metadata and HTML digest; **not the HTML body or private
source documents**. Synthetic tests enforce no hidden asset retries and
preservation of failure states.

This does **not** undo bytes already published by Cloudflare, roll back a
deployment, prove multi-edge propagation, or establish historical root cause.
The separately triggered full three-engine deployed-owner acceptance remains
mandatory. Do not reinterpret an acceptance-on-rerun as proof that an earlier
failure never happened. Full N11 closure requires provider-specific root-cause
trace and independent bounded stability/recovery evidence.
