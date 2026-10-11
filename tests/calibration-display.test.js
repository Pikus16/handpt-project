import test from 'node:test';import assert from 'node:assert/strict';
import {CalibrationFlow} from '../dist/calibration.js';
import {calibrationReadout} from '../dist/calibration-display.js';
import {EXERCISES} from '../dist/exercises.js';
const make=()=>new CalibrationFlow(EXERCISES);
test('live zero is a valid value; missing or paused tracking never displays a stale reading',()=>{
 const f=make();assert.equal(calibrationReadout(f,0,{valid:true}).live,0);
 assert.equal(calibrationReadout(f,35,{valid:false}).live,null);
 assert.equal(calibrationReadout(f,35,{valid:true,paused:true}).live,null);
 assert.equal(calibrationReadout(f,NaN,{valid:true}).live,null);
});
test('endpoint medians are previews during capture, and retained only after a completed first hold',()=>{
 const f=make();f.stage='holdA';f.samples[0]=[-35,-34,-35,-36];
 let r=calibrationReadout(f,-35,{valid:true});assert.equal(r.first.value,-35);assert.equal(r.first.state,'Capturing');assert.equal(r.span,null);
 f.stage='prepareB';f.samples[0]=Array(20).fill(-35);r=calibrationReadout(f,10,{valid:true});assert.equal(r.first.state,'Captured');assert.equal(r.first.value,-35);assert.equal(r.second.value,null);
 f.stage='holdB';f.samples[1]=[40,41,39,40];r=calibrationReadout(f,40,{valid:true});assert.equal(r.span,75);assert.equal(r.second.state,'Capturing');
 f.pause();r=calibrationReadout(f,40,{valid:false});assert.equal(r.live,null);assert.equal(r.first.value,-35);assert.equal(r.second.value,null);assert.equal(r.span,null);
});
test('reversed ratio endpoints retain their original values and yield an unsigned ratio span',()=>{
 const f=make();f.stage='holdB';f.samples=[Array(20).fill(1.5),Array(15).fill(.2)];
 const r=calibrationReadout(f,.2,{valid:true});assert.equal(r.first.value,1.5);assert.equal(r.second.value,.2);assert.equal(r.span,1.3);
});
