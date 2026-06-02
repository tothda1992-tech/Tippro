
import { API_BASE, HEADERS, ODDS_TTL, RAPID_API_KEY } from '../config.js';
import { bump } from './counter.js';

const cacheWrap = async (key, ttl, fn) => {
  const now = Date.now();
  const raw = localStorage.getItem(key);
  if (raw) {
    try{ const {at,data} = JSON.parse(raw); if (now - at < ttl) return data; }catch{}
  }
  const data = await fn();
  localStorage.setItem(key, JSON.stringify({at:now, data}));
  return data;
};
const J = r=>{ if(!r.ok) throw 0; return r.json(); };

const toLower = s => (s||'').toLowerCase();

const findMarket = (bets, needles=[]) => {
  const L = bets || [];
  for (const b of L){
    const name = toLower(b.name);
    if (needles.some(x=> name.includes(x))) return b;
  }
  return null;
};

const findOdd = (values, label) => {
  const L = values || [];
  const lab = toLower(label);
  const v = L.find(v=> toLower(v.value) === lab);
  return Number(v?.odd || 0);
};

const normalize = (odds) => {
  const books = odds.response?.flatMap(b=>b.bookmakers||[]) ?? [];
  const markets = books.flatMap(b=>b.bets||[]);

  const m1x2 = findMarket(markets, ['match winner','1x2']);
  const mOUg = findMarket(markets, ['goals over/under','over/under']);
  const mBTTS= findMarket(markets, ['both teams to score','btts']);
  const mOUc = findMarket(markets, ['corners']);
  const mOUcards = findMarket(markets, ['cards']);

  const out = {
    home:0, draw:0, away:0,
    over05:0,under05:0, over15:0,under15:0, over25:0,under25:0, over35:0,under35:0, over45:0,under45:0,
    bttsYes:0,bttsNo:0,
    cornOver85:0,cornUnder85:0, cornOver95:0,cornUnder95:0, cornOver105:0,cornUnder105:0,
    cardOver35:0,cardUnder35:0, cardOver45:0,cardUnder45:0, cardOver55:0,cardUnder55:0
  };

  if (m1x2){
    out.home = findOdd(m1x2.values, 'Home');
    out.draw = findOdd(m1x2.values, 'Draw');
    out.away = findOdd(m1x2.values, 'Away');
  }
  if (mOUg){
    const vals = mOUg.values||[];
    const want = ['Over 0.5','Under 0.5','Over 1.5','Under 1.5','Over 2.5','Under 2.5','Over 3.5','Under 3.5','Over 4.5','Under 4.5'];
    for (const w of want){
      const k = w.replace(' ','').replace('.','').toLowerCase();
    }
    out.over05 = findOdd(vals,'Over 0.5'); out.under05=findOdd(vals,'Under 0.5');
    out.over15 = findOdd(vals,'Over 1.5'); out.under15=findOdd(vals,'Under 1.5');
    out.over25 = findOdd(vals,'Over 2.5'); out.under25=findOdd(vals,'Under 2.5');
    out.over35 = findOdd(vals,'Over 3.5'); out.under35=findOdd(vals,'Under 3.5');
    out.over45 = findOdd(vals,'Over 4.5'); out.under45=findOdd(vals,'Under 4.5');
  }
  if (mBTTS){
    out.bttsYes = findOdd(mBTTS.values,'Yes');
    out.bttsNo  = findOdd(mBTTS.values,'No');
  }
  if (mOUc){
    const v=mOUc.values||[];
    out.cornOver85=findOdd(v,'Over 8.5'); out.cornUnder85=findOdd(v,'Under 8.5');
    out.cornOver95=findOdd(v,'Over 9.5'); out.cornUnder95=findOdd(v,'Under 9.5');
    out.cornOver105=findOdd(v,'Over 10.5'); out.cornUnder105=findOdd(v,'Under 10.5');
  }
  if (mOUcards){
    const v=mOUcards.values||[];
    out.cardOver35=findOdd(v,'Over 3.5'); out.cardUnder35=findOdd(v,'Under 3.5');
    out.cardOver45=findOdd(v,'Over 4.5'); out.cardUnder45=findOdd(v,'Under 4.5');
    out.cardOver55=findOdd(v,'Over 5.5'); out.cardUnder55=findOdd(v,'Under 5.5');
  }
  return out;
};

const hasAny = (o) => Object.values(o).some(v=>Number(v)>0);

export const fetchOddsForFixture = async ({ leagueId, season, homeTeamId, awayTeamId, live=true }) =>
  cacheWrap(`odds_${leagueId}_${season}_${homeTeamId}_${awayTeamId}_${live?'L':'D'}`, ODDS_TTL, async()=>{
    if(!live || !RAPID_API_KEY) return normalize({response:[]});
    // try next fixtures for both teams
    try{
      for (const tid of [homeTeamId, awayTeamId]){
        bump();
        const next = await fetch(`${API_BASE}/fixtures?league=${leagueId}&season=${season}&team=${tid}&next=50`, {headers:HEADERS}).then(J);
        const candN = (next.response||[]).find(x => (x.teams?.home?.id===homeTeamId && x.teams?.away?.id===awayTeamId) || (x.teams?.home?.id===awayTeamId && x.teams?.away?.id===homeTeamId));
        const fxIdN = candN?.fixture?.id;
        if (fxIdN) {
          bump();
          const oddsN = await fetch(`${API_BASE}/odds?fixture=${fxIdN}`, {headers:HEADERS}).then(J);
          const normN = normalize(oddsN);
          if (hasAny(normN)) return normN;
        }
      }
    }catch{}

    // head-to-head last
    try{
      bump();
      const h2h = await fetch(`${API_BASE}/fixtures/headtohead?h2h=${homeTeamId}-${awayTeamId}&season=${season}&last=1`, {headers:HEADERS}).then(J);
      const fxIdH = h2h.response?.[0]?.fixture?.id;
      if (fxIdH) {
        bump();
        const oddsH = await fetch(`${API_BASE}/odds?fixture=${fxIdH}`, {headers:HEADERS}).then(J);
        const normH = normalize(oddsH);
        if (hasAny(normH)) return normH;
      }
    }catch{}

    // last 30 by home
    try{
      bump();
      const last = await fetch(`${API_BASE}/fixtures?league=${leagueId}&season=${season}&team=${homeTeamId}&last=30`, {headers:HEADERS}).then(J);
      const candL = (last.response||[]).find(x => (x.teams?.home?.id===homeTeamId && x.teams?.away?.id===awayTeamId) || (x.teams?.home?.id===awayTeamId && x.teams?.away?.id===homeTeamId)) || (last.response||[])[0];
      const fxIdL = candL?.fixture?.id;
      if (fxIdL) {
        bump();
        const oddsL = await fetch(`${API_BASE}/odds?fixture=${fxIdL}`, {headers:HEADERS}).then(J);
        const normL = normalize(oddsL);
        if (hasAny(normL)) return normL;
      }
    }catch{}

    return normalize({response:[]});
  });
