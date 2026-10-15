import {api} from './api.js';
async function storageName(payload){
  const bytes=new TextEncoder().encode(JSON.stringify(payload)),digest=await crypto.subtle.digest('SHA-256',bytes);
  return 'masal-action-'+Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
}
export async function actionKey(payload){
  const name=await storageName(payload);
  let key;try{key=sessionStorage.getItem(name);}catch{}
  if(!key){key=crypto.randomUUID();try{sessionStorage.setItem(name,key);}catch{}}
  return key;
}
export async function runOperation(payload,revision){const result=await api('/admin/operations',{...payload,key:await actionKey(payload),revision});try{sessionStorage.removeItem(await storageName(payload));}catch{}return result;}
export function saveDownload(filename,value,type='application/json'){
  const blob=new Blob([typeof value==='string'?value:JSON.stringify(value,null,2)],{type});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
