const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const html=fs.readFileSync(new URL('../index.html',`file://${__filename}`),'utf8');
const {naturalCoordinates,cycleCoordinates}=new Function('RECYCLE_Z','FLOW_DEPTH',
  html.slice(html.indexOf('function hashBits(value)'),html.indexOf('function updateMassModel()'))+
  'return {naturalCoordinates,cycleCoordinates};')(-4000,12000);

test('density warp stays bounded and has no folded or singular regions',()=>{
  let minimum=Infinity,maximum=0;
  const h=.0001;
  for(let variation=0;variation<=1;variation+=.25)for(let phase=0;phase<8;phase+=.37)for(let x=-1;x<=1;x+=.08)for(let y=-1;y<=1;y+=.08){
    const p=naturalCoordinates(x,y,phase,variation),dx=naturalCoordinates(x+h,y,phase,variation),dy=naturalCoordinates(x,y+h,phase,variation);
    assert.ok(p.every(v=>Number.isFinite(v)&&Math.abs(v)<=1+1e-12));
    const det=((dx[0]-p[0])*(dy[1]-p[1])-(dy[0]-p[0])*(dx[1]-p[1]))/(h*h);
    minimum=Math.min(minimum,det);maximum=Math.max(maximum,det);
  }
  assert.ok(minimum>.15,`density singularity: ${minimum}`);
  assert.ok(maximum/minimum>2,'density remains effectively uniform');
});

test('full uniformity removes density modulation at every depth and cycle',()=>{
  for(let phase=0;phase<12;phase+=.13){
    assert.deepEqual(naturalCoordinates(.37,-.51,phase,0),[.37,-.51]);
  }
  for(let cycle=0;cycle<8;cycle++)for(let i=0;i<100;i++){
    const uniform=cycleCoordinates(i,cycle,-7300,0);
    assert.deepEqual(cycleCoordinates(i,cycle,-7300,1),naturalCoordinates(...uniform,3300/12000+cycle,1));
  }
});

test('galaxies occupy a separate pool and no globular-cluster sources remain',()=>{
  const create=new Function('STAR_STRIDE','RECYCLE_Z','FLOW_DEPTH',
    html.slice(html.indexOf('function randomSource(seed)'),html.indexOf('const stars=createStarCloud();'))+'return createStarCloud;')(13,-4000,12000);
  const data=create();
  assert.equal(data.length,(64000+400)*13);
  for(let i=0;i<64000;i++)assert.ok(data[i*13+10]>=0);
  for(let i=64000;i<64400;i++)assert.equal(Math.floor(-data[i*13+10]),1);
  // Every prefix samples the depth volume; adding galaxies is not adding a slab.
  for(const count of [50,107,400]){
    const bins=new Uint32Array(5);
    for(let i=0;i<count;i++)bins[Math.floor((-4000-data[(64000+i)*13+2])/12000*5)]++;
    assert.ok(Math.max(...bins)-Math.min(...bins)<=3);
  }
});

test('recycled field remains distributed in depth and changes density continuously between slabs',()=>{
  let last=null;
  for(let cycle=0;cycle<10;cycle++){
    const bins=new Uint32Array(16);
    for(let i=0;i<12000;i++){
      const phase=(.137+i*.618033988749895)%1;
      const xy=cycleCoordinates(i,cycle,-4000-phase*12000);
      assert.ok(xy.every(v=>Number.isFinite(v)&&Math.abs(v)<=1));
      bins[Math.floor((xy[0]+1)*2)*4+Math.floor((xy[1]+1)*2)]++;
    }
    assert.ok(Math.min(...bins)>200,'a region lost all its stars');
    const edge=naturalCoordinates(.31,-.47,cycle);
    if(last)assert.ok(Math.hypot(edge[0]-last[0],edge[1]-last[1])<1e-6,'depth seam');
    last=naturalCoordinates(.31,-.47,cycle+1-1e-7);
  }
});
