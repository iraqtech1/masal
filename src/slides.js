import {reactive} from 'vue/dist/vue.esm-bundler.js';
export const MAX_SLIDES=10;
const key='masal-slider-v1';
function read(){try{const data=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(data)?data.filter(s=>typeof s.id==='string'&&typeof s.src==='string'&&/^data:image\/(webp|jpeg|png);base64,/.test(s.src)).slice(0,MAX_SLIDES):[];}catch{return [];}}
export const slides=reactive(read());
export function saveSlides(next){
  if(next.length>MAX_SLIDES)throw Error('الحد الأقصى 10 صور');
  try{localStorage.setItem(key,JSON.stringify(next));}catch{throw Error('مساحة الحفظ غير كافية. احذف صورة أو جرّب صورة أصغر.');}
  slides.splice(0,slides.length,...next);
}
export async function prepareSlide(file){
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('اختار صور JPG أو PNG أو WebP');
  if(file.size>15*1024*1024)throw Error('حجم الصورة لازم يكون أقل من 15 ميگابايت');
  const url=URL.createObjectURL(file);
  try{
    const img=new Image();img.src=url;await img.decode();
    const scale=Math.min(1,1600/img.width,900/img.height);
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));
    canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
    return {id:crypto.randomUUID(),src:canvas.toDataURL('image/webp',.78),name:file.name};
  }finally{URL.revokeObjectURL(url);}
}
