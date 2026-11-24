import sharp from 'sharp';import * as ort from 'onnxruntime-node';import fs from 'fs';
const F=JSON.parse(fs.readFileSync('../public/foods.json'));
const s=await ort.InferenceSession.create(process.argv[2]);
const D=process.argv[3];
for(const f of fs.readdirSync(D).filter(x=>x.endsWith('.jpg')).sort()){
 const img=sharp(`${D}/${f}`).rotate().removeAlpha().toColourspace('srgb');const {data,info}=await img.raw().toBuffer({resolveWithObject:true});const{width:w,height:h}=info;
 const tiles=[];const sh=Math.min(w,h);tiles.push([(w-sh)>>1,(h-sh)>>1,sh]);
 for(const k of [.62,.4]){const t=Math.round(sh*k),nx=Math.max(2,Math.ceil(w/(t*.75))),ny=Math.max(2,Math.ceil(h/(t*.75)));for(let y=0;y<ny;y++)for(let x=0;x<nx;x++)tiles.push([Math.round((w-t)*x/(nx-1)),Math.round((h-t)*y/(ny-1)),t])}
 const best=new Map();const t0=Date.now();
 for(const[x,y,t]of tiles){const b=await sharp(data,{raw:{width:w,height:h,channels:3}}).extract({left:x,top:y,width:t,height:t}).resize(256,256).raw().toBuffer();
  const a=new Float32Array(3*65536);for(let i=0;i<65536;i++)for(let c=0;c<3;c++)a[c*65536+i]=b[i*3+c]/255;
  const r=await s.run({[s.inputNames[0]]:new ort.Tensor('float32',a,[1,3,256,256])});const v=r[s.outputNames[0]].data;const n=Math.hypot(...v);
  const l=F.vectors.map(u=>{let d=0;for(let i=0;i<v.length;i++)d+=u[i]*v[i];return d/n*100});const M=Math.max(...l);const e=l.map(x=>Math.exp(x-M));const S=e.reduce((a,b)=>a+b);
  e.forEach((p,i)=>{if(i<F.count){p/=S;if(p>.15){const o=best.get(i)||{p:0,n:0};o.p=Math.max(o.p,p);o.n++;best.set(i,o)}}})}
 console.log(f,tiles.length,'tiles',Date.now()-t0+'ms',[...best].sort((a,b)=>b[1].p-a[1].p).map(([i,o])=>F.labels[i]+' '+o.p.toFixed(2)+'x'+o.n).join(', '))}
