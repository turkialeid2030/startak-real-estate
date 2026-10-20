'use strict';
// Synthetic 1000x250 monochrome text: LOCAL OCR TEST / RENT 1234.50 SAR.
// No customer document, identifier, image or financial assumption is included.
const PNG='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';
const pngTextFixture=()=>Buffer.from(PNG,'base64');
function imagePdfFixture(images) {
  const objects=[Buffer.from('<< /Type /Catalog /Pages 2 0 R >>'),null];
  const kids=[];
  for(const image of images){
    const id=objects.length+1;kids.push(id+' 0 R');
    const draw=Buffer.from(`q ${image.width} 0 0 ${image.height} 0 0 cm /Im1 Do Q`);
    objects.push(Buffer.from(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${image.width} ${image.height}] /Resources << /XObject << /Im1 ${id+1} 0 R >> >> /Contents ${id+2} 0 R >>`));
    objects.push(Buffer.concat([Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.bytes.length} >>\nstream\n`),image.bytes,Buffer.from('\nendstream')]));
    objects.push(Buffer.concat([Buffer.from(`<< /Length ${draw.length} >>\nstream\n`),draw,Buffer.from('\nendstream')]));
  }
  objects[1]=Buffer.from(`<< /Type /Pages /Count ${images.length} /Kids [${kids.join(' ')}] >>`);
  const output=[Buffer.from('%PDF-1.4\n')],offsets=[0];let offset=output[0].length;
  objects.forEach((object,i)=>{offsets.push(offset);const bytes=Buffer.concat([Buffer.from(`${i+1} 0 obj\n`),object,Buffer.from('\nendobj\n')]);output.push(bytes);offset+=bytes.length;});
  output.push(Buffer.from(`xref\n0 ${offsets.length}\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${offset}\n%%EOF\n`));
  return Buffer.concat(output);
}
module.exports={pngTextFixture,imagePdfFixture};
