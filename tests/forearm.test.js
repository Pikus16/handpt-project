import test from 'node:test';import assert from 'node:assert/strict';
import {detectForearm,ForearmTracker,forearmProjection} from '../dist/forearm.js';
export function fixture({armAngle=0,handAngle=0,skin=[190,140,110],background=[35,65,120],length=120,armWidth=26,gradient=false}={}){
 const width=320,height=240,data=new Uint8ClampedArray(width*height*4),wrist={x:180,y:120};
 const radians=a=>a*Math.PI/180,arm={x:Math.cos(radians(armAngle)),y:Math.sin(radians(armAngle))},direction={x:Math.cos(radians(handAngle)),y:Math.sin(radians(handAngle))};
 const hand=Array.from({length:21},()=>({x:wrist.x/width,y:wrist.y/height,z:0}));
 const knuckle={x:wrist.x+direction.x*40,y:wrist.y+direction.y*40};hand[9]={x:knuckle.x/width,y:knuckle.y/height,z:0};
 hand[5]={x:(knuckle.x-direction.y*15)/width,y:(knuckle.y+direction.x*15)/height,z:0};hand[17]={x:(knuckle.x+direction.y*15)/width,y:(knuckle.y-direction.x*15)/height,z:0};
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const dx=x-wrist.x,dy=y-wrist.y,alongArm=-(dx*arm.x+dy*arm.y),acrossArm=Math.abs(dx*arm.y-dy*arm.x),alongHand=dx*direction.x+dy*direction.y,acrossHand=Math.abs(dx*direction.y-dy*direction.x);
  const foreground=alongArm>=0&&alongArm<=length&&acrossArm<=armWidth/2||alongHand>=-3&&alongHand<=53&&acrossHand<=16;
  const rgb=foreground?skin:background,index=(y*width+x)*4;
  const shade=foreground&&gradient?Math.max(.7,1-alongArm/600):1;
  data[index]=rgb[0]*shade;data[index+1]=rgb[1]*shade;data[index+2]=rgb[2]*shade;data[index+3]=255;
 }
 return {data,width,height,hand};
}
const find=f=>detectForearm(f.data,f.width,f.height,f.hand);
test('finds actual forearm axes from image boundaries without an elbow or clicks',()=>{
 for(const [armAngle,handAngle] of [[0,0],[20,45],[-20,30],[0,-90],[30,-40],[90,35]]){
  const f=fixture({armAngle,handAngle}),r=find(f);assert.equal(r.error,undefined,JSON.stringify({armAngle,handAngle,error:r.error}));const difference=Math.abs(((r.forearmAngle-armAngle+540)%360)-180);assert.ok(difference<5,JSON.stringify({armAngle,handAngle,measured:r.forearmAngle}));
  const p=forearmProjection(f.hand,r,f.width/f.height);assert.ok(Math.abs(p.value-(handAngle-armAngle))<5,JSON.stringify(p));
 }
});
test('adapts to hand appearance across light and dark tones and illumination gradients',()=>{
 for(const skin of [[225,190,160],[160,105,70],[80,50,35],[60,55,45]]){const f=fixture({skin,background:[220,230,245],armAngle:0,handAngle:35,gradient:true}),r=find(f);assert.equal(r.error,undefined,JSON.stringify({skin,error:r.error}));assert.ok(Math.abs(r.forearmAngle)<5);}
});
test('refuses insufficient exposed forearm or indistinguishable background',()=>{
 assert.ok(find(fixture({length:22})).error);assert.ok(find(fixture({background:[190,140,110]})).error);
});
test('requires temporal agreement and drops a lost forearm immediately',()=>{
 const f=fixture({handAngle:35}),t=new ForearmTracker();for(let i=0;i<3;i++)assert.ok(t.detect(f.data,f.width,f.height,f.hand,i*50).error);const r=t.detect(f.data,f.width,f.height,f.hand,150);assert.equal(r.error,undefined);const lost=fixture({background:[190,140,110]});assert.ok(t.detect(lost.data,lost.width,lost.height,lost.hand,200).error);assert.ok(t.detect(f.data,f.width,f.height,f.hand,250).error);
});

test('isolated appearance noise does not break the detected forearm centerline',()=>{
 const f=fixture({armAngle:15,handAngle:-25});for(let i=0;i<f.width*f.height;i+=137){f.data[i*4]=15;f.data[i*4+1]=15;f.data[i*4+2]=15;}const r=find(f);assert.equal(r.error,undefined);assert.ok(Math.abs(r.forearmAngle-15)<5);
});

test('a shadowed palm still finds the brighter uncovered forearm',()=>{
 const f=fixture({skin:[220,190,160],background:[70,90,120],length:80});
 // Wrist bending casts a broad shadow on the palm while the arm stays lit.
 for(let y=0;y<f.height;y++)for(let x=180;x<f.width;x++){
  const i=(y*f.width+x)*4;
  if(f.data[i]===220){f.data[i]-=100;f.data[i+1]-=100;f.data[i+2]-=100;}
 }
 const r=find(f);assert.equal(r.error,undefined);assert.ok(Math.abs(r.forearmAngle)<5);
});

test('a visible forearm shorter than two palm lengths is sufficient',()=>{
 const r=find(fixture({length:65}));assert.equal(r.error,undefined);assert.ok(Math.abs(r.forearmAngle)<5);
});

test('foreshortened palm length does not shrink the arm search or select a sideways region',()=>{
 const f=fixture({length:75});f.hand[9]={x:192/f.width,y:120/f.height,z:-.08};
 f.hand[5]={x:192/f.width,y:105/f.height,z:-.08};f.hand[17]={x:192/f.width,y:135/f.height,z:-.08};
 const r=find(f);assert.equal(r.error,undefined);assert.ok(Math.abs(r.forearmAngle)<5);
});
