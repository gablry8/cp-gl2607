const C='climpilot-next-143-cadre';
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(['./','./index.html','./next-store.js','./next-theme.css','./next-pro.css','./next-da.css','./fonts/ibm-plex-sans-latin-400-normal.woff2','./fonts/ibm-plex-sans-latin-500-normal.woff2','./fonts/ibm-plex-sans-latin-600-normal.woff2','./fonts/ibm-plex-sans-latin-700-normal.woff2','./next-addons.js','./next-regime.js','./next-siren.js','./next-icons.js','./next-statut.js','./next-pdf.js','./next-activite.js','./next-relance.js','./next-commande.js','./next-assistant.js','./next-signature.js','./next-cerfa.js','./next-journee.js','./next-devis2.js','./next-mod-split.js','./next-mod-gainable.js','./next-mod-kit.js','./next-mod-depannage.js','./next-mod-entretien.js','./next-mod-chambre.js','./next-mod-autres.js','./next-catalogue.js','./next-fiabilite.js','./next-mobile.js','./next-adresse.js','./next-flu-guide.js','./next-dim.js','./next-fournisseur.js','./next-avoir.js','./next-einvoice.js','./next-superpdp.js','./manifest.json','./icon-192.png','./icon-512.png'])));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(u.origin!==location.origin||e.request.method!=='GET')return;
  e.respondWith(caches.open(C).then(async c=>{
    try{const r=await fetch(e.request);if(r&&r.ok)c.put(e.request,r.clone());return r;}
    catch(err){const m=await c.match(e.request,{ignoreSearch:true});return m||Response.error();}
  }));
});
