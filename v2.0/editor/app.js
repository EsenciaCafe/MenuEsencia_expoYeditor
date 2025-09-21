// v2.0/editor/app.js
// @ts-nocheck
import { doc, getDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";
import { getStorage, ref as sRef, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-storage.js";

const db = window.firebaseDb;
const refBoard = doc(db,'boards','default');
const storage = getStorage(); // usa la app ya inicializada en shared/firebase.js

// Si en shared/firebase.js definiste window.firebaseAuthReady, lo usamos.
// Si no, caemos a una promesa resuelta para no romper.
const authReady = window.firebaseAuthReady || Promise.resolve();

const $ = (id)=> document.getElementById(id);
const setStatus = (t)=>{ const s=$('status'); if(!s) return; s.textContent=t; setTimeout(()=>{const s2=$('status'); if(s2) s2.textContent='Listo';},900); };

function uid(){ return 'el_'+Math.random().toString(36).slice(2,8); }

/* ===================== Firestore helpers ===================== */
async function ensureDoc(){
    const snap = await getDoc(refBoard);
    if (!snap.exists()) {
      await authReady; // asegúrate de tener request.auth != null
      try {
        await setDoc(refBoard, { background:{type:'color', value:'#ffffff'}, elements:[] });
      } catch (e) {
        // si algo raro, reintenta una vez más tras authReady
        await authReady;
        await setDoc(refBoard, { background:{type:'color', value:'#ffffff'}, elements:[] });
      }
    }
  }
  async function load(){
    await authReady;
    await ensureDoc();
    const snap = await getDoc(refBoard);
    return snap.data();
  }

/* ===================== UI utils ===================== */
function btn(text, onClick, cls=''){
  const b=document.createElement('button');
  b.className=('px-3 py-1 rounded-lg border bg-white hover:bg-slate-50 ' + cls).trim();
  b.type='button'; b.textContent=text; b.onclick=onClick; return b;
}

// Truncar URL/strings largas para que no empujen los botones
function prettyUrl(url){
  if(!url) return 'Imagen';
  try{
    const u = new URL(url);
    const path = u.pathname.length > 30 ? u.pathname.slice(0,30) + '…' : u.pathname;
    return `${u.hostname}${path}`;
  }catch{
    return url.length>40 ? url.slice(0,40)+'…' : url;
  }
}

function summarize(el){
  if(el.type==='text') return (el.content?.text||'Texto vacío').slice(0,60);
  if(el.type==='image') return prettyUrl(el.content?.url);
  if(el.type==='product') return `${el.content?.title||'Producto'} — €${(el.content?.price??0).toFixed(2)}`;
  return el.id;
}
// ===================== Media Library Helpers =====================
let __mediaCache = null;
async function loadMedia() {
  if (__mediaCache) return __mediaCache;
  try {
    const res = await fetch('../media/index.json', { cache: 'no-store' });
    const data = await res.json();
    __mediaCache = Array.isArray(data.images) ? data.images : [];
  } catch (e) {
    console.warn('No se pudo cargar media/index.json', e);
    __mediaCache = [];
  }
  return __mediaCache;
}

async function openMediaPicker(onPick) {
  const dlg = document.getElementById('mediaModal');
  const grid = document.getElementById('mediaGrid');
  const btnClose = document.getElementById('mediaClose');

  grid.innerHTML = '<p class="text-sm text-slate-500">Cargando…</p>';
  dlg.showModal();
  document.body.classList.add('overflow-hidden');

  btnClose.onclick = () => { dlg.close(); document.body.classList.remove('overflow-hidden'); };

  const images = await loadMedia();
  grid.innerHTML = '';
  if (!images.length) {
    grid.innerHTML = '<p class="text-sm text-slate-500">No hay imágenes en /media. Añade archivos y actualiza index.json.</p>';
    return;
  }

  images.forEach(img => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'border rounded-xl overflow-hidden bg-white hover:shadow focus:ring-2 focus:ring-black';
    card.onclick = () => {
      onPick?.(img);
      dlg.close();
      document.body.classList.remove('overflow-hidden');
    };

    const thumb = document.createElement('img');
    thumb.src = `../media/${(img.src || '').replace(/^\.\//, '')}`;
    thumb.alt = img.alt || img.name || '';
    thumb.className = 'w-full h-28 object-cover';

    const caption = document.createElement('div');
    caption.className = 'px-2 py-1 text-xs text-left truncate';
    caption.textContent = img.name || img.src;

    card.append(thumb, caption);
    grid.append(card);
  });
}

/* ===================== Render lista ===================== */
function renderList(elements){
  const list = $('list'); if(!list) return; list.innerHTML='';
  (elements||[]).forEach((el, idx)=>{
    const card = document.createElement('div');
    card.className='border rounded-xl p-3 flex items-center gap-3 w-full overflow-hidden';

    const left = document.createElement('div');
    left.className='flex items-center gap-2 min-w-0 flex-1';

    const badge = document.createElement('span');
    badge.className='text-xs px-2 py-1 rounded-full bg-slate-100 border shrink-0';
    badge.textContent=el.type;

    const title = document.createElement('div');
    title.className='font-medium truncate';  // evita scroll lateral
    title.textContent=summarize(el);

    left.append(badge,title);

    const actions = document.createElement('div');
    actions.className='ml-auto flex gap-2 shrink-0';

    const up=btn('↑',()=>move(idx,idx-1));
    const down=btn('↓',()=>move(idx,idx+1));
    const edit=btn('Editar',()=>editElement(el));
    const del=btn('Eliminar',()=>removeElement(el.id));

    actions.append(up,down,edit,del);

    card.append(left,actions);
    list.append(card);
  });
}

/* ===================== Acciones ===================== */
async function refresh(){
  const data = await load();
  $('bgType').value = data.background?.type||'color';
  $('bgValue').value = data.background?.value||'#ffffff';
  renderList(data.elements||[]);
}

async function saveBg(){
  await updateDoc(refBoard,{ background:{ type:$('bgType').value, value:$('bgValue').value.trim() } });
  setStatus('Fondo guardado');
}

async function addElement(type){
  const snap=await getDoc(refBoard); const data=snap.data();
  const el={ id:uid(), type, content:{} };
  if(type==='text') el.content={ text:'Nuevo texto', align:'left', size:'base', weight:'normal' };
  if(type==='image') el.content={ url:'https://', alt:'', fit:'cover', rounded:true };
  if(type==='product') el.content={ title:'Nuevo producto', price:0, desc:'', badge:'IGIC incl.' };
  data.elements.push(el);
  await updateDoc(refBoard,{ elements:data.elements });
  await refresh();
}

async function move(from,to){
  const snap=await getDoc(refBoard); const data=snap.data();
  if(to<0||to>=data.elements.length) return;
  const [el]=data.elements.splice(from,1); data.elements.splice(to,0,el);
  await updateDoc(refBoard,{ elements:data.elements }); await refresh();
}

async function removeElement(id){
  const snap=await getDoc(refBoard); const data=snap.data();
  data.elements = data.elements.filter(e=>e.id!==id);
  await updateDoc(refBoard,{ elements:data.elements }); setStatus('Elemento eliminado'); await refresh();
}

/* ===================== Campos ===================== */
function field(label,name,value,type='text',step){
  const w=document.createElement('label'); w.className='block';
  const l=document.createElement('span'); l.className='block text-sm font-medium'; l.textContent=label;
  const i=document.createElement('input'); i.className='mt-1 w-full border rounded-lg px-3 py-2'; i.name=name; i.value=value??''; i.type=type; if(step) i.step=step;
  w.append(l,i); return w;
}
function textarea(label,name,value){
  const w=document.createElement('label'); w.className='block';
  const l=document.createElement('span'); l.className='block text-sm font-medium'; l.textContent=label;
  const i=document.createElement('textarea'); i.className='mt-1 w-full border rounded-lg px-3 py-2'; i.name=name; i.value=value??''; i.rows=4; w.append(l,i); return w;
}
function select(label,name,value,options){
  const w=document.createElement('label'); w.className='block';
  const l=document.createElement('span'); l.className='block text-sm font-medium'; l.textContent=label;
  const s=document.createElement('select'); s.className='mt-1 w-full border rounded-lg px-3 py-2'; s.name=name;
  Object.entries(options).forEach(([val,txt])=>{ const o=document.createElement('option'); o.value=val; o.textContent=txt; if(String(value)===String(val)) o.selected=true; s.append(o); });
  w.append(l,s); return w;
}

/* ============= Subida de imágenes a Firebase Storage ============= */
function uploadImage(file, onProgress){
  const safeName = file.name.replace(/\s+/g,'_');
  const path = `uploads/${Date.now()}_${safeName}`;
  const ref = sRef(storage, path);
  const task = uploadBytesResumable(ref, file, { contentType: file.type });
  return new Promise((resolve, reject)=>{
    task.on('state_changed',
      (snap)=>{
        const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
        onProgress?.(pct);
      },
      reject,
      async ()=> resolve(await getDownloadURL(task.snapshot.ref))
    );
  });
}

/* ========================= Modal ========================= */
async function editElement(el){
  const modal=$('modal'); if(!modal) return;
  const form=document.createElement('form');
  form.className='bg-white rounded-xl p-4 max-h-[80vh] overflow-auto';
  form.onsubmit = async (e)=>{ e.preventDefault(); await persist(el.id, new FormData(form)); modal.close(); };

  const fields=[];
  if(el.type==='text'){
    fields.push(field('Texto','text', el.content.text));
    fields.push(select('Alineación','align', el.content.align, {left:'Izquierda',center:'Centro',right:'Derecha'}));
    fields.push(select('Tamaño','size', el.content.size, {sm:'sm',base:'base',lg:'lg',xl:'xl','2xl':'2xl','3xl':'3xl'}));
    fields.push(select('Peso','weight', el.content.weight, {normal:'normal',medium:'medium',semibold:'semibold',bold:'bold'}));
  }
  if(el.type==='image'){
    // Inputs básicos
    fields.push(field('URL','url', el.content.url));
    fields.push(field('Alt','alt', el.content.alt));
    fields.push(select('Ajuste','fit', el.content.fit, {cover:'cover',contain:'contain'}));
    fields.push(select('Esquinas redondeadas','rounded', String(el.content.rounded), {true:'Sí', false:'No'}));

    // Botón para abrir la biblioteca de imágenes
    const pickBtn = btn('Elegir desde biblioteca', async ()=>{
      openMediaPicker((img)=>{
        const urlInput = form.querySelector('input[name="url"]');
        if (urlInput) {
          urlInput.value = `../media/${(img.src || '').replace(/^\.\//,'')}`;
        }
      });
    }, 'mt-2');
    fields.push(pickBtn);

    // Bloque de subida
    const upWrap = document.createElement('div'); upWrap.className='mt-2';
    const upLabel = document.createElement('div'); upLabel.className='text-sm font-medium mb-1'; upLabel.textContent='Subir imagen (opcional)';
    const file = document.createElement('input'); file.type='file'; file.accept='image/*'; file.className='block w-full text-sm';
    const bar = document.createElement('div'); bar.className='mt-2 h-2 w-full bg-slate-100 rounded';
    const fill = document.createElement('div'); fill.className='h-2 bg-black rounded transition-all'; fill.style.width='0%';
    bar.append(fill);
    const upBtn = btn('Subir ahora', async ()=>{
      if(!file.files?.[0]){ alert('Selecciona un archivo primero'); return; }
      try{
        upBtn.disabled = true;
        const url = await uploadImage(file.files[0], (pct)=>{ fill.style.width = pct + '%'; });
        // Rellenar el input URL con el resultado de Storage
        form.querySelector('input[name="url"]').value = url;
        setStatus('Imagen subida');
      }catch(err){
        console.error(err); alert('Error subiendo la imagen');
      }finally{
        upBtn.disabled = false;
      }
    }, 'mt-2');
    upWrap.append(upLabel, file, bar, upBtn);
    fields.push(upWrap);
  }
  if(el.type==='product'){
    fields.push(field('Título','title', el.content.title));
    fields.push(field('Precio','price', el.content.price, 'number','0.01'));
    fields.push(textarea('Descripción','desc', el.content.desc));
    fields.push(field('Insignia','badge', el.content.badge));
  }

  const grid=document.createElement('div'); grid.className='grid gap-3'; fields.forEach(f=>grid.append(f));
  const actions=document.createElement('div'); actions.className='mt-4 flex justify-end gap-2';
  const cancel=btn('Cancelar',()=>modal.close());
  const save=document.createElement('button'); save.type='submit'; save.className='px-4 py-2 rounded-lg bg-black text-white'; save.textContent='Guardar';
  actions.append(cancel,save);

  form.append(grid,actions);
  modal.innerHTML=''; modal.append(form); modal.showModal();

  // Evitar que se mueva la página al abrir el modal
  document.body.classList.add('overflow-hidden'); document.body.style.userSelect='none';
  modal.addEventListener('close', ()=>{ document.body.classList.remove('overflow-hidden'); document.body.style.userSelect=''; });
  // Cerrar al tocar fuera
  modal.addEventListener('click', (e)=>{
    const r = modal.getBoundingClientRect();
    const inside = e.clientX>=r.left && e.clientX<=r.right && e.clientY>=r.top && e.clientY<=r.bottom;
    if(!inside) modal.close();
  });
}

async function persist(id, fd){
  const snap=await getDoc(refBoard); const data=snap.data();
  const idx=data.elements.findIndex(e=>e.id===id); if(idx<0) return;
  const el=data.elements[idx];
  const v=(k)=>fd.get(k);
  if(el.type==='text'){ el.content.text=v('text'); el.content.align=v('align'); el.content.size=v('size'); el.content.weight=v('weight'); }
  if(el.type==='image'){ el.content.url=v('url'); el.content.alt=v('alt'); el.content.fit=v('fit'); el.content.rounded=(v('rounded')==='true'); }
  if(el.type==='product'){ el.content.title=v('title'); el.content.price=parseFloat(v('price')||'0'); el.content.desc=v('desc'); el.content.badge=v('badge'); }
  data.elements[idx]=el;
  await updateDoc(refBoard,{ elements:data.elements });
  setStatus('Elemento guardado'); await refresh();
}

/* ===================== Boot ===================== */
window.addEventListener('DOMContentLoaded', async ()=>{
    await authReady;            // 👈 clave
    $('saveBg').onclick = saveBg;
    document.querySelectorAll('[data-add]').forEach(b=> b.onclick = ()=> addElement(b.dataset.add));
    await refresh();
  });