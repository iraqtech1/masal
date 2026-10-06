import {t,language} from './i18n.js';
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
  return {t,language,root,opened,panelId,messages,unread,readAll};
 },
 template:`<header ref="root" class="store-header" @keydown.esc="opened=false">
  <div class="store-header-brand"><MasalMark/><div><strong>{{t(name)}}</strong><span>{{t("بطاقات الرصيد والألعاب")}}</span></div></div>
  <button type="button" class="notification-bell" :class="{'has-unread':unread}" :aria-label="unread?t(&quot;الإشعارات — &quot;)+unread+t(&quot; غير مقروءة&quot;):t(&quot;الإشعارات&quot;)" :aria-expanded="opened" :aria-controls="panelId" @click="opened=!opened"><Bell :size="25"/><span v-if="unread" class="notification-count" aria-hidden="true">{{unread>99?'99+':unread}}</span></button>
  <section v-if="opened" :id="panelId" class="notification-panel" :aria-label="t(&quot;قائمة الإشعارات&quot;)">
   <div class="notification-heading"><h2>{{t("الإشعارات")}}</h2><button type="button" :aria-label="t(&quot;إغلاق الإشعارات&quot;)" @click="opened=false"><X :size="19"/></button></div>
   <p class="notification-demo">{{t("إشعارات تجريبية للمعاينة")}}</p>
   <button v-if="unread" type="button" class="notification-read-all" @click="readAll"><CheckCheck :size="16"/>{{t("تحديد الكل كمقروء")}}</button>
   <ul><li v-for="message in messages" :key="message.id" :class="{unread:message.unread}"><span v-if="message.unread" class="notification-dot" :aria-label="t(&quot;غير مقروء&quot;)"></span><div><h3>{{t(message.title)}}</h3><p>{{t(message.body)}}</p><small>{{t(message.time)}}</small></div></li></ul>
  </section>
 </header>`
};
