const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const block=html.slice(html.indexOf('const needsIntroFields=()=>'),html.indexOf('const setupArray='));
const calculate=new Function('DEPTHS','state','fieldSamples','fieldWidth','fieldHeight','settingsValue','fieldMassScale','fieldKey','byId','LOCAL_LENS_SHIFT_LIMIT','LOCAL_LENS_MAX_STRENGTH','sourceViewports','FOCUS_MASS','WAVE_SHIFT',
  `let sourceBoundsKey='';${block}updateSourceBounds();return sourceViewports;`);
const W=1280,H=720,nx=64,ny=36;
const state={intro:{progress:1},submission:null,width:W,height:H,centerX:640,centerY:395,halfWidth:390,halfHeight:63.5,radius:32};
const fields=Array.from({length:3},(_,layer)=>Float32Array.from({length:nx*ny*4},(_,i)=>{
 const x=Math.floor(i/4)%nx,y=Math.floor(i/4/nx);
 return i%4===0?Math.sin(x*.4)*80*(layer+1):i%4===1?Math.cos(y*.5)*60*(layer+1):0;
}));
const focusMass=Number(html.match(/FOCUS_MASS = ([\d.]+)/)[1]);
const waveShift=Number(html.match(/WAVE_SHIFT = ([\d.]+)/)[1]);
const bounds=(mass,boost=30,width=150)=>calculate([1,2,3],state,fields,nx,ny,{gravity:mass,localBoost:boost,localWidth:width},1,'fixture',()=>({max:'150'}),12,30,new Float32Array(12),focusMass,waveShift);
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
   const x=random()*W,y=random()*H,angle=random()*Math.PI*2,wave=random()*waveShift;
   // Covers every possible wave direction, including stricter-than-production
   // excursions at viewport edges. Texture samples are clamped as in GLSL.
   const vx=x+Math.cos(angle)*wave,vy=y+Math.sin(angle)*wave;
   const s=sample(fields[layer],vx,vy).map(v=>v*(mass+(focusMass-mass)*activation));
   const t=Math.max(0,Math.min(1,Math.max(0,distance(x,y))/width)),weight=(1-t)**3*(1+3*t+6*t*t);
   const gain=30*weight/Math.sqrt(1+(s[0]**2+s[1]**2)/144);
   const sx=vx+s[0]*(1+gain),sy=vy+s[1]*(1+gain),i=layer*4;
   assert.ok(sx>=v[i]-.01&&sx<=v[i]+v[i+2]+.01&&sy>=v[i+1]-.01&&sy<=v[i+1]+v[i+3]+.01,'Clipped source coordinate');
  }
 }
});
test('local strength and reach cannot change source scale outside their band',()=>{
 assert.deepEqual(bounds(.28,0,1),bounds(.28,30,150));
});
