/* ============================================================
   ClimPilot Next — next-dim.js  (couche additive, 30/09/2026)
   Dimensionnement AUTOMATIQUE (onglet Dimensionnement), 3 outils :
   1. Gaines de gainable : débit par pièce (au prorata des surfaces),
      diamètre de chaque bouche, nombre de bouches, reprise et grille.
      Q (m³/h) = P (W) / (0,34 × ΔT) ; diamètre = plus petit Ø standard
      dont la vitesse reste sous la limite (4 m/s confort, 3 m/s chambres).
   2. Tuyaux d'eau (PAC air-eau, eau glacée, plancher) : débit, puis le plus
      petit tube dont vitesse ET perte de charge restent sous les repères
      (≤ 1 m/s, ≤ 20 mmCE/m) ; perte de charge (Darcy, Colebrook) pour ta longueur.
   3. Liaisons frigorifiques (froid commercial, liaisons longues) : débit
      massique = puissance / effet frigorifique, puis vitesse dans chaque
      diamètre cuivre (aspiration, liquide, refoulement).
      Propriétés des fluides calculées avec CoolProp (équations d'état de
      référence ; mélanges R448A/R449A/R452A/R454B/R513A en approché) :
      surchauffe 5 K, sous-refroidissement 3 K, refoulement ≈ Tc + 30 K.
   PRÉ-DIMENSIONNEMENT : pour un split / une PAC, les diamètres des
   raccords et les longueurs maxi de la NOTICE priment toujours.
   ============================================================ */
