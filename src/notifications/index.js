if(typeof window==='undefined'){ try{ globalThis.window = globalThis.window || { dispatchEvent:()=>{}, addEventListener:()=>{} }; globalThis.CustomEvent = globalThis.CustomEvent || class CustomEvent{ constructor(t,o){ this.type=t; this.detail=o?.detail } }; }catch{} }
if(typeof document==='undefined'){ try{ globalThis.document = { getElementById:()=>null, createElement:()=>({ style:{}, setAttribute:()=>{}, appendChild:()=>{} }), body:{ appendChild:()=>{} } }; }catch{} }
export const notify = {
  success(msg){ console.log('[notify success]',msg); window.dispatchEvent(new CustomEvent('dever:notify',{detail:{type:'success',msg}})) },
  error(msg){ console.log('[notify error]',msg); window.dispatchEvent(new CustomEvent('dever:notify',{detail:{type:'error',msg}})) },
  warn(msg){ console.log('[notify warn]',msg); window.dispatchEvent(new CustomEvent('dever:notify',{detail:{type:'warn',msg}})) },
  info(msg){ console.log('[notify info]',msg); window.dispatchEvent(new CustomEvent('dever:notify',{detail:{type:'info',msg}})) }
};

function ensureToastContainer(){
  let el = document.getElementById('dever-toast-container');
  if(!el){
    el = document.createElement('div');
    el.id = 'dever-toast-container';
    document.body.appendChild(el);
  }
  return el;
}

if(typeof window !== 'undefined'){
  window.addEventListener('dever:notify', (e)=>{
    try{
      const detail = e.detail || {};
      const type = detail.type || 'info';
      const msg = detail.msg || '';
      const container = ensureToastContainer();
      const toast = document.createElement('div');
      toast.className = 'toast';
      toast.textContent = msg;
      toast.setAttribute('role','status');
      toast.setAttribute('aria-live','polite');
      if(type==='success') toast.style.borderLeft = '3px solid var(--accent-green)';
      else if(type==='error') toast.style.borderLeft = '3px solid var(--accent-red)';
      else if(type==='warn') toast.style.borderLeft = '3px solid var(--accent-yellow)';
      else toast.style.borderLeft = '3px solid var(--accent-cyan)';
      container.appendChild(toast);
      setTimeout(()=>{
        toast.style.opacity='0';
        toast.style.transition='opacity 200ms';
        setTimeout(()=>{ try{ toast.remove(); }catch{} },200);
      },3000);
    }catch{}
  });
}
