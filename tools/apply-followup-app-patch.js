'use strict';

const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '../src/app/App.jsx');
let source = fs.readFileSync(appPath, 'utf8');

if (source.includes('NUMERIC_TEMP_EMPTY_EDITING_V1')) {
  console.log('FOLLOWUP_APP_PATCH=ALREADY_APPLIED');
  process.exit(0);
}

const replacement = String.raw`// NUMERIC_TEMP_EMPTY_EDITING_V1
function numericRawValue(value) {
  return isFiniteNumber(Number(value)) ? String(value) : "";
}

function NumField({ label, unit, note, value, onChange, step = 1, min, warnBelow, warnAbove, warnText, disabled = false }) {
  const { t } = useLocale();
  const warning = rangeWarning(value, warnBelow, warnAbove, warnText, t);
  const [raw, setRaw] = useState(() => numericRawValue(value));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setRaw(numericRawValue(value));
  }, [value, editing]);

  const commit = () => {
    const candidate = raw.trim();
    if (candidate === "" || candidate === "-" || candidate === "." || candidate === "-.") {
      setRaw(numericRawValue(value));
      return;
    }
    const parsed = Number(candidate);
    if (!Number.isFinite(parsed)) {
      setRaw(numericRawValue(value));
      return;
    }
    const normalized = min !== undefined ? Math.max(min, parsed) : parsed;
    onChange(normalized);
    setRaw(String(normalized));
  };

  return (
    <Field label={label} unit={unit}>
      <input
        type="text"
        inputMode="decimal"
        className="rf-input rf-num w-full px-3 py-2 text-sm"
        style={{ ...baseInputStyle(), opacity: disabled ? 0.65 : 1, cursor: disabled ? "not-allowed" : "text" }}
        value={raw}
        disabled={disabled}
        aria-invalid={warning ? "true" : undefined}
        onFocus={() => setEditing(true)}
        onChange={(e) => {
          if (disabled) return;
          const nextRaw = e.target.value.replace(/[^\d.\-]/g, "");
          setRaw(nextRaw);
          if (nextRaw === "" || nextRaw === "-" || nextRaw === "." || nextRaw === "-.") return;
          const parsed = Number(nextRaw);
          if (!Number.isFinite(parsed)) return;
          onChange(min !== undefined ? Math.max(min, parsed) : parsed);
        }}
        onBlur={() => {
          commit();
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            setRaw(numericRawValue(value));
            setEditing(false);
            e.currentTarget.blur();
          }
        }}
      />
      <FieldNote note={note} warning={warning} />
    </Field>
  );
}

function PercentField({ label, note, value, onChange, warnBelow, warnAbove, warnText, disabled = false }) {
  const { t } = useLocale();
  const warning = rangeWarning(value, warnBelow, warnAbove, warnText, t);
  const formatPercentRaw = (candidate) => isFiniteNumber(candidate) ? String(Number((candidate * 100).toFixed(4))) : "";
  const [raw, setRaw] = useState(() => formatPercentRaw(value));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setRaw(formatPercentRaw(value));
  }, [value, editing]);

  const commit = () => {
    const candidate = raw.trim();
    if (candidate === "" || candidate === "-" || candidate === "." || candidate === "-.") {
      setRaw(formatPercentRaw(value));
      return;
    }
    const parsed = Number(candidate);
    if (!Number.isFinite(parsed)) {
      setRaw(formatPercentRaw(value));
      return;
    }
    onChange(parsed / 100);
    setRaw(String(parsed));
  };

  return (
    <Field label={label} unit="%">
      <input
        type="text"
        inputMode="decimal"
        className="rf-input rf-num w-full px-3 py-2 text-sm"
        style={{ ...baseInputStyle(), opacity: disabled ? 0.65 : 1, cursor: disabled ? "not-allowed" : "text" }}
        value={raw}
        disabled={disabled}
        aria-invalid={warning ? "true" : undefined}
        onFocus={() => setEditing(true)}
        onChange={(e) => {
          if (disabled) return;
          const nextRaw = e.target.value.replace(/[^\d.\-]/g, "");
          setRaw(nextRaw);
          if (nextRaw === "" || nextRaw === "-" || nextRaw === "." || nextRaw === "-.") return;
          const parsed = Number(nextRaw);
          if (!Number.isFinite(parsed)) return;
          onChange(parsed / 100);
        }}
        onBlur={() => {
          commit();
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            setRaw(formatPercentRaw(value));
            setEditing(false);
            e.currentTarget.blur();
          }
        }}
      />
      <FieldNote note={note} warning={warning} />
    </Field>
  );
}

function OptionalPercentField`;

const pattern = /function NumField\([\s\S]*?\nfunction OptionalPercentField/;
if (!pattern.test(source)) {
  throw new Error('FOLLOWUP_APP_PATCH_TARGET_NOT_FOUND');
}
source = source.replace(pattern, replacement);
fs.writeFileSync(appPath, source, 'utf8');
console.log('FOLLOWUP_APP_PATCH=APPLIED');
