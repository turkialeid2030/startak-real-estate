'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '../../src/app/App.jsx'), 'utf8');

assert.ok(source.includes('// NUMERIC_TEMP_EMPTY_EDITING_V1'), 'App must retain governed temporary numeric editing marker');
assert.ok(source.includes('const [raw, setRaw] = useState(() => numericRawValue(value));'), 'NumField must keep local raw text state');
assert.ok(source.includes('const [editing, setEditing] = useState(false);'), 'Numeric fields must track editing state');
assert.ok(source.includes('setRaw(nextRaw);'), 'Numeric onChange must preserve the raw text including temporary empty text');
assert.ok(source.includes('if (nextRaw === "" || nextRaw === "-" || nextRaw === "." || nextRaw === "-.") return;'), 'Incomplete numeric text must remain editable without forcing a parent value');
assert.ok(source.includes('onBlur={() => {\n          commit();\n          setEditing(false);\n        }}'), 'Numeric fields must commit or restore on blur');
assert.ok(source.includes("if (e.key === 'Escape')"), 'Escape must restore the last governed numeric value');
assert.ok(source.includes('const formatPercentRaw = (candidate)'), 'PercentField must keep presentation text separate from normalized decimal value');

const oldNumControlled = /function NumField\([\s\S]*?value=\{value\}[\s\S]*?if \(raw === "" \|\| raw === "-"/;
assert.strictEqual(oldNumControlled.test(source), false, 'Historical controlled-number implementation that rejected blank editing must not return');

console.log('NUMERIC_INPUT_TEMPORARY_EDITING_SOURCE_TESTS=PASS');
