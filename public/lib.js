// Pure logic: time detection, ingredient matching, recipe parsing. Covered by tools/test.mjs
const FR={'½':.5,'¼':.25,'¾':.75,'⅓':1/3,'⅔':2/3},WN={a:1,an:1,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,fifteen:15,twenty:20,thirty:30,forty:40,sixty:60,half:.5};
const NUM='(?:\\d+\\s*[½¼¾⅓⅔]|\\d+\\s+\\d\\/\\d|\\d+\\/\\d|\\d+(?:\\.\\d+)?|[½¼¾⅓⅔]|\\b(?:'+Object.keys(WN).join('|')+')\\b(?:\\s+and\\s+a\\s+half)?)';
const UNIT='(hours?|hrs?|minutes?|mins?|seconds?|secs?)\\b';
const num=s=>{s=s.trim().toLowerCase();if(/ and a half$/.test(s))return num(s.replace(/ and a half$/,''))+.5;if(s in WN)return WN[s];if(s in FR)return FR[s];
 let m=s.match(/^(\d+)\s*([½¼¾⅓⅔])$/);if(m)return+m[1]+FR[m[2]];m=s.match(/^(?:(\d+)\s+)?(\d+)\/(\d+)$/);if(m)return(+m[1]||0)+m[2]/m[3];return+s};
const sec=u=>/^h/i.test(u)?3600:/^m/i.test(u)?60:1;
export function findTimes(text){
 const re=new RegExp('(?:(half)\\s+an\\s+hour)|('+NUM+')(?:\\s*(?:-|–|—|to|or)\\s*('+NUM+'))?\\s*-?\\s*(?:more\\s+)?'+UNIT+'(?:\\s*(?:,|and)?\\s*('+NUM+')\\s*(minutes?|mins?|seconds?|secs?)\\b)?','gi'),out=[];
 let m;while((m=re.exec(text))){let lo,hi,len=m[0].length;
  // "5 minutes, 2 minutes each side" is two timers; "1 hour 30 minutes" is one
  if(m[5]&&sec(m[6])>=sec(m[4])){len=m[0].slice(0,m[0].lastIndexOf(m[5])).replace(/[\s,]*(and)?\s*$/i,'').length;re.lastIndex=m.index+len;m[5]=null}
  if(m[1])lo=1800;else{lo=num(m[2])*sec(m[4]);hi=m[3]?num(m[3])*sec(m[4]):0;if(m[5]){const x=num(m[5])*sec(m[6]);lo+=x;if(hi)hi+=x}}
  lo=Math.round(lo);hi=Math.round(hi||0);if(lo>=5&&lo<=86400)out.push({index:m.index,length:len,seconds:lo,max:hi>lo&&hi<=86400?hi:0})}
 return out}
export const fmt=s=>{const h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;return[h&&h+' hr',m&&m+' min',x&&x+' sec'].filter(Boolean).join(' ')||'0 sec'};
export const clock=s=>{s=Math.max(0,Math.ceil(s));const h=Math.floor(s/3600),p=n=>String(n).padStart(2,'0');return(h?h+':':'')+(h?p(Math.floor(s%3600/60)):Math.floor(s/60))+':'+p(s%60)};
const SYN={'eggplant':['aubergine'],'zucchini':['courgette'],'cilantro':['coriander'],'spring onion':['scallion','green onion'],'shrimp':['prawn'],'ground beef':['minced beef','beef mince','lean minced','mince beef'],'beetroot':['beet'],'ketchup':['tomato ketchup'],'red bell pepper':['red pepper','bell pepper'],'green bell pepper':['green pepper','bell pepper'],'yellow bell pepper':['yellow pepper','bell pepper'],'chili pepper':['chilli','chili','chile'],'white fish fillet':['white fish','cod','haddock'],'beef steak':['steak','sirloin','rump'],'stewing beef':['beef','beef shin','braising steak'],'canned tomato':['chopped tomato','tinned tomato','diced tomato','plum tomato'],'penne pasta':['penne','pasta'],'cheddar cheese':['cheddar'],'cherry tomato':['cherry tomato','tomato'],'whole chicken':['chicken'],'corn':['sweetcorn'],'lettuce':['little gem'],'rice':['basmati','jasmine rice'],'bok choy':['pak choi']};
const one=w=>w.length<4?w:w.endsWith('ies')?w.slice(0,-3)+'y':/(oes|shes|ches)$/.test(w)?w.slice(0,-2):w.endsWith('ss')||/(us|couscous|hummus|asparagus)$/.test(w)?w:w.endsWith('leaves')?w:w.endsWith('s')?w.slice(0,-1):w;
export const norm=s=>s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z ]/g,' ').split(/\s+/).filter(Boolean).map(one).join(' ');
export const words=n=>{const k=norm(n);return[k,...(SYN[k]||[]).map(norm)]};
// Different foods that merely contain another food's name ("butter" is not "peanut butter")
const NOT={butter:/peanut butter|butter (bean|milk|nut)|butternut/,pepper:/bell pepper/,corn:/corn ?(flour|starch)/,milk:/(coconut|condensed|almond|soy|soya) milk/,cream:/ice cream|cream cheese|sour cream/,rice:/rice (vinegar|wine|noodle|krispie)/,tomato:/tomato (ketchup)/,egg:/egg (plant|noodle|roll)/,chicken:/chicken (stock|broth)/,beef:/beef (stock|broth|gravy)/,orange:/orange blossom/,coconut:/coconut oil/,onion:/(spring|green) onion|onion salt/,ginger:/ginger (ale|beer)/,bread:/breadcrumb/,mustard:/mustard seed/,lemon:/lemon ?grass/};
export const has=(line,food)=>{const l=' '+norm(line)+' ';return words(food).some(w=>{const x=NOT[w]?l.replace(new RegExp(NOT[w].source,'g'),' '):l;return x.includes(' '+w+' ')})};
export const staple=f=>/^(salt|black pepper|pepper|water|sugar|olive oil|oil|vinegar|flour|butter|cinnamon)$/.test(f);
export function rank(recipes,foods,limit=40){
 return recipes.map(r=>{const used=foods.filter(f=>r.ingredients.some(i=>has(i.name,f))),total=r.ingredients.length;
  const missing=r.ingredients.filter(i=>!foods.some(f=>has(i.name,f))).length;return{...r,used,missing,score:used.reduce((n,f)=>n+(staple(f)?2:10),0)+(total?used.length/total*6:0)}})
 .filter(r=>r.used.length).sort((a,b)=>b.score-a.score||a.missing-b.missing).slice(0,limit)}
