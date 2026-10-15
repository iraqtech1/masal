import {randomUUID} from 'node:crypto';
import {normalizePhone} from '../src/auth-preview.js';
import {requirePermission,allowed,fault,clean,minor,now,today,fingerprint,audit,journal,paired} from './operations.mjs';

export const SERVICE_STATES={draft:'مسودة',awaiting_configuration:'بانتظار إعداد الربط',quoted:'عرض محدث',executing:'قيد التنفيذ',success:'ناجحة',failed:'فشل مؤكد',needs_review:'تحتاج مراجعة',purchased_code_missing:'شراء مؤكد والرمز مفقود',premium_pending:'تفعيل Premium غير مكتمل',returned:'مرتجعة بتأكيد موثق',cancelled:'ملغاة قبل التنفيذ'};
const providerName=id=>id==='topup'?'التوب أب':'نجوم الرابعة';
export function providerReady(s,id,adapters){const p=s.ops.providers[id];return !!p?.baseUrl&&!!p?.secret?.token&&!!p?.documentation&&!!adapters[id]?.purchase&&!!adapters[id]?.quote;}
export function providerView(s,a,adapters){
  const viewCost=allowed(a,'inventory.cost'),manage=allowed(a,'providers.manage'),sell=allowed(a,'providers.sell');
  if(!manage&&!sell)fault('ما عندك صلاحية خدمات المزودين',403);
  return {revision:s.revision,actor:a,labels:SERVICE_STATES,providers:Object.entries(s.ops.providers).map(([id,{secret,...p}])=>({...p,id,hasToken:!!secret?.token,account:manage?secret?.account:undefined,ready:providerReady(s,id,adapters),adapterInstalled:!!adapters[id],balance:manage?p.balance:undefined,balanceAt:manage?p.balanceAt:undefined})),services:s.ops.services.map(v=>({...v,costMinor:viewCost?v.costMinor:undefined,ready:providerReady(s,v.provider,adapters),exclusion:!v.active?'الخدمة موقوفة':!v.price?'سعر البيع غير صالح':!providerReady(s,v.provider,adapters)?'توثيق أو حساب أو محول المزود غير مكتمل':''})),orders:s.ops.serviceOrders.map(({secret,...o})=>({...o,quotedCostMinor:viewCost?o.quotedCostMinor:undefined,actualCostMinor:viewCost?o.actualCostMinor:undefined})).slice(0,1000)};
}
export function providerOperation(s,b,a,adapters){
  let target='';
  if(b.action==='provider.save'){
    requirePermission(a,'providers.manage');if(!['topup','rabia'].includes(b.provider))fault('مزود غير صالح');
    const p=s.ops.providers[b.provider],baseUrl=clean(b.baseUrl||'',1000),documentation=clean(b.documentation||'',2000);
    if(baseUrl&&(!baseUrl.startsWith('https://')||new URL(baseUrl).username||new URL(baseUrl).password))fault('رابط المزود يجب أن يكون HTTPS بدون بيانات دخول ضمن الرابط');
    const token=clean(b.token||'',4000);p.baseUrl=baseUrl;p.documentation=documentation;p.secret={account:clean(b.account||'',200),token:token||p.secret?.token||''};p.updatedAt=now();target=b.provider;
  }else if(b.action==='service.save'){
    requirePermission(a,'providers.manage');
    if(!['topup','rabia'].includes(b.provider)||!['topup','card','premium'].includes(b.kind)||b.provider==='topup'&&b.kind!=='topup'||b.provider==='rabia'&&b.kind==='topup')fault('نوع خدمة لا يطابق المزود');
    const old=s.ops.services.find(v=>v.id===b.id);if(b.id&&!old)fault('الخدمة غير موجودة');
    const p=s.products.find(p=>p.id===Number(b.productId)),value=Number(b.value),index=p?.values.indexOf(value)??-1;
    if(!p||index<0)fault('اربط الخدمة ببطاقة وفئة محلية موجودة');
    if(s.codes.some(c=>c.productId===p.id&&c.value===value&&['available','reserved','quarantined'].includes(c.status)))fault('الفئة تحتوي مخزوناً محلياً؛ اختر فئة مستقلة للخدمة الرقمية');
    if(s.ops.services.some(v=>v.id!==b.id&&v.productId===p.id&&v.value===value))fault('الفئة مرتبطة بخدمة أخرى');
    const price=minor(b.price,'IQD');if(price<=0)fault('سعر البيع يجب أن يكون أكبر من صفر');
    const fields=Array.isArray(b.requiredFields)?b.requiredFields.map(f=>clean(f,60)):[];if(fields.length>10||fields.some(f=>!f||['__proto__','constructor','prototype'].includes(f)))fault('حقول خدمة غير صالحة');
    const item={id:old?.id||randomUUID(),provider:b.provider,kind:b.kind,name:clean(b.name,120),productId:p.id,value,externalId:clean(b.externalId,200),province:clean(b.province||'',100),currency:b.currency||'IQD',costMinor:b.cost===''||b.cost===undefined?null:minor(b.cost,b.currency||'IQD'),price,active:!!b.active,requiredFields:[...new Set(fields)],version:(old?.version||0)+1};
    if(!item.name||!item.externalId)fault('اسم الخدمة ومعرف المزود مطلوبان');
    if(old)Object.assign(old,item);else s.ops.services.push(item);p.fulfillmentModes||=p.values.map(()=>'local');p.fulfillmentModes[index]=b.kind==='premium'?'premium':b.provider;p.prices[index]=price;target=item.id;
  }else if(b.action==='service.prepare'){
    requirePermission(a,'providers.sell');const service=s.ops.services.find(v=>v.id===b.serviceId&&v.active);if(!service||!service.price)fault('الخدمة غير مفعلة أو سعرها غير صالح');
    const customer=s.customers.find(c=>c.id===b.customerId&&c.active);if(!customer)fault('اختر حساب العميل');
    let phone='';if(service.kind==='topup'){phone=normalizePhone(b.phone||'');if(!/^07[3-9][0-9]{8}$/.test(phone)||phone!==normalizePhone(b.phoneConfirm||''))fault('رقم الهاتف العراقي غير صحيح أو غير متطابق');}
    const province=clean(b.province||service.province||'',100);if(service.provider==='rabia'&&!province)fault('المحافظة مطلوبة حسب كتالوج المزود');
    const fields=Object.fromEntries(service.requiredFields.map(field=>{const value=clean(b.fields?.[field]||'',500);if(!value)fault('الحقل مطلوب: '+field);return [field,value];}));
    const old=s.ops.serviceOrders.find(o=>o.customerId===customer.id&&o.serviceId===service.id&&o.phone===phone&&['executing','needs_review','purchased_code_missing','premium_pending'].includes(o.status));if(old)fault('توجد عملية معلقة لنفس العميل والخدمة؛ احسمها قبل شراء بديل',409);
    const requestId=randomUUID(),id='SERVICE-'+requestId,saleId='ORDER-'+randomUUID();
    const request={id,requestId,saleId,serviceId:service.id,serviceVersion:service.version,customerId:customer.id,customer:customer.name,provider:service.provider,kind:service.kind,name:service.name,externalId:service.externalId,phone,province,price:service.price,quotedCostMinor:service.costMinor,quotedCurrency:service.currency,status:providerReady(s,service.provider,adapters)?'draft':'awaiting_configuration',createdAt:now(),employee:a.id,secret:{fields},attempts:[]};
    s.ops.serviceOrders.unshift(request);s.orders.unshift({id:saleId,serviceOrderId:id,reference:requestId,customerId:customer.id,customer:customer.name,phone:customer.phone,email:customer.email,productId:service.productId,name:service.name,value:service.value,quantity:1,price:service.price,date:today(),status:'قيد المراجعة',payment:'يدوي',paymentState:'unpaid',fulfillment:'provider_pending',deliveryState:'hidden'});target=id;
  }else if(b.action==='service.cancel'){
    requirePermission(a,'providers.sell');const o=s.ops.serviceOrders.find(o=>o.id===b.id),sale=s.orders.find(v=>v.id===o?.saleId);
    if(!o||!['draft','awaiting_configuration','quoted'].includes(o.status)||sale.paymentState!=='unpaid')fault('يمكن إلغاء المسودة غير المدفوعة فقط');o.status='cancelled';sale.status='ملغي';sale.fulfillment='cancelled';target=o.id;
  }else if(b.action==='provider.payment'){
    requirePermission(a,'sales.payment');const o=s.ops.serviceOrders.find(v=>v.id===b.id);if(!o||o.status!=='quoted')fault('حدّث العرض أولاً');if(!providerReady(s,o.provider,adapters)||Date.parse(o.quoteExpires)<=Date.now())fault('الربط أو العرض غير صالح');const sale=s.orders.find(v=>v.id===o.saleId);if(sale.paymentState==='paid')fault('الدفع مسجل سابقاً');
    const reference=clean(b.reference||'',200);if(!reference||minor(b.amount,'IQD')!==sale.price)fault('مرجع ومبلغ الدفع غير صحيحين');if(s.orders.some(v=>v.paymentReference===reference))fault('مرجع الدفع مستخدم');sale.paymentState='paid';sale.paymentReference=reference;sale.paidAt=now();sale.paymentKind='manual';journal(s,'payment:'+sale.id,'تحصيل يدوي لخدمة مزود',paired(sale.price,'IQD','cash','customer_deposit'));target=o.id;
  }else if(b.action==='service.return.confirm'){
    requirePermission(a,'returns.approve');const o=s.ops.serviceOrders.find(v=>v.id===b.id);if(!o?.purchaseConfirmed||o.status==='returned')fault('لا يوجد شراء مؤكد قابل للتسوية');const reference=clean(b.reference||'',200);if(!reference||!clean(b.reason||'',1000)||o.actualCostMinor===undefined||o.actualCostMinor===null)fault('مرجع إثبات المرتجع والتكلفة المؤكدة والسبب مطلوبة');
    journal(s,'provider-return:'+o.id,'مرتجع مورد موثق '+reference,paired(o.actualCostMinor,o.actualCurrency,'supplier_receivable',o.delivered?'cost_of_goods':'provider_in_progress'));o.status='returned';o.returnReference=reference;o.returnedAt=now();target=o.id;
  }else fault('إجراء مزود غير موجود',404);
  audit(s,a,b.action,target,b.reason||'');return {target};
}
function normalizedResult(result){return result&&typeof result==='object'&&!Array.isArray(result)?result:{};}
export async function runProvider({read,commit,db,adapters},b,a){
  requirePermission(a,'providers.sell');const action=clean(b.action,30);if(!['quote','execute','check','balance'].includes(action))fault('إجراء ربط غير صالح');
  let s=read();
  if(action==='balance'){
    requirePermission(a,'providers.manage');const p=s.ops.providers[b.provider],adapter=adapters[b.provider];if(!p||!providerReady(s,b.provider,adapters)||!adapter?.balance)fault('استعلام الرصيد غير متاح بعقد المزود الحالي');
    const balance=await adapter.balance({baseUrl:p.baseUrl,credentials:p.secret});s=read();s.ops.providers[b.provider].balance=balance;s.ops.providers[b.provider].balanceAt=now();audit(s,a,'provider.balance',b.provider);commit(s);return {ok:true};
  }
  let o=s.ops.serviceOrders.find(v=>v.id===b.id);if(!o)fault('العملية غير موجودة');const adapter=adapters[o.provider],p=s.ops.providers[o.provider];if(!providerReady(s,o.provider,adapters))fault('الربط غير مكتمل: أضف الحساب والتوثيق ومحول API المطابق للعقد قبل تنفيذ أي اتصال',409);
  const context={baseUrl:p.baseUrl,credentials:p.secret,requestId:o.requestId,externalId:o.externalId,phone:o.phone,province:o.province,fields:o.secret.fields};
  if(action==='quote'){
    if(!['draft','awaiting_configuration','quoted'].includes(o.status))fault('لا يمكن تحديث عرض عملية بدأ تنفيذها');
    const quote=normalizedResult(await adapter.quote(context));if(!quote.available||!Number.isSafeInteger(quote.costMinor)||quote.costMinor<0||!['IQD','USD'].includes(quote.currency)||!Number.isFinite(Date.parse(quote.expiresAt))||Date.parse(quote.expiresAt)<=Date.now())fault('المزود لم يرجع عرضاً صالحاً');
    s=read();o=s.ops.serviceOrders.find(v=>v.id===b.id);const service=s.ops.services.find(v=>v.id===o.serviceId);if(!['draft','awaiting_configuration','quoted'].includes(o.status)||!service?.active||service.version!==o.serviceVersion)fault('تغيرت الخدمة أو العملية أثناء تحديث العرض',409);
    o.quotedCostMinor=quote.costMinor;o.quotedCurrency=quote.currency;o.quoteExpires=quote.expiresAt;o.secret.quote=quote;o.status='quoted';audit(s,a,'provider.quote',o.id);commit(s);return {status:o.status};
  }
  if(action==='check'){
    if(!adapter.check)fault('عقد المزود لا يوفّر استعلام حالة؛ راجع المزود يدوياً دون إعادة الشراء');if(!['needs_review','purchased_code_missing','premium_pending','executing'].includes(o.status))fault('العملية لا تحتاج استعلاماً');
    let result;try{result=await adapter.check({...context,reference:o.reference,reservation:o.secret.reservation});}catch{fault('تعذر الاستعلام. تبقى الحالة معلقة دون إعادة شراء',502);}
    s=read();o=s.ops.serviceOrders.find(v=>v.id===b.id);o.secret.raw=result;audit(s,a,'provider.check',o.id);commit(s);return finalizeProvider(read,commit,b.id,result,a);
  }
  const sale=s.orders.find(v=>v.id===o.saleId),service=s.ops.services.find(v=>v.id===o.serviceId);
  if(o.status!=='quoted'||!service?.active||service.version!==o.serviceVersion||Date.parse(o.quoteExpires)<=Date.now()||sale.paymentState!=='paid'||sale.refundedMinor)fault('العملية منفذة أو العرض منتهٍ أو تغيرت الخدمة أو لم يسجل دفع صالح',409);
  if(!clean(b.key||'',100))fault('مفتاح التنفيذ مطلوب');
  // Persist an attempt before leaving the process. No database transaction spans a network call.
  o.status='executing';o.attempts.push({id:randomUUID(),key:b.key,at:now(),phase:'started',actor:a.id});audit(s,a,'provider.execute.started',o.id);commit(s);
  try{
    if(o.provider==='rabia'){
      if(!adapter.reserve)fault('محول الرابعة لا يوفّر حجزاً موثقاً');
      const reservation=normalizedResult(await adapter.reserve(context));if(!reservation.token||!reservation.cardId||!Number.isFinite(Date.parse(reservation.expiresAt))||Date.parse(reservation.expiresAt)<=Date.now()||!Number.isSafeInteger(reservation.costMinor)||reservation.costMinor<0||reservation.currency!==o.quotedCurrency||reservation.costMinor>o.quotedCostMinor)fault('حجز المورد أو تكلفته غير صالحين، أو التكلفة أعلى من العرض');
      s=read();o=s.ops.serviceOrders.find(v=>v.id===b.id);o.secret.reservation=reservation;o.attempts.at(-1).phase='reserved';commit(s);context.reservation=reservation;
    }
    if(context.reservation&&Date.parse(context.reservation.expiresAt)<=Date.now())fault('انتهت صلاحية حجز المزود قبل الشراء');
    s=read();o=s.ops.serviceOrders.find(v=>v.id===b.id);o.attempts.at(-1).phase='purchase_sent';commit(s);
    const result=await adapter.purchase(context);
    s=read();o=s.ops.serviceOrders.find(v=>v.id===b.id);o.secret.raw=result;o.attempts.at(-1).phase='response_saved';commit(s);
    return finalizeProvider(read,commit,b.id,result,a);
  }catch(e){
    s=read();o=s.ops.serviceOrders.find(v=>v.id===b.id);o.status='needs_review';o.reviewReason='انقطاع أو رد غير صالح بعد بدء المحاولة. لا تعاود الشراء قبل حسم الحالة.';audit(s,a,'provider.execute.unknown',o.id);commit(s);return {status:o.status};
  }
}
function finalizeProvider(read,commit,id,raw,a){
  const s=read(),o=s.ops.serviceOrders.find(v=>v.id===id),sale=s.orders.find(v=>v.id===o.saleId),result=normalizedResult(raw);
  if(o.status==='success'||o.status==='returned')return {status:o.status};
  if(result.definitiveFailure===true&&!o.purchaseConfirmed){o.status='failed';o.reviewReason='فشل مؤكد من المزود';}
  else if(result.success===true&&typeof result.reference==='string'&&result.reference.trim()){
    if(o.reference&&o.reference!==result.reference)fault('مرجع المزود لا يطابق العملية المحفوظة',409);
    if(result.externalId&&String(result.externalId)!==o.externalId)fault('فئة المزود لا تطابق العملية',409);
    if(result.cardId&&String(result.cardId)!==String(o.secret.reservation?.cardId))fault('معرف البطاقة لا يطابق حجز المزود',409);
    if(result.phone&&normalizePhone(result.phone)!==o.phone)fault('رقم المستفيد لا يطابق الطلب',409);
    o.purchaseConfirmed=true;o.reference=result.reference;
    if(result.costMinor!==undefined){if(!Number.isSafeInteger(result.costMinor)||result.costMinor<0||!['IQD','USD'].includes(result.currency))fault('تكلفة فعلية غير صالحة');if(o.actualCostMinor!==undefined&&o.actualCostMinor!==result.costMinor)fault('تكلفة الاستعلام لا تطابق التكلفة المثبتة',409);o.actualCostMinor=result.costMinor;o.actualCurrency=result.currency;}
    if(o.actualCostMinor!==undefined)journal(s,'provider-purchase:'+o.id,'شراء مؤكد من '+providerName(o.provider),paired(o.actualCostMinor,o.actualCurrency,'provider_in_progress','supplier_payable'));
    if(typeof result.code==='string'&&result.code.trim())o.secret.code=result.code;
    if(result.serial)o.secret.serial=String(result.serial);
    if(o.kind==='premium'&&(!result.activationComplete||!result.activationReceipt))o.status='premium_pending';
    else if(o.kind==='card'&&!o.secret.code)o.status='purchased_code_missing';
    else {
      o.status='success';o.delivered=true;o.deliveredAt=now();o.secret.activationReceipt=result.activationReceipt;
      sale.fulfillment='issued';sale.issuedAt||=now();sale.deliveryState='ready';sale.status='مكتمل';sale.costKnown=o.actualCostMinor!==undefined;sale.costSnapshot=sale.costKnown?[[o.actualCurrency,o.actualCostMinor]]:[];
      journal(s,'sale:'+sale.id,'بيع خدمة '+o.name,[...paired(sale.price,'IQD','customer_deposit','sales'),...(sale.costKnown?paired(o.actualCostMinor,o.actualCurrency,'cost_of_goods','provider_in_progress'):[])]);
    }
  }else{o.status='needs_review';o.reviewReason='رد غير حاسم؛ لا توجد إعادة شراء تلقائية';}
  if(o.status!=='success')sale.fulfillment='provider_review';audit(s,a,'provider.result.'+o.status,id);commit(s);return {status:o.status};
}
export function recoverProviders(read,commit){
  let state=read();
  for(const pending of state.ops.serviceOrders.filter(o=>o.status==='executing')){
    if(pending.attempts.at(-1)?.phase==='response_saved'&&pending.secret.raw){try{finalizeProvider(read,commit,pending.id,pending.secret.raw,{id:'system',name:'استعادة الخادم'});continue;}catch{}}
    state=read();const o=state.ops.serviceOrders.find(o=>o.id===pending.id);o.status='needs_review';o.reviewReason='أعيد تشغيل الخادم أثناء التنفيذ؛ لا توجد إعادة شراء تلقائية.';audit(state,{id:'system',name:'استعادة الخادم'},'provider.recovered.review',o.id);commit(state);
  }
}
