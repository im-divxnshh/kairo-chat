const fs=require('node:fs'),path=require('node:path');
const {executable,runFile}=require('../src/lib/providers');
const root=path.resolve(__dirname,'..');
async function buildBrand(){
  if(process.platform!=='darwin')throw new Error('Brand assets are generated with macOS drawing tools. Prebuilt assets are included for Windows.');
  fs.mkdirSync(path.join(root,'.native-cache'),{recursive:true});
  const drawing=path.join(root,'.native-cache','kairo-brand');
  const compiler=executable('swiftc');if(!compiler)throw new Error('Install Xcode command line tools to regenerate artwork.');
  let result=await runFile(compiler,['-module-cache-path',path.join(root,'.native-cache'),path.join(__dirname,'branding/draw.swift'),'-o',drawing],{timeout:120000});if(result.code)throw new Error(result.stderr);
  const png=path.join(root,'src/assets/branding/icon.png');if(fs.existsSync(png))fs.unlinkSync(png);
  result=await runFile(drawing,[root],{timeout:120000});if(result.code)throw new Error(result.stderr);
  const set=path.join(root,'build/icon.iconset');
  for(const size of [16,32,128,256,512])for(const scale of [1,2])fs.copyFileSync(path.join(root,`build/icon-${size*scale}.png`),path.join(set,`icon_${size}x${size}${scale===2?'@2x':''}.png`));
  // Modern ICNS files contain size-tagged PNG chunks; no disk-image or iconutil access is needed.
  const tags=[['icp4',16],['icp5',32],['icp6',64],['ic07',128],['ic08',256],['ic09',512],['ic10',1024],['ic11',32],['ic12',64],['ic13',256],['ic14',512]];
  const chunks=tags.map(([tag,size])=>{const data=fs.readFileSync(path.join(root,`build/icon-${size}.png`)),head=Buffer.alloc(8);head.write(tag);head.writeUInt32BE(data.length+8,4);return Buffer.concat([head,data]);});
  const icnsHeader=Buffer.alloc(8);icnsHeader.write('icns');icnsHeader.writeUInt32BE(8+chunks.reduce((sum,bytes)=>sum+bytes.length,0),4);fs.writeFileSync(path.join(root,'build/icon.icns'),Buffer.concat([icnsHeader,...chunks]));
  // NSIS expects classic 24-bit BMP artwork rather than AppKit's 32-bit V5 export.
  for(const name of ['installer-sidebar','installer-header']){
    const file=path.join(root,'build',name+'.bmp'),input=fs.readFileSync(file),width=input.readInt32LE(18),signedHeight=input.readInt32LE(22),height=Math.abs(signedHeight),sourceOffset=input.readUInt32LE(10),stride=Math.ceil(width*3/4)*4;
    if(input.readUInt16LE(28)!==32)throw new Error('Unexpected native BMP format.');
    const output=Buffer.alloc(54+stride*height);output.write('BM');output.writeUInt32LE(output.length,2);output.writeUInt32LE(54,10);output.writeUInt32LE(40,14);output.writeInt32LE(width,18);output.writeInt32LE(height,22);output.writeUInt16LE(1,26);output.writeUInt16LE(24,28);output.writeUInt32LE(stride*height,34);
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){const sourceY=signedHeight<0?height-1-y:y,at=sourceOffset+(sourceY*width+x)*4;input.copy(output,54+y*stride+x*3,at,at+3);}fs.writeFileSync(file,output);
  }
  const sizes=[16,24,32,48,64,128,256],images=sizes.map(size=>fs.readFileSync(path.join(root,`build/icon-${size}.png`))),header=Buffer.alloc(6+16*sizes.length);header.writeUInt16LE(1,2);header.writeUInt16LE(sizes.length,4);let offset=header.length;
  images.forEach((bytes,i)=>{const at=6+i*16,size=sizes[i];header[at]=header[at+1]=size===256?0:size;header.writeUInt16LE(1,at+4);header.writeUInt16LE(32,at+6);header.writeUInt32LE(bytes.length,at+8);header.writeUInt32LE(offset,at+12);offset+=bytes.length;});
  fs.writeFileSync(path.join(root,'build/icon.ico'),Buffer.concat([header,...images]));
  const guide=fs.readFileSync(path.join(__dirname,'branding/guide.html'),'utf8').replace('{{MASCOT}}',fs.readFileSync(path.join(root,'src/assets/branding/mascot.svg'),'utf8')).replace('{{ICON}}','data:image/png;base64,'+fs.readFileSync(png).toString('base64'));fs.writeFileSync(path.join(root,'build/Start here.html'),guide);
  require('./verify-brand')(root);
  console.log('Kairo .icns, multi-size .ico, PNG frames, installer backgrounds and animated guide built and validated.');
}
module.exports=buildBrand;if(require.main===module)buildBrand().catch(error=>{console.error(error.message);process.exitCode=1;});
