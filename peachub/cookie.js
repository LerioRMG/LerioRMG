(function(){
"use strict";
const KEY="peachub-cookie-v1", VERSION=1;
const css=document.createElement("link");css.rel="stylesheet";css.href="/cookie.css";document.head.appendChild(css);
function read(){try{const x=JSON.parse(localStorage.getItem(KEY));return x&&x.version===VERSION&&typeof x.analytics==="boolean"&&typeof x.marketing==="boolean"?x:null}catch{return null}}
let choice=read();
function persist(analytics,marketing){choice={version:VERSION,necessary:true,analytics:!!analytics,marketing:!!marketing,updatedAt:new Date().toISOString()};try{localStorage.setItem(KEY,JSON.stringify(choice))}catch{}window.dispatchEvent(new CustomEvent("peachub:consent",{detail:choice}));hide()}
function hide(){document.querySelector("#peach-cookie-banner")?.remove();document.querySelector("#peach-cookie-backdrop")?.remove()}
function show(settings=false){
hide();
const backdrop=document.createElement("div");backdrop.className="cookie-backdrop";backdrop.id="peach-cookie-backdrop";
const banner=document.createElement("section");banner.className="cookie-banner";banner.id="peach-cookie-banner";banner.setAttribute("role","dialog");banner.setAttribute("aria-modal","true");banner.setAttribute("aria-labelledby","peach-cookie-title");
banner.innerHTML='<h2 id="peach-cookie-title">La tua privacy su PEACHUB</h2><p>Usiamo solo le funzionalità tecniche necessarie e salviamo sul dispositivo la tua scelta e la lingua. Non sono attivi strumenti pubblicitari o analitici opzionali in questa versione. Se saranno introdotti, richiederemo il consenso prima di attivarli. <a href="/cookie-policy.html" style="color:#d9f3fa;text-decoration:underline">Informativa cookie</a>.</p>'+
(settings?'<label class="cookie-choice"><span><b>Tecnici necessari</b><small>Funzionamento e preferenze essenziali, sempre attivi.</small></span><input type="checkbox" checked disabled aria-label="Necessari"></label><label class="cookie-choice"><span><b>Statistiche opzionali</b><small>Nessun servizio collegato al momento.</small></span><input id="peach-analytics" type="checkbox" '+(choice?.analytics?"checked":"")+'></label><label class="cookie-choice"><span><b>Marketing opzionale</b><small>Nessun servizio collegato al momento.</small></span><input id="peach-marketing" type="checkbox" '+(choice?.marketing?"checked":"")+'></label>':'')+
'<div class="cookie-actions"><button type="button" data-cookie="reject">Solo necessari</button>'+(settings?'<button type="button" class="primary" data-cookie="save">Salva preferenze</button>':'<button type="button" data-cookie="settings">Personalizza</button><button type="button" class="primary" data-cookie="accept">Accetta tutti</button>')+'</div>';
document.body.append(backdrop,banner);
banner.addEventListener("click",e=>{const b=e.target.closest("button[data-cookie]");if(!b)return;const action=b.dataset.cookie;if(action==="reject")persist(false,false);else if(action==="accept")persist(true,true);else if(action==="settings")show(true);else if(action==="save")persist(!!banner.querySelector("#peach-analytics")?.checked,!!banner.querySelector("#peach-marketing")?.checked)});
backdrop.addEventListener("click",()=>persist(false,false));
}
window.PeachCookies={open:()=>show(true),get:()=>choice};
document.addEventListener("click",e=>{if(e.target.closest("[data-open-cookie-settings]")){e.preventDefault();show(true)}});
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>{if(!choice)show(false)});else if(!choice)show(false);
})();