import test from 'node:test';import assert from 'node:assert/strict';import {guideMotion} from '../dist/arcade.js';
test('endpoint holds match prompts and stay still regardless of wall-clock time',()=>{for(const time of [0,10,47,1000]){assert.equal(guideMotion({stage:'holdA',time}),0);assert.equal(guideMotion({stage:'holdB',time}),1);}assert.equal(guideMotion({stage:'holdB',reduced:true}),1);});
test('preparation animates toward the prompted endpoint instead of looping away',()=>{
 assert.equal(guideMotion({stage:'prepareA',elapsed:0,duration:3}),.5);assert.equal(guideMotion({stage:'prepareA',elapsed:3,duration:3}),0);assert.equal(guideMotion({stage:'prepareB',elapsed:0,duration:3}),0);assert.equal(guideMotion({stage:'prepareB',elapsed:3,duration:3}),1);let previous=0;for(let elapsed=0;elapsed<=3;elapsed+=.1){const p=guideMotion({stage:'prepareB',elapsed,duration:3});assert.ok(p>=previous);previous=p;}
});
