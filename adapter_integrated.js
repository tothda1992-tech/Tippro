import { API_KEY, API_HOST } from './config.js';
export async function fetchCatalog() {
  try {
    if(!API_KEY) throw new Error('Nincs API kulcs');
    const res = await fetch(`https://${API_HOST}/v3/countries`, {
      headers: { "X-RapidAPI-Key": API_KEY, "X-RapidAPI-Host": API_HOST }
    });
    if(res.ok){
      const data = await res.json();
      return { online:true, countries: data.response || [] };
    }
  } catch(e){}
  const seed = await (await fetch('data/football_seed.json?ts='+Date.now())).json();
  return { online:false, seed };
}
export async function fetchOddsOrProbs(country, league, home, away){
  try {
    const seed = await (await fetch('data/football_seed.json?ts='+Date.now())).json();
    const lg = seed.countries?.[country]?.leagues?.[league];
    const ratings = lg?.ratings || {};
    const eloh = ratings[home] || 1500, eloa = ratings[away] || 1500;
    const base = seed.meta?.base_mu || 1.3;
    const adj = 1/(1+Math.exp(-(eloh-eloa)/250));
    let muH = base + 0.6*(adj-0.5);
    let muA = base - 0.6*(adj-0.5);
    return { muH, muA };
  } catch(e){
    return { muH: 1.4, muA: 1.2 };
  }
}
