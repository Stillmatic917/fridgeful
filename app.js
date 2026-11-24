import{findTimes,fmt,clock,has,rank,fromMeal,fromWiki,splitSteps,staple}from'./lib.js';
const $=s=>document.querySelector(s),view=$('#view'),dlg=$('#dlg');
function h(tag,props={},...kids){
 const e=document.createElement(tag);
 for(const[k,v]of Object.entries(props)){
  if(v==null||v===false)continue;
  if(k.startsWith('on'))e.addEventListener(k.slice(2),v);
  else if(k in e)e[k]=v;
  else e.setAttribute(k,v===true?'':v);
 }
 e.append(...kids.flat().filter(x=>x!=null&&x!==false));
 return e;
}
const store={
 get:(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}},
 set:(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true}catch{alert('This phone’s browser could not save. Check that you are not in a private window.');return false}}
};
const isIOS=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const fresh=()=>({photo:null,found:[],busy:false,progress:0,results:null,error:''});
let saved=store.get('saved',[]),state=fresh(),tab='scan',token=0;
const save=()=>store.set('saved',saved);

/* ---------- navigation ---------- */
const go=hash=>{location.hash=hash};
window.addEventListener('hashchange',route);
function route(){
 const[p,id,step]=location.hash.slice(1).split('/');
 const r=saved.find(x=>x.id===decodeURIComponent(id||''));
 if(dlg.open)dlg.close();
 wake(p==='cook');
 if(p==='recipe'&&r)recipe(r);
 else if(p==='cook'&&r&&r.steps.length)cook(r,+step||0);
 else if(p==='saved'){tab='saved';savedView()}
 else if(p==='results'&&state.results){tab='scan';results()}
 else{tab='scan';scan()}
 scrollTo(0,0);
}
const show=(...k)=>view.replaceChildren(...k.flat().filter(Boolean));
function tabs(on=true){
 const items=[['scan','Find recipes'],['saved','Saved'+(saved.length?` (${saved.length})`:'')]];
 $('#tabs').replaceChildren(...(on?items.map(([k,t])=>h('button',{onclick:()=>go(k),'aria-current':tab===k?'page':null},t)):[]));
}

