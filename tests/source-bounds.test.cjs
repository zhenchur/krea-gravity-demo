const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const block=html.slice(html.indexOf('const needsIntroFields=()=>'),html.indexOf('const setupArray='));
const calculate=new Function('DEPTHS','state','fieldSamples','fieldWidth','fieldHeight','settingsValue','fieldMassScale','fieldKey','byId','LOCAL_LENS_SHIFT_LIMIT','LOCAL_LENS_MAX_STRENGTH','sourceViewports','FOCUS_MASS','WAVE_SHIFT','introBounds',
  `let sourceBoundsKey='',introKey='',introMassKey='';const detailViewports=new Float32Array(sourceViewports.length);${block}updateSourceBounds();return {sourceViewports,detailViewports};`);
const W=1280,H=720,nx=64,ny=36;
const state={intro:{progress:1},submission:null,width:W,height:H,centerX:640,centerY:395,halfWidth:390,halfHeight:63.5,radius:32};
const fields=Array.from({length:3},(_,layer)=>Float32Array.from({length:nx*ny*4},(_,i)=>{
 const x=Math.floor(i/4)%nx,y=Math.floor(i/4/nx);
 return i%4===0?Math.sin(x*.4)*80*(layer+1):i%4===1?Math.cos(y*.5)*60*(layer+1):0;
}));
const focusMass=Number(html.match(/FOCUS_MASS = ([\d.]+)/)[1]);
const waveShift=Number(html.match(/WAVE_SHIFT = ([\d.]+)/)[1]);
const maxWaveStrength=Math.max(...Object.values(require('../lens-intro.js').WAVES).map(wave=>wave.strength));
const bounds=(mass,boost=30,width=150)=>calculate([1,2,3],state,fields,nx,ny,{gravity:mass,localBoost:boost,localWidth:width},1,'fixture',()=>({max:'150'}),12,30,new Float32Array(12),focusMass,waveShift).sourceViewports;
function sample(data,x,y){
 const gx=x/W*nx-.5,gy=y/H*ny-.5,ix=Math.floor(gx),iy=Math.floor(gy),fx=gx-ix,fy=gy-iy;
 const read=(x,y,c)=>data[(Math.max(0,Math.min(ny-1,y))*nx+Math.max(0,Math.min(nx-1,x)))*4+c];
 return [0,1].map(c=>(read(ix,iy,c)*(1-fx)+read(ix+1,iy,c)*fx)*(1-fy)+(read(ix,iy+1,c)*(1-fx)+read(ix+1,iy+1,c)*fx)*fy);
}
function distance(x,y){const qx=Math.abs(x-state.centerX)-state.halfWidth+state.radius,qy=Math.abs(y-(H-state.centerY))-state.halfHeight+state.radius;return Math.hypot(Math.max(qx,0),Math.max(qy,0))+Math.min(Math.max(qx,qy),0)-state.radius;}
test('source bounds contain local deflection throughout focus and during the wave',()=>{
 let seed=41;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(const mass of [0,.28,4]){
  const v=bounds(mass);
  for(const activation of [0,.5,1])for(let layer=0;layer<3;layer++)for(const width of [1,8,150])for(let n=0;n<1500;n++){
   const x=random()*W,y=random()*H,angle=random()*Math.PI*2,wave=random()*waveShift*maxWaveStrength;
   // The impulse adds to the physical deflection, independently of the mass.
   // Include the stronger birth wave in every possible outward direction.
   const s=sample(fields[layer],x,y).map(v=>v*(mass+(focusMass-mass)*activation));
   const t=Math.max(0,Math.min(1,Math.max(0,distance(x,y))/width)),weight=(1-t)**3;
   const gain=30*weight/Math.sqrt(1+(s[0]**2+s[1]**2)/144);
   const sx=x+s[0]*(1+gain)+Math.cos(angle)*wave,sy=y+s[1]*(1+gain)+Math.sin(angle)*wave,i=layer*4;
   assert.ok(sx>=v[i]-.01&&sx<=v[i]+v[i+2]+.01&&sy>=v[i+1]-.01&&sy<=v[i+1]+v[i+3]+.01,'Clipped source coordinate');
  }
 }
});
test('local strength and reach cannot change source scale outside their band',()=>{
 assert.deepEqual(bounds(.28,0,1),bounds(.28,30,150));
});
test('compact-mass coverage preserves settled source density within the same atlas budget',()=>{
 const sizingStart=html.indexOf('const resizeSources=()=>'),sizing=html.slice(sizingStart,html.indexOf('resizeTarget=()=>',sizingStart));
 const allocate=new Function('state','detailViewports','sourceViewports','nativeDpr',`
  const DEPTHS=[1,2,3],SOURCE_BATCH_SIZE=4,starTexture={},gl={MAX_TEXTURE_SIZE:0,getParameter:()=>16384};
  const canvas={width:Math.round(state.width*nativeDpr),height:Math.round(state.height*nativeDpr),dataset:{}};
  let sourceBoundsKey='fixture',sourceSizingKey='',targetKey='',targetWidth=0,targetHeight=0;
  const setupArray=()=>{};${sizing}resizeSources();return {width:targetWidth,height:targetHeight,...canvas.dataset};`);
 const largeBounds=new Float32Array(Array.from({length:3},(_,i)=>[-6000-i*1000,-5000-i*1000,7000+i*1000,8000+i*1000,-4000,-3000,5000,6000]).flat());
 for(const [width,height,dpr] of [[1280,720,2],[390,844,1.5]])for(const mass of [.48,1.8,4]){
  const scene={...state,width,height,centerX:width/2,centerY:height/2};
  const run=(scene,introBounds)=>calculate([1,2,3],scene,fields,nx,ny,{gravity:mass},1,'fixture',()=>({max:'150'}),12,30,new Float32Array(12),focusMass,waveShift,introBounds);
  const idle=run(scene),transient=run({...scene,intro:{progress:.25},submission:{}},largeBounds);
  const cachedIdle=run(scene,largeBounds);
  assert.deepEqual(cachedIdle.sourceViewports,transient.sourceViewports,'Submitting changed the cached outer coverage');
  assert.deepEqual(cachedIdle.detailViewports,transient.detailViewports,'Submitting changed the cached detail coverage');
  assert.deepEqual(transient.detailViewports,idle.detailViewports,'Submission reduced the detail coverage scale');
  const a=allocate(scene,idle.detailViewports,idle.sourceViewports,dpr),b=allocate(scene,transient.detailViewports,transient.sourceViewports,dpr);
  assert.equal(b.width,a.width);assert.equal(b.height,a.height);assert.equal(b.sourcePixelRatio,a.sourcePixelRatio);
  assert.ok(Number(b.outerSourcePixelRatio)<Number(b.sourcePixelRatio),'Outer coverage was not isolated');
  assert.ok(Number(b.sourceAtlasBytes)<=320*1024*1024,'Atlas exceeded memory budget');
  assert.equal(b.sourceAtlasBytes,a.sourceAtlasBytes,'Submission allocated a larger atlas');
 }
});
test('transient physical-map cache remains below 18 MiB in portrait and landscape',()=>{
 const start=html.indexOf('const budget=12000,aspect='),end=html.indexOf('introWidth=w;',start);
 assert.ok(start>=0&&end>start,'Compact physical-map sizing missing');
 const size=new Function('state',`${html.slice(start,end)}return {w,h};`);
 for(const [width,height] of [[1280,720],[390,844],[320,2048],[3840,2160],[10240,720]]){
  const {w,h}=size({width,height});
  assert.ok(w>=1&&h>=1,'Invalid cache dimensions');
  assert.ok(w*h*8*24*8<=18*1024*1024,'Transient cache exceeded its memory budget');
 }
});
