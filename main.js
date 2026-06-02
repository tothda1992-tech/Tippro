
import { RAPID_API_KEY } from './services/../config.js';
import { getCountries, getLeagues, getTeams, estimateMuLive } from './services/meta.js';
import { fetchOddsForFixture } from './services/odds.js';
import { calcMarkets, winProbs, kelly } from './services/model.js';
import { runSim } from './services/sim.js';
import { toast, spin } from './services/ui.js';
import { reset as resetCounter } from './services/counter.js';

const $ = s=>document.querySelector(s);
const els = {
  country:$('#country'), league:$('#league'), season:$('#season'),
  home:$('#home'), away:$('#away'),
  add:$('#btnAdd'), analyze:$('#btnAnalyze'), clear:$('#btnClear'), refresh:$('#btnRefresh'),
  list:$('#matchList'), table:$('#resultTable'),
  useLiveMu:$('#useLiveMu'), useLiveOdds:$('#useLiveOdds'), evOnly:$('#evOnly'), btnSortEV:$('#btnSortEV'),
  msg:$('#msg')
};

// Tabs
[...document.querySelectorAll('.tab[data-tab]')].forEach(b=>b.onclick=()=>{
  [...document.querySelectorAll('.tab[data-tab]')].forEach(x=>x.classList.toggle('active',x===b));
  ['an','sim','help'].forEach(id=>$('#tab-'+id).hidden = (b.dataset.tab!==id));
});

// Populate meta + restore list
const state={ matches: JSON.parse(localStorage.getItem('matches_v9p')||'[]') };
(async ()=>{
  try{
    spin(true);
    resetCounter();
    const countries = (await getCountries()).sort((a,b)=>a.name.localeCompare(b.name));
    fill(els.country, countries, x=>x.name, x=>x.name);
    els.country.onchange = async ()=>{
      const leagues = await getLeagues(els.country.value); fill(els.league, leagues);
      els.league.dispatchEvent(new Event('change'));
    };
    els.league.onchange = async ()=>{
      const teams = await getTeams(els.league.value, els.season.value);
      fill(els.home, teams); fill(els.away, teams);
    };
    els.season.onchange = ()=> els.league.dispatchEvent(new Event('change'));
    els.country.dispatchEvent(new Event('change'));
    toast('Meta adatok betöltve');
  }catch(e){ console.error(e); toast('Meta hiba (fallback)'); }
  finally{ spin(false); }
  renderList();
})();

function fill(sel, arr, getText=x=>x.name, getVal=x=>x.id??x.name){
  sel.innerHTML=''; arr.forEach(a=>{const o=document.createElement('option'); o.value=getVal(a); o.textContent=getText(a); sel.appendChild(o);});
}

els.add.onclick = ()=>{
  const m={
    country:els.country.value, leagueId:Number(els.league.value), season:Number(els.season.value),
    homeTeamId:Number(els.home.value), awayTeamId:Number(els.away.value),
    label:`${els.home.selectedOptions[0]?.text} – ${els.away.selectedOptions[0]?.text}`
  };
  if(!m.leagueId || !m.homeTeamId || !m.awayTeamId) { toast('Válaszd ki a csapatokat'); return; }
  state.matches.push(m); persist(); renderList();
};
els.clear.onclick = ()=>{ state.matches=[]; persist(); renderList(); };
function persist(){ localStorage.setItem('matches_v9p', JSON.stringify(state.matches)); }
function renderList(){
  els.list.innerHTML='';
  state.matches.forEach((m,i)=>{
    const li=document.createElement('li'); li.textContent = `#${i+1} ${m.label}`;
    const rm=document.createElement('button'); rm.className='rm'; rm.textContent='Törlés'; rm.onclick=()=>{ state.matches.splice(i,1); persist(); renderList(); };
    li.appendChild(rm); els.list.appendChild(li);
  });
}

