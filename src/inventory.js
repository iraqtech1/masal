export function validateInventory(rows,products,existing=new Set()){
  const accepted=[],errors=[],seen=new Set(existing);
  for(let i=0;i<rows.length;i++){
    const row=rows[i],id=Number(row.product_id),value=Number(row.denomination),code=String(row.code??'').trim();
    const product=products.find(p=>p.id===id),index=product?.values.indexOf(value)??-1;
    let reason='';
    if(!product||index<0)reason='بطاقة أو فئة غير موجودة';
    else if(!code||code.length>256)reason='الكود فارغ أو أطول من المسموح';
    else if(seen.has(code))reason='كود مكرر';
    if(reason){errors.push({row:i+2,reason});continue;}
    seen.add(code);accepted.push({productId:id,index,value,code});
  }
  return {accepted,errors};
}
