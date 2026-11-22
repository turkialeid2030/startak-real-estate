'use strict';
// Guard the non-network official UMAPS reference embedded in the property
// workflow. A portal login link is not an API, spatial join or verification.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {OFFICIAL_SOURCE_REGISTRY,officialUrlMatchesSource}=
  require('../../src/geospatial/official-source-registry');
const source=OFFICIAL_SOURCE_REGISTRY.BALADY_URBAN_MAPS;
const code=fs.readFileSync(path.join(__dirname,'../../src/components/PropertyMarketLocationPanel.jsx'),'utf8');
assert.equal(source.publicReferenceUrl,'https://umaps.momah.gov.sa/');
assert.equal(officialUrlMatchesSource(source.id,source.publicReferenceUrl),true);
assert.equal(source.productionAdapterEnabled,false);
assert.equal(source.machineAccessStatus,'PUBLIC_API_NOT_VERIFIED');
assert.match(code,/data-testid="market-open-umaps"/);
assert.match(code,/href=\{OFFICIAL_SOURCE_REGISTRY\.BALADY_URBAN_MAPS\.publicReferenceUrl\}/);
assert.match(code,/target="_blank" rel="noopener noreferrer"/);
const locale=fs.readFileSync(path.join(__dirname,'../../src/i18n/market-study-core-labels.js'),'utf8');
assert.match(code,/L\('فتح الخرائط الحضرية الرسمية'\)/);
assert.match(code,/L\('للمراجعة البلدية اليدوية/);
assert.match(locale,/Open official Urban Maps \(UMAPS\)/);
assert.match(locale,/No property details are sent by this link/);
assert.match(locale,/لا يُرسل الرابط بيانات العقار/);
assert.doesNotMatch(code,/umaps\.momah\.gov\.sa\/\?q=\$\{/);
console.log('C1_UMAPS_OFFICIAL_PORTAL_UI=PASS manual_only=true api=false authorized=false');
