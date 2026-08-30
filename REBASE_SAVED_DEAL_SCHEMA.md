# REBASE_SAVED_DEAL_SCHEMA
Documented from actual current persistence code (src/app/App.jsx, unchanged since Wave A).

Storage: window.storage, key "deal:"+id for full records, "deals-index" for the list.
Record shape (exact, confirmed by direct source inspection):
```
{ id: "deal_"+Date.now(), name: string, mode: "building"|"land", inputs: object, savedAt: ISO-string }
```
No other fields exist. No version fields (formula_version/rule_version/etc.) exist in the legacy record -- confirmed absent (ARCH-004).
LEGACY_SAVED_DEAL_SCHEMA_DOCUMENTED = TRUE
