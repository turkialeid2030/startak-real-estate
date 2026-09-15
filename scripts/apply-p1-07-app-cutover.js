'use strict';
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '../src/app/App.jsx');
let s = fs.readFileSync(file, 'utf8');
function once(oldText, newText, label) {
  const n = s.split(oldText).length - 1;
  if (n !== 1) throw new Error(`${label}: expected exactly one match, found ${n}`);
  s = s.replace(oldText, newText);
}

once(
"const { ASSUMPTION_MODEL_VERSION } = require('../assumptions/assumption-model');",
"const { ASSUMPTION_MODEL_VERSION } = require('../assumptions/assumption-model');\nconst {\n  APP_WORKSPACE_KIND,\n  createAppNewWorkspace,\n  createAppDemoWorkspace,\n  legacyHydrationDefaults,\n  evaluateAppCalculationReadiness,\n} = require('../decision-governance/app-workspace-cutover');",
'import governed cutover boundary');

once(
`  const [activeTab, setActiveTab] = useState("dashboard");
  const [buildingInputs, setBuildingInputs] = useState(
    () => createUiWorkspace({ mode: UI_MODE.BUILDING, defaultInputs: DEFAULT_BUILDING_INPUTS }).inputs,
  );
  const [buildingAssumptionModelVersion, setBuildingAssumptionModelVersion] = useState(ASSUMPTION_MODEL_VERSION.V2);
  const [landInputs, setLandInputs] = useState(
    () => createUiWorkspace({ mode: UI_MODE.LAND, defaultInputs: DEFAULT_LAND_INPUTS }).inputs,
  );
  const [landAssumptionModelVersion, setLandAssumptionModelVersion] = useState(ASSUMPTION_MODEL_VERSION.V2);`,
`  const [activeTab, setActiveTab] = useState("dashboard");
  const [workspaceKind, setWorkspaceKind] = useState(APP_WORKSPACE_KIND.NEW);
  const [buildingInputs, setBuildingInputs] = useState(() => createAppNewWorkspace(UI_MODE.BUILDING).inputs);
  const [buildingAssumptionModelVersion, setBuildingAssumptionModelVersion] = useState(ASSUMPTION_MODEL_VERSION.V2);
  const [landInputs, setLandInputs] = useState(() => createAppNewWorkspace(UI_MODE.LAND).inputs);
  const [landAssumptionModelVersion, setLandAssumptionModelVersion] = useState(ASSUMPTION_MODEL_VERSION.V2);`,
'blank New Deal initialization');

once(
`  const buildingUiState = useMemo(() => {
    try {
      const state = calculateUiInvestmentState({`,
`  const buildingUiState = useMemo(() => {
    const readiness = evaluateAppCalculationReadiness({ kind: workspaceKind, mode: UI_MODE.BUILDING, inputs: buildingInputs });
    if (!readiness.calculationAllowed) return { results: null, governance: null, sensitivityReady: false, sensitivityRenderPolicy: 'HOLD_INCOMPLETE_INPUTS', readiness };
    try {
      const state = calculateUiInvestmentState({`,
'building calculation readiness');

once(
`        if (lastValidBuildingUiState.current) return lastValidBuildingUiState.current;
        const fallback = createUiWorkspace({ mode: UI_MODE.BUILDING, defaultInputs: DEFAULT_BUILDING_INPUTS });
        return calculateUiInvestmentState({ mode: UI_MODE.BUILDING, inputs: fallback.inputs, assumptionModelVersion: fallback.assumptionModelVersion });`,
`        if (lastValidBuildingUiState.current && workspaceKind !== APP_WORKSPACE_KIND.NEW) return lastValidBuildingUiState.current;
        return { results: null, governance: null, sensitivityReady: false, sensitivityRenderPolicy: 'HOLD_INVALID_INPUTS', readiness };`,
'remove building Demo validation fallback');

once(
`  }, [buildingInputs, buildingAssumptionModelVersion]);`,
`  }, [buildingInputs, buildingAssumptionModelVersion, workspaceKind]);`,
'building memo dependencies');

once(
`  const landUiState = useMemo(() => {
    try {
      const state = calculateUiInvestmentState({`,
`  const landUiState = useMemo(() => {
    const readiness = evaluateAppCalculationReadiness({ kind: workspaceKind, mode: UI_MODE.LAND, inputs: landInputs });
    if (!readiness.calculationAllowed) return { results: null, governance: null, sensitivityReady: false, sensitivityRenderPolicy: 'HOLD_INCOMPLETE_INPUTS', readiness };
    try {
      const state = calculateUiInvestmentState({`,
'land calculation readiness');

once(
`        if (lastValidLandUiState.current) return lastValidLandUiState.current;
        const fallback = createUiWorkspace({ mode: UI_MODE.LAND, defaultInputs: DEFAULT_LAND_INPUTS });
        return calculateUiInvestmentState({ mode: UI_MODE.LAND, inputs: fallback.inputs, assumptionModelVersion: fallback.assumptionModelVersion });`,
`        if (lastValidLandUiState.current && workspaceKind !== APP_WORKSPACE_KIND.NEW) return lastValidLandUiState.current;
        return { results: null, governance: null, sensitivityReady: false, sensitivityRenderPolicy: 'HOLD_INVALID_INPUTS', readiness };`,
'remove land Demo validation fallback');

once(
`  }, [landInputs, landAssumptionModelVersion]);`,
`  }, [landInputs, landAssumptionModelVersion, workspaceKind]);`,
'land memo dependencies');

