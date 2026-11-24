import * as ort from './vendor/ort.wasm.min.mjs';
ort.env.wasm.numThreads=1;ort.env.wasm.wasmPaths=new URL('./vendor/',import.meta.url).href;
let ready;
const load=()=>ready??=(async()=>{const[m,f]=await Promise.all([fetch('vendor/vision.onnx').then(r=>{if(!r.ok)throw Error('model download failed');return r.arrayBuffer()}),fetch('foods.json').then(r=>r.json())]);return{s:await ort.InferenceSession.create(m,{executionProviders:['wasm']}),f}})().catch(e=>{ready=null;throw e});
onmessage=async({data:{tiles}})=>{try{
 postMessage({type:'progress',p:0});const{s,f}=await load(),best=new Map();
 for(let n=0;n<tiles.length;n++){const b=new Uint8ClampedArray(tiles[n]),a=new Float32Array(196608);
  for(let i=0;i<65536;i++)for(let c=0;c<3;c++)a[c*65536+i]=b[i*4+c]/255;
  const r=await s.run({[s.inputNames[0]]:new ort.Tensor('float32',a,[1,3,256,256])}),v=r[s.outputNames[0]].data,len=Math.hypot(...v);
  const l=f.vectors.map(u=>{let d=0;for(let i=0;i<v.length;i++)d+=u[i]*v[i];return d/len*100}),M=Math.max(...l),e=l.map(x=>Math.exp(x-M)),S=e.reduce((x,y)=>x+y);
  for(let i=0;i<f.count;i++){const p=e[i]/S;if(p>(best.get(i)||.3))best.set(i,p)}
  postMessage({type:'progress',p:(n+1)/tiles.length})}
 postMessage({type:'done',found:[...best].map(([i,p])=>({name:f.labels[i],p})).sort((a,b)=>b.p-a.p)});
}catch(e){postMessage({type:'error',message:String(e.message||e)})}};
