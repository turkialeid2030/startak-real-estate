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


## Per-resource edge diagnostics — 22 October 2026 (follow-up)

First exact-main publication of #703 had a **bounded post-deploy delivery PASS**
for 24/24 assets, then independent owner acceptance at nearly the same time
failed for a declared JavaScript asset that returned HTTP 404 and HTML.
The two observations came from distinct CI workers and do not prove an
intermittent browser defect or establish Cloudflare's root cause.

The asset verifier now records, alongside every asset's SHA-256 and status,
its response timestamp, bounded `cf-ray`, `cf-cache-status`, `cache-control`,
`age` and `server` headers. It retains similarly bounded provenance for
the HTML entry, asset manifest and intentional 404 probe. This makes it
possible to compare actual delivery locations/headers, rather than assume
two requests traversed the same edge. No cookies, authorization, HTML
body, asset body or credentials are stored in this evidence. The verifier
still performs a single observation with no automatic retry and rejects
any mismatched bytes, MIME, status, digest or source commit.

Required operator follow-up for N11: retain the PASS and FAIL artifacts;
align timestamps, `cf-ray`, provider deployment ID, asset path/hash and
relevant cache configuration; request CDN/provider edge logs when available
through an authorized operator; demonstrate repeatable correction and
independently observed propagation before closing root-cause evidence.
Even repeated PASS results do not by themselves identify historical causation.


## Exact-main owner-commanded public acceptance — 23 October 2026

An asset-verifier-only change is not necessarily included in the
`push.paths` of the full deployed-owner browser-acceptance workflow.
A successful production deployment cannot be taken as a substitute for
published full-browser acceptance on the *same* main SHA.

The existing acceptance workflow therefore accepts an additional
owner-only `issue_comment` command on tracker #396:

```text
/startak accept-production <exact-current-main-40-character-sha>
```

The workflow requires the issue author to be the repository owner with
OWNER association, the comment to match the strict full SHA command,
and the requested SHA to match both the GitHub event commit and
current `refs/heads/main` from the remote. A moved main, malformed
input or another actor fails before any browser acceptance can start.
It preserves the existing push and manual UI trigger, source-bound
build manifest and byte/MIME/404 check, and all owner/financial/PDF/OCR,
lease, recovery and three-browser gates. A passing set of tests on an
earlier SHA must never be reported as acceptance of current main.

This command does **not** publish or permit institutional readiness.
It is read-only testing of the exact current public release and remains
separate from the authorized `/startak deploy-production` command.
Records from earlier failed observations remain part of N11 history.
