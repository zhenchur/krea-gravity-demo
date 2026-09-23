/* One global positive mass scale, never a per-pixel correction. Bound the
 * symmetric part of the actual bilinear ray-map Jacobian at all cell corners.
 * It is affine within each cell, so the same lower bound holds in its interior.
 */
(function(root){
  'use strict';
  function calibrateMass(fields,width,height,geometry,maxMass=1.8,minStretch=.12) {
    const {screenWidth,screenHeight,centerX,centerY,halfWidth,halfHeight,radius}=geometry;
    const sx=screenWidth/width,sy=screenHeight/height;
    let worst=0;
    const distance=(x,y)=>{
      const qx=Math.abs(x-centerX)-halfWidth+radius,qy=Math.abs(y-centerY)-halfHeight+radius;
      return Math.hypot(Math.max(qx,0),Math.max(qy,0))+Math.min(Math.max(qx,qy),0)-radius;
    };
    // The black input hides interior cells. Keep a 2px margin for its border.
    const visible=new Uint8Array((width+1)*(height+1));
    for(let y=-1;y<height;y++)for(let x=-1;x<width;x++){
      const left=(x+.5)*sx,bottom=(y+.5)*sy;
      visible[(y+1)*(width+1)+x+1]=Math.max(distance(left,bottom),distance(left+sx,bottom),distance(left,bottom+sy),distance(left+sx,bottom+sy))>=-2?1:0;
    }
    const inspect=(xx,xy,yx,yy)=>{
      const negativeEigen=Math.hypot((xx-yy)*.5,(xy+yx)*.5)-(xx+yy)*.5;
      worst=Math.max(worst,negativeEigen);
    };
    for(const data of fields)for(let y=-1;y<height;y++)for(let x=-1;x<width;x++){
      if(!visible[(y+1)*(width+1)+x+1])continue;
      const x0=Math.max(0,x),x1=Math.min(width-1,x+1),y0=Math.max(0,y),y1=Math.min(height-1,y+1);
      const a=(y0*width+x0)*4,b=(y0*width+x1)*4,c=(y1*width+x0)*4,d=(y1*width+x1)*4;
      const xx0=(data[b]-data[a])/sx,yx0=(data[b+1]-data[a+1])/sx,xx1=(data[d]-data[c])/sx,yx1=(data[d+1]-data[c+1])/sx;
      const xy0=(data[c]-data[a])/sy,yy0=(data[c+1]-data[a+1])/sy,xy1=(data[d]-data[b])/sy,yy1=(data[d+1]-data[b+1])/sy;
      inspect(xx0,xy0,yx0,yy0);inspect(xx0,xy1,yx0,yy1);inspect(xx1,xy0,yx1,yy0);inspect(xx1,xy1,yx1,yy1);
    }
    return {scale:worst>0?(1-minStretch)/(maxMass*worst):1,worst,minStretch};
  }
  if(typeof module==='object'&&module.exports)module.exports={calibrateMass};else root.GravityCalibration={calibrateMass};
})(typeof window==='object'?window:globalThis);
