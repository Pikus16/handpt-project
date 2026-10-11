// Hand-seeded, appearance-adaptive forearm tracking. No fixed skin-tone thresholds,
// elbow landmark, body-pose model, or user-supplied reference is used.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const median=a=>{const s=[...a].sort((a,b)=>a-b);return s[Math.floor(s.length/2)];};
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const chroma=(r,g,b)=>({y:.299*r+.587*g+.114*b,cb:128-.168736*r-.331264*g+.5*b,cr:128+.5*r-.418688*g-.081312*b});
const failure=error=>({error});
export function detectForearm(data,width,height,hand){
 if(!data||data.length!==width*height*4||!hand?.[17])return failure('Show your hand and an uncovered section of forearm');
 const pt=i=>({x:hand[i].x*width,y:hand[i].y*height});
 const wrist=pt(0),knuckle=pt(9),left=pt(5),right=pt(17);
 if([wrist,knuckle,left,right].some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))return failure('Keep your wrist and palm in view');
 // The wrist-to-MCP distance collapses when the palm tilts toward the lens.
 // Palm width provides a second scale cue, independent of that collapse.
 const projectedLength=Math.hypot(knuckle.x-wrist.x,knuckle.y-wrist.y);
 const projectedWidth=Math.hypot(left.x-right.x,left.y-right.y);
 const palm=Math.max(projectedLength,projectedWidth*.85);
 if(palm<10)return failure('Move closer so the hand and forearm are clear');
 const palmWidth=Math.max(projectedWidth,palm*.32,5);
 // Sample the palm interior, not wrist edges, sleeves, or a predetermined color.
 const samples=[];
 for(const amount of [.18,.3,.45,.6]){
  const cx=wrist.x+(knuckle.x-wrist.x)*amount,cy=wrist.y+(knuckle.y-wrist.y)*amount;
  const radius=Math.max(1,Math.min(palmWidth*.12,palm*.1));
  for(const [dx,dy] of [[0,0],[radius,0],[-radius,0],[0,radius],[0,-radius]]){
   const x=Math.round(cx+dx),y=Math.round(cy+dy);
   if(x<0||x>=width||y<0||y>=height)continue;
   const i=(y*width+x)*4;if(data[i+3]<200)continue;samples.push(chroma(data[i],data[i+1],data[i+2]));
  }
 }
 if(samples.length<12)return failure('Keep your palm and wrist inside the frame');
 const palette={y:median(samples.map(p=>p.y)),cb:median(samples.map(p=>p.cb)),cr:median(samples.map(p=>p.cr))};
 const scale={y:clamp(median(samples.map(p=>Math.abs(p.y-palette.y)))*3+22,28,65),cb:clamp(median(samples.map(p=>Math.abs(p.cb-palette.cb)))*3+5,7,18),cr:clamp(median(samples.map(p=>Math.abs(p.cr-palette.cr)))*3+5,7,18)};
 const mask=new Uint8Array(width*height),strength=new Float32Array(width*height);
 for(let i=0;i<mask.length;i++){
  const j=i*4;if(data[j+3]<200)continue;
  const p=chroma(data[j],data[j+1],data[j+2]);
  // Bending can shadow the palm while the forearm remains brightly lit.
  // Chroma drives segmentation; luminance contributes only weakly.
  const d=((p.cb-palette.cb)/scale.cb)**2+((p.cr-palette.cr)/scale.cr)**2+.04*((p.y-palette.y)/scale.y)**2;
  strength[i]=Math.exp(-d*.5);mask[i]=d<5.2?1:0;
 }
 // Fill isolated appearance gaps (fine hair, highlights, compression noise)
 // without turning broad missing/background regions into foreground.
 const clean=mask.slice();
 for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){
  const i=y*width+x;if(mask[i])continue;
  let neighbors=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(dx||dy)neighbors+=mask[i+dy*width+dx];
  if(neighbors>=6)clean[i]=1;
 }
 mask.set(clean);
 const sample=(x,y)=>{x=Math.round(x);y=Math.round(y);return x>=1&&x<width-1&&y>=1&&y<height-1?mask[y*width+x]:-1;};
 const behind=Math.atan2(wrist.y-knuckle.y,wrist.x-knuckle.x);
 const candidates=[];
 // Search a broad cone behind the hand. The hand direction only defines the
 // search region; the measured forearm direction comes from image boundaries.
 for(let offset=-108;offset<=108;offset+=6){
  const theta=behind+offset*Math.PI/180,u={x:Math.cos(theta),y:Math.sin(theta)},v={x:-u.y,y:u.x};
  const points=[],sides=[];let shift=0,previousWidth=null,skin=0;
  const spacing=Math.max(3,palm*.12),start=palm*.35,maxDistance=Math.min(palm*4,Math.hypot(width,height)*.65);
  for(let d=start;d<=maxDistance;d+=spacing){
   const center={x:wrist.x+u.x*d+v.x*shift,y:wrist.y+u.y*d+v.y*shift};
   const maxHalf=Math.ceil(palmWidth*1.7),search=Math.ceil(palmWidth*.45);
   let nearest=null;
   for(let k=0;k<=search&&nearest===null;k++){for(const sign of k?[1,-1]:[1]){const s=k*sign;if(sample(center.x+v.x*s,center.y+v.y*s)===1){nearest=s;break;}}}
   if(nearest===null)break;
   let lo=nearest,hi=nearest;
   while(lo>-maxHalf&&sample(center.x+v.x*(lo-1),center.y+v.y*(lo-1))===1)lo--;
   while(hi<maxHalf&&sample(center.x+v.x*(hi+1),center.y+v.y*(hi+1))===1)hi++;
   // Require both visible edges. Broad same-color background and frame-edge
   // guesses must fail rather than pretending to be a measured forearm.
   if(lo<=-maxHalf||hi>=maxHalf||sample(center.x+v.x*(lo-2),center.y+v.y*(lo-2))!==0||sample(center.x+v.x*(hi+2),center.y+v.y*(hi+2))!==0)break;
   const sectionWidth=hi-lo;
   if(sectionWidth<palmWidth*.28||sectionWidth>palmWidth*3||previousWidth!==null&&(sectionWidth>previousWidth*1.65||sectionWidth<previousWidth*.55))break;
   const correction=(lo+hi)/2;if(Math.abs(correction)>palmWidth*.75)break;
   const p={x:center.x+v.x*correction,y:center.y+v.y*correction};
   const index=Math.round(p.y)*width+Math.round(p.x);skin+=strength[index]||0;
   points.push(p);sides.push([{x:center.x+v.x*lo,y:center.y+v.y*lo},{x:center.x+v.x*hi,y:center.y+v.y*hi}]);
   shift+=correction*.7;previousWidth=sectionWidth;
  }
  if(points.length<6)continue;
  const span=Math.hypot(points.at(-1).x-points[0].x,points.at(-1).y-points[0].y);
  // Require a substantial bounded section, without demanding multiple palm
  // lengths or discarding an arm that extends beyond the frame.
  if(span<Math.max(palm*.75,palmWidth*1.1,20))continue;
  const mx=points.reduce((s,p)=>s+p.x,0)/points.length,my=points.reduce((s,p)=>s+p.y,0)/points.length;
  let xx=0,yy=0,xy=0;for(const p of points){xx+=(p.x-mx)**2;yy+=(p.y-my)**2;xy+=(p.x-mx)*(p.y-my);}
  let axisAngle=.5*Math.atan2(2*xy,xx-yy);
  // Orient the fitted axis toward the hand.
  if(Math.cos(axisAngle)*(wrist.x-mx)+Math.sin(axisAngle)*(wrist.y-my)<0)axisAngle+=Math.PI;
  const axis={x:Math.cos(axisAngle),y:Math.sin(axisAngle)};
  const residual=Math.sqrt(points.reduce((s,p)=>s+((p.x-mx)*axis.y-(p.y-my)*axis.x)**2,0)/points.length);
  const meanStrength=skin/points.length;
  if(residual>palmWidth*.18||meanStrength<.28)continue;
  const nearest=points[0];
  if(Math.hypot(nearest.x-wrist.x,nearest.y-wrist.y)>palm*1.25)continue;
  const score=span/palm-3*residual/palmWidth+meanStrength;
  candidates.push({axisAngle,score,span,points,sides,meanStrength});
 }
 if(!candidates.length)return failure('Show more uncovered forearm against a contrasting background');
 candidates.sort((a,b)=>b.score-a.score);const best=candidates[0];
 // Reject competing image regions with similarly good but different axes.
 const competitor=candidates.find(c=>Math.abs(wrap(c.axisAngle-best.axisAngle))>25*Math.PI/180&&c.score>best.score*.9);
 if(competitor)return failure('Forearm outline is ambiguous. Use a plain contrasting background');
 const norm=p=>({x:p.x/width,y:p.y/height});
 return {axis:{x:Math.cos(best.axisAngle),y:Math.sin(best.axisAngle)},forearmAngle:wrap(best.axisAngle)*180/Math.PI,anchor:norm(best.points.at(-1)),outline:[...best.sides.map(p=>norm(p[0])),...best.sides.toReversed().map(p=>norm(p[1]))],span:best.span/Math.min(width,height)};
}
export class ForearmTracker{
 constructor(){this.reset();}
 reset(){this.angle=null;this.streak=0;this.lastTime=null;}
 detect(data,width,height,hand,time){
  const found=detectForearm(data,width,height,hand);
  if(found.error){this.reset();return found;}
  const a=found.forearmAngle*Math.PI/180;
  if(this.angle===null||this.lastTime===null||time-this.lastTime>450||Math.abs(wrap(a-this.angle))>18*Math.PI/180){this.angle=a;this.streak=1;}else{this.angle+=wrap(a-this.angle)*.35;this.streak++;}
  this.lastTime=time;
  if(this.streak<4)return failure('Finding your forearm. Hold your supported arm steady');
  return {...found,axis:{x:Math.cos(this.angle),y:Math.sin(this.angle)},forearmAngle:wrap(this.angle)*180/Math.PI};
 }
}
export function forearmProjection(hand,forearm,aspect){
 if(forearm?.error)return forearm;
 if(!hand?.[9]||!forearm?.axis||!Number.isFinite(aspect)||aspect<=0)return failure('Show your hand and forearm');
 const b={x:(hand[9].x-hand[0].x)*aspect,y:hand[9].y-hand[0].y};
 if(Math.hypot(b.x,b.y)<.025)return failure('Turn the camera to see the hand from the side');
 const a=forearm.axis,value=Math.atan2(a.x*b.y-a.y*b.x,a.x*b.x+a.y*b.y)*180/Math.PI;
 if(!Number.isFinite(value)||Math.abs(value)>110)return failure('Align the camera with the movement plane');
 return {value,elbow:forearm.anchor,wrist:hand[0],forearmAngle:forearm.forearmAngle,outline:forearm.outline,automatic:true};
}
