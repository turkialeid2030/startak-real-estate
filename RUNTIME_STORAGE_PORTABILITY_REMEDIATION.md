# RUNTIME_STORAGE_PORTABILITY_REMEDIATION
PROPOSAL ONLY -- NOT IMPLEMENTED THIS WAVE.

## Problem
All 8 Saved Deals persistence call sites (App.jsx lines 1267/1288/1310/1312/1330/1332/1344/1346) call `window.storage` directly. This API exists only in the original artifact-hosting environment and is `undefined` in a standalone Vite/Chromium runtime, causing every save/load/delete operation to fail (safely caught, but non-functional).

## Recommended architecture
```
Saved Deals UI (App.jsx)
    v
SavedDealRepository            <- single call site App.jsx would use instead of window.storage.*
    v
StorageProvider interface
    +-- HostStorageProvider          uses window.storage when typeof window.storage !== 'undefined'
    +-- BrowserLocalStorageProvider  standalone Vite fallback, uses window.localStorage
```
App.jsx must NOT call both APIs directly (per instruction) -- the environment distinction is centralized in one provider-selection point, not scattered across 8 call sites.

## StorageProvider contract (proposed, matches actual current usage exactly)
```
interface StorageProvider {
  getItem(key: string): Promise<string|null>   // matches window.storage.get(key, false) -> {value}
  setItem(key: string, value: string): Promise<void>  // matches window.storage.set(key, value, false)
  removeItem(key: string): Promise<void>        // matches window.storage.delete(key, false)
  isAvailable(): boolean
  providerName(): string
}
```
Current Saved Deal record schema ({id, name, mode, inputs, savedAt}) is preserved exactly -- no migration, no validation added.

## Fallback policy (proposed)
1. If `typeof window.storage !== 'undefined'` -> HostStorageProvider
2. Else if `typeof window.localStorage !== 'undefined'` -> BrowserLocalStorageProvider
3. Else -> throw explicit PersistenceUnavailable error (no silent success)

## Severity
RUNTIME-PORT-001: Saved Deals Host-Specific Storage Dependency, Severity HIGH -- current core feature (Saved Deals) is completely non-functional in any standalone deployment of this application, with real user-facing data-loss risk (a user who clicks Save believes the action succeeded up to the point of the caught error, but nothing persists).

Kept separate from DEF-001..004 (unchanged, unaffected).

## Explicitly NOT done this wave
No code written. No App.jsx call site touched. No provider file created.