export function splitSteps(t){
 let p=t.replace(/\r/g,'').split(/\n+/).map(s=>s.trim().replace(/^(?:step\s*)?\d+\s*[.):-]\s+/i,'').replace(/^step\s*\d+\s*[:.-]?\s*/i,'').replace(/^[▢•*-]\s*/,'').trim()).filter(s=>s&&!/^\d+\.?$/.test(s));
 const out=[];for(const s of p){if(s.length<=320){out.push(s);continue}let cur='';for(const x of s.replace(/([.!?])\s+/g,'$1 \n').split('\n')){if(cur&&(cur+x).length>240){out.push(cur.trim());cur=''}cur+=x}if(cur.trim())out.push(cur.trim())}
 return out}
export function fromMeal(m){const ingredients=[];for(let i=1;i<=20;i++){const n=(m['strIngredient'+i]||'').trim();if(n)ingredients.push({name:n,measure:(m['strMeasure'+i]||'').trim()})}
 return{id:'m'+m.idMeal,title:m.strMeal,image:m.strMealThumb||'',source:'TheMealDB',url:/^https?:\/\//.test(m.strSource||'')?m.strSource:'https://www.themealdb.com/meal/'+m.idMeal,ingredients,steps:splitSteps(m.strInstructions||'')}}
const plain=s=>s.replace(/<ref[^>]*\/>|<ref[\s\S]*?<\/ref>|<!--[\s\S]*?-->/g,'').replace(/\{\{\s*(?:convert|cvt)\s*\|([^|}]*)\|([^|}]*)[^}]*\}\}/gi,'$1 $2').replace(/\{\{\s*(?:frac|fraction)\s*\|(\d+)\|(\d+)\|(\d+)\}\}/gi,'$1 $2/$3').replace(/\{\{\s*(?:frac|fraction)\s*\|(\d+)\|(\d+)\}\}/gi,'$1/$2').replace(/\{\{[^{}]*\}\}/g,'').replace(/\[\[(?:File|Image):[^\]]*\]\]/gi,'').replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g,'$1').replace(/\[https?:\S+ ?([^\]]*)\]/g,'$1').replace(/<[^>]+>/g,' ').replace(/'{2,}/g,'').replace(/&nbsp;/g,' ').replace(/&deg;/g,'°').replace(/&frac12;/g,'½').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
export function fromWiki(page){
 const w=page.revisions?.[0]?.slots?.main?.content||'',sec={};let cur='';
 for(const line of w.split('\n')){const h=line.match(/^==\s*([^=].*?)\s*==\s*$/);if(h){cur=h[1].toLowerCase();sec[cur]=[]}else if(cur)sec[cur].push(line)}
 const get=re=>Object.entries(sec).filter(([k])=>re.test(k)).flatMap(([,v])=>v);
 const ingredients=[];for(const l of get(/ingredient/)){if(/^\*/.test(l)){const n=plain(l.replace(/^\*+/,''));if(n)ingredients.push({name:n,measure:''})}else if(/^\|(?![-}+])/.test(l)){const c=plain(l.replace(/^\|+/,'').split('||').join(', '));if(c&&!/^(ingredient|count|volume|weight|total)/i.test(c))ingredients.push({name:c,measure:''})}}
 const steps=get(/procedure|preparation|directions|method|instructions/).filter(l=>/^[#*]/.test(l)||/^[A-Z]/.test(l)).map(l=>plain(l.replace(/^[#*:;]+/,''))).filter(s=>s.length>3);
 return ingredients.length&&steps.length?{id:'w'+page.pageid,title:page.title.replace(/^Cookbook:/,''),image:page.thumbnail?.source||'',source:'Wikibooks Cookbook',url:'https://en.wikibooks.org/wiki/'+encodeURIComponent(page.title.replace(/ /g,'_')),ingredients,steps:steps.flatMap(splitSteps)}:null}
