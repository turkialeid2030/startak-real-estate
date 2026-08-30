# EXTERNAL_PROVIDER_DECISION_REPORT

APPLICATION_FEATURE_FREEZE = TRUE. This report evaluates external providers only -- no application code was touched. `npm run release:verify` re-confirmed PASS before this evaluation (79/79, 0 audit critical/high, canonical hash unchanged).

EXTERNAL_PROVIDER_SELECTION_REQUIRED = TRUE (`GIT_REPOSITORY = NOT_PRESENT`, `PRODUCTION_HOST = NOT_CONFIGURED`, `LIVE_MONITORING_PROVIDER = NOT_CONFIGURED`).

All figures below are from web searches performed this session (current as of mid/late 2026), not from static training knowledge, given how fast these markets move.

---

## 1. Source control

`SOURCE_CONTROL_CRITERIA` = security, private-repo support, CI capability, deployment integration, permissions, ease of operation, cost, vendor lock-in, auditability.

| | GitHub | GitLab |
|---|---|---|
| FIT | Excellent for a small, single-maintainer static app | Good, but over-provisioned for this project's size |
| SECURITY | Secret scanning, dependency review (paid tier for private repos) | Built-in SAST/DAST even on lower tiers, but... |
| CI/CD | GitHub Actions: 2,000 free minutes/month on private repos | GitLab CI: 400 free minutes/month on Free tier |
| **Free-tier user cap** | **No user cap** on Free (public or private) | **Capped at 5 users** on Free tier -- a hard constraint if the team ever grows even modestly |
| OPERATING_COMPLEXITY | Low -- widest documentation/ecosystem | Low-medium -- more DevOps surface area than needed here |
| COST_MODEL | Free tier fully sufficient at this scale; Team $4/user/month if ever needed | Free tier viable short-term; Premium jumps to $29/user/month if the 5-user cap is hit |
| ADVANTAGES | Largest ecosystem, best documented Actions marketplace, no user-count anxiety | Integrated full DevOps platform (security scanning bundled) if the project ever grows into that |
| DISADVANTAGES | Advanced security scanning is a paid add-on | 5-user free cap is a real constraint for a growing team; steeper platform for a project this size |
| STARTAK_FIT_SCORE | **9/10** | 6/10 |

**RECOMMENDED_REPOSITORY_PROVIDER = GitHub**
**FALLBACK_REPOSITORY_PROVIDER = GitLab**

Reasoning: STARTAK is a single static frontend qualified by one CI job (`npm ci && npm run release:verify`). GitHub's free tier removes the one constraint (GitLab's 5-user cap) that could matter as this Saudi-based operation grows its team, at zero cost difference today.

---

## 2. Static hosting

STARTAK's architecture (static frontend, no backend, no database, no auth, no API) makes this a narrow, well-understood hosting problem -- avoid over-engineering.

