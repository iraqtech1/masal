export function inventoryReport(state, now=new Date()) {
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Baghdad',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(now).map(p=>[p.type,p.value]));
  const timestamp=`${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
  const company=id=>state.companies?.find(c=>c.id===id)?.name||'غير محددة';
  const rows=state.products.flatMap(p=>p.values.map((value,i)=>({productId:p.id,name:p.name,manufacturer:company(p.manufacturerId),supplier:company(p.supplierCompanyId),category:p.category,value,unit:p.unit,quantity:p.stock[i]||0,price:p.prices[i],active:p.active&&state.categories.some(c=>c.name===p.category&&c.active)}))).filter(r=>r.quantity>0);
  return {timestamp,timeZone:'Asia/Baghdad',revision:state.revision??0,filename:`masal-stock-${timestamp.replace(/[: ]/g,'-')}.xlsx`,rows};
}
