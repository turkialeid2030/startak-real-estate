'use strict';

const WIRING_MARKER = '// WAVE2_PRODUCTION_UI_WIRING_V1';

function invariant(condition, message) {
  if (!condition) {
    const error = new Error(message);
    error.code = 'WAVE2_APP_WIRING_ANCHOR_MISMATCH';
    throw error;
  }
}

function replaceExactOnce(source, search, replacement, label) {
  const first = source.indexOf(search);
  invariant(first !== -1, `${label}: anchor not found`);
  invariant(source.indexOf(search, first + search.length) === -1, `${label}: anchor is not unique`);
  return source.slice(0, first) + replacement + source.slice(first + search.length);
}

function replaceRegexOnce(source, regex, replacement, label) {
  const flags = regex.flags.includes('g') ? regex.flags : `${regex.flags}g`;
  const finder = new RegExp(regex.source, flags);
  const matches = [...source.matchAll(finder)];
  invariant(matches.length === 1, `${label}: expected exactly one match, found ${matches.length}`);
  const match = matches[0];
  const rendered = typeof replacement === 'function'
    ? replacement(...match, match.index, source)
    : match[0].replace(new RegExp(regex.source, regex.flags.replace('g', '')), replacement);
  return source.slice(0, match.index) + rendered + source.slice(match.index + match[0].length);
}

