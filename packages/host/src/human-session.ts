/**
 * A small, dependency-free remote view of one hosted browser page. The containing host binds the
 * opaque URL to one identity and page; this file only renders the controls used to drive it.
 */
function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!,
  );
}

/** HTML for a session-bound human authentication handoff. All assets and calls stay same-origin. */
export function humanSessionPage(application: string): string {
  const app = escapeHtml(application);
  const appScript = JSON.stringify(application).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Sign in to ${app}</title>
<style>
  :root{color-scheme:light dark;--bg:#fafaf9;--panel:#fff;--fg:#1c1917;--muted:#57534e;--line:#d6d3d1;--accent:#2563eb;--ok:#166534}
  @media(prefers-color-scheme:dark){:root{--bg:#171717;--panel:#262626;--fg:#f5f5f4;--muted:#a8a29e;--line:#525252;--accent:#60a5fa;--ok:#86efac}}
  *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif}
  [hidden]{display:none!important}#complete{min-height:100dvh;place-items:center;padding:24px}.complete-card{width:min(100%,30rem);padding:32px 24px;text-align:center;border:1px solid var(--line);border-radius:14px;background:var(--panel);box-shadow:0 18px 50px #0002}.check{display:grid;place-items:center;width:54px;height:54px;margin:0 auto 16px;border-radius:50%;background:#dcfce7;color:#166534;font-size:30px;font-weight:700}.complete-card h1{font-size:22px}.complete-card p{margin-top:8px}.complete-card button{margin-top:22px;padding:10px 16px;border:0;border-radius:8px;background:var(--accent);color:#fff;font:inherit;font-weight:650;cursor:pointer}
  header{padding:18px max(16px,env(safe-area-inset-right)) 14px max(16px,env(safe-area-inset-left));border-bottom:1px solid var(--line);background:var(--panel)}
  h1{font-size:19px;margin:0 0 4px}p{margin:0;color:var(--muted)}#status{margin-top:8px;font-weight:600;color:var(--muted)}#status.done{color:var(--ok)}
  main{padding:14px max(12px,env(safe-area-inset-right)) max(24px,env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left));max-width:1280px;margin:auto}
  .screen{position:relative;background:#fff;border:1px solid var(--line);border-radius:10px;overflow:hidden;min-height:180px}
  #shot{width:100%;height:auto;display:block;user-select:none;-webkit-user-drag:none}#waiting{padding:48px 20px;text-align:center;color:#57534e}
  #fields{position:absolute;inset:0;pointer-events:none}.remote-field{position:absolute;pointer-events:auto;margin:0;border:2px solid color-mix(in srgb,var(--accent) 65%,transparent);border-radius:5px;padding:2px 7px;background:color-mix(in srgb,#fff 94%,transparent);color:#111;box-shadow:0 1px 3px #0002;font:inherit;min-width:0}.remote-field:focus{outline:3px solid color-mix(in srgb,var(--accent) 35%,transparent);border-color:var(--accent)}textarea.remote-field{resize:none}
  small{display:block;margin-top:8px;color:var(--muted)}
</style></head>
<body><section id="complete" hidden role="status" aria-live="assertive"><div class="complete-card"><div class="check" aria-hidden="true">✓</div><h1>You're signed in</h1><p>Returning you to your assistant. This window will close automatically when your browser allows it.</p><button id="close" type="button">Close this window</button></div></section>
<header><h1>Finish signing in to ${app}</h1><p>This is the private browser session your assistant is using. Your credentials stay in this page and are never sent through the conversation.</p><div id="status" role="status" aria-live="polite">Connecting to the secure session…</div></header>
<main><div class="screen" id="screen"><img id="shot" alt="The application sign-in page" draggable="false" hidden><div id="fields"></div><div id="waiting">Waiting for the application…</div></div>
<small>Type directly into the fields, tap buttons normally, and scroll or swipe the page as you usually would. This link expires shortly and controls only this private session.</small></main>
<script>
  const root=location.pathname.endsWith("/")?location.pathname.slice(0,-1):location.pathname,screen=document.getElementById("screen"),shot=document.getElementById("shot"),waiting=document.getElementById("waiting"),status=document.getElementById("status"),fields=document.getElementById("fields"),completeView=document.getElementById("complete"),header=document.querySelector("header"),main=document.querySelector("main");
  let chain=Promise.resolve(),lastUrl="",complete=false,finished=false,wheelDelta=0,wheelTimer=0,touchY=null,touchMoved=false,pollTimer=0;const values=new Map(),timers=new Map();
  function command(body,refreshAfter=true){chain=chain.then(async()=>{const r=await fetch(root+"/input",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});if(!r.ok)throw new Error();if(refreshAfter)await refresh(true)}).catch(()=>{status.textContent="The secure session could not receive that input. Try again."});return chain}
  function flush(input){const id=input.dataset.field;clearTimeout(timers.get(id));timers.delete(id);values.set(id,input.value);return command({type:"field-text",field:id,text:input.value},false)}
  function schedule(input){const id=input.dataset.field;values.set(id,input.value);clearTimeout(timers.get(id));timers.set(id,setTimeout(()=>flush(input),180))}
  function renderFields(data){if(document.activeElement?.classList.contains("remote-field"))return;const known=new Set(data.fields.map(field=>field.id));for(const key of values.keys())if(!known.has(key))values.delete(key);fields.replaceChildren();for(const field of data.fields){const input=document.createElement(field.multiline?"textarea":"input");input.className="remote-field";input.dataset.field=field.id;if(!field.multiline)input.type=field.type;input.setAttribute("aria-label",field.label||"Sign-in field");if(field.placeholder)input.placeholder=field.placeholder;if(field.autocomplete)input.autocomplete=field.autocomplete;if(field.inputmode)input.inputMode=field.inputmode;input.value=values.get(field.id)||"";input.style.left=100*field.x/data.viewport.width+"%";input.style.top=100*field.y/data.viewport.height+"%";input.style.width=100*field.width/data.viewport.width+"%";input.style.height=100*field.height/data.viewport.height+"%";input.addEventListener("focus",()=>command({type:"field-focus",field:field.id},false));input.addEventListener("input",()=>schedule(input));input.addEventListener("blur",()=>flush(input));input.addEventListener("keydown",event=>{if(event.key==="Enter"&&!field.multiline){event.preventDefault();flush(input).then(()=>command({type:"key",key:"Enter"}))}});fields.append(input)}}
  async function loadFields(){if(complete||document.activeElement?.classList.contains("remote-field"))return;const r=await fetch(root+"/fields",{cache:"no-store"});if(r.ok)renderFields(await r.json())}
  function finish(){if(finished)return;finished=true;clearInterval(pollTimer);fields.replaceChildren();values.clear();document.title="Signed in to "+${appScript};header.hidden=true;main.hidden=true;completeView.hidden=false;try{if(window.opener&&!window.opener.closed)window.opener.focus()}catch{}setTimeout(()=>window.close(),650)}
  async function refresh(force=false){try{const s=await fetch(root+"/status",{cache:"no-store"});if(!s.ok)throw new Error();const state=await s.json();complete=state.complete;if(complete){finish();return}status.textContent=state.path?"Secure session: "+state.path:"Secure session is ready";status.className="";const u=root+"/screenshot.png?n="+(force?Date.now():Math.floor(Date.now()/700));if(u!==lastUrl||force){lastUrl=u;const image=await fetch(u,{cache:"no-store"});if(image.ok){const next=URL.createObjectURL(await image.blob()),old=shot.src;shot.onload=()=>{if(old)URL.revokeObjectURL(old)};shot.src=next;shot.hidden=false;waiting.hidden=true;await loadFields()}}}catch{status.textContent="This sign-in link expired or the session ended.";shot.hidden=true;fields.replaceChildren();waiting.hidden=false;waiting.textContent="Return to your assistant and ask it to try again."}}
  shot.addEventListener("click",e=>{if(touchMoved){touchMoved=false;return}const r=shot.getBoundingClientRect();command({type:"pointer",x:(e.clientX-r.left)*shot.naturalWidth/r.width,y:(e.clientY-r.top)*shot.naturalHeight/r.height})});
  function scroll(y){wheelDelta+=y;clearTimeout(wheelTimer);wheelTimer=setTimeout(()=>{const amount=Math.max(-2000,Math.min(2000,wheelDelta));wheelDelta=0;command({type:"wheel",y:amount})},80)}
  screen.addEventListener("wheel",event=>{event.preventDefault();scroll(event.deltaY)},{passive:false});
  screen.addEventListener("touchstart",event=>{touchY=event.touches[0]?.clientY??null;touchMoved=false},{passive:true});
  screen.addEventListener("touchmove",event=>{if(touchY===null)return;const next=event.touches[0]?.clientY??touchY,delta=touchY-next;if(Math.abs(delta)>2){event.preventDefault();touchMoved=true;scroll(delta*2);touchY=next}},{passive:false});
  screen.addEventListener("touchend",()=>{touchY=null;setTimeout(()=>{touchMoved=false},350)});
  document.getElementById("close").addEventListener("click",()=>{try{if(window.opener&&!window.opener.closed)window.opener.focus()}catch{}window.close()});
  refresh(true);pollTimer=setInterval(()=>refresh(false),700);
</script></body></html>`;
}

/** Context shown before a production handoff authenticates the person at the provider. */
export function humanSessionLoginPage(application: string, signInUrl: string): string {
  const app = escapeHtml(application);
  const href = escapeHtml(signInUrl);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Connect ${app}</title><style>:root{color-scheme:light dark}body{font:16px/1.5 system-ui,sans-serif;max-width:36rem;margin:12vh auto;padding:0 1.5rem}p{opacity:.75}a{display:inline-block;margin-top:1rem;padding:.75rem 1rem;border-radius:.55rem;background:#2563eb;color:#fff;text-decoration:none;font-weight:600}</style></head><body><h1>Finish signing in to ${app}</h1><p>Your assistant reached ${app}, but its private browser session is signed out. Continue to verify that this session belongs to you, then sign in on the application's own page. Your credentials will not be sent through the conversation.</p><a href="${href}">Continue securely</a></body></html>`;
}
