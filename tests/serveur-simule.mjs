// Serveur Supabase SIMULÉ pour les suites I et N : mêmes règles que la migration SQL (cp_emettre_document & co),
// testée, elle, sur un vrai PostgreSQL (tests/sql/test_migration.py). Injecté dans la page par p.evaluate(SERVEUR).
/* serveur simulé, injecté dans la page (même règles que cp_emettre_document & co) */
export const SERVEUR=`(function(){
  const srv={docs:[],seq:{},events:[],fichiers:{},appels:[],fail:{}};
  const jour=()=>todayISO();
  function doc(d){ return {id:d.id,request_id:d.request_id,serie:d.serie,annee:d.annee,numero:d.numero,num:d.num,type:d.type,origine:d.origine,date_doc:d.date_doc,payload:d.payload,payload_hash:'h'+d.id,fichiers_hash:d.fichiers_hash||null}; }
  function rpc(name,p){ srv.appels.push(name);
    if(srv.fail.horsService) return Promise.reject(new Error('Failed to fetch'));
    if(name==='cp_serveur_info'){ if(srv.fail.migration) return Promise.resolve({error:{code:'PGRST202',message:'Could not find the function public.cp_serveur_info'}}); return Promise.resolve({data:{documents:true,version:'1.10'}}); }
    if(name==='cp_state_push'){ if(srv.fail.ancienServeur&&p.p_client_version) return Promise.resolve({error:{code:'PGRST202',message:'Could not find the function public.cp_state_push(p_client_version, ...)'}}); srv.dernierPush=p; return Promise.resolve({data:{ok:true,updated_at:new Date().toISOString()}}); }
    if(name==='cp_emettre_document'){
      if(srv.fail.migration) return Promise.resolve({error:{code:'PGRST202',message:'Could not find the function'}});
      if(!/^1\\.(1\\d|[2-9]\\d)/.test(p.p_client_version||'')) return Promise.resolve({error:{message:'ClimPilot doit être mis à jour'}});
      const ex=srv.docs.find(d=>d.request_id===p.p_request_id); if(ex) return Promise.resolve({data:{ok:true,deja:true,doc:doc(ex)}});
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
  function from(t){ const q={_eq:null,select(){return q;},order(){return q;},eq(c,v){ q._eq=[c,v]; return q;},
      or(){return q;},in(){return q;},gte(){return q;},lte(){return q;},lt(){return q;},gt(){return q;},is(){return q;},neq(){return q;},limit(){return q;},range(){return q;},
      update(){return q;},insert(){return q;},upsert(){return q;},delete(){return q;},single(){ return Promise.resolve({data:null}); },
      maybeSingle(){ const d=srv.docs.find(x=>x[q._eq[0]]===q._eq[1]); return Promise.resolve({data:d?{html:d.html||null,data:null}:null}); },
      then(ok,ko){ return Promise.resolve(t==='climpilot_documents'?{data:srv.docs.map(doc)}:{data:[]}).then(ok,ko); } };
    return q; }
  window.__srv=srv; window.sb={rpc:rpc,from:from,auth:{getSession:()=>Promise.resolve({data:{session:null}})}};
})();`;
