import {runOperation} from './operation-client.js';
import {ref,computed,watch} from 'vue/dist/vue.esm-bundler.js';
import {api,connected} from './api.js';
import {store,connection,refreshStore,applyState,record} from './store.js';
import {readInventorySources,exportWorkbook} from './spreadsheets.js';
import {IMPORT_FIELDS,importSource,parseDelimited,mappedRows} from './inventory-import.js';
import {validateInventory,previewInventory} from './inventory.js';
import PagedList from './PagedList.js';

export default {
  components:{PagedList},
  props:{purchaseMode:{type:Boolean,default:false},initialPurchase:{type:Object,default:()=>({})}},emits:['notice','saved'],
  setup(props,{emit}){
    const sources=ref([]),paste=ref(''),busy=ref(false),error=ref(''),preview=ref(null),excludeRejected=ref(false),fileInput=ref(null);
    const {codes:previewCodes,serials:previewSerials}=previewInventory;
    const purchase=ref({supplierId:'',companyId:'',source:'ملفات',invoice:'',currency:'IQD',notes:'',...props.initialPurchase});
    const notify=text=>emit('notice',text);
    const total=computed(()=>sources.value.reduce((sum,s)=>sum+s.rows.length+(s.hasHeader?0:1),0));
    watch(sources,()=>{preview.value=null;excludeRejected.value=false;},{deep:true,flush:'sync'});
    async function loadFiles(event){
      busy.value=true;error.value='';
      try{
        const files=Array.from(event.target.files||[]);if(files.length+sources.value.length>200)throw Error('الحد الأقصى 200 ملف أو ورقة.');
        const added=[];
        for(const file of files){
          added.push(...await readInventorySources(file));
          if(added.length+sources.value.length>200||total.value+added.reduce((n,s)=>n+s.rows.length,0)>50000)throw Error('تجاوزت حدود الاستيراد: 200 ملف / ورقة و50000 بطاقة.');
        }
        if(added.length+sources.value.length>200)throw Error('الحد الأقصى 200 ملف أو ورقة.');
        if(total.value+added.reduce((n,s)=>n+s.rows.length,0)>50000)throw Error('الحد الأقصى 50000 بطاقة في الاستيراد الواحد.');
        sources.value.push(...added);notify('تمت قراءة الملفات. راجع ربط الأعمدة والفئات.');
      }catch(e){error.value=e.message;}finally{busy.value=false;event.target.value='';}
    }
    function addPaste(){error.value='';try{
      const source=importSource('نص ملصوق '+(sources.value.length+1),'نص',parseDelimited(paste.value));
      if(sources.value.length>=200||total.value+source.rows.length>50000)throw Error('تجاوزت حدود الاستيراد.');
      sources.value.push(source);paste.value='';
    }catch(e){error.value=e.message;}}
    async function review(){
      busy.value=true;error.value='';preview.value=null;excludeRejected.value=false;
      try{
        const rows=mappedRows(sources.value);
        for(const s of sources.value){
          if(s.declaredCount!==''&&Number(s.declaredCount)!==rows.filter(r=>r.sourceId===s.id).length)throw Error('العدد المعلن لا يطابق عدد البطاقات في '+s.name);
          if(new Set((s.extraMappings||[]).map(m=>m.name.trim())).size!==(s.extraMappings||[]).length)throw Error('أسماء الحقول الإضافية مكررة');
          const used=Object.values(s.mapping).map(Number).filter(n=>n>=0);
          if(new Set(used).size!==used.length)throw Error('لا تربط العمود نفسه بأكثر من حقل.');
          if(Number(s.mapping.code)<0)throw Error('حدد عمود PIN / الكود لكل ملف أو ورقة.');
        }
        let checked;
        if(connected){await refreshStore();checked=await api('/admin/import/preview',{rows,revision:connection.revision,purchase:props.purchaseMode});}
        else checked={...validateInventory(rows,store.products,previewCodes,previewSerials),revision:0};
        checked.accepted=checked.accepted.map(r=>({...r,...Object.fromEntries(['unitCost','expenses','expiry'].map(field=>[field,rows[r.rowIndex??rows.findIndex(v=>v.code===r.code)]?.[field]]))}));
        preview.value={...checked,total:rows.length,files:sources.value.length,denominations:new Set(checked.accepted.map(r=>r.productId+':'+r.value)).size};
      }catch(e){error.value=e.message;}finally{busy.value=false;}
    }
    async function confirm(){
      if(busy.value||!preview.value?.accepted.length||preview.value.errors.length&&!excludeRejected.value)return;
      busy.value=true;error.value='';
      try{
        const checked=preview.value;
        const name=sources.value.map(s=>s.name+' / '+s.sheet).join('، ').slice(0,200);
        const rows=checked.accepted.map(r=>({product_id:r.productId,denomination:r.value,code:r.code,serial:r.serial,source:r.source,sheet:r.sheet,sourceRow:r.sourceRow,sourceId:r.sourceId,extra:r.extra,unitCost:r.unitCost,expenses:r.expenses,expiry:r.expiry}));
        if(props.purchaseMode){
          if(!connected)throw Error('طلبيات الشراء تتطلب الخادم المحلي.');
          const result=await runOperation({action:'purchase.save',...purchase.value,rows},checked.revision);emit('saved',result.target);sources.value=[];preview.value=null;notify('تم حفظ مسودة الطلبية. أرسلها للمراجعة من سجل الطلبيات.');return;
        }
        if(connected){const result=await api('/admin/import',{revision:checked.revision,rows,name,strict:true,rejectedCount:checked.errors.length});applyState(result.state);}
        else {
          const fresh=validateInventory(rows,store.products,previewCodes,previewSerials);
          if(fresh.errors.length)throw Error('تغيرت البيانات. أعد المعاينة.');
          for(const r of fresh.accepted){store.products.find(p=>p.id===r.productId).stock[r.index]++;previewCodes.add(r.code);if(r.serial)previewSerials.add(r.serial);previewInventory.entries.push({...r});}
          store.imports.unshift({id:crypto.randomUUID(),name,count:fresh.accepted.length,rejected:checked.errors.length,date:new Date().toISOString()});record('استيراد بطاقات');
        }
        sources.value=[];preview.value=null;notify('تم استيراد '+rows.length+' بطاقة للمخزون.');
      }catch(e){error.value=e.message;preview.value=null;}finally{busy.value=false;}
    }
    async function rejected(){try{await exportWorkbook('masal-import-rejected.xlsx',['الملف','الورقة','السطر','سبب الرفض'],preview.value.errors.map(e=>[e.source,e.sheet,e.sourceRow??e.row,e.reason]));}catch(e){error.value=e.message;}}
    return {purchase,sources,paste,busy,error,preview,excludeRejected,fileInput,store,total,fields:IMPORT_FIELDS,loadFiles,addPaste,review,confirm,rejected};
  },
  template:`<section class="admin-panel inventory-import">
    <div class="admin-panel-title"><h2>استيراد البطاقات</h2><span>ملفات ← ربط البيانات ← معاينة واعتماد</span></div>
    <div v-if="purchaseMode" class="inventory-mapping"><label>المورد<select v-model="purchase.supplierId" required><option value="">اختر المورد</option><option v-for="s in store.suppliers.filter(s=>s.active)" :value="s.id">{{s.name}}</option></select></label><label>الشركة المجهّزة<select v-model="purchase.companyId" required><option value="">اختر الشركة</option><option v-for="c in store.companies.filter(c=>c.active&&(c.role==='supplier'||c.role==='both'))" :value="c.id">{{c.name}}</option></select></label><label>العملة<select v-model="purchase.currency"><option>IQD</option><option>USD</option></select></label><label>فاتورة المورد<input v-model="purchase.invoice" maxlength="200"/></label><label>مصدر الطلبية<input v-model="purchase.source" maxlength="200"/></label><label>ملاحظات<input v-model="purchase.notes" maxlength="2000"/></label></div><p>ارفع ملفات XLSX أو CSV أو TXT، أو الصق النص. اربط كل ملف أو ورقة بفئة، أو استخدم أعمدة معرف البطاقة والفئة للملفات المختلطة.</p>
    <p class="admin-serial-note">حتى 200 ملف أو ورقة، و50000 بطاقة إجمالاً، و2 MB لكل ملف. احفظ التسلسلي وPIN كنص للحفاظ على الأصفار الأولى. {{purchaseMode?'حفظ المسودة لا يضيف مخزوناً؛ الاعتماد من سجل الطلبيات.':'الاستيراد المباشر يحتاج صلاحية الاعتماد.'}}</p>
    <fieldset :disabled="busy" class="inventory-import-controls">
      <button type="button" class="admin-primary" @click="fileInput.click()">اختيار ملفات</button><input ref="fileInput" type="file" accept=".xlsx,.csv,.txt" multiple hidden @change="loadFiles"/>
      <label>لصق بيانات البطاقات<textarea v-model="paste" rows="4" dir="ltr" placeholder="serial,pin&#10;000123,SECRET-CODE"></textarea></label>
      <button type="button" class="admin-secondary" :disabled="!paste.trim()" @click="addPaste">إضافة النص</button>
      <p v-if="sources.length">{{sources.length}} ملف / ورقة · {{total}} صف قبل الفحص</p>
      <PagedList :items="sources" :size="5" admin v-slot="{items}"><article v-for="s in items" :key="s.id" class="inventory-source">
        <div class="admin-panel-title"><h3>{{s.name}} / {{s.sheet}}</h3><button type="button" @click="sources.splice(sources.indexOf(s),1)">إزالة</button></div>
        <label class="admin-checkbox"><input type="checkbox" v-model="s.hasHeader"/> السطر الأول عناوين أعمدة</label>
        <div class="inventory-mapping"><label>البطاقة<select v-model="s.productId" @change="s.value=''" :aria-label="'بطاقة '+s.name"><option value="">من عمود الملف</option><option v-for="p in store.products" :key="p.id" :value="p.id">{{p.name}}</option></select></label>
        <label>الفئة<select v-model="s.value" :disabled="!s.productId" :aria-label="'فئة '+s.name"><option value="">من عمود الملف</option><option v-for="v in (store.products.find(p=>p.id===Number(s.productId))?.values||[])" :key="v" :value="v">{{v}}</option></select></label>
        <label v-for="(label,field) in fields" :key="field">{{label}}<select v-model.number="s.mapping[field]" :aria-label="label+' — '+s.name"><option :value="-1">غير محدد</option><option v-for="(h,i) in s.headers" :key="i" :value="i">عمود {{i+1}}{{s.hasHeader?' — '+h:''}}</option></select></label></div>
        <div class="inventory-mapping"><label>العدد المعلن (اختياري)<input v-model="s.declaredCount" type="number" min="0"/></label></div><div v-for="(mapping,mi) in s.extraMappings" class="inventory-mapping"><label>اسم الحقل الإضافي<input v-model="mapping.name" maxlength="60"/></label><label>عمود الحقل<select v-model.number="mapping.column"><option v-for="(h,i) in s.headers" :value="i">عمود {{i+1}} — {{h}}</option></select></label><button type="button" class="admin-secondary" @click="s.extraMappings.splice(mi,1)">إزالة الحقل</button></div><button v-if="s.extraMappings.length<10" type="button" class="admin-secondary" @click="s.extraMappings.push({name:'',column:0})">ربط حقل إضافي</button><div v-if="purchaseMode" class="inventory-mapping"><label>تكلفة البطاقة / {{purchase.currency}}<input v-model="s.unitCost" inputmode="decimal" placeholder="مثال: 2000" required/></label><label>مصاريف الملف / {{purchase.currency}}<input v-model="s.expenses" inputmode="decimal"/></label><label>انتهاء افتراضي<input v-model="s.expiry" type="date"/></label></div><small>{{s.rows.length+(s.hasHeader?0:1)}} صف · {{s.hasHeader?'تم التعرف على العناوين؛ يمكنك تعديل الربط.':'سيُستورد السطر الأول كبيانات.'}}</small>
      </article></PagedList>
      <button v-if="sources.length" type="button" class="admin-primary" @click="review">معاينة وفحص البطاقات</button>
    </fieldset>
    <p v-if="busy" role="status">جاري معالجة البيانات…</p><p v-if="error" role="alert" class="admin-form-error">{{error}}</p>
    <section v-if="preview" class="inventory-preview"><h3>نتيجة المعاينة</h3><div class="admin-preview-counts"><span>{{preview.total}} صف</span><span>{{preview.accepted.length}} مقبول</span><span>{{preview.errors.length}} مرفوض</span><span>{{preview.denominations}} فئات مميزة مقبولة</span></div>
      <p>لم تتم إضافة أي بطاقة للمخزون بعد. {{purchaseMode?'حفظ المسودة يثبت المقبول للمراجعة، والاعتماد اللاحق يعيد الفحص.':'الاعتماد يضيف المقبول فقط بعد إعادة الفحص في الخادم.'}}</p>
      <template v-if="preview.errors.length"><button type="button" class="admin-secondary" @click="rejected">تنزيل كشف المرفوضات</button>
      <PagedList :items="preview.errors" :size="10" admin v-slot="{items}"><ul class="admin-import-errors"><li v-for="e in items" :key="e.row">{{e.source}} / {{e.sheet}} — سطر {{e.sourceRow??e.row}}: {{e.reason}}</li></ul></PagedList>
      <label class="admin-checkbox"><input type="checkbox" v-model="excludeRejected" :disabled="busy"/> أوافق على استبعاد {{preview.errors.length}} صف مرفوض واستيراد {{preview.accepted.length}} بطاقة مقبولة فقط</label></template>
      <button type="button" class="admin-primary" :disabled="busy||!preview.accepted.length||(preview.errors.length&&!excludeRejected)" @click="confirm">{{purchaseMode?'حفظ مسودة طلبية':'اعتماد استيراد'}} {{preview.accepted.length}} بطاقة</button>
    </section>
  </section>`
};
