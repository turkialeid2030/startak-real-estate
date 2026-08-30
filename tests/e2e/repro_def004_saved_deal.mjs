import { preview } from 'vite';
import { chromium } from 'playwright';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { findChromiumExecutable } = require('../config/paths');
const EXECUTABLE = findChromiumExecutable();
let previewServer, browser;
try {
  previewServer = await preview({ preview: { host: '127.0.0.1', port: 4173, strictPort: false } });
  const url = `http://127.0.0.1:${previewServer.httpServer.address().port}/`;
  browser = await chromium.launch({ headless: true, executablePath: EXECUTABLE, args: ['--no-sandbox','--disable-gpu'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(300);

  // Inject a corrupted saved-deal record directly into localStorage,
  // mimicking a hand-edited/legacy record with maxPaybackThreshold=0
  await page.evaluate(() => {
    const NAMESPACE = 'STARTAK_REAL_ESTATE:SAVED_DEALS:';
    const record = {
      id: 'deal_corrupted_test',
      name: 'Corrupted-DEF004-Deal',
      mode: 'building',
      inputs: { buildingPrice: 20000000, landLength: 100, landWidth: 53.26, buildingAge: 1, basementCount: 2, basementAreaEach: 7800, parkingAreaPerSpot: 60, floorCount: 6, avgFloorArea: 2200, rentPerSqm: 1800, occupancyRate: 1.0, leaseStatus: "مؤجر", leaseYears: 5, vatRate: 0.15, serviceIncomeRate: 0.12, opexRate: 0.28, marketCapRate: 0.085, discountRate: 0.11, minYieldThreshold: 0.08, maxPaybackThreshold: 0, holdPeriod: 10, rentGrowthRate: 0.03, commissionRate: 0.025, transferFeeRate: 0.05, replacementCostPerSqm: 4200, ltv: 0.6, loanRate: 0.065, loanTenor: 15, minDscrThreshold: 1.25, leverageEnabled: false, titleDeedVerified: false, complianceCertified: false, rentFreezeChecked: false },
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(NAMESPACE + 'deal:deal_corrupted_test', JSON.stringify(record));
    localStorage.setItem(NAMESPACE + 'deals-index', JSON.stringify([{ id: 'deal_corrupted_test', name: 'Corrupted-DEF004-Deal', mode: 'building', savedAt: record.savedAt }]));
  });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  await page.getByTitle('الصفقات المحفوظة').click();
  await page.waitForTimeout(300);
  const dealVisible = await page.getByText('Corrupted-DEF004-Deal').count();
  console.log('CORRUPTED_DEAL_VISIBLE=' + (dealVisible > 0));
  await page.getByText('Corrupted-DEF004-Deal').click();
  await page.waitForTimeout(500);

  const bodyAfterLoad = await page.locator('body').innerText();
  const hasError = bodyAfterLoad.includes('قيمة إدخال غير صالحة');
  console.log('DEF004_TRIGGERS_VALIDATION_BANNER=' + hasError);
  console.log('APP_RESPONSIVE_AFTER_LOAD=' + (bodyAfterLoad.length > 100));
  if (hasError) {
    const bannerText = await page.getByText('قيمة إدخال غير صالحة').locator('xpath=..').innerText();
    console.log('BANNER_TEXT=' + bannerText.slice(0, 200));
  } else {
    const maxPriceMatch = /أعلى سعر.{0,50}?([\d,]+)/.exec(bodyAfterLoad);
    console.log('NO_BANNER -- maxJustifiedPrice display sample: ' + (maxPriceMatch ? maxPriceMatch[0] : 'not found'));
  }
} catch(e) { console.log('FATAL: ' + e.message); }
finally {
  if (browser) await browser.close();
  if (previewServer) await new Promise(r => previewServer.httpServer.close(()=>r()));
  console.log('DONE');
}
