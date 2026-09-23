/* Weak-field GR, first Born approximation. c = 1, lens distance = 1.
 * Rays integrate a positive 3D density, not a prescribed screen contour.
 * Each quadrature cell is a softened (Plummer) mass; refinement converges
 * toward a uniform rounded cuboid. The softening radius shrinks with cells.
 */
(function(root) {
  'use strict';
  const LENS_DEPTH = 220;
  // A narrow optical field makes a compact mass a strong imaging lens while
  // retaining a weak gravitational potential. Camera-space X/Y are scaled by
  // the same factor in the star projection, preserving the visible star flow.
  const OPTICAL_ZOOM = 30;
  const DEPTHS = [.35,.7,.94,.985,.997,1,1.003,1.015,1.05,1.15,1.5,2,3,4.5,6.5,9,12,16,21,28,38,55,78,110].map(x=>x*LENS_DEPTH);
  const BASE_POTENTIAL = .012;
  function roundedBoxDistance(p, half, radius) {
    const q=p.map((v,i)=>Math.abs(v)-half[i]+radius);
    return Math.hypot(...q.map(v=>Math.max(v,0)))+Math.min(Math.max(...q),0)-radius;
  }
  function createMassModel(halfWidth,halfHeight,radius,focal,resolution=8) {
    const half=[halfWidth/focal,halfHeight/focal,halfHeight/focal];
    const r=Math.min(radius/focal,...half);
    const counts=half.map(v=>Math.max(4,2*Math.ceil(v/half[1]*resolution/2)));
    const cell=half.map((v,i)=>2*v/counts[i]),epsilon=Math.max(...cell)*.45;
    const nodes=[];
    for(let z=0;z<counts[2];z++)for(let y=0;y<counts[1];y++)for(let x=0;x<counts[0];x++) {
      const center=[x,y,z].map((v,i)=>-half[i]+(v+.5)*cell[i]);
      let coverage=0;
      for(const sx of [-.25,.25])for(const sy of [-.25,.25])for(const sz of [-.25,.25]) {
        if(roundedBoxDistance(center.map((v,i)=>v+[sx,sy,sz][i]*cell[i]),half,r)<=0)coverage+=.125;
      }
      if(coverage)nodes.push([...center,coverage]);
    }
    const weight=nodes.reduce((sum,n)=>sum+n[3],0);
    // Fixed compactness, not a radius chosen to force an Einstein ring.
    const centerPotential=nodes.reduce((sum,n)=>sum+n[3]/weight/Math.sqrt(n[0]**2+n[1]**2+n[2]**2+epsilon**2),0);
    const gm=BASE_POTENTIAL/centerPotential;
    const samples=new Float32Array(nodes.flatMap(n=>[n[0],n[1],1+n[2],n[3]/weight*gm]));
    return {samples,epsilon,gm,half,radius:r,focal,count:nodes.length};
  }
  const profiles=typeof module==='object'&&module.exports?require('./mass-profiles.js'):root.GravityMassProfiles;
  function createProfileModel(halfWidth,halfHeight,radius,focal,profile='shell',resolution=8) {
    if(profile==='original')return createMassModel(halfWidth,halfHeight,radius,focal,resolution);
    const recipe=profiles[profile];
    if(!recipe)throw new Error('Unknown mass profile: '+profile);
    const padding=halfHeight*recipe.paddingRatio;
    const model=createMassModel(halfWidth+padding,halfHeight+padding,radius+padding,focal,resolution);
    // Overlapping Plummer cells are the positive, smooth physical density.
    // Increase overlap in fitted profiles to avoid small grid-scale lenses.
    model.epsilon*=recipe.softening/.45;
    const basis=(position,count)=>{
      const values=[];let sum=0;
      for(let i=0;i<count;i++){
        const center=i/(count-1),sigma=1/(count-1);
        const v=Math.exp(-.5*((position-center)/sigma)**2)+Math.exp(-.5*((position+center)/sigma)**2);
        values.push(v);sum+=v;
      }
      return values.map(v=>v/sum);
    };
    let gm=0;
    for(let i=0;i<model.samples.length;i+=4){
      const bx=basis(model.samples[i]/model.half[0],recipe.nx),by=basis(model.samples[i+1]/model.half[1],recipe.ny);
      let density=0;
      for(let x=0;x<recipe.nx;x++)for(let y=0;y<recipe.ny;y++)density+=bx[x]*by[y]*recipe.coefficients[x*recipe.ny+y];
      model.samples[i+3]*=density;gm+=model.samples[i+3];
    }
    return {...model,gm,profile,padding};
  }
  function potentialAndGradient(point,model) {
    let potential=0;const gradient=[0,0,0];
    for(let i=0;i<model.samples.length;i+=4) {
      const q=point.map((v,j)=>v-model.samples[i+j]);
      const r2=q.reduce((a,v)=>a+v*v,model.epsilon**2),inv=1/Math.sqrt(r2),gm=model.samples[i+3];
      potential-=gm*inv;
      for(let j=0;j<3;j++)gradient[j]+=gm*q[j]*inv/r2;
    }
    return {potential,gradient};
  }
  function traceDisplacement(px,py,sourceDepth,model,mass=1) {
    if(sourceDepth<=0||mass===0)return [0,0];
    const direction=[px/model.focal,py/model.focal,1];
    const norm=Math.hypot(...direction),n=direction.map(v=>v/norm);
    const depth=sourceDepth/LENS_DEPTH,S=depth/n[2],shift=[0,0,0];
    for(let i=0;i<model.samples.length;i+=4) {
      const m=Array.from(model.samples.subarray(i,i+3)),h=n.reduce((a,v,j)=>a+v*m[j],0);
      const b=n.map((v,j)=>v*h-m[j]),B2=b.reduce((a,v)=>a+v*v,model.epsilon**2);
      const r0=Math.sqrt(B2+h*h),rs=Math.sqrt(B2+(S-h)**2);
      // Integral_0^S (S-t)/(B²+(t-h)²)^(3/2) dt, finite endpoints.
      const A=r0*r0-S*h;
      // Rationalized branch avoids catastrophic cancellation before the lens,
      // especially with narrow-angle rays and 32-bit GPU arithmetic.
      const integral=A>=0?S*S/(r0*(rs*r0+A)):(rs*r0-A)/(B2*r0);
      for(let j=0;j<3;j++)shift[j]-=2*model.samples[i+3]*b[j]*integral*mass;
    }
    // Intersect the perturbed ray with the source's fixed Z plane.
    return [0,1].map(j=>model.focal/depth*(shift[j]-n[j]/n[2]*shift[2]));
  }
  function depthWeight(depth,index,planes=DEPTHS) {
    const current=planes[index],previous=planes[index-1],next=planes[index+1];
    const v=depth<current ? previous ? (1/depth-1/previous)/(1/current-1/previous) : 1
      : next ? (1/depth-1/next)/(1/current-1/next) : 1;
    return Math.max(0,Math.min(1,v));
  }
  const api={LENS_DEPTH,OPTICAL_ZOOM,DEPTHS,BASE_POTENTIAL,roundedBoxDistance,createMassModel,createProfileModel,potentialAndGradient,traceDisplacement,depthWeight};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.GravityPhysics=api;
})(typeof window==='object'?window:globalThis);
