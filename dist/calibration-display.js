import {percentile} from './rom.js';
// Hold medians are previews until capture finishes. Tracking loss clears the
// active hold in CalibrationFlow; a completed first endpoint remains captured.
export function calibrationReadout(flow,value,{valid=false,paused=false}={}){
 const stage=flow.stage;
 const capturedFirst=['prepareB','holdB','failed'].includes(stage)&&flow.samples[0].length>=15;
 const endpoint=(i,captured)=>{
  const collecting=stage===(i?'holdB':'holdA')&&!paused;
  const samples=flow.samples[i];
  return {value:(captured||collecting)&&samples.length?percentile(samples,.5):null,state:captured?'Captured':collecting&&samples.length?'Capturing':'Waiting'};
 };
 const first=endpoint(0,capturedFirst),second=endpoint(1,false);
 const span=Number.isFinite(first.value)&&Number.isFinite(second.value)?Math.abs(second.value-first.value):null;
 return {live:valid&&!paused&&Number.isFinite(value)?value:null,first,second,span};
}
