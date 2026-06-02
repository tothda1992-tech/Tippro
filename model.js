
export const toEV = (p,odds)=> (p && odds ? (p*odds-1)*100 : NaN);
export const kelly = (p,o)=> Math.max(0, Math.min(1, (p*o - (1-p)) / (o-1) ));

const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const sigmoid = x => 1/(1+Math.exp(-x));
export const winProbs = (muH,muA)=>{
  const pH = sigmoid(muH-muA);
  const pD = Math.max(0, .25 - Math.abs(muH-muA)*.06);
  const pA = Math.max(0, 1-pH-pD);
  const s = pH+pD+pA; return {pH:pH/s,pD:pD/s,pA:pA/s};
};
export const totalsProbs = (muH, muA, lines=[0.5,1.5,2.5,3.5,4.5])=>{
  const mu = muH+muA;
  const over = L=> 1/(1+Math.exp(-(mu - L)));
  const res={}; lines.forEach(L=>{ const k=String(L).replace('.',''); const pOver = over(L); res['over'+k]=pOver; res['under'+k]=1-pOver; });
  return res;
};
export const bttsProb = (muH, muA)=>{
  const pHomeScore = 1 - Math.exp(-muH);
  const pAwayScore = 1 - Math.exp(-muA);
  return Math.min(.97, pHomeScore * pAwayScore);
};

const genericOU = (mu, lines)=>{
  const out={};
  lines.forEach(L=>{ const key=String(L).replace('.',''); const pOver= 1/(1+Math.exp(-(mu-L))); out['over'+key]=pOver; out['under'+key]=1-pOver; });
  return out;
};

export const calcMarkets = ({muH,muA,odds})=>{
  const out=[]; const {pH,pD,pA}=winProbs(muH,muA);
  out.push({m:'1', t:'Hazai',    p:pH, o:odds.home, ev:toEV(pH,odds.home)});
  out.push({m:'X', t:'Döntetlen',p:pD, o:odds.draw, ev:toEV(pD,odds.draw)});
  out.push({m:'2', t:'Vendég',   p:pA, o:odds.away, ev:toEV(pA,odds.away)});

  // Double Chance
  out.push({m:'DC', t:'1X', p:pH+pD, o:null, ev:NaN});
  out.push({m:'DC', t:'12', p:pH+pA, o:null, ev:NaN});
  out.push({m:'DC', t:'X2', p:pD+pA, o:null, ev:NaN});

  // DNB
  out.push({m:'DNB', t:'Hazai',  p:pH/(pH+pA), o:null, ev:NaN});
  out.push({m:'DNB', t:'Vendég', p:pA/(pH+pA), o:null, ev:NaN});

  // Totals goals
  const tp = totalsProbs(muH,muA,[0.5,1.5,2.5,3.5,4.5]);
  [['0.5','05'],['1.5','15'],['2.5','25'],['3.5','35'],['4.5','45']].forEach(([txt,key])=>{
    out.push({m:`O/U ${txt}`, t:'Over',  p:tp['over'+key],  o:odds['over'+key],  ev:toEV(tp['over'+key], odds['over'+key])});
    out.push({m:`O/U ${txt}`, t:'Under', p:tp['under'+key], o:odds['under'+key], ev:toEV(tp['under'+key], odds['under'+key])});
  });

  // BTTS
  const pBTTS = bttsProb(muH,muA);
  out.push({m:'BTTS', t:'Igen', p:pBTTS,     o:odds.bttsYes, ev:toEV(pBTTS,odds.bttsYes)});
  out.push({m:'BTTS', t:'Nem',  p:1-pBTTS,   o:odds.bttsNo,  ev:toEV(1-pBTTS,odds.bttsNo)});

  // Corners (heurisztikus μ a gólvárható alapján)
  const muCorners = clamp(8 + 0.8*((muH+muA)-2.5), 6, 12);
  const cp = genericOU(muCorners, [8.5,9.5,10.5]);
  [['8.5','85'],['9.5','95'],['10.5','105']].forEach(([txt,key])=>{
    out.push({m:`Szögletek O/U ${txt}`, t:'Over',  p:cp['over'+key],  o:odds['cornOver'+key],  ev:toEV(cp['over'+key], odds['cornOver'+key])});
    out.push({m:`Szögletek O/U ${txt}`, t:'Under', p:cp['under'+key], o:odds['cornUnder'+key], ev:toEV(cp['under'+key], odds['cornUnder'+key])});
  });

  // Cards (heurisztikus μ)
  const muCards = clamp(4.2 + 0.35*((muH+muA)-2.5), 3, 6.5);
  const cardp = genericOU(muCards, [3.5,4.5,5.5]);
  [['3.5','35'],['4.5','45'],['5.5','55']].forEach(([txt,key])=>{
    out.push({m:`Lapok O/U ${txt}`, t:'Over',  p:cardp['over'+key],  o:odds['cardOver'+key],  ev:toEV(cardp['over'+key], odds['cardOver'+key])});
    out.push({m:`Lapok O/U ${txt}`, t:'Under', p:cardp['under'+key], o:odds['cardUnder'+key], ev:toEV(cardp['under'+key], odds['cardUnder'+key])});
  });

  return out;
};