/* ---------- photo to ingredients ---------- */
let worker;
function pickInput(label,cam){
 const i=h('input',{type:'file',accept:'image/*',className:'sr',multiple:!cam,onchange:e=>{const f=[...e.target.files];if(f.length)scanFiles(f)}});
 if(cam)i.setAttribute('capture','environment');
 return h('label',{className:'btn '+(cam?'pri':'')},label,i);
}
function scan(){
 tabs();
 const on=state.found.filter(f=>f.on),maybe=state.found.filter(f=>!f.on);
 const add=h('input',{placeholder:'Add an ingredient, e.g. chicken','aria-label':'Add an ingredient',enterKeyHint:'done',autocapitalize:'none'});
 const chip=f=>h('button',{className:'chip'+(f.on?'':' off'),'aria-pressed':String(f.on),onclick:()=>{f.on=!f.on;scan()}},(f.on?'✓ ':'+ ')+f.name);
 const submit=e=>{
  e.preventDefault();
  for(const n of add.value.split(',').map(s=>s.trim().toLowerCase()).filter(Boolean)){
   const f=state.found.find(x=>x.name===n);
   if(f)f.on=true;else state.found.push({name:n,on:true});
  }
  scan();view.querySelector('form input').focus();
 };
 show(
  h('h1',{},'What’s in the kitchen?'),
  h('div',{className:'drop'},
   state.photo?h('img',{src:state.photo,alt:'Your ingredients'}):h('p',{className:'mut'},'Lay ingredients out with a little space between them. Photos stay on your phone.'),
   h('div',{className:'row',style:'margin-top:14px'},pickInput('Take photo',true),pickInput('Upload images',false)),
   state.busy&&h('p',{className:'mut',id:'status'},'Looking for ingredients…'),
   state.busy&&h('progress',{id:'bar',max:1,value:state.progress,'aria-label':'Scanning photo'})),
  state.error&&h('p',{className:'err',role:'alert'},state.error),
  state.found.length>0&&h('h2',{},'Your ingredients'),
  on.length>0&&h('p',{className:'mut'},'Tap any that are wrong to remove them.'),
  h('div',{className:'chips'},on.map(chip)),
  maybe.length>0&&h('p',{className:'mut'},'Not sure about these. Tap to add:'),
  maybe.length>0&&h('div',{className:'chips'},maybe.map(chip)),
  h('form',{className:'row add',onsubmit:submit},add,h('button',{},'Add')),
  h('button',{className:'pri wide',disabled:!on.length||state.busy||state.searching,onclick:search},state.searching?'Searching…':on.length?`Find recipes with ${on.length} ingredient${on.length>1?'s':''}`:'Find recipes'),
  state.found.length>0&&!state.busy&&h('button',{className:'link',onclick:()=>{token++;state=fresh();scan()}},'Start over'));
}
async function tilesFrom(file){
 const url=URL.createObjectURL(file),img=new Image();img.src=url;
 try{await img.decode()}catch{URL.revokeObjectURL(url);throw Error('That image could not be opened. Try a JPEG or PNG.')}
 const k=Math.min(1,1280/Math.max(img.naturalWidth,img.naturalHeight)),w=Math.round(img.naturalWidth*k),ht=Math.round(img.naturalHeight*k);
 const c=h('canvas',{width:w,height:ht});c.getContext('2d').drawImage(img,0,0,w,ht);
 const sh=Math.min(w,ht),boxes=[[(w-sh)/2,(ht-sh)/2,sh]];
 for(const q of[.62,.42]){
  const t=sh*q,n=d=>Math.min(q<.5?5:4,Math.max(2,Math.ceil(d/(t*.85)))),nx=n(w),ny=n(ht);
  for(let y=0;y<ny;y++)for(let x=0;x<nx;x++)boxes.push([(w-t)*x/(nx-1),(ht-t)*y/(ny-1),t]);
 }
 const o=h('canvas',{width:256,height:256}),g=o.getContext('2d',{willReadFrequently:true});g.imageSmoothingQuality='high';
 return{url,tiles:boxes.map(([x,y,t])=>{g.drawImage(c,x,y,t,t,0,0,256,256);return g.getImageData(0,0,256,256).data.buffer})};
}
function runWorker(tiles){
 worker??=new Worker('scan-worker.js',{type:'module'});
 return new Promise((ok,no)=>{
  worker.onmessage=({data:d})=>{
   if(d.type==='done')return ok(d.found);
   if(d.type==='error')return no(Error('Scanning failed: '+d.message+'. You can type ingredients instead.'));
   state.progress=d.p;
   const b=$('#bar'),s=$('#status');
   if(b)b.value=d.p;
   if(s)s.textContent=d.p?`Looking for ingredients… ${Math.round(d.p*100)}%`:'Getting the scanner ready (the first time downloads about 35 MB)…';
  };
  worker.onerror=()=>{worker=null;no(Error('This browser could not run the scanner. You can type ingredients instead.'))};
  worker.postMessage({tiles},tiles);
 });
}
async function scanFiles(files){
 if(state.busy)return;
 state.busy=true;state.error='';state.progress=0;
 try{
  const got=[];for(const f of files.slice(0,6))got.push(await tilesFrom(f));
  if(state.photo)URL.revokeObjectURL(state.photo);
  state.photo=got[0].url;got.slice(1).forEach(g=>URL.revokeObjectURL(g.url));
  scan();
  const found=await runWorker(got.flatMap(g=>g.tiles));
  for(const{name,p}of found.slice(0,18))if(!state.found.some(x=>x.name===name))state.found.push({name,on:p>=.6});
  if(!found.length)state.error='I couldn’t recognize anything. Try a closer, brighter photo, or type ingredients below.';
 }catch(e){state.error=e.message}
 state.busy=false;
 if(['','#scan'].includes(location.hash))scan();
}

