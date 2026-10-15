import {createMasalServer} from '../server/app.mjs';
import {randomBytes,randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';

const password=process.env.ADMIN_PASSWORD||randomBytes(18).toString('base64url');
const dbPath=resolve(process.env.DEMO_DB_PATH||'server/data/demo.sqlite');
const app=createMasalServer({dbPath,adminPassword:password,demonstration:true});
await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+app.server.address().port;let cookie='';
async function api(path,body,method=body===undefined?'GET':'POST'){
  const res=await fetch(base+'/api'+path,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{})},body:body===undefined?undefined:JSON.stringify(body)});
  if(res.headers.get('set-cookie'))cookie=res.headers.get('set-cookie').split(';')[0];const data=await res.json();if(!res.ok)throw Error(data.error);return data;
}
async function save(collection,data){const s=await api('/admin/state');return api('/admin/'+collection,{data,revision:s.revision},'PUT');}
async function op(payload){const s=await api('/admin/operations');return api('/admin/operations',{...payload,revision:s.revision,key:randomUUID()});}
try{
  await api('/admin/login',{username:process.env.ADMIN_USER||'masal',password});
  const initial=await api('/admin/operations');
  if(!initial.purchases.length&&!initial.cards.length){
    let state=await save('companies',{name:'شركة تجهيز — فحص محلي',role:'both',active:true});const companyId=state.companies.at(-1).id;
    state=await save('suppliers',{name:'مورد تجريبي — دون ربط خارجي',method:'Excel',url:'',active:true});const supplierId=state.suppliers.at(-1).id;
    state=await save('customers',{name:'عميل فحص محلي',phone:'07700000001',email:'',active:true});const customerId=state.customers.at(-1).id;
    const p=state.products[0];await save('products',{...p,supplierCompanyId:companyId,manufacturerId:companyId});
    const expiry=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Baghdad',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()+10*86400000));
    const rows=Array.from({length:12},(_,i)=>({product_id:p.id,denomination:p.values[0],code:'DEMO-NOT-REDEEMABLE-'+String(i+1).padStart(4,'0'),serial:'DEMO-'+String(i+1).padStart(6,'0'),source:'دفعة فحص محلية.csv',sheet:'فحص',sourceRow:i+2,unitCost:'1800',expenses:'120',expiry}));
    const purchase=await op({action:'purchase.save',supplierId,companyId,currency:'IQD',invoice:'DEMO-INVOICE-001',notes:'بيانات فحص منفصلة؛ ليست فاتورة أو شراء حقيقي.',rows});
    await op({action:'purchase.submit',id:purchase.target});await op({action:'purchase.approve',id:purchase.target,reason:'اعتماد بيانات الفحص'});
    const draft=await op({action:'purchase.save',supplierId,companyId,currency:'IQD',invoice:'DEMO-PENDING-002',notes:'طلبية معلقة لتجربة الاعتماد أو الإعادة للتصحيح.',rows:[{...rows[0],code:'DEMO-PENDING-PIN',serial:'DEMO-PENDING-SERIAL',unitCost:'5000',expenses:'0',product_id:2,denomination:5000}]});await op({action:'purchase.submit',id:draft.target});
    const sale=await op({action:'sale.create',customerId,productId:p.id,value:p.values[0],quantity:2});
    const order=(await api('/admin/operations')).orders.find(o=>o.id===sale.target);await op({action:'sale.payment',id:order.id,amount:String(order.price),reference:'DEMO-CASH-001',reason:'تحصيل تجريبي؛ لم يتحرك أي مال حقيقي'});await op({action:'sale.issue',id:order.id,reason:'إصدار فحص محلي'});
    const cards=(await api('/admin/operations')).cards.filter(c=>c.sellable);
    await op({action:'claim.create',cardIds:[cards[0].id],reason:'تالف تجريبي لفحص التسوية'});
    await op({action:'return.create',cardIds:[cards[1].id],supplierId,reason:'إرجاع تجريبي لفحص المراجعة والتصدير'});
    await op({action:'inventory.status',cardIds:[cards[2].id],status:'quarantined',reason:'حجر تجريبي'});
    await op({action:'inventory.status',cardIds:[cards[3].id],status:'cancelled',reason:'إلغاء تجريبي'});
    await op({action:'sale.create',customerId,productId:p.id,value:p.values[0],quantity:1});
    const topup=await op({action:'service.save',provider:'topup',kind:'topup',name:'توب أب تجريبي — استبدل المعرف قبل الربط',productId:7,value:5000,externalId:'DEMO-REPLACE-WITH-PROVIDER-ID',price:'5200',currency:'IQD',cost:'',active:true});
    await op({action:'service.prepare',serviceId:topup.target,customerId,phone:'07700000001',phoneConfirm:'07700000001'});
    await op({action:'service.save',provider:'rabia',kind:'card',name:'بطاقة رابعة تجريبية — بانتظار الربط',productId:5,value:5000,externalId:'DEMO-CARD-ID',province:'DEMO-PROVINCE',price:'5250',currency:'IQD',cost:'',active:true});
    await op({action:'service.save',provider:'rabia',kind:'premium',name:'Premium تجريبي — بانتظار الربط',productId:5,value:10000,externalId:'DEMO-PREMIUM-ID',province:'DEMO-PROVINCE',price:'10500',currency:'IQD',cost:'',active:true,requiredFields:['account_id']});
    console.log('Seeded isolated local review data. All cards, invoices and cash entries are demonstrations.');
  }else console.log('Keeping existing local demo data and user edits.');
}finally{await new Promise(r=>app.server.close(r));app.close();}
console.log('Local demo admin: '+(process.env.ADMIN_USER||'masal')+' / '+password);
const child=spawn(process.execPath,['scripts/dev.mjs'],{stdio:'inherit',env:{...process.env,DB_PATH:dbPath,ADMIN_PASSWORD:password,MASAL_DEMO:'true'}});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill());child.on('exit',code=>{process.exitCode=code||0;});