// Analyze
els.analyze.onclick = async ()=>{
  if(!state.matches.length){ toast('Nincs meccs a listában'); return; }
  els.table.innerHTML='';
  spin(true);
  try{
    for (const m of state.matches){
      let muH=1.6, muA=1.2;
      if (els.useLiveMu.checked){
        muH = await estimateMuLive(m.homeTeamId);
        muA = await estimateMuLive(m.awayTeamId);
      }
      const odds = await fetchOddsForFixture({...m, live:els.useLiveOdds.checked});
      const rows = calcMarkets({muH,muA,odds:odds||{}});
      const filtered = els.evOnly.checked ? rows.filter(r=>Number.isFinite(r.ev) && r.ev>0) : rows;
      const h=document.createElement('h3'); h.textContent=m.label + `  (μH=${muH.toFixed(2)}, μA=${muA.toFixed(2)})`;
      const t=document.createElement('table'); t.innerHTML=`<thead>
        <tr><th>#</th><th>Piac</th><th>Tipp</th><th>Model %</th><th>Odds</th><th>EV%</th><th>Kelly</th></tr>
      </thead><tbody></tbody>`;
      const tb=t.querySelector('tbody');
      filtered.forEach((r,i)=>{
        const cls = !isFinite(r.ev)? '': (r.ev>0?'green':(r.ev>-5?'yellow':'red'));
        const k = (Number.isFinite(r.o) && r.o>0) ? kelly(r.p, r.o) : NaN;
        const tr=document.createElement('tr');
        tr.innerHTML = `<td class="mono">${i+1}</td><td>${r.m}</td><td>${r.t}</td>
                        <td class="mono">${(r.p*100).toFixed(1)}%</td>
                        <td class="mono">${r.o||'-'}</td>
                        <td class="mono ${cls}">${isFinite(r.ev)?r.ev.toFixed(1):'-'}%</td>
                        <td class="mono">${isFinite(k)?(k*100).toFixed(1)+'%':'-'}</td>`;
        tb.appendChild(tr);
      });
      els.table.append(h,t);
      drawCharts({muH,muA});
    }
  }catch(e){ console.error(e); toast('Elemzés hiba'); }
  finally{ spin(false); }
};

// Sort EV
els.btnSortEV.onclick = ()=>{
  const tables = els.table.querySelectorAll('table tbody');
  tables.forEach(tb=>{
    const rows = Array.from(tb.querySelectorAll('tr'));
    rows.sort((a,b)=> parseFloat(b.children[5].textContent) - parseFloat(a.children[5].textContent));
    rows.forEach(r=>tb.appendChild(r));
  });
};

// Charts
let c1,c2,c3;
function drawCharts({muH,muA}){
  const {pH,pD,pA}=winProbs(muH,muA);
  if (c1) c1.destroy();
  c1=new Chart(document.getElementById('chart1x2'),{type:'pie',data:{labels:['Hazai','Döntetlen','Vendég'],datasets:[{data:[pH,pD,pA]}]},options:{plugins:{legend:{position:'bottom'}}}});

  if (c2) c2.destroy();
  const maxG=6, labels=Array.from({length:maxG+1},(_,i)=>i);
  const pois=(mu,k)=> Math.exp(-mu)*Math.pow(mu,k)/fact(k);
  const home=labels.map(k=>pois(muH,k)), away=labels.map(k=>pois(muA,k));
  c2=new Chart(document.getElementById('chartGoals'),{type:'bar',data:{labels,datasets:[{label:'Hazai',data:home},{label:'Vendég',data:away}]},options:{plugins:{legend:{position:'bottom'}}}});

  if (c3) c3.destroy();
  const radarLabels=['1','X','2','Over2.5','Under2.5','BTTS_Y','BTTS_N'];
  const over25 = 1/(1+Math.exp(-(muH+muA-2.5))); const under25 = 1-over25;
  const btts = Math.min(.97, (1-Math.exp(-muH))*(1-Math.exp(-muA)));
  c3=new Chart(document.getElementById('chartRadar'),{type:'radar',data:{labels:radarLabels,datasets:[{data:[pH,pD,pA,over25,under25,btts,1-btts]}]},options:{plugins:{legend:{display:false}}}});
}
const fact=(n)=>n<=1?1:n*fact(n-1);

// Refresh cache
els.refresh.onclick=()=>{ localStorage.clear(); location.reload(); };

// SIM
let s1,s2;
$('#btnSim').onclick=()=>{
  const muH=Number($('#muH').value), muA=Number($('#muA').value), N=Number($('#runs').value);
  const R=runSim(muH,muA,N);

  if (s1) s1.destroy();
  s1=new Chart($('#chartSimWDL'),{type:'bar',data:{labels:['Hazai','Döntetlen','Vendég'],datasets:[{data:[R.pW,R.pD,R.pL]}]},options:{plugins:{legend:{display:false}}}});

  if (s2) s2.destroy();
  const totLabels=R.totals.map(x=>x.g), totVals=R.totals.map(x=>x.p);
  s2=new Chart($('#chartSimTotals'),{type:'bar',data:{labels:totLabels,datasets:[{data:totVals}]},options:{plugins:{legend:{display:false}}}});

  $('#topScorelines').innerHTML = R.top.map(t=>`<div>${t.k}: ${(100*t.p).toFixed(2)}%</div>`).join('');
};

