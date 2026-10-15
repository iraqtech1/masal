export const previewInventory={codes:new Set(),serials:new Set(),entries:[]};
export function validateInventory(rows,products,existing=new Set(),existingSerials=new Set()){
  const accepted=[],errors=[],seen=new Set(existing),serials=new Set(existingSerials);
  const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Baghdad',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  for(let i=0;i<rows.length;i++){
    const row=rows[i]||{},id=Number(row.product_id),value=Number(row.denomination),code=String(row.code??'').trim(),serial=String(row.serial??'').trim(),expiry=String(row.expiry||'');
    const product=products.find(p=>p.id===id),index=product?.values.indexOf(value)??-1,rule=product?.denominationRules?.[index]||{},extra=row.extra&&typeof row.extra==='object'&&!Array.isArray(row.extra)?row.extra:{};
    let reason='';
    if(!product||index<0)reason='بطاقة أو فئة غير موجودة';
    else if(product.fulfillmentModes?.[index]&&product.fulfillmentModes[index]!=='local')reason='الفئة خدمة رقمية ولا تستورد كمخزون';
    else if(expiry&&(!/^\d{4}-\d{2}-\d{2}$/.test(expiry)||!Number.isFinite(Date.parse(expiry+'T00:00:00Z'))||new Date(expiry+'T00:00:00Z').toISOString().slice(0,10)!==expiry))reason='تاريخ انتهاء غير صالح';
    else if(expiry&&expiry<day)reason='بطاقة منتهية الصلاحية';
    else if(rule.serialRequired&&!serial)reason='التسلسلي مطلوب لهذه الفئة';
    else if(rule.expiryRequired&&!expiry)reason='الانتهاء مطلوب لهذه الفئة';
    else if((rule.requiredFields||[]).some(field=>!String(extra[field]??'').trim()))reason='حقل إضافي مطلوب لهذه الفئة';
    else if(Object.keys(extra).length>10||Object.entries(extra).some(([key,v])=>key.length>60||typeof v!=='string'||v.length>256||['__proto__','constructor','prototype'].includes(key)))reason='الحقول الإضافية غير صالحة';
    else if(!code||code.length>256)reason='الكود فارغ أو أطول من المسموح';
    else if(seen.has(code))reason='كود مكرر';
    else if(serial.length>256)reason='السيريل أطول من المسموح';
    else if(serial&&(serials.has(serial)||serials.has(id+':'+value+':'+serial)))reason='سيريل مكرر ضمن الفئة';
    const source=typeof row.source==='string'?{sourceId:String(row.sourceId||'').slice(0,100),source:row.source.slice(0,200),sheet:String(row.sheet??'').slice(0,100),sourceRow:Number.isSafeInteger(row.sourceRow)?row.sourceRow:i+2}:{};
    if(reason){errors.push({row:i+2,reason,...source});continue;}
    seen.add(code);if(serial)serials.add(id+':'+value+':'+serial);accepted.push({rowIndex:i,productId:id,index,value,code,serial,expiry,extra,...source});
  }
  return {accepted,errors};
}
export function findInventoryCard(entries,products,serial){
  const key=serial.trim();
  const entry=entries.find(r=>r.id===key)||entries.find(r=>r.serial===key)||entries.find(r=>!r.serial&&r.code===key);
  const product=entry&&products.find(p=>p.id===entry.productId);
  if(!product)return null;
  return {productId:product.id,name:product.name,value:entry.value,unit:product.unit,serial:entry.serial||entry.id||entry.code};
}
