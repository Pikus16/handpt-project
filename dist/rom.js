export const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
const norm=a=>Math.sqrt(dot(a,a));
export const distance=(a,b)=>norm(sub(a,b));
export function angle(a,b,c){const u=sub(a,b),v=sub(c,b),d=norm(u)*norm(v);return d>1e-9?Math.acos(clamp(dot(u,v)/d,-1,1))*180/Math.PI:NaN;}
export function metrics(p){
 if(!p||p.length!==21||p.some(v=>!['x','y','z'].every(k=>Number.isFinite(v[k]))))return null;
 const palm=distance(p[0],p[9]);if(palm<.015||palm>.18)return null;
 const fingers=[5,9,13,17].map(b=>({mcp:180-angle(p[0],p[b],p[b+1]),pip:180-angle(p[b],p[b+1],p[b+2]),dip:180-angle(p[b+1],p[b+2],p[b+3])}));
 if(fingers.some(f=>Object.values(f).some(v=>!Number.isFinite(v))))return null;
 for(const base of [5,9,13,17])for(let j=0;j<3;j++){const bone=distance(p[base+j],p[base+j+1]);if(bone<.001||bone>palm*1.2)return null;}
 const a=sub(p[6],p[5]),b=sub(p[18],p[17]);
 return {fingers,flex:fingers.reduce((s,f)=>s+f.pip,0)/4,pinch:distance(p[4],p[8])/palm,opposition:distance(p[4],p[20])/palm,spread:Math.acos(clamp(dot(a,b)/(norm(a)*norm(b)),-1,1))*180/Math.PI};
}
export function quality(p){
 if(!p||p.length!==21)return 'Show one whole hand';
 if(p.some(v=>v.x<.035||v.x>.965||v.y<.035||v.y>.965))return 'Move your hand inside the frame';
 const size=distance({...p[0],z:0},{...p[9],z:0});
 if(size<.09)return 'Move a little closer';if(size>.6)return 'Move a little farther away';return null;
}
export function percentile(values,q){const s=[...values].sort((a,b)=>a-b);return s[Math.floor((s.length-1)*q)];}
export function calibration(a,b,minSpan){if(a.length<15||b.length<15)return null;const lo=percentile(a,.5),hi=percentile(b,.5);return Math.abs(hi-lo)>=minSpan?{a:lo,b:hi}:null;}
export function progress(v,c){return clamp((v-c.a)/(c.b-c.a));}
export class RepetitionCounter{
 constructor(){this.reset();} reset(){this.phase='rest';this.dwell=0;this.count=0;this.returning=false;}
 update(p,dt){const target=this.phase==='rest'?p<=.25:p>=.75;this.dwell=target?this.dwell+dt:0;if(this.dwell>=.3){this.dwell=0;if(this.phase==='rest'){this.phase='work';if(this.returning){this.returning=false;this.count++;return true;}}else{this.phase='rest';this.returning=true;}}return false;}
}
export function wristQuality(p){
 if(!p||p.length!==21)return 'Show your hand and part of your forearm';
 const essential=[0,5,9,17].map(i=>p[i]);
 if(essential.some(v=>!Number.isFinite(v.x)||!Number.isFinite(v.y)||v.x<.015||v.x>.985||v.y<.015||v.y>.985))return 'Keep your wrist and knuckles inside the frame';
 if(Math.hypot(p[9].x-p[0].x,p[9].y-p[0].y)<.035)return 'Move the camera a little closer to your hand';
 return null;
}
// A 2D wrist angle is only meaningful when the exercise's movement plane is
// visible. Use the model's palm orientation as a view check, never as an
// invented forearm depth or a replacement ROM value.
export function wristViewQuality(id,p){
 if(!p||[0,5,9,17].some(i=>!p[i]||!['x','y','z'].every(k=>Number.isFinite(p[i][k]))))return 'Keep your wrist and knuckles clearly visible';
 const across=sub(p[5],p[17]),along=sub(p[9],p[0]);
 const width=norm(across),length=norm(along);
 if(width<.005||length<.015)return 'Move closer so the wrist and palm are clear';
 if(id==='flexion'){
  if(Math.abs(across.z)/width<.55)return 'Show the thumb edge to the camera, not your palm. Move the camera to a side view';
  if(Math.abs(along.z)/length>.65)return 'Move the camera farther to the side so the bend stays across the picture';
 }else if(id==='deviation'){
  const normal={x:across.y*along.z-across.z*along.y,y:across.z*along.x-across.x*along.z,z:across.x*along.y-across.y*along.x};
  if(norm(normal)<1e-6||Math.abs(normal.z)/norm(normal)<.65)return 'Show the back of your hand and forearm flat to the camera for side-to-side movement';
 }
 return null;
}
export function exerciseMetric(id,m,wrist){
 if(id==='curl')return m?.flex;
 if(id==='opposition')return m?.opposition;
 if(id==='spread')return m?.spread;
 return wrist?.value;
}
