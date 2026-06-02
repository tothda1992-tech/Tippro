
export const toast = (msg)=>{
  const el = document.getElementById('toast');
  el.textContent = msg; el.style.display='block';
  setTimeout(()=>{ el.style.display='none'; }, 2400);
};
export const spin = (on)=>{
  const el = document.getElementById('spin');
  el.style.display = on ? 'flex' : 'none';
};
