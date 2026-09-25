const {test}=require('node:test');
const assert=require('node:assert/strict');
const I=require('../lens-intro.js'),P=require('../mass-lens.js');
const total=m=>{let sum=0;for(let i=3;i<m.samples.length;i+=4)sum+=m.samples[i];return sum;};
test('stars precede mass growth, then the photon ring holds before opening',()=>{
 let previousMass=0;
 for(let t=0;t<=I.END+.1;t+=.005){
  const phase=I.timeline(t);
  assert.ok(phase.mass>=previousMass&&phase.mass>=0&&phase.mass<=1);previousMass=phase.mass;
  if(t<=I.MASS_START){assert.equal(phase.mass,0);assert.equal(phase.photon,0);}
  if(t<I.START)assert.equal(phase.progress,0);
  if(phase.progress>0)assert.equal(phase.mass,1);
 }
 assert.equal(I.timeline(I.MASS_START).mass,0);
 const middle=I.timeline((I.MASS_START+I.MASS_END)/2);
 assert.ok(middle.mass>0&&middle.mass<1);assert.equal(middle.progress,0);
 assert.equal(I.HOLD/2,.6);
 for(const t of [I.MASS_END,I.MASS_END+I.HOLD/2,I.START]){
  const phase=I.timeline(t);
  assert.equal(phase.mass,1);assert.equal(phase.photon,1);assert.equal(phase.progress,0);
 }
 assert.equal(I.timeline(I.START).mass,1);
 assert.equal((I.END-I.START)/2,1);
});
test('opening and reversible interactions share an exact one-second response',()=>{
 assert.equal(I.RESPONSE_SECONDS,1);
 for(const p of [0,.05,.125,.25,.5,.75,1]){
  assert.ok(Math.abs(I.response(p)-I.timeline(I.START+(I.END-I.START)*p).progress)<1e-12);
  assert.equal(I.transition(0,1,p),I.response(p));
  assert.equal(I.transition(1,0,p),1-I.response(p));
 }
 const interrupted=I.transition(0,1,.27);
 assert.equal(I.transition(interrupted,0,0),interrupted,'retargeting must start from the current displayed value');
 assert.equal(I.transition(interrupted,0,1),0);
 assert.equal(I.transition(0,1,1.3),1,'slow frames must still finish on time');
 assert.equal(I.transition(0,1,-.1),0);
});
test('circle opens monotonically into the exact final geometry on a shared timeline',()=>{
 const final={centerX:640,centerY:399,halfWidth:390,halfHeight:63.5,radius:32};
 assert.deepEqual(I.shape(final,1280,720,0),{centerX:640,centerY:360,halfWidth:63.5,halfHeight:63.5,radius:63.5});
 assert.deepEqual(I.shape(final,1280,720,1),final);
 let previous=0;
 for(let t=0;t<=I.END+1;t+=.01){const f=I.timeline(t),s=I.shape(final,1280,720,f.progress);assert.ok(f.progress>=previous);previous=f.progress;
  assert.equal(s.halfHeight,63.5);assert.ok(s.radius>=32&&s.radius<=s.halfHeight);assert.ok(s.halfWidth>=s.halfHeight);
  if(t<I.START)assert.deepEqual([f.progress,f.rim,f.copy,f.content],[0,0,0,0]);
 }
 // Begin growing the mass during the burst's deceleration.
 const opening=I.MASS_START/I.STAR_DAMPING;
 const burstProgress=1-(1+opening)*Math.exp(-opening);
 assert.ok(burstProgress>.7&&burstProgress<.9);
 assert.equal(I.timeline(I.START).progress,0);
 const duration=I.END-I.START,velocity=f=>{
  const t=I.START+f*duration,h=1e-5;
  return (I.timeline(t+h).progress-I.timeline(t-h).progress)/(2*h);
 };
 assert.ok(velocity(.125)>velocity(.02),'opening must accelerate from rest');
 assert.ok(velocity(.5)<velocity(.125),'opening must slow down after acceleration');
 assert.ok(velocity(0)<1e-4&&velocity(1)<1e-4,'no velocity jump at either endpoint');
 assert.deepEqual(I.timeline(I.END),{mass:1,progress:1,photon:0,rim:1,copy:1,content:1});
});
test('unit-mass maps preserve positive weights while centres move after the lens birth',()=>{
 for(const profile of ['original','shell','wide','compact']){
  const final=P.createProfileModel(390,63.5,32,19483.715808,profile),coarse=I.coarsen(final),mass=total(final);
  for(let step=0;step<=8;step++){
   const t=step/8,m=I.massAt(final,coarse,t);assert.ok(Math.abs(total(m)-mass)/mass<1e-7);assert.ok(m.epsilon>0);
   let x=0,y=0,z=0;
   for(let i=0;i<m.samples.length;i+=4){const w=m.samples[i+3];assert.ok(w>0);x+=m.samples[i]*w;y+=m.samples[i+1]*w;z+=(m.samples[i+2]-1)*w;}
   assert.ok(Math.hypot(x,y,z)/mass<1e-7);
   if(step===0){assert.equal(m.count,1);assert.deepEqual([...m.samples.slice(0,3)],[0,0,1]);}
  }
  assert.strictEqual(I.massAt(final,coarse,1),final,'the last frame must use the original full model');
 }
});
test('compact start is radial and transient quadrature approximates the final exterior field',()=>{
 const final=P.createProfileModel(390,63.5,32,19483.715808,'original'),coarse=I.coarsen(final),start=I.massAt(final,coarse,0);
 const a=P.traceDisplacement(100,0,2640,start,.26),b=P.traceDisplacement(0,100,2640,start,.26);
 assert.ok(Math.abs(a[0]-b[1])<1e-8&&Math.abs(a[1])+Math.abs(b[0])<1e-8);
 let error=0;
 for(const p of [[0,65],[100,65],[300,65],[400,0],[390,60],[0,150]]){
  const a=P.traceDisplacement(...p,2640,final,.26),b=P.traceDisplacement(...p,2640,coarse,.26);
  error=Math.max(error,Math.hypot(a[0]-b[0],a[1]-b[1]));
 }
 assert.ok(error<2,`transient quadrature differs by ${error}px`);
});
test('submission gathers smoothly into one core and waits for the entire wave before returning',()=>{
 const s=I.SUBMIT_TIMING,appearStart=s.collapse+s.hidden,openStart=appearStart+s.appear;
 const final={centerX:640,centerY:399,halfWidth:390,halfHeight:63.5,radius:32};
 assert.equal(s.hidden,I.WAVES.submit.duration);assert.equal(s.collapse,.65);assert.equal(s.open,1);
 assert.equal(I.submission(0).progress,1);
 let previous=1;
 for(let t=0;t<s.collapse;t+=.01){
  const p=I.submission(t),shape=I.submissionShape(final,1280,720,p);
  assert.equal(p.stage,'collapsing');assert.equal(p.photon,0);
  assert.ok(p.collapseScale<=previous);previous=p.collapseScale;
  if(t<s.collapse*.3)assert.equal(shape.halfHeight,final.halfHeight,'sides gather before the core contracts');
  assert.ok(shape.radius<=shape.halfHeight&&shape.radius<=shape.halfWidth);
  assert.ok(shape.halfWidth>0,'no intermediate stop');
 }
 const middle=I.submissionShape(final,1280,720,I.submission(s.collapse*.7));
 assert.ok(middle.halfWidth<final.halfWidth*.25);assert.ok(middle.halfHeight<final.halfHeight*.5);
 assert.deepEqual(I.submissionShape(final,1280,720,I.submission(s.collapse)),
  {centerX:640,centerY:360,halfWidth:0,halfHeight:0,radius:0});
 for(const t of [s.collapse,s.collapse+.5,appearStart-1e-6]){
  const p=I.submission(t);assert.equal(p.stage,'hidden');assert.equal(p.mass,0);assert.equal(p.photon,0);assert.equal(p.content,0);
 }
 // Velocity remains continuous where the centre begins contracting and
 // where the straight spans vanish: this catches the previous min() kink.
 const sample=t=>I.submissionShape(final,1280,720,I.submission(t));
 for(const point of [0,s.collapse*.3,s.collapse*.86,s.collapse]){
  const h=1e-5,a=sample(point-h),b=sample(point),c=sample(point+h);
  for(const key of ['halfWidth','halfHeight','radius'])
   assert.ok(Math.abs((b[key]-a[key])/h-(c[key]-b[key])/h)<.5,key+' velocity jump');
 }
 assert.equal(I.submission(appearStart).mass,0);
 assert.equal(I.submission(openStart).mass,1);
 assert.equal(I.submission(openStart).progress,0);
 assert.deepEqual(I.submission(I.SUBMIT_END),{mass:1,progress:1,stage:'idle',copy:1,photon:0,rim:1,content:1});
 for(const t of [s.collapse,appearStart,openStart,I.SUBMIT_END]){
  const a=I.submission(t-1e-6),b=I.submission(t+1e-6);
  for(const key of ['mass','progress','photon','rim','content'])assert.ok(Math.abs(a[key]-b[key])<1e-5,key+' discontinuity');
 }
 for(let t=0;t<=I.SUBMIT_END;t+=.01){
  const p=I.submission(t);assert.equal(p.copy,1);
  for(const key of ['mass','progress','photon','rim','content'])assert.ok(p[key]>=0&&p[key]<=1);
 }
});

test('birth ripple is brief and achromatic without a stroke; submission keeps its full wave',()=>{
 assert.ok(I.WAVES.birth.duration<I.WAVES.submit.duration/2);
 assert.equal(I.WAVES.birth.stroke,0);assert.equal(I.WAVES.submit.stroke,1);
 assert.ok(I.WAVES.birth.strength>0&&I.WAVES.birth.strength<=1);
 assert.ok(I.WAVES.birth.decay>I.WAVES.submit.decay);
});
