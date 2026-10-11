import {calibration,percentile} from './rom.js';
export class CalibrationFlow{
 constructor(exercises){this.exercises=exercises;this.index=0;this.results={};this.restart();}
 get exercise(){return this.exercises[this.index];}
 get done(){return this.index>=this.exercises.length;}
 restart(){this.stage='position';this.elapsed=0;this.samples=[[],[]];this.issue='';this.lastStamp=null;this.armBaseline=null;}
 get duration(){return this.stage==='position'?4:this.stage.startsWith('prepare')?3:2;}
 get endpoint(){return this.stage.endsWith('B')?1:0;}
 get fraction(){return Math.min(1,this.elapsed/this.duration);}
 pause(){// A hold must be contiguous; never join frames across a tracking gap.
  if(this.stage.startsWith('hold')){this.elapsed=0;this.samples[this.endpoint]=[];}this.lastStamp=null;
 }
 update(value,dt,stamp,forearmAngle){
  if(this.done||this.stage==='failed'||!Number.isFinite(value))return;
  if(stamp===this.lastStamp)return;this.lastStamp=stamp;
  if(this.exercise.wrist&&Number.isFinite(forearmAngle)){
   if(this.armBaseline===null||this.stage==='position')this.armBaseline=forearmAngle;
   const drift=Math.abs(((forearmAngle-this.armBaseline+540)%360)-180);
   if(drift>15){this.issue='Keep your forearm still. Reposition, then retry this movement.';this.pause();return;}
  }
  this.issue='';this.elapsed+=Math.min(dt,.15);
  if(this.stage.startsWith('hold')){
   const bucket=this.samples[this.endpoint];bucket.push(value);
   if(bucket.length>=8&&percentile(bucket,.9)-percentile(bucket,.1)>this.exercise.noise){this.elapsed=0;this.samples[this.endpoint]=[value];this.issue='Hold comfortably still while we capture this position.';}
  }
  if(this.elapsed<this.duration)return;
  if(this.stage.startsWith('hold')&&this.samples[this.endpoint].length<15)return;
  this.elapsed=0;
  if(this.stage==='position'){this.stage='prepareA';return;}
  if(this.stage==='prepareA'){this.stage='holdA';return;}
  if(this.stage==='holdA'){this.stage='prepareB';return;}
  if(this.stage==='prepareB'){this.stage='holdB';return;}
  const result=calibration(this.samples[0],this.samples[1],this.exercise.minSpan);
  if(!result){this.stage='failed';this.issue='We couldn’t distinguish the two positions. Retry, or skip if this movement isn’t suitable.';return;}
  this.results[this.exercise.id]={...result,forearmAngle:this.armBaseline};this.next();
 }
 next(){this.index++;this.restart();}
 skip(){if(!this.done)this.next();}
}
