import {randomUUID,createHash} from 'node:crypto';
import {validateInventory} from '../src/inventory.js';
import {encryptExport} from './vault.mjs';

export const PERMISSIONS={
  'catalog.read':'عرض الكتالوج','catalog.write':'تعديل الكتالوج','inventory.read':'عرض المخزون','inventory.import':'إنشاء طلبيات شراء','inventory.approve':'مراجعة واعتماد الطلبيات','inventory.manage':'تعديل حالات المخزون','inventory.cost':'عرض التكلفة والربح','inventory.reveal':'كشف الرموز','inventory.export':'تصدير المخزون','returns.manage':'التالف وطلبات الإرجاع','returns.approve':'اعتماد وتسوية الإرجاع','sales.read':'عرض المبيعات','sales.write':'حجز وإصدار المبيعات','sales.payment':'تسجيل دفع واسترداد يدوي','reports.read':'التقارير والقيود','providers.manage':'إعداد المزودين والخدمات','providers.sell':'بيع خدمات المزودين','settings.write':'إعدادات المتجر','customers.manage':'إدارة العملاء والدعم'
};
export const CARD_LABELS={available:'متاحة',reserved:'محجوزة',sold:'مباعة',quarantined:'محجورة',supplier_returned:'مصدرة للمورد',cancelled:'ملغاة',compensated:'معوضة',replaced:'مستبدلة',written_off:'مشطوبة'};
export const PURCHASE_LABELS={draft:'مسودة',pending:'بانتظار الاعتماد',returned:'معادة للتصحيح',approved:'معتمدة',rejected:'مرفوضة'};
export const now=()=>new Date().toISOString();
export const today=(time=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Baghdad',year:'numeric',month:'2-digit',day:'2-digit'}).format(time);
export const fault=(message,status=400)=>{throw Object.assign(Error(message),{status});};
export const clean=(value,max=500)=>{if(typeof value!=='string'||value.length>max)fault('بيانات نصية غير صالحة');return value.trim();};
export const allowed=(actor,permission)=>actor.owner||actor.permissions.includes(permission);
export function requirePermission(actor,permission){if(!allowed(actor,permission))fault('ما عندك صلاحية لهذا الإجراء: '+(PERMISSIONS[permission]||permission),403);}
export const fingerprint=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function minor(value,currency='IQD'){
  if(!['IQD','USD'].includes(currency))fault('العملة المدعومة IQD أو USD');
  const raw=String(value??'').trim(),scale=currency==='IQD'?0:2;
  if(!/^\d+(\.\d+)?$/.test(raw))fault('اكتب مبلغاً نقدياً صحيحاً وغير سالب');
  const [whole,fraction='']=raw.split('.');if(fraction.length>scale&&/[1-9]/.test(fraction.slice(scale)))fault('المبلغ يحتوي كسوراً غير مدعومة للعملة');
  const amount=BigInt(whole)*10n**BigInt(scale)+BigInt((fraction.slice(0,scale)+'0'.repeat(scale)).slice(0,scale)||'0');
  if(amount>BigInt(Number.MAX_SAFE_INTEGER))fault('المبلغ أكبر من الحد المسموح');return Number(amount);
}
function expiry(value){
  if(!value)return '';
  const raw=String(value);if(!/^\d{4}-\d{2}-\d{2}$/.test(raw)||!Number.isFinite(Date.parse(raw+'T00:00:00Z'))||new Date(raw+'T00:00:00Z').toISOString().slice(0,10)!==raw)fault('تاريخ الانتهاء غير صالح؛ استخدم YYYY-MM-DD');
  if(raw<today())fault('البطاقة منتهية الصلاحية');return raw;
}
export const expired=c=>!!c.expiry&&c.expiry<today();
export const sellable=c=>c.status==='available'&&!c.orderId&&!c.holdId&&!expired(c)&&!c.revealedAt;
export function audit(s,actor,action,target,reason=''){
  s.ops.audit.unshift({id:randomUUID(),at:now(),actor:actor.id,name:actor.name,action,target,reason:clean(reason||'',1000)});
}
function movement(s,card,from,to,reason,actor){s.ops.movements.unshift({id:randomUUID(),at:now(),cardId:card.id,productId:card.productId,value:card.value,from,to,reason,actor:actor.id});}
function change(s,c,status,reason,actor){const old=c.status;c.status=status;movement(s,c,old,status,reason,actor);}
export function journal(s,reference,description,lines){
  if(s.ops.ledger.some(e=>e.reference===reference))return;
  for(const currency of new Set(lines.map(l=>l.currency))){const entries=lines.filter(l=>l.currency===currency);if(entries.reduce((n,l)=>n+l.debit-l.credit,0)!==0||entries.some(l=>!Number.isSafeInteger(l.debit)||!Number.isSafeInteger(l.credit)||l.debit<0||l.credit<0))fault('قيد غير متوازن');}
  s.ops.ledger.unshift({id:randomUUID(),at:now(),reference,description,lines});
}
export function paired(amount,currency,debit,credit){return [{account:debit,currency,debit:amount,credit:0},{account:credit,currency,debit:0,credit:amount}];}
export function syncStock(s){
  const quantities=new Map();for(const c of s.codes)if(sellable(c)){const key=c.productId+':'+c.value;quantities.set(key,(quantities.get(key)||0)+1);}
  for(const p of s.products)p.stock=p.values.map(value=>quantities.get(p.id+':'+value)||0);
}
export function prepareOperations(s){
  s.ops||={};for(const key of ['purchases','batches','movements','claims','returns','ledger','audit','actions','services','serviceOrders','quotes'])s.ops[key]||=[];
  s.ops.settings={reservationMinutes:15,...s.ops.settings};s.ops.providers||={topup:{name:'التوب أب',configured:false},rabia:{name:'نجوم الرابعة',configured:false}};
  s.ops.version=1;
  for(const c of s.codes){c.id||=randomUUID();c.status||='available';c.createdAt||=now();c.currency||='IQD';c.batchId||='legacy';}
  if(s.codes.some(c=>c.batchId==='legacy')&&!s.ops.batches.some(b=>b.id==='legacy'))s.ops.batches.push({id:'legacy',name:'مخزون سابق',createdAt:now(),currency:'IQD',legacy:true});
}
export function releaseExpired(s,time=Date.now()){
  let changed=false;
  for(const o of s.orders){
    if(o.fulfillment==='reserved'&&o.paymentState!=='paid'&&Date.parse(o.reservedUntil)<=time){
      for(const c of s.codes.filter(c=>c.orderId===o.id&&c.status==='reserved')){change(s,c,'available','انتهاء مهلة الحجز',{id:'system'});delete c.orderId;}
      o.fulfillment='reservation_expired';o.cardIds=[];changed=true;
    }
  }
  if(changed)syncStock(s);return changed;
}
function checkedRows(s,rows){
  if(!Array.isArray(rows)||!rows.length||rows.length>50000)fault('الطلبية تتطلب من 1 إلى 50000 بطاقة');
  const result=validateInventory(rows,s.products,new Set(s.codes.map(c=>c.code)),new Set(s.codes.filter(c=>c.serial).map(c=>c.productId+':'+c.value+':'+c.serial)));
  if(result.errors.length)fault('تعذر اعتماد البطاقات: '+result.errors.slice(0,3).map(e=>'صف '+e.row+': '+e.reason).join('، '));
  const groups=new Map();
  const accepted=result.accepted.map((r,i)=>{
    const input=rows[i],p=s.products.find(p=>p.id===r.productId);
    if((p.fulfillmentModes?.[r.index]||'local')!=='local')fault('هذه الفئة خدمة رقمية ولا تستورد كمخزون محلي');
    const key=input.sourceId||(input.source||'نص')+'\u0000'+(input.sheet||'نص');
    const item={...r,id:input.id||randomUUID(),expiry:expiry(input.expiry),source:clean(input.source||'نص',200),sheet:clean(input.sheet||'نص',100),sourceRow:input.sourceRow||i+2};
    if(!groups.has(key))groups.set(key,[]);groups.get(key).push({item,input});return item;
  });
  if(groups.size>200||new Set(accepted.map(r=>r.productId+':'+r.value)).size>200)fault('الحد الأقصى 200 ملف / ورقة و200 فئة');
  return {accepted,groups};
}
function purchaseRows(s,rows,currency){
  const checked=checkedRows(s,rows);
  for(const group of checked.groups.values()){
    const unit=minor(group[0].input.unitCost,currency),expenses=minor(group[0].input.expenses??'0',currency);
    if(group.some(g=>minor(g.input.unitCost,currency)!==unit||minor(g.input.expenses??'0',currency)!==expenses))fault('تكلفة ومصاريف الملف يجب أن تتطابق لكل صفوفه');
    const share=Math.floor(expenses/group.length),remainder=expenses%group.length;
    group.forEach((g,i)=>{g.item.costMinor=unit+share+(i<remainder?1:0);g.item.unitCost=String(g.input.unitCost??'0');g.item.expenses=String(g.input.expenses??'0');});
  }
  if(!Number.isSafeInteger(checked.accepted.reduce((n,r)=>n+r.costMinor,0)))fault('إجمالي تكلفة الطلبية أكبر من الحد المسموح');
  return checked.accepted;
}
function purchaseContext(s,p){
  if(!s.suppliers.some(v=>v.id===p.supplierId&&v.active))fault('اختر مورداً مفعلاً');
  if(!s.companies.some(c=>c.id===p.companyId&&c.active&&(c.role==='supplier'||c.role==='both')))fault('اختر شركة مجهّزة مفعلة');
  if(p.currency!=='IQD'&&p.currency!=='USD')fault('اختر العملة');
  for(const r of p.rows){const product=s.products.find(v=>v.id===Number(r.product_id));if(product?.supplierCompanyId&&product.supplierCompanyId!==p.companyId)fault('الشركة المجهّزة لا تطابق ربط البطاقة');}
}
function catalogStamp(s,p){return fingerprint({supplier:s.suppliers.find(v=>v.id===p.supplierId),company:s.companies.find(v=>v.id===p.companyId),products:s.products.filter(v=>p.rows.some(r=>Number(r.product_id)===v.id)).map(({stock,...rest})=>rest)});}
function selectCards(s,ids){
  if(!Array.isArray(ids)||!ids.length||ids.length>5000||new Set(ids).size!==ids.length)fault('اختر بطاقات محددة بدون تكرار، حتى 5000');
  const cards=ids.map(id=>s.codes.find(c=>c.id===id));if(cards.some(c=>!c))fault('بطاقة غير موجودة');return cards;
}
function order(s,id){const o=s.orders.find(v=>v.id===id);if(!o)fault('طلب البيع غير موجود');return o;}
function productFor(s,o){const p=s.products.find(v=>v.id===o.productId);if(!p?.active||!s.categories.some(c=>c.name===p.category&&c.active))fault('البطاقة موقوفة');const index=p.values.indexOf(o.value);if(index<0||(p.fulfillmentModes?.[index]||'local')!=='local')fault('الطلب ليس بيع مخزون محلي');return {p,index};}
function reserve(s,o,actor){
  productFor(s,o);
  if(['issued','partially_refunded','refunded'].includes(o.fulfillment))fault('البطاقات مصدرة سابقاً');
  if(o.status==='ملغي')fault('الطلب ملغى');
  if(o.fulfillment==='reserved')return;
  const cards=s.codes.filter(c=>c.productId===o.productId&&c.value===o.value&&sellable(c)).sort((a,b)=>(a.expiry||'9999').localeCompare(b.expiry||'9999')||a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id)).slice(0,o.quantity);
  if(cards.length!==o.quantity)fault('المخزون غير كافٍ؛ لا يمكن تنفيذ حجز أو دفع متأخر دون توفر');
  for(const c of cards){change(s,c,'reserved','حجز للطلب '+o.id,actor);c.orderId=o.id;}
  o.cardIds=cards.map(c=>c.id);o.fulfillment='reserved';o.reservedUntil=new Date(Date.now()+s.ops.settings.reservationMinutes*60000).toISOString();
}
function cardCosts(cards){const totals=new Map();for(const c of cards){if(c.costMinor===undefined)continue;totals.set(c.currency,(totals.get(c.currency)||0)+c.costMinor);}return [...totals];}
function issue(s,o,actor){
  if(o.fulfillment==='issued')return;
  if(o.paymentState!=='paid')fault('سجل الدفع اليدوي أولاً؛ رجوع المتصفح لا يثبت الدفع');
  if(o.refundedMinor)fault('الطلب يتضمن استرداداً؛ أكمل التسوية قبل أي إصدار');
  if(o.fulfillment!=='reserved')reserve(s,o,actor);
  const cards=o.cardIds.map(id=>s.codes.find(c=>c.id===id));
  if(cards.length!==o.quantity||cards.some(c=>c.status!=='reserved'||c.orderId!==o.id||expired(c)))fault('الحجز غير صالح؛ راجع المخزون');
  for(const c of cards)change(s,c,'sold','إصدار للطلب '+o.id,actor);
  o.fulfillment='issued';o.issuedAt=now();o.status='مكتمل';o.costSnapshot=cardCosts(cards);o.costKnown=cards.every(c=>c.costMinor!==undefined);o.deliveryState='ready';
  const lines=o.costSnapshot.flatMap(([currency,amount])=>paired(amount,currency,'cost_of_goods','inventory'));
  journal(s,'sale:'+o.id,'إثبات المبيع وتكلفة البطاقات',[...paired(o.price,'IQD','customer_deposit','sales'),...lines]);
}
function settle(s,record,b,actor){
  if(record.status==='settled')fault('التسوية مسجلة سابقاً');
  if(!['stock','refund','replace','loss'].includes(b.outcome))fault('اختر نتيجة التسوية');
  const cards=selectCards(s,record.cardIds);
  if(b.outcome==='stock'){
    if(record.type==='return'||cards.some(c=>expired(c)||c.revealedAt))fault('لا يمكن إعادة بطاقة منتهية أو مكشوفة أو مصدرة للمورد إلى البيع');
    cards.forEach(c=>{change(s,c,record.originals[c.id],b.reason,actor);delete c.holdId;});
  }else if(b.outcome==='replace'){
    const rows=checkedRows(s,b.rows).accepted;
    const oldCounts=new Map(),newCounts=new Map();for(const c of cards){const k=c.productId+':'+c.value;oldCounts.set(k,(oldCounts.get(k)||0)+1);}for(const r of rows){const k=r.productId+':'+r.value;newCounts.set(k,(newCounts.get(k)||0)+1);}
    if(fingerprint([...oldCounts].sort())!==fingerprint([...newCounts].sort()))fault('الاستبدال يجب أن يطابق العدد والفئات الأصلية');
    const batch={id:randomUUID(),name:'استبدال '+record.id,createdAt:now(),claimId:record.id,supplierId:record.supplierId};s.ops.batches.push(batch);
    for(const r of rows){const old=cards.find(c=>c.productId===r.productId&&c.value===r.value&&!c._used);old._used=true;s.codes.push({...r,id:randomUUID(),batchId:batch.id,status:'available',createdAt:now(),currency:old.currency,costMinor:old.costMinor});}
    cards.forEach(c=>{delete c._used;change(s,c,'replaced',b.reason,actor);delete c.holdId;});
  }else{
    if(b.outcome==='refund'&&!clean(b.reference||'',200))fault('مرجع التعويض مطلوب');
    const costs=cardCosts(cards);if(cards.some(c=>c.costMinor===undefined))fault('تكلفة بعض البطاقات غير معروفة؛ أكمل التكلفة قبل تسوية مالية');
    journal(s,'settlement:'+record.id,b.outcome==='refund'?'تعويض مستحق من المورد':'اعتماد خسارة',costs.flatMap(([currency,amount])=>paired(amount,currency,b.outcome==='refund'?'supplier_receivable':'inventory_loss','inventory')));
    cards.forEach(c=>{change(s,c,b.outcome==='refund'?'compensated':'written_off',b.reason,actor);delete c.holdId;});
  }
  record.status='settled';record.outcome=b.outcome;record.settledAt=now();record.reviewer=actor.id;record.reference=clean(b.reference||'',200);record.reason=clean(b.reason,1000);
}
export function operation(s,b,actor){
  const action=clean(b.action,100),reason=()=>{const r=clean(b.reason||'',1000);if(!r)fault('سبب الإجراء مطلوب');return r;};
  let target='';
  if(action==='purchase.save'){
    requirePermission(actor,'inventory.import');
    const old=s.ops.purchases.find(p=>p.id===b.id);if(b.id&&!old)fault('الطلبية غير موجودة');if(old&&!['draft','returned'].includes(old.status))fault('لا يمكن تعديل طلبية مرسلة أو نهائية');
    const p={id:old?.id||randomUUID(),supplierId:clean(b.supplierId,100),companyId:clean(b.companyId,100),source:clean(b.source||'ملفات',200),invoice:clean(b.invoice||'',200),currency:b.currency||'IQD',notes:clean(b.notes||'',2000),createdAt:old?.createdAt||now(),creator:old?.creator||actor.id,status:'draft',history:old?.history||[],rows:b.rows};
    purchaseContext(s,p);const rows=purchaseRows(s,p.rows,p.currency);p.rows=rows.map(r=>({product_id:r.productId,denomination:r.value,code:r.code,serial:r.serial,id:old?.rows.find(v=>v.code===r.code)?.id||r.id,expiry:r.expiry,unitCost:r.unitCost,expenses:r.expenses,source:r.source,sheet:r.sheet,sourceRow:r.sourceRow,sourceId:r.sourceId,extra:r.extra}));
    p.totalMinor=rows.reduce((n,r)=>n+r.costMinor,0);p.catalogStamp=catalogStamp(s,p);p.history.push({at:now(),actor:actor.id,action:'save'});
    if(old)Object.assign(old,p);else s.ops.purchases.unshift(p);target=p.id;
  }else if(action.startsWith('purchase.')){
    const p=s.ops.purchases.find(v=>v.id===b.id);if(!p)fault('الطلبية غير موجودة');target=p.id;
    if(action==='purchase.submit'){
      requirePermission(actor,'inventory.import');if(!['draft','returned'].includes(p.status))fault('حالة الطلبية لا تسمح بالإرسال');purchaseContext(s,p);purchaseRows(s,p.rows,p.currency);p.catalogStamp=catalogStamp(s,p);p.status='pending';p.submittedAt=now();
    }else{
      requirePermission(actor,'inventory.approve');if(p.status!=='pending')fault('الطلبية ليست بانتظار الاعتماد');
      if(action==='purchase.approve'){
        purchaseContext(s,p);if(p.catalogStamp!==catalogStamp(s,p))fault('تغير الكتالوج أو المورد بعد المعاينة؛ أعد الطلبية للتصحيح',409);
        const rows=purchaseRows(s,p.rows,p.currency),groups=new Map();
        for(const r of rows){const key=r.sourceId||r.source+'\u0000'+r.sheet;if(!groups.has(key)){const batch={id:randomUUID(),purchaseId:p.id,name:r.source+' / '+r.sheet,supplierId:p.supplierId,companyId:p.companyId,currency:p.currency,createdAt:now(),originalCount:0};groups.set(key,batch);s.ops.batches.push(batch);}const batch=groups.get(key);batch.originalCount++;s.codes.push({...r,id:r.id,batchId:batch.id,purchaseId:p.id,status:'available',createdAt:now(),currency:p.currency,companyId:p.companyId,supplierId:p.supplierId});movement(s,s.codes.at(-1),'pending','available','اعتماد طلبية شراء',actor);}
        p.status='approved';p.approvedAt=now();journal(s,'purchase:'+p.id,'شراء مخزون — '+p.invoice,paired(p.totalMinor,p.currency,'inventory','supplier_payable'));
      }else if(action==='purchase.return'){p.status='returned';p.reviewReason=reason();}
      else if(action==='purchase.reject'){p.status='rejected';p.reviewReason=reason();}
      else fault('إجراء غير موجود');p.reviewer=actor.id;p.reviewedAt=now();
    }
    p.history.push({at:now(),actor:actor.id,action,reason:b.reason||''});
  }else if(action==='inventory.batch.status'){
    requirePermission(actor,'inventory.manage');const why=reason();if(!s.ops.batches.some(batch=>batch.id===b.id))fault('الدفعة غير موجودة');
    if(!['quarantined','cancelled','available','restore'].includes(b.status))fault('إجراء دفعة غير صالح');
    const eligible=s.codes.filter(c=>c.batchId===b.id&&!c.orderId&&!c.holdId&&!c.revealedAt&&(b.status==='cancelled'?['available','quarantined'].includes(c.status):b.status==='restore'?c.status==='cancelled':b.status==='available'?c.status==='quarantined':c.status==='available'));
    if(!eligible.length)fault('لا توجد بطاقات مؤهلة لهذا الإجراء');
    if(['available','restore'].includes(b.status)&&eligible.some(expired))fault('توجد بطاقات منتهية في المتبقي؛ صفّها وعالجها منفردة قبل إعادة التفعيل');
    for(const c of eligible){if(b.status==='cancelled')c.preCancelStatus=c.status;const status=b.status==='restore'?(c.preCancelStatus||'available'):b.status;change(s,c,status,why,actor);if(b.status==='restore')delete c.preCancelStatus;}target=b.id;
  }else if(action==='inventory.status'){
    requirePermission(actor,'inventory.manage');const cards=selectCards(s,b.cardIds);const why=reason();
    if(!['available','quarantined','cancelled'].includes(b.status))fault('حالة غير مسموحة');
    for(const c of cards){if(!['available','quarantined','cancelled'].includes(c.status)||c.holdId||c.orderId||c.revealedAt)fault('البطاقة مرتبطة ببيع أو مراجعة أو رمز مكشوف');if(b.status==='available'&&expired(c))fault('لا يمكن تفعيل بطاقة منتهية');}
    cards.forEach(c=>change(s,c,b.status,why,actor));target=cards.map(c=>c.id).join(',');
  }else if(action==='inventory.cost'){
    requirePermission(actor,'inventory.manage');requirePermission(actor,'inventory.cost');const c=selectCards(s,[b.id])[0];reason();
    if(c.costMinor!==undefined||!['available','quarantined','cancelled'].includes(c.status)||c.orderId)fault('تثبيت التكلفة متاح فقط للمخزون السابق غير المباع ذي التكلفة المجهولة');
    c.costMinor=minor(b.amount,b.currency);c.currency=b.currency;journal(s,'opening-cost:'+c.id,'تثبيت تكلفة مخزون سابق',paired(c.costMinor,c.currency,'inventory','opening_equity'));target=c.id;
  }else if(action==='inventory.edit'){
    requirePermission(actor,'inventory.manage');const c=selectCards(s,[b.id])[0];if(!['available','quarantined'].includes(c.status)||c.orderId||c.holdId||c.revealedAt)fault('تعديل البطاقة غير مسموح');reason();
    const serial=clean(b.serial||'',256);if(serial&&s.codes.some(v=>v.id!==c.id&&v.productId===c.productId&&v.value===c.value&&v.serial===serial))fault('التسلسلي مكرر ضمن الفئة');c.serial=serial;c.expiry=expiry(b.expiry);target=c.id;
  }else if(action==='claim.create'||action==='return.create'){
    requirePermission(actor,'returns.manage');const cards=selectCards(s,b.cardIds);const why=reason();
    if(cards.some(c=>!['available','quarantined'].includes(c.status)||c.orderId||c.holdId||c.revealedAt))fault('اختر بطاقات غير مباعة وغير مرتبطة بمراجعة أخرى');
    if(action==='return.create'&&(!b.supplierId||!s.suppliers.some(v=>v.id===b.supplierId)))fault('اختر المورد');
    if(action==='return.create'&&cards.some(c=>c.supplierId&&c.supplierId!==b.supplierId))fault('البطاقات ليست من المورد المختار');
    const record={id:randomUUID(),type:action==='return.create'?'return':'claim',cardIds:cards.map(c=>c.id),originals:Object.fromEntries(cards.map(c=>[c.id,c.status])),status:'pending',reason:why,supplierId:b.supplierId||'',createdAt:now(),creator:actor.id};
    cards.forEach(c=>{change(s,c,'quarantined',why,actor);c.holdId=record.id;});(record.type==='return'?s.ops.returns:s.ops.claims).unshift(record);target=record.id;
  }else if(action.startsWith('claim.')||action.startsWith('return.')){
    requirePermission(actor,'returns.approve');const record=(action.startsWith('return.')?s.ops.returns:s.ops.claims).find(v=>v.id===b.id);if(!record)fault('المطالبة غير موجودة');target=record.id;
    if(action.endsWith('.reject')){
      if(record.status!=='pending')fault('المطالبة ليست معلقة');const why=reason();for(const c of selectCards(s,record.cardIds)){change(s,c,record.originals[c.id],why,actor);delete c.holdId;}record.status='rejected';record.reviewReason=why;record.reviewer=actor.id;
    }else if(action==='return.approve'){
      if(record.status!=='pending')fault('الإرجاع ليس معلقاً');reason();record.status='approved';record.approvedAt=now();record.reviewer=actor.id;for(const c of selectCards(s,record.cardIds))change(s,c,'supplier_returned',b.reason,actor);
    }else if(action.endsWith('.settle')){
      if(record.type==='return'&&record.status!=='approved'||record.type==='claim'&&record.status!=='pending')fault('حالة المطالبة لا تسمح بالتسوية');reason();settle(s,record,b,actor);
    }else fault('إجراء غير موجود');
  }else if(action==='sale.create'){
    requirePermission(actor,'sales.write');const p=s.products.find(p=>p.id===Number(b.productId)),customer=s.customers.find(c=>c.id===b.customerId&&c.active);
    if(!customer||!p||!Number.isInteger(b.quantity)||b.quantity<1||b.quantity>1000||!p.values.includes(Number(b.value)))fault('اختر العميل والبطاقة والفئة والكمية الصحيحة');
    const index=p.values.indexOf(Number(b.value));const o={id:'ORDER-'+randomUUID(),reference:'ADMIN-'+randomUUID(),customerId:customer.id,customer:customer.name,phone:customer.phone,email:customer.email,productId:p.id,name:p.name,value:p.values[index],quantity:b.quantity,price:p.prices[index]*b.quantity,priceRevision:s.revision,date:today(),status:'قيد المراجعة',payment:'يدوي',paymentState:'unpaid',fulfillment:'unreserved',deliveryState:'hidden',creator:actor.id};
    if(!Number.isSafeInteger(o.price))fault('السعر غير صالح');productFor(s,o);s.orders.unshift(o);target=o.id;
  }else if(action.startsWith('sale.')){
    requirePermission(actor,'sales.write');const o=order(s,b.id);target=o.id;
    if(action==='sale.reserve')reserve(s,o,actor);
    else if(action==='sale.payment'){
      requirePermission(actor,'sales.payment');if(o.paymentState==='paid')fault('الدفع مسجل سابقاً');if(o.status==='ملغي')fault('الطلب ملغى');
      const reference=clean(b.reference||'',200);if(!reference)fault('مرجع الدفع اليدوي مطلوب');reason();if(minor(b.amount,'IQD')!==o.price)fault('المبلغ لا يطابق الطلب');
      if(s.orders.some(v=>v.id!==o.id&&v.paymentReference===reference))fault('مرجع الدفع مستخدم');
      reserve(s,o,actor);o.paymentState='paid';o.paymentReference=reference;o.paidAt=now();o.paymentKind='manual';
      journal(s,'payment:'+o.id,'تحصيل يدوي موثق '+reference,paired(o.price,'IQD','cash','customer_deposit'));
    }else if(action==='sale.issue')issue(s,o,actor);
    else if(action==='sale.cancel'){
      reason();if(o.paymentState==='paid'||['issued','partially_refunded','refunded'].includes(o.fulfillment))fault('الطلب مدفوع أو مصدر؛ استخدم مسار الاسترداد');
      for(const c of s.codes.filter(v=>v.orderId===o.id&&v.status==='reserved')){change(s,c,'available',b.reason,actor);delete c.orderId;}o.status='ملغي';o.fulfillment='cancelled';o.cardIds=[];
    }else if(action==='sale.refund'){
      requirePermission(actor,'sales.payment');reason();if(o.paymentState!=='paid')fault('لا يوجد دفع قابل للاسترداد');
      const amount=minor(b.amount,'IQD'),remaining=o.price-(o.refundedMinor||0);if(!amount||amount>remaining)fault('مبلغ الاسترداد أكبر من الرصيد أو غير صالح');
      const reference=clean(b.reference||'',200);if(!reference)fault('مرجع الاسترداد مطلوب');
      if(s.orders.some(v=>v.refunds?.some(r=>r.reference===reference)))fault('مرجع الاسترداد مستخدم سابقاً',409);
      const issued=['issued','partially_refunded','refunded'].includes(o.fulfillment);
      journal(s,'refund:'+o.id+':'+(o.refundedMinor||0),'استرداد يدوي للزبون '+reference,paired(amount,'IQD',issued?'sales_refund':'customer_deposit','cash'));
      o.refundedMinor=(o.refundedMinor||0)+amount;o.refunds||=[];o.refunds.push({at:now(),amount,reference,reason:b.reason,actor:actor.id});
      if(issued)o.fulfillment=o.refundedMinor===o.price?'refunded':'partially_refunded';
      else if(o.refundedMinor===o.price){for(const c of s.codes.filter(v=>v.orderId===o.id&&v.status==='reserved')){change(s,c,'available',b.reason,actor);delete c.orderId;}o.fulfillment='cancelled';o.status='ملغي';o.cardIds=[];}
      if(o.refundedMinor===o.price)o.paymentState='refunded';
    }else fault('إجراء غير موجود');
  }else if(action==='settings.reservation'){
    requirePermission(actor,'settings.write');if(!Number.isInteger(b.minutes)||b.minutes<1||b.minutes>1440)fault('مهلة الحجز من 1 إلى 1440 دقيقة');s.ops.settings.reservationMinutes=b.minutes;target='reservation';
  }else fault('إجراء غير موجود',404);
  audit(s,actor,action,target,b.reason||'');syncStock(s);return {target};
}
export function receipt(s,id,actor,customerId){
  const o=order(s,id);if(customerId&&o.customerId!==customerId)fault('الطلب ليس لهذا الحساب',403);
  if(!customerId){requirePermission(actor,'sales.read');requirePermission(actor,'inventory.reveal');}
  if(!['issued','partially_refunded','refunded'].includes(o.fulfillment))fault('الطلب غير جاهز للتسليم');
  if(o.serviceOrderId){
    const service=s.ops.serviceOrders.find(v=>v.id===o.serviceOrderId);if(!service?.delivered)fault('الخدمة غير جاهزة للتسليم');o.deliveryState='revealed';o.firstRevealedAt||=now();audit(s,actor,'receipt.reveal',id);
    return {id:o.id,name:o.name,quantity:1,price:o.price,date:o.date,paymentState:o.paymentState,phone:service.phone,reference:service.reference,activationReceipt:service.secret.activationReceipt,cards:service.secret.code?[{id:service.id,serial:service.secret.serial,code:service.secret.code}]:[],issuedAt:o.issuedAt};
  }
  const cards=s.codes.filter(c=>c.orderId===id&&c.status==='sold');if(cards.length!==o.quantity)fault('عدد البطاقات المصدرة لا يطابق الطلب');
  for(const c of cards)c.revealedAt||=now();o.deliveryState='revealed';o.firstRevealedAt||=now();audit(s,actor,'receipt.reveal',id);
  return {id:o.id,name:o.name,quantity:o.quantity,price:o.price,date:o.date,paymentState:o.paymentState,cards:cards.map(c=>({id:c.id,serial:c.serial,code:c.code,expiry:c.expiry})),issuedAt:o.issuedAt};
}
export function returnExport(s,b,actor){
  requirePermission(actor,'returns.approve');requirePermission(actor,'inventory.export');requirePermission(actor,'inventory.reveal');
  const r=s.ops.returns.find(v=>v.id===b.id);if(r?.status!=='approved')fault('الإرجاع غير معتمد');
  const cards=selectCards(s,r.cardIds);const file=encryptExport({returnId:r.id,exportedAt:now(),cards:cards.map(c=>({serial:c.serial,code:c.code,productId:c.productId,value:c.value,expiry:c.expiry}))},b.password);
  r.exports||=[];r.exports.push({at:now(),actor:actor.id});for(const c of cards)c.revealedAt||=now();audit(s,actor,'return.export',r.id);return {filename:'masal-return-'+r.id+'.masal',file};
}
export function operationsView(s,actor,query={}){
  const can=p=>allowed(actor,p),cost=can('inventory.cost');
  const cards=can('inventory.read')?s.codes.map(({code,extra,unitCost,expenses,_used,...c})=>({...c,costMinor:cost?c.costMinor:undefined,expired:expired(c),sellable:sellable(c),name:s.products.find(p=>p.id===c.productId)?.name||'',internalSerial:c.serial||c.id})):[];
  const filter=c=>(!query.search||[c.internalSerial,c.name,c.id,c.orderId,c.batchId].join(' ').toLowerCase().includes(String(query.search).toLowerCase()))&&(!query.status||(query.status==='expired'?c.expired:query.status==='expiring'?c.expiry&&!c.expired&&c.expiry<=today(new Date(Date.now()+30*86400000)):c.status===query.status))&&(!query.productId||c.productId===Number(query.productId));
  const filtered=cards.filter(filter),page=Math.max(1,Number(query.page)||1),pageSize=50;
  const purchases=can('inventory.import')||can('inventory.approve')?s.ops.purchases.map(({rows,catalogStamp,...p})=>({...p,totalMinor:cost?p.totalMinor:undefined,count:rows.length,denominations:new Set(rows.map(r=>r.product_id+':'+r.denomination)).size,files:new Set(rows.map(r=>r.source+'|'+r.sheet)).size,summary:Object.entries(rows.reduce((acc,r)=>{const key=r.product_id+':'+r.denomination;acc[key]=(acc[key]||0)+1;return acc;},{})).map(([key,count])=>({key,count}))})):[];
  const batches=can('inventory.read')?s.ops.batches.map(b=>{const entries=cards.filter(c=>c.batchId===b.id);return {...b,costMinor:cost?entries.reduce((n,c)=>n+(c.costMinor||0),0):undefined,costKnown:entries.every(c=>c.costMinor!==undefined),originalCount:b.originalCount||entries.length,counts:Object.fromEntries(Object.keys(CARD_LABELS).map(status=>[status,entries.filter(c=>c.status===status).length])),expired:entries.filter(c=>c.expired).length};}):[];
  const metrics={available:cards.filter(c=>c.sellable).length,reserved:cards.filter(c=>c.status==='reserved').length,quarantined:cards.filter(c=>c.status==='quarantined').length,expired:cards.filter(c=>c.expired).length,expiring:cards.filter(c=>c.expiry&&!c.expired&&c.expiry<=today(new Date(Date.now()+30*86400000))).length,pendingPurchases:purchases.filter(p=>p.status==='pending').length,pendingClaims:can('returns.manage')?s.ops.claims.filter(c=>c.status==='pending').length:undefined,pendingReturns:can('returns.manage')?s.ops.returns.filter(c=>c.status==='pending').length:undefined};
  if(can('providers.sell')||can('providers.manage'))metrics.providers=Object.fromEntries(['topup','rabia'].map(provider=>{const operations=s.ops.serviceOrders.filter(o=>o.provider===provider);const account=s.ops.providers[provider];return [provider,{success:operations.filter(o=>o.status==='success').length,failed:operations.filter(o=>o.status==='failed').length,pending:operations.filter(o=>['executing','needs_review'].includes(o.status)).length,missingCode:operations.filter(o=>o.status==='purchased_code_missing').length,premiumPending:operations.filter(o=>o.status==='premium_pending').length,balance:can('providers.manage')?account.balance:undefined,balanceAt:can('providers.manage')?account.balanceAt:undefined}];}));
  return {revision:s.revision,actor:{...actor},permissions:PERMISSIONS,cardLabels:CARD_LABELS,purchaseLabels:PURCHASE_LABELS,metrics,cards:filtered.slice((page-1)*pageSize,page*pageSize),total:filtered.length,page,pageSize,purchases,batches,movements:can('inventory.read')?s.ops.movements.slice(0,500):[],claims:can('returns.manage')||can('returns.approve')?s.ops.claims:[],returns:can('returns.manage')||can('returns.approve')?s.ops.returns:[],orders:can('sales.read')?s.orders.map(o=>({...o,costSnapshot:cost?o.costSnapshot:undefined,profitMinor:cost&&o.costKnown&&o.costSnapshot?.every(([currency])=>currency==='IQD')?o.price-(o.refundedMinor||0)-o.costSnapshot.reduce((n,[,amount])=>n+amount,0):undefined})):[],ledger:can('reports.read')&&cost?s.ops.ledger:[],audit:can('reports.read')?s.ops.audit.slice(0,500):[],settings:s.ops.settings};
}
export function historyView(s,actor,query){
  const kind=query.kind==='audit'?'audit':'movements';requirePermission(actor,kind==='audit'?'reports.read':'inventory.read');
  const search=String(query.search||'').toLowerCase();
  const rows=s.ops[kind].filter(row=>{
    if(search&&!Object.values(row).join(' ').toLowerCase().includes(search))return false;
    if(query.from||query.to){const day=today(new Date(row.at));if(query.from&&day<query.from||query.to&&day>query.to)return false;}
    return true;
  });
  const page=Math.max(1,Math.min(Math.ceil(rows.length/50)||1,Math.floor(Number(query.page))||1));
  return {rows:rows.slice((page-1)*50,page*50),total:rows.length,page,pageSize:50};
}
