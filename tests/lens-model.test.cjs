const assert=require('node:assert/strict');
const {test}=require('node:test');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const P=require('../mass-lens.js');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
new vm.Script(html.match(/<script>([\s\S]*?)<\/script>/)[1]);
const model=P.createMassModel(390,63.5,32,827.1559);
const norm=v=>Math.hypot(...v),subtract=(a,b)=>a.map((v,i)=>v-b[i]);
const close=(a,b,tolerance,message)=>assert.ok(norm(subtract(a,b))<tolerance,message||`${a} != ${b}`);

test('positive, symmetric volume with controlled weak-field compactness',()=>{
 let mass=0,centroid=[0,0,0];
 for(let i=0;i<model.samples.length;i+=4){
  const gm=model.samples[i+3];assert.ok(gm>0);mass+=gm;
  for(let j=0;j<3;j++)centroid[j]+=model.samples[i+j]*gm;
 }
 assert.ok(Math.abs(mass-model.gm)<1e-9);
 close(centroid.map(x=>x/mass),[0,0,1],1e-7);
 assert.ok(Math.abs(P.potentialAndGradient([0,0,1],model).potential+P.BASE_POTENTIAL)<1e-8);
 assert.ok(P.BASE_POTENTIAL*1.8<.025);
});

test('deflection comes from one conservative gravitational potential',()=>{
 const h=1e-5;
 for(const p of [[.6,.1,1],[.2,.2,.85],[-.3,.15,1.1],[0,0,.5]]){
  const analytic=P.potentialAndGradient(p,model).gradient;
  const numeric=p.map((_,i)=>{
   const a=[...p],b=[...p];a[i]+=h;b[i]-=h;
   return (P.potentialAndGradient(a,model).potential-P.potentialAndGradient(b,model).potential)/(2*h);
  });
  close(analytic,numeric,1e-8);
  for(let i=0;i<3;i++)for(let j=i+1;j<3;j++){
   const derivative=(axis,component)=>{
    const a=[...p],b=[...p];a[axis]+=h;b[axis]-=h;
    return (P.potentialAndGradient(a,model).gradient[component]-P.potentialAndGradient(b,model).gradient[component])/(2*h);
   };
   assert.ok(Math.abs(derivative(i,j)-derivative(j,i))<1e-7,'no invented curl');
  }
 }
});

// Independent numerical path integral; does not reuse the analytic primitive.
function numericRay(px,py,depth,m){
 const n=[px/m.focal,py/m.focal,1],length=norm(n);for(let j=0;j<3;j++)n[j]/=length;
 const D=depth/P.LENS_DEPTH,S=D/n[2],N=12000,step=S/N,sum=[0,0,0];
 for(let k=0;k<=N;k++){
  const t=k*step,g=P.potentialAndGradient(n.map(v=>v*t),m).gradient;
  const parallel=g.reduce((s,v,j)=>s+v*n[j],0),weight=k===0||k===N?1:k%2?4:2;
  for(let j=0;j<3;j++)sum[j]+=-2*(S-t)*(g[j]-parallel*n[j])*weight*step/3;
 }
 return [0,1].map(j=>m.focal/D*(sum[j]-n[j]/n[2]*sum[2]));
}

test('finite observer/source ray integral matches independent integration',()=>{
 const small=P.createMassModel(390,63.5,32,827.1559,4);
 for(const depth of [150,220,900])close(P.traceDisplacement(400,90,depth,small),numericRay(400,90,depth,small),1e-7);
});

test('point-mass limit reproduces GR factor 4GM/(c²b)',()=>{
 const point={samples:new Float32Array([0,0,1,1e-6]),epsilon:1e-8,focal:10000};
 const shift=P.traceDisplacement(100,0,2200000,point);
 close(shift,[-4,0],.001);
});

test('zero mass, mass scaling, symmetry and foreground attenuation',()=>{
 for(const [x,y] of [[0,80],[260,144],[420,0],[400,90]]){
  const a=P.traceDisplacement(x,y,4000,model);
  close(P.traceDisplacement(-x,-y,4000,model),a.map(v=>-v),1e-6);
  close(P.traceDisplacement(x,y,4000,model,1.8),a.map(v=>v*1.8),1e-8);
  close(P.traceDisplacement(x,y,4000,model,0),[0,0],1e-10);
  assert.ok(norm(P.traceDisplacement(x,y,100,model))<norm(a)*.1);
 }
});

test('depth weights preserve source energy and have subpixel mapping error',()=>{
 for(let d=50;d<50000;d*=1.013){
  const weights=P.DEPTHS.map((_,i)=>P.depthWeight(d,i));
  assert.ok(Math.abs(weights.reduce((a,b)=>a+b,0)-1)<1e-12);
  assert.ok(weights.filter(x=>x>0).length<=2);
 }
 for(const p of [[0,64],[260,144],[420,0],[400,90]])for(const d of [150,220,300,400,1000,4000,12000]){
  const interpolated=[0,0];
  P.DEPTHS.forEach((z,i)=>{const w=P.depthWeight(d,i);if(w){const q=P.traceDisplacement(...p,z,model);for(let j=0;j<2;j++)interpolated[j]+=q[j]*w;}});
  close(interpolated,P.traceDisplacement(...p,d,model),.3);
 }
});

test('volume quadrature converges within half a CSS pixel at base mass',()=>{
 const refined=P.createMassModel(390,63.5,32,827.1559,12);
 for(const p of [[0,64],[260,144],[420,0],[400,90],[0,200]])for(const d of [150,220,400,2000,12000]){
  close(P.traceDisplacement(...p,d,model),P.traceDisplacement(...p,d,refined),.5);
 }
});

test('strong imaging keeps weak compactness and produces genuine critical curves',()=>{
 const m=P.createMassModel(390,63.5,32,827.1559*P.OPTICAL_ZOOM);
 assert.ok(Math.abs(P.potentialAndGradient([0,0,1],m).potential+P.BASE_POTENTIAL)<1e-8);
 const map=(x,y)=>P.traceDisplacement(x,y,4000,m).map((v,i)=>v+[x,y][i]);
 const p=map(0,100),dx=map(.01,100),dy=map(0,100.01);
 const horizontalScale=(dx[0]-p[0])/.01;
 assert.ok(horizontalScale>0&&horizontalScale<.08,'more than 12× tangential magnification above the input');
 const determinant=(x,y)=>{const p=map(x,y),a=map(x+.01,y),b=map(x,y+.01);return ((a[0]-p[0])*(b[1]-p[1])-(a[1]-p[1])*(b[0]-p[0]))/.0001;};
 assert.ok(determinant(450,0)<0&&determinant(700,0)>0,'the physical map crosses a critical curve outside the body');
 for(const point of [[0,75],[260,144],[400,90],[450,0]])for(const d of [150,210,218,219,220,221,222,223,225,230,240,400,4000,12000]) {
  const interpolated=[0,0];P.DEPTHS.forEach((z,i)=>{const w=P.depthWeight(d,i);if(w){const q=P.traceDisplacement(...point,z,m);for(let j=0;j<2;j++)interpolated[j]+=q[j]*w;}});
  close(interpolated,P.traceDisplacement(...point,d,m),.25,'depth grid must resolve the thin lens volume');
 }
});
