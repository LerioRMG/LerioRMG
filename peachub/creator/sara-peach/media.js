(function(){
"use strict";
const photos=[
{src:"https://fanslistitalia.it/uploads/gallery/5641049b735c4d841fe72421.jpg",alt:"Sara Peach, fotografia 1 dalla galleria FansList"},
{src:"https://fanslistitalia.it/uploads/gallery/370cf3e5d3030e8dfac32b9a.jpg",alt:"Sara Peach, fotografia 2 dalla galleria FansList"},
{src:"https://fanslistitalia.it/uploads/gallery/0ba44f358afd98da3f39e401.jpg",alt:"Sara Peach, fotografia 3 dalla galleria FansList"},
{src:"https://fanslistitalia.it/uploads/gallery/0456556cd14fbfb02f24ec06.jpg",alt:"Sara Peach, fotografia 4 dalla galleria FansList"},
{src:"https://fanslistitalia.it/uploads/gallery/fa9174752e14433c54847af1.jpg",alt:"Sara Peach, fotografia 5 dalla galleria FansList"}
];
const $=selector=>document.querySelector(selector);
const gallery=$("#sara-gallery"),modal=$("#sara-lightbox"),photo=$("#sara-lightbox-image"),counter=$("#sara-lightbox-count");
if(!gallery||!modal)return;
let index=0,previousFocus=null,touchX=null;
$("#photo-total").textContent=String(photos.length);
gallery.innerHTML=photos.map((p,i)=>'<button type="button" data-photo="'+i+'" aria-label="Apri fotografia '+(i+1)+' di '+photos.length+'"><img src="'+p.src+'" alt="'+p.alt+'" loading="'+(i<2?"eager":"lazy")+'" referrerpolicy="no-referrer"></button>').join("");
function show(i){index=(i+photos.length)%photos.length;photo.src=photos[index].src;photo.alt=photos[index].alt;counter.textContent=(index+1)+" / "+photos.length;}
function open(i){previousFocus=document.activeElement;show(i);modal.hidden=false;document.body.style.overflow="hidden";modal.querySelector(".lightbox-close").focus();}
function close(){modal.hidden=true;photo.removeAttribute("src");document.body.style.overflow="";previousFocus?.focus();}
gallery.addEventListener("click",event=>{const button=event.target.closest("button[data-photo]");if(button)open(Number(button.dataset.photo));});
modal.querySelector(".lightbox-close").onclick=close;
modal.querySelector(".lightbox-prev").onclick=()=>show(index-1);
modal.querySelector(".lightbox-next").onclick=()=>show(index+1);
modal.addEventListener("click",event=>{if(event.target===modal)close()});
modal.addEventListener("touchstart",e=>{touchX=e.changedTouches[0]?.clientX??null},{passive:true});
modal.addEventListener("touchend",e=>{if(touchX===null)return;const delta=(e.changedTouches[0]?.clientX??touchX)-touchX;if(Math.abs(delta)>45)show(index+(delta<0?1:-1));touchX=null},{passive:true});
document.addEventListener("keydown",event=>{if(modal.hidden)return;if(event.key==="Escape"){event.preventDefault();close()}else if(event.key==="ArrowRight"){event.preventDefault();show(index+1)}else if(event.key==="ArrowLeft"){event.preventDefault();show(index-1)}else if(event.key==="Tab"){const items=[...modal.querySelectorAll("button")];if(event.shiftKey&&document.activeElement===items[0]){event.preventDefault();items[items.length-1].focus()}else if(!event.shiftKey&&document.activeElement===items[items.length-1]){event.preventDefault();items[0].focus()}}});
document.querySelectorAll(".media-tab").forEach(tab=>tab.addEventListener("click",()=>{
const isPhotos=tab.dataset.panel==="photos";
document.querySelectorAll(".media-tab").forEach(t=>{const active=t===tab;t.classList.toggle("selected",active);t.setAttribute("aria-selected",String(active))});
$("#panel-photos").hidden=!isPhotos;$("#panel-videos").hidden=isPhotos;
if(isPhotos)document.querySelectorAll(".video-card video").forEach(v=>v.pause());
}));
const videoList=$("#sara-video-gallery"),empty=$("#sara-video-empty");
function safeMedia(url){try{const u=new URL(url,location.href);return u.origin===location.origin&&["http:","https:"].includes(u.protocol)?u.href:null}catch{return null}}
fetch("/creator/sara-peach/videos.json",{cache:"no-store"}).then(r=>r.ok?r.json():[]).then(videos=>{
const approved=Array.isArray(videos)?videos.filter(v=>v&&v.approved===true&&v.explicit===false&&safeMedia(v.src)):[];
$("#video-total").textContent=String(approved.length);
if(!approved.length)return;
empty.hidden=true;
for(const item of approved){
const wrap=document.createElement("article");wrap.className="video-card";
const video=document.createElement("video");video.controls=true;video.preload="none";video.playsInline=true;video.src=safeMedia(item.src);
if(safeMedia(item.poster))video.poster=safeMedia(item.poster);
const text=document.createElement("p");text.textContent=String(item.caption||"Video di Sara Peach").slice(0,300);
wrap.append(video,text);videoList.append(wrap);
}
}).catch(()=>{});
})();