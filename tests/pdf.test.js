const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { readAttachment } = require('../src/lib/workspace'), C = require('../src/lib/core');
function pdfFixture() {
  const stream = 'BT /F1 16 Tf 40 100 Td (Hello Kairo PDF) Tj ET';
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`];
  let output = '%PDF-1.4\n', offsets = [];
  objects.forEach((object,index) => { offsets.push(Buffer.byteLength(output)); output += `${index+1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(output); output += `xref\n0 6\n0000000000 65535 f \n${offsets.map(offset=>String(offset).padStart(10,'0')+' 00000 n ').join('\n')}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return output;
}
test('native PDF text extraction returns an attachment usable by the existing chat context', { skip:process.platform!=='darwin' }, async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(),'kairo-pdf-')), file = path.join(directory,'document.pdf');
  try { fs.writeFileSync(file,pdfFixture()); const attachment = await readAttachment(file,C.defaults); assert.equal(attachment.kind,'text'); assert.match(attachment.content,/Hello Kairo PDF/); assert.equal(attachment.sourceType,'pdf'); assert.ok(C.buildContext(C.initialState(),C.conversation('claude'),[{role:'user',content:'Explain it',attachments:[attachment]}]).includes('Hello Kairo PDF')); }
  finally { fs.rmSync(directory,{recursive:true,force:true}); }
});
