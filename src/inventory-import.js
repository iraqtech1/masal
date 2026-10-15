export const IMPORT_LIMIT=50000;
const aliases={product_id:['productid','product_id','معرفالبطاقة','معرفالبطاقه','رقمالبطاقة'],denomination:['denomination','value','الفئة','الفئه','القيمة'],code:['code','pin','الكود','الرمز','رمزالبطاقة'],serial:['serial','serialnumber','serial_number','التسلسلي','السيريل','الرقمالتسلسلي'],expiry:['expiry','expiration','expiry_date','الانتهاء','تاريخالانتهاء']};
export const IMPORT_FIELDS={product_id:'معرف البطاقة',denomination:'الفئة',code:'PIN / الكود',serial:'التسلسلي',expiry:'الانتهاء'};
const normalize=s=>String(s??'').replace(/^\uFEFF/,'').trim().toLowerCase().replace(/[\s_-]/g,'');
export function guessColumns(headers){return Object.fromEntries(Object.entries(aliases).map(([field,names])=>[field,headers.findIndex(h=>names.some(n=>normalize(n)===normalize(h)))]));}
export function parseDelimited(text){
  text=text.replace(/^\uFEFF/,'');
  const first=text.split(/\r?\n/)[0],delimiters=['\t',',',';'];
  const delimiter=delimiters.sort((a,b)=>first.split(b).length-first.split(a).length)[0];
  const rows=[];let row=[],cell='',quoted=false,line=1,rowStart=1;
  const append=()=>{Object.defineProperty(row,'sourceRow',{value:rowStart});rows.push(row);row=[];rowStart=line;};
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(c==='\n'||c==='\r'&&text[i+1]!=='\n')line++;
    if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else if(quoted||!cell)quoted=!quoted;else cell+=c;}
    else if(!quoted&&(c===delimiter||c==='\n'||c==='\r')){row.push(cell);cell='';if(c!==delimiter){if(c==='\r'&&text[i+1]==='\n'){i++;line++;}append();}}
    else cell+=c;
  }
  if(quoted)throw Error('علامة اقتباس غير مغلقة في الملف.');
  row.push(cell);if(row.some(v=>v.trim()))append();
  if(rows.length>IMPORT_LIMIT+1)throw Error('الحد الأقصى 50000 بطاقة في الاستيراد.');
  return rows;
}
export function importSource(name,sheet,matrix){
  if(!matrix.length)throw Error('الملف أو الورقة ما بيها بيانات.');
  const headers=matrix[0].map(v=>String(v??''));
  return {declaredCount:'',extraMappings:[],unitCost:'',expenses:'0',expiry:'',id:crypto.randomUUID(),name,sheet,headers,rows:matrix.slice(1),mapping:guessColumns(headers),productId:'',value:'',hasHeader:true};
}
export function mappedRows(sources){
  const rows=[];
  for(const s of sources){
    const data=s.hasHeader?s.rows:[s.headers,...s.rows];
    for(let i=0;i<data.length;i++){
      if(!data[i].some(v=>String(v??'').trim()))continue;
      const row={};for(const field of Object.keys(IMPORT_FIELDS)){const col=Number(s.mapping[field]);row[field]=col>=0?(data[i][col]??''):'';}
      if(s.productId)row.product_id=s.productId;
      if(s.value!=='')row.denomination=s.value;
      rows.push({...row,source:s.name,sheet:s.sheet,sourceRow:data[i].sourceRow??i+(s.hasHeader?2:1),sourceId:s.id,extra:Object.fromEntries((s.extraMappings||[]).filter(m=>m.name).map(m=>[m.name.trim(),String(data[i][Number(m.column)]??'')])),unitCost:s.unitCost,expenses:s.expenses,expiry:row.expiry||s.expiry});
    }
  }
  if(!rows.length)throw Error('أضف ملفاً أو نصاً يحتوي بطاقات.');
  if(rows.length>IMPORT_LIMIT)throw Error('الحد الأقصى 50000 بطاقة في الاستيراد الواحد.');
  return rows;
}
