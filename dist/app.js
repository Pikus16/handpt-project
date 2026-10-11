import {EXERCISES,GAMES,exerciseById,gameById} from './exercises.js';
import {metrics,quality,wristQuality,wristViewQuality,exerciseMetric,progress,RepetitionCounter,clamp} from './rom.js';
import {forearmProjection} from './forearm.js';
import {CalibrationFlow} from './calibration.js';
import {calibrationReadout} from './calibration-display.js';
import {Adventure,renderAdventure,renderWelcome,renderGuide} from './arcade.js';
const $=id=>document.getElementById(id);
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
let view='welcome',returnView='welcome',demo=false,stream=null,worker=null,ready=false,busy=false,generation=0,initTimer=null,lastVideo=-1,lastSend=0,lastResult=0,lastFrameRequest=0;
let flow=null,calibrations={},skipped=[],setupPaused=false,activeExercise=EXERCISES[0],value=null,valid=false,filtered=null,arm=null,issue='Waiting for your hand',lastStamp=null,lastMeasureTime=null;
let adventure=null,session=null,paused=false,counter=new RepetitionCounter(),previous=performance.now(),soundEnabled=false,audio=null;
let history=[];try{const h=JSON.parse(localStorage.getItem('handpt-project.sessions.v2')||'[]');if(Array.isArray(h))history=h.filter(s=>s&&gameById(s.game)&&exerciseById(s.exercise)&&Number.isFinite(s.score)&&Number.isFinite(s.date?Date.parse(s.date):NaN)).slice(0,200);}catch{}
// Preserve older sessions as explicitly labeled legacy measurements.
try{const old=JSON.parse(localStorage.getItem('handpt-project.sessions.v1')||'[]');if(Array.isArray(old))for(const row of old){if(!['garden','ocean','stars'].includes(row?.game)||!Number.isFinite(Date.parse(row.date)))continue;history.push({...row,legacy:true,score:0,exercise:row.game==='garden'?'curl':row.game==='stars'?'spread':'legacy-pinch',unit:row.game==='ocean'?'×':'°'});}history.sort((a,b)=>Date.parse(b.date)-Date.parse(a.date));history=history.slice(0,200);}catch{}
const recordGameName=s=>s.legacy?({garden:'Little Garden',ocean:'Ocean Explorer',stars:'Constellation'}[s.game]+' · previous version'):gameById(s.game).name;
const recordExercise=s=>s.exercise==='legacy-pinch'?{name:'Thumb–index pinch',unit:'×'}:exerciseById(s.exercise);
function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').hidden=true,6500);}
function show(next){view=next;for(const name of ['welcome','setup','library','arcade','result','history','about'])$(name+'-view').hidden=name!==next;window.scrollTo?.({top:0,behavior:'instant'});if(next==='library')drawCards();}
function resetMeasurement(){filtered=null;value=null;valid=false;lastStamp=null;lastMeasureTime=null;arm=null;counter.dwell=0;}
function fmt(n,e=activeExercise){return Number.isFinite(n)?(e.unit==='×'?n.toFixed(2):Math.round(n))+e.unit:'—';}
function stopCamera(){clearTimeout(initTimer);generation++;worker?.terminate();worker=null;stream?.getTracks().forEach(t=>t.stop());stream=null;ready=false;busy=false;$('video').srcObject=null;$('camera-empty').hidden=false;$('camera-badge').textContent='CAMERA OFF';resetMeasurement();}
function beginCalibration(simulated=false){demo=simulated;flow=new CalibrationFlow(EXERCISES);calibrations={};skipped=[];setupPaused=false;$('pause-setup').textContent='Pause setup';$('hand').disabled=simulated;$('demo-setup').hidden=!simulated;$('setup-camera-host').append($('camera-shell'));show('setup');updateStep();if(simulated){$('camera-badge').textContent='DEMO · SIMULATED';$('camera-quality').textContent='Simulated movement';$('camera-empty').hidden=false;}}
function updateStep(){
 if(flow.done){calibrations=flow.results;activeExercise=null;resetMeasurement();renderLibrary();show('library');return;}
 activeExercise=flow.exercise;worker?.postMessage({type:'reset-forearm'});resetMeasurement();$('exercise-title').textContent=activeExercise.name;$('step-label').textContent=`MOVEMENT ${flow.index+1} OF 5`;$('position-guide').textContent=activeExercise.setup;$('retry').hidden=true;$('retry').disabled=false;$('capture-fill').style.width='0%';renderRail();renderSetup();
}
function renderRail(){$('step-rail').replaceChildren();EXERCISES.forEach((e,i)=>{const node=document.createElement('div');node.className='step-item'+(i===flow.index?' active':flow.results[e.id]?' done':skipped.includes(e.id)?' skipped':'');const n=document.createElement('span'),title=document.createElement('span');n.textContent=flow.results[e.id]?'✓':skipped.includes(e.id)?'—':String(i+1).padStart(2,'0');title.textContent=e.short;node.append(n,title);$('step-rail').append(node);});}
function renderSetup(){
 if(!flow||flow.done)return;
 const e=flow.exercise,s=flow.stage,holding=s.startsWith('hold'),moving=s.startsWith('prepare');
 const remaining=Math.max(0,flow.duration-flow.elapsed);
 const phase=(label,kind)=>{$('cal-phase').textContent=label;$('cal-phase').dataset.phase=kind;};
 const reading=calibrationReadout(flow,value,{valid,paused:setupPaused});
 $('cal-measure-name').textContent=e.measure+(e.unit==='×'?' · Ratio':' · Camera estimate');
 $('cal-live-status').textContent=setupPaused?'Paused':demo?'Simulated':valid?'Live':'Waiting for tracking';
 $('cal-live-value').textContent=fmt(reading.live,e);
 $('cal-first-value').textContent=fmt(reading.first.value,e);$('cal-first-status').textContent=reading.first.state;
 $('cal-second-value').textContent=fmt(reading.second.value,e);$('cal-second-status').textContent=reading.second.state;
 $('cal-span-value').textContent=fmt(reading.span,e);$('cal-span-status').textContent=reading.span===null?'Both positions':'Preview';
 $('capture-fill').style.width=`${flow.fraction*100}%`;
 $('retry').hidden=s!=='failed';
 if(setupPaused){phase('PAUSED','waiting');$('cal-prompt').textContent='Rest whenever you need.';$('cal-detail').textContent='Press Resume setup when you’re ready to continue.';$('cal-countdown').textContent='The countdown is paused.';return;}
 if(!demo&&!ready){phase('GET READY','waiting');$('cal-prompt').textContent='Preparing your camera…';$('cal-detail').textContent='Allow camera access. We’ll tell you when to move and when to hold.';$('cal-countdown').textContent=issue;return;}
 if(s==='failed'){phase('TRY AGAIN','waiting');$('cal-prompt').textContent='Let’s try that movement again.';$('cal-detail').textContent=flow.issue;$('cal-countdown').textContent='Choose Retry, or skip this movement.';return;}
 if(!valid){phase('TRACKING PAUSED','waiting');$('cal-prompt').textContent='Bring your movement into view.';$('cal-detail').textContent=issue;$('cal-countdown').textContent=holding?'The hold will restart when tracking is clear.':'The countdown will continue when tracking is clear.';return;}
 if(s==='position'){phase('GET INTO POSITION','move');$('cal-prompt').textContent=e.title;$('cal-detail').textContent=e.setup;$('cal-countdown').textContent=`Get ready · ${Math.ceil(remaining)}s until the first movement`;}
 else if(moving){phase('MOVE INTO POSITION','move');$('cal-prompt').textContent=flow.endpoint===0?e.a:e.b;$('cal-detail').textContent='Move gently toward the position shown. Stop at your comfortable limit.';$('cal-countdown').textContent=`Move now · HOLD STILL in ${Math.ceil(remaining)}s`;}
 else{phase('HOLD STILL','hold');$('cal-prompt').textContent=flow.endpoint===0?e.holdA:e.holdB;$('cal-detail').textContent=flow.issue||'Stay in this position. Don’t keep moving—we’re measuring your range.';$('cal-countdown').textContent=remaining>0?`Keep holding · ${remaining.toFixed(1)}s left`:'Keep holding · collecting a few more clear frames';}
}
$('begin').onclick=()=>{beginCalibration(false);connectCamera();};$('try-demo').onclick=()=>{stopCamera();beginCalibration(true);};
$('cancel-setup').onclick=()=>{flow=null;stopCamera();show('welcome');};
$('pause-setup').onclick=()=>{setupPaused=!setupPaused;flow?.pause();$('pause-setup').textContent=setupPaused?'Resume setup':'Pause setup';renderSetup();};
$('skip').onclick=()=>{if(!flow||flow.done)return;skipped.push(flow.exercise.id);flow.skip();updateStep();};
$('retry').onclick=()=>{if(!flow||flow.done)return;flow.restart();updateStep();};
$('hand').onchange=()=>{beginCalibration(demo);};$('reconnect').onclick=()=>connectCamera();
async function connectCamera(){
 if(stream){if(ready)return;stopCamera();}demo=false;$('reconnect').hidden=true;issue='Waiting for camera permission';renderSetup();
 if(!navigator.mediaDevices?.getUserMedia){issue='Camera needs HTTPS or localhost in a supported browser.';$('reconnect').hidden=false;$('camera-quality').textContent=issue;renderSetup();toast(issue);return;}
 const current=++generation;
 try{const media=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:960},height:{ideal:720}},audio:false});if(current!==generation){media.getTracks().forEach(t=>t.stop());return;}stream=media;$('video').srcObject=media;await $('video').play();if(current!==generation)return;$('camera-empty').hidden=true;$('camera-badge').textContent='LOCAL CAMERA';issue='Loading hand tracking';renderSetup();
 worker=new Worker('./tracker.js?v=iphone-canvas-1');worker.onmessage=({data})=>{
  if(current!==generation)return;
  if(data.type==='ready'){clearTimeout(initTimer);ready=true;lastVideo=-1;}
  if(data.type==='result'){busy=false;lastResult=performance.now();handleResult(data);}
  if(data.type==='error')cameraFailure('Hand tracking could not load: '+data.message);
 };
 worker.onerror=()=>cameraFailure('The browser could not start hand tracking. Reload or try a current browser.');worker.postMessage({type:'init'});initTimer=setTimeout(()=>{if(!ready&&current===generation)cameraFailure('Hand tracking took too long to load. Please retry.');},45000);
 }catch(e){if(current!==generation)return;cameraFailure(e.name==='NotAllowedError'?'Camera access was declined. Enable it in browser settings, or explore the demo.':e.name==='NotFoundError'?'No camera found. Connect one or explore the demo.':'Camera could not start. Close other camera apps and retry.');}
}
function cameraFailure(message){stopCamera();issue=message;$('camera-quality').textContent=message;$('reconnect').hidden=false;if(flow)flow.pause();renderSetup();toast(message);if(session){paused=true;showMask();}}
function handleResult(data){
 if(!activeExercise||!['setup','arcade'].includes(view)){valid=false;return;}
 const e=activeExercise,r=data.result;const p=r?.landmarks;let reason=null,wrist=null;
 if(p?.length!==1)reason=p?.length>1?'Show only your exercising hand':'Show your whole exercising hand';
 if(!reason&&$('hand').value!=='any'&&r.handedness[0]?.[0]?.categoryName!==$('hand').value)reason=`Show your selected ${$('hand').value.toLowerCase()} hand`;
 if(!reason)reason=e.wrist?wristQuality(p[0]):quality(p[0]);
 const m=!reason&&!e.wrist?metrics(r.worldLandmarks?.[0]):null;
 if(!reason&&!e.wrist&&!m)reason='Keep finger joints visible and hold steady';
 if(!reason&&e.wrist){const aspect=$('video').videoWidth/$('video').videoHeight;wrist=forearmProjection(p[0],data.forearm,aspect);reason=wrist.error||null;}
 if(!reason&&e.wrist)reason=wristViewQuality(e.id,r.worldLandmarks?.[0]);

 if(!reason&&e.wrist&&session&&Number.isFinite(calibrations[e.id]?.forearmAngle)){
  const drift=Math.abs(((wrist.forearmAngle-calibrations[e.id].forearmAngle+540)%360)-180);
  if(drift>15)reason='Keep your forearm in its calibrated position';
 }
 const measured=exerciseMetric(e.id,m,wrist);if(!reason&&!Number.isFinite(measured))reason='Reposition your hand for a clearer view';
 const elapsed=lastMeasureTime===null?.05:clamp((data.time-lastMeasureTime)/1000,0,.15);lastMeasureTime=data.time;
 valid=!reason;issue=reason||'Clear tracking · Camera estimate';lastStamp=data.time;$('camera-quality').textContent=issue;
 drawHand(e.wrist&&p?.length===1?p[0]:valid?p[0]:null,wrist?.elbow?wrist:null);
 if(valid){filtered=filtered===null?measured:filtered+.28*(measured-filtered);value=filtered;arm=wrist;
  if(view==='setup'&&flow&&!setupPaused&&!document.hidden){const index=flow.index;flow.update(value,elapsed,data.time,wrist?.forearmAngle);if(flow.index!==index){chime('step');updateStep();}}
  if(view==='arcade'&&session&&!paused&&!document.hidden){session.samples++;session.min=Math.min(session.min,value);session.max=Math.max(session.max,value);}
 }else{filtered=null;flow?.pause();adventure?.pause();counter.dwell=0;}
 renderSetup();
}
function drawHand(points,wrist){const canvas=$('overlay'),video=$('video');canvas.width=video.videoWidth||960;canvas.height=video.videoHeight||720;const c=canvas.getContext('2d');c.clearRect(0,0,canvas.width,canvas.height);if(!points)return;c.lineWidth=2.5;c.strokeStyle='#bdc9ff';c.lineCap='round';for(const chain of [[0,1,2,3,4],[0,5,6,7,8],[5,9,10,11,12],[9,13,14,15,16],[13,17,18,19,20],[0,17]]){c.beginPath();chain.forEach((i,j)=>{const x=points[i].x*canvas.width,y=points[i].y*canvas.height;j?c.lineTo(x,y):c.moveTo(x,y);});c.stroke();}for(const p of points){c.beginPath();c.arc(p.x*canvas.width,p.y*canvas.height,3,0,Math.PI*2);c.fillStyle='#fff';c.fill();}if(wrist){if(wrist.outline?.length){c.strokeStyle='#c1f1d480';c.lineWidth=2;c.beginPath();wrist.outline.forEach((p,i)=>{const x=p.x*canvas.width,y=p.y*canvas.height;i?c.lineTo(x,y):c.moveTo(x,y);});c.closePath();c.stroke();}c.strokeStyle='#c1f1d4';c.lineWidth=4;c.beginPath();c.moveTo(wrist.elbow.x*canvas.width,wrist.elbow.y*canvas.height);c.lineTo(wrist.wrist.x*canvas.width,wrist.wrist.y*canvas.height);c.stroke();}}
function renderLibrary(){const keys=Object.keys(calibrations);$('library-subtitle').textContent=demo?'Explore with simulated ranges. Demo results are not saved.':keys.length?'Calibrated to you. Choose a game and move at your own pace.':'No movements calibrated yet. Return to setup when you’re ready.';$('range-summary').textContent=`${keys.length} of 5 movements ready${demo?' · Demo':''}`;
 $('calibration-estimate-label').textContent=demo?'Simulated values':'Camera estimates';
 $('calibration-summary-note').textContent='Your two comfortable positions and the span between them. Thumb opposition is a ratio.';
 $('calibration-rows').replaceChildren();
 for(const e of EXERCISES){
  const cal=calibrations[e.id],row=document.createElement('tr'),name=document.createElement('th'),method=document.createElement('small');
  name.setAttribute('scope','row');name.textContent=e.name;method.textContent=e.unit==='×'?'Gap / palm length':e.wrist?'Camera-plane angle':e.id==='curl'?'Mean PIP flexion':'Finger spread angle';name.append(method);row.append(name);
  for(const [number,label] of [[cal?.a,'First'],[cal?.b,'Second'],[cal?Math.abs(cal.b-cal.a):null,'Span']]){
   const cell=document.createElement('td');cell.textContent=!cal&&label==='Span'?'Skipped':fmt(number,e);cell.setAttribute('data-label',label);if(!cal)cell.className='uncaptured';row.append(cell);
  }
  $('calibration-rows').append(row);
 }
 $('game-cards').replaceChildren();for(const game of GAMES){const e=exerciseById(game.exercise),available=!!calibrations[e.id];const card=document.createElement('article');card.className='game-card'+(!available?' unavailable':'');const art=document.createElement('div');art.className='card-art';art.style.background=game.color;const canvas=document.createElement('canvas');canvas.dataset.preview=game.id;const tag=document.createElement('span');tag.className='card-movement';tag.textContent=e.name;art.append(canvas,tag);const copy=document.createElement('div');copy.className='card-copy';const title=document.createElement('h2');title.textContent=game.name;const description=document.createElement('p');description.textContent=game.description;const foot=document.createElement('div');foot.className='card-footer';const range=document.createElement('span');range.textContent=available?`${fmt(Math.abs(calibrations[e.id].b-calibrations[e.id].a),e)} calibrated span`: 'Calibrate this movement to play';const button=document.createElement('button');button.textContent='↗';button.setAttribute('aria-label','Play '+game.name);button.disabled=!available;button.onclick=()=>startGame(game.id);foot.append(range,button);copy.append(title,description,foot);card.append(art,copy);$('game-cards').append(card);}
}
function drawCards(){document.querySelectorAll('[data-preview]').forEach(canvas=>{const g=gameById(canvas.dataset.preview),state=new Adventure(g);state.collected=g.id==='stars'?3:0;state.phase='charge';state.progress=.45;state.elapsed=1;renderAdventure(canvas,state,{preview:true,reduced:true});});}
$('recalibrate').onclick=()=>{beginCalibration(demo);if(!demo&&!ready)connectCamera();};
function startGame(id){const game=gameById(id);const e=exerciseById(game.exercise);if(!calibrations[e.id])return;activeExercise=e;resetMeasurement();adventure=new Adventure(game,{target:$('gentle').checked?.7:.85,duration:Number($('duration').value)});session={game:id,exercise:e.id,date:new Date().toISOString(),hand:$('hand').value,demo,target:adventure.target,cal:{...calibrations[e.id]},min:Infinity,max:-Infinity,samples:0};counter.reset();paused=false;$('arcade-view').dataset.game=id;$('arcade-title').textContent=game.name;$('arcade-exercise').textContent=e.name;$('goal-label').textContent=adventure.goalLabel;$('score').textContent='0';$('goal-progress').textContent=`0 / ${adventure.goal}`;$('demo-controls').hidden=!demo;$('game-demo-label').hidden=!demo;$('demo-slider').value='0';$('demo-hint').textContent=game.mechanic==='cycle'?'Go to the right end, hold briefly, then return to the left.':'Slide to line up with the ring or lantern, then hold.';$('game-camera-host').append($('camera-shell'));$('game-camera-host').hidden=demo;$('game-mask').hidden=true;$('pause').textContent='Pause';show('arcade');if(e.wrist&&!demo)worker?.postMessage({type:'reset-forearm'});if(!ready&&!demo)cameraFailure('Camera is off. Return to setup to reconnect and recalibrate.');}
function showMask(){const needsResume=paused;$('game-mask').hidden=!(needsResume||!valid);$('resume').hidden=!needsResume;$('mask-icon').textContent=needsResume?'Ⅱ':'◉';$('mask-title').textContent=needsResume?'A little breather.':'Let’s find your movement.';$('mask-detail').textContent=needsResume?'Resume whenever you’re ready.':issue;$('pause').textContent=needsResume?'Resume':'Pause';}
$('pause').onclick=()=>{if(!session)return;paused=!paused;adventure.pause();counter.dwell=0;showMask();};$('resume').onclick=()=>{paused=false;showMask();};$('finish').onclick=()=>finishSession();$('leave-game').onclick=()=>{if(session)finishSession();renderLibrary();show('library');};
function finishSession(){if(!session)return;const s={...session,score:adventure.score,collected:adventure.collected,goal:adventure.goal,elapsed:adventure.elapsed,reps:counter.count,min:Number.isFinite(session.min)?session.min:null,max:Number.isFinite(session.max)?session.max:null,range:Number.isFinite(session.min)?session.max-session.min:null,unit:activeExercise.unit};let saved=false;const best=history.filter(h=>h.game===s.game).reduce((n,h)=>Math.max(n,h.score),0);
 $('result-calibration-title').textContent=activeExercise.name+' · '+(s.demo?'simulated calibration':'your calibration');
 $('result-cal-first').textContent=fmt(s.cal.a);$('result-cal-second').textContent=fmt(s.cal.b);$('result-cal-span').textContent=fmt(Math.abs(s.cal.b-s.cal.a));
 if(!s.demo&&s.samples>0){history.unshift(s);history=history.slice(0,200);try{localStorage.setItem('handpt-project.sessions.v2',JSON.stringify(history.filter(s=>!s.legacy)));saved=true;}catch{toast('Storage is unavailable. Export your session CSV before closing the page.');}}
 $('result-title').textContent=s.collected>=s.goal?'Adventure complete.':s.collected>0?'Lovely moves.':'At your own pace.';$('result-message').textContent=s.collected>=s.goal?gameById(s.game).goal+' — beautifully done.':`${s.collected} ${adventure.goalLabel.toLowerCase()} collected in ${Math.round(s.elapsed)} active seconds.`;$('result-score').textContent=s.score;$('result-moves').textContent=s.reps;$('result-range').textContent=fmt(s.range);$('result-medal').textContent=s.collected>=s.goal?'✦':s.collected>0?'✧':'♡';$('save-note').textContent=s.demo?'Demo only · Simulated measurements, not saved.':saved?(s.score>best?'A new personal best. ':'')+'Saved on this device.':s.samples===0?'No valid measurements captured. No session saved.':'Kept in memory. Export CSV before closing the page.';session=null;paused=false;$('setup-camera-host').append($('camera-shell'));show('result');chime('finish');}
