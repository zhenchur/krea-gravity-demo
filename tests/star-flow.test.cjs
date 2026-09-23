const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Translation,wrap,cycle}=require('../star-flow.js');

test('axis coefficients remain independent, signed and unnormalized',()=>{
  const field=new Translation();
  assert.deepEqual([...field.advance(100,[1,.3,0])],[100,30,0]);
  assert.deepEqual([...field.advance(200,[-1,-.3,0])],[0,0,0]);
  assert.deepEqual([...field.advance(300,[0,0,-1])],[0,0,-100]);
});
test('changing direction, stopping and resuming never repositions existing stars',()=>{
  const field=new Translation();field.advance(1000,[0,0,1]);
  assert.deepEqual([...field.advance(1000,[1,.3,0])],[0,0,1000]);
  assert.deepEqual([...field.advance(1100,[1,.3,0])],[100,30,1000]);
  assert.deepEqual([...field.advance(5000,[0,0,0])],[100,30,1000]);
  assert.deepEqual([...field.advance(5100,[-1,0,0])],[0,30,1000]);
  field.reset();assert.deepEqual([...field.offset],[0,0,0]);
  assert.deepEqual([...field.wrapAxes],[0,0]);
});
test('default direction preserves the original forward trajectory at any frame rate',()=>{
  for(const fps of [30,60,120]){
    const field=new Translation();
    for(let i=0;i<=fps*10;i++)field.advance(i/fps*110,[0,0,1]);
    assert.ok(Math.abs(field.offset[2]-1100)<1e-8);
    assert.equal(field.offset[0],0);assert.equal(field.offset[1],0);
    assert.deepEqual([...field.wrapAxes],[0,0]);
  }
});
test('positive and negative travel preserve an infinite, evenly populated volume',()=>{
  const near=-4000,depth=12000,half=7200,count=1200;
  for(const distance of [-200000,-24000,-12000,-5,0,5,12000,24000,200000]){
    const bins=new Uint32Array(12);
    for(let i=0;i<count;i++){
      const z=near-(i+.5)/count*depth+distance;
      const recycled=z-cycle(z,near,depth)*depth;
      assert.ok(recycled<=near&&recycled>near-depth);
      bins[Math.min(11,Math.floor((near-recycled)/depth*12))]++;
      const x=wrap(-half+(i+.5)/count*2*half+distance,half);
      assert.ok(x>=-half&&x<half);
      assert.ok(Math.abs(wrap(x+half*2,half)-x)<1e-8);
    }
    assert.ok(Math.max(...bins)-Math.min(...bins)<=1);
  }
});
