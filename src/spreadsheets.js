async function workbook(){const mod=await import('exceljs');return new mod.default.Workbook();}
import {importSource,parseDelimited,IMPORT_LIMIT} from './inventory-import.js';
export async function readInventorySources(file){
  if(!/\.(xlsx|csv|txt)$/i.test(file.name))throw Error('اختار XLSX أو CSV أو TXT.');
  if(file.size>2*1024*1024)throw Error('حجم كل ملف لازم يكون أقل من 2 MB.');
  if(!/\.xlsx$/i.test(file.name))return [importSource(file.name,'نص',parseDelimited(await file.text()))];
  const book=await workbook();await book.xlsx.load(await file.arrayBuffer());
  const sources=[];let total=0;
  for(const sheet of book.worksheets){
    if(!sheet.rowCount)continue;
    if(sheet.columnCount>100)throw Error('الحد الأقصى 100 عمود في الورقة.');
    total+=Math.max(0,sheet.rowCount-1);if(total>IMPORT_LIMIT)throw Error('الحد الأقصى 50000 بطاقة.');
    const matrix=[];
    for(let i=1;i<=sheet.rowCount;i++){
      const row=[];for(let j=1;j<=sheet.columnCount;j++){
        let v=sheet.getRow(i).getCell(j).value;if(v instanceof Date&&Number.isFinite(v.getTime()))v=v.toISOString().slice(0,10);
        if(typeof v==='object'&&v!==null)throw Error(`${sheet.name}، صف ${i}: استخدم نصوصاً أو أرقاماً بدون معادلات أو خلايا مركبة.`);
        row.push(v??'');
      }matrix.push(row);
    }
    sources.push(importSource(file.name,sheet.name,matrix));
  }
  if(!sources.length)throw Error('الملف ما بيه ورقة بيانات.');
  return sources;
}
export async function readInventory(file){
  if(!/\.xlsx$/i.test(file.name))throw Error('اختار ملف Excel بصيغة XLSX.');
  if(file.size>2*1024*1024)throw Error('حجم الملف لازم يكون أقل من 2 MB.');
  const book=await workbook();await book.xlsx.load(await file.arrayBuffer());
  const sheet=book.worksheets[0];if(!sheet)throw Error('الملف ما بيه ورقة بيانات.');
  if(sheet.rowCount>5001)throw Error('الحد الأقصى 5000 كارت بكل ملف.');
  const headers=sheet.getRow(1).values.slice(1).map(v=>String(v??'').trim());
  if(!['product_id','denomination','code'].every(h=>headers.includes(h)))throw Error('استخدم أعمدة القالب: product_id, denomination, code.');
  const rows=[];for(let i=2;i<=sheet.rowCount;i++){const row=sheet.getRow(i);if(!row.hasValues)continue;const item={};for(const header of ['product_id','denomination','code',...(headers.includes('serial')?['serial']:[])]){const v=row.getCell(headers.indexOf(header)+1).value;if(typeof v==='object'&&v!==null)throw Error('الخلايا لازم تكون قيم نصية أو أرقام بدون معادلات.');item[header]=v;}rows.push(item);}return rows;
}
export async function exportWorkbook(name,headers,rows,metadata=[]){
  const book=await workbook(),sheet=book.addWorksheet('Masal');sheet.views=[{rightToLeft:true}];sheet.addRow(headers);rows.forEach(r=>sheet.addRow(r));sheet.columns.forEach(c=>c.width=24);sheet.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};sheet.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF9B4A66'}};
  if(metadata.length){const info=book.addWorksheet('معلومات التقرير');info.views=[{rightToLeft:true}];metadata.forEach(row=>info.addRow(row));info.columns.forEach(c=>c.width=45);}
  const blob=new Blob([await book.xlsx.writeBuffer()],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