| | Cloudflare Pages | Vercel | Netlify |
|---|---|---|---|
| SECURITY | Strongest -- full edge platform (WAF/Zero Trust available), headers set via `_headers` file or a `_middleware` function | Added firewall/WAF in 2026, good | Good, standard |
| HTTPS | Automatic, free | Automatic, free | Automatic, free |
| CUSTOM_DOMAIN | Yes, free | Yes, free (Hobby) | Yes, free |
| SECURITY_HEADERS | Fully controllable via `_headers`/Pages Functions | Fully controllable via `vercel.json` | Fully controllable via `netlify.toml` |
| CI_INTEGRATION | Git-based auto-deploy, works with GitHub directly | Git-based auto-deploy | Git-based auto-deploy |
| ROLLBACK | Instant rollback to any previous deployment | Instant rollback | Instant rollback |
| OPERATING_COMPLEXITY | Low for pure static (no framework-specific magic needed) | Low, but tuned toward Next.js specifically (STARTAK is plain Vite/React, doesn't need this) | Low |
| **Free-tier bandwidth** | **Unlimited** -- the only one of the three with no bandwidth metering | 100GB/month, 6,000 build minutes | 100GB/month, and Netlify **cut its free build allowance in 2025/2026** (300→credit-based, now more restrictive) |
| PERFORMANCE (Saudi/GCC) | 300+ global PoPs, strong Middle East presence | Strong global CDN, slightly behind Cloudflare's edge count | Comparable to Vercel |
| COST | **FREE_TIER_AVAILABLE** indefinitely for a 644KB static app | FREE_TIER_AVAILABLE, but paid tier ($20/mo) is Next.js-oriented and not needed here | FREE_TIER_AVAILABLE but recently tightened |
| STARTAK_FIT_SCORE | **9/10** | 6/10 (over-fits Next.js-specific tooling STARTAK doesn't use) | 6/10 |

**RECOMMENDED_PRODUCTION_HOST = Cloudflare Pages**
**FALLBACK_PRODUCTION_HOST = Vercel**

Reasoning: unlimited free bandwidth removes a real future cost risk entirely; strong regional performance for a Saudi-based product; full header/CSP control without a backend; native GitHub integration for CI-driven deploys. Vercel/Netlify's differentiators (advanced SSR, plugin ecosystems) address problems STARTAK does not have.

---

## 3. Live monitoring

| | Sentry |
|---|---|
| CLIENT_ERROR_CAPTURE | Purpose-built, excellent JS/React SDK, matches the existing `window.onerror`/`unhandledrejection` hooks already implemented |
| RELEASE_TRACKING | Built-in release/version correlation -- matches the `appVersion`/`buildHash` fields already in the app's telemetry envelope |
| SOURCE_MAP_SUPPRT | Private, authenticated source-map upload at build time (never public) -- compatible with keeping `PRODUCTION_SOURCEMAPS = DISABLED` publicly |
| DATA_MINIMIZATION | Configurable `beforeSend` filtering -- compatible with the existing `sanitizeEnvelope()` allowlist (only 8 coarse fields ever leave the app) |
| REGION/DATA_CONSIDERATIONS | EU/US data-region choice available at account creation -- worth selecting explicitly for a Saudi-operated product |
| COST | **FREE_TIER_AVAILABLE**: 5,000 errors/month, 1 user, 30-day retention -- almost certainly sufficient for this application's expected error volume |
| OPERATING_COMPLEXITY | Low -- one SDK install, one DSN, matches the existing provider-agnostic `reportRuntimeError()` boundary exactly |
| STARTAK_FIT_SCORE | **9/10** |

No serious alternative was evaluated in depth because Sentry's free tier directly matches this application's scale, and the existing `report-runtime-error.js` abstraction was designed against exactly this kind of provider (safe envelope, no vendor lock-in until `sendToProvider()` is implemented).

**RECOMMENDED_MONITORING_PROVIDER = Sentry**
**FALLBACK_MONITORING_PROVIDER = self-hosted/open-source alternative (e.g. GlitchTip) only if data-residency requirements later demand it**

---

## 4. Domain decision

`CUSTOM_DOMAIN_REQUIRED_FOR_TECHNICAL_GO_LIVE = FALSE` (Cloudflare Pages provides a working `*.pages.dev` subdomain immediately).
`CUSTOM_DOMAIN_RECOMMENDED_FOR_INSTITUTIONAL_RELEASE = TRUE` (a branded domain matters for a real-estate investment tool used institutionally).
`DOMAIN_STATUS = HUMAN_DECISION_REQUIRED`.

---

## 5. Cost classification summary

| Component | Classification |
|---|---|
| GitHub (this scale) | FREE_TIER_AVAILABLE |
| Cloudflare Pages (this scale) | FREE_TIER_AVAILABLE |
| Sentry (this scale) | FREE_TIER_AVAILABLE |
| Custom domain (if chosen) | LOW_COST (typical registrar pricing; PRICE = REQUIRES_CURRENT_PROVIDER_VERIFICATION -- not invented here) |

**Realistic total ongoing cost at this application's scale: $0/month**, before any optional domain registration.

---

## 6. Recommended coherent stack

```
SOURCE CONTROL:  GitHub (free tier)
CI/CD:           GitHub Actions, invoking `npm ci && npm run release:verify`
STATIC HOST:     Cloudflare Pages (free tier), connected directly to the GitHub repo
MONITORING:      Sentry (free Developer tier)
CUSTOM DOMAIN:   Optional, human decision
```

**Why this fits together**: GitHub → Cloudflare Pages is a first-class, zero-config Git integration (push to main → auto-deploy). Cloudflare's `_headers` file gives full control over the CSP/security-header policy already defined and locally validated in `CSP_POLICY.md`. Sentry's SDK drops directly into the existing `report-runtime-error.js` boundary with zero architecture change. All three have free tiers that comfortably cover this application's actual scale (644KB static bundle, single small team) -- no enterprise infrastructure is being introduced for a project that doesn't need it (`NO_BACKEND = TRUE`, `NO_DATABASE = TRUE`, `NO_AUTH = TRUE` all preserved).

---

## 7. Planned (not executed) activation sequence

Repository: create private GitHub repo → local `git init` → verify `.gitignore` → stage → secret scan → first commit → push → branch protection on `main` → add Actions workflow calling `release:verify`.

Deployment: connect Cloudflare Pages to the GitHub repo → set build command `npm run build`, output `dist/` → add `_headers` file with the CSP policy → verify HTTPS → optional custom domain.

Monitoring: create Sentry project → receive DSN → implement `sendToProvider()` in `report-runtime-error.js` using that DSN → verify a synthetic error is received → confirm zero false positives during normal Building/Land/Saved-Deals/backup-restore workflows.

**None of this was executed.**
