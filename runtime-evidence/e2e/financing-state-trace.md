# financing-state-trace

FINANCING_STATE_VARIABLE = inputs.leverageEnabled (field within buildingInputs/landInputs, NOT a standalone useState)
FINANCING_STATE_SETTER = patch("leverageEnabled", value) -- the same generic setter used for every other input field
FINANCING_ENGINE_PARAMETER = leverageEnabled -- passed directly into calculateInvestmentCase({ studyType, inputs, leverageEnabled }) (App.jsx line 481)

## Trace: UI control -> setter -> engine -> rendered result
1. Toggle component (App.jsx line 244) renders a <button onClick={() => onChange(!checked)}>, where checked={inputs.leverageEnabled} and onChange is wired to patch("leverageEnabled", ...).
2. patch() updates the active study's input object (buildingInputs or landInputs) via setBuildingInputs/setLandInputs.
3. App.jsx line 481's useMemo recomputes results = calculateInvestmentCase({ studyType, inputs, leverageEnabled: inputs.leverageEnabled }) whenever inputs changes.
4. Rendered fields conditioned on inputs.leverageEnabled (line 634, line 664) switch between unlevered and levered result displays (DSCR, loan amount, levered IRR, equity investment, etc.).

This confirms the toggle is wired correctly end-to-end at the React/data-flow level -- the diagnosed failure is purely a DOM hit-testing issue at the exact moment of the Playwright-simulated click, not a broken state binding.
