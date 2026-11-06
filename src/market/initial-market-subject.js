'use strict';
// Canonical initial market-study subject. No real ownership, location evidence,
// valuation date, comparable or property interest is inferred from this shell.
const createInitialMarketSubject=()=>({
  name:'',assetType:'RESIDENTIAL_COMPOUND',landSubtype:'',city:'الرياض',district:'',location:'',
  landArea:'',builtArea:'',rentableArea:'',buildingCount:'',unitCount:'',floorCount:'',
  roomCount:'',shopCount:'',parkingCount:'',warehouseCount:'',clearHeight:'',loadingDocks:'',
  historicalAnnualRent:'',leaseHistory:'UNKNOWN',urbanBoundary:'UNKNOWN',
  valuationPurpose:'',valuationDate:'',propertyRight:'UNKNOWN',
  zoningClassification:'',inspectionStatus:'NOT_INSPECTED',inspectionDate:'',
});
module.exports={createInitialMarketSubject};
