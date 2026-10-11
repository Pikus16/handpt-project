// Classic worker: MediaPipe's WebAssembly loader requires importScripts().
let detector,forearmTracker,canvas,context;
self.onmessage=async({data})=>{try{
 if(data.type==='init'){
  const module=await import('./vendor/vision_bundle.mjs');
  const {ForearmTracker}=await import('./forearm.js');forearmTracker=new ForearmTracker();
  const vision=await module.FilesetResolver.forVisionTasks(new URL('./vendor/wasm',self.location).href);
  // MediaPipe's Safari user-agent check can reject supported OffscreenCanvas
  // (e.g. CriOS has no Version/Safari token), then access document in a worker.
  // Supplying the inference canvas bypasses that DOM fallback without changing
  // the vendored library. Keep it separate from the 2D forearm pixel canvas.
  if(typeof OffscreenCanvas!=='function')throw new Error('This browser needs a newer iOS version for camera tracking. Update iOS, then retry');
  const inferenceCanvas=new OffscreenCanvas(1,1);
  detector=await module.HandLandmarker.createFromOptions(vision,{canvas:inferenceCanvas,baseOptions:{modelAssetPath:new URL('./vendor/hand_landmarker.task',self.location).href,delegate:'CPU'},runningMode:'VIDEO',numHands:2,minHandDetectionConfidence:.65,minHandPresenceConfidence:.65,minTrackingConfidence:.65});
  self.postMessage({type:'ready'});
 }
 if(data.type==='reset-forearm')forearmTracker?.reset();
 if(data.type==='frame'){
  let result,forearm;try{
   result=detector.detectForVideo(data.frame,data.time);
   if(data.wrist&&result.landmarks?.length===1){
    const width=Math.min(320,data.frame.width),height=Math.round(data.frame.height*width/data.frame.width);
    if(!canvas||canvas.width!==width||canvas.height!==height){canvas=new OffscreenCanvas(width,height);context=canvas.getContext('2d',{willReadFrequently:true});}
    context.drawImage(data.frame,0,0,width,height);
    forearm=forearmTracker.detect(context.getImageData(0,0,width,height).data,width,height,result.landmarks[0],data.time);
   }else forearmTracker.reset();
  }finally{data.frame.close();}
  self.postMessage({type:'result',result,forearm,time:data.time});
 }
 }catch(e){self.postMessage({type:'error',message:e.message,scope:'hand'});}};