(function(){
  'use strict';
  var REFTAB={"R32":{"te":{"-40":[4.929,506.63,1.774],"-35":[6.077,508.97,2.214],"-30":[7.428,511.19,2.734],"-25":[9.004,513.27,3.346],"-20":[10.835,515.22,4.058],"-15":[12.951,517.01,4.881],"-10":[15.385,518.64,5.826],"-5":[18.176,520.1,6.906],"0":[21.367,521.37,8.131],"5":[25.005,522.43,9.514],"10":[29.147,523.26,11.069],"15":[33.858,523.85,12.808]},"tc":{"25":[974.1,239.85,38.366,16.896],"30":[953.6,249.39,43.845,19.275],"35":[932.0,259.17,49.965,21.898],"40":[909.3,269.23,56.795,24.783],"45":[885.1,279.61,64.415,27.948],"50":[859.2,290.37,72.916,31.412],"55":[831.2,301.6,82.405,35.199]}},"R410A":{"te":{"-40":[6.798,409.35,1.748],"-35":[8.385,411.87,2.181],"-30":[10.251,414.32,2.693],"-25":[12.429,416.68,3.294],"-20":[14.959,418.95,3.993],"-15":[17.884,421.12,4.8],"-10":[21.25,423.17,5.727],"-5":[25.112,425.1,6.783],"0":[29.529,426.89,7.981],"5":[34.573,428.54,9.332],"10":[40.323,430.02,10.848],"15":[46.877,431.31,12.543]},"tc":{"25":[1074.9,234.77,52.775,16.521],"30":[1050.3,243.14,60.316,18.834],"35":[1024.2,251.75,68.746,21.383],"40":[996.5,260.62,78.164,24.186],"45":[966.6,269.8,88.687,27.261],"50":[934.1,279.36,100.449,30.63],"55":[898.4,289.39,113.606,34.316]}},"R134a":{"te":{"-40":[2.705,377.76,0.512],"-35":[3.439,381.0,0.661],"-30":[4.323,384.23,0.844],"-25":[5.377,387.44,1.064],"-20":[6.624,390.63,1.327],"-15":[8.089,393.8,1.639],"-10":[9.798,396.93,2.006],"-5":[11.78,400.02,2.433],"0":[14.066,403.07,2.928],"5":[16.69,406.07,3.497],"10":[19.691,409.01,4.146],"15":[23.11,411.9,4.884]},"tc":{"25":[1218.3,230.29,27.69,6.654],"30":[1199.5,237.4,31.946,7.702],"35":[1180.1,244.62,36.707,8.87],"40":[1159.9,251.94,42.021,10.166],"45":[1139.0,259.39,47.944,11.599],"50":[1117.1,266.96,54.533,13.179],"55":[1094.1,274.69,61.857,14.915]}},"R404A":{"te":{"-40":[6.806,347.52,1.31],"-35":[8.4,350.59,1.636],"-30":[10.271,353.63,2.022],"-25":[12.454,356.63,2.475],"-20":[14.985,359.58,3.002],"-15":[17.907,362.48,3.61],"-10":[21.266,365.32,4.307],"-5":[25.112,368.09,5.102],"0":[29.505,370.78,6.003],"5":[34.513,373.37,7.018],"10":[40.214,375.87,8.157],"15":[46.701,378.24,9.429]},"tc":{"25":[1059.2,231.71,52.976,12.412],"30":[1035.7,239.3,60.513,14.145],"35":[1010.8,247.08,68.931,16.053],"40":[984.2,255.07,78.331,18.149],"45":[955.6,263.32,88.824,20.447],"50":[924.5,271.86,100.539,22.961],"55":[890.2,280.77,113.63,25.709]}},"R407C":{"te":{"-40":[3.858,391.54,0.857],"-35":[4.868,394.54,1.097],"-30":[6.076,397.5,1.387],"-25":[7.508,400.41,1.735],"-20":[9.193,403.28,2.147],"-15":[11.163,406.09,2.632],"-10":[13.453,408.84,3.198],"-5":[16.101,411.52,3.853],"0":[19.149,414.12,4.607],"5":[22.643,416.63,5.469],"10":[26.638,419.05,6.449],"15":[31.195,421.35,7.556]},"tc":{"25":[1151.0,232.15,36.761,10.199],"30":[1129.6,239.77,42.335,11.758],"35":[1107.3,247.53,48.585,13.491],"40":[1083.9,255.46,55.585,15.412],"45":[1059.2,263.57,63.419,17.535],"50":[1033.1,271.88,72.188,19.876],"55":[1005.1,280.45,82.006,22.453]}},"R507A":{"te":{"-40":[7.315,343.96,1.387],"-35":[9.002,347.01,1.727],"-30":[10.98,350.02,2.128],"-25":[13.283,353.0,2.598],"-20":[15.951,355.93,3.144],"-15":[19.028,358.8,3.773],"-10":[22.56,361.61,4.493],"-5":[26.604,364.35,5.312],"0":[31.22,367.01,6.24],"5":[36.479,369.57,7.284],"10":[42.466,372.03,8.454],"15":[49.277,374.36,9.759]},"tc":{"25":[1063.5,231.55,55.65,12.815],"30":[1039.4,239.12,63.512,14.587],"35":[1013.8,246.88,72.289,16.537],"40":[986.4,254.86,82.086,18.679],"45":[956.9,263.1,93.022,21.025],"50":[924.6,271.65,105.237,23.592],"55":[888.8,280.59,118.894,26.399]}},"R290":{"te":{"-40":[2.57,535.78,1.111],"-35":[3.128,541.89,1.372],"-30":[3.775,547.98,1.678],"-25":[4.519,554.04,2.034],"-20":[5.372,560.06,2.445],"-15":[6.343,566.03,2.916],"-10":[7.443,571.95,3.453],"-5":[8.686,577.8,4.06],"0":[10.085,583.57,4.745],"5":[11.654,589.26,5.511],"10":[13.409,594.85,6.366],"15":[15.37,600.32,7.315]},"tc":{"25":[497.2,257.0,17.55,9.521],"30":[489.5,270.56,19.84,10.79],"35":[481.4,284.38,22.361,12.179],"40":[473.1,298.48,25.132,13.694],"45":[464.4,312.89,28.174,15.343],"50":[455.2,327.64,31.512,17.133],"55":[445.6,342.75,35.174,19.072]}},"R1234yf":{"te":{"-40":[3.693,340.45,0.622],"-35":[4.614,343.94,0.789],"-30":[5.706,347.43,0.989],"-25":[6.991,350.92,1.228],"-20":[8.491,354.39,1.509],"-15":[10.232,357.85,1.837],"-10":[12.241,361.29,2.218],"-5":[14.548,364.71,2.657],"0":[17.185,368.1,3.159],"5":[20.189,371.45,3.73],"10":[23.598,374.75,4.376],"15":[27.458,378.01,5.104]},"tc":{"25":[1103.0,229.47,32.258,6.827],"30":[1084.9,236.42,36.946,7.836],"35":[1066.1,243.48,42.167,8.953],"40":[1046.6,250.65,47.971,10.185],"45":[1026.1,257.96,54.414,11.539],"50":[1004.7,265.41,61.562,13.023],"55":[982.1,273.02,69.483,14.647]}},"R600a":{"te":{"-40":[0.856,508.36,0.287],"-35":[1.078,514.99,0.368],"-30":[1.343,521.67,0.466],"-25":[1.657,528.39,0.584],"-20":[2.024,535.15,0.725],"-15":[2.452,541.94,0.891],"-10":[2.947,548.76,1.085],"-5":[3.516,555.61,1.31],"0":[4.165,562.47,1.57],"5":[4.903,569.35,1.867],"10":[5.738,576.24,2.206],"15":[6.679,583.14,2.59]},"tc":{"25":[554.5,251.72,8.034,3.507],"30":[548.2,263.88,9.207,4.047],"35":[541.8,276.21,10.507,4.648],"40":[535.3,288.71,11.944,5.312],"45":[528.6,301.39,13.528,6.044],"50":[521.7,314.25,15.27,6.849],"55":[514.7,327.32,17.183,7.73]}},"R448A":{"te":{"-40":[4.509,386.92,0.997],"-35":[5.649,389.96,1.266],"-30":[7.004,392.96,1.59],"-25":[8.602,395.91,1.976],"-20":[10.474,398.82,2.431],"-15":[12.652,401.66,2.962],"-10":[15.172,404.45,3.58],"-5":[18.076,407.16,4.291],"0":[21.408,409.79,5.106],"5":[25.219,412.33,6.034],"10":[29.567,414.76,7.085],"15":[34.516,417.09,8.27]},"tc":{"25":[1111.2,235.8,40.308,11.083],"30":[1089.6,243.49,46.297,12.736],"35":[1066.9,251.34,53.006,14.57],"40":[1043.0,259.37,60.515,16.599],"45":[1017.8,267.6,68.918,18.839],"50":[990.8,276.06,78.326,21.306],"55":[961.9,284.79,88.872,24.021]}},"R449A":{"te":{"-40":[4.597,384.7,1.005],"-35":[5.754,387.73,1.275],"-30":[7.128,390.73,1.6],"-25":[8.746,393.68,1.986],"-20":[10.64,396.58,2.44],"-15":[12.842,399.43,2.971],"-10":[15.39,402.21,3.587],"-5":[18.323,404.93,4.297],"0":[21.687,407.56,5.109],"5":[25.531,410.11,6.033],"10":[29.915,412.56,7.079],"15":[34.903,414.9,8.257]},"tc":{"25":[1111.1,235.82,40.684,11.051],"30":[1089.4,243.49,46.704,12.692],"35":[1066.7,251.31,53.444,14.51],"40":[1042.8,259.31,60.982,16.522],"45":[1017.5,267.52,69.414,18.74],"50":[990.5,275.95,78.847,21.183],"55":[961.5,284.66,89.413,23.868]}},"R454B":{"te":{"-40":[5.321,454.81,1.596],"-35":[6.562,457.49,1.993],"-30":[8.018,460.08,2.462],"-25":[9.718,462.59,3.013],"-20":[11.69,464.99,3.655],"-15":[13.965,467.29,4.397],"-10":[16.58,469.47,5.249],"-5":[19.575,471.53,6.221],"0":[22.993,473.44,7.324],"5":[26.885,475.2,8.57],"10":[31.311,476.79,9.97],"15":[36.336,478.19,11.535]},"tc":{"25":[999.6,243.51,41.307,15.217],"30":[978.7,252.36,47.183,17.36],"35":[956.7,261.43,53.745,19.724],"40":[933.5,270.74,61.07,22.326],"45":[908.7,280.34,69.245,25.184],"50":[882.2,290.28,78.376,28.316],"55":[853.5,300.64,88.585,31.745]}},"R513A":{"te":{"-40":[3.441,356.77,0.61],"-35":[4.328,360.13,0.779],"-30":[5.385,363.49,0.983],"-25":[6.634,366.83,1.227],"-20":[8.099,370.16,1.516],"-15":[9.807,373.47,1.855],"-10":[11.785,376.75,2.251],"-5":[14.063,380.0,2.707],"0":[16.675,383.21,3.232],"5":[19.658,386.37,3.83],"10":[23.052,389.49,4.509],"15":[26.902,392.55,5.276]},"tc":{"25":[1145.9,232.27,31.77,7.098],"30":[1127.2,239.31,36.474,8.169],"35":[1107.8,246.45,41.718,9.356],"40":[1087.7,253.71,47.555,10.667],"45":[1066.7,261.11,54.043,12.111],"50":[1044.6,268.65,61.246,13.696],"55":[1021.3,276.35,69.237,15.432]}},"R452A":{"te":{"-40":[6.347,344.34,1.163],"-35":[7.874,347.37,1.461],"-30":[9.675,350.38,1.817],"-25":[11.784,353.36,2.237],"-20":[14.239,356.3,2.728],"-15":[17.081,359.19,3.299],"-10":[20.356,362.03,3.956],"-5":[24.115,364.81,4.71],"0":[28.415,367.53,5.568],"5":[33.322,370.16,6.539],"10":[38.912,372.7,7.634],"15":[45.273,375.14,8.863]},"tc":{"25":[1139.2,231.95,52.148,11.764],"30":[1114.8,239.21,59.714,13.459],"35":[1089.1,246.62,68.184,15.335],"40":[1061.8,254.23,77.663,17.406],"45":[1032.6,262.05,88.275,19.686],"50":[1001.2,270.12,100.17,22.195],"55":[966.8,278.5,113.531,24.953]}}};
  var STK='cpnext_dim2';
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function num(v){ var n=Number(String(v==null?'':v).replace(',','.')); return isFinite(n)?n:0; }
  function fq(n,d){ var p=Math.pow(10,d==null?1:d); return String(Math.round(n*p)/p).replace('.',','); }
  function lsGet(k,fb){ try{ var v=localStorage.getItem(k); return v==null?fb:JSON.parse(v); }catch(e){ return fb; } }
  function lsSet(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){} }
  var S=Object.assign({tab:'gaine',
    g:{kw:7.1,debit:'',dt:10,vmax:4,pieces:[{n:'Séjour',s:30},{n:'Chambre 1',s:12},{n:'Chambre 2',s:11}]},
    w:{kw:8,dt:5,tube:'cuivre',temp:45,long:20},
    f:{fl:'R404A',kw:5,te:-10,tc:40,riser:false}},lsGet(STK,{})||{});
  function keep(){ lsSet(STK,S); }

  /* ================= 1. gaines ================= */
  var DIAS=[125,160,200,250,315,355,400];
  function vel(q,d){ var a=Math.PI*Math.pow(d/1000,2)/4; return q/3600/a; }
  function pickD(q,vmax){ for(var i=0;i<DIAS.length;i++) if(vel(q,DIAS[i])<=vmax+1e-9) return DIAS[i]; return null; }
  function calcGaine(g){
    var Q=num(g.debit)>0?num(g.debit):num(g.kw)*1000/(0.34*Math.max(1,num(g.dt)));
    var ps=(g.pieces||[]).filter(function(p){ return num(p.s)>0; }), St=ps.reduce(function(a,p){ return a+num(p.s); },0);
    var vmax=num(g.vmax)||4, rows=ps.map(function(p){
      var q=St?Q*num(p.s)/St:0, n=1, d=pickD(q,vmax);
      while(!d||d>250){ n++; d=pickD(q/n,vmax); if(n>6) break; }
      return {n:p.n,s:num(p.s),q:q,nb:n,d:d,v:vel(q/n,d||250)};
    });
    var dRep=pickD(Q,vmax), nRep=1; while(!dRep||dRep>355){ nRep++; dRep=pickD(Q/nRep,vmax); if(nRep>4) break; }
    var grilleCm2=Q/3600/2*1e4; /* vitesse de passage 2 m/s sur la surface libre */
    return {Q:Q,rows:rows,dRep:dRep,nRep:nRep,grille:grilleCm2,brute:grilleCm2/0.7,bouches:rows.reduce(function(a,r){ return a+r.nb; },0)};
  }
  function viewGaine(){
    var g=S.g, r=calcGaine(g);
    var h='<div class="frm">'+
      inp('Puissance froid de la machine (kW)','g.kw',g.kw,0.1)+inp('Débit nominal (m³/h) — si connu, prioritaire','g.debit',g.debit,10,'notice machine')+
      sel('ΔT de soufflage','g.dt',g.dt,[[10,'10 K (standard)'],[8,'8 K (plus de débit)']])+
      sel('Vitesse maxi dans les gaines','g.vmax',g.vmax,[[4,'4 m/s — confort (séjour, bureaux)'],[3,'3 m/s — silencieux (chambres)'],[5,'5 m/s — local technique']])+'</div>'+
      '<h3 class="nxdm-h">Pièces desservies</h3>'+
      g.pieces.map(function(p,i){ return '<div class="nxdm-row"><input data-dm="g.pieces.'+i+'.n" value="'+esc(p.n)+'" placeholder="Pièce"><input type="number" inputmode="decimal" step="0.5" min="0" data-dm="g.pieces.'+i+'.s" value="'+esc(p.s)+'" placeholder="m²"><span>m²</span><button type="button" class="iconbtn d" onclick="nxdm.delP('+i+')">🗑</button></div>'; }).join('')+
      '<button type="button" class="btn-ghost btn-sm" onclick="nxdm.addP()">+ Ajouter une pièce</button>'+
      '<div class="nxdm-out">'+
      line('Débit total',fq(r.Q,0)+' m³/h'+(num(g.debit)>0?' (notice)':' (= '+fq(num(g.kw)*1000,0)+' W ÷ (0,34 × '+g.dt+' K))'))+
      '<table class="nxdm-t"><tr><th>Pièce</th><th>Débit</th><th>Bouche(s)</th><th>Vitesse</th></tr>'+r.rows.map(function(x){ return '<tr><td>'+esc(x.n||'—')+' <small>'+fq(x.s)+' m²</small></td><td>'+fq(x.q,0)+' m³/h</td><td><b>'+x.nb+' × Ø'+(x.d||'?')+'</b></td><td>'+fq(x.v)+' m/s</td></tr>'; }).join('')+'</table>'+
      line('Plénum de soufflage',r.bouches+' piquage(s) au total')+
      line('Gaine de reprise',r.nRep+' × Ø'+(r.dRep||'?')+' ('+fq(r.Q/r.nRep,0)+' m³/h chacune)')+
      line('Grille de reprise','surface libre ≥ '+fq(r.grille,0)+' cm² → grille brute ≈ '+fq(r.brute,0)+' cm²'+(r.nRep>1?' (au total)':''))+
      '</div><div class="nxdm-note">Débit réparti au prorata des surfaces (à ajuster si une pièce est très vitrée, sous les toits ou pleine de monde). Vitesse = débit ÷ section de la gaine. Grille de reprise : 2 m/s de passage, 70 % de surface libre (vérifie celle de ta grille). Longue gaine (> 6-7 m) ou coudes nombreux : vérifie la pression statique disponible de la machine.</div>';
    return h;
  }

  /* ================= 2. eau ================= */
  var TUBES={
    cuivre:{l:'Cuivre',eps:0.0015,s:[['12×1',10],['14×1',12],['16×1',14],['18×1',16],['22×1',20],['28×1',26],['35×1,5',32],['42×1,5',39],['54×1,5',51]]},
    multi:{l:'Multicouche',eps:0.007,s:[['16×2',12],['20×2',16],['26×3',20],['32×3',26],['40×3,5',33],['50×4',42],['63×4,5',54]]},
    per:{l:'PER',eps:0.007,s:[['12×1,1',9.8],['16×1,5',13],['20×1,9',16.2],['25×2,3',20.4],['32×2,9',26.2]]},
    acier:{l:'Acier (tube fer)',eps:0.045,s:[['15/21 (1/2")',16.1],['20/27 (3/4")',21.6],['26/34 (1")',27.3],['33/42 (1"1/4)',36],['40/49 (1"1/2)',41.9],['50/60 (2")',53.1]]}
  };
  var NU={45:0.602e-6,35:0.727e-6,20:1.004e-6,7:1.43e-6};
  function friction(Re,eD){ if(Re<2300) return 64/Math.max(Re,1); var x=Math.log10(eD/3.7+5.74/Math.pow(Re,0.9)); return 0.25/(x*x); }
  function calcEau(w){
    var Q=num(w.kw)/(1.163*Math.max(0.5,num(w.dt))); /* m³/h */
    var T=TUBES[w.tube]||TUBES.cuivre, nu=NU[w.temp]||NU[45], rho=w.temp>=40?990:w.temp>=20?998:1000;
    var rows=T.s.map(function(s){ var D=s[1]/1000, v=Q/3600/(Math.PI*D*D/4), Re=v*D/nu, f=friction(Re,T.eps/1000/D), J=f/D*rho*v*v/2; return {n:s[0],di:s[1],v:v,J:J,mm:J/9.81}; });
    var rec=null; for(var i=0;i<rows.length;i++){ if(rows[i].v<=1.0&&rows[i].mm<=20){ rec=i; break; } }
    return {Q:Q,rows:rows,rec:rec,T:T};
  }
  function viewEau(){
    var w=S.w, r=calcEau(w), L=num(w.long);
    var h='<div class="frm">'+inp('Puissance à transporter (kW)','w.kw',w.kw,0.5)+
      sel('Écart départ / retour (ΔT)','w.dt',w.dt,[[5,'5 K (PAC, plancher, eau glacée)'],[7,'7 K'],[10,'10 K (radiateurs)'],[15,'15 K'],[20,'20 K (radiateurs HT)']])+
      sel('Type de tube','w.tube',w.tube,Object.keys(TUBES).map(function(k){ return [k,TUBES[k].l]; }))+
      sel('Température de l\'eau','w.temp',w.temp,[[45,'≈ 45 °C (chauffage)'],[35,'≈ 35 °C (plancher)'],[20,'≈ 20 °C'],[7,'≈ 7 °C (eau glacée)']])+
      inp('Longueur aller + retour (m)','w.long',w.long,1)+'</div>'+
      '<div class="nxdm-out">'+line('Débit d\'eau',fq(r.Q,2)+' m³/h = '+fq(r.Q*1000/60,1)+' L/min <small>(= '+fq(num(w.kw))+' kW ÷ (1,163 × '+w.dt+' K))</small>')+
      '<table class="nxdm-t"><tr><th>Tube</th><th>Ø int.</th><th>Vitesse</th><th>Perte</th></tr>'+r.rows.map(function(x,i){ return '<tr class="'+(i===r.rec?'rec':'')+'"><td>'+(i===r.rec?'<b>✔ '+x.n+'</b>':x.n)+'</td><td>'+fq(x.di)+' mm</td><td>'+fq(x.v,2)+' m/s</td><td>'+fq(x.mm,1)+' mmCE/m</td></tr>'; }).join('')+'</table>'+
      (r.rec!=null?line('Conseillé',r.T.l+' '+r.rows[r.rec].n+' → perte ≈ '+fq(r.rows[r.rec].J*L*1.3/1000,1)+' kPa sur '+fq(L,0)+' m (+30 % coudes / vannes) = '+fq(r.rows[r.rec].J*L*1.3/9810,2)+' mCE'):'<div class="nxd2-warn">Aucun diamètre de cette gamme ne tient les repères : passe à un tube plus gros ou coupe le réseau en plusieurs boucles.</div>')+
      '</div><div class="nxdm-note">Repères : vitesse ≤ 1 m/s (bruit, érosion) et perte ≤ 20 mmCE/m. Compare la perte totale (+ échangeurs, filtre, vannes) à la hauteur manométrique disponible du circulateur de la PAC. Eau glycolée : débit et pertes plus élevés — refais le calcul avec la notice.</div>';
    return h;
  }

  /* ================= 3. liaisons frigorifiques ================= */
  var CU=[['1/4"',6.35,0.8],['3/8"',9.52,0.8],['1/2"',12.70,0.8],['5/8"',15.88,1.0],['3/4"',19.05,1.0],['7/8"',22.22,1.0],['1"1/8',28.58,1.0],['1"3/8',34.92,1.2],['1"5/8',41.28,1.2],['2"1/8',53.98,1.5],['2"5/8',66.68,2.0]];
  function interp(tab,t){
    var ks=Object.keys(tab).map(Number).sort(function(a,b){ return a-b; }); if(!ks.length) return null;
    if(t<=ks[0]) return tab[ks[0]]; if(t>=ks[ks.length-1]) return tab[ks[ks.length-1]];
    for(var i=0;i<ks.length-1;i++) if(t>=ks[i]&&t<=ks[i+1]){ var a=tab[ks[i]], b=tab[ks[i+1]], x=(t-ks[i])/(ks[i+1]-ks[i]); return a.map(function(v,j){ return v+(b[j]-v)*x; }); }
    return null;
  }
  function calcFrigo(f){
    var T=REFTAB[f.fl]; if(!T) return null;
    var te=num(f.te), tc=num(f.tc), E=interp(T.te,te), C=interp(T.tc,tc); if(!E||!C) return null;
    var dh=E[1]-C[1]; if(!(dh>0)) return null;
    var m=num(f.kw)/dh; /* kg/s */
    var lines=[
      {k:'asp',l:'Aspiration',rho:E[0],tgt:10,min:f.riser?7.5:5,max:15},
      {k:'liq',l:'Liquide',rho:C[0],tgt:0.8,min:0,max:1.2},
      {k:'ref',l:'Refoulement',rho:C[2],tgt:12,min:f.riser?7.5:5,max:18}
    ].map(function(L){
      var rows=CU.map(function(c){ var di=(c[1]-2*c[2])/1000, v=m/L.rho/(Math.PI*di*di/4); return {n:c[0],od:c[1],di:di*1000,v:v}; });
      var ok=rows.map(function(r,i){ return {i:i,r:r}; }).filter(function(x){ return x.r.v>=L.min&&x.r.v<=L.max; });
      /* aspiration / refoulement : le plus GROS diamètre qui garde la vitesse mini (retour d'huile) → moins de perte de charge ;
         liquide : le plus petit diamètre sous la vitesse maxi (moins de charge de fluide) */
      var best=ok.length?(L.k==='liq'?ok[0].i:ok[ok.length-1].i):null;
      return {l:L.l,k:L.k,rows:rows,best:best,L:L};
    });
    return {m:m,dh:dh,pe:E[2],pc:C[3],lines:lines};
  }
  function viewFrigo(){
    var f=S.f, r=calcFrigo(f);
    var h='<div class="frm">'+sel('Fluide','f.fl',f.fl,Object.keys(REFTAB).map(function(k){ return [k,k]; }))+inp('Puissance frigorifique (kW)','f.kw',f.kw,0.1)+
      inp('T° d\'évaporation (°C)','f.te',f.te,1,'−10 positif, −30 négatif')+inp('T° de condensation (°C)','f.tc',f.tc,1)+
      '<label class="nxd2-chk" style="grid-column:1/-1"><input type="checkbox" data-dm="f.riser" data-t="b"'+(f.riser?' checked':'')+'> <span>Colonne montante (évaporateur plus bas que le groupe) : vitesse mini plus élevée pour le retour d\'huile</span></label></div>';
    if(!r) return h+'<div class="nxd2-warn">Données manquantes pour ce calcul.</div>';
    h+='<div class="nxdm-out">'+line('Débit de fluide',fq(r.m*3600,1)+' kg/h <small>(= '+fq(num(f.kw))+' kW ÷ '+fq(r.dh,1)+' kJ/kg d\'effet frigorifique)</small>')+
      line('Pressions (absolues)','BP ≈ '+fq(r.pe,2)+' bar · HP ≈ '+fq(r.pc,2)+' bar <small>(relatives : retire ~1 bar)</small>');
    r.lines.forEach(function(L){
      var b=L.best;
      h+='<div class="nxdm-line"><div class="h">'+L.l+' : <b>'+(b!=null?L.rows[b].n+' ('+fq(L.rows[b].od,2)+' mm)':'aucun diamètre dans les repères')+'</b>'+(b!=null?' — '+fq(L.rows[b].v,L.k==='liq'?2:1)+' m/s':'')+'</div>'+
        '<div class="nxdm-chips">'+L.rows.map(function(x,i){ if(b!=null&&Math.abs(i-b)>2) return ''; var inR=x.v>=L.L.min&&x.v<=L.L.max; return '<span class="'+(i===b?'on':inR?'':'out')+'">'+x.n+' · '+fq(x.v,L.k==='liq'?2:1)+' m/s</span>'; }).join('')+'</div>'+
        '<div class="nxdm-note">repère '+(L.k==='liq'?'≤ '+fq(L.L.max)+' m/s':fq(L.L.min)+' à '+fq(L.L.max)+' m/s')+'</div></div>';
    });
    h+='</div><div class="nxdm-note">Choix : aspiration et refoulement = le plus gros diamètre qui garde la vitesse mini pour le retour d\'huile (moins de perte de charge) ; liquide = le plus petit diamètre sous 1,2 m/s (moins de charge de fluide). Tubes cuivre frigorifiques aux épaisseurs courantes (0,8 à 1,5 mm — vérifie celle de ton tube et sa tenue en pression pour le R410A / R32). <b>Split / PAC / groupe de marque : les diamètres et longueurs de la notice priment.</b> Longue liaison : vérifie aussi la perte de charge à l\'aspiration (≈ 1 K de perte maxi) avec les abaques du fabricant.</div>';
    return h;
  }

  /* ================= UI ================= */
  function inp(l,k,v,step,note){ return '<label>'+l+(note?' <span class="note-inline">'+esc(note)+'</span>':'')+'<input type="number" inputmode="decimal" step="'+(step||'any')+'" data-dm="'+k+'" value="'+esc(v==null?'':v)+'"></label>'; }
  function sel(l,k,v,opts){ return '<label>'+l+'<select data-dm="'+k+'">'+opts.map(function(o){ return '<option value="'+esc(o[0])+'"'+(String(o[0])===String(v)?' selected':'')+'>'+esc(o[1])+'</option>'; }).join('')+'</select></label>'; }
  function line(a,b){ return '<div class="recap-line"><div class="lbl">'+a+'</div><div>'+b+'</div></div>'; }
  function setPath(o,p,v){ var ks=p.split('.'), x=o; for(var i=0;i<ks.length-1;i++) x=x[ks[i]]; x[ks[ks.length-1]]=v; }
  function render(){
    var box=document.getElementById('nxdm'); if(!box) return;
    var tabs=[['gaine','🌀 Gaines gainable'],['eau','💧 Tuyaux d\'eau'],['frigo','❄️ Liaisons frigo']];
    box.innerHTML='<h2>📐 Dimensionnement automatique</h2><div class="nxdm-tabs">'+tabs.map(function(t){ return '<button type="button" class="'+(S.tab===t[0]?'on':'')+'" onclick="nxdm.tab(\''+t[0]+'\')">'+t[1]+'</button>'; }).join('')+'</div>'+
      '<div id="nxdmBody">'+(S.tab==='eau'?viewEau():S.tab==='frigo'?viewFrigo():viewGaine())+'</div>';
  }
  function onEdit(e,final){
    var el=e.target; if(!el.dataset||!el.dataset.dm) return;
    var k=el.dataset.dm, v=el.type==='checkbox'?el.checked:(el.tagName==='SELECT'&&!isNaN(Number(el.value))&&k!=='w.tube'&&k!=='f.fl'?Number(el.value):el.value);
    if(el.type==='number') v=el.value===''?'':num(el.value);
    setPath(S,k,v); keep();
    if(final||el.tagName==='SELECT'||el.type==='checkbox'){ var y=window.scrollY; render(); window.scrollTo(0,y); }
    else { clearTimeout(onEdit.t); onEdit.t=setTimeout(function(){ var a=document.activeElement, sel=a&&a.dataset&&a.dataset.dm, pos=a&&a.selectionStart; var y=window.scrollY; render(); window.scrollTo(0,y); if(sel){ var n=document.querySelector('[data-dm="'+sel+'"]'); if(n){ n.focus(); try{ if(pos!=null&&n.type!=='number') n.setSelectionRange(pos,pos); }catch(_){} } } },450); }
  }
  window.nxdm={tab:function(t){ S.tab=t; keep(); render(); },addP:function(){ S.g.pieces.push({n:'Pièce '+(S.g.pieces.length+1),s:10}); keep(); render(); },delP:function(i){ S.g.pieces.splice(i,1); keep(); render(); },
    calc:{gaine:calcGaine,eau:calcEau,frigo:calcFrigo}};
  var CSS='#nxdm .nxdm-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 12px}#nxdm .nxdm-tabs button{border:1px solid var(--line2,#cfd8e3);background:var(--panel,#fff);border-radius:999px;padding:8px 12px;font:inherit;font-size:13px;cursor:pointer;color:inherit}'+
    '#nxdm .nxdm-tabs button.on{background:var(--blue,#1f4e79);color:#fff;border-color:var(--blue,#1f4e79);font-weight:600}'+
    '#nxdm .nxdm-h{font-size:13px;margin:12px 0 6px;color:var(--blue,#1f4e79)}'+
    '#nxdm .nxdm-row{display:grid;grid-template-columns:1fr 90px auto auto;gap:6px;align-items:center;margin-bottom:6px}'+
    '#nxdm .nxdm-out{margin-top:12px;border-top:1px solid var(--line,#e3e8ef);padding-top:8px}'+
    '#nxdm .nxdm-t{width:100%;border-collapse:collapse;font-size:13px;margin:8px 0}#nxdm .nxdm-t th,#nxdm .nxdm-t td{padding:6px 5px;border-bottom:1px solid var(--line,#e3e8ef);text-align:left}#nxdm .nxdm-t tr.rec td{background:#eaf7ef}#nxdm .nxdm-t small{color:var(--muted,#64748b)}'+
    '#nxdm .nxdm-line{margin:10px 0}#nxdm .nxdm-line .h{font-size:14px}'+
    '#nxdm .nxdm-chips{display:flex;flex-wrap:wrap;gap:5px;margin-top:5px}#nxdm .nxdm-chips span{font-size:12px;border:1px solid var(--line2,#cfd8e3);border-radius:999px;padding:3px 8px}#nxdm .nxdm-chips span.on{background:var(--blue,#1f4e79);color:#fff;border-color:var(--blue,#1f4e79)}#nxdm .nxdm-chips span.out{opacity:.5;text-decoration:line-through}'+
    '#nxdm .nxdm-note{font-size:12px;color:var(--muted,#64748b);margin-top:6px;line-height:1.45}';
  function mount(){
    var v=document.getElementById('v-dim'); if(!v||document.getElementById('nxdm')) return !!v;
    if(!document.getElementById('nxdmStyle')){ var st=document.createElement('style'); st.id='nxdmStyle'; st.textContent=CSS; document.head.appendChild(st); }
    var c=document.createElement('div'); c.className='card'; c.id='nxdm';
    var wb=v.querySelector('.warnbox'); if(wb&&wb.nextSibling) v.insertBefore(c,wb.nextSibling); else v.insertBefore(c,v.firstChild);
    c.addEventListener('input',function(e){ onEdit(e,false); }); c.addEventListener('change',function(e){ onEdit(e,true); });
    render(); return true;
  }
  function boot(t){ t=t||0; if(!mount()&&t<60) setTimeout(function(){ boot(t+1); },200); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){ boot(0); }); else boot(0);
})();
