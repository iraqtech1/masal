const key='masal-preview-session-v1';
const pages=['home','cards','orders','support'];
function normalize(value){
  if(!value||value.entered!==true)return null;
  const user=value.user;
  if(user!==null&&(!user||typeof user.name!=='string'||typeof user.email!=='string'||typeof user.phone!=='string'))return null;
  return {entered:true,user:user?{name:user.name,phone:user.phone,email:user.email}:null,page:pages.includes(value.page)?value.page:'home',merchant:value.merchant===true};
}
// This is tab-scoped preview state, not production authentication or credentials.
export function restoreStoreSession(storage){
  try{return normalize(JSON.parse(storage.getItem(key)));}catch{return null;}
}
export function saveStoreSession(storage,value){
  try{const session=normalize(value);if(session)storage.setItem(key,JSON.stringify(session));else storage.removeItem(key);}catch{}
}
