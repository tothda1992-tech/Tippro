
export const samplePois = (mu)=>{
  const L=Math.exp(-mu); let k=0,p=1; do{ k++; p*=Math.random(); }while(p>L); return k-1;
};
export const runSim = (muH, muA, N=30000)=>{
  let H=0,D=0,A=0; const totals=new Map(); let btts=0; const score=new Map();
  for (let i=0;i<N;i++){
    const gh=samplePois(muH), ga=samplePois(muA);
    if (gh>ga) H++; else if (gh===ga) D++; else A++;
    const t=gh+ga; totals.set(t,(totals.get(t)||0)+1);
    if (gh>0 && ga>0) btts++;
    const key=`${gh}-${ga}`; score.set(key,(score.get(key)||0)+1);
  }
  return {
    pW:H/N, pD:D/N, pL:A/N,
    totals:[...totals.entries()].sort((a,b)=>a[0]-b[0]).map(([g,c])=>({g, p:c/N})),
    btts:btts/N,
    top:[...score.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8).map(([k,c])=>({k,p:c/N}))
  };
};
