// Serveur Supabase SIMULÉ pour les suites I, N et R : mêmes règles que la migration SQL (cp_emettre_document & co),
// testée, elle, sur un vrai PostgreSQL (tests/sql/test_migration.py). Injecté dans la page par p.evaluate(SERVEUR).
/* serveur simulé, injecté dans la page (même règles que cp_emettre_document & co) */
export const SERVEUR=`(function(){
  const srv={docs:[],seq:{},events:[],fichiers:{},appels:[],fail:{}};
  const jour=()=>todayISO();
  function doc(d){ return {id:d.id,request_id:d.request_id,serie:d.serie,annee:d.annee,numero:d.numero,num:d.num,type:d.type,origine:d.origine,date_doc:d.date_doc,payload:d.payload,payload_hash:'h'+d.id,fichiers_hash:d.fichiers_hash||null}; }
  function regleSource(p){
    const src=p.p_payload&&p.p_payload.src; if(p.p_serie!=='F'||!src||typeof src!=='object'||!src.k) return null;
    const annulees=new Set(srv.docs.filter(a=>a.serie==='AV'&&a.origine==='emis'&&a.payload&&a.payload.fac&&a.payload.fac.total===true).map(a=>String((a.payload.src||{}).w||'').split('|')[0]));
    const vivantes=(k,id,w)=>srv.docs.filter(d=>d.serie==='F'&&d.origine==='emis'&&d.request_id!==p.p_request_id&&d.payload&&d.payload.src&&d.payload.src.k===k&&String(d.payload.src.id||'')===String(id||'')&&String(d.payload.src.w||'')===String(w||'')&&!annulees.has(d.num));
    const meme=vivantes(src.k,src.id,src.w); if(meme.length) return {raison:'deja_facture',doc:meme[meme.length-1]};
    if(src.k==='devis'&&(src.w==='acompte'||src.w==='solde')){ const autre=vivantes('devis',src.id,src.w==='solde'?'acompte':'solde');
      if(autre.length){ const ex=autre[autre.length-1]; if(src.w==='acompte') return {raison:'solde_deja_emis',doc:ex};
        const f=p.p_payload.fac||{}, tot=Number(f.total), m=Number(f.montant), ac=Number((ex.payload.fac||{}).montant);
        if(!isFinite(tot)||!isFinite(m)||!isFinite(ac)||Math.abs((tot-ac)-m)>0.011) return {raison:'acompte_ignore',doc:ex}; } }
    return null;
  }
  function rpc(name,p){ srv.appels.push(name);
    if(srv.fail.horsService) return Promise.reject(new Error('Failed to fetch'));
    if(name==='cp_serveur_info'){ if(srv.fail.migration) return Promise.resolve({error:{code:'PGRST202',message:'Could not find the function public.cp_serveur_info'}}); return Promise.resolve({data:{documents:true,version:'1.10'}}); }
    if(name==='cp_state_push'){ if(srv.fail.ancienServeur&&p.p_client_version) return Promise.resolve({error:{code:'PGRST202',message:'Could not find the function public.cp_state_push(p_client_version, ...)'}}); srv.dernierPush=p; return Promise.resolve({data:{ok:true,updated_at:new Date().toISOString()}}); }
    if(name==='cp_emettre_document'){
      if(srv.fail.migration) return Promise.resolve({error:{code:'PGRST202',message:'Could not find the function'}});
      if(!/^1\\.(1\\d|[2-9]\\d)/.test(p.p_client_version||'')) return Promise.resolve({error:{message:'ClimPilot doit être mis à jour'}});
      const ex=srv.docs.find(d=>d.request_id===p.p_request_id); if(ex) return Promise.resolve({data:{ok:true,deja:true,doc:doc(ex)}});
      /* C1 (21/10/2026) : une seule facture F vivante par source, solde cohérent avec l'acompte, pas d'acompte après le solde (migration une_facture_par_source) */
      const refus=regleSource(p); if(refus) return Promise.resolve({data:{ok:false,raison:refus.raison,doc:doc(refus.doc)}});
      const an=+String(p.p_date).slice(0,4), k=p.p_serie+'|'+an;
      const mx=Math.max(srv.seq[k]||0,...srv.docs.filter(d=>d.serie===p.p_serie&&d.annee===an).map(d=>d.numero),p.p_min_numero||0)+1; srv.seq[k]=mx;
      const d={id:'doc'+(srv.docs.length+1),request_id:p.p_request_id,serie:p.p_serie,annee:an,numero:mx,num:p.p_serie+'-'+an+'-'+String(mx).padStart(3,'0'),type:p.p_type,origine:'emis',date_doc:p.p_date,payload:JSON.parse(JSON.stringify(p.p_payload))};
      srv.docs.push(d);
      if(srv.fail.perdreReponse){ srv.fail.perdreReponse=false; return Promise.reject(new Error('connexion coupée après l\\'enregistrement')); }
      return Promise.resolve({data:{ok:true,deja:false,doc:doc(d)}});
    }
    if(name==='cp_document_fichiers'){ const d=srv.docs.find(x=>x.id===p.p_id); if(!d) return Promise.resolve({error:{message:'introuvable'}});
      if(d.fichiers_hash&&d.fichiers_hash!==(p.p_html+'|'+p.p_xml).length+'') return Promise.resolve({error:{message:'déjà enregistrés'}});
      d.html=p.p_html; d.xml=p.p_xml; d.fichiers_hash=(p.p_html+'|'+p.p_xml).length+''; return Promise.resolve({data:{ok:true}}); }
    if(name==='cp_document_evenement'){ if(!srv.events.some(e=>e.rid===p.p_request_id)) srv.events.push({rid:p.p_request_id,doc:p.p_document_id,type:p.p_type,donnees:p.p_donnees}); return Promise.resolve({data:{ok:true}}); }
    if(name==='cp_importer_ancien'){ const ex=srv.docs.find(d=>d.request_id===p.p_request_id); if(ex) return Promise.resolve({data:{ok:true,deja:true,doc:doc(ex)}});
      const m=/^(F|AV)-(\\d{4})-(\\d+)$/.exec(p.p_num); const d={id:'doc'+(srv.docs.length+1),request_id:p.p_request_id,serie:m[1],annee:+m[2],numero:+m[3],num:p.p_num,type:p.p_type,origine:'reconstitue',date_doc:p.p_date,payload:p.p_payload};
      srv.docs.push(d); return Promise.resolve({data:{ok:true,deja:false,doc:doc(d)}}); }
    return Promise.resolve({error:{message:'rpc inconnue '+name}});
  }
  /* 19/10/2026 — tables lues et écrites pour de vrai par le faux client : boîte de réception (demandes du site comprises),
     signatures, journal des événements (lecture). Filtres, tri, limite, tranche (range), nombre exact (count) et mises à jour. */
  let nId=0; const uid=()=>'00000000-0000-4000-8000-'+String(++nId).padStart(12,'0');
  srv.inbox=[]; srv.sigs=[];
  const CHAMPS={
    demande:{besoin:'panne',profil:'pro',equipement:'Vitrine réfrigérée',commune:'Creil',description:'Vitrine en panne depuis ce matin',marque:'Je ne sais pas',code:'Ne refroidit plus',bloquant:'Oui, marchandise ou service en danger',depuis:'Depuis ce matin',nom:'Boulangerie Test',telephone:'06 12 34 56 78',email:'contact@exemple.fr',rappel:'Le matin'},
    reservation:{prestation:'Entretien climatisation',profil:'Particulier',jour:'Mardi 27 octobre',moment:'Matin',nom:'Mme Exemple',telephone:'07 00 00 00 01',email:'mme@exemple.fr',adresse:'1 rue de l\\'Exemple',commune:'Beauvais',equipement:'Daikin FTXM25',cgv:'Oui',execution:'Oui'},
    retractation:{nom:'M. Exemple',email:'m@exemple.fr',date:'2026-10-10',prestation:'Entretien climatisation du 12/10',message:'Je me rétracte.'}};
  const LIB={demande:'Demande',reservation:'Réservation',retractation:'Rétractation'};
  /* ligne déposée par le site (même forme que toRow de la fonction « site-demande ») : site_demande, site_reservation, site_retractation */
  srv.ligneSite=function(type,o){ o=o||{}; const ch=Object.assign({},CHAMPS[type],o.champs||{});
    const quoi=type==='demande'?(ch.besoin||''):(ch.prestation||''), bloque=type==='demande'&&/^Oui/.test(ch.bloquant||'');
    const recu=o.recu||o.created_at||new Date().toISOString();
    const avant=type==='demande'?(o.rappeler_avant!==undefined?o.rappeler_avant:new Date(Date.now()+7*86400000).toISOString().slice(0,10)):null;
    return {id:o.id||uid(),user_id:'u1',created_at:o.created_at||recu,kind:'message',statut:o.statut||'a_valider',source:'site',traite_at:o.traite_at||null,dictee:null,
      titre:'Site · '+LIB[type]+' · '+quoi+(ch.commune?' · '+ch.commune:'')+(bloque?' · ACTIVITÉ BLOQUÉE':''),
      resume:[ch.nom,ch.telephone,ch.email,ch.description||ch.message||''].filter(Boolean).join('\\n'),
      payload:{type:'site_'+type,champs:ch,meta:{ip_hash:'h'+nId,rid:'rid-'+nId,page:'/contact.html',secondes:42,recu:recu,rappeler_avant:avant}}};
  };
  const TABLES={climpilot_inbox:()=>srv.inbox, climpilot_signatures:()=>srv.sigs,
    climpilot_doc_events:()=>srv.events.map((e,i)=>({id:i+1,document_id:e.doc,request_id:e.rid,type:e.type,donnees:e.donnees||{},cree_le:e.cree_le||null}))};
  function val(r,c){ let v=r; for(const k of String(c).split(/->>?/)){ if(v==null) return null; v=v[k]; } return v===undefined?null:v; }
  function splitTop(s){ const out=[]; let cur='',dep=0,qu=false; for(const ch of String(s)){ if(ch==='"'){ qu=!qu; cur+=ch; continue; }
      if(!qu&&ch==='(') dep++; if(!qu&&ch===')') dep--; if(!qu&&dep===0&&ch===','){ out.push(cur); cur=''; continue; } cur+=ch; } if(cur) out.push(cur); return out; }
  function cond(part){ const i1=part.indexOf('.'), i2=part.indexOf('.',i1+1), col=part.slice(0,i1), op=part.slice(i1+1,i2); let v=part.slice(i2+1);
    const unq=x=>x.replace(/^"|"$/g,''), g=r=>val(r,col);
    if(op==='in'){ const l=v.replace(/^\\(|\\)$/g,'').split(',').map(unq); return r=>l.indexOf(String(g(r)))>=0; }
    v=unq(v);
    if(op==='eq') return r=>String(g(r))===v; if(op==='neq') return r=>String(g(r))!==v;
    if(op==='gte') return r=>g(r)!=null&&String(g(r))>=v; if(op==='gt') return r=>g(r)!=null&&String(g(r))>v;
    if(op==='lte') return r=>g(r)!=null&&String(g(r))<=v; if(op==='lt') return r=>g(r)!=null&&String(g(r))<v;
    if(op==='is') return r=>(g(r)==null)===(v==='null');
    return ()=>false; }
  function table(t){ const q={f:[],o:null,lim:null,rg:null,cnt:false,upd:null,ins:null,sel:false,del:false,
      select(c,opt){ if(q.upd||q.ins) q.sel=true; if(opt&&opt.count) q.cnt=true; return q; },
      eq(c,v){ q.f.push(r=>String(val(r,c))===String(v)); return q; }, neq(c,v){ q.f.push(r=>String(val(r,c))!==String(v)); return q; },
      in(c,a){ const l=(a||[]).map(String); q.f.push(r=>l.indexOf(String(val(r,c)))>=0); return q; },
      gte(c,v){ q.f.push(r=>val(r,c)!=null&&String(val(r,c))>=String(v)); return q; }, gt(c,v){ q.f.push(r=>val(r,c)!=null&&String(val(r,c))>String(v)); return q; },
      lte(c,v){ q.f.push(r=>val(r,c)!=null&&String(val(r,c))<=String(v)); return q; }, lt(c,v){ q.f.push(r=>val(r,c)!=null&&String(val(r,c))<String(v)); return q; },
      is(c,v){ q.f.push(r=>(val(r,c)==null)===(v==null)); return q; },
      or(s){ const cs=splitTop(s).map(cond); q.f.push(r=>cs.some(fn=>fn(r))); return q; },
      order(c,o){ q.o={c:c,asc:!(o&&o.ascending===false)}; return q; }, limit(n){ q.lim=n; return q; }, range(a,b){ q.rg=[a,b]; return q; },
      update(o){ q.upd=o; return q; }, insert(o){ q.ins=o; return q; }, upsert(o){ q.ins=o; return q; }, delete(){ q.del=true; return q; },
      single(){ return run().then(r=>({data:(r.data||[])[0]||null,error:r.error})); }, maybeSingle(){ return run().then(r=>({data:(r.data||[])[0]||null,error:r.error})); },
      then(ok,ko){ return run().then(ok,ko); } };
    function run(){ srv.appels.push('from:'+t);
      if(srv.fail[t]) return Promise.resolve({data:null,count:null,error:{message:'erreur simulée ('+t+')'}});
      const rows=TABLES[t](), copie=x=>JSON.parse(JSON.stringify(x));
      if(q.ins){ const a=[].concat(q.ins).map(x=>Object.assign({id:uid(),created_at:new Date().toISOString()},x)); a.forEach(x=>rows.push(x)); return Promise.resolve({data:q.sel?copie(a):null,error:null}); }
      let res=rows.filter(r=>q.f.every(fn=>fn(r)));
      if(q.upd){ res.forEach(r=>Object.assign(r,q.upd)); return Promise.resolve({data:q.sel?copie(res):null,error:null}); }
      if(q.del){ res.forEach(r=>{ const i=rows.indexOf(r); if(i>=0) rows.splice(i,1); }); return Promise.resolve({data:null,error:null}); }
      if(q.o){ const c=q.o.c, s=q.o.asc?1:-1; res=res.slice().sort((a,b)=>{ const x=val(a,c), y=val(b,c); if(x===y) return 0; if(x==null) return 1; if(y==null) return -1; return x<y?-s:s; }); }
      const n=res.length; if(q.rg) res=res.slice(q.rg[0],q.rg[1]+1); if(q.lim!=null) res=res.slice(0,q.lim);
      return Promise.resolve({data:copie(res),count:q.cnt?n:null,error:null}); }
    return q; }
  function from(t){ if(TABLES[t]) return table(t);
    const q={_eq:null,_rg:null,_sel:'',select(s){ q._sel=String(s||''); return q;},order(){return q;},eq(c,v){ q._eq=[c,v]; return q;},
      or(){return q;},in(){return q;},gte(){return q;},lte(){return q;},lt(){return q;},gt(){return q;},is(){return q;},neq(){return q;},limit(){return q;},range(a,b){ q._rg=[a,b]; return q;},
      update(){return q;},insert(){return q;},upsert(){return q;},delete(){return q;},single(){ return Promise.resolve({data:null}); },
      maybeSingle(){ const d=srv.docs.find(x=>x[q._eq[0]]===q._eq[1]); return Promise.resolve({data:d?{html:d.html||null,data:null}:null}); },
      then(ok,ko){ if(t==='climpilot_documents'&&srv.fail.climpilot_documents) return Promise.resolve({data:null,error:{message:'erreur simulée (climpilot_documents)'}}).then(ok,ko);
        let d=t==='climpilot_documents'?srv.docs.map(doc):[]; if(q._rg) d=d.slice(q._rg[0],q._rg[1]+1);
        /* sélection d'un champ JSON, comme PostgREST : « alias:payload->clé->clé » (vérification 1.12 avant émission) */
        const ch=[...q._sel.matchAll(/(\\w+):payload((?:->\\w+)+)/g)];
        if(t==='climpilot_documents'&&ch.length) d=d.map(x=>{ const o=Object.assign({},x); delete o.payload; ch.forEach(m=>{ let v=x.payload; m[2].split('->').filter(Boolean).forEach(k=>{ v=v==null?undefined:v[k]; }); o[m[1]]=v===undefined?null:JSON.parse(JSON.stringify(v)); }); return o; });
        return Promise.resolve({data:d}).then(ok,ko); } };
    return q; }
  window.__srv=srv; window.sb={rpc:rpc,from:from,auth:{getSession:()=>Promise.resolve({data:{session:null}})}};
})();`;
