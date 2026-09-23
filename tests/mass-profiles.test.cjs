const {test}=require('node:test');
const assert=require('node:assert/strict');
const P=require('../mass-lens.js');
const {calibrateMass}=require('../lens-calibration.js');

test('fitted profiles have nonnegative mass, reflection symmetry and disclosed geometry',()=>{
 const focal=827.1559*P.OPTICAL_ZOOM;
 for(const profile of ['compact','shell','wide']){
  const m=P.createProfileModel(390,63.5,32,focal,profile);let sum=0,moments=[0,0,0];
  for(let i=0;i<m.samples.length;i+=4){const w=m.samples[i+3];assert.ok(w>=0&&Number.isFinite(w));sum+=w;for(let j=0;j<3;j++)moments[j]+=m.samples[i+j]*w;}
  assert.ok(sum>0&&Math.abs(sum-m.gm)<1e-12);
  for(const [j,expected] of [[0,0],[1,0],[2,1]])assert.ok(Math.abs(moments[j]/sum-expected)<1e-7);
  assert.equal(m.padding,profile==='compact'?0:profile==='shell'?25:45);
  for(const [x,y] of [[0,70],[390,0],[350,80]]){
   const a=P.traceDisplacement(x,y,12000,m),b=P.traceDisplacement(-x,-y,12000,m);
   assert.ok(Math.hypot(a[0]+b[0],a[1]+b[1])<1e-6);
  }
 }
 assert.deepEqual(P.createProfileModel(390,63.5,32,focal,'original'),P.createMassModel(390,63.5,32,focal));
});

const geometry={screenWidth:80,screenHeight:60,centerX:40,centerY:30,halfWidth:0,halfHeight:0,radius:0};
function affineField(xx,xy,yx,yy){const out=new Float32Array(8*6*4);for(let y=0;y<6;y++)for(let x=0;x<8;x++){const i=(y*8+x)*4;out[i]=xx*(x+.5)*10+xy*(y+.5)*10;out[i+1]=yx*(x+.5)*10+yy*(y+.5)*10;}return out;}
test('calibration bounds every source layer and keeps mass a single global multiplier',()=>{
 const r=calibrateMass([affineField(-.1,0,0,-.3),affineField(-.5,0,0,-.2)],8,6,geometry);
 assert.ok(Math.abs(r.scale-.88/(1.8*.5))<1e-10);
 assert.ok(Math.abs(1-1.8*r.scale*r.worst-.12)<1e-12);
 const zero=calibrateMass([affineField(0,0,0,0)],8,6,geometry);assert.equal(zero.scale,1);
});
test('calibration includes cross derivatives and clamped texture boundaries',()=>{
 const r=calibrateMass([affineField(-.3,.4,.4,-.3)],8,6,geometry);
 assert.ok(Math.abs(r.worst-.7)<1e-7);
 // Antisymmetric interior derivative has no contraction, but clamp-to-edge
 // makes it a shear along the texture boundary; that must still be bounded.
 const edge=calibrateMass([affineField(0,1,-1,0)],8,6,geometry);
 assert.ok(Math.abs(edge.worst-.5)<1e-7);
});
test('calibration ignores only cells entirely hidden behind the opaque input',()=>{
 const data=affineField(0,0,0,0);data[(3*8+4)*4]=1000;
 const visible=calibrateMass([data],8,6,geometry);
 const hidden=calibrateMass([data],8,6,{...geometry,halfWidth:30,halfHeight:25});
 assert.ok(visible.scale<.01);assert.equal(hidden.scale,1);
});