/* ---------- recipe search ---------- */
async function json(u){
 const c=new AbortController(),t=setTimeout(()=>c.abort(),20000);
 try{const r=await fetch(u,{signal:c.signal});if(!r.ok)throw Error(r.status);return await r.json()}finally{clearTimeout(t)}
}
async function meals(){
 const C='caches'in window?await caches.open('meals'):null,key='https://meals.local/all';
 const m=C&&await C.match(key);
 if(m){const d=await m.json();if(Date.now()-d.at<7*864e5)return d.list}
 const got=[],q=[...'abcdefghijklmnopqrstuvwxyz'];let fails=0;
 await Promise.all(Array.from({length:4},async()=>{
  while(q.length){const l=q.shift();try{got.push(...((await json('https://www.themealdb.com/api/json/v1/1/search.php?f='+l)).meals||[]))}catch{fails++}}
 }));
 if(!got.length)throw Error('TheMealDB unavailable');
 const list=got.map(fromMeal);
 if(C&&!fails)await C.put(key,new Response(JSON.stringify({at:Date.now(),list}))).catch(()=>{});
 return list;
}
async function wiki(foods){
 const run=async q=>{
  const u='https://en.wikibooks.org/w/api.php?'+new URLSearchParams({action:'query',generator:'search',gsrsearch:q+' incategory:Recipes',gsrnamespace:102,gsrlimit:30,prop:'revisions|pageimages',rvprop:'content',rvslots:'main',piprop:'thumbnail',pithumbsize:480,pilimit:'max',format:'json',formatversion:2,origin:'*'});
  return((await json(u)).query?.pages||[]).map(fromWiki).filter(Boolean);
 };
 const main=foods.filter(f=>!staple(f)),t=(main.length?main:foods).slice(0,6).map(f=>`"${f.replace(/["\\]/g,'')}"`);
 const[a,b]=await Promise.all([run(t.slice(0,3).join(' ')),run('('+t.join(' OR ')+')')]);
 return[...new Map([...a,...b].map(r=>[r.id,r])).values()];
}
async function search(){
 const foods=state.found.filter(f=>f.on).map(f=>f.name),my=++token;
 state.searching=true;state.error='';scan();
 const rs=await Promise.allSettled([meals(),wiki(foods)]);
 if(my!==token)return;
 state.searching=false;
 const failed=rs.map((r,i)=>r.status==='rejected'&&['TheMealDB','Wikibooks'][i]).filter(Boolean);
 if(failed.length===2){state.error='Couldn’t reach the recipe sites. Check your connection and try again.';if(['','#scan'].includes(location.hash))scan();return}
 state.results={foods,failed,list:rank(rs.flatMap(r=>r.value||[]),foods)};
 if(['','#scan'].includes(location.hash))go('results');
}
const noPic=()=>h('span',{className:'ph','aria-hidden':'true'},'🍽');
const pic=r=>r.image?h('img',{className:'ph',src:r.image,alt:'',loading:'lazy',onerror:e=>e.target.replaceWith(noPic())}):noPic();
const card=(r,sub)=>h('button',{className:'card',onclick:()=>choose(r)},pic(r),h('div',{},h('b',{},r.title),sub,h('span',{className:'mut'},r.source)));
function choose(r){
 if(!saved.some(x=>x.id===r.id)){
  const{used,missing,score,...clean}=r;
  saved.unshift({...clean,savedAt:Date.now()});
  if(!save()){saved.shift();return}
  navigator.storage?.persist?.();
 }
 go('recipe/'+encodeURIComponent(r.id));
}
function results(){
 tabs();
 const{list,foods,failed}=state.results;
 show(
  h('button',{className:'link',onclick:()=>go('scan')},'‹ Ingredients'),
  h('h1',{},list.length?`${list.length} recipes to choose from`:'No matches yet'),
  h('p',{className:'mut'},list.length?'Best matches first. Tapping one saves it.':'Try fewer or simpler ingredient names.'),
  failed.length>0&&h('p',{className:'err'},failed[0]+' didn’t respond, so some recipes may be missing.'),
  list.map(r=>card(r,h('p',{className:'mut'},`Uses ${r.used.join(', ')}`,h('br'),r.missing?`${r.missing} other ingredient${r.missing>1?'s':''} needed`:'You have everything'))),
  h('h2',{},'Want more?'),
  h('a',{className:'btn wide',target:'_blank',rel:'noopener',href:'https://www.google.com/search?q='+encodeURIComponent('recipes with '+foods.join(' '))},'Search the whole web'),
  h('button',{className:'wide',onclick:importView},'Paste in a recipe'));
}
function importView(){
 const t=h('input',{required:true}),i=h('textarea',{rows:5,required:true}),s=h('textarea',{rows:7,required:true});
 const submit=e=>{
  e.preventDefault();
  const lines=i.value.split('\n').map(x=>x.trim().replace(/^[▢•*-]\s*/,'')).filter(Boolean),steps=splitSteps(s.value);
  if(!t.value.trim()||!lines.length||!steps.length)return alert('Fill in a name, at least one ingredient and one step.');
  dlg.close();
  choose({id:'p'+Date.now(),title:t.value.trim(),image:'',source:'Added by you',url:'',ingredients:lines.map(name=>({name,measure:''})),steps});
 };
 dlg.replaceChildren(h('form',{onsubmit:submit},h('h1',{},'Paste a recipe'),h('label',{className:'f'},'Name',t),h('label',{className:'f'},'Ingredients, one per line',i),h('label',{className:'f'},'Steps, one per line',s),h('button',{className:'pri wide'},'Save recipe'),h('button',{type:'button',className:'wide',onclick:()=>dlg.close()},'Cancel')));
 dlg.showModal();
}

