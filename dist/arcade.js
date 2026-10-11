import {clamp} from './rom.js';
const ease=t=>1-(1-clamp(t))**3;
export class Adventure{
 constructor(game,{target=.7,duration=90}={}){this.game=game;this.target=target;this.duration=duration;this.elapsed=0;this.score=0;this.collected=0;this.level=1;this.phase='settle';this.hold=0;this.progress=0;this.lastAction=-10;this.particles=[];this.goal=game.id==='stars'?18:game.mechanic==='steer'?12:10;this.lastEvent=null;}
 get complete(){return this.collected>=this.goal||this.elapsed>=this.duration;}
 get targetPosition(){return [.2,.65,.4,.82,.3,.72,.5,.15,.85,.38,.6,.25][this.collected%12];}
 get goalLabel(){return {cloud:'ISLANDS',reef:'FRIENDS',stars:'STARS',sky:'RINGS',river:'LANTERNS'}[this.game.id];}
 pause(){this.hold=0;}
 update(control,dt){
  if(this.complete)return null;dt=Math.min(dt,.12);this.elapsed+=dt;this.progress=clamp(control/this.target);this.lastEvent=null;
  this.particles=this.particles.filter(p=>p.life>0);for(const p of this.particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=.2*dt;}
  if(this.game.mechanic==='cycle'){
   if(this.phase==='settle'){this.hold=this.progress<.22?this.hold+dt:0;if(this.hold>=.3){this.phase='charge';this.hold=0;}}
   else if(this.phase==='charge'){this.hold=this.progress>=.94?this.hold+dt:0;if(this.hold>=.35){this.phase='release';this.hold=0;this.lastEvent='charged';}}
   else{this.hold=this.progress<.22?this.hold+dt:0;if(this.hold>=.3){this.collect();this.phase='charge';this.hold=0;}}
  }else{
   const near=Math.abs(this.progress-this.targetPosition)<.095;
   // Let the collection animation breathe; keeping still cannot collect the next target.
   this.hold=near&&this.elapsed-this.lastAction>.65?this.hold+dt:0;
   if(this.hold>=.55){this.collect();this.hold=0;}
  }
  return this.lastEvent;
 }
 collect(){this.collected++;this.level=1+Math.floor(this.collected/(this.game.id==='stars'?6:4));this.score+=100+(this.collected%4===0?50:0);this.lastAction=this.elapsed;this.lastEvent='collected';for(let i=0;i<22;i++){const a=i*2.399;this.particles.push({x:.5,y:.5,vx:Math.cos(a)*.18,vy:Math.sin(a)*.18-.1,life:1.3,color:['#fff7c5','#a2d5de','#b6a6eb','#efaabd'][i%4]});}}
 get instruction(){
  if(this.game.mechanic==='steer')return this.hold>0?'Nice. Settle here for a moment.':this.game.id==='sky'?'Bend your wrist to line up with the ring.':'Sway your wrist to line up with the lantern.';
  const words={cloud:['Open your fingers to get ready.','Gently curl to charge your jump.','Open your fingers. And… hop!'],reef:['Open your thumb to get ready.','Bring your thumb toward your little finger.','Open your thumb to free your ocean friend.'],stars:['Bring your fingers together to get ready.','Gently spread to gather stardust.','Bring your fingers together to weave a star.']};
  return words[this.game.id][this.phase==='settle'?0:this.phase==='charge'?1:2];
 }
}
function prepare(canvas){const r=canvas.getBoundingClientRect(),w=r.width,h=r.height,dpr=Math.min(globalThis.devicePixelRatio||1,2);if(w<=0||h<=0)return null;const width=Math.round(w*dpr),height=Math.round(h*dpr);if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}const c=canvas.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);return {c,w,h};}
function circle(c,x,y,r,fill){c.beginPath();c.arc(x,y,Math.max(.1,r),0,Math.PI*2);c.fillStyle=fill;c.fill();}
function ellipse(c,x,y,rx,ry,fill,rotation=0){c.beginPath();c.ellipse(x,y,Math.max(.1,rx),Math.max(.1,ry),rotation,0,Math.PI*2);c.fillStyle=fill;c.fill();}
function line(c,points,color,width=2){c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.beginPath();points.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));c.stroke();}
function star(c,x,y,r,fill){c.beginPath();for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2,rad=i%2?r*.45:r;const px=x+Math.cos(a)*rad,py=y+Math.sin(a)*rad;i?c.lineTo(px,py):c.moveTo(px,py);}c.closePath();c.fillStyle=fill;c.fill();}
function cloud(c,x,y,s=1){ellipse(c,x,y,45*s,13*s,'#ffffffb5');circle(c,x-17*s,y-7*s,16*s,'#ffffffb5');circle(c,x+8*s,y-14*s,24*s,'#ffffffb5');}
function bunny(c,x,y,s,q=0){c.save();c.translate(x,y);c.scale(s,s);const squash=1-q*.2;ellipse(c,0,3,24,25*squash,'#fffdfa');ellipse(c,-9,-24*squash,6,19,'#fffdfa',-.15);ellipse(c,7,-25*squash,6,19,'#fffdfa',.12);ellipse(c,-9,-27*squash,2,10,'#eebac8',-.15);ellipse(c,7,-28*squash,2,10,'#eebac8',.12);circle(c,-7,-1,2,'#465775');circle(c,8,-1,2,'#465775');ellipse(c,1,6,3,2,'#e8aab8');ellipse(c,-13,7,4,2,'#f5d7da');ellipse(c,15,7,4,2,'#f5d7da');ellipse(c,-10,25,9,4,'#f9f5ee');ellipse(c,11,25,9,4,'#f9f5ee');c.restore();}
function fish(c,x,y,s,color='#f0b576',direction=1){c.save();c.translate(x,y);c.scale(s*direction,s);c.fillStyle=color;c.beginPath();c.moveTo(-19,0);c.lineTo(-40,-17);c.lineTo(-40,17);c.closePath();c.fill();ellipse(c,0,0,28,18,color);circle(c,14,-4,3,'#294d65');ellipse(c,2,5,7,4,'#ffffff44',.4);c.restore();}
function label(c,text,x,y,color='#5b7596',size=10){c.fillStyle=color;c.font=`500 ${size}px -apple-system, sans-serif`;c.textAlign='center';c.fillText(text,x,y);}
const constellations=[{name:'The little fox',points:[[.25,.38],[.36,.29],[.42,.44],[.58,.44],[.64,.29],[.75,.38]]},{name:'The wanderer',points:[[.28,.62],[.32,.4],[.5,.22],[.5,.62],[.72,.62],[.62,.4]]},{name:'The secret garden',points:[[.5,.26],[.65,.35],[.6,.51],[.4,.51],[.35,.35],[.5,.7]]}];
export function renderAdventure(canvas,state,{preview=false,reduced=false}={}){
 const p=prepare(canvas);if(!p)return;const {c,w,h}=p;const t=reduced?0:state.elapsed,q=state.progress,n=state.collected,id=state.game.id,small=preview||w<450;const s=small?.7:1;const top=preview?0:65;
 if(id==='cloud'){
  c.fillStyle='#deedf9';c.fillRect(0,0,w,h);circle(c,w*.83,h*.22,34*s,'#fff5d4');cloud(c,w*.2+Math.sin(t*.12)*8,h*.22,.8*s);cloud(c,w*.7,h*.36,.65*s);cloud(c,w*.46,h*.12,.5*s);
  for(let i=0;i<5;i++){const x=w*(i*.28)-Math.sin(t*.04)*20;c.fillStyle='#c9e0ed';c.beginPath();c.moveTo(x-60,h);c.quadraticCurveTo(x,h*.54,x+90,h);c.fill();}
  const age=state.elapsed-state.lastAction;const jumping=n>0&&age<1;const phase=clamp(age);const world=jumping?n-1:n;const step=w*.44;const scroll=jumping?ease((phase-.45)/.55)*step:0;
  for(let i=-1;i<4;i++){const x=w*.28+i*step-scroll;const y=h*.69+(i%2?0:0);ellipse(c,x,y+28,65*s,26*s,'#b8c4de');ellipse(c,x,y+8,71*s,15*s,'#91b8aa');ellipse(c,x,y,68*s,12*s,'#b5d6ac');if(i>=1){star(c,x,y-47*s,11*s,'#efd18c');circle(c,x,y-47*s,20*s,'#f6d99c22');}for(let j=0;j<3;j++)ellipse(c,x-20+j*20,y+27,3,9,'#9eafca');}
  const x=w*.28+(jumping?ease(phase)*step:0)-scroll,y=h*.69-27*s-(jumping?Math.sin(phase*Math.PI)*h*.24:0);bunny(c,x,y,s,state.phase==='charge'?q:0);
  if(!preview){label(c,`ISLAND ${Math.min(n+1,11)} · THE FLOATING GARDENS`,w*.5,h*.88,'#617d99',9);if(state.phase==='release'){line(c,[[x,y-62],[x+15,y-76],[x+31,y-64]],'#8da9cd',2);}}
 }
 if(id==='reef'){
  const gradient=c.createLinearGradient(0,0,0,h);gradient.addColorStop(0,'#d9eee9');gradient.addColorStop(1,'#78b9b6');c.fillStyle=gradient;c.fillRect(0,0,w,h);
  for(let i=0;i<7;i++){c.fillStyle='#ffffff18';c.beginPath();c.moveTo(w*(i*.2)-70,0);c.lineTo(w*(i*.2)+35,0);c.lineTo(w*(i*.2)+140,h);c.lineTo(w*(i*.2)+30,h);c.fill();}
  c.fillStyle='#bdd5c0';c.beginPath();c.moveTo(0,h*.88);c.bezierCurveTo(w*.25,h*.8,w*.6,h,w,h*.86);c.lineTo(w,h);c.lineTo(0,h);c.fill();
  for(let i=0;i<8;i++){const x=w*i/7;line(c,[[x,h],[x+Math.sin(t+i)*8,h-25],[x-5,h-55],[x+Math.sin(t*.7+i)*8,h-85]],i%2?'#75a38e':'#81b4a0',5*s);}
  const bx=w*.49,by=h*.48;const bubbleSize=(55+q*14)*s;circle(c,bx,by,bubbleSize,'#effffb55');c.strokeStyle='#ffffffbd';c.lineWidth=2;c.beginPath();c.arc(bx,by,bubbleSize,0,Math.PI*2);c.stroke();ellipse(c,bx-18*s,by-28*s,7*s,12*s,'#fff9',.7);fish(c,bx+7*s,by+7*s,.8*s,['#efb981','#c0b3e0','#eea4ba'][n%3]);
  const age=state.elapsed-state.lastAction;if(n&&age<1.4){fish(c,bx+ease(age/1.4)*w*.45,by-Math.sin(age)*60,.65*s,'#edb875');circle(c,bx,by,Math.max(1,age*55*s),'#ffffff16');}
  for(let i=0;i<Math.min(n,10);i++){fish(c,w*(.08+(i%5)*.2)+Math.sin(t*.5+i)*8,h*(.24+Math.floor(i/5)*.36),.4*s,['#d5afda','#f4ce92','#a8d5d1'][i%3],i%2?-1:1);}
  for(let i=0;i<12;i++){const x=(i*97.4)%w,y=h-((i*53+t*14)%h);c.strokeStyle='#ffffff4a';c.lineWidth=1;c.beginPath();c.arc(x,y,3+i%4,0,Math.PI*2);c.stroke();}
  if(!preview)label(c,`REEF ${state.level} · ${n} LITTLE FRIEND${n===1?'':'S'} FREE`,w*.5,h*.88,'#406c6e',9);
 }
 if(id==='stars'){
  c.fillStyle='#272a4b';c.fillRect(0,0,w,h);for(let i=0;i<70;i++)circle(c,(i*137.6)%w,(i*73.3)%h,((i%3)+1)*.45,'#e9e5ff'+(i%2?'77':'33'));
  const glow=c.createRadialGradient(w*.5,h*.48,0,w*.5,h*.48,w*.45);glow.addColorStop(0,'#64619d44');glow.addColorStop(1,'#64619d00');c.fillStyle=glow;c.fillRect(0,0,w,h);
  circle(c,w*.84,h*.21,22*s,'#e5dff5');circle(c,w*.855,h*.19,20*s,'#272a4b');
  const constellation=constellations[Math.min(2,Math.floor(n/6))];const count=preview?3:n%6;const points=constellation.points.map(([x,y])=>[x*w,top+y*(h-top-50)]);
  line(c,points,'#ffffff18',1.5);if(count>1)line(c,points.slice(0,count),'#d1c7f0',2);
  points.forEach(([x,y],i)=>{if(i<count){circle(c,x,y,18*s,'#e8d0ff15');star(c,x,y,9*s,'#ffe2a6');}else if(i===count){circle(c,x,y,(19+q*14)*s,'#c6b2ef20');star(c,x,y,(7+q*6)*s,'#b7a6d8');}else circle(c,x,y,3*s,'#a7a1c955');});
  if(!preview)label(c,`${constellation.name.toUpperCase()} · CONSTELLATION ${Math.min(3,Math.floor(n/6)+1)} OF 3`,w*.5,h*.89,'#c8bfde',9);
 }
 if(id==='sky'){
  const gradient=c.createLinearGradient(0,0,0,h);gradient.addColorStop(0,'#f8e8d4');gradient.addColorStop(1,'#e5ebed');c.fillStyle=gradient;c.fillRect(0,0,w,h);circle(c,w*.78,h*.25,37*s,'#f9d99d');
  for(let i=0;i<4;i++){const x=((i*w*.32-state.elapsed*7)%(w+200)+w+200)%(w+200)-100;cloud(c,x,h*(.3+(i%2)*.23),1.1*s);}
  for(let i=0;i<4;i++){c.fillStyle=['#dfd9d0','#c8d0d0','#b4c5c9','#9cb7c0'][i];c.beginPath();c.moveTo(0,h);c.lineTo(0,h*(.77+i*.06));c.bezierCurveTo(w*.2,h*(.58+i*.07),w*.6,h*(.92+i*.03),w,h*(.65+i*.08));c.lineTo(w,h);c.fill();}
  const x=w*.31,y=top+(1-q)*(h-top-130)+35;const targetY=top+(1-state.targetPosition)*(h-top-130)+35;const ringX=w*.67;const age=state.elapsed-state.lastAction;
  c.strokeStyle=state.hold>0?'#fff5c1':'#c19d65';c.lineWidth=5*s;c.beginPath();c.ellipse(ringX,targetY,23*s,34*s,0,0,Math.PI*2);c.stroke();c.strokeStyle='#ffffff65';c.lineWidth=1;c.beginPath();c.ellipse(ringX,targetY,31*s,43*s,0,0,Math.PI*2);c.stroke();
  line(c,[[x+30,y],[ringX-38,targetY]],'#a8947922',1);c.save();c.translate(x,y);c.rotate((.5-q)*.22);c.fillStyle='#fffdf4';c.beginPath();c.moveTo(-33*s,2);c.lineTo(38*s,-8*s);c.lineTo(5*s,18*s);c.lineTo(-8*s,6*s);c.closePath();c.fill();line(c,[[5*s,18*s],[-8*s,6*s],[38*s,-8*s]],'#c7baa4',1);c.restore();
  if(state.hold>0){c.strokeStyle='#fff';c.lineWidth=3;c.beginPath();c.arc(ringX,targetY,45*s,-Math.PI/2,-Math.PI/2+Math.PI*2*clamp(state.hold/.55));c.stroke();}
  if(n&&age<1)label(c,'+100',ringX,targetY-55-age*30,'#9a7947',17);
  if(!preview)label(c,`TRAIL ${state.level} · THE GOLDEN HOUR`,w*.5,h*.89,'#827c71',9);
 }
 if(id==='river'){
  c.fillStyle='#ddebe0';c.fillRect(0,0,w,h);c.fillStyle='#b1d6d1';c.beginPath();c.moveTo(w*.2,0);c.bezierCurveTo(w*.39,h*.3,w*.14,h*.6,w*.22,h);c.lineTo(w*.8,h);c.bezierCurveTo(w*.68,h*.65,w*.91,h*.3,w*.8,0);c.closePath();c.fill();
  for(let i=0;i<12;i++){const y=(i*73+t*14)%h,x=w*(.33+(i%4)*.1);line(c,[[x,y],[x+16,y]],'#effffb55',2);}
  for(let i=0;i<10;i++){const x=w*(i%2?.91:.085)+Math.sin(i*1.6)*w*.025,y=(i*81+t*7)%(h+80)-40;circle(c,x,y,22*s,'#a6c4a1');circle(c,x-8*s,y-8*s,19*s,'#c3d9b2');circle(c,x+10*s,y-4*s,17*s,'#b5d0a6');}
  const x=w*(.29+q*.42),y=h*.63;const tx=w*(.29+state.targetPosition*.42),ty=h*.39;
  ellipse(c,tx,ty+17*s,24*s,6*s,'#739ea54d');c.fillStyle='#f4d6a2';c.fillRect(tx-10*s,ty-14*s,20*s,27*s);line(c,[[tx-12*s,ty-14*s],[tx+12*s,ty-14*s]],'#ba977b',3);line(c,[[tx-11*s,ty+13*s],[tx+11*s,ty+13*s]],'#ba977b',3);circle(c,tx,ty,6*s,'#fff0c1');circle(c,tx,ty,25*s,'#ffecc422');
  if(state.hold>0){c.strokeStyle='#fff';c.lineWidth=3;c.beginPath();c.arc(tx,ty,33*s,-Math.PI/2,-Math.PI/2+Math.PI*2*clamp(state.hold/.55));c.stroke();}
  c.save();c.translate(x,y);c.rotate((q-.5)*.12);ellipse(c,0,17*s,21*s,6*s,'#6a9da26b');ellipse(c,0,0,15*s,35*s,'#dba983');ellipse(c,0,-3*s,10*s,23*s,'#f4dfbd');circle(c,0,-4*s,7*s,'#879fc2');line(c,[[-24*s,-13*s],[22*s,15*s]],'#ab896e',3*s);c.restore();
  if(n&&state.elapsed-state.lastAction<1.1){star(c,tx,ty-35,12*s,'#fff3c2');}
  if(!preview)label(c,`BEND ${state.level} · THE LANTERN RIVER`,w*.5,h*.88,'#5b7f74',9);
 }
 if(!preview){for(const particle of state.particles){circle(c,particle.x*w,particle.y*h,3*clamp(particle.life),particle.color);}if(state.elapsed-state.lastAction<1.5&&state.collected%4===0&&state.collected>0){label(c,'LOVELY FLOW · +50 BONUS',w*.5,h*.23,id==='stars'?'#f6dfb0':'#596b8c',12);}}
}
export function renderWelcome(canvas,time=0){const p=prepare(canvas);if(!p)return;const {c,w,h}=p;const s=Math.min(w/550,h/450);const cx=w*.52,cy=h*.48;circle(c,cx,cy,169*s,'#eef0fa');circle(c,cx,cy,128*s,'#e4e9f8');cloud(c,cx-120*s,cy-95*s,.85*s);cloud(c,cx+125*s,cy+70*s,.7*s);circle(c,cx+110*s,cy-105*s,32*s,'#f6dca9');star(c,cx+110*s,cy-105*s,15*s,'#fff9e9');circle(c,cx-133*s,cy+59*s,43*s,'#d8ece5');fish(c,cx-128*s,cy+60*s,.8*s,'#88baa8');ellipse(c,cx+10*s,cy+103*s,83*s,16*s,'#c3ccde');ellipse(c,cx+10*s,cy+86*s,89*s,18*s,'#aecdb1');ellipse(c,cx+10*s,cy+79*s,86*s,13*s,'#c8dfbd');bunny(c,cx+10*s,cy+30*s+Math.sin(time*.6)*3*s,1.5*s,0);star(c,cx+143*s,cy-12*s,8*s,'#a89acb');star(c,cx-75*s,cy+133*s,7*s,'#d4b580');circle(c,cx-20*s,cy-145*s,5*s,'#b8c5e5');circle(c,cx+70*s,cy+146*s,4*s,'#d9bdc5');}
export function guideMotion({stage='position',elapsed=0,duration=3,time=0,reduced=false}={}){
 if(stage==='holdA'||stage==='failed')return 0;
 if(stage==='holdB')return 1;
 const fraction=ease(elapsed/Math.max(.1,duration));
 if(stage==='prepareA')return .5*(1-fraction);
 if(stage==='prepareB')return fraction;
 return reduced?.5:(Math.sin(time*.9)+1)/2;
}
export function renderGuide(canvas,exercise,state={}){
 const p=prepare(canvas);if(!p)return;const {c,w,h}=p;const phase=guideMotion(state),x=w*.5,y=h*.57;
 circle(c,x,y,Math.min(70,h*.42),'#f0f2fa');
 c.save();c.translate(x,y);const scale=Math.min(1,h/190);c.scale(scale,scale);
 if(exercise.wrist){
  // Side view: palm faces downward, so flexion bends down and extension up.
  // Top view: thumb faces upward, so radial deviation goes up and ulnar down.
  const bend=exercise.id==='flexion'?.65-phase*1.3:-.42+phase*.84;
  line(c,[[-125,10],[-26,10]],'#acb9d5',21);circle(c,-22,10,8,'#8596bb');
  c.save();c.translate(-22,10);c.rotate(bend);line(c,[[0,0],[57,0]],'#94a6cf',23);
  for(let i=0;i<4;i++)line(c,[[47,-10+i*7],[82-i*3,-10+i*7]],'#94a6cf',5);
  if(exercise.id==='flexion'){line(c,[[15,10],[46,10]],'#d4c4e8',4);line(c,[[30,11],[49,25]],'#94a6cf',7);}
  else line(c,[[26,-8],[46,-27]],'#94a6cf',7);
  c.restore();c.strokeStyle='#b4a2dc';c.lineWidth=2;c.beginPath();c.arc(-22,10,88,-.7,.7);c.stroke();
  if(exercise.id==='deviation')label(c,'THUMB SIDE',-12,-51,'#8b7aa8',8);
  c.restore();label(c,exercise.id==='flexion'?'SIDE VIEW · PALM SIDE BELOW':'TOP VIEW · THUMB SIDE ABOVE',w*.5,h-8,'#8390a8',8);return;
 }
 line(c,[[-17,65],[-17,29],[17,29],[17,65]],'#9eafd0',12);ellipse(c,0,9,28,36,'#9eafd0');
 for(let i=0;i<4;i++){
  const base=[-21+i*14,-17],length=i===1?27:i===3?20:24;
  if(exercise.id==='curl'){
   const pip=[base[0]+phase*2,base[1]-length*(1-.55*phase)];
   const middleAngle=-Math.PI/2+phase*Math.PI*.72;
   const dip=[pip[0]+Math.cos(middleAngle)*18,pip[1]+Math.sin(middleAngle)*18];
   const tipAngle=middleAngle+phase*Math.PI*.48;
   const tip=[dip[0]+Math.cos(tipAngle)*12,dip[1]+Math.sin(tipAngle)*12];
   line(c,[base,pip,dip,tip],'#9eafd0',9);circle(c,tip[0],tip[1],4.5,'#9eafd0');
  }else{
   const spread=exercise.id==='spread'?(i-1.5)*phase*.25:0;
   const tip=[base[0]+Math.sin(spread)*(length+25),base[1]-Math.cos(spread)*(length+25)];
   line(c,[base,tip],'#9eafd0',9);circle(c,tip[0],tip[1],4.5,'#9eafd0');
  }
 }
 const thumbStart=[-22,15],thumbJoint=exercise.id==='opposition'?[-39+phase*28,-2-phase*23]:[-39,-2];
 const thumbEnd=exercise.id==='opposition'?[-48+phase*69,-13-phase*49]:[-48,-13];
 line(c,[thumbStart,thumbJoint,thumbEnd],'#a9b8d5',10);circle(c,thumbEnd[0],thumbEnd[1],5,'#a9b8d5');
 if(exercise.id==='opposition'&&phase>.85)circle(c,21,-62,8,'#c1e1d244');
 c.restore();
 const caption=state.stage?.startsWith('hold')?'HOLD THIS POSITION':exercise.id==='opposition'?'THUMB TOWARD LITTLE FINGER':'GENTLE MOVEMENT · WRIST STILL';
 label(c,caption,w*.5,h-7,'#8390a8',8);
}
