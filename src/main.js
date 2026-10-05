import {createApp,ref,computed,nextTick,onMounted,onBeforeUnmount} from 'vue/dist/vue.esm-bundler.js';
import {Home,Grid2X2,ShoppingBag,Headphones,Search,ChevronLeft,X,Check,Copy,CreditCard,Gamepad2,Smartphone,Layers,User,Plus,Minus,ShieldCheck,SlidersHorizontal,Ticket,ArrowUpRight} from 'lucide-vue-next';
import './style.css';
import CardDeck from './CardDeck.js';
import NavIcon from './NavIcon.js';
import AuthGate from './AuthGate.js';
import PwaControls from './PwaControls.js';
import Dashboard from './Dashboard.js';
import BannerSlider from './BannerSlider.js';
import MasalMark from './MasalMark.js';
import SplashIntro from './SplashIntro.js';
import MarketingSite from './marketing/Site.js';
import {router} from './marketing/router.js';
import {store,upsertCustomer,createOrder,createTicket} from './store.js';
const app=createApp({
components:{SplashIntro,BannerSlider,MarketingSite,Dashboard,PwaControls,AuthGate,NavIcon,CardDeck,Home,Grid2X2,ShoppingBag,Headphones,Search,ChevronLeft,X,Check,Copy,CreditCard,Gamepad2,Smartphone,Layers,User,Plus,Minus,ShieldCheck,SlidersHorizontal,Ticket,ArrowUpRight},
setup(){
const admin=ref(location.hash.startsWith('#/admin'));
const marketing=ref(location.hash.startsWith('#/ar'));
function readRoute(){admin.value=location.hash.startsWith('#/admin');marketing.value=location.hash.startsWith('#/ar');}
onMounted(()=>window.addEventListener('hashchange',readRoute));
onBeforeUnmount(()=>window.removeEventListener('hashchange',readRoute));
const entered=ref(false),session=ref(null),authRequest=ref(0);
function enterStore(user){session.value=user;entered.value=true;upsertCustomer(user);merchant.value=store.customers.find(c=>c.email===user?.email)?.kind==='محل';go('home');}
function accountAccess(){session.value=null;entered.value=false;merchant.value=false;toast.value='';authRequest.value++;}
function toggleMerchant(){merchant.value=!merchant.value;const customer=store.customers.find(c=>c.email===session.value?.email);if(customer)customer.kind=merchant.value?'محل':'فرد';}
const navMotion=ref(0);
const navIcons={Home,Grid2X2,ShoppingBag,Headphones};
const page=ref('home'),category=ref('الكل'),query=ref(''),merchant=ref(false),selected=ref(null),quantity=ref(1),denom=ref(0),orders=computed(()=>store.orders.filter(o=>o.email===(session.value?.email||''))),toast=ref(''),subject=ref(''),message=ref(''),success=ref(false),dialog=ref(null);
const products=computed(()=>store.products.filter(p=>p.active));
const myTickets=computed(()=>store.tickets.filter(t=>t.email===(session.value?.email||'')));
const number=n=>new Intl.NumberFormat('en-US').format(n);
const filtered=computed(()=>products.value.filter(p=>(category.value==='الكل'||p.category===category.value)&&(`${p.name} ${p.en}`.toLowerCase().includes(query.value.toLowerCase()))));
const price=computed(()=>selected.value?(merchant.value?selected.value.wholesale:selected.value.prices)[denom.value]*quantity.value:0);
const nav=[{id:'home',label:'الرئيسية',icon:'Home'},{id:'cards',label:'البطاقات',icon:'Grid2X2'},{id:'orders',label:'مشترياتي',icon:'ShoppingBag'},{id:'support',label:'الدعم',icon:'Headphones'}];
function go(p){navMotion.value++;page.value=p;query.value='';window.scrollTo({top:0,behavior:'smooth'});}
function notify(t){toast.value=t;setTimeout(()=>toast.value='',3000)}
async function open(p){selected.value=p;quantity.value=1;denom.value=0;success.value=false;await nextTick();dialog.value.showModal()}
function close(){dialog.value.close();selected.value=null}
function buy(){createOrder(selected.value,denom.value,quantity.value,session.value,merchant.value);success.value=true}
function support(){createTicket(subject.value,message.value,session.value);notify('أضفنا تذكرتك التجريبية إلى لوحة الإدارة');subject.value='';message.value=''}
async function copy(){try{await navigator.clipboard.writeText('DEMO-NOT-REDEEMABLE');notify('تم نسخ الكود التجريبي')}catch{notify('تعذّر النسخ. الكود: DEMO-NOT-REDEEMABLE')}}
if(document.modelContext?.registerTool){try{document.modelContext.registerTool({name:'browse_cards',description:'Filter demo cards in the visible catalog; does not purchase.',inputSchema:{type:'object',properties:{query:{type:'string'}},required:['query'],additionalProperties:false},execute:async input=>{if(typeof input.query!=='string')throw Error('query must be a string');page.value='cards';query.value=input.query;await nextTick();return filtered.value.map(p=>({id:p.id,name:p.name}))}})}catch{}}
return {marketing,store,toggleMerchant,admin,myTickets,entered,session,authRequest,enterStore,accountAccess,navMotion,navIcons,page,category,query,merchant,selected,quantity,denom,orders,toast,subject,message,success,dialog,products,number,filtered,price,nav,go,notify,open,close,buy,support,copy};
},
template:`
<SplashIntro :enabled="!admin"/><div id="masal-content">
<PwaControls :allow-install="!marketing"/>
<MarketingSite v-if="marketing"/>
<Dashboard v-if="admin"/>
<AuthGate v-show="!entered&&!admin&&!marketing" :request="authRequest" @enter="enterStore"/>
<div v-if="entered&&!admin&&!marketing" class="app-shell">
<aside class="sidebar"><a class="brand" href="#" @click.prevent="go('home')"><span class="brand-mark"><MasalMark/></span><span>{{store.settings.name}}<small>DIGITAL STORE</small></span></a><div class="side-label">المتجر</div><nav><button v-for="n in nav" :class="{active:page===n.id}" :aria-current="page===n.id?'page':undefined" @click="go(n.id)"><NavIcon :icon="navIcons[n.icon]" :active="page===n.id" :motion="navMotion"/><span>{{n.label}}</span><ChevronLeft/></button></nav><div class="side-bottom"><ShieldCheck/><p>ماسال</p><small>نسخة أولية للمعاينة</small></div></aside>
<main><header><div class="mobile-brand"><span class="brand-mark"><MasalMark/></span>{{store.settings.name}}</div><div class="breadcrumb">المتجر <ChevronLeft/> <span>{{nav.find(n=>n.id===page).label}}</span></div><div class="header-actions"><span class="preview-badge">معاينة تجريبية</span><button class="account-access" @click="accountAccess" :aria-label="session?'تسجيل الخروج':'تسجيل الدخول'"><User :size="17"/><span>{{session?session.name:'دخول'}}</span><small v-if="session">خروج</small></button><button class="profile" @click="toggleMerchant" :aria-label="merchant?'التبديل إلى حساب فرد':'التبديل إلى حساب محل'"><User/><span>{{merchant?'حساب محل':'حساب فرد'}}</span></button></div></header>
<div class="content"><Transition name="view" mode="out-in"><div :key="page">
<template v-if="page==='home'"><div class="welcome"><div><h1>البطاقات</h1></div></div>
<BannerSlider/><div class="hero"><div class="hero-copy"><span class="hero-label"><span></span> رصيد • ألعاب • بطاقات عالمية</span><h2>بطاقات الرصيد<br><span>والألعاب</span></h2><button @click="go('cards')">تصفّح البطاقات <Grid2X2 :size="18"/></button></div><CardDeck v-if="products.length" :products="products.slice(0,6)" @select="open"/></div>
<section class="brands-section"><div class="section-title"><h2>شركاتك المفضّلة</h2><button @click="go('cards')">عرض الكل <ChevronLeft :size="16"/></button></div><div class="brands"><button v-for="p in products.slice(0,6)" @click="open(p)"><span class="brand-logo" :style="{color:p.color}">{{p.en}}</span><span>{{p.name}}</span></button></div></section>
<div class="section-title"><div><span class="eyebrow">اختيارات يومية</span><h2>بطاقات مقترحة</h2></div><button @click="go('cards')">كل البطاقات <ChevronLeft :size="16"/></button></div><div class="product-grid"><article class="product" v-for="p in products.slice(0,4)"><div class="product-art" :style="{'--card-color':p.color}"><span>{{p.tag}}</span><strong dir="ltr">{{p.en}}</strong><small>DIGITAL GIFT CARD</small></div><div class="product-info"><h3>{{p.name}}</h3><span class="muted">{{p.values.length}} فئات متوفرة</span><div class="product-footer"><span><small>يبدأ من</small><b>{{number((merchant?p.wholesale:p.prices)[0])}} <small>د.ع</small></b></span><button @click="open(p)" :aria-label="'شراء '+p.name"><Plus :size="20"/></button></div></div></article></div></template>
<template v-if="page==='cards'"><span class="eyebrow">اختار اللي يناسبك</span><h1>اكتشف البطاقات</h1><div class="search"><Search/><input v-model="query" placeholder="ابحث عن شركة أو بطاقة..." aria-label="البحث عن بطاقة"/></div><div class="filters"><button v-for="c in ['الكل','اتصالات','ألعاب','عالمية']" :class="{selected:category===c}" @click="category=c">{{c}}</button><span>{{number(filtered.length)}} بطاقات</span></div><div class="merchant-note" v-if="merchant">معاينة حساب محل — تعرض أسعار المحلات المحددة بلوحة الإدارة.</div><div class="product-grid"><article class="product" v-for="p in filtered"><div class="product-art" :style="{'--card-color':p.color}"><span>{{p.tag}}</span><strong dir="ltr">{{p.en}}</strong><small>DIGITAL GIFT CARD</small></div><div class="product-info"><h3>{{p.name}}</h3><span class="muted">{{number(p.values.length)}} فئات متوفرة</span><div class="product-footer"><span><small>يبدأ من</small><b>{{number((merchant?p.wholesale:p.prices)[0])}} <small>د.ع</small></b></span><button @click="open(p)" :aria-label="'شراء '+p.name"><Plus/></button></div></div></article></div><div class="empty" v-if="!filtered.length"><Search/><h2>ما لقينا بطاقة بهالاسم</h2><button class="primary" @click="query='';category='الكل'">عرض كل البطاقات</button></div></template>
<template v-if="page==='orders'"><span class="eyebrow">كل بطاقاتك هنا</span><h1>مشترياتي</h1><div v-if="!orders.length" class="empty"><ShoppingBag/><h2>أول بطاقة بانتظارك</h2><p>جرّب شراء بطاقة حتى تشوف شكل طلباتك هنا.</p><button class="primary" @click="go('cards')">اكتشف البطاقات</button></div><div class="order" v-for="o in orders"><div><span class="status">طلب تجريبي · {{o.status}}</span><h2>{{o.name}} · {{number(o.value)}}</h2><small dir="ltr">{{o.id}} · {{o.date}}</small></div><b>{{number(o.price)}} د.ع</b><button @click="copy"><Copy :size="18"/> نسخ كود تجريبي</button></div></template>
<template v-if="page==='support'"><span class="eyebrow">الدعم</span><h1>الدعم والمساعدة</h1><div class="support-layout"><form class="support-form" @submit.prevent="support"><h2>شلون نكدر نساعدك؟</h2><label>عنوان الرسالة<input v-model="subject" required maxlength="100" placeholder="اكتب موضوع استفسارك"/></label><label>رسالتك<textarea v-model="message" required maxlength="2000" rows="5" placeholder="احچيلنا التفاصيل..."></textarea></label><p class="muted">التذكرة تظهر بلوحة الإدارة التجريبية خلال هذه الجلسة.</p><button class="primary">إضافة تذكرة تجريبية</button></form><div class="faq"><Headphones :size="36"/><h2>إجابات سريعة</h2><details><summary>وين ألكى الكارت بعد الشراء؟</summary><p>بقسم مشترياتي، تگدر تشوف تفاصيل الطلب وتنسخ الكود.</p></details><details><summary>شنو طرق الدفع؟</summary><p>الدفع المخطط له عبر Qi. الدفع الحالي محاكاة بدون خصم أموال.</p></details><details><summary>هل الأسعار نهائية؟</summary><p>لا، الأسعار والمنتجات بهذه النسخة لغرض المعاينة.</p></details></div></div><div class="ticket-history" v-if="myTickets.length"><h2>تذاكري</h2><article v-for="t in myTickets"><span>{{t.id}} · {{t.status}}</span><h3>{{t.subject}}</h3><p>{{t.message}}</p><p v-if="t.reply" class="ticket-reply">رد الإدارة: {{t.reply}}</p></article></div></template>
</div></Transition><footer><span>ماسال <span class="dot">/</span> MASAL</span><span dir="ltr">PREVIEW — 2026</span></footer></div></main>
<nav class="bottom-nav"><button v-for="n in nav" :class="{active:page===n.id}" :aria-current="page===n.id?'page':undefined" @click="go(n.id)"><NavIcon :icon="navIcons[n.icon]" :active="page===n.id" :motion="navMotion"/><span>{{n.label}}</span></button></nav>
<dialog ref="dialog" @click="e=>{if(e.target===dialog)close()}" @cancel="selected=null"><template v-if="selected"><button class="close" @click="close" aria-label="إغلاق"><X/></button><template v-if="!success"><span class="eyebrow">خلّص اختيارك</span><h2>{{selected.name}}</h2><p class="muted">{{selected.tag}}</p><label class="field-label">فئة البطاقة</label><div class="denominations"><button v-for="(v,i) in selected.values" :class="{selected:denom===i}" @click="denom=i">{{number(v)}} <small>{{selected.id===3?'UC':selected.category==='اتصالات'?'د.ع':'USD'}}</small></button></div><div class="quantity-row"><span>الكمية</span><div class="stepper"><button :disabled="quantity<=1" @click="quantity--" aria-label="تقليل الكمية"><Minus :size="18"/></button><span>{{number(quantity)}}</span><button :disabled="quantity>=20" @click="quantity++" aria-label="زيادة الكمية"><Plus :size="18"/></button></div></div><div class="payment"><CreditCard/><span>الدفع بواسطة Qi<small>محاكاة للدفع فقط</small></span><Check :size="18"/></div><div class="total"><span>المجموع</span><strong>{{number(price)}} <small>د.ع</small></strong></div><button class="primary wide" @click="buy">تجربة الشراء</button><p class="dialog-note">لا يتم خصم أي مبلغ أو إصدار كارت حقيقي.</p></template><template v-else><div class="success"><span><Check :size="36"/></span><h2>اكتملت التجربة!</h2><p>أضفنا طلبك التجريبي إلى مشترياتي.</p><button class="primary wide" @click="close();go('orders')">عرض مشترياتي</button></div></template></template></dialog>
<Transition name="toast"><div v-if="toast" class="toast" role="status">{{toast}}</div></Transition>
</div></div>`});app.component('MasalMark',MasalMark);app.use(router);app.mount('#app');
