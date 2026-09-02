# RIAI-01C — OPEX and Technical CAPEX

## Scope

This wave extends the Residential Income Acquisition operating contract with property-level operating expenses and technical/deferred-maintenance capital items.

Operating expenses preserve four distinct bases:

- `ACTUAL`
- `BUDGET`
- `NORMALIZED`
- `BENCHMARK`

Technical CAPEX preserves category, severity, immediate/deferred timing, life-safety and compliance flags, required date, downtime, evidence lineage, and whether cost is known.

## Fail-closed rules

1. OPEX must use adopted evidence-aware values with `SAR/year`; a normalized total is unavailable if any explicitly supplied normalized item is unresolved.
2. CAPEX must use adopted evidence-aware values with `SAR`; an unpriced item remains `null`, not zero.
3. Any unknown CAPEX cost prevents a complete CAPEX total and acquisition-basis adjustment.
4. Unknown critical or life-safety cost creates a dedicated due-diligence requirement.
5. The engine does not calculate stabilized NOI, price, value, returns, or an investment decision.

## Reference-derived regression cases

The tests use sanitized scenarios derived from the supplied maintenance schedule: roof waterproofing and electrical items with known costs, plus a critical fire-protection item with unknown cost. They also preserve an explicitly omitted management expense as unavailable rather than zero.

## Remaining boundary

The engine can only assess the inventory supplied to it. A complete OPEX inventory and completed technical assessment are upstream evidence requirements; absence of a record is not proof that the cost does not exist.
