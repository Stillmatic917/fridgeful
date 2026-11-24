const C='fridgeful-v2',CORE=['./','index.html','style.css','app.js','lib.js','scan-worker.js','foods.json','manifest.webmanifest','icon-192.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(C).then(c=>c.addAll(CORE.map(u=>new Request(u,{cache:'reload'})))).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x.startsWith('fridgeful-')&&x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==location.origin)return;
 const put=async r=>{if(r.ok){const c=await caches.open(C);await c.put(e.request,r.clone())}return r};
 // big vendor files: cache first. App files: network first, so updates arrive.
 e.respondWith(u.pathname.includes('/vendor/')?caches.match(e.request).then(m=>m||fetch(e.request).then(put)):fetch(e.request.mode==='navigate'?e.request.url:e.request,{cache:'no-cache'}).then(put).catch(()=>caches.match(e.request,{ignoreSearch:true})))});
self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil(clients.matchAll({type:'window'}).then(l=>l[0]?l[0].focus():clients.openWindow('./')))});
