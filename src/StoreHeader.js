import {ref,computed,watch,onMounted,onBeforeUnmount,useId} from 'vue/dist/vue.esm-bundler.js';
import {Bell,X,CheckCheck} from 'lucide-vue-next';
import MasalMark from './MasalMark.js';
import './store-header.css';
export default {
 components:{Bell,X,CheckCheck,MasalMark},
 props:{name:String,orderCount:Number,ticketCount:Number},
 setup(props){
  const root=ref(null),opened=ref(false),panelId='notifications-'+useId();
  const messages=ref([
   {id:1,title:'أهلاً بيك في ماسال',body:'تصفّح بطاقات الرصيد والألعاب واختار الفئة اللي تناسبك.',time:'الآن',unread:true},
   {id:2,title:'بطاقاتك المفضّلة بانتظارك',body:'اكتشف البطاقات المتوفرة من قسم شراء بطاقة.',time:'قبل دقيقة',unread:true},
   {id:3,title:'الدعم موجود لمساعدتك',body:'تگدر ترسل استفسارك وتتابع التذكرة من صفحة الدعم.',time:'قبل دقيقتين',unread:true}
  ]);
  const unread=computed(()=>messages.value.filter(message=>message.unread).length);
  function add(title,body){messages.value.unshift({id:Date.now(),title,body,time:'الآن',unread:true});}
  watch(()=>props.orderCount,(value,old)=>{if(value>old)add('تم إضافة طلبك التجريبي','تفاصيل البطاقة موجودة بصفحة مشترياتي.');});
  watch(()=>props.ticketCount,(value,old)=>{if(value>old)add('وصلتنا تذكرتك التجريبية','تگدر تتابع تفاصيلها من صفحة الدعم.');});
  function readAll(){messages.value.forEach(message=>message.unread=false);}
  function outside(event){if(root.value&&!root.value.contains(event.target))opened.value=false;}
  onMounted(()=>document.addEventListener('click',outside));
  onBeforeUnmount(()=>document.removeEventListener('click',outside));
  return {root,opened,panelId,messages,unread,readAll};
 },
 template:`<header ref="root" class="store-header" @keydown.esc="opened=false">
  <div class="store-header-brand"><MasalMark/><div><strong>{{name}}</strong><span>بطاقات الرصيد والألعاب</span></div></div>
  <button type="button" class="notification-bell" :class="{'has-unread':unread}" :aria-label="unread?'الإشعارات — '+unread+' غير مقروءة':'الإشعارات'" :aria-expanded="opened" :aria-controls="panelId" @click="opened=!opened"><Bell :size="25"/><span v-if="unread" class="notification-count" aria-hidden="true">{{unread>99?'99+':unread}}</span></button>
  <section v-if="opened" :id="panelId" class="notification-panel" aria-label="قائمة الإشعارات">
   <div class="notification-heading"><h2>الإشعارات</h2><button type="button" aria-label="إغلاق الإشعارات" @click="opened=false"><X :size="19"/></button></div>
   <p class="notification-demo">إشعارات تجريبية للمعاينة</p>
   <button v-if="unread" type="button" class="notification-read-all" @click="readAll"><CheckCheck :size="16"/>تحديد الكل كمقروء</button>
   <ul><li v-for="message in messages" :key="message.id" :class="{unread:message.unread}"><span v-if="message.unread" class="notification-dot" aria-label="غير مقروء"></span><div><h3>{{message.title}}</h3><p>{{message.body}}</p><small>{{message.time}}</small></div></li></ul>
  </section>
 </header>`
};
