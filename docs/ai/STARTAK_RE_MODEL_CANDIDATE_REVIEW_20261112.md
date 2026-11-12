# STARTAK Real Estate — Model candidate correction and deployment prohibition
**Reviewed:** 2026-11-12. **Scope:** turkialeid2030/startak-real-estate ONLY.

## What changed since C22/C23 recovery
The earlier candidate registry omitted two current official model IDs:
- OpenAI `gpt-6-luna`, listed for efficient high-volume focused tasks. [Official catalog](https://developers.openai.com/api/docs/models).
- Anthropic `claude-fable-5-2`, released November 9, 2026 for demanding long-horizon reasoning. [Official model specification](https://platform.claude.com/docs/en/models/fable-5-2/overview).

The official Claude Fable 5.2 page states a **30-day data-retention requirement**; zero data retention is unavailable **unless explicitly authorized by Anthropic**. Its high capability does *not* mean that private deeds, tenant data or owner records may be transmitted to it. Before even a non-production test with non-public documents, require source rights and retention/processing authorization. The catalog flags `ZERO_DATA_RETENTION_UNAVAILABLE_WITHOUT_VENDOR_EXCEPTION` in the absence of verified exception proof. The research catalog is deliberately not a live provider router.

## Current candidate baseline
OpenAI: GPT-6 Astra (`gpt-6-astra`), GPT-6.1 Sol (`gpt-6.1-sol`), GPT-6.1 Terra (`gpt-6.1-terra`), GPT-6 Luna (`gpt-6-luna`).  
Anthropic: Claude Fable 5.2 (`claude-fable-5-2`), Claude Opus 5.5, Sonnet 5.5, Haiku 5.5.  
Google: Gemini 3.8 Flash and Gemini 3.1 Pro Preview (preview `HOLD`).  
Google source: <https://ai.google.dev/gemini-api/docs/models>.

Model IDs appear in provider catalogs, but availability to **this account**, actual model capacity, API eligibility, regional inference/data storage, costs at observed volume, zero-training agreement, and sustained performance are **unverified**.

## Intended STARTAK property tasks
1. Independent audit of long-term cashflows, NOI, NPV, IRR, equity / debt structures, zakat, timing and a real-estate investment committee memo.
2. Document review / Saudi deed and building permit extraction: only on consented data with independently tested Arabic OCR.
3. Evidence-grounded real estate sale/rent comparable explanation (do not convert listings into executed transactions).
4. Batch categorization of source records after provenance and duplicate validations (do not treat generated output as trusted evidence).

**No autonomous purchases/sales/investment approvals; no market value or rental price based only on an LLM.** The deterministic calculation engine, explicit source chain and professional approval remain authoritative.

## Go/hold rubric
Before an authorized A/B comparison, confirm vendor account access, regional location of processing/storage, customer data training and retention agreement, PDPL/contract license, test corpus rights, sampling strategy, separately signed reference outputs and cost ceilings. Run *paired* cases with classification F1, property/parcel identity precision, invented numeric facts, unsupported citations, Arabic document OCR discrepancy rate, NOI/NPV/IRR absolute deviations, latency and SAR per case. Reserve holdouts not used for prompt calibration. Publish only aggregate anonymized results.
**Current result:** `CATALOG_DISCOVERY_VERIFIED`; `BENCHMARKED_MODEL_WINNER=NONE`; `MODEL_PRODUCTION_SWITCH=HOLD_NOT_AUTHORIZED`.
