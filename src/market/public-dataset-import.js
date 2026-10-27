'use strict';
// Local-only CSV import for datasets whose re-use is permitted by their terms.
// No scraping, server fetch, credentials or inferred executed-deal status.
const MAX_CSV_BYTES = 512 * 1024;
const MAX_CSV_ROWS = 300;
function rowsFromCsv(raw) {
  if (typeof raw !== 'string' || raw.length > MAX_CSV_BYTES) throw new Error('CSV_SIZE_LIMIT');
  const input = raw.replace(/^\uFEFF/, '');
  const firstLine = input.split(/\r?\n/,1)[0] || '';
  const delimiter = firstLine.includes('\t') ? '\t' : firstLine.split(';').length > firstLine.split(',').length ? ';' : ',';
  const rows = []; let cell = '', row = [], quoted = false;
  for (let i=0;i<input.length;i++){
    const ch=input[i];
    if (ch==='"'){
      if(quoted && input[i+1]==='"') { cell+='"'; i++; }
      else quoted=!quoted;
    } else if(!quoted&&(ch===delimiter||ch==='\n'||ch==='\r')){
      row.push(cell.trim());cell='';
      if(ch!==delimiter){ if(row.some(v=>v!==''))rows.push(row);row=[];if(ch==='\r'&&input[i+1]==='\n')i++; }
      if(rows.length>MAX_CSV_ROWS+1)throw new Error('CSV_ROW_LIMIT');
    } else cell+=ch;
  }
  if(quoted)throw new Error('CSV_UNCLOSED_QUOTE');
  row.push(cell.trim());if(row.some(v=>v!==''))rows.push(row);
  if(rows.length<2)throw new Error('CSV_EMPTY');
  const cols=rows.shift();
  if(cols.length>55)throw new Error('CSV_TOO_MANY_COLUMNS');
  return {columns:cols,records:rows.map((values,i)=>({line:i+2,columns:Object.fromEntries(cols.map((col,j)=>[col,values[j]||'']))}))};
}
function norm(s){ return String(s||'').trim().replace(/[\s_\-/،.:()]+/g,'').toLowerCase(); }
const ALIASES = {
  assetType:['assetType','propertyType','نوع العقار','النوع العقاري','تصنيف العقار'],
  landSubtype:['landSubtype','landClassification','نوع الأرض','تصنيف الأرض','حالة الأرض'],
  status:['status','transactionStatus','حالة الصفقة','صفة الصفقة','نوع العملية','حالة العقد'],
  date:['date','transactionDate','تاريخ الصفقة','تاريخ الإفراغ','تاريخ العقد'],
  price:['price','salePrice','قيمة الصفقة','ثمن الصفقة','سعر البيع','قيمة البيع'],
  annualRent:['annualRent','rentPerYear','الإيجار السنوي','قيمة الإيجار السنوية'],
  builtArea:['builtArea','totalBuiltArea','المساحة المبنية','إجمالي المساحات المبنية'],
  landArea:['landArea','مساحة الأرض','المساحة الإجمالية للأرض'],
  rentableArea:['rentableArea','المساحة التأجيرية','المساحة القابلة للتأجير'],
  city:['city','المدينة'],
  district:['district','الحي','اسم الحي'],
  lat:['latitude','lat','خط العرض'],
  lng:['longitude','lng','خط الطول'],
  location:['location','coordinates','الموقع','الإحداثيات'],
  sourceUrl:['sourceUrl','source','رابط المصدر','مصدر الصفقة'],
  sourceRecordId:['transactionId','dealId','رقم الصفقة','مرجع الصفقة','رقم العقد'],
};
function col(record,key) {
  const names = new Set(ALIASES[key].map(norm));
  const entry=Object.entries(record).find(([field])=>names.has(norm(field)));
  return entry?entry[1]:'';
}
const TYPES={
  'مجمعسكني':'RESIDENTIAL_COMPOUND','عمارةسكنية':'RESIDENTIAL_BUILDING',
  'مجمعتجاري':'COMMERCIAL_COMPLEX','برجمكتبي':'OFFICE_TOWER',
  'برجتجاري':'OFFICE_TOWER','متعددالاستخدامات':'MIXED_USE',
  'مستودع':'WAREHOUSE','مستودعات':'WAREHOUSE',
  'أرض':'LAND','ارض':'LAND',
  'فندق':'HOTEL','فنادق':'HOTEL','فندقأوشققفندقية':'HOTEL',
  'مركزتجاري':'COMMERCIAL_MALL','مول':'COMMERCIAL_MALL','مولتجاري':'COMMERCIAL_MALL',
  'فيلا':'RESIDENTIAL_VILLA','فلل':'RESIDENTIAL_VILLA','فللسكنية':'RESIDENTIAL_VILLA',
  'مجمعلوجستي':'LOGISTICS_PARK','مجمعمستودعات':'LOGISTICS_PARK',
  'مصنع':'INDUSTRIAL_PROPERTY','منشأةصناعية':'INDUSTRIAL_PROPERTY',
  'مستشفى':'HEALTHCARE_PROPERTY','مركزصحي':'HEALTHCARE_PROPERTY','أصلصحيأومستشفى':'HEALTHCARE_PROPERTY',
};
function mapType(value){const n=norm(value);return TYPES[n]||(/^[A-Z_]+$/.test(String(value||''))?value.trim():'');}
function mapLandSubtype(value){
  const token=norm(value);
  const mapping={
    'raw':'RAW','خام':'RAW','أرضخام':'RAW','ارضخام':'RAW','غيرمخدومة':'RAW',
    'serviced':'SERVICED','مخدومة':'SERVICED','مخططةومخدومة':'SERVICED',
    'residential':'RESIDENTIAL','سكنية':'RESIDENTIAL','أرضسكنية':'RESIDENTIAL',
    'commercial':'COMMERCIAL','تجارية':'COMMERCIAL','أرضتجارية':'COMMERCIAL',
    'agricultural':'AGRICULTURAL','زراعية':'AGRICULTURAL','أرضزراعية':'AGRICULTURAL',
  };
  return mapping[token]||'';
}
function mapStatus(value) {
  const text=norm(value);
  if(['executed','completed','منفذة','منفذ','تمالإفراغ','إفراغ','موثق','مكتمل','بيعمنفذ','عقدموثق'].includes(text))return 'EXECUTED';
  return 'ASKING'; // unknown/advertised stays excluded, never promoted by default
}
function dateISO(value){const v=String(value||'').trim();return /^\d{4}-\d{2}-\d{2}$/.test(v)?v:'';}
function prepareImportCsv(raw,{kind,datasetUrl,rightsConfirmed=false}={}) {
  if(!rightsConfirmed)throw new Error('DATASET_RIGHTS_NOT_CONFIRMED');
  if(kind!=='sale'&&kind!=='rent')throw new Error('CSV_KIND_INVALID');
  if(!/^https:\/\/[^@\s/]+(?:\/.*)?$/i.test(String(datasetUrl||'')))throw new Error('DATASET_SOURCE_REQUIRED');
  const parsed=rowsFromCsv(raw);
  const r=parsed.records.map(({columns,line})=>{
    const lat=col(columns,'lat'),lng=col(columns,'lng');
    const location=col(columns,'location')|| (lat&&lng?lat+','+lng:'');
    const source=col(columns,'sourceUrl')||datasetUrl;
    return {
      assetType:mapType(col(columns,'assetType')),
      landSubtype:mapLandSubtype(col(columns,'landSubtype')),
      status:mapStatus(col(columns,'status')),
      date:dateISO(col(columns,'date')),
      price:kind==='sale'?col(columns,'price'):'',
      annualRent:kind==='rent'?col(columns,'annualRent'):'',
      builtArea:col(columns,'builtArea'),
      landArea:col(columns,'landArea'),
      rentableArea:col(columns,'rentableArea'),
      city:col(columns,'city'),district:col(columns,'district'),
      location, sourceUrl:source, sourceRecordId:col(columns,'sourceRecordId'),
      importLine:line, evidenceClass:'USER_IMPORTED_UNVERIFIED', datasetUrl,
    };
  });
  if(r.length>MAX_CSV_ROWS)throw new Error('CSV_ROW_LIMIT');
  return {rows:r,skipped:r.filter(x=>x.status!=='EXECUTED').length,
    source:datasetUrl,reviewRequired:true};
}
module.exports={rowsFromCsv,prepareImportCsv,MAX_CSV_BYTES,MAX_CSV_ROWS};