// Kelly
$('#btnKelly').onclick=()=>{
  const p = Number($('#kellyP').value||0), o=Number($('#kellyO').value||0);
  const frac = Math.max(0, Math.min(1, (p*o - (1-p)) / (o-1) ));
  $('#kellyOut').value = (frac*100).toFixed(2)+'%';
  const bank = Number($('#bank').value||0);
  $('#kellyStake').value = bank? (bank*frac).toFixed(2): '—';
};


// fix20d debug helpers
function scoreColor(s){ if(s>=85) return 'teal'; if(s>=70) return 'seagreen'; if(s>=40) return 'goldenrod'; return 'crimson'; }
function renderCombos(){
  const box = document.getElementById('comboList'); if(!box) return;
  const items = [1,2,3].map(i=>{
    const odds = 3.6 + 0.2*i; const p = 0.25 + 0.05*i; const EV = odds*p - 1;
    const score = Math.round(100*(0.5*p + 0.5*Math.max(0,EV)));
    return `<div class="card combo"><h4>Kombi #${i}</h4>
      <p><b>Odds:</b> ${odds.toFixed(2)} | <b>p:</b> ${(p*100).toFixed(1)}% | <b>EV:</b> ${(EV*100).toFixed(1)}%</p>
      <p><b>Pontszám:</b> <span style="color:${scoreColor(score)}">${score}</span></p></div>`;
  });
  box.innerHTML = items.join('');
}
document.getElementById('genCombosBtn')?.addEventListener('click', renderCombos);
async function loadChangelog(){
  try{
    const res = await fetch('./data/changelog.json'); const items = await res.json();
    const box = document.getElementById('changelogList'); if(!box) return;
    box.innerHTML = items.map(v=>`<div class="card"><h4>${v.version} <small>${v.date}</small></h4>`+
      `<ul class="bullets">${v.entries.map(e=>`<li>${e.text}</li>`).join('')}</ul></div>`).join('');
  }catch(e){ console.warn('Changelog hiba', e); }
}
document.addEventListener('click', (e)=>{
  const a = e.target.closest('a.tab[data-tab]');
  if(!a) return;
  const n = a.dataset.tab;
  if(n==='comb') renderCombos();
  if(n==='changelog') loadChangelog();
});


// fix21 universal router
(function(){
  function showTab(name){
    ['an','sim','help'].forEach(function(id){
      var el = document.getElementById('tab-'+id);
      if(el){ el.hidden = (id!==name); }
    });
    ['comb','journal','sports','changelog'].forEach(function(id){
      var el = document.getElementById('tab-'+id);
      if(el){ el.classList.toggle('active', id===name); }
    });
    try{ history.replaceState(null,'','#tab-'+name); }catch(e){}
  }
  document.addEventListener('click', function(e){
    var trg = e.target.closest('.tab[data-tab]'); if(!trg) return;
    e.preventDefault(); showTab(trg.dataset.tab);
  });
  window.addEventListener('DOMContentLoaded', function(){
    var h = (location.hash||'').replace('#tab-','');
    if(['an','sim','help','comb','journal','sports','changelog'].indexOf(h)>=0) showTab(h);
  });
  window.__showTab = showTab;
})();


// fix23: very loud init for Kombinator
(function(){
  function debug(msg){
    console.log('[fix23]', msg);
    var b = document.getElementById('debugBanner'); if(b){ b.textContent = '[fix23] ' + msg; }
  }
  debug('main.js betöltve');
  function scoreColor(s){ if(s>=85) return 'teal'; if(s>=70) return 'seagreen'; if(s>=40) return 'goldenrod'; return 'crimson'; }
  function renderCombos(){
    debug('renderCombos fut');
    const box = document.getElementById('comboList'); if(!box){ debug('comboList HIÁNYZIK'); return; }
    const items = [1,2,3].map(i=>{
      const odds = 3.4 + 0.2*i; const p = 0.28 + 0.04*i; const EV = odds*p - 1;
      const score = Math.round(100*(0.5*p + 0.5*Math.max(0,EV)));
      return `<div class="card combo"><h4>Kombi #${i}</h4>
        <p><b>Odds:</b> ${odds.toFixed(2)} | <b>p:</b> ${(p*100).toFixed(1)}% | <b>EV:</b> ${(EV*100).toFixed(1)}%</p>
        <p><b>Pontszám:</b> <span style="color:${scoreColor(score)}">${score}</span></p></div>`;
    });
    box.innerHTML = items.join('');
    debug('renderCombos kész ('+items.length+' kártya)');
  }
  window.addEventListener('DOMContentLoaded', ()=>{
    debug('DOMContentLoaded');
    document.getElementById('genCombosBtn')?.addEventListener('click', renderCombos);
    // auto-render on load so hogy látszódjon
    renderCombos();
  });
})();
