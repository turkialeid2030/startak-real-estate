'use strict';
// Synthetic, non-customer PDFs with an explicit ToUnicode map. Fixtures test
// extraction semantics; they are not claims of Arabic visual-layout fidelity.
function pdfFixture({text='Capital rent 1500.00 / عقار الرياض',pages=1,blank=false}={}) {
 const chars=[...new Set([...text])], map=new Map(chars.map((c,i)=>[c,i+1]));
 const cid=n=>n.toString(16).padStart(4,'0').toUpperCase();
 const cmap='/CIDInit /ProcSet findresource begin 12 dict begin begincmap /CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def /CMapName /Test def /CMapType 2 def 1 begincodespacerange <0000> <FFFF> endcodespacerange '+chars.length+' beginbfchar '+chars.map(c=>'<'+cid(map.get(c))+'> <'+cid(c.codePointAt(0))+'>').join(' ')+' endbfchar endcmap CMapName currentdict /CMap defineresource pop end end';
 const objects=['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Count '+pages+' /Kids ['+Array.from({length:pages},(_,i)=>(6+2*i)+' 0 R').join(' ')+'] >>', '<< /Type /Font /Subtype /Type0 /BaseFont /Helvetica /Encoding /Identity-H /DescendantFonts [4 0 R] /ToUnicode 5 0 R >>', '<< /Type /Font /Subtype /CIDFontType2 /BaseFont /Helvetica /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /DW 600 >>', '<< /Length '+cmap.length+' >>\nstream\n'+cmap+'\nendstream'];
 for(let i=0;i<pages;i++){
  const content=blank?'':`BT /F1 12 Tf 30 700 Td <${[...text].map(c=>cid(map.get(c))).join('')}> Tj ET`;
  objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${7+2*i} 0 R >>`,'<< /Length '+content.length+' >>\nstream\n'+content+'\nendstream');
 }
 let body='%PDF-1.7\n',offsets=[0];for(let i=0;i<objects.length;i++){offsets.push(Buffer.byteLength(body));body+=(i+1)+' 0 obj\n'+objects[i]+'\nendobj\n';}
 const offset=Buffer.byteLength(body);body+='xref\n0 '+(objects.length+1)+'\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size '+(objects.length+1)+' /Root 1 0 R >>\nstartxref\n'+offset+'\n%%EOF\n';return Buffer.from(body);
}
module.exports={pdfFixture};
