
export const RAPID_API_KEY = window.__RAPID_KEY__ || "";
export const API_BASE = 'https://api-football-v1.p.rapidapi.com/v3';
export const HEADERS = {
  'X-RapidAPI-Key': RAPID_API_KEY,
  'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
};
export const META_TTL = 24*60*60*1000;   // 24h
export const ODDS_TTL = 2*60*60*1000;    // 2h
