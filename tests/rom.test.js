import test from 'node:test';import assert from 'node:assert/strict';import {angle,calibration,progress,RepetitionCounter,metrics,quality,wristViewQuality} from '../dist/rom.js';
test('angles are invariant to 3D rotation, translation and scale',()=>{const a={x:0,y:0,z:0},b={x:0,y:1,z:0},c={x:1,y:1,z:0};assert.equal(angle(a,b,c),90);const transform=p=>({x:3+p.z*4,y:2+p.x*4,z:6+p.y*4});assert.equal(angle(transform(a),transform(b),transform(c)),90);assert.equal(angle({x:0,y:0,z:0},{x:0,y:1,z:0},{x:0,y:2,z:0}),180);});
test('calibration uses robust endpoints and rejects inadequate movement',()=>{const a=Array(20).fill(5),b=Array(20).fill(85);a.push(999);assert.deepEqual(calibration(a,b,8),{a:5,b:85});assert.equal(calibration(a,Array(20).fill(7),8),null);assert.equal(calibration([1],[90],8),null);assert.equal(progress(.2,{a:1.2,b:.2}),1);assert.equal(progress(2,{a:1.2,b:.2}),0);});
test('count requires open, closed and return holds, preventing jitter repeats',()=>{const r=new RepetitionCounter();for(let i=0;i<10;i++)r.update(1,.1);assert.equal(r.count,0);for(let i=0;i<4;i++)r.update(0,.1);for(let i=0;i<3;i++){r.update(1,.1);r.update(.5,.1);}assert.equal(r.count,0);for(let i=0;i<4;i++)r.update(1,.1);assert.equal(r.count,0);for(let i=0;i<10;i++)r.update(1,.1);assert.equal(r.count,0);for(let i=0;i<4;i++)r.update(0,.1);assert.equal(r.count,1);for(let i=0;i<10;i++)r.update(0,.1);assert.equal(r.count,1);});
test('measurement rejects nonfinite and implausible geometry',()=>{assert.equal(metrics(null),null);assert.equal(metrics(Array(21).fill({x:0,y:0,z:0})),null);assert.equal(metrics(Array(21).fill({x:NaN,y:0,z:0})),null);assert.equal(quality(null),'Show one whole hand');const clipped=Array(21).fill({x:0,y:.5,z:0});assert.equal(quality(clipped),'Move your hand inside the frame');});

test('wrist bend requires a side view; front-facing bending cannot calibrate a misleading 2D range',()=>{
 const p=Array.from({length:21},()=>({x:0,y:0,z:0}));p[9]={x:0,y:-.06,z:0};p[5]={x:-.025,y:-.06,z:0};p[17]={x:.025,y:-.06,z:0};
 assert.match(wristViewQuality('flexion',p),/side view/);assert.equal(wristViewQuality('deviation',p),null);
 const side=p.map(({x,y,z})=>({x:z,y,z:x}));
 assert.equal(wristViewQuality('flexion',side),null);assert.match(wristViewQuality('deviation',side),/back of your hand/);
 // Mirrors and hand-size changes do not change the view decision.
 assert.equal(wristViewQuality('flexion',side.map(v=>({x:-v.x*.7,y:v.y*.7,z:v.z*.7}))),null);
 const depth=side.map(({x,y,z})=>({x,y:y*.2,z:z+y*.98}));assert.match(wristViewQuality('flexion',depth),/across the picture/);
 assert.ok(wristViewQuality('flexion',undefined));p[5].z=NaN;assert.ok(wristViewQuality('flexion',p));
});
