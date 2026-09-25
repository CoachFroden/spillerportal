import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import {
  addDoc, collection, doc, getDoc, onSnapshot, query, serverTimestamp, where
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

const $=id=>document.getElementById(id);
let user=null,account=null,sessions=[],wishesUnsub=null,sessionsUnsub=null;
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const safeUrl=value=>{try{const u=new URL(value);return ["http:","https:"].includes(u.protocol)?u.href:""}catch{return""}};
const fmt=value=>value?new Date(value+"T12:00:00").toLocaleDateString("no-NO",{weekday:"long",day:"numeric",month:"long"}):"";
const total=s=>(s.sections||[]).reduce((sum,x)=>sum+(Number(x.minutes)||0),0);
const dateBadge=value=>{const d=new Date(value+"T12:00:00");return{day:d.getDate(),month:d.toLocaleDateString("no-NO",{month:"short"}).replace(".","").toUpperCase()}};

function partHtml(part,index){
  const url=safeUrl(part.presentationUrl);
  return `<article class="part">
    <span class="partNo">${String(index+1).padStart(2,"0")}</span>
    <div>
      <div class="partTop"><strong>${esc(part.title||"Øvelse")}</strong><span>${Number(part.minutes)||0} min</span></div>
      ${part.details?`<p>${esc(part.details)}</p>`:""}
      ${part.coaching?`<p class="coachPoints"><b>Fokus:</b> ${esc(part.coaching)}</p>`:""}
      ${url?`<details class="presentation"><summary>▶ Se presentasjon av øvelsen</summary><div class="presentationBody"><iframe src="${esc(url)}" loading="lazy" title="Taktikktavle"></iframe><a href="${esc(url)}" target="_blank" rel="noopener">Åpne i fullskjerm ↗</a></div></details>`:""}
    </div>
  </article>`;
}
function sessionHtml(s){
  return `<article class="trainingCard">
    <div class="trainingCardHead">
      <div class="trainingCardMeta"><span class="trainingDate">${esc(fmt(s.date))}</span><span class="trainingMinutes">${total(s)} min</span></div>
      <h3>${esc(s.title||"Trening")}</h3>
      ${s.focus?`<p class="trainingFocus">${esc(s.focus)}</p>`:""}
      ${s.intro?`<p class="trainingIntro">${esc(s.intro)}</p>`:""}
    </div>
    <div class="parts">${(s.sections||[]).map(partHtml).join("")||'<div class="smallEmpty">Øvelsene kommer snart.</div>'}</div>
  </article>`;
}
function renderSessions(){
  const today=new Date().toISOString().slice(0,10);
  const upcoming=sessions.filter(s=>(s.date||"9999")>=today).sort((a,b)=>(a.date||"").localeCompare(b.date||""));
  const next=upcoming[0];
  if(!next){
    $("nextDate").textContent="";
    $("nextSession").innerHTML='<div class="loadingCard">Ingen publisert trening ennå.</div>';
    $("laterSessions").innerHTML='<div class="smallEmpty">Ingen flere publiserte økter.</div>';
    return;
  }
  $("nextDate").textContent=fmt(next.date);
  $("nextSession").innerHTML=sessionHtml(next);
  const later=upcoming.slice(1);
  $("laterSessions").innerHTML=later.length?later.map(s=>{
    const d=dateBadge(s.date);
    return `<div class="laterCard"><div class="laterDate"><b>${d.day}</b><small>${d.month}</small></div><div><strong>${esc(s.title)}</strong><span>${esc(s.focus||"Treningsøkt")} · ${total(s)} min</span></div><span>›</span></div>`;
  }).join(""):'<div class="smallEmpty">Ingen flere publiserte økter.</div>';
}
function startSessions(){
  sessionsUnsub?.();
  const q=query(collection(db,"trainingSessions"),where("published","==",true));
  sessionsUnsub=onSnapshot(q,snap=>{
    sessions=snap.docs.map(d=>({id:d.id,...d.data()}));
    renderSessions();
  },e=>{console.error(e);$("nextSession").innerHTML='<div class="loadingCard">Kunne ikke hente treninger. Tilgangen må oppdateres.</div>'});
}
const statusText={new:"Sendt",considering:"Vurderes",planned:"Planlagt",used:"Brukt"};
function renderWishes(items){
  $("myWishCount").textContent=`${items.length} sendt`;
  $("myWishes").innerHTML=items.length?items.map(w=>`<div class="myWish"><div><strong>${esc(w.category||"Ønske")}</strong><small>${esc(w.text||"")}</small></div><span class="wishStatus ${esc(w.status||"new")}">${statusText[w.status]||"Sendt"}</span></div>`).join(""):'<div class="smallEmpty">Ingen ønsker sendt ennå.</div>';
}
function startWishes(){
  wishesUnsub?.();
  const q=query(collection(db,"trainingWishes"),where("uid","==",user.uid));
  wishesUnsub=onSnapshot(q,snap=>{
    const items=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
    renderWishes(items);
  },e=>{console.error(e);$("myWishes").innerHTML='<div class="smallEmpty">Kunne ikke hente ønskene dine.</div>'});
}
$("wishForm").onsubmit=async e=>{
  e.preventDefault();
  if(!user||!account)return;
  const text=$("wishText").value.trim();
  if(text.length<3)return;
  const btn=$("wishSubmit");btn.disabled=true;btn.textContent="Sender …";$("wishMessage").textContent="";
  try{
    await addDoc(collection(db,"trainingWishes"),{
      uid:user.uid,
      playerId:account.playerId,
      playerName:account.name||user.displayName||"Spiller",
      category:$("wishCategory").value,
      text,
      status:"new",
      createdAt:serverTimestamp()
    });
    $("wishText").value="";
    $("wishMessage").textContent="Ønsket er sendt til trener ✓";
  }catch(err){console.error(err);$("wishMessage").textContent="Kunne ikke sende. Tilgangen må oppdateres."}
  finally{btn.disabled=false;btn.textContent="Send ønske →"}
};

onAuthStateChanged(auth,async current=>{
  sessionsUnsub?.();wishesUnsub?.();user=current;
  if(!current){location.href="index.html";return}
  const snap=await getDoc(doc(db,"playerAccounts",current.uid));
  if(!snap.exists()||!snap.data().approved||!snap.data().playerId){location.href="index.html";return}
  account=snap.data();
  $("playerName").textContent=(account.name||"Spiller").split(" ")[0];
  startSessions();startWishes();
});