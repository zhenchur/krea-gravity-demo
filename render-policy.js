(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.GravityRenderPolicy=api;
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  // A narrow desktop window must retain desktop quality. iPadOS can identify
  // as a Mac, so include its touch capability rather than viewport width.
  function isMobileDevice({userAgent='',platform='',maxTouchPoints=0,userAgentData}={}){
    return userAgentData?.mobile===true||/Android|iPhone|iPad|iPod/i.test(userAgent)
      ||(platform==='MacIntel'&&maxTouchPoints>1);
  }
  function fieldSize(width,height){
    const aspect=Math.max(1,width)/Math.max(1,height),budget=384*216;
    const w=Math.max(1,Math.min(384,Math.floor(Math.sqrt(budget*aspect))));
    return {width:w,height:Math.max(1,Math.min(Math.floor(budget/w),Math.round(w/aspect)))};
  }
  class FramePacer{
    constructor(){this.reset();}
    reset(){this.next=null;this.fps=0;}
    due(now,fps=60){
      const interval=1000/fps;
      if(this.next===null||fps!==this.fps){this.fps=fps;this.next=now+interval;return true;}
      if(now+.5<this.next)return false;
      // Keep the display cadence without drawing catch-up frames after a stall.
      this.next+=Math.max(1,Math.floor((now+.5-this.next)/interval)+1)*interval;
      return true;
    }
  }
  class QualityPolicy{
    constructor(mobile,nativeDpr=1){
      this.mobile=mobile;this.nativeDpr=nativeDpr;this.scale=mobile?1.5:2;
      this.fps=60;this.resetSamples();
    }
    get dpr(){return Math.min(this.nativeDpr,this.scale);}
    resetSamples(){this.seconds=0;this.frames=0;}
    observe(elapsed,eligible=true){
      // Ignore preparation, resumed tabs and one-off layout stalls. Adjust only
      // after four seconds of sustained load in the settled moving scene.
      if(!this.mobile||!eligible||elapsed<=0||elapsed>.25){this.resetSamples();return false;}
      this.seconds+=elapsed;this.frames++;
      if(this.seconds<4)return false;
      const slow=this.frames/this.seconds<this.fps*.82;
      this.resetSamples();
      if(!slow)return false;
      const floor=Math.min(1,this.nativeDpr);
      if(this.dpr>floor)this.scale=Math.max(floor,this.dpr-.25);
      else if(this.fps>30)this.fps=30;
      else return false;
      // Keep the achieved budget for this visit; no oscillating resolution or
      // repeated large texture reallocations on thermally limited phones.
      return true;
    }
  }
  return {isMobileDevice,fieldSize,FramePacer,QualityPolicy};
});
