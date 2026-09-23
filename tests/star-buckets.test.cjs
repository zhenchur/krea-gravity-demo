const {test}=require('node:test');
const assert=require('node:assert/strict');
const StarDepthBuckets=require('../star-buckets.js');
const {DEPTHS,depthWeight}=require('../mass-lens.js');

test('draw lists preserve every nonzero depth weight, including float32 knot error',()=>{
  const depths=[50,100,50000,...DEPTHS.flatMap(d=>[d-.05,d-.01,d,d+.01,d+.05])];
  for(let d=101;d<25000;d*=1.017)depths.push(d);
  const buckets=new StarDepthBuckets(DEPTHS,depths.length);
  const bounds=new Float32Array(DEPTHS.flatMap(()=>[-2000,-2000,4000,4000]));
  depths.forEach((d,i)=>buckets.add(i,d,0,0,bounds));
  buckets.pack();
  depths.forEach((d,i)=>{
    for(const error of [-.02,0,.02]) {
      if(d+error<=100)continue;
      for(let layer=0;layer<DEPTHS.length;layer++) {
        if(depthWeight(d+error,layer)>0)
          assert.ok(buckets.lists[layer].subarray(0,buckets.counts[layer]).includes(i),`missing source ${i}, depth ${d}, layer ${layer}`);
      }
    }
  });
  assert.ok(buckets.total<=depths.length*3);
});

test('viewport culling is conservative and packed indices retain original particle IDs',()=>{
  const buckets=new StarDepthBuckets(DEPTHS,20);
  const bounds=new Float32Array(DEPTHS.flatMap(()=>[0,0,100,100]));
  buckets.add(3,4000,127,50,bounds); // extended source overlaps the viewport
  buckets.add(7,4000,129,50,bounds); // even the sprite edge is outside
  buckets.add(15,4000,50,50,bounds);
  const packed=buckets.pack();
  assert.deepEqual([...packed],[3,15,3,15]);
  assert.equal(buckets.active.reduce((a,b)=>a+b,0),2);
  for(let layer=0;layer<DEPTHS.length;layer++) {
    assert.deepEqual([...packed.subarray(buckets.offsets[layer],buckets.offsets[layer]+buckets.counts[layer])],
      [...buckets.lists[layer].subarray(0,buckets.counts[layer])]);
  }
  buckets.reset();assert.equal(buckets.pack().length,0);
  assert.equal(buckets.active.reduce((a,b)=>a+b,0),0);
});
