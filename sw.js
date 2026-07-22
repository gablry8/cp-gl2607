const C='climpilot-next-119-statut-filtres';
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(['./','./index.html','./next-theme.css','./next-pro.css','./next-addons.js','./next-regime.js','./next-siren.js','./next-icons.js','./next-statut.js','./manifest.json','./icon-192.png','./icon-512.png'])));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(u.origin!==location.origin||e.request.method!=='GET')return;
  e.respondWith(caches.open(C).then(async c=>{
    try{const r=await fetch(e.request);if(r&&r.ok)c.put(e.request,r.clone());return r;}
    catch(err){const m=await c.match(e.request,{ignoreSearch:true});return m||Response.error();}
  }));
});
