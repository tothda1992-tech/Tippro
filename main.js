(() => {
  const catalog = {
    countries: [
      {name:'England', leagues:[{name:'Premier League', base:{h:1.55,a:1.25}, teams:{Arsenal:82,Chelsea:75,Liverpool:84,'Manchester City':90,Tottenham:78,Newcastle:76,'Aston Villa':77}}, {name:'Championship', base:{h:1.45,a:1.15}, teams:{Leeds:78,Leicester:78,Southampton:73,Norwich:70,'West Brom':71}}]},
      {name:'Spain', leagues:[{name:'La Liga', base:{h:1.45,a:1.15}, teams:{'Real Madrid':90,Barcelona:85,'Atletico Madrid':83,Sevilla:72,Valencia:70,'Real Sociedad':75}}]},
      {name:'Italy', leagues:[{name:'Serie A', base:{h:1.55,a:1.20}, teams:{Inter:88,Milan:83,Juventus:84,Napoli:82,Roma:78,Lazio:77,Atalanta:80}}]},
      {name:'Germany', leagues:[{name:'Bundesliga', base:{h:1.70,a:1.35}, teams:{Bayern:90,Dortmund:83,Leipzig:82,Leverkusen:86,Stuttgart:78,Frankfurt:76}}]},
      {name:'France', leagues:[{name:'Ligue 1', base:{h:1.55,a:1.20}, teams:{PSG:90,Marseille:78,Lyon:75,Monaco:80,Lille:79,Nice:78}}]}
    ]
  };
  let last = null;
  const $ = id => document.getElementById(id);
  const fmtP = p => `${(p*100).toFixed(1)}%`;
  const fmtO = o => Number.isFinite(o) ? o.toFixed(2) : '–';
  const factorial = [1];
  function fact(n){ for(let i=factorial.length;i<=n;i++) factorial[i]=factorial[i-1]*i; return factorial[n]; }
  function pois(k,mu){ return Math.exp(-mu)*Math.pow(mu,k)/fact(k); }
  function matrix(muH,muA,max=10){
    const rho = parseFloat($('rho').value || '0');
    const m = []; let sum=0;
    if(rho > 0){
      const l3 = Math.min(muH,muA)*rho, l1=muH-l3, l2=muA-l3;
      for(let h=0;h<=max;h++){ m[h]=[]; for(let a=0;a<=max;a++){ let p=0; for(let k=0;k<=Math.min(h,a);k++) p += pois(h-k,l1)*pois(a-k,l2)*pois(k,l3); m[h][a]=p; sum+=p; } }
    } else {
      for(let h=0;h<=max;h++){ m[h]=[]; for(let a=0;a<=max;a++){ const p=pois(h,muH)*pois(a,muA); m[h][a]=p; sum+=p; } }
    }
    for(let h=0;h<=max;h++) for(let a=0;a<=max;a++) m[h][a] /= sum;
    return m;
  }
  function probs(m){
    let pH=0,pD=0,pA=0,pO25=0,pU25=0,pBtts=0;
    for(let h=0;h<m.length;h++) for(let a=0;a<m.length;a++){
      const p=m[h][a]; if(h>a)pH+=p; else if(h===a)pD+=p; else pA+=p;
      if(h+a>2.5)pO25+=p; else pU25+=p; if(h>0&&a>0)pBtts+=p;
    }
    return {pH,pD,pA,pO25,pU25,pBtts};
  }
  function selectedLeague(){ const c=catalog.countries.find(x=>x.name===$('country').value); return c.leagues.find(x=>x.name===$('league').value); }
  function fill(el, arr){ el.innerHTML = arr.map(x=>`<option>${x}</option>`).join(''); }
  function initSelects(){
    fill($('country'), catalog.countries.map(c=>c.name));
    $('country').onchange = () => { fillLeagues(); compute(); };
    $('league').onchange = () => { fillTeams(); compute(); };
    $('home').onchange = compute; $('away').onchange = compute;
    fillLeagues();
  }
  function fillLeagues(){ const c=catalog.countries.find(x=>x.name===$('country').value); fill($('league'), c.leagues.map(l=>l.name)); fillTeams(); }
  function fillTeams(){ const l=selectedLeague(); const teams=Object.keys(l.teams); fill($('home'), teams); fill($('away'), teams.slice(1).concat(teams[0])); }
  function estimate(){
    const l=selectedLeague(), base=l.base, h=$('home').value, a=$('away').value;
    if(h===a) return null;
    const sh=(l.teams[h]||75)-75, sa=(l.teams[a]||75)-75;
    const muH=Math.max(.05, base.h*Math.exp((sh-sa)/200));
    const muA=Math.max(.05, base.a*Math.exp((sa-sh)/200));
    return {muH,muA};
  }
  function compute(){
    const est=estimate(); if(!est) return;
    const m=matrix(est.muH, est.muA), p=probs(m); last={...est,...p,m};
    $('muH').textContent=est.muH.toFixed(2); $('muA').textContent=est.muA.toFixed(2);
    $('p1x2').textContent=`${fmtP(p.pH)} / ${fmtP(p.pD)} / ${fmtP(p.pA)}`;
    $('pGoals').textContent=`O2.5 ${fmtP(p.pO25)} • BTTS ${fmtP(p.pBtts)}`;
    $('debug').textContent=`Mátrix OK • ρ=${parseFloat($('rho').value).toFixed(2)}`;
    const rows=[['1',p.pH],['X',p.pD],['2',p.pA],['Over 2.5',p.pO25],['Under 2.5',p.pU25],['BTTS Yes',p.pBtts],['BTTS No',1-p.pBtts]];
    $('fairRows').innerHTML=rows.map(r=>`<tr><td>${r[0]}</td><td>${fmtO(1/r[1])}</td></tr>`).join('');
    $('marketPick').innerHTML=rows.map(r=>`<option value="${r[1]}">${r[0]} (${fmtP(r[1])})</option>`).join('');
  }
  function ev(odds,p){return odds*p-1} function kelly(odds,p){ const b=odds-1; return Math.max(0,(b*p-(1-p))/b); }
  function cls(v){ return v>=.15?'ok':v>=.02?'warn':'bad'; }
  function valueCalc(){ const p=parseFloat($('marketPick').value), o=parseFloat($('bookOdds').value); const e=ev(o,p), k=Math.min(.05,kelly(o,p)); $('valueBox').innerHTML=`Valószínűség: <b>${fmtP(p)}</b><br>Fair odds: <b>${fmtO(1/p)}</b><br>EV: <b class="${cls(e)}">${(e*100).toFixed(1)}%</b><br>Javasolt max stake: <b>${(k*100).toFixed(2)}%</b>`; addJournal('Manuális',o,p,e,k); }
  function addJournal(market,o,p,e,k){ const d=new Date().toISOString().slice(0,10); $('journal').querySelector('tbody').insertAdjacentHTML('afterbegin',`<tr><td>${d}</td><td>${market}</td><td>${o.toFixed(2)}</td><td>${fmtP(p)}</td><td>${(e*100).toFixed(1)}%</td><td>${(k*100).toFixed(2)}%</td></tr>`); }
  function sim(){ if(!last) compute(); const cells=[]; for(let h=0;h<last.m.length;h++) for(let a=0;a<last.m.length;a++) cells.push({h,a,p:last.m[h][a]}); cells.sort((a,b)=>b.p-a.p); const top=cells.slice(0,12); $('simSummary').textContent=`Top 12 lefedettség: ${fmtP(top.reduce((s,x)=>s+x.p,0))}`; $('simGrid').innerHTML=top.map(x=>`<div class="mini"><b>${x.h}-${x.a}</b><br><span class="muted">${fmtP(x.p)}</span></div>`).join(''); }
  function combo(){
    if(!last) compute(); const target=parseFloat($('targetOdds').value), legs=parseInt($('legs').value), minEV=parseFloat($('minEV').value);
    const markets=[['1',1.55,last.pH],['X',3.4,last.pD],['2',2.8,last.pA],['Over 2.5',1.85,last.pO25],['Under 2.5',1.95,last.pU25],['BTTS Yes',1.8,last.pBtts],['BTTS No',1.9,1-last.pBtts]].map(x=>({market:x[0],odds:x[1],p:x[2],ev:ev(x[1],x[2])})).filter(x=>x.ev>=minEV);
    if(markets.length<legs){$('comboBox').innerHTML='<div class="result">Kevés pozitív EV jelölt.</div>';return;}
    let best=null, diff=1e9; const rec=(start,pick)=>{ if(pick.length===legs){ const o=pick.reduce((s,x)=>s*x.odds,1), d=Math.abs(o-target); if(d<diff){diff=d; best=[...pick];} return;} for(let i=start;i<markets.length;i++) rec(i+1,pick.concat(markets[i]));}; rec(0,[]);
    const o=best.reduce((s,x)=>s*x.odds,1), p=best.reduce((s,x)=>s*x.p,1), e=ev(o,p), k=Math.min(.05,kelly(o,p));
    $('comboBox').innerHTML=`<div class="result"><b>${legs} lábas kombi</b><br>Odds: ${o.toFixed(2)} • P: ${fmtP(p)} • EV: <span class="${cls(e)}">${(e*100).toFixed(1)}%</span> • Stake: ${(k*100).toFixed(2)}%<ul>${best.map(x=>`<li>${x.market} — odds ${x.odds.toFixed(2)} — p ${fmtP(x.p)}</li>`).join('')}</ul></div>`; addJournal(`Kombi ${legs}L`,o,p,e,k);
  }
  function backtest(){
    const rows=$('btCsv').value.trim().split(/\r?\n/).slice(1).map(l=>l.split(',').map(x=>x.trim())).filter(r=>r.length>=5).map(r=>({date:r[0],market:r[1],odds:+r[2],p:+r[3],y:+r[4]})).filter(r=>r.odds>1&&r.p>=0&&r.p<=1&&(r.y===0||r.y===1));
    let pnl=0,hits=0,brier=0,ll=0; rows.forEach(r=>{pnl += r.y ? r.odds-1 : -1; hits+=r.y; brier+=(r.p-r.y)**2; ll += -(r.y*Math.log(Math.max(1e-9,r.p))+(1-r.y)*Math.log(Math.max(1e-9,1-r.p)));});
    const n=rows.length; $('btSummary').innerHTML=n?`N=${n} • Hit ${(hits/n*100).toFixed(1)}% • ROI ${(pnl/n*100).toFixed(1)}% • Brier ${(brier/n).toFixed(4)} • LogLoss ${(ll/n).toFixed(4)}`:'Nincs érvényes sor';
    $('btTable').innerHTML='<table><thead><tr><th>Dátum</th><th>Piac</th><th>Odds</th><th>P</th><th>Eredmény</th></tr></thead><tbody>'+rows.map(r=>`<tr><td>${r.date}</td><td>${r.market}</td><td>${r.odds}</td><td>${fmtP(r.p)}</td><td>${r.y}</td></tr>`).join('')+'</tbody></table>';
  }
  function exportJournal(){ const rows=[...$('journal').querySelectorAll('tr')].map(tr=>[...tr.children].map(td=>td.textContent).join(',')).join('\n'); const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([rows],{type:'text/csv'})); a.download='tipppro-journal.csv'; a.click(); URL.revokeObjectURL(a.href); }
  function tabs(){ document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>{ document.querySelectorAll('.tabs button').forEach(x=>x.classList.remove('active')); document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active')); b.classList.add('active'); $(`tab-${b.dataset.tab}`).classList.add('active'); }); }
  window.addEventListener('DOMContentLoaded',()=>{ tabs(); initSelects(); compute(); $('rho').oninput=()=>{$('rhoVal').textContent=(+$('rho').value).toFixed(2);compute();}; $('calcValue').onclick=valueCalc; $('runSim').onclick=sim; $('genCombo').onclick=combo; $('runBt').onclick=backtest; $('exportJournal').onclick=exportJournal; $('btnReset').onclick=()=>{localStorage.clear();sessionStorage.clear();location.reload();}; });
})();
