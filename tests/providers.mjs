import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {createMasalServer} from '../server/app.mjs';

const dir=mkdtempSync(join(tmpdir(),'masal-providers-')),dbPath=join(dir,'test.sqlite');let app,base;
let topupMode='success',topupPurchases=0,rabiaPurchases=0,reservations=0,activation=false;
const quote=async()=>({available:true,costMinor:1000,currency:'IQD',expiresAt:new Date(Date.now()+60000).toISOString()});
const providerAdapters={
  topup:{quote,purchase:async ctx=>{topupPurchases++;if(topupMode==='timeout')throw Error('connection lost after send');return {success:true,reference:'TOP-'+ctx.requestId,phone:ctx.phone,costMinor:1001,currency:'IQD'};},check:async ctx=>({success:true,reference:'TOP-'+ctx.requestId,phone:ctx.phone,costMinor:1001,currency:'IQD'})},
  rabia:{quote,reserve:async ctx=>{reservations++;return {token:'SECRET-RESERVATION-'+ctx.requestId,cardId:ctx.externalId,costMinor:900,currency:'IQD',expiresAt:new Date(Date.now()+60000).toISOString()};},purchase:async ctx=>{rabiaPurchases++;return {success:true,reference:'RAB-'+ctx.requestId,costMinor:900,currency:'IQD',activationComplete:false};},check:async ctx=>({success:true,reference:'RAB-'+ctx.requestId,costMinor:900,currency:'IQD',code:ctx.externalId==='CARD-EXTERNAL'?'PROVIDER-SECRET-PIN':undefined,serial:'0000987',activationComplete:activation,activationReceipt:activation?'ACTIVATION-RECEIPT':undefined})}
};
function client(){let cookie='';return async(path,body,method=body===undefined?'GET':'POST',expected=200)=>{const res=await fetch(base+'/api'+path,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{})},body:body===undefined?undefined:JSON.stringify(body)});if(res.headers.get('set-cookie'))cookie=res.headers.get('set-cookie').split(';')[0];const result=await res.json();assert.equal(res.status,expected,JSON.stringify(result));return result;};}
try{
  app=createMasalServer({dbPath,adminPassword:'provider-test-password',providerAdapters});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+app.server.address().port;
  const admin=client(),customerClient=client(),otherClient=client();await admin('/admin/login',{username:'masal',password:'provider-test-password'});const customer=await customerClient('/auth/guest',{});await otherClient('/auth/guest',{});
  const op=async(payload,expected=200)=>admin('/admin/operations',{...payload,key:randomUUID(),revision:(await admin('/admin/providers')).revision},'POST',expected);
  const state=await admin('/admin/state'),topupProduct=state.products.find(p=>p.id===3),rabiaProduct=state.products.find(p=>p.id===4);
  const service=await op({action:'service.save',provider:'topup',kind:'topup',name:'تعبئة اختبار',productId:topupProduct.id,value:topupProduct.values[0],externalId:'TOPUP-EXTERNAL',price:'1500',currency:'IQD',cost:'',active:true});
  await op({action:'service.prepare',serviceId:service.target,customerId:customer.id,phone:'٠٧٧١٢٣٤٥٦٧٨',phoneConfirm:'07812345678'},400);
  const prepared=await op({action:'service.prepare',serviceId:service.target,customerId:customer.id,phone:'٠٧٧١٢٣٤٥٦٧٨',phoneConfirm:'+9647712345678'});
  let view=await admin('/admin/providers');assert.equal(view.orders[0].status,'awaiting_configuration');assert.equal(view.services[0].costMinor,null,'Unknown cost is not zero');
  await admin('/admin/providers/run',{id:prepared.target,action:'quote'},'POST',409);assert.equal(topupPurchases,0);
  await op({action:'provider.save',provider:'topup',baseUrl:'https://provider.example.test',documentation:'MOCK-TEST-CONTRACT',account:'test-account',token:'SECRET-TOPUP-TOKEN'});
  view=await admin('/admin/providers');assert.equal(view.providers.find(p=>p.id==='topup').ready,true);assert.ok(!JSON.stringify(view).includes('SECRET-TOPUP-TOKEN'));
  const quoteAndPay=async id=>{await admin('/admin/providers/run',{id,action:'quote'});await op({action:'provider.payment',id,amount:'1500',reference:'PAY-'+id});};
  await quoteAndPay(prepared.target);await admin('/admin/providers/run',{id:prepared.target,action:'execute',key:randomUUID()});
  view=await admin('/admin/providers');assert.equal(view.orders[0].status,'success');assert.equal(view.orders[0].phone,'07712345678');assert.equal(view.orders[0].actualCostMinor,1001);assert.equal(topupPurchases,1);
  await admin('/admin/providers/run',{id:prepared.target,action:'execute',key:randomUUID()},'POST',409);assert.equal(topupPurchases,1);
  const topupReceipt=await customerClient('/orders/receipt',{id:view.orders[0].saleId});assert.equal(topupReceipt.cards.length,0);assert.equal(topupReceipt.phone,'07712345678');await otherClient('/orders/receipt',{id:view.orders[0].saleId},'POST',403);
  topupMode='timeout';const uncertain=await op({action:'service.prepare',serviceId:service.target,customerId:customer.id,phone:'07712345678',phoneConfirm:'07712345678'});await quoteAndPay(uncertain.target);
  const unknown=await admin('/admin/providers/run',{id:uncertain.target,action:'execute',key:randomUUID()});assert.equal(unknown.status,'needs_review');assert.equal(topupPurchases,2);
  await admin('/admin/providers/run',{id:uncertain.target,action:'execute',key:randomUUID()},'POST',409);assert.equal(topupPurchases,2);
  await op({action:'service.prepare',serviceId:service.target,customerId:customer.id,phone:'07712345678',phoneConfirm:'07712345678'},409);
  await admin('/admin/providers/run',{id:uncertain.target,action:'check'});assert.equal(topupPurchases,2);view=await admin('/admin/providers');assert.equal(view.orders.find(o=>o.id===uncertain.target).status,'success');

  await op({action:'provider.save',provider:'rabia',baseUrl:'https://rabia.example.test',documentation:'MOCK-TEST-CONTRACT',account:'rabia-account',token:'SECRET-RABIA-TOKEN'});
  const card=await op({action:'service.save',provider:'rabia',kind:'card',name:'بطاقة رابعة اختبار',productId:rabiaProduct.id,value:rabiaProduct.values[0],externalId:'CARD-EXTERNAL',province:'MOCK-PROVINCE',price:'1500',currency:'IQD',cost:'1000',active:true});
  const cardRequest=await op({action:'service.prepare',serviceId:card.target,customerId:customer.id});await quoteAndPay(cardRequest.target);
  const missingCode=await admin('/admin/providers/run',{id:cardRequest.target,action:'execute',key:randomUUID()});assert.equal(missingCode.status,'purchased_code_missing');assert.equal(reservations,1);assert.equal(rabiaPurchases,1);
  view=await admin('/admin/providers');const cardOrder=view.orders.find(o=>o.id===cardRequest.target);await customerClient('/orders/receipt',{id:cardOrder.saleId},'POST',400);
  await admin('/admin/providers/run',{id:cardRequest.target,action:'execute',key:randomUUID()},'POST',409);
  await admin('/admin/providers/run',{id:cardRequest.target,action:'check'});assert.equal(rabiaPurchases,1);const cardReceipt=await customerClient('/orders/receipt',{id:cardOrder.saleId});assert.equal(cardReceipt.cards[0].code,'PROVIDER-SECRET-PIN');assert.equal(cardReceipt.cards[0].serial,'0000987');
  const premium=await op({action:'service.save',provider:'rabia',kind:'premium',name:'Premium اختبار',productId:rabiaProduct.id,value:rabiaProduct.values[1],externalId:'PREMIUM-EXTERNAL',province:'MOCK-PROVINCE',price:'1500',currency:'IQD',cost:'1000',active:true,requiredFields:['account_id']});
  await op({action:'service.prepare',serviceId:premium.target,customerId:customer.id,fields:{}},400);
  const premiumRequest=await op({action:'service.prepare',serviceId:premium.target,customerId:customer.id,fields:{account_id:'SECRET-PREMIUM-ACCOUNT'}});await quoteAndPay(premiumRequest.target);const incomplete=await admin('/admin/providers/run',{id:premiumRequest.target,action:'execute',key:randomUUID()});assert.equal(incomplete.status,'premium_pending');
  await admin('/admin/providers/run',{id:premiumRequest.target,action:'check'});view=await admin('/admin/providers');assert.equal(view.orders.find(o=>o.id===premiumRequest.target).status,'premium_pending');
  activation=true;await admin('/admin/providers/run',{id:premiumRequest.target,action:'check'});view=await admin('/admin/providers');const premiumOrder=view.orders.find(o=>o.id===premiumRequest.target);assert.equal(premiumOrder.status,'success');assert.equal(rabiaPurchases,2);assert.equal((await customerClient('/orders/receipt',{id:premiumOrder.saleId})).activationReceipt,'ACTIVATION-RECEIPT');
  await op({action:'service.return.confirm',id:premiumRequest.target,reference:'PROVIDER-REFUND-001',reason:'إشعار مرتجع موثق'});const sale=(await admin('/admin/operations')).orders.find(o=>o.id===premiumOrder.saleId);assert.equal(sale.paymentState,'paid','Supplier return never refunds customer implicitly');
  const operations=await admin('/admin/operations');assert.equal(operations.cards.length,0,'Provider cards never become local stock');for(const e of operations.ledger)for(const currency of new Set(e.lines.map(l=>l.currency)))assert.equal(e.lines.filter(l=>l.currency===currency).reduce((n,l)=>n+l.debit-l.credit,0),0);
  const database=new DatabaseSync(dbPath),raw=database.prepare('SELECT value FROM state WHERE id=1').get().value;for(const secret of ['SECRET-TOPUP-TOKEN','SECRET-RABIA-TOKEN','SECRET-RESERVATION','PROVIDER-SECRET-PIN','SECRET-PREMIUM-ACCOUNT'])assert.ok(!raw.includes(secret),'Secret stays encrypted: '+secret);database.close();
  const before=(await admin('/admin/operations')).ledger.length;
  await new Promise(r=>app.server.close(r));app.close();
  const recoveryDb=new DatabaseSync(dbPath),recoveryState=JSON.parse(recoveryDb.prepare('SELECT value FROM state WHERE id=1').get().value);const savedResponse=recoveryState.ops.serviceOrders.find(o=>o.id===prepared.target);savedResponse.status='executing';savedResponse.attempts.at(-1).phase='response_saved';recoveryDb.prepare('UPDATE state SET value=? WHERE id=1').run(JSON.stringify(recoveryState));recoveryDb.close();
  app=createMasalServer({dbPath,adminPassword:'provider-test-password',providerAdapters});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+app.server.address().port;
  assert.equal((await admin('/admin/providers')).orders.find(o=>o.id===prepared.target).status,'success','Restart finalizes the saved provider response without buying again');assert.equal((await admin('/admin/operations')).ledger.length,before);assert.equal(topupPurchases,2);
  console.log('Provider configuration, phone confirmation, quote/payment/one purchase, unknown result recovery, fourth reservation, missing PIN, Premium activation, separate returns and encrypted secrets pass with mock adapters only.');
}finally{if(app){await new Promise(r=>app.server.close(r));app.close();}rmSync(dir,{recursive:true,force:true});}
