import { fetchCatalog, fetchOddsOrProbs } from './adapter_integrated.js';
(function(){
  const rootId='hybApp';
  if(document.getElementById(rootId)) return; // avoid double init

  // inject container at top of body
  const container = document.createElement('div');
  container.id = rootId;
  container.innerHTML = `
  <style>
  #hybApp{border-bottom:1px solid #1a2437;background:#0a1322;color:#e8eef8;font:14px/1.4 system-ui}
  #hybApp .bar{display:flex;gap:8px;flex-wrap:wrap;padding:10px 12px;align-items:center}
  #hybApp .bar .build{margin-left:auto;opacity:.8;font-size:12px}
  #hybApp .tabs{display:flex;gap:8px;padding:0 12px 10px}
  #hybApp .tabs button{background:#152137;border:1px solid #253653;color:#e8eef8;border-radius:10px;padding:8px 10px;cursor:pointer}
  #hybApp .tabs .active{background:#4aa3ff;color:#06101f}
  #hybApp .body{padding:12px;background:#0b1220}
  #hybApp .tab{display:none} #hybApp .tab.active{display:block}
  #hybApp .row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
  #hybApp select,#hybApp input,#hybApp button{background:#0d1524;border:1px solid #253653;color:#e8eef8;border-radius:10px;padding:8px}
  #hybApp .card{background:#111a2c;border:1px solid #1a2437;border-radius:12px;padding:10px;margin:10px 0}
  #hybApp table{width:100%;border-collapse:collapse} #hybApp th,#hybApp td{border-bottom:1px solid #1a2437;padding:6px;text-align:left}
  #hybApp .stack{display:grid;gap:10px}
  #hybApp .mono{font-family:ui-monospace,Consolas,Menlo,monospace}
  </style>
  <div class="bar">
    <b>⚽ TippPro Hybrid+ integrált • fix56</b>
    <span class="build">beépítve: v11 fix23 alap • ${new Date().toLocaleString()}</span>
  </div>
  <div class="tabs">
    <button data-tab="an" class="active">Elemző</button>
    <button data-tab="sl">Ajánló</button>
    <button data-tab="sim">Szimulátor</button>
    <button data-tab="comb">Kombinátor</button>
    <button data-tab="bt">Visszateszt</button>
    <button id="hybRefresh" style="margin-left:auto">Frissítés most</button>
    <button id="hybApi" class="accent">Frissítés (API)</button>
  </div>
  <div class="body">
    <section id="tab-an" class="tab active">
      <div class="card">
        <div class="row">
          <label>Ország<select id="hybCountry"></select></label>
          <label>Liga<select id="hybLeague"></select></label>
          <label>Hazai<select id="hybHome"></select></label>
          <label>Vendég<select id="hybAway"></select></label>
          <button id="hybCalc">Számolás</button>
          <button id="hybAdd">Meccs hozzáadása</button>
        </div>
        <div class="row mono">
          <span>μH: <b id="hybMuH">–</b></span>
          <span>μA: <b id="hybMuA">–</b></span>
          <span>P(H/D/A): <b id="hyb1x2">–</b></span>
          <span>O2.5/BTTS: <b id="hybPOU">–</b></span>
        </div>
        <div id="hybMarkets"></div>
      </div>
      <div class="card">
        <h4>Meccslista</h4>
        <div id="hybList" class="stack"></div>
      </div>
    </section>
    <section id="tab-sl" class="tab">
      <div class="card">
        <div class="row">
          <label>Ország<select id="slCountry"></select></label>
          <label>Liga<select id="slLeague"></select></label>
          <label>Min EV<input id="slMinEV" type="number" value="0.02" step="0.01"/></label>
          <label>Top N<input id="slTop" type="number" value="8" step="1"/></label>
          <button id="hybSuggest">Ajánlások</button>
        </div>
        <div id="slOut" class="stack"></div>
      </div>
    </section>
    <section id="tab-sim" class="tab">
      <div class="card">
        <div class="row"><label>Futások <input id="simRuns" type="number" value="5000" step="500"/></label><button id="hybSim">Futtatás</button></div>
        <div id="simOut" class="mono"></div>
      </div>
    </section>
    <section id="tab-comb" class="tab">
      <div class="card">
        <div class="row">
          <label>Cél odds<input id="goalOdds" type="number" value="4.0" step="0.1"/></label>
          <label>Események<input id="legs" type="number" value="3" min="2" max="10"/></label>
          <label>Min EV/leg<input id="minEV" type="number" value="0.02" step="0.01"/></label>
          <label>Kelly cap<input id="kellyCap" type="number" value="0.25" step="0.01"/></label>
          <button id="hybComb">Ajánlatok</button>
        </div>
        <div id="combOut" class="stack"></div>
      </div>
    </section>
    <section id="tab-bt" class="tab">
      <div class="card">
        <div class="row">
          <label>Odds margin<input id="btMargin" type="number" value="1.05" step="0.01"/></label>
          <label>Alap tét (Ft)<input id="btStake" type="number" value="1000" step="100"/></label>
          <label>Kelly cap<input id="btKelly" type="number" value="0.25" step="0.01"/></label>
          <button id="btSL">Backtest Shortlist</button>
          <button id="btML">Backtest Meccslista</button>
        </div>
        <div id="btOut" class="mono"></div>
      </div>
    </section>
  </div>`;
  document.body.insertBefore(container, document.body.firstChild);

  // Logic
  const $ = (s)=>container.querySelector(s);
  const $$ = (s)=>Array.from(container.querySelectorAll(s));

  // tabs
  $$('.tabs button[data-tab]').forEach(b=>b.addEventListener('click',()=>{
    $$('.tabs button[data-tab]').forEach(x=>x.classList.remove('active')); b.classList.add('active');
    $$('.tab').forEach(x=>x.classList.remove('active')); container.querySelector('#tab-'+b.dataset.tab).classList.add('active');
  }));

  // refresh buttons
  $('#hybRefresh').onclick = ()=>{ try{ if('caches' in window){ caches.keys().then(keys=>keys.forEach(k=>caches.delete(k))); } localStorage.clear(); }catch(e){} location.reload(true); };
  $('#hybApi').onclick = async ()=>{
    const res = await fetchCatalog();
    const inf = document.createElement('div'); inf.className='card';
    inf.textContent = res.online ? 'API online: országlista (demo) betöltve.' : 'API nem elérhető → seed marad.';
    container.querySelector('.body').prepend(inf);
  };

  // load seed
  let DB = null; const MATCHES=[]; let SHORTLIST=[];
  (async()=>{
    DB = await (await fetch('data/football_seed.json')).json();
    fill('#hybCountry','#hybLeague','#hybHome','#hybAway');
    fill('#slCountry','#slLeague');
  })();

  function fill(selC, selL, selH, selA){
    const c=$(selC), l=$(selL), h=selH?$(selH):null, a=selA?$(selA):null;
    c.innerHTML = `<option value="">Válassz…</option>` + Object.keys(DB.countries).sort().map(x=>`<option>${x}</option>`).join('');
    c.onchange = ()=>{
      const leagues = Object.keys(DB.countries[c.value]?.leagues||{}).sort();
      l.innerHTML = `<option value="">Válassz…</option>` + leagues.map(x=>`<option>${x}</option>`).join('');
      if(h) h.innerHTML='<option></option>'; if(a) a.innerHTML='<option></option>';
    };
    if(l && (h||a)){
      l.onchange = ()=>{
        const teams = DB.countries[c.value]?.leagues?.[l.value]?.teams || [];
        if(h) h.innerHTML = `<option value="">Válassz…</option>` + teams.map(t=>`<option>${t}</option>`).join('');
        if(a) a.innerHTML = `<option value="">Válassz…</option>` + teams.map(t=>`<option>${t}</option>`).join('');
      };
    }
  }

  function poisson(lambda,k){ return Math.exp(-lambda)*Math.pow(lambda,k)/fact(k); }
  const factMemo={0:1}; function fact(n){ if(factMemo[n]) return factMemo[n]; let r=1; for(let i=1;i<=n;i++) r*=i; factMemo[n]=r; return r; }
  function probs(muH, muA){
    let pH=0,pD=0,pA=0,pO25=0,pBT=0, max=10;
    for(let h=0;h<=max;h++){ for(let a=0;a<=max;a++){
      const p = poisson(muH,h)*poisson(muA,a);
      if(h>a) pH+=p; else if(h===a) pD+=p; else pA+=p;
      if(h+a>2) pO25+=p;
      if(h>0 && a>0) pBT+=p;
    }}
    const s=pH+pD+pA; pH/=s; pD/=s; pA/=s;
    return {pH,pD,pA,pO25,pBT};
  }
  const pct = x => (x*100).toFixed(1)+'%';
  const fairOf = p => p>0? 1/p : 999;

  // analyzer
  $('#hybCalc').onclick = async ()=>{
    const c=$('#hybCountry').value, l=$('#hybLeague').value, h=$('#hybHome').value, a=$('#hybAway').value;
    if(!c||!l||!h||!a||h===a){ alert('Válassz mindent és különböző csapatokat.'); return; }
    const {muH, muA} = await fetchOddsOrProbs(c,l,h,a);
    $('#hybMuH').textContent = muH.toFixed(2);
    $('#hybMuA').textContent = muA.toFixed(2);
    const P = probs(muH, muA);
    $('#hyb1x2').textContent = `${pct(P.pH)} / ${pct(P.pD)} / ${pct(P.pA)}`;
    $('#hybPOU').textContent  = `O2.5 ${pct(P.pO25)} • BTTS ${pct(P.pBT)}`;
    renderMarkets(P);
  };
  $('#hybAdd').onclick = async ()=>{
    const c=$('#hybCountry').value, l=$('#hybLeague').value, h=$('#hybHome').value, a=$('#hybAway').value;
    if(!c||!l||!h||!a||h===a){ alert('Válassz mindent és különböző csapatokat.'); return; }
    const {muH, muA} = await fetchOddsOrProbs(c,l,h,a);
    const P = probs(muH, muA);
    MATCHES.push({country:c, league:l, home:h, away:a, P});
    renderList();
  };

  function renderMarkets(P){
    const items=[
      {name:'1', p:P.pH},{name:'X', p:P.pD},{name:'2', p:P.pA},
      {name:'Over 2.5', p:P.pO25},{name:'BTTS Igen', p:P.pBT},
      {name:'DC 1X', p:P.pH+P.pD},{name:'DC 12', p:P.pH+P.pA},{name:'DC X2', p:P.pD+P.pA},
      {name:'DNB Hazai', p:P.pH/(1-P.pD)},{name:'DNB Vendég', p:P.pA/(1-P.pD)}];
    let html = `<div class="card"><table><thead><tr><th>#</th><th>Piac</th><th>P</th><th>Fair</th><th>EV (2.00)</th></tr></thead><tbody>`;
    items.forEach((m,i)=>{
      const fair = m.p>0 ? (1/m.p).toFixed(2) : '-';
      const ev = 2*m.p-1;
      const cls = ev>0.02 ? 'style="color:#2ecc71"' : (ev>-0.05 ? 'style="color:#ffcc66"' : 'style="color:#ff6b6b"');
      html += `<tr><td>${i+1}</td><td>${m.name}</td><td>${pct(m.p)}</td><td>${fair}</td><td ${cls}>${(ev*100).toFixed(1)}%</td></tr>`;
    });
    html += `</tbody></table></div>`;
    $('#hybMarkets').innerHTML = html;
  }
  function renderList(){
    const box = $('#hybList');
    if(!MATCHES.length){ box.innerHTML='<span class="mono" style="opacity:.7">Nincs meccs.</span>'; return; }
    box.innerHTML = MATCHES.map(m=>`<div class="mono card">
      <b>${m.country} • ${m.league}</b> — ${m.home} vs ${m.away}<br/>
      P(H/D/A) ${pct(m.P.pH)} / ${pct(m.P.pD)} / ${pct(m.P.pA)} | O2.5 ${pct(m.P.pO25)} • BTTS ${pct(m.P.pBT)}
    </div>`).join('');
  }

  // shortlist
  $('#hybSuggest').onclick = ()=>{
    const c=$('#slCountry').value, l=$('#slLeague').value;
    const minEV=parseFloat($('#slMinEV').value||'0.02');
    const topN=Math.max(1,parseInt($('#slTop').value||'8',10));
    if(!c||!l){ alert('Válassz országot és ligát.'); return; }
    const teams = DB.countries[c]?.leagues?.[l]?.teams||[];
    const ratings = DB.countries[c]?.leagues?.[l]?.ratings||{};
    const suggestions=[];
    for(let i=0;i<teams.length;i++){
      for(let j=0;j<teams.length;j++){
        if(i===j) continue;
        const home=teams[i], away=teams[j];
        const base = DB.meta.base_mu||1.3;
        const adj = 1/(1+Math.exp(-((ratings[home]||1500)-(ratings[away]||1500))/250));
        let muH = base + 0.6*(adj-0.5); let muA = base - 0.6*(adj-0.5);
        const P = probs(muH, muA);
        const ev1=2*P.pH-1, evO=2*P.pO25-1, evB=2*P.pBT-1;
        const score = (P.pH*0.55 + P.pO25*0.25 + P.pBT*0.20) + Math.max(0,ev1)*0.2 + Math.max(0,evO)*0.1 + Math.max(0,evB)*0.05;
        const choices=[{m:'1',p:P.pH,ev:ev1},{m:'Over 2.5',p:P.pO25,ev:evO},{m:'BTTS Igen',p:P.pBT,ev:evB}].sort((a,b)=>b.ev-a.ev);
        const best=choices[0];
        if(best.ev>=minEV) suggestions.push({country:c,league:l,home,away,P,score,pick:best.m,p:best.p,ev:best.ev,fair:1/best.p});
      }
    }
    suggestions.sort((a,b)=>b.score-a.score);
    SHORTLIST = suggestions.slice(0, topN);
    const box = $('#slOut');
    if(!SHORTLIST.length){ box.innerHTML='<div class="mono" style="opacity:.7">Nincs jelzés a küszöb felett.</div>'; return; }
    box.innerHTML = SHORTLIST.map(s=>`<div class="card">
      <div><b>${s.country} • ${s.league}</b> — ${s.home} vs ${s.away} • Tipp: <b>${s.pick}</b></div>
      <div class="mono">p=${pct(s.p)} • fair≈${s.fair.toFixed(2)} • EV≈${(s.ev*100).toFixed(1)}%</div>
      <div style="margin-top:6px"><button class="addBtn">Hozzáadás</button></div>
    </div>`).join('');
    $('#slOut').querySelectorAll('.addBtn').forEach((btn,idx)=>btn.addEventListener('click',()=>{
      const s=SHORTLIST[idx]; MATCHES.push({country:s.country,league:s.league,home:s.home,away:s.away,P:s.P}); renderList();
    }));
  };

  // simulator
  $('#hybSim').onclick = ()=>{
    if(!MATCHES.length){ $('#simOut').textContent='Adj hozzá meccset előbb.'; return; }
    const runs = Math.max(500, parseInt($('#simRuns').value||'5000',10));
    const m = MATCHES[MATCHES.length-1];
    let H=0,D=0,A=0;
    for(let i=0;i<runs;i++){
      const r=Math.random();
      if(r<m.P.pH) H++; else if(r<m.P.pH+m.P.pD) D++; else A++;
    }
    $('#simOut').textContent = `${m.home}—${m.away} • H ${(H/runs*100).toFixed(1)}% • D ${(D/runs*100).toFixed(1)}% • A ${(A/runs*100).toFixed(1)}%`;
  };

  // combinator with correlation guard
  $('#hybComb').onclick = ()=>{
    const legs = Math.max(2, parseInt($('#legs').value||'3',10));
    const minEV = parseFloat($('#minEV').value||'0.02');
    const pool=[];
    MATCHES.forEach(m=>{
      const opts=[ {label:'1', p:m.P.pH},{label:'X', p:m.P.pD},{label:'2', p:m.P.pA},{label:'Over 2.5', p:m.P.pO25},{label:'BTTS Igen', p:m.P.pBT} ];
      opts.forEach(o=>{ const ev=2*o.p-1; if(ev>=minEV) pool.push({key:`${m.home}|${m.away}`,m, pick:o.label, p:o.p, ev, fair:1/o.p}); });
    });
    pool.sort((a,b)=>b.ev-a.ev);
    const chosen=[]; const used=new Set();
    for(const c of pool){ if(used.has(c.key)) continue; chosen.push(c); used.add(c.key); if(chosen.length>=legs) break; }
    const out=$('#combOut'); out.innerHTML='';
    if(chosen.length<legs){ out.textContent='Kevés korreláció-mentes jelölt. Adj több meccset vagy csökkentsd a Min EV-t.'; return; }
    chosen.forEach(x=>{ const d=document.createElement('div'); d.className='card mono';
      d.innerHTML = `<b>${x.m.home}—${x.m.away}</b> • ${x.pick} | p=${pct(x.p)} • fair≈${x.fair.toFixed(2)} • EV≈${(x.ev*100).toFixed(1)}%`; out.appendChild(d);
    });
    const combinedFair = chosen.reduce((acc,x)=>acc*x.fair,1);
    const sum=document.createElement('div'); sum.className='card mono'; sum.innerHTML = `Kombinált fair odds ≈ <b>${combinedFair.toFixed(2)}</b> • (azonos meccs tiltva)`; out.appendChild(sum);
  };

  // backtest quick
  function runBacktest(list, margin=1.05, baseStake=1000, kellyCap=0.25){
    const bets = list.map(m=>{
      const choices = [{label:'1',p:m.P.pH},{label:'Over 2.5',p:m.P.pO25},{label:'BTTS Igen',p:m.P.pBT}]
        .map(o=>({p:o.p, fair:1/o.p, price:(1/o.p)*margin, ev: ((1/o.p)*margin)*o.p -1}))
        .sort((a,b)=>b.ev-a.ev);
      return choices[0];
    });
    let bank=0,wins=0,n=0;
    for(const b of bets){
      n++;
      const q=1-b.p; const bmult=b.price-1;
      let kelly=(bmult*b.p - q)/bmult; kelly=Math.max(0,Math.min(kellyCap,kelly));
      const stake = baseStake * (kelly>0? kelly/kellyCap : 0.2);
      const win = Math.random()<b.p;
      bank += win? stake*bmult : -stake;
      if(win) wins++;
    }
    return {n, hit: n?wins/n*100:0, profit: Math.round(bank)};
  }
  $('#btSL').onclick = ()=>{
    if(!SHORTLIST.length){ $('#btOut').textContent='Nincs shortlist — kérj ajánlást.'; return; }
    const m=parseFloat($('#btMargin').value||'1.05'), s=parseFloat($('#btStake').value||'1000'), k=parseFloat($('#btKelly').value||'0.25');
    const list = SHORTLIST.map(x=>({P:x.P}));
    const res = runBacktest(list, m, s, k);
    $('#btOut').textContent = `Shortlist backtest: n=${res.n}, találat=${res.hit.toFixed(1)}%, profit=${res.profit} Ft`;
  };
  $('#btML').onclick = ()=>{
    if(!MATCHES.length){ $('#btOut').textContent='Üres a meccslista.'; return; }
    const m=parseFloat($('#btMargin').value||'1.05'), s=parseFloat($('#btStake').value||'1000'), k=parseFloat($('#btKelly').value||'0.25');
    const res = runBacktest(MATCHES, m, s, k);
    $('#btOut').textContent = `Meccslista backtest: n=${res.n}, találat=${res.hit.toFixed(1)}%, profit=${res.profit} Ft`;
  };
})();