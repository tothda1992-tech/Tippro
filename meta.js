
import { API_BASE, HEADERS, META_TTL, RAPID_API_KEY } from '../config.js';
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
const j = r=>{ if(!r.ok) throw 0; return r.json(); };

export const getCountries = () => cacheWrap('c_all', META_TTL, async()=>{
  try{
    if(!RAPID_API_KEY) throw 0;
    bump();
    const r = await fetch(`${API_BASE}/countries`, {headers:HEADERS}).then(j);
    return r.response?.map(x=>({name:x.name, code:x.code})) ?? [];
  }catch{
    const r = await fetch('./data/countries.json').then(j);
    return r;
  }
});

export const getLeagues = (country) => cacheWrap('l_'+country, META_TTL, async()=>{
  try{
    if(!RAPID_API_KEY) throw 0;
    bump();
    const r = await fetch(`${API_BASE}/leagues?country=${encodeURIComponent(country)}`, {headers:HEADERS}).then(j);
    return r.response?.map(x=>({id:x.league.id, name:x.league.name})) ?? [];
  }catch{
    const r = await fetch('./data/leagues.json').then(j);
    return r[country] ?? [];
  }
});

export const getTeams = (leagueId, season) => cacheWrap(`t_${leagueId}_${season}`, META_TTL, async()=>{
  try{
    if(!RAPID_API_KEY) throw 0;
    bump();
    const r = await fetch(`${API_BASE}/teams?league=${leagueId}&season=${season}`, {headers:HEADERS}).then(j);
    return r.response?.map(x=>({id:x.team.id, name:x.team.name})) ?? [];
  }catch{
    const r = await fetch('./data/teams.json').then(j);
    return r[`${leagueId}_${season}`] ?? [];
  }
});

// Élő μ: utolsó 10 meccs rúgott gólátlaga
export const estimateMuLive = async (teamId) => {
  try{
    if(!RAPID_API_KEY) throw 0;
    bump();
    const r = await fetch(`${API_BASE}/fixtures?team=${teamId}&last=10`, {headers:HEADERS}).then(j);
    const games = r.response ?? [];
    if(!games.length) return 1.3;
    let goals=0;
    games.forEach(g=>{
      const isHome = g.teams?.home?.id === teamId;
      const gf = isHome ? (g.goals?.home??0) : (g.goals?.away??0);
      goals += gf;
    });
    return Math.max(0.2, goals / games.length);
  }catch{
    return 1.3;
  }
};
