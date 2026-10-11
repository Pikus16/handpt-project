import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';
const source=readFileSync(new URL('../dist/tracker.js',import.meta.url),'utf8');
function execute(context){vm.runInContext(source.replace("import('./vendor/vision_bundle.mjs')",'Promise.resolve(testModule)').replace("import('./forearm.js')",'Promise.resolve(testForearm)'),context);}
test('MediaPipe runs in a classic worker; forearm tracking requires no pose model or manual reference',()=>{
 const app=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8'),html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');assert.match(app,/new Worker\('\.\/tracker\.js'\)/);assert.doesNotThrow(()=>new vm.Script(source));assert.match(source,/import\('\.\/vendor\/vision_bundle\.mjs'\)/);assert.doesNotMatch(source,/PoseLandmarker|pose-init/);assert.doesNotMatch(html,/id="set-reference"/);assert.doesNotMatch(app,/referenceProjection|forearmReferences/);
});
test('worker detects the forearm from current frame pixels and returns its axis with hand landmarks',async()=>{
 const messages=[],imports=[];let closed=false,detects=0,resets=0;const hands={landmarks:[Array(21).fill({x:.5,y:.5})],worldLandmarks:[],handedness:[]},forearm={axis:{x:1,y:0},forearmAngle:0};const self={location:'https://example.test/dist/tracker.js',postMessage:m=>messages.push(m)};
 class Canvas{constructor(width,height){this.width=width;this.height=height;}getContext(){return {drawImage(){},getImageData:()=>({data:new Uint8ClampedArray(this.width*this.height*4)})};}}
 const context=vm.createContext({self,URL,OffscreenCanvas:Canvas,importScripts:p=>imports.push(p),testForearm:{ForearmTracker:class{reset(){resets++;}detect(data,width,height,landmarks,time){detects++;assert.equal(width,320);assert.equal(height,240);assert.equal(data.length,320*240*4);assert.equal(landmarks,hands.landmarks[0]);assert.equal(time,42);return forearm;}}},testModule:{FilesetResolver:{forVisionTasks:async path=>({wasmLoaderPath:path+'/vision_wasm_internal.js'})},HandLandmarker:{createFromOptions:async(fileset,options)=>{vm.runInContext(`importScripts(${JSON.stringify(fileset.wasmLoaderPath)})`,context);assert.match(options.baseOptions.modelAssetPath,/hand_landmarker.task$/);return {detectForVideo:()=>hands};}}}});
 execute(context);await self.onmessage({data:{type:'init'}});assert.equal(messages[0].type,'ready');assert.match(imports[0],/vision_wasm_internal.js$/);await self.onmessage({data:{type:'frame',frame:{width:960,height:720,close:()=>closed=true},time:42,wrist:true}});assert.equal(closed,true);assert.equal(detects,1);const output=messages.at(-1);assert.equal(output.result,hands);assert.equal(output.forearm,forearm);assert.equal(output.time,42);await self.onmessage({data:{type:'reset-forearm'}});assert.equal(resets,1);await self.onmessage({data:{type:'frame',frame:{close(){}},time:43,wrist:false}});assert.equal(detects,1);assert.equal(resets,2);
});
test('worker closes a failed frame and reports an error',async()=>{
 const messages=[];let closed=false;
 const self={location:'https://example.test/tracker.js',postMessage:m=>messages.push(m)};
 const context=vm.createContext({
  self,URL,
  testForearm:{ForearmTracker:class{reset(){}}},
  testModule:{
   FilesetResolver:{forVisionTasks:async()=>({})},
   HandLandmarker:{createFromOptions:async()=>({detectForVideo:()=>{throw new Error('Frame failed');}})}
  }
 });
 execute(context);
 await self.onmessage({data:{type:'init'}});
 await self.onmessage({data:{type:'frame',frame:{close:()=>closed=true},time:12}});
 assert.equal(closed,true);assert.equal(messages.at(-1).scope,'hand');
});
