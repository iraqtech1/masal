import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createMasalServer} from '../server/app.mjs';
const dir=mkdtempSync(join(tmpdir(),'masal-test-'));
let app,base;
async function start(){app=createMasalServer({dbPath:join(dir,'test.sqlite'),adminPassword:'test-password-123456',developmentOtp:true});await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+app.server.address().port;}
async function stop(){await new Promise(resolve=>app.server.close(resolve));app.close();}
function client(){let cookie='';return async(path,body,method=body===undefined?'GET':'POST',expected=200)=>{const response=await fetch(base+'/api'+path,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{})},body:body===undefined?undefined:JSON.stringify(body)});if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];const data=await response.json();assert.equal(response.status,expected,JSON.stringify(data));return data;};}
try{
  await start();const admin=client(),alice=client(),bob=client(),anon=client();
  await anon('/admin/state',undefined,'GET',401);
  await admin('/admin/login',{username:'masal',password:'masal'},'POST',401);
  await admin('/admin/login',{username:'masal',password:'test-password-123456'});
  const a=await alice('/auth/guest',{}),b=await bob('/auth/guest',{});assert.notEqual(a.id,b.id);
  let state=await admin('/admin/state');const product=state.products[0];
  const order=await alice('/orders',{productId:product.id,denom:0,quantity:2,payment:'Qi',reference:'retry-1',price:1,customerId:b.id},'POST',201);
  assert.equal(order.price,product.prices[0]*2);assert.equal(order.customerId,a.id);assert.equal(order.status,'قيد المراجعة');
  assert.equal((await alice('/orders',{productId:product.id,denom:0,quantity:2,payment:'Qi',reference:'retry-1'})).id,order.id);
  await alice('/orders',{productId:product.id,denom:99,quantity:1,payment:'Qi',reference:'bad'},'POST',400);
  const ticket=await alice('/tickets',{subject:'Help',message:'Where is my order?'},'POST',201);
  assert.equal((await bob('/state')).tickets.length,0);assert.equal((await bob('/state')).orders.length,0);
  assert.equal((await anon('/state')).customers.length,0);assert.equal((await anon('/state')).orders.length,0);
  await alice('/admin/orders',{data:order,revision:0},'PUT',401);
  state=await admin('/admin/state');const stale=state.revision;
  state=await admin('/admin/tickets',{revision:state.revision,data:{id:ticket.id,reply:'We are checking',status:'قيد المعالجة'}},'PUT');
  assert.equal((await alice('/state')).tickets[0].reply,'We are checking');
  await admin('/admin/settings',{revision:stale,data:state.settings},'PUT',409);
  state=await admin('/admin/orders',{revision:state.revision,data:{id:order.id,status:'مكتمل',price:1,customerId:b.id}},'PUT');
  assert.equal((await alice('/state')).orders[0].status,'مكتمل');assert.equal(state.orders[0].price,order.price);
  state=await admin('/admin/products',{revision:state.revision,data:{...product,image:'https://example.com/card.png',prices:product.prices.map(p=>p+10)}},'PUT');
  assert.equal((await bob('/state')).products[0].image,'https://example.com/card.png');
  state=await admin('/admin/middleSlides',{revision:state.revision,data:[{id:'uploaded',name:'Banner',src:'data:image/png;base64,aGVsbG8='}]},'PUT');
  assert.equal((await bob('/state')).middleSlides[0].id,'uploaded');
  state=await admin('/admin/settings',{revision:state.revision,data:{...state.settings,supportPhone:'07712345678',name:'Shared store'}},'PUT');
  assert.equal((await bob('/state')).settings.name,'Shared store');
  const rows=[{product_id:product.id,denomination:product.values[0],code:'PRIVATE-CODE-1'}];
  let result=await admin('/admin/import',{revision:state.revision,name:'test.xlsx',rows});assert.equal(result.accepted,1);state=result.state;
  result=await admin('/admin/import',{revision:state.revision,name:'duplicate.xlsx',rows});assert.equal(result.accepted,0);assert.equal(result.errors.length,1);
  assert.equal('codes' in result.state,false);assert.equal('codes' in await alice('/state'),false);
  const register=client(),challenge=await register('/auth/start',{mode:'register',phone:'07712345678',name:'Test Account',email:''});
  await register('/auth/verify',{challengeId:challenge.challengeId,code:'000000'},'POST',400);
  const registered=await register('/auth/verify',{challengeId:challenge.challengeId,code:challenge.previewCode});assert.equal(registered.phone,'07712345678');
  await register('/auth/verify',{challengeId:challenge.challengeId,code:challenge.previewCode},'POST',400);
  const edited=await register('/auth/profile',{name:'Edited account',email:'test@example.com'},'PUT');assert.equal(edited.name,'Edited account');
  state=await admin('/admin/state');state=await admin('/admin/customers',{revision:state.revision,data:{...state.customers.find(c=>c.id===a.id),active:false}},'PUT');
  await alice('/tickets',{subject:'Blocked',message:'Blocked'},'POST',403);
  await stop();await start();
  assert.equal((await admin('/admin/state')).orders.length,1,'Restart preserves database and admin session');
  assert.equal((await register('/auth/me')).name,'Edited account');
  const returning=client(),login=await returning('/auth/start',{mode:'login',phone:'07712345678'});
  assert.equal((await returning('/auth/verify',{challengeId:login.challengeId,code:login.previewCode})).id,registered.id);
  await admin('/admin/logout',{});await admin('/admin/state',undefined,'GET',401);
  console.log('Backend persistence, sessions, customer isolation, admin updates, images, imports, conflicts, OTP and restart checks passed.');
}finally{if(app?.server.listening)await stop();rmSync(dir,{recursive:true,force:true});}
