(function(){
"use strict";
const pin="180702",key="peachub-preview-unlocked-v1";
let allowed=false;try{allowed=sessionStorage.getItem(key)==="1"}catch{}
if(allowed){document.documentElement.classList.remove("peach-locked");return}
function start(){if(document.getElementById("peach-gate"))return;
const gate=document.createElement("div");gate.id="peach-gate";gate.innerHTML='<div class="peach-gate-card"><img class="peach-gate-logo" src="/logo.svg" alt="PEACHUB" width="280" height="66"><h1>SITO IN COSTRUZIONE</h1><p>Stiamo preparando qualcosa di speciale.<br>Accesso riservato durante i lavori.</p><form class="peach-gate-form" id="peach-gate-form"><input id="peach-gate-pin" name="pin" type="password" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="off" placeholder="PIN di accesso" aria-label="PIN di accesso" required><button type="submit">Entra</button></form><div class="peach-gate-error" role="alert" id="peach-gate-error"></div><p class="peach-gate-small">PEACHUB · Magazine</p></div>';
document.body.prepend(gate);
document.getElementById("peach-gate-form").addEventListener("submit",e=>{e.preventDefault();const field=document.getElementById("peach-gate-pin");if(field.value===pin){try{sessionStorage.setItem(key,"1")}catch{}document.documentElement.classList.remove("peach-locked");gate.remove()}else{document.getElementById("peach-gate-error").textContent="PIN non corretto";field.value="";field.focus()}});
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
})();