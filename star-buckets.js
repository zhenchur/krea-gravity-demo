/* Conservative draw lists. These only cull zero-weight / offscreen sources;
 * the vertex shader remains responsible for positions and exact depth weights.
 */
(function(root) {
  'use strict';
  class StarDepthBuckets {
    constructor(planes,capacity) {
      this.planes=planes;
      this.lists=planes.map(()=>new Uint32Array(capacity));
      this.counts=new Uint32Array(planes.length);
      this.offsets=new Uint32Array(planes.length);
      this.active=new Float32Array(planes.length);
      this.indices=new Uint32Array(capacity*3);
      this.total=0;
    }
    reset(){this.counts.fill(0);}
    add(index,depth,x,y,viewports) {
      // Wider than accumulated float32 position error, including at recycling.
      // Adjacent lists overlap at knots; the shader's exact weight removes the
      // extra contribution. Never replace smooth interpolation with hard bins.
      const guard=.04,planes=this.planes;
      if(depth<100-guard)return; // near fade is exactly zero below 100
      let lo=0,hi=planes.length;
      while(lo<hi){const mid=(lo+hi)>>>1;if(planes[mid]<depth-guard)lo=mid+1;else hi=mid;}
      for(let layer=Math.max(0,lo-1);layer<planes.length;layer++) {
        const p=layer*4;
        // Some WebGL backends keep the visible edge of a point whose centre is
        // outside clip space. Include the largest sprite (54 CSS px) plus guard.
        const margin=28;
        if(x>=viewports[p]-margin&&y>=viewports[p+1]-margin&&x<=viewports[p]+viewports[p+2]+margin&&y<=viewports[p+1]+viewports[p+3]+margin)
          this.lists[layer][this.counts[layer]++]=index;
        if(planes[layer]>depth+guard)break;
      }
    }
    pack() {
      let offset=0;
      for(let i=0;i<this.planes.length;i++) {
        this.offsets[i]=offset;
        this.indices.set(this.lists[i].subarray(0,this.counts[i]),offset);
        offset+=this.counts[i];this.active[i]=this.counts[i]>0?1:0;
      }
      this.total=offset;return this.indices.subarray(0,offset);
    }
  }
  if(typeof module==='object'&&module.exports)module.exports=StarDepthBuckets;else root.StarDepthBuckets=StarDepthBuckets;
})(typeof window==='object'?window:globalThis);