$('play-again').onclick=()=>{renderLibrary();show('library');};
function updateGame(dt){if(!session)return;if(demo){valid=true;const c=calibrations[activeExercise.id];value=c.a+(c.b-c.a)*Number($('demo-slider').value)/100;session.samples++;session.min=Math.min(session.min,value);session.max=Math.max(session.max,value);}const usable=valid&&!paused&&!document.hidden;showMask();if(usable){const p=progress(value,calibrations[activeExercise.id]);const event=adventure.update(p,dt);counter.update(clamp(p/adventure.target),dt);if(event)chime(event);$('charge-fill').style.width=`${adventure.game.mechanic==='cycle'?adventure.progress*100:clamp(adventure.hold/.55)*100}%`;}
 $('score').textContent=adventure.score;$('goal-progress').textContent=`${adventure.collected} / ${adventure.goal}`;$('time').textContent=timeLabel(Math.max(0,adventure.duration-adventure.elapsed));$('game-instruction').textContent=adventure.instruction;$('live-metric').textContent=`${activeExercise.measure}: ${valid?fmt(value):'—'}${activeExercise.wrist?' · Camera plane':''}`;$('session-reps').textContent=`${counter.count} complete movements`;
 renderAdventure($('game-canvas'),adventure,{reduced});if(adventure.complete)finishSession();}
