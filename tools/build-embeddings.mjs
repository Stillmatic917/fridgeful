import {AutoTokenizer,CLIPTextModelWithProjection,env} from '@huggingface/transformers';
import fs from 'fs'; import {FOODS,NEG} from './labels.mjs';
const id='Xenova/mobileclip_s0'; env.cacheDir='./.cache';
const tok=await AutoTokenizer.from_pretrained(id), m=await CLIPTextModelWithProjection.from_pretrained(id,{dtype:'fp32'});
const emb=async t=>(await m(tok(t,{padding:'max_length',truncation:true}))).text_embeds.normalize().tolist();
const T=[x=>`a photo of ${x}`,x=>`a photo of fresh ${x}, a food ingredient`,x=>`a close-up photo of ${x} on a table`];
const out=[];
for(const f of FOODS){const es=await emb(T.map(t=>t(f)));const v=es[0].map((_,i)=>es.reduce((s,e)=>s+e[i],0));const n=Math.hypot(...v);out.push(v.map(x=>+(x/n).toFixed(5)))}
const neg=(await emb(NEG.map(n=>`a photo of ${n}`))).map(v=>v.map(x=>+x.toFixed(5)));
fs.writeFileSync('../public/foods.json',JSON.stringify({labels:FOODS,count:FOODS.length,dim:out[0].length,vectors:[...out,...neg]}));
console.log(FOODS.length,out[0].length,fs.statSync('../public/foods.json').size);
