// v2.0/expo/app.js
// @ts-nocheck
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

const db = window.firebaseDb;
const app = document.getElementById('expoApp');
const body = document.getElementById('expoBody');

const sizeMap = { sm:'text-sm', base:'text-base', lg:'text-lg', xl:'text-xl', '2xl':'text-2xl', '3xl':'text-3xl' };
const weightMap = { normal:'font-normal', medium:'font-medium', semibold:'font-semibold', bold:'font-bold' };

function setBackground(bg){
  body.classList.remove('board-bg-image');
  body.style.background = '';
  body.style.backgroundImage = '';
  if(!bg) return;
  if(bg.type==='color') body.style.background = bg.value || '#ffffff';
  if(bg.type==='image'){
    body.classList.add('board-bg-image');
    body.style.backgroundImage = `url(${bg.value})`;
  }
}

function renderText(c){
  const w = document.createElement('div');
  w.className = `p-4 rounded-xl bg-white/85 backdrop-blur shadow ${c.align==='center'?'text-center':c.align==='right'?'text-right':'text-left'}`;
  const p = document.createElement('p');
  p.className = `${sizeMap[c.size||'base']} ${weightMap[c.weight||'normal']} text-gray-800 break-words`;
  p.textContent = c.text||'';
  w.append(p);
  return w;
}

function renderImage(c){
  const img = document.createElement('img');
  img.src = c.url; img.alt = c.alt||'';
  img.className = `w-full max-w-full ${c.rounded?'rounded-2xl':''} shadow ${c.fit==='contain'?'object-contain':'object-cover'}`;
  return img;
}

function renderProduct(c){
  const card = document.createElement('div');
  card.className = 'rounded-2xl border border-gray-200 bg-white p-4 shadow max-w-full';
  const h = document.createElement('h3'); h.className='text-lg font-semibold'; h.textContent=c.title||'';
  const d = document.createElement('p'); d.className='text-sm text-gray-600 mt-1'; d.textContent=c.desc||'';
  const row = document.createElement('div'); row.className='mt-3 flex items-center justify-between';
  const price = document.createElement('span'); price.className='text-base font-bold'; price.textContent=(c.price!=null?`€${c.price.toFixed(2)}`:'');
  const badge = document.createElement('span'); badge.className='text-xs px-2 py-1 rounded-full bg-gray-100 border'; badge.textContent=c.badge||'';
  row.append(price,badge); card.append(h,d,row); return card;
}

function renderElements(els){
  app.innerHTML = '';
  (els||[]).forEach(el=>{
    let node;
    if(el.type==='text') node = renderText(el.content||{});
    if(el.type==='image') node = renderImage(el.content||{});
    if(el.type==='product') node = renderProduct(el.content||{});
    if(node) app.append(node);
  });
}

onSnapshot(doc(db,'boards','default'), (snap)=>{
  const data = snap.data() || {};
  setBackground(data.background);
  renderElements(data.elements);
});