(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.GravityStarFlow=api;
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  class Translation{
    constructor(){this.offset=new Float64Array(3);this.wrapAxes=new Float32Array(2);this.reset();}
    reset(){this.distance=0;this.offset.fill(0);this.wrapAxes.fill(0);}
    advance(distance,direction){
      const delta=distance-this.distance;this.distance=distance;
      for(let axis=0;axis<3;axis++){
        const step=delta*direction[axis];this.offset[axis]+=step;
        if(axis<2&&step!==0)this.wrapAxes[axis]=1;
      }
      return this.offset;
    }
  }
  // A periodic volume supports positive and negative travel without running
  // out of stars. Recycle only at its faded boundaries, never at the lens.
  const wrap=(value,halfSize)=>value-Math.floor((value+halfSize)/(2*halfSize))*(2*halfSize);
  const cycle=(z,near,depth)=>Math.ceil((z-near)/depth);
  return {Translation,wrap,cycle};
});
