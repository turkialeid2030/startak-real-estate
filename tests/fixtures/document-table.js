'use strict';
// Entirely synthetic. Positions and expected cells are declared independently
// of extraction/reconstruction. No customer document is included in this file.
function nativeTablePdfFixture({merged=false,rotated=false,pages=1}={}) {
  const rows=[['Item','Amount','Note'],['Synthetic A','1234.50',''],['Synthetic B','-50.00','SAR']];
  const objects=['<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Count ${pages} /Kids [${Array.from({length:pages},(_,i)=>`${4+i*2} 0 R`).join(' ')}] >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  for(let page=0;page<pages;page++){
    const lines=[];
    for(let r=0;r<rows.length;r++)for(let c=0;c<rows[r].length;c++){
      if(!rows[r][c])continue;
      const text=merged&&r===0&&c===0?'MERGED HEADER ACROSS COLUMNS':rows[r][c];
      const x=merged&&r===0&&c===0?140:60+c*180, y=320-r*40;
      const matrix=rotated&&r===2&&c===2?`0 1 -1 0 ${x} ${y}`:`1 0 0 1 ${x} ${y}`;
      lines.push(`BT /F1 12 Tf ${matrix} Tm (${text}) Tj ET`);
    }
    const content=lines.join('\n');
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 400] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5+page*2} 0 R >>`,
      `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`);
  }
  let body='%PDF-1.7\n',offsets=[0];
  objects.forEach((value,i)=>{offsets.push(Buffer.byteLength(body));body+=`${i+1} 0 obj\n${value}\nendobj\n`;});
  const xref=Buffer.byteLength(body);
  body+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')
    +`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body);
}
module.exports={nativeTablePdfFixture};