/* ---------- saved recipes ---------- */
function exportAll(){
 const u=URL.createObjectURL(new Blob([JSON.stringify(saved)],{type:'application/json'}));
 h('a',{href:u,download:'fridgeful-recipes.json'}).click();
 setTimeout(()=>URL.revokeObjectURL(u),9000);
}
async function importBackup(e){
 try{
  const d=JSON.parse(await e.target.files[0].text()),str=x=>typeof x==='string';
  const ok=d.filter(r=>str(r?.id)&&str(r.title)&&Array.isArray(r.ingredients)&&r.ingredients.every(i=>str(i?.name))&&Array.isArray(r.steps)&&r.steps.every(str)&&!saved.some(x=>x.id===r.id))
   .map(r=>({id:r.id,title:r.title,source:str(r.source)?r.source:'Imported',ingredients:r.ingredients.map(i=>({name:i.name,measure:str(i.measure)?i.measure:''})),steps:r.steps,image:/^https:/.test(r.image)?r.image:'',url:/^https?:/.test(r.url)?r.url:''}));
  saved.push(...ok);save();savedView();
 }catch{alert('That isn’t a Fridgeful backup file.')}
}
function savedView(){
 tabs();
 show(
  h('h1',{},'Saved recipes'),
  saved.length?saved.map(r=>card(r,r.step?h('p',{className:'mut'},`Cooking: step ${r.step+1} of ${r.steps.length}`):null)):h('p',{className:'mut'},'Recipes you choose are kept here, and their text works offline.'),
  h('button',{className:'wide',onclick:importView},'Paste in a recipe'),
  h('button',{className:'wide',onclick:()=>timerSettings()},'Timer settings'),
  h('h2',{},'Backup'),h('p',{className:'mut'},'Recipes live only on this phone. Save a copy now and then.'),
  h('div',{className:'row'},h('button',{disabled:!saved.length,onclick:exportAll},'Export'),h('label',{className:'btn'},'Import',h('input',{type:'file',accept:'.json,application/json',className:'sr',onchange:importBackup}))));
}

