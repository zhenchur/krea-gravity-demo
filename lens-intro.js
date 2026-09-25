/* Geometry and positive-mass keyframes for the circle-to-input opening.
 * Intro uses star-animation time (default speed is 2x); UI cycles use seconds.
 */
(function(root){
  'use strict';
  const STAR_DAMPING=.8,RESPONSE_SECONDS=1;
  // Stars first, grow the circular lens from zero mass, hold, then open it.
  const MASS_START=STAR_DAMPING*3,MASS_DURATION=1.2;
  const MASS_END=MASS_START+MASS_DURATION,HOLD=1.2;
  const START=MASS_END+HOLD,DURATION=RESPONSE_SECONDS*2,END=START+DURATION,KEYFRAMES=8;
  // Submission uses real seconds, independently of the star speed/pause.
  const WAVES={submit:{duration:1.9,strength:1,stroke:1,decay:1},birth:{duration:.65,strength:.6,stroke:0,decay:2}};
  const SUBMIT_TIMING={collapse:.4,hidden:WAVES.submit.duration,appear:.45,open:RESPONSE_SECONDS};
  const SUBMIT_END=Object.values(SUBMIT_TIMING).reduce((sum,t)=>sum+t,0);
  const ease=(a,b,value)=>{const t=Math.max(0,Math.min(1,(value-a)/(b-a)));return Math.max(0,Math.min(1,t*t*t*(t*(t*6-15)+10)));};
  // One finite response for opening, hover, focus and the submission reset.
  function response(value){
    const t=Math.max(0,Math.min(1,value)),u=t*8;
    return 1-(1+u)*Math.exp(-u)*(1-ease(.65,1,t));
  }
  function transition(from,to,elapsed,seconds=RESPONSE_SECONDS){
    const progress=response(elapsed/seconds);
    return progress>=1?to:from+(to-from)*progress;
  }
  function timeline(time){
    const mass=response((time-MASS_START)/MASS_DURATION);
    const progress=response((time-START)/DURATION);
    const photon=ease(.05,.85,mass)*(1-ease(.02,.8,progress));
    return {mass,progress,photon,rim:ease(.12,.85,progress),copy:ease(.35,.93,progress),content:ease(.68,1,progress)};
  }
  function submission(time){
    const t=Math.max(0,time),s=SUBMIT_TIMING;
    const hiddenEnd=s.collapse+s.hidden,appearEnd=hiddenEnd+s.appear;
    if(t<hiddenEnd){
      // Pull the sides inward rapidly. Height is preserved until the last
      // narrow core disappears, with no pause or separate circular stage.
      const u=Math.min(1,t/s.collapse),scale=1-u*u;
      return {mass:ease(0,.18,scale),progress:scale,collapseScale:scale,
        stage:t<s.collapse?'collapsing':'hidden',copy:1,photon:0,
        rim:ease(0,.06,scale),content:1-ease(0,.15,u)};
    }
    let progress=0,mass=1,stage='collapsing';
    if(t<appearEnd){mass=response((t-hiddenEnd)/s.appear);stage='appearing';}
    else {progress=response((t-appearEnd)/s.open);stage=t<SUBMIT_END?'opening':'idle';}
    return {mass,progress,stage,copy:1,photon:ease(.05,.85,mass)*(1-ease(.02,.8,progress)),
      rim:ease(.12,.85,progress),content:ease(.68,1,progress)};
  }
  function shape(final,width,height,progress){
    const mix=(a,b)=>a+(b-a)*progress;
    return {centerX:mix(width/2,final.centerX),centerY:mix(height/2,final.centerY),
      halfWidth:mix(final.halfHeight,final.halfWidth),halfHeight:final.halfHeight,
      radius:mix(final.halfHeight,final.radius)};
  }
  function submissionShape(final,width,height,phase){
    if(phase.collapseScale===undefined)return shape(final,width,height,phase.progress);
    const s=phase.collapseScale;
    const halfWidth=final.halfWidth*s,halfHeight=Math.min(final.halfHeight,halfWidth);
    return {centerX:width/2+(final.centerX-width/2)*s,centerY:height/2+(final.centerY-height/2)*s,
      halfWidth,halfHeight,radius:Math.min(final.radius+(final.halfHeight-final.radius)*(1-s),halfHeight)};
  }
  function coarsen(model){
    // Merge positive quadrature cells; preserve mass, weighted centroid and
    // kernel radius. The exact final field replaces this transient quadrature.
    const counts=[24,4,4],bins=new Map();
    for(let i=0;i<model.samples.length;i+=4){
      const p=[model.samples[i],model.samples[i+1],model.samples[i+2]-1],w=model.samples[i+3];
      const indices=p.map((v,j)=>Math.max(0,Math.min(counts[j]-1,Math.floor((v/model.half[j]+1)*.5*counts[j]))));
      const key=(indices[0]*counts[1]+indices[1])*counts[2]+indices[2];
      const cell=bins.get(key)||[0,0,0,0];
      for(let j=0;j<3;j++)cell[j]+=p[j]*w;
      cell[3]+=w;bins.set(key,cell);
    }
    const samples=new Float32Array([...bins.values()].flatMap(c=>[c[0]/c[3],c[1]/c[3],1+c[2]/c[3],c[3]]));
    const epsilon=model.epsilon;
    return {...model,samples,epsilon,count:samples.length/4};
  }
  function massAt(model,coarse,progress){
    if(progress>=1)return model;
    if(progress===0){
      let gm=0;for(let i=3;i<coarse.samples.length;i+=4)gm+=coarse.samples[i];
      return {...coarse,samples:new Float32Array([0,0,1,gm]),count:1,epsilon:model.half[1]*.5};
    }
    const samples=new Float32Array(coarse.samples.length);
    for(let i=0;i<samples.length;i+=4){
      samples[i]=coarse.samples[i]*progress;
      samples[i+1]=coarse.samples[i+1]*progress;
      samples[i+2]=1+(coarse.samples[i+2]-1)*progress;
      samples[i+3]=coarse.samples[i+3];
    }
    // Initially all centres coincide, with a finite core inside the black disc.
    const core=model.half[1]*.5;
    const epsilon=core+(coarse.epsilon-core)*progress;
    return {...coarse,samples,epsilon};
  }
  const api={STAR_DAMPING,RESPONSE_SECONDS,MASS_START,MASS_END,HOLD,START,END,KEYFRAMES,WAVES,SUBMIT_TIMING,SUBMIT_END,response,transition,timeline,submission,submissionShape,shape,coarsen,massAt};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.GravityIntro=api;
})(typeof window==='object'?window:globalThis);
