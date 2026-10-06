import {reactive} from 'vue/dist/vue.esm-bundler.js';
export const MAX_SLIDES=10;
const key='masal-slider-v1';
const middleKey='masal-middle-slider-v1';
export const MIDDLE_INTERVAL=2000;
const defaults=[{"id":"middle-asiacell-25000","src":"middle-banners/asiacell-card-25000-1600x800.png","name":"آسياسيل — 25,000 دينار"},{"id":"middle-asiacell-5000","src":"middle-banners/asiacell-card-5000-1600x800.png","name":"آسياسيل — 5,000 دينار"},{"id":"middle-asiacell-10000","src":"middle-banners/asiacell-card-10000-1600x800.png","name":"آسياسيل — 10,000 دينار"},{"id":"middle-asiacell-1000","src":"middle-banners/asiacell-card-1000-1600x800.png","name":"آسياسيل — 1,000 دينار"},{"id":"middle-asiacell-15000","src":"middle-banners/asiacell-card-15000-1600x800.png","name":"آسياسيل — 15,000 دينار"}];
const legacySources=['middle-banners/hala.png','middle-banners/donation.png','middle-banners/nojoom.png'];
function read(){try{const data=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(data)?data.filter(s=>typeof s.id==='string'&&typeof s.src==='string'&&/^data:image\/(webp|jpeg|png|gif);base64,/.test(s.src)).slice(0,MAX_SLIDES):[];}catch{return [];}}
export const slides=reactive(read());
function readMiddle(){try{
  const raw=localStorage.getItem(middleKey);if(raw===null)return defaults.map(s=>({...s}));
  const data=JSON.parse(raw);if(!Array.isArray(data))return defaults.map(s=>({...s}));
  const valid=data.filter(s=>s&&typeof s.id==='string'&&typeof s.name==='string'&&typeof s.src==='string'&&(/^data:image\/(webp|jpeg|png|gif);base64,/.test(s.src)||defaults.some(d=>d.src===s.src)||legacySources.includes(s.src)));
  if(valid.some(s=>legacySources.includes(s.src)))return [...defaults.map(s=>({...s})),...valid.filter(s=>!legacySources.includes(s.src))].slice(0,MAX_SLIDES);
  return valid.slice(0,MAX_SLIDES);
}catch{return defaults.map(s=>({...s}));}}

export const middleSlides=reactive(readMiddle());
if(typeof window!=='undefined')window.addEventListener('storage',event=>{if(event.key===middleKey||event.key===null)middleSlides.splice(0,middleSlides.length,...readMiddle());if(event.key===key||event.key===null)slides.splice(0,slides.length,...read());});
export function saveSlides(next,placement='top'){
  if(next.length>MAX_SLIDES)throw Error('الحد الأقصى 10 صور');
  try{localStorage.setItem(placement==='middle'?middleKey:key,JSON.stringify(next));}catch{throw Error('مساحة الحفظ غير كافية. احذف صورة أو جرّب صورة أصغر.');}
  const target=placement==='middle'?middleSlides:slides;target.splice(0,target.length,...next);
}
export async function prepareSlide(file){
  if(!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type))throw Error('اختار صور JPG أو PNG أو WebP أو GIF');
  const animated=file.type==='image/gif'||file.type==='image/webp';
  if(animated&&file.size>2*1024*1024)throw Error('GIF وWebP لازم تكون أقل من 2 ميگابايت');
  if(file.size>15*1024*1024)throw Error('حجم الصورة لازم يكون أقل من 15 ميگابايت');
  const url=URL.createObjectURL(file);
  try{
    const img=new Image();img.src=url;await img.decode();
    if(animated){const src=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('تعذّرت قراءة الصورة'));reader.readAsDataURL(file);});return {id:crypto.randomUUID(),src,name:file.name};}
    const scale=Math.min(1,1600/img.width,900/img.height);
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));
    canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
    return {id:crypto.randomUUID(),src:canvas.toDataURL('image/webp',.78),name:file.name};
  }finally{URL.revokeObjectURL(url);}
}