/* ---------- recipe and cooking ---------- */
const measured=i=>[i.measure,i.name].filter(Boolean).join(' ');
function ingList(r){
 return h('ul',{className:'ing'},r.ingredients.map((i,n)=>h('li',{},h('label',{},
  h('input',{type:'checkbox',checked:(r.checked||[]).includes(n),onchange:e=>{r.checked=(r.checked||[]).filter(x=>x!==n);if(e.target.checked)r.checked.push(n);save()}}),
  h('span',{},i.measure?h('b',{},i.measure+' '):null,i.name)))));
}
function withTimers(text,label){
 const out=[];let at=0;
 for(const t of findTimes(text)){
  out.push(text.slice(at,t.index),h('button',{className:'time',onclick:()=>startTimer(t.seconds,label),'aria-label':`Start ${fmt(t.seconds)} timer`},'⏱ '+text.slice(t.index,t.index+t.length)));
  at=t.index+t.length;
 }
 out.push(text.slice(at));return out;
}
function recipe(r){
 tabs();
 show(
  h('button',{className:'link',onclick:()=>go(state.results&&tab==='scan'?'results':'saved')},'‹ Back'),
  r.image&&h('img',{className:'hero',src:r.image,alt:r.title,onerror:e=>e.target.remove()}),
  h('h1',{},r.title),
  h('p',{className:'mut'},'Saved ✓ · ',r.url?h('a',{href:r.url,target:'_blank',rel:'noopener',style:'color:inherit'},r.source):r.source,r.source.startsWith('Wikibooks')?' (CC BY-SA)':null),
  h('button',{className:'pri wide',disabled:!r.steps.length,onclick:()=>go(`cook/${encodeURIComponent(r.id)}/${r.step||0}`)},r.step?`Continue at step ${r.step+1}`:'Start cooking'),
  h('h2',{},'Ingredients'),ingList(r),
  h('h2',{},'Steps'),h('ol',{className:'steps'},r.steps.map(s=>h('li',{},withTimers(s,r.title)))),
  h('button',{className:'link err',onclick:()=>{if(confirm(`Remove “${r.title}” from saved recipes?`)){saved=saved.filter(x=>x!==r);save();go('saved')}}},'Remove from saved'));
}
function cook(r,n){
 n=Math.min(Math.max(0,n),r.steps.length-1);r.step=n;save();tabs(false);
 const text=r.steps[n],last=n===r.steps.length-1,url=`cook/${encodeURIComponent(r.id)}/`;
 const need=r.ingredients.filter(i=>{const key=i.name.replace(/^[\d\s/½¼¾⅓⅔.,-]+(?:(?:cups?|tbsp|tsp|g|kg|ml|oz|lb)\b)?/i,'').replace(/[(,].*/,'').trim();return key&&has(text,key)});
 const move=d=>{history.replaceState(null,'','#'+url+(n+d));cook(r,n+d);scrollTo(0,0)};
 const big=s=>h('button',{className:'time big',onclick:()=>startTimer(s,r.title)},`⏱ Start ${fmt(s)} timer`);
 const finish=()=>{r.step=0;r.checked=[];save();go('recipe/'+encodeURIComponent(r.id))};
 const list=()=>{dlg.replaceChildren(h('h1',{},'Ingredients'),ingList(r),h('button',{className:'pri wide',onclick:()=>dlg.close()},'Done'));dlg.showModal()};
 show(
  h('div',{className:'row',style:'justify-content:space-between'},h('button',{className:'link',style:'flex:none',onclick:()=>go('recipe/'+encodeURIComponent(r.id))},'✕ Close'),h('button',{className:'link',style:'flex:none',onclick:list},'Ingredients')),
  h('progress',{max:r.steps.length,value:n+1,'aria-label':'Recipe progress'}),
  h('p',{className:'mut'},`Step ${n+1} of ${r.steps.length}`),
  h('section',{className:'cook'},
   h('p',{},text),
   findTimes(text).flatMap(t=>t.max?[big(t.seconds),big(t.max)]:[big(t.seconds)]),
   need.length>0&&h('p',{className:'mut',style:'margin-top:18px'},'For this step: '+need.map(measured).join(' · ')),
   h('button',{className:'link',onclick:()=>customTimer(r.title)},'Set another timer')),
  h('div',{className:'cookbar'},h('button',{disabled:!n,onclick:()=>move(-1)},'Back'),h('button',{className:'pri',onclick:()=>last?finish():move(1)},last?'Finish':'Next step')));
}
function customTimer(label){
 const i=h('input',{type:'number',inputMode:'decimal',min:'0.1',max:'1440',step:'any',required:true});
 dlg.replaceChildren(h('form',{onsubmit:e=>{e.preventDefault();dlg.close();startTimer(Math.round(i.value*60),label)}},h('label',{className:'f'},'Minutes',i),h('button',{className:'pri wide'},'Start timer'),h('button',{type:'button',className:'wide',onclick:()=>dlg.close()},'Cancel')));
 dlg.showModal();
}

/* ---------- timers ---------- */
const NAME='Fridgeful Timer';
const runShortcut=s=>h('a',{href:`shortcuts://run-shortcut?name=${encodeURIComponent(NAME)}&input=text&text=${s}`}).click();
function startTimer(s,label){
 unlock();
 const mode=store.get('timerMode',null);
 if(isIOS&&!mode)return timerSettings(()=>startTimer(s,label));
 if(isIOS&&mode==='phone')return runShortcut(s);
 appTimer(s,label);
}
function timerSettings(then){
 const pick=m=>{store.set('timerMode',m);dlg.close();then?.()};
 const ios=()=>[
  h('h1',{},'Use your iPhone’s timer'),
  h('p',{},'Set this up once. iOS only lets web apps start the Clock timer through a Shortcut.'),
  h('ol',{},h('li',{},'Open the Shortcuts app and tap +.'),h('li',{},'Rename the shortcut to exactly ',h('b',{},NAME),'.'),h('li',{},'Add the action ',h('b',{},'Start Timer'),'.'),h('li',{},'Long-press its number, choose ',h('b',{},'Shortcut Input'),', and set the unit to ',h('b',{},'seconds'),'. Then tap Done.')),
  h('a',{className:'btn wide',href:'shortcuts://create-shortcut'},'Open Shortcuts'),
  h('button',{className:'wide',onclick:()=>runShortcut(10)},'Test with 10 seconds'),
  h('button',{className:'pri wide',onclick:()=>pick('phone')},'It works: use iPhone timer'),
  h('button',{className:'wide',onclick:()=>pick('app')},'Use timers inside this app')];
 const other=()=>[
  h('h1',{},'Timers'),
  h('p',{},'Android doesn’t let web apps add to the Clock app, so timers ring inside Fridgeful. Keep it open with the volume up.'),
  'Notification'in window&&h('button',{className:'pri wide',onclick:async e=>{const b=e.currentTarget,p=await Notification.requestPermission();b.textContent=p==='granted'?'Notifications on':'Notifications are blocked'}},Notification.permission==='granted'?'Notifications on':'Turn on notifications')];
 dlg.replaceChildren(...(isIOS?ios():other()).filter(Boolean),h('button',{className:'link wide',onclick:()=>dlg.close()},'Close'));
 dlg.showModal();
}
let timers=store.get('timers',[]),ac,beepAt=0;
function unlock(){try{ac??=new(window.AudioContext||window.webkitAudioContext)();if(ac.state!=='running')ac.resume()}catch{}}
function beep(){
 navigator.vibrate?.([200,100,200]);
 if(!ac)return;
 for(const t of[0,.2,.4]){
  const o=ac.createOscillator(),g=ac.createGain(),at=ac.currentTime+t;
  o.frequency.value=880;g.gain.setValueAtTime(.35,at);g.gain.exponentialRampToValueAtTime(.001,at+.16);
  o.connect(g).connect(ac.destination);o.start(at);o.stop(at+.17);
 }
}
function appTimer(s,label){timers.push({id:Date.now()+'-'+timers.length,end:Date.now()+s*1000,label});store.set('timers',timers);drawTimers();wake()}
async function notify(t){
 if(!('Notification'in window)||Notification.permission!=='granted')return;
 try{(await navigator.serviceWorker.ready).showNotification('Timer done',{body:t.label,icon:'icon-192.png',vibrate:[300,100,300],requireInteraction:true,tag:t.id})}catch{}
}
function drawTimers(){
 $('#timers').replaceChildren(...timers.map(t=>h('div',{},h('span',{},h('small',{},t.label),h('span',{className:'left'})),h('button',{onclick:()=>{timers=timers.filter(x=>x!==t);store.set('timers',timers);drawTimers();wake()}},'Stop'))));
 tick();
}
function tick(){
 const now=Date.now();let ring=false;
 timers.forEach((t,i)=>{
  const el=$('#timers').children[i],left=(t.end-now)/1000;
  if(!el)return;
  el.querySelector('.left').textContent=left>0?clock(left):'Done!';
  el.classList.toggle('ring',left<=0);
  if(left<=0){ring=true;if(!t.told){t.told=true;store.set('timers',timers);notify(t)}}
 });
 if(ring&&now-beepAt>1500){beepAt=now;beep()}
}
setInterval(tick,250);
let lock,wantCook=false;
async function wake(c){
 if(c!==undefined)wantCook=c;
 const want=wantCook||timers.length;
 try{
  if(want&&!lock&&document.visibilityState==='visible'){const l=await navigator.wakeLock?.request('screen');if(l){lock=l;l.addEventListener('release',()=>{if(lock===l)lock=null})}}
  else if(!want&&lock){const l=lock;lock=null;await l.release()}
 }catch{}
}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){wake();tick()}});
addEventListener('pointerdown',unlock,{passive:true});
if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
drawTimers();route();
