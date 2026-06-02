
export let calls = 0;
export const bump = ()=>{ calls++; const e=document.getElementById('apiStat'); if(e) e.textContent = `API: ${calls}`; };
export const reset = ()=>{ calls=0; const e=document.getElementById('apiStat'); if(e) e.textContent = `API: ${calls}`; };