function timeLabel(seconds){const n=Math.ceil(seconds);return `${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`;}
function loop(now){const dt=clamp((now-previous)/1000,0,.08);previous=now;
 if(ready&&!busy&&!document.hidden&&['setup','arcade'].includes(view)&&$('video').readyState>=2&&$('video').currentTime!==lastVideo&&now-lastSend>=50){lastVideo=$('video').currentTime;lastSend=now;busy=true;lastFrameRequest=now;const current=generation;createImageBitmap($('video')).then(frame=>{if(current===generation&&worker)worker.postMessage({type:'frame',frame,time:now,wrist:!!activeExercise?.wrist},[frame]);else frame.close();}).catch(()=>{if(current===generation)busy=false;valid=false;});}
 if(busy&&now-lastFrameRequest>12000)cameraFailure('Tracking stopped responding. Return to setup to retry.');
 if(!demo&&valid&&now-lastResult>450){valid=false;filtered=null;issue='Tracking paused. Keep your hand in view.';$('camera-quality').textContent=issue;flow?.pause();adventure?.pause();counter.dwell=0;}
 if(view==='welcome')renderWelcome($('welcome-canvas'),reduced?0:now/1000);
 if(view==='setup'&&flow&&!flow.done){if(demo&&!setupPaused&&!document.hidden){const e=flow.exercise;const v=e.demo[flow.endpoint];valid=true;value=v;const index=flow.index;flow.update(v,dt,now,0);if(flow.index!==index){chime('step');updateStep();}}renderSetup();if(!flow.done)renderGuide($('guide-canvas'),flow.exercise,{stage:flow.stage,elapsed:flow.elapsed,duration:flow.duration,time:now/1000,reduced});}
 if(view==='arcade')updateGame(dt);requestAnimationFrame(loop);
}
$('sound').onclick=()=>{soundEnabled=!soundEnabled;$('sound').setAttribute('aria-pressed',String(soundEnabled));$('sound').setAttribute('aria-label',soundEnabled?'Disable game sound':'Enable game sound');$('sound').querySelector('span').textContent=soundEnabled?'Sound on':'Sound off';if(soundEnabled){const Audio=window.AudioContext||window.webkitAudioContext;if(Audio){audio??=new Audio();audio.resume?.();chime('step');}else{soundEnabled=false;toast('Sound is unavailable in this browser.');}}};
function chime(event){if(!soundEnabled||!audio||document.hidden)return;const notes=event==='collected'?[523,659,784]:event==='finish'?[523,659,784,1047]:event==='charged'?[440,554]:[523];for(let i=0;i<notes.length;i++){const o=audio.createOscillator(),g=audio.createGain(),t=audio.currentTime+i*.09;o.type='sine';o.frequency.value=notes[i];g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.045,t+.015);g.gain.exponentialRampToValueAtTime(.001,t+.22);o.connect(g);g.connect(audio.destination);o.start(t);o.stop(t+.25);}}
function openAux(next){if(view===next)return;returnView=view;if(session){paused=true;adventure.pause();counter.dwell=0;}if(flow&&view==='setup'){setupPaused=true;flow.pause();$('pause-setup').textContent='Resume setup';}show(next);if(next==='history')renderHistory();}
$('progress-link').onclick=()=>openAux('history');$('about-link').onclick=()=>openAux('about');$('history-back').onclick=$('about-back').onclick=()=>show(returnView);
$('home-link').onclick=e=>{e.preventDefault();if(session)finishSession();if(flow&&view==='setup'){setupPaused=true;flow.pause();}stopCamera();flow=null;show('welcome');};
function renderHistory(){$('history-list').replaceChildren();if(!history.length){const node=document.createElement('div');node.className='empty-history';node.textContent='Your first adventure is waiting. Camera sessions will appear here.';$('history-list').append(node);return;}for(const s of history){const card=document.createElement('article');card.className='history-row';const a=document.createElement('div'),b=document.createElement('div'),h=document.createElement('h3'),p=document.createElement('p'),score=document.createElement('h3'),detail=document.createElement('p');h.textContent=recordGameName(s);p.textContent=new Date(s.date).toLocaleString()+' · '+recordExercise(s).name;score.textContent=s.legacy?'Previous session':s.score+' points';detail.textContent=`${s.reps} movements · ${Math.round(s.elapsed)}s · ${fmt(s.range,recordExercise(s))} range`;a.append(h,p);b.append(score,detail);card.append(a,b);$('history-list').append(card);}}
$('export').onclick=()=>{if(!history.length){toast('Complete a camera session to export your progress.');return;}const keys=['date','game','exercise','hand','score','collected','elapsed','reps','min','max','range','unit','calibration_a','calibration_b','target'];const rows=history.map(s=>({...s,calibration_a:s.cal?.a,calibration_b:s.cal?.b}));const csv=[keys.join(','),...rows.map(s=>keys.map(k=>'"'+String(s[k]??'').replaceAll('"','""')+'"').join(','))].join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download='handpt-project-sessions.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('clear-history').onclick=()=>{if(history.length&&confirm('Delete all session summaries stored in this browser?')){history=[];try{localStorage.removeItem('handpt-project.sessions.v2');localStorage.removeItem('handpt-project.sessions.v1');}catch{}renderHistory();}};
for(const [i,e] of EXERCISES.entries()){const article=document.createElement('article');article.className='exercise-info';const h=document.createElement('h2'),p=document.createElement('p'),a=document.createElement('a');h.textContent=`0${i+1} · ${e.name}`;p.textContent=e.description;a.textContent=e.id==='curl'?'ASSH exercise guidance ↗':'NHS exercise guidance ↗';a.href=e.source;a.target='_blank';a.rel='noopener';article.append(h,p,a);$('exercise-list').append(article);}
document.addEventListener('visibilitychange',()=>{if(document.hidden){resetMeasurement();flow?.pause();adventure?.pause();if(session)paused=true;if(view==='setup'){setupPaused=true;$('pause-setup').textContent='Resume setup';}}});
window.addEventListener('resize',()=>{if(view==='library')drawCards();});window.addEventListener('pagehide',()=>{stream?.getTracks().forEach(t=>t.stop());worker?.terminate();});
requestAnimationFrame(loop);
