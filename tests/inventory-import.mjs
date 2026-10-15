import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {parseDelimited,importSource,mappedRows,guessColumns} from '../src/inventory-import.js';
import {readInventorySources} from '../src/spreadsheets.js';
import {inventoryReport} from '../src/inventory-report.js';
import {validateInventory} from '../src/inventory.js';

assert.deepEqual(guessColumns(['معرف البطاقة','الفئة','PIN','الرقم التسلسلي']),{product_id:0,denomination:1,code:2,serial:3,expiry:-1});
assert.deepEqual(parseDelimited('\uFEFFserial,pin\r\n000123,"AB,C"\r\n000124,"A""B"'),[['serial','pin'],['000123','AB,C'],['000124','A"B']]);
assert.throws(()=>parseDelimited('pin\n"unfinished'),/اقتباس/);
const spaced=importSource('spaced.csv','نص',parseDelimited('pin\n\n"A\nB"\nC'));spaced.productId=1;spaced.value=5000;
assert.deepEqual(mappedRows([spaced]).map(r=>r.sourceRow),[3,5],'Source lines survive blank and quoted multiline rows');
const source=importSource('cards.csv','نص',parseDelimited('serial,pin\n000123,PIN-A\n000124,PIN-A'));
source.productId=1;source.value=5000;
const rows=mappedRows([source]);assert.equal(rows[0].serial,'000123');assert.equal(rows[0].sourceRow,2);
const checked=validateInventory(rows,[{id:1,values:[5000]}]);
assert.equal(checked.accepted.length,1);assert.equal(checked.errors[0].sourceRow,3);assert.match(checked.errors[0].reason,/مكرر/);
source.hasHeader=false;source.mapping={code:1,serial:0,product_id:-1,denomination:-1};assert.equal(mappedRows([source]).length,3);
assert.throws(()=>mappedRows([{...source,rows:Array.from({length:50001},()=>['1','CODE'])}]),/50000/);

const book=new ExcelJS.Workbook();
for(const name of ['first','second']){const sheet=book.addWorksheet(name);sheet.addRow(['product_id','denomination','code','serial']);sheet.addRow([1,5000,'PIN-'+name,'000001']);}
const buffer=await book.xlsx.writeBuffer();
const sources=await readInventorySources({name:'cards.xlsx',size:buffer.length,arrayBuffer:async()=>buffer});
assert.equal(sources.length,2);assert.equal(sources[1].sheet,'second');assert.equal(mappedRows(sources)[0].serial,'000001');
const dated=new ExcelJS.Workbook();dated.addWorksheet('dates').addRow(['expiry']);dated.worksheets[0].addRow([new Date('2099-01-01T00:00:00Z')]);const dateBuffer=await dated.xlsx.writeBuffer();const dateSource=(await readInventorySources({name:'dates.xlsx',size:dateBuffer.length,arrayBuffer:async()=>dateBuffer}))[0];assert.equal(dateSource.rows[0][0],'2099-01-01');
const ruleProduct={id:1,values:[5000],denominationRules:[{serialRequired:true,expiryRequired:true,requiredFields:['batch_tag']}]};
assert.equal(validateInventory([{product_id:1,denomination:5000,code:'RULE-PIN'}],[ruleProduct]).errors.length,1);
assert.equal(validateInventory([{product_id:1,denomination:5000,code:'RULE-PIN',serial:'0001',expiry:'2099-01-01',extra:{batch_tag:'test'}}],[ruleProduct]).accepted.length,1);
assert.equal(validateInventory([{product_id:1,denomination:5000,code:'A',serial:'S'},{product_id:1,denomination:6000,code:'B',serial:'S'}],[{id:1,values:[5000,6000]}]).accepted.length,2,'Serial scope is per denomination');
const bad=new ExcelJS.Workbook();bad.addWorksheet('bad').getCell('A1').value={formula:'1+1',result:2};const badBuffer=await bad.xlsx.writeBuffer();
await assert.rejects(()=>readInventorySources({name:'bad.xlsx',size:badBuffer.length,arrayBuffer:async()=>badBuffer}),/معادلات/);

const report=inventoryReport({revision:4,companies:[{id:'c',name:'شركة'}],categories:[{name:'اتصالات',active:true}],products:[{id:1,name:'بطاقة',manufacturerId:'c',category:'اتصالات',active:true,values:[1000,5000],unit:'د.ع',stock:[0,3],prices:[1100,5200]}]},new Date('2026-10-15T22:30:01Z'));
assert.equal(report.timestamp,'2026-10-16 01:30:01');assert.equal(report.rows.length,1);assert.equal(report.rows[0].quantity,3);assert.equal(report.rows[0].manufacturer,'شركة');assert.equal(report.filename,'masal-stock-2026-10-16-01-30-01.xlsx');
console.log('Multi-file imports, Arabic mapping, source lines, duplicate PIN, Excel sheets, formulas and Baghdad inventory report checks passed.');
