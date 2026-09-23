const {test}=require('node:test');
const assert=require('node:assert/strict');
const {isMobileDevice,fieldSize,FramePacer,QualityPolicy}=require('../render-policy.js');

test('mobile quality follows devices, including desktop-identifying iPads, not window width',()=>{
  assert.equal(isMobileDevice({userAgent:'iPhone'}),true);
  assert.equal(isMobileDevice({userAgent:'Linux; Android 15'}),true);
  assert.equal(isMobileDevice({platform:'MacIntel',maxTouchPoints:5}),true);
  assert.equal(isMobileDevice({platform:'MacIntel',maxTouchPoints:0}),false);
  assert.equal(isMobileDevice({platform:'Win32',maxTouchPoints:10}),false);
  assert.equal(isMobileDevice({userAgentData:{mobile:true}}),true);
});
test('portrait ray maps have a bounded texel budget; desktop 16:9 keeps its grid',()=>{
  assert.deepEqual(fieldSize(1280,720),{width:384,height:216});
  for(const [width,height] of [[390,844],[844,390],[320,720],[1920,1200],[2560,1080],[1,3000]]){
    const grid=fieldSize(width,height);
    assert.ok(grid.width*grid.height<=384*216);
    assert.ok(grid.width>=1&&grid.height>=1);
  }
  assert.ok(fieldSize(390,844).width*fieldSize(390,844).height<384*831*.27);
});
test('pacer caps high-refresh displays without changing elapsed animation time',()=>{
  for(const hz of [60,90,120,144])for(const fps of [30,60]){
    const pacer=new FramePacer();let frames=0,elapsed=0,last=null;
    for(let i=0;i<hz*10;i++){
      const now=i*1000/hz;
      if(!pacer.due(now,fps))continue;
      frames++;if(last!==null)elapsed+=now-last;last=now;
    }
    assert.ok(Math.abs(frames-fps*10)<=1,`${hz} Hz / ${fps} FPS: ${frames}`);
    assert.ok(elapsed>9900&&elapsed<10000);
  }
});
test('pacer resumes immediately without catch-up bursts',()=>{
  const pacer=new FramePacer();assert.ok(pacer.due(0));
  assert.ok(pacer.due(10000));assert.equal(pacer.due(10001),false);
  pacer.reset();assert.ok(pacer.due(10002));
  assert.ok(pacer.due(10003,30));assert.equal(pacer.due(10010,30),false);
});
test('desktop resolution and frame cap do not degrade under load',()=>{
  const policy=new QualityPolicy(false,2);
  for(let i=0;i<1000;i++)assert.equal(policy.observe(.05),false);
  assert.equal(policy.dpr,2);assert.equal(policy.fps,60);
});
test('mobile reduces resolution before falling back to stable 30 FPS',()=>{
  const policy=new QualityPolicy(true,3),changes=[];
  for(let i=0;i<1000;i++)if(policy.observe(.05))changes.push([policy.dpr,policy.fps]);
  assert.deepEqual(changes,[[1.25,60],[1,60],[1,30]]);
  for(let i=0;i<1000;i++)policy.observe(1/30);
  assert.equal(policy.dpr,1);assert.equal(policy.fps,30);
});
test('healthy mobile frames, pauses and isolated preparation stalls do not lower quality',()=>{
  const policy=new QualityPolicy(true,3);
  for(let i=0;i<1000;i++)policy.observe(1/60);
  policy.observe(2);for(let i=0;i<50;i++)policy.observe(.05);
  policy.observe(.05,false);for(let i=0;i<50;i++)policy.observe(.05);
  assert.equal(policy.dpr,1.5);assert.equal(policy.fps,60);
  assert.equal(new QualityPolicy(true,1).dpr,1);
});
