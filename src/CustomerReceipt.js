import {ref,nextTick} from 'vue/dist/vue.esm-bundler.js';
import {api} from './api.js';
import {saveDownload} from './operation-client.js';
export default {
  props:{order:Object},emits:['notice'],
  setup(props,{emit}){
    const result=ref(null),busy=ref(false),printing=ref(false),error=ref('');
    async function open(){busy.value=true;error.value='';try{result.value=await api('/orders/receipt',{id:props.order.id});}catch(e){error.value=e.message;}finally{busy.value=false;}}
    async function copy(code){try{await navigator.clipboard.writeText(code);emit('notice','تم نسخ الكود');}catch{error.value='تعذر النسخ؛ يمكنك تحديد الكود ونسخه يدوياً.';}}
    async function download(){try{await api('/orders/receipt/event',{id:props.order.id,event:'download'});saveDownload('masal-receipt-'+result.value.id+'.txt',[result.value.id,result.value.name,result.value.reference||'',result.value.phone||'',...result.value.cards.map(c=>`Serial: ${c.serial||c.id}\nPIN: ${c.code}\nExpiry: ${c.expiry||'—'}`)].join('\n'),'text/plain;charset=utf-8');}catch(e){error.value=e.message;}}
    async function print(){try{await api('/orders/receipt/event',{id:props.order.id,event:'print_requested'});printing.value=true;await nextTick();window.print();await api('/orders/receipt/event',{id:props.order.id,event:'print_dialog_closed'});}catch(e){error.value=e.message;}finally{printing.value=false;}}
    return {result,busy,printing,error,open,copy,download,print};
  },
  template:`<div class="customer-receipt"><button :disabled="busy" @click="result?result=null:open()">{{busy?'جاري التحميل…':result?'إخفاء الوصل':'عرض الوصل والرموز'}}</button><p v-if="error" role="alert">{{error}}</p><section v-if="result" :class="{'ops-print-receipt':printing}"><h3>وصل ماسال</h3><small dir="ltr">{{result.id}}</small><p>{{result.name}} · {{result.price}} IQD</p><p v-if="result.phone">المستفيد: {{result.phone}}</p><p v-if="result.reference">المرجع: {{result.reference}}</p><p v-if="result.activationReceipt">إيصال التفعيل: {{result.activationReceipt}}</p><article class="ops-secret" v-for="c in result.cards" :key="c.id"><p>التسلسلي: <b dir="ltr">{{c.serial||c.id}}</b></p><p>PIN: <b dir="ltr">{{c.code}}</b></p><small>الانتهاء: {{c.expiry||'غير محدد'}}</small><button class="no-print" @click="copy(c.code)">نسخ الكود</button></article><div class="ops-actions no-print"><button @click="download">تنزيل الوصل</button><button @click="print">طباعة</button></div></section></div>`
};