once(
`  const loadBuiltIn = (builtInMode) => {
    setMode(builtInMode);
    if (builtInMode === UI_MODE.BUILDING) {
      const workspace = createUiWorkspace({ mode: UI_MODE.BUILDING, defaultInputs: DEFAULT_BUILDING_INPUTS });
      setBuildingInputs(workspace.inputs);
      setBuildingAssumptionModelVersion(workspace.assumptionModelVersion);
    } else {
      const workspace = createUiWorkspace({ mode: UI_MODE.LAND, defaultInputs: DEFAULT_LAND_INPUTS });
      setLandInputs(workspace.inputs);
      setLandAssumptionModelVersion(workspace.assumptionModelVersion);
    }`,
`  const loadBuiltIn = (builtInMode) => {
    setMode(builtInMode);
    setWorkspaceKind(APP_WORKSPACE_KIND.DEMO);
    const workspace = createAppDemoWorkspace(builtInMode);
    if (builtInMode === UI_MODE.BUILDING) {
      setBuildingInputs(workspace.inputs);
      setBuildingAssumptionModelVersion(ASSUMPTION_MODEL_VERSION.V2);
    } else {
      setLandInputs(workspace.inputs);
      setLandAssumptionModelVersion(ASSUMPTION_MODEL_VERSION.V2);
    }`,
'explicit Demo load');

once(
`        defaultInputs: record.mode === UI_MODE.BUILDING ? DEFAULT_BUILDING_INPUTS : DEFAULT_LAND_INPUTS,`,
`        defaultInputs: legacyHydrationDefaults(record.mode),`,
'legacy hydration defaults');

once(
`      setMode(hydrated.mode);`,
`      setMode(hydrated.mode);
      setWorkspaceKind(APP_WORKSPACE_KIND.SAVED);`,
'saved workspace provenance');

once(
`    } else if (mode === "building") {
      const workspace = createUiWorkspace({ mode: UI_MODE.BUILDING, defaultInputs: DEFAULT_BUILDING_INPUTS });
      setBuildingInputs(workspace.inputs);
      setBuildingAssumptionModelVersion(workspace.assumptionModelVersion);`,
`    } else if (mode === "building") {
      const workspace = createAppNewWorkspace(UI_MODE.BUILDING);
      setWorkspaceKind(APP_WORKSPACE_KIND.NEW);
      setBuildingInputs(workspace.inputs);
      setBuildingAssumptionModelVersion(ASSUMPTION_MODEL_VERSION.V2);`,
'building reset to blank New Deal');

once(
`    } else {
      const workspace = createUiWorkspace({ mode: UI_MODE.LAND, defaultInputs: DEFAULT_LAND_INPUTS });
      setLandInputs(workspace.inputs);
      setLandAssumptionModelVersion(workspace.assumptionModelVersion);
      setValuationCase(null);
    }
  };`,
`    } else {
      const workspace = createAppNewWorkspace(UI_MODE.LAND);
      setWorkspaceKind(APP_WORKSPACE_KIND.NEW);
      setLandInputs(workspace.inputs);
      setLandAssumptionModelVersion(ASSUMPTION_MODEL_VERSION.V2);
      setValuationCase(null);
    }
  };`,
'land reset to blank New Deal');

once(
`            <ModeSwitch mode={mode} setMode={(m) => {
              setMode(m);
              setActiveDealId(null);`,
`            <ModeSwitch mode={mode} setMode={(m) => {
              setMode(m);
              setWorkspaceKind(APP_WORKSPACE_KIND.NEW);
              const workspace = createAppNewWorkspace(m);
              if (m === UI_MODE.BUILDING) setBuildingInputs(workspace.inputs); else setLandInputs(workspace.inputs);
              setActiveDealId(null);`,
'mode switch starts blank New Deal');

once(
`        <KPIRibbon mode={mode} results={results} leverageEnabled={inputs.leverageEnabled} />`,
`        {results ? <KPIRibbon mode={mode} results={results} leverageEnabled={inputs.leverageEnabled} /> : (
          <div data-testid="analysis-incomplete" className="rounded-2xl mb-4 px-4 py-3" style={{ background: COLORS.panelRaised, border: \`1px solid \${COLORS.hairline}\`, color: COLORS.slate }}>
            {locale === 'en' ? 'Complete the required deal inputs to run financial analysis.' : 'أكمل بيانات الصفقة الأساسية المطلوبة لتشغيل التحليل المالي.'}
          </div>
        )}`,
'fail-closed KPI rendering');

once(
`            {activeTab === "dashboard" && <DashboardTab mode={mode} inputs={inputs} results={results} />}
            {activeTab === "cashflow" && <CashFlowTab mode={mode} inputs={inputs} results={results} zakatCase={zakatCase} />}
            {activeTab === "sensitivity" && <SensitivityTab`,
`            {results && activeTab === "dashboard" && <DashboardTab mode={mode} inputs={inputs} results={results} />}
            {results && activeTab === "cashflow" && <CashFlowTab mode={mode} inputs={inputs} results={results} zakatCase={zakatCase} />}
            {results && activeTab === "sensitivity" && <SensitivityTab`,
'gate result tabs');

once(
`        {mode === "building" ? (
          <ValuationIntelligencePanel`,
`        {mode === "building" && results ? (
          <ValuationIntelligencePanel`,
'gate valuation runtime UI');

fs.writeFileSync(file, s, 'utf8');
console.log('P1_07_APP_CUTOVER_PATCH=APPLIED');
