'use strict';
// Real browser, original market engine and shared owner market-study subject.
// All data below are deliberately synthetic; NO private licensed fixture or
// real transaction has been included in this public test.
const assert=require('node:assert/strict');
const engines=require('playwright');
const browserName=process.env.STARTAK_BROWSER||'chromium';
if(!['chromium','firefox','webkit'].includes(browserName))throw Error('BROWSER_UNSUPPORTED');
const {expect}=require('@playwright/test');
(async()=>{
 const browser=await engines[browserName].launch({
  headless:true,...(browserName==='chromium'?{args:['--no-sandbox']}:{}),
 });
 const page=await browser.newPage({viewport:{width:390,height:844},locale:'ar-SA'});
 const base=process.env.STARTAK_E2E_URL||'http://127.0.0.1:4173/';
 const money=x=>new Intl.NumberFormat('ar-SA',{maximumFractionDigits:0}).format(x);
 const ownerCap=page.getByTestId('owner-market-capital-indication');
 const ownerRent=page.getByTestId('owner-market-rent-indication');
 let checks=0;
 const eq=async(locator,value)=>{await expect(locator).toHaveText(value);checks++};
 try{
  await page.goto(base,{waitUntil:'networkidle'});
  const pageErrors=[];page.on('pageerror',e=>pageErrors.push(String(e)));
  await page.getByTestId('owner-valuation-purpose').selectOption('ACQUISITION');
  await page.getByTestId('owner-valuation-date').fill('2026-10-15');
  await page.getByTestId('owner-step-1').click();
  await page.getByTestId('owner-market-name').fill('SYNTHETIC-RESEARCH-OWNER');
  await page.getByTestId('owner-market-city').fill('جدة');
  await page.getByTestId('owner-market-district').fill('حي افتراضي');
  await page.getByTestId('owner-market-location').fill('21.500,39.200');
  await page.getByTestId('owner-market-land-area').fill('1234');
  await page.getByTestId('owner-property-right').selectOption('FULL_OWNERSHIP');
  await page.getByTestId('owner-step-4').click();
  await eq(ownerCap,'—');await eq(ownerRent,'—');
  await page.getByTestId('owner-advanced-mode').click();
  const panel=page.getByTestId('location-market-study');
  await expect(panel).toBeVisible();
  const fillField=async(label,value)=>panel.getByLabel(label,{exact:true}).fill(value);
  await fillField('إجمالي المساحات المبنية لكل المباني (م²)','1000');
  await fillField('إجمالي المساحة القابلة للتأجير (م²)','800');
  await fillField('عدد العمائر/المباني','1');
  await fillField('عدد الوحدات (شقق/مكاتب/معارض)','10');
  const setup=async(kind,index,amount,status='EXECUTED')=>{
   const row=page.getByTestId('market-comparable-'+kind+'-'+index);
   await row.locator('select').nth(0).selectOption('RESIDENTIAL_COMPOUND');
   await row.locator('select').nth(1).selectOption(status);
   const inputs=row.locator('input');
   await inputs.nth(0).fill('SYNTH-'+kind+'-'+index);
   await inputs.nth(1).fill(String(amount));
   await inputs.nth(2).fill(kind==='sale'?'1000':'800');
   await inputs.nth(3).fill('2026-10-01');
   await inputs.nth(4).fill('21.500,39.200');
   await inputs.nth(5).fill('https://example.org/synthetic-'+kind+'-'+index);
  };
  for(let i=0;i<3;i++){
   await setup('sale',i,[4500000,5000000,5500000][i],i===0?'ASKING':'EXECUTED');
   await setup('rent',i,[500000,520000,540000][i]);
  }
  // An asking listing must not be promoted into an executed sale.
  await eq(page.getByTestId('market-canonical-capital-indication'),'غير قابل للحساب');
  await eq(page.getByTestId('market-canonical-rent-indication'),money(520000)+' ر.س');
  await page.getByTestId('owner-simple-mode').click();
  await page.getByTestId('owner-step-4').click();
  await eq(ownerCap,'—');
  await eq(ownerRent,money(520000));
  await expect(page.getByTestId('owner-market-results')).toContainText('بيع: 2');
  checks++;
  // An outstanding requirement selected on Results must bring the owner
  // directly to the original sale editor, not only the generic evidence step.
  await page.getByTestId('owner-market-results').getByTestId('owner-review-NO_EXECUTED_SALE_COMPARABLES').click();
  await expect(page.getByTestId('owner-current-step')).toContainText('(3/5)');checks++;
  await expect(page.getByTestId('market-comparables-sale')).toBeFocused();checks++;
  // The simple evidence step must link to the original, live comparable forms;
  // its counts must reflect the *qualified* sale and rent cohorts, not rows.
  await page.getByTestId('owner-step-2').click();
  await expect(page.getByTestId('owner-evidence-counts')).toContainText('بيع: 2');checks++;
  await expect(page.getByTestId('owner-evidence-counts')).toContainText('إيجار: 3');checks++;
  await page.getByTestId('owner-open-sales').click();
  await expect(page.getByTestId('market-comparables-sale')).toBeFocused();checks++;
  await page.getByTestId('owner-open-rentals').click();
  await expect(page.getByTestId('market-comparables-rent')).toBeFocused();checks++;
  await expect(page.getByTestId('owner-evidence-review')).toContainText('ثلاث مقارنات بيع');checks++;
  await page.getByTestId('owner-review-NO_EXECUTED_SALE_COMPARABLES').click();
  await expect(page.getByTestId('market-comparables-sale')).toBeFocused();checks++;
  await expect(page.getByTestId('owner-evidence-unverified')).toBeVisible();checks++;
  await expect(page.getByTestId('owner-review-SOURCE_INDEPENDENCE_NOT_VERIFIED')).toHaveCount(0);checks++;
  const reasonsBefore=await page.getByTestId('owner-evidence-review').textContent();
  assert.ok(!reasonsBefore.includes('NO_EXECUTED_SALE_COMPARABLES'),'raw governance code exposed');checks++;
  // Simple mode must localize the governed evidence reason, preserving the
  // same live research state and never exposing internal status identifiers.
  await page.getByTestId('owner-language').click();
  await expect(page.getByTestId('owner-evidence-review')).toContainText('At least three engine-qualified executed sale comparables');checks++;
  await expect(page.getByTestId('owner-evidence-unverified')).toContainText('User-supplied comparables');checks++;
  await page.getByTestId('owner-language').click();
  await expect(page.getByTestId('owner-evidence-review')).toContainText('ثلاث مقارنات بيع');checks++;
  // With a third executed sale the separate sale and income estimates agree
  // within the existing 20% method-reconciliation gate; no synthetic result
  // becomes professionally certified.
  await page.getByTestId('owner-advanced-mode').click();
  await page.getByTestId('market-comparable-sale-0').locator('select').nth(1).selectOption('EXECUTED');
  const independentValue=4996000;
  await eq(page.getByTestId('market-canonical-capital-indication'),money(independentValue)+' ر.س');
  await eq(page.getByTestId('market-canonical-rent-indication'),money(520000)+' ر.س');
  await page.getByTestId('owner-simple-mode').click();
  await page.getByTestId('owner-step-4').click();
  await eq(ownerCap,money(independentValue));
  await eq(ownerRent,money(520000));
  await expect(page.getByTestId('owner-market-results')).toContainText('بيع: 3');
  checks++;
  const solvedSaleReason=page.getByTestId('owner-market-results').getByTestId('owner-evidence-review');
  await expect(solvedSaleReason).not.toContainText('ثلاث مقارنات بيع');checks++;
  await expect(solvedSaleReason).toContainText('مصادر الصفقات');checks++;
  // Removing a valid lease suppresses rental indication independently;
  // capital indication must not be transformed into a fictional rent.
  await page.getByTestId('owner-advanced-mode').click();
  await page.getByTestId('market-comparable-rent-0').locator('select').nth(1).selectOption('ASKING');
  await page.getByTestId('owner-simple-mode').click();
  await page.getByTestId('owner-step-4').click();
  await eq(ownerCap,money(5000000));
  await eq(ownerRent,'—');
  await page.getByTestId('owner-market-results').getByTestId('owner-review-NO_EXECUTED_RENT_COMPARABLES').click();
  await expect(page.getByTestId('owner-current-step')).toContainText('(3/5)');checks++;
  await expect(page.getByTestId('market-comparables-rent')).toBeFocused();checks++;
  // Restoring the lease restores the original pair.
  await page.getByTestId('owner-advanced-mode').click();
  await page.getByTestId('market-comparable-rent-0').locator('select').nth(1).selectOption('EXECUTED');
  await page.getByTestId('owner-simple-mode').click();
  await page.getByTestId('owner-step-4').click();
  await eq(ownerCap,money(independentValue));
  await eq(ownerRent,money(520000));
  // Missing valuation mandate must not yield numbers from a previously valid
  // property. This is distinct from an external appraisal-review HOLD.
  await page.getByTestId('owner-step-0').click();
  await page.getByTestId('owner-valuation-date').fill('');
  await page.getByTestId('owner-step-4').click();
  await expect(page.getByTestId('owner-market-identity-hold')).toBeVisible();checks++;
  await eq(ownerCap,'—');await eq(ownerRent,'—');
  await page.getByTestId('owner-review-VALUATION_DATE_REQUIRED_OR_INVALID').click();
  await expect(page.getByTestId('owner-valuation-date')).toBeFocused();checks++;
  await page.getByTestId('owner-valuation-date').fill('2026-10-15');
  await page.getByTestId('owner-step-1').click();
  await page.getByTestId('owner-property-right').selectOption('UNKNOWN');
  await page.getByTestId('owner-step-4').click();
  await expect(page.getByTestId('owner-market-identity-hold')).toBeVisible();checks++;
  await eq(ownerCap,'—');await eq(ownerRent,'—');
  await page.getByTestId('owner-review-PROPERTY_RIGHT_DECLARATION_REQUIRED').click();
  await expect(page.getByTestId('owner-property-right')).toBeFocused();checks++;
  await page.getByTestId('owner-property-right').selectOption('FULL_OWNERSHIP');
  await page.getByTestId('owner-step-4').click();
  await eq(ownerCap,money(independentValue));await eq(ownerRent,money(520000));
  // A whole-property comparables engine is NOT a usufruct / long-lease /
  // other restricted-interest valuation engine. Reconfirming comparables
  // cannot remove the rights-specific hold, even though the underlying
  // whole-property calculation is mathematically non-null.
  for(const right of ['USUFRUCT','LONG_LEASE','OTHER']){
   await page.getByTestId('owner-step-1').click();
   await page.getByTestId('owner-property-right').selectOption(right);
   await page.getByTestId('owner-step-4').click();
   await expect(page.getByTestId('owner-market-identity-hold')).toBeVisible();checks++;
   await eq(ownerCap,'—');await eq(ownerRent,'—');
   await expect(page.getByTestId('owner-market-results').getByTestId('owner-evidence-review'))
    .toContainText('منهج تقييم متخصص');checks++;
   await page.getByTestId('owner-advanced-mode').click();
   // Scope binding and limited-interest methodology are independent holds.
   await expect(page.getByTestId('market-evidence-subject-reconfirm')).toBeVisible();checks++;
   await page.getByTestId('market-evidence-subject-reconfirm').click();
   await expect(page.getByTestId('market-evidence-scope-hold')).toHaveCount(0);checks++;
   await expect(page.getByTestId('market-limited-interest-hold')).toBeVisible();checks++;
   // An unsupported right must not slip through independent sub-panels or
   // an alternate market-research HTML/JSON export surface.
   await expect(page.getByTestId('cohort-unit-mix')).toBeHidden();checks++;
   await expect(page.getByTestId('professional-comparables')).toBeHidden();checks++;
   await expect(page.getByTestId('fusion-limited-interest-hold')).toBeVisible();checks++;
   await expect(page.getByTestId('fusion-export')).toBeDisabled();checks++;
   await expect(page.getByTestId('fusion-export-html')).toBeDisabled();checks++;
   await expect(page.getByTestId('fusion-scenario-annex')).toContainText('لا توجد قيمة تصورية مكتملة');checks++;
   await eq(page.getByTestId('market-canonical-capital-indication'),'غير قابل للحساب');
   await eq(page.getByTestId('market-canonical-rent-indication'),'غير قابل للحساب');
   await expect(page.getByTestId('valuation-quality-gates')).toHaveCount(0);checks++;
   await expect(page.getByTestId('cross-method-reconciliation')).toHaveCount(0);checks++;
   await page.getByTestId('personal-market-study-export').click();
   await expect(page.getByTestId('market-study-action-notice')).toContainText('منهجًا متخصصًا');checks++;
   await page.getByTestId('owner-simple-mode').click();
   await page.getByTestId('owner-step-4').click();
   await eq(ownerCap,'—');await eq(ownerRent,'—');
  }
  // Restore the full-property research subject. Rebinding the saved rows is
  // still necessary because a property-interest switch changes their scope.
  await page.getByTestId('owner-step-1').click();
  await page.getByTestId('owner-property-right').selectOption('FULL_OWNERSHIP');
  await page.getByTestId('owner-advanced-mode').click();
  await expect(page.getByTestId('market-evidence-subject-reconfirm')).toBeVisible();checks++;
  await page.getByTestId('market-evidence-subject-reconfirm').click();
  await expect(page.getByTestId('market-limited-interest-hold')).toHaveCount(0);checks++;
  await expect(page.getByTestId('cohort-unit-mix')).toBeVisible();checks++;
  await expect(page.getByTestId('professional-comparables')).toBeVisible();checks++;
  await expect(page.getByTestId('fusion-limited-interest-hold')).toHaveCount(0);checks++;
  await expect(page.getByTestId('fusion-export')).toBeEnabled();checks++;
  await expect(page.getByTestId('fusion-export-html')).toBeEnabled();checks++;
  await eq(page.getByTestId('market-canonical-capital-indication'),money(independentValue)+' ر.س');
  await eq(page.getByTestId('market-canonical-rent-indication'),money(520000)+' ر.س');
  await page.getByTestId('owner-simple-mode').click();
  await page.getByTestId('owner-step-4').click();
  await eq(ownerCap,money(independentValue));await eq(ownerRent,money(520000));
  // The independent professional-adjustment editor is a property-specific
  // local draft. Changing the property in the SAME advanced view must reset
  // that editor rather than copy its old manually adjusted unit price.
  await page.getByTestId('owner-advanced-mode').click();
  const professional=page.getByTestId('professional-comparables');
  await professional.locator('summary').click();
  const adjusted=professional.getByLabel('سعر المتر قبل التسوية (ر.س)').first();
  await adjusted.fill('1234');
  await expect(adjusted).toHaveValue('1234');checks++;
  await panel.getByLabel('اسم العقار',{exact:true}).fill('SYNTHETIC-SECOND-PROPERTY');
  await expect(adjusted).toHaveValue('');checks++;
  await expect(professional).toBeHidden();checks++;
  await expect(page.getByTestId('cohort-unit-mix')).toBeHidden();checks++;
  await expect(page.getByTestId('fusion-evidence-scope-hold')).toBeVisible();checks++;
  await expect(page.getByTestId('fusion-export')).toBeDisabled();checks++;
  await expect(page.getByTestId('fusion-export-html')).toBeDisabled();checks++;
  await expect(page.getByTestId('fusion-scenario-annex')).toContainText('لا توجد قيمة تصورية مكتملة');checks++;
  await page.getByTestId('owner-simple-mode').click();
  // Two properties at the same coordinates can share an asset class and
  // comparable eligibility. Such evidence must NEVER silently migrate to a
  // new named subject. The original rows are retained but values/export HOLD.
  await page.getByTestId('owner-step-1').click();
  await page.getByTestId('owner-market-name').fill('SYNTHETIC-SECOND-PROPERTY');
  await page.getByTestId('owner-step-4').click();
  await expect(page.getByTestId('owner-market-results-evidence-scope-hold')).toBeVisible();checks++;
  await eq(ownerCap,'—');await eq(ownerRent,'—');
  // The advanced detail card must also quarantine the old subject amounts.
  await page.getByTestId('owner-advanced-mode').click();
  await eq(page.getByTestId('market-canonical-capital-indication'),'غير قابل للحساب');
  await eq(page.getByTestId('market-canonical-rent-indication'),'غير قابل للحساب');
  await expect(page.getByTestId('valuation-quality-gates')).toHaveCount(0);checks++;
  await expect(page.getByTestId('cross-method-reconciliation')).toHaveCount(0);checks++;
  await page.getByTestId('personal-market-study-export').click();
  await expect(page.getByTestId('market-study-action-notice')).toContainText('هوية عقار سابقة');checks++;
  await page.getByTestId('owner-simple-mode').click();
  await page.getByTestId('owner-step-4').click();
  await page.getByTestId('owner-market-review-comparables').click();
  await expect(page.getByTestId('owner-market-evidence-scope-hold')).toBeVisible();checks++;
  await expect(page.getByTestId('market-evidence-scope-hold')).toBeVisible();checks++;
  await page.getByTestId('market-evidence-subject-reconfirm').click();
  await expect(page.getByTestId('market-evidence-scope-hold')).toHaveCount(0);checks++;
  await expect(page.getByTestId('cohort-unit-mix')).toBeVisible();checks++;
  await expect(page.getByTestId('professional-comparables')).toBeVisible();checks++;
  await expect(page.getByTestId('fusion-evidence-scope-hold')).toHaveCount(0);checks++;
  await expect(page.getByTestId('fusion-export')).toBeEnabled();checks++;
  await expect(page.getByTestId('fusion-export-html')).toBeEnabled();checks++;
  await page.getByTestId('owner-step-4').click();
  await eq(ownerCap,money(independentValue));await eq(ownerRent,money(520000));
  await page.getByTestId('owner-step-0').click();
  await page.getByTestId('owner-valuation-date').fill('2026-10-20');
  await page.getByTestId('owner-step-4').click();
  await expect(page.getByTestId('owner-market-results-evidence-scope-hold')).toHaveCount(0);checks++;
  await eq(ownerCap,money(independentValue));await eq(ownerRent,money(520000));
  // Stale market values are quarantined immediately after the shared subject
  // changes, and missing coordinates cancel comparable eligibility.
  await page.getByTestId('owner-step-1').click();
  await page.getByTestId('owner-market-location').fill('NO_VALID_COORDINATES');
  await page.getByTestId('owner-step-4').click();
  await eq(ownerCap,'—');await eq(ownerRent,'—');
  await expect(page.getByTestId('owner-market-results').getByTestId('owner-evidence-review')).toContainText('إحداثيات العقار');checks++;
  await page.getByTestId('owner-review-LOCATION_EVIDENCE_MISSING').click();
  await expect(page.getByTestId('owner-market-location')).toBeFocused();checks++;
  assert.equal(pageErrors.length,0,'browser runtime errors '+pageErrors.join(';'));checks++;
  console.log('OWNER_MARKET_INDEPENDENT_EVIDENCE=PASS browser='+browserName+' assertions='+checks+' synthetic_only=true professional_approval=false');
 }finally{await page.close();await browser.close();}
})().catch(e=>{console.error('OWNER_MARKET_INDEPENDENT_EVIDENCE=FAIL browser='+browserName,e.stack||e);process.exitCode=1;});