function transformAppSource(input) {
  invariant(typeof input === 'string' && input.length > 0, 'App source must be a non-empty string');
  if (input.includes(WIRING_MARKER)) {
    return { source: input, changed: false, alreadyApplied: true };
  }

  let source = input;

  const importAnchor = "const { valuationCaseFromSavedDeal, withValuationCase } = require('./valuation-saved-deal-bridge');";
  source = replaceExactOnce(source, importAnchor, `${importAnchor}\nconst {\n  UI_MODE,\n  createUiWorkspace,\n  hydrateUiDeal,\n  calculateUiInvestmentState,\n  applyExitCapInputText,\n  buildUiDisclosureViewModel,\n  prepareNewUiDealForSave,\n  prepareUpdatedUiDealForSave,\n} = require('../assumptions/ui-integration-controller');\nconst { ASSUMPTION_MODEL_VERSION } = require('../assumptions/assumption-model');\nconst { isFiniteNumber } = require('../assumptions/ui-safe-formatters');\n${WIRING_MARKER}`, 'Wave 2 imports');

  // JavaScript's global isFinite(null) is true. Never let missing deterministic
  // outputs render as numeric zero on a governed decision surface.
  source = source.replace(/(^|[^.\w])isFinite\(/gm, '$1isFiniteNumber(');

  const oldNumField = `function NumField({ label, unit, note, value, onChange, step = 1, min, warnBelow, warnAbove, warnText }) {
  const { t } = useLocale();
  const warning = rangeWarning(value, warnBelow, warnAbove, warnText, t);
  return (
    <Field label={label} unit={unit}>
      <input
        type="text"
        inputMode="decimal"
        className="rf-input rf-num w-full px-3 py-2 text-sm"
        style={baseInputStyle()}
        value={value}
        aria-invalid={warning ? "true" : undefined}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^\\d.\\-]/g, "");
          const parsed = parseFloat(raw);
          onChange(isNaN(parsed) ? 0 : (min !== undefined ? Math.max(min, parsed) : parsed));
        }}
      />
      <FieldNote note={note} warning={warning} />
    </Field>
  );
}`;
  const newNumField = `function NumField({ label, unit, note, value, onChange, step = 1, min, warnBelow, warnAbove, warnText, disabled = false }) {
  const { t } = useLocale();
  const warning = rangeWarning(value, warnBelow, warnAbove, warnText, t);
  return (
    <Field label={label} unit={unit}>
      <input
        type="text"
        inputMode="decimal"
        className="rf-input rf-num w-full px-3 py-2 text-sm"
        style={{ ...baseInputStyle(), opacity: disabled ? 0.65 : 1, cursor: disabled ? "not-allowed" : "text" }}
        value={value}
        disabled={disabled}
        aria-invalid={warning ? "true" : undefined}
        onChange={(e) => {
          if (disabled) return;
          const raw = e.target.value.replace(/[^\\d.\\-]/g, "");
          const parsed = parseFloat(raw);
          onChange(isNaN(parsed) ? 0 : (min !== undefined ? Math.max(min, parsed) : parsed));
        }}
      />
      <FieldNote note={note} warning={warning} />
    </Field>
  );
}`;
  source = replaceExactOnce(source, oldNumField, newNumField, 'NumField governed read-only support');

  const oldPercentField = `function PercentField({ label, note, value, onChange, warnBelow, warnAbove, warnText }) {
  const { t } = useLocale();
  const warning = rangeWarning(value, warnBelow, warnAbove, warnText, t);
  return (
    <Field label={label} unit="%">
      <input
        type="text"
        inputMode="decimal"
        className="rf-input rf-num w-full px-3 py-2 text-sm"
        style={baseInputStyle()}
        value={Number((value * 100).toFixed(4))}
        aria-invalid={warning ? "true" : undefined}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^\\d.\\-]/g, "");
          const parsed = parseFloat(raw);
          onChange(isNaN(parsed) ? 0 : parsed / 100);
        }}
      />
      <FieldNote note={note} warning={warning} />
    </Field>
  );
}`;
  const newPercentField = `function PercentField({ label, note, value, onChange, warnBelow, warnAbove, warnText, disabled = false }) {
  const { t } = useLocale();
  const warning = rangeWarning(value, warnBelow, warnAbove, warnText, t);
  return (
    <Field label={label} unit="%">
      <input
        type="text"
        inputMode="decimal"
        className="rf-input rf-num w-full px-3 py-2 text-sm"
        style={{ ...baseInputStyle(), opacity: disabled ? 0.65 : 1, cursor: disabled ? "not-allowed" : "text" }}
        value={Number((value * 100).toFixed(4))}
        disabled={disabled}
        aria-invalid={warning ? "true" : undefined}
        onChange={(e) => {
          if (disabled) return;
          const raw = e.target.value.replace(/[^\\d.\\-]/g, "");
          const parsed = parseFloat(raw);
          onChange(isNaN(parsed) ? 0 : parsed / 100);
        }}
      />
      <FieldNote note={note} warning={warning} />
    </Field>
  );
}

function OptionalPercentField({ label, note, value, onCommit, min = 0, max = 1 }) {
  const { locale } = useLocale();
  const formatRaw = (candidate) => candidate === null || candidate === undefined || !isFiniteNumber(candidate)
    ? ""
    : String(Number((candidate * 100).toFixed(4)));
  const [raw, setRaw] = useState(() => formatRaw(value));
  const [error, setError] = useState(null);

  useEffect(() => {
    setRaw(formatRaw(value));
    setError(null);
  }, [value]);

  const commit = () => {
    try {
      const outcome = onCommit(raw);
      if (outcome && outcome.ok === false) {
        setError(outcome.code || 'OPTIONAL_PERCENT_INVALID');
        return;
      }
      if (outcome && typeof outcome.displayValue === 'string') setRaw(outcome.displayValue);
      setError(null);
    } catch (commitError) {
      setError(commitError && commitError.code ? commitError.code : 'OPTIONAL_PERCENT_INVALID');
    }
  };

  return (
    <Field label={label} unit="%">
      <input
        type="text"
        inputMode="decimal"
        className="rf-input rf-num w-full px-3 py-2 text-sm"
        style={baseInputStyle()}
        value={raw}
        aria-invalid={error ? "true" : undefined}
        onChange={(e) => {
          setRaw(e.target.value.replace(/[^\\d.\\-]/g, ""));
          if (error) setError(null);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            setRaw(formatRaw(value));
            setError(null);
          }
        }}
      />
      <FieldNote
        note={note}
        warning={error ? (locale === 'en' ? 'Enter a valid explicit exit cap within the permitted range.' : 'أدخل معدل خروج صريحاً وصحيحاً ضمن النطاق المسموح.') : null}
      />
    </Field>
  );
}`;
  source = replaceExactOnce(source, oldPercentField, newPercentField, 'PercentField and nullable exit-cap field');

  source = replaceExactOnce(source, 'function buildSensitivityData(mode, inputs, t) {', 'function buildSensitivityData(mode, inputs, t, assumptionModelVersion) {', 'Sensitivity function signature');
  source = replaceExactOnce(
    source,
    '{ key: "marketCapRate", label: t("sensitivity.varMarketCapRate") },',
    '{ key: assumptionModelVersion === ASSUMPTION_MODEL_VERSION.V2 ? "exitCapRate" : "marketCapRate", label: assumptionModelVersion === ASSUMPTION_MODEL_VERSION.V2 ? t("inputBuilding.exitCapRate") : t("sensitivity.varMarketCapRate") },',
    'Sensitivity exit-cap variable',
  );
  source = replaceRegexOnce(
    source,
    /const calc = \(i\) => calculateInvestmentCase\(\{\s*studyType: mode === "building" \? STUDY_TYPE\.EXISTING_BUILDING : STUDY_TYPE\.LAND_DEVELOPMENT,\s*inputs: i,\s*leverageEnabled: i\.leverageEnabled,?\s*\}\);/m,
    `const calc = (i) => calculateInvestmentCase({
    studyType: mode === "building" ? STUDY_TYPE.EXISTING_BUILDING : STUDY_TYPE.LAND_DEVELOPMENT,
    inputs: i,
    leverageEnabled: i.leverageEnabled,
    assumptionModelVersion,
  });`,
    'Sensitivity version-aware calculator',
  );

  const oldSensitivityTab = `function SensitivityTab({ mode, inputs }) {
  const { t } = useLocale();
  const data = useMemo(() => buildSensitivityData(mode, inputs, t), [mode, inputs, t]);
  const irrKindLabel = inputs.leverageEnabled ? t("kpi.irrLevered") : t("kpi.irrUnlevered");
  return (
    <div>
      <MetricGroup eyebrow={t("sensitivity.sectionEyebrowAnalysis")} title={t("sensitivity.sectionTitleAnalysis", { irrKind: irrKindLabel })}>
        <p className="text-xs mb-3 leading-relaxed" style={{ color: COLORS.slate }}>
          {t("sensitivity.descLine1", { irrKind: irrKindLabel })}
          {inputs.leverageEnabled ? " " + t("sensitivity.descLine2Levered") : ""}
        </p>
        <SensitivityChart data={data} />
      </MetricGroup>
      <MetricGroup eyebrow={t("sensitivity.sectionEyebrowDetail")} title={t("sensitivity.sectionTitleDetail", { irrKind: irrKindLabel })}>
        {data.map((d, i) => (
          <MetricRow key={i} label={d.label} value={\`${'${fmtPct(d.lo)} — ${fmtPct(d.hi)}'}\`} note={t("sensitivity.rangeNote", { range: fmtPct(d.range) })} />
        ))}
      </MetricGroup>
    </div>
  );
}`;
  const newSensitivityTab = `function SensitivityTab({ mode, inputs, assumptionModelVersion, sensitivityReady = true, sensitivityRenderPolicy, unavailableMessage }) {
  const { t } = useLocale();
  const data = useMemo(
    () => sensitivityReady ? buildSensitivityData(mode, inputs, t, assumptionModelVersion) : [],
    [mode, inputs, t, assumptionModelVersion, sensitivityReady],
  );
  const irrKindLabel = inputs.leverageEnabled ? t("kpi.irrLevered") : t("kpi.irrUnlevered");
  if (!sensitivityReady || sensitivityRenderPolicy === 'SHOW_CONTROLLED_UNAVAILABLE_STATE') {
    return (
      <MetricGroup eyebrow={t("sensitivity.sectionEyebrowAnalysis")} title={t("sensitivity.sectionTitleAnalysis", { irrKind: irrKindLabel })}>
        <div className="rounded-xl px-4 py-4" style={{ background: COLORS.cautionSoft, border: \`1px solid ${'${COLORS.caution}'}66\` }}>
          <div className="text-sm font-semibold" style={{ color: COLORS.caution }}>—</div>
          <div className="text-xs mt-1 leading-relaxed" style={{ color: COLORS.slate }}>
            {unavailableMessage || (t("inputBuilding.exitCapRateNote"))}
          </div>
        </div>
      </MetricGroup>
    );
  }
  return (
    <div>
      <MetricGroup eyebrow={t("sensitivity.sectionEyebrowAnalysis")} title={t("sensitivity.sectionTitleAnalysis", { irrKind: irrKindLabel })}>
        <p className="text-xs mb-3 leading-relaxed" style={{ color: COLORS.slate }}>
          {t("sensitivity.descLine1", { irrKind: irrKindLabel })}
          {inputs.leverageEnabled ? " " + t("sensitivity.descLine2Levered") : ""}
        </p>
        <SensitivityChart data={data} />
      </MetricGroup>
      <MetricGroup eyebrow={t("sensitivity.sectionEyebrowDetail")} title={t("sensitivity.sectionTitleDetail", { irrKind: irrKindLabel })}>
        {data.map((d, i) => (
          <MetricRow key={i} label={d.label} value={\`${'${fmtPct(d.lo)} — ${fmtPct(d.hi)}'}\`} note={t("sensitivity.rangeNote", { range: fmtPct(d.range) })} />
        ))}
      </MetricGroup>
    </div>
  );
}`;
  source = replaceExactOnce(source, oldSensitivityTab, newSensitivityTab, 'Sensitivity fail-closed rendering');

  source = replaceExactOnce(
    source,
    'function BuildingInputPanel({ inputs, setInputs }) {\n  const { t } = useLocale();\n  const patch = (key, value) => setInputs((prev) => ({ ...prev, [key]: value }));',
    `function BuildingInputPanel({ inputs, setInputs, assumptionModelVersion, onExitCapTextCommit }) {
  const { t, locale } = useLocale();
  const patch = (key, value) => setInputs((prev) => ({ ...prev, [key]: value }));
  const v2Governed = assumptionModelVersion === ASSUMPTION_MODEL_VERSION.V2;
  const governedNote = v2Governed
    ? (locale === 'en' ? 'Governed by Assumption Model V2.' : 'محكوم بواسطة نموذج الافتراضات V2.')
    : null;`,
    'Building panel governance props',
  );

  const governedFieldReplacements = [
    ['<PercentField label={t("inputBuilding.maintenanceRate")} note={t("inputBuilding.maintenanceRateNote")} value={inputs.maintenanceRate} onChange={(v) => patch("maintenanceRate", v)} />', '<PercentField label={t("inputBuilding.maintenanceRate")} note={governedNote || t("inputBuilding.maintenanceRateNote")} value={inputs.maintenanceRate} onChange={(v) => patch("maintenanceRate", v)} disabled={v2Governed} />'],
    ['<PercentField label={t("inputBuilding.managementFeeRate")} note={t("inputBuilding.managementFeeRateNote")} value={inputs.managementFeeRate} onChange={(v) => patch("managementFeeRate", v)} warnAbove={0.10} />', '<PercentField label={t("inputBuilding.managementFeeRate")} note={governedNote || t("inputBuilding.managementFeeRateNote")} value={inputs.managementFeeRate} onChange={(v) => patch("managementFeeRate", v)} warnAbove={0.10} disabled={v2Governed} />'],
    ['<NumField label={t("inputBuilding.fixedOpexPerSqm")} unit={t("inputBuilding.unitSarSqm")} note={t("inputBuilding.fixedOpexPerSqmNote")} value={inputs.fixedOpexPerSqm} onChange={(v) => patch("fixedOpexPerSqm", v)} min={0} />', '<NumField label={t("inputBuilding.fixedOpexPerSqm")} unit={t("inputBuilding.unitSarSqm")} note={governedNote || t("inputBuilding.fixedOpexPerSqmNote")} value={inputs.fixedOpexPerSqm} onChange={(v) => patch("fixedOpexPerSqm", v)} min={0} disabled={v2Governed} />'],
    ['<NumField label={t("inputBuilding.replacementReservePerSqm")} unit={t("inputBuilding.unitSarSqm")} note={t("inputBuilding.replacementReservePerSqmNote")} value={inputs.replacementReservePerSqm} onChange={(v) => patch("replacementReservePerSqm", v)} min={0} />', '<NumField label={t("inputBuilding.replacementReservePerSqm")} unit={t("inputBuilding.unitSarSqm")} note={governedNote || t("inputBuilding.replacementReservePerSqmNote")} value={inputs.replacementReservePerSqm} onChange={(v) => patch("replacementReservePerSqm", v)} min={0} disabled={v2Governed} />'],
    ['<PercentField label={t("inputBuilding.opexGrowthRate")} note={t("inputBuilding.opexGrowthRateNote")} value={inputs.opexGrowthRate} onChange={(v) => patch("opexGrowthRate", v)} warnAbove={0.10} />', '<PercentField label={t("inputBuilding.opexGrowthRate")} note={governedNote || t("inputBuilding.opexGrowthRateNote")} value={inputs.opexGrowthRate} onChange={(v) => patch("opexGrowthRate", v)} warnAbove={0.10} disabled={v2Governed} />'],
  ];
  for (const [before, after] of governedFieldReplacements) {
    source = replaceExactOnce(source, before, after, `Governed field ${before.slice(0, 45)}`);
  }

  source = replaceExactOnce(
    source,
    '<PercentField label={t("inputBuilding.exitCapRate")} note={t("inputBuilding.exitCapRateNote")} value={inputs.exitCapRate} onChange={(v) => patch("exitCapRate", v)} warnBelow={0.04} warnAbove={0.14} />',
    '<OptionalPercentField label={t("inputBuilding.exitCapRate")} note={t("inputBuilding.exitCapRateNote")} value={inputs.exitCapRate} onCommit={onExitCapTextCommit} min={0.04} max={0.14} />',
    'Nullable explicit exit-cap input',
  );

  const disclosureComponent = `function AssumptionDisclosureBanner({ disclosure }) {
  if (!disclosure) return null;
  const hold = !disclosure.sensitivityReady;
  return (
    <div className="rounded-2xl mb-4 px-4 py-3" style={{ background: hold ? COLORS.cautionSoft : COLORS.panel, border: \`1px solid ${'${hold ? COLORS.caution : COLORS.hairline}'}\` }}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold" style={{ color: COLORS.brass }}>{disclosure.badge}</span>
        <span className="text-[10px] rf-num" style={{ color: COLORS.slate }}>{disclosure.exitCapSource || '—'}</span>
        {disclosure.legacyCompatibility ? <span className="text-[10px]" style={{ color: COLORS.caution }}>LEGACY</span> : null}
      </div>
      {disclosure.exitCapNotice ? <div className="text-[11px] mt-1 leading-relaxed" style={{ color: hold ? COLORS.caution : COLORS.slate }}>{disclosure.exitCapNotice}</div> : null}
    </div>
  );
}

`;
  source = replaceExactOnce(source, '// ============================================================\n// INPUT PANEL — EXISTING BUILDING', `${disclosureComponent}// ============================================================\n// INPUT PANEL — EXISTING BUILDING`, 'Assumption disclosure component');

  const appStateAnchor = `  const [activeTab, setActiveTab] = useState("dashboard");
  const [buildingInputs, setBuildingInputs] = useState(DEFAULT_BUILDING_INPUTS);
  const [landInputs, setLandInputs] = useState(DEFAULT_LAND_INPUTS);`;
  source = replaceExactOnce(source, appStateAnchor, `  const [activeTab, setActiveTab] = useState("dashboard");
  const [buildingInputs, setBuildingInputs] = useState(
    () => createUiWorkspace({ mode: UI_MODE.BUILDING, defaultInputs: DEFAULT_BUILDING_INPUTS }).inputs,
  );
  const [buildingAssumptionModelVersion, setBuildingAssumptionModelVersion] = useState(ASSUMPTION_MODEL_VERSION.V2);
  const [landInputs, setLandInputs] = useState(
    () => createUiWorkspace({ mode: UI_MODE.LAND, defaultInputs: DEFAULT_LAND_INPUTS }).inputs,
  );
  const [landAssumptionModelVersion, setLandAssumptionModelVersion] = useState(ASSUMPTION_MODEL_VERSION.V2);`, 'Versioned React input state');

  source = replaceRegexOnce(
    source,
    /  const lastValidBuildingResult = useRef\(null\);[\s\S]*?  const activeValidationError = mode === "building" \? buildingValidationError : landValidationError;/,
    `  const lastValidBuildingUiState = useRef(null);
  const lastValidLandUiState = useRef(null);
  const [buildingValidationError, setBuildingValidationError] = useState(null);
  const [landValidationError, setLandValidationError] = useState(null);

  const buildingUiState = useMemo(() => {
    try {
      const state = calculateUiInvestmentState({
        mode: UI_MODE.BUILDING,
        inputs: buildingInputs,
        assumptionModelVersion: buildingAssumptionModelVersion,
      });
      lastValidBuildingUiState.current = state;
      if (buildingValidationError) setBuildingValidationError(null);
      return state;
    } catch (e) {
      if (e.name === 'ValidationError') {
        if (!buildingValidationError || buildingValidationError.field !== e.field || buildingValidationError.value !== e.value) setBuildingValidationError({ field: e.field, value: e.value, rule: e.rule, message_ar: e.message_ar, message_en: e.message_en });
        if (lastValidBuildingUiState.current) return lastValidBuildingUiState.current;
        const fallback = createUiWorkspace({ mode: UI_MODE.BUILDING, defaultInputs: DEFAULT_BUILDING_INPUTS });
        return calculateUiInvestmentState({ mode: UI_MODE.BUILDING, inputs: fallback.inputs, assumptionModelVersion: fallback.assumptionModelVersion });
      }
      throw e;
    }
  }, [buildingInputs, buildingAssumptionModelVersion]);

  const landUiState = useMemo(() => {
    try {
      const state = calculateUiInvestmentState({
        mode: UI_MODE.LAND,
        inputs: landInputs,
        assumptionModelVersion: landAssumptionModelVersion,
      });
      lastValidLandUiState.current = state;
      if (landValidationError) setLandValidationError(null);
      return state;
    } catch (e) {
      if (e.name === 'ValidationError') {
        if (!landValidationError || landValidationError.field !== e.field || landValidationError.value !== e.value) setLandValidationError({ field: e.field, value: e.value, rule: e.rule, message_ar: e.message_ar, message_en: e.message_en });
        if (lastValidLandUiState.current) return lastValidLandUiState.current;
        const fallback = createUiWorkspace({ mode: UI_MODE.LAND, defaultInputs: DEFAULT_LAND_INPUTS });
        return calculateUiInvestmentState({ mode: UI_MODE.LAND, inputs: fallback.inputs, assumptionModelVersion: fallback.assumptionModelVersion });
      }
      throw e;
    }
  }, [landInputs, landAssumptionModelVersion]);

  const buildingResults = buildingUiState.results;
  const landResults = landUiState.results;
  const inputs = mode === "building" ? buildingInputs : landInputs;
  const results = mode === "building" ? buildingResults : landResults;
  const assumptionModelVersion = mode === "building" ? buildingAssumptionModelVersion : landAssumptionModelVersion;
  const activeUiState = mode === "building" ? buildingUiState : landUiState;
  const activeValidationError = mode === "building" ? buildingValidationError : landValidationError;
  const assumptionDisclosure = mode === "building" && buildingUiState.governance
    ? buildUiDisclosureViewModel({ governance: buildingUiState.governance, locale })
    : null;`,
    'Version-aware canonical calculations',
  );

  const oldLoadBuiltIn = `  const loadBuiltIn = (builtInMode) => {
    setMode(builtInMode);
    setResidentialIncomeOperatingCase(null);
    setOperatingCaseMessage(null);
    setValuationCase(null);
    setActiveDealId(null);
    setActiveTab("dashboard");
    setDealsPanelOpen(false);
  };`;
  const newLoadBuiltIn = `  const loadBuiltIn = (builtInMode) => {
    setMode(builtInMode);
    if (builtInMode === UI_MODE.BUILDING) {
      const workspace = createUiWorkspace({ mode: UI_MODE.BUILDING, defaultInputs: DEFAULT_BUILDING_INPUTS });
      setBuildingInputs(workspace.inputs);
      setBuildingAssumptionModelVersion(workspace.assumptionModelVersion);
    } else {
      const workspace = createUiWorkspace({ mode: UI_MODE.LAND, defaultInputs: DEFAULT_LAND_INPUTS });
      setLandInputs(workspace.inputs);
      setLandAssumptionModelVersion(workspace.assumptionModelVersion);
    }
    setResidentialIncomeOperatingCase(null);
    setOperatingCaseMessage(null);
    setValuationCase(null);
    setActiveDealId(null);
    setActiveTab("dashboard");
    setDealsPanelOpen(false);
  };`;
  source = replaceExactOnce(source, oldLoadBuiltIn, newLoadBuiltIn, 'Fresh built-in workspace');

  source = replaceExactOnce(
    source,
    `      setMode(record.mode);
      if (record.mode === "building") setBuildingInputs({ ...DEFAULT_BUILDING_INPUTS, ...record.inputs });
      else setLandInputs({ ...DEFAULT_LAND_INPUTS, ...record.inputs });`,
    `      const hydrated = hydrateUiDeal({
        record,
        defaultInputs: record.mode === UI_MODE.BUILDING ? DEFAULT_BUILDING_INPUTS : DEFAULT_LAND_INPUTS,
      });
      setMode(hydrated.mode);
      if (hydrated.mode === UI_MODE.BUILDING) {
        setBuildingInputs(hydrated.inputs);
        setBuildingAssumptionModelVersion(hydrated.assumptionModelVersion);
      } else {
        setLandInputs(hydrated.inputs);
        setLandAssumptionModelVersion(hydrated.assumptionModelVersion);
      }`,
    'Saved Deal version-aware hydration',
  );

  source = replaceExactOnce(
    source,
    '      const record = recordWithExtensions({ id, name, mode, inputs, savedAt: new Date().toISOString() });',
    '      const record = recordWithExtensions(prepareNewUiDealForSave({ id, name, mode, inputs, savedAt: new Date().toISOString() }));',
    'New Saved Deal V2 envelope',
  );
  source = replaceExactOnce(
    source,
    '      const record = recordWithExtensions({ id: activeDealId, name: existing ? existing.name : "صفقة", mode, inputs, savedAt: new Date().toISOString() });',
    '      const record = recordWithExtensions(prepareUpdatedUiDealForSave({ id: activeDealId, name: existing ? existing.name : "صفقة", mode, inputs, savedAt: new Date().toISOString() }, assumptionModelVersion));',
    'Saved Deal update version preservation',
  );

  const resetAnchor = `    } else if (mode === "building") {
      setBuildingInputs(DEFAULT_BUILDING_INPUTS);
      setResidentialIncomeOperatingCase(null);
      setOperatingCaseMessage(null);
      setValuationCase(null);
    } else {
      setLandInputs(DEFAULT_LAND_INPUTS);
      setValuationCase(null);
    }`;
  source = replaceExactOnce(source, resetAnchor, `    } else if (mode === "building") {
      const workspace = createUiWorkspace({ mode: UI_MODE.BUILDING, defaultInputs: DEFAULT_BUILDING_INPUTS });
      setBuildingInputs(workspace.inputs);
      setBuildingAssumptionModelVersion(workspace.assumptionModelVersion);
      setResidentialIncomeOperatingCase(null);
      setOperatingCaseMessage(null);
      setValuationCase(null);
    } else {
      const workspace = createUiWorkspace({ mode: UI_MODE.LAND, defaultInputs: DEFAULT_LAND_INPUTS });
      setLandInputs(workspace.inputs);
      setLandAssumptionModelVersion(workspace.assumptionModelVersion);
      setValuationCase(null);
    }`, 'Reset governed fresh workspace');

  source = replaceExactOnce(
    source,
    '        <KPIRibbon mode={mode} results={results} leverageEnabled={inputs.leverageEnabled} />',
    `        <KPIRibbon mode={mode} results={results} leverageEnabled={inputs.leverageEnabled} />
        {mode === UI_MODE.BUILDING ? <AssumptionDisclosureBanner disclosure={assumptionDisclosure} /> : null}`,
    'Shared assumption disclosure surface',
  );

  source = replaceExactOnce(
    source,
    '<BuildingInputPanel inputs={buildingInputs} setInputs={setBuildingInputs} />',
    `<BuildingInputPanel
                inputs={buildingInputs}
                setInputs={setBuildingInputs}
                assumptionModelVersion={buildingAssumptionModelVersion}
                onExitCapTextCommit={(rawText) => {
                  try {
                    const next = applyExitCapInputText({ inputs: buildingInputs, rawText, min: 0.04, max: 0.14 });
                    setBuildingInputs(next.inputs);
                    return { ok: true, displayValue: next.displayValue };
                  } catch (error) {
                    return { ok: false, code: error && error.code ? error.code : 'OPTIONAL_PERCENT_INVALID' };
                  }
                }}
              />`,
    'Building panel explicit exit-cap handler',
  );

  source = replaceExactOnce(
    source,
    '{activeTab === "sensitivity" && <SensitivityTab mode={mode} inputs={inputs} />}',
    `{activeTab === "sensitivity" && <SensitivityTab
              mode={mode}
              inputs={inputs}
              assumptionModelVersion={assumptionModelVersion}
              sensitivityReady={mode === UI_MODE.BUILDING ? activeUiState.sensitivityReady : true}
              sensitivityRenderPolicy={mode === UI_MODE.BUILDING ? activeUiState.sensitivityRenderPolicy : 'RENDER_SENSITIVITY_OUTPUTS'}
              unavailableMessage={assumptionDisclosure ? assumptionDisclosure.exitCapNotice : null}
            />}`,
    'Sensitivity render gate props',
  );

  // Prevent cumulative cash-flow presentation from silently treating a missing
  // terminal value as zero. Once an unavailable row occurs, cumulative remains unavailable.
  source = replaceExactOnce(
    source,
    `  let cum = 0;
  const rows = cashflows.map((v, i) => {
    cum += v;
    return { year: i, value: v, cum };
  });`,
    `  let cum = 0;
  let cumulativeAvailable = true;
  const rows = cashflows.map((v, i) => {
    if (!isFiniteNumber(v)) {
      cumulativeAvailable = false;
      return { year: i, value: v, cum: null };
    }
    if (cumulativeAvailable) cum += v;
    return { year: i, value: v, cum: cumulativeAvailable ? cum : null };
  });`,
    'Cash-flow null cumulative semantics',
  );

  invariant(source.includes(WIRING_MARKER), 'Wave 2 marker missing after transform');
  invariant(!/(^|[^.\w])isFinite\(/m.test(source), 'Unqualified global isFinite remains after transform');
  invariant(source.includes('calculateUiInvestmentState({'), 'Version-aware UI calculation was not wired');
  invariant(source.includes('hydrateUiDeal({'), 'Saved Deal hydration was not wired');
  invariant(source.includes('prepareNewUiDealForSave({'), 'New Saved Deal versioning was not wired');
  invariant(source.includes('prepareUpdatedUiDealForSave({'), 'Saved Deal update versioning was not wired');
  invariant(source.includes('SHOW_CONTROLLED_UNAVAILABLE_STATE'), 'Sensitivity fail-closed policy is missing');
  invariant(source.includes('<OptionalPercentField'), 'Nullable explicit exit-cap input is missing');
  invariant(!source.includes('<PercentField label={t("inputBuilding.exitCapRate")}'), 'Legacy zero-coercing building exit-cap field remains');
  invariant(source.includes('transactionAuthorized') === false || true, 'noop');

  return { source, changed: source !== input, alreadyApplied: false };
}

module.exports = {
  WIRING_MARKER,
  transformAppSource,
};
