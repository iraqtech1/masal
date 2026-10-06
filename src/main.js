import PagedList from './PagedList.js';
import {t,language,cardCount,applyLanguage} from './i18n.js';
import './language.css';
import {createApp,ref,computed,watch,nextTick,onMounted,onBeforeUnmount} from 'vue/dist/vue.esm-bundler.js';
import {Home,Grid2X2,ShoppingBag,Headphones,Search,ChevronLeft,X,Check,Copy,CreditCard,Gamepad2,Smartphone,Layers,User,Plus,Minus,ShieldCheck,SlidersHorizontal,Ticket,ArrowUpRight,Signal,Wifi} from 'lucide-vue-next';
import './style.css';
import './category-filters.css';
import './payment-methods.css';
import './mobile-navigation.css';
import CardDeck from './CardDeck.js';
import PullToRefresh from './PullToRefresh.js';
import NavIcon from './NavIcon.js';
import MobileDock from './MobileDock.js';
import StoreHeader from './StoreHeader.js';
import AuthGate,{auth} from './AuthGate.js';
import AccountPage from './AccountPage.js';
import PwaControls from './PwaControls.js';
import Dashboard from './Dashboard.js';
import ThemeToggle from './ThemeToggle.js';
import './theme.css';
import BannerSlider from './BannerSlider.js';
import MasalMark from './MasalMark.js';
import SplashIntro from './SplashIntro.js';
import MarketingSite from './marketing/Site.js';
import {router} from './marketing/router.js';
import {store,CATEGORIES,upsertCustomer,createOrder,createTicket,matchesCustomer} from './store.js';
import {restoreStoreSession,saveStoreSession} from './store-session.js';
router.afterEach(()=>applyLanguage());
const app=createApp({
components:{PagedList,StoreHeader,MobileDock,AccountPage,PullToRefresh,SplashIntro,BannerSlider,MarketingSite,Dashboard,PwaControls,AuthGate,NavIcon,CardDeck,Home,Grid2X2,ShoppingBag,Headphones,Search,ChevronLeft,X,Check,Copy,CreditCard,Gamepad2,Smartphone,Layers,User,Plus,Minus,ShieldCheck,SlidersHorizontal,Ticket,ArrowUpRight,Signal,Wifi},
setup(){
const admin=ref(location.hash.startsWith('#/admin'));
const marketing=ref(location.hash.startsWith('#/ar'));
function readRoute(){admin.value=location.hash.startsWith('#/admin');marketing.value=location.hash.startsWith('#/ar');}
onMounted(()=>window.addEventListener('hashchange',readRoute));
onBeforeUnmount(()=>window.removeEventListener('hashchange',readRoute));
let tabStorage;try{tabStorage=window.sessionStorage;}catch{}
const restored=restoreStoreSession(tabStorage);
const entered=ref(!!restored),session=ref(restored?.user||null),authRequest=ref(0);
if(restored?.user)upsertCustomer(restored.user);
function enterStore(user){session.value=user;entered.value=true;upsertCustomer(user);go('home');}
function accountAccess(){session.value=null;entered.value=false;toast.value='';authRequest.value++;}
const profileError=ref('');
function saveProfile({name,email,done}){try{const updated=auth.updateProfile({...session.value,name,email});session.value=updated;upsertCustomer(updated);profileError.value='';done();notify('تم حفظ الملف الشخصي');}catch(error){profileError.value=error.message;}}
const navMotion=ref(0);
const paymentMethod=ref('Qi');
const navIcons={Home,Grid2X2,ShoppingBag,Headphones,User,Plus};
const page=ref(restored?.page||'home'),category=ref('الكل'),query=ref(''),selected=ref(null),quantity=ref(1),denom=ref(0),orders=computed(()=>store.orders.filter(o=>matchesCustomer(o,session.value))),toast=ref(''),subject=ref(''),message=ref(''),success=ref(false),dialog=ref(null);
watch([entered,session,page],()=>saveStoreSession(tabStorage,{entered:entered.value,user:session.value,page:page.value}),{flush:'sync'});
const products=computed(()=>store.products.filter(p=>p.active));
const myTickets=computed(()=>store.tickets.filter(t=>matchesCustomer(t,session.value)));
const number=n=>new Intl.NumberFormat('en-US').format(n);
const filtered=computed(()=>products.value.filter(p=>(category.value==='الكل'||p.category===category.value)&&(`${p.name} ${t(p.name)} ${p.en}`.toLowerCase().includes(query.value.toLowerCase()))));
const price=computed(()=>selected.value?selected.value.prices[denom.value]*quantity.value:0);
const filterCats=computed(()=>['الكل',...CATEGORIES]);
const categoryIcons={'الكل':Grid2X2,'اتصالات':Signal,'إنترنت':Wifi,'ألعاب':Gamepad2,'متاجر عالمية':ShoppingBag,'تطبيقات':Smartphone};
const previewImage=ref('');
const denomArt=computed(()=>selected.value?.denomImages?.[denom.value]||'');
const gallery=computed(()=>selected.value?[...new Set([selected.value.image,...(selected.value.denomImages||[])].filter(Boolean))]:[]);
const shownImage=computed(()=>previewImage.value||denomArt.value||selected.value?.image||'');
watch(denom,()=>{previewImage.value=''});
const nav=[{id:'home',label:'الرئيسية',icon:'Home'},{id:'cards',label:'البطاقات',icon:'Grid2X2'},{id:'orders',label:'طلباتي',icon:'ShoppingBag'},{id:'support',label:'الدعم',icon:'Headphones'},{id:'account',label:'حسابي',icon:'User'}];
const mobileNav=[{id:'home',label:'الرئيسية',icon:'Home'},{id:'orders',label:'طلباتي',icon:'ShoppingBag'},{id:'cards',label:'شراء بطاقة',icon:'Plus',primary:true},{id:'support',label:'الدعم',icon:'Headphones'},{id:'account',label:'حسابي',icon:'User'}];
function go(p){navMotion.value++;page.value=p;query.value='';nextTick(()=>{const scroller=innerWidth<=700?document.querySelector('.app-shell>main'):window;scroller?.scrollTo({top:0,behavior:innerWidth<=700?'instant':'smooth'});});}
function notify(t){toast.value=t;setTimeout(()=>toast.value='',3000)}
async function open(p){selected.value=p;quantity.value=1;denom.value=0;paymentMethod.value='Qi';success.value=false;previewImage.value='';await nextTick();dialog.value.showModal()}
function close(){dialog.value.close();selected.value=null}
function startCheckout(){if(!selected.value||success.value)return;createOrder(selected.value,denom.value,quantity.value,session.value,paymentMethod.value);success.value=true;}

function support(){createTicket(subject.value,message.value,session.value);notify('أضفنا تذكرتك التجريبية إلى لوحة الإدارة');subject.value='';message.value=''}
async function copy(){try{await navigator.clipboard.writeText('DEMO-NOT-REDEEMABLE');notify('تم نسخ الكود التجريبي')}catch{notify('تعذّر النسخ. الكود: DEMO-NOT-REDEEMABLE')}}
if(document.modelContext?.registerTool){try{document.modelContext.registerTool({name:'browse_cards',description:'Filter demo cards in the visible catalog; does not purchase.',inputSchema:{type:'object',properties:{query:{type:'string'}},required:['query'],additionalProperties:false},execute:async input=>{if(typeof input.query!=='string')throw Error('query must be a string');page.value='cards';query.value=input.query;await nextTick();return filtered.value.map(p=>({id:p.id,name:p.name}))}})}catch{}}
return {t,language,cardCount,profileError,saveProfile,marketing,store,admin,myTickets,entered,session,authRequest,enterStore,accountAccess,navMotion,navIcons,page,category,query,selected,quantity,denom,orders,toast,subject,message,success,dialog,products,number,filtered,price,filterCats,categoryIcons,previewImage,gallery,shownImage,nav,mobileNav,go,notify,open,close,startCheckout,paymentMethod,support,copy};
},
template:`
<SplashIntro :enabled="!admin"/><div id="masal-content">
<PwaControls :allow-install="!marketing"/>
<MarketingSite v-if="marketing"/>
<Dashboard v-if="admin"/>
<AuthGate v-show="!entered&&!admin&&!marketing" :request="authRequest" @enter="enterStore"/>
<div v-if="entered&&!admin&&!marketing" class="app-shell">
<PullToRefresh/>
<aside class="sidebar"><a class="brand" href="#" @click.prevent="go('home')"><span class="brand-mark"><MasalMark/></span><span>{{t(store.settings.name)}}<small>DIGITAL STORE</small></span></a><div class="side-label">{{t("المتجر")}}</div><nav><button v-for="n in nav" :class="{active:page===n.id}" :aria-current="page===n.id?'page':undefined" @click="go(n.id)"><NavIcon :icon="navIcons[n.icon]" :kind="n.id" :active="page===n.id" :motion="navMotion"/><span>{{t(n.label)}}</span><ChevronLeft/></button></nav><div class="side-bottom"><ShieldCheck/><p>{{t("ماسال")}}</p><small>{{t("نسخة أولية للمعاينة")}}</small></div></aside>
<main><StoreHeader :name="store.settings.name" :order-count="orders.length" :ticket-count="myTickets.length"/>
<div class="content"><Transition name="view" mode="out-in"><div :key="page">
<template v-if="page==='home'">
<BannerSlider/><div class="hero"><div class="hero-copy"><span class="hero-label"><span></span> {{t("رصيد • ألعاب • بطاقات عالمية")}}</span><h2>{{t("بطاقات الرصيد")}}<br><span>{{t("والألعاب")}}</span></h2></div><CardDeck v-if="products.length" :products="products.slice(0,6)" @select="open"/></div>
<section class="brands-section"><div class="section-title"><h2>{{t("شركاتك المفضّلة")}}</h2><button @click="go('cards')">{{t("عرض الكل")}} <ChevronLeft :size="16"/></button></div><div class="brands" tabindex="0" :aria-label="t('شركاتك المفضّلة')"><button v-for="p in products.slice(0,6)" @click="open(p)"><span class="brand-logo" :style="{color:p.color}">{{p.en}}</span><span>{{t(p.name)}}</span></button></div></section><BannerSlider placement="middle" :interval="2000" :label="t(&quot;سلايدر وسطي&quot;)" :show-playback="false"/>
<div class="section-title"><div><h2>{{t("بطاقات مقترحة")}}</h2></div><button @click="go('cards')">{{t("كل البطاقات")}} <ChevronLeft :size="16"/></button></div><div class="product-grid"><article class="product product-selectable" v-for="p in products.slice(0,4)" role="button" tabindex="0" :aria-label="t(&quot;اختيار فئة &quot;)+t(p.name)" @click="open(p)" @keydown.enter.prevent="open(p)" @keydown.space.prevent="open(p)"><div class="product-art" :class="{'has-image':p.image}" :style="{'--card-color':p.color}"><img v-if="p.image" :src="p.image" :alt="t(p.name)" loading="lazy"/><template v-else><span>{{t(p.tag)}}</span><strong dir="ltr">{{p.en}}</strong><small>DIGITAL GIFT CARD</small></template></div><div class="product-info"><h3>{{t(p.name)}}</h3><b class="product-price">{{number(p.prices[0])}} <small>{{t("د.ع")}}</small></b></div></article></div></template>
<template v-if="page==='cards'"><div class="search"><Search/><input v-model="query" :placeholder="t(&quot;ابحث عن شركة أو بطاقة...&quot;)" :aria-label="t(&quot;البحث عن بطاقة&quot;)"/></div><section class="category-filters" :aria-label="t(&quot;تصنيفات البطاقات&quot;)"><div class="category-tiles"><button v-for="c in filterCats" :key="c" :class="{selected:category===c}" :aria-pressed="category===c" @click="category=c"><span class="category-tile-icon"><component :is="categoryIcons[c]" :size="32" :stroke-width="1.7" aria-hidden="true"/></span><span class="category-tile-label">{{t(c)}}</span></button></div><span class="category-result-count">{{cardCount(filtered.length)}}</span></section><PagedList :items="filtered" :reset-key="query+category+language" v-slot="{items:cardRows}"><div class="product-grid"><article class="product product-selectable" v-for="p in cardRows" :key="p.id" role="button" tabindex="0" :aria-label="t(&quot;اختيار فئة &quot;)+t(p.name)" @click="open(p)" @keydown.enter.prevent="open(p)" @keydown.space.prevent="open(p)"><div class="product-art" :class="{'has-image':p.image}" :style="{'--card-color':p.color}"><img v-if="p.image" :src="p.image" :alt="t(p.name)" loading="lazy"/><template v-else><span>{{t(p.tag)}}</span><strong dir="ltr">{{p.en}}</strong><small>DIGITAL GIFT CARD</small></template></div><div class="product-info"><h3>{{t(p.name)}}</h3><b class="product-price">{{number(p.prices[0])}} <small>{{t("د.ع")}}</small></b></div></article></div></PagedList><div class="empty" v-if="!filtered.length"><Search/><h2>{{t("ما لقينا بطاقة بهالاسم")}}</h2><button class="primary" @click="query='';category='الكل'">{{t("عرض كل البطاقات")}}</button></div></template>
<template v-if="page==='orders'"><div v-if="!orders.length" class="empty"><ShoppingBag/><h2>{{t("أول بطاقة بانتظارك")}}</h2><p>{{t("جرّب شراء بطاقة حتى تشوف شكل طلباتك هنا.")}}</p><button class="primary" @click="go('cards')">{{t("اكتشف البطاقات")}}</button></div><PagedList :items="orders" v-slot="{items:orderRows}"><div class="order" v-for="o in orderRows" :key="o.id"><div><span class="status">{{t("طلب تجريبي ·")}} {{t(o.status)}}</span><h2>{{t(o.name)}} · {{number(o.value)}}</h2><small dir="ltr">{{o.id}} · {{o.date}}</small></div><b>{{number(o.price)}} {{t("د.ع")}}</b><button @click="copy"><Copy :size="18"/> {{t("نسخ كود تجريبي")}}</button></div></PagedList></template>
<template v-if="page==='support'"><div class="support-layout"><form class="support-form" @submit.prevent="support"><h2>{{t("شلون نكدر نساعدك؟")}}</h2><label>{{t("عنوان الرسالة")}}<input v-model="subject" required maxlength="100" :placeholder="t(&quot;اكتب موضوع استفسارك&quot;)"/></label><label>{{t("رسالتك")}}<textarea v-model="message" required maxlength="2000" rows="5" :placeholder="t(&quot;احچيلنا التفاصيل...&quot;)"></textarea></label><p class="muted">{{t("التذكرة تظهر بلوحة الإدارة التجريبية خلال هذه الجلسة.")}}</p><button class="primary">{{t("إضافة تذكرة تجريبية")}}</button></form><div class="faq"><Headphones :size="36"/><h2>{{t("إجابات سريعة")}}</h2><details><summary>{{t("وين ألكى الكارت بعد الشراء؟")}}</summary><p>{{t("بقسم طلباتي، تگدر تشوف تفاصيل الطلب وتنسخ الكود.")}}</p></details><details><summary>{{t("شنو طرق الدفع؟")}}</summary><p>{{t("الدفع المخطط له عبر Qi. الدفع الحالي محاكاة بدون خصم أموال.")}}</p></details><details><summary>{{t("هل الأسعار نهائية؟")}}</summary><p>{{t("لا، الأسعار والمنتجات بهذه النسخة لغرض المعاينة.")}}</p></details></div></div><div class="ticket-history" v-if="myTickets.length"><h2>{{t("تذاكري")}}</h2><PagedList :items="myTickets" v-slot="{items:ticketRows}"><article v-for="ticket in ticketRows" :key="ticket.id"><span>{{ticket.id}} · {{t(ticket.status)}}</span><h3>{{ticket.subject}}</h3><p>{{ticket.message}}</p><p v-if="ticket.reply" class="ticket-reply">{{t("رد الإدارة:")}} {{ticket.reply}}</p></article></PagedList></div></template>
<template v-if="page==='account'"><AccountPage :user="session" :error="profileError" @save="saveProfile" @logout="accountAccess"/></template>
</div></Transition></div></main>
<MobileDock :items="mobileNav" :icons="navIcons" :page="page" @navigate="go"/>
<dialog ref="dialog" @click="e=>{if(e.target===dialog)close()}" @cancel="selected=null"><template v-if="selected"><button class="close" @click="close" :aria-label="t(&quot;إغلاق&quot;)"><X/></button><template v-if="!success"><span class="eyebrow">{{t("خلّص اختيارك")}}</span><h2>{{t(selected.name)}}</h2><p class="muted">{{t(selected.tag)}}</p><div class="dialog-art" v-if="shownImage"><img :src="shownImage" :alt="t(selected.name)"/></div><div class="dialog-gallery" v-if="gallery.length>1"><button v-for="g in gallery" :key="g" :class="{selected:shownImage===g}" @click="previewImage=g" :aria-label="t(&quot;عرض صورة بطاقة &quot;)+t(selected.name)"><img :src="g" alt=""/></button></div><label class="field-label">{{t("فئة البطاقة")}}</label><div class="denominations"><button v-for="(v,i) in selected.values" :class="{selected:denom===i}" @click="denom=i">{{number(v)}} <small>{{t(selected.unit||"د.ع")}}</small></button></div><div class="quantity-row"><span>{{t("الكمية")}}</span><div class="stepper"><button :disabled="quantity<=1" @click="quantity--" :aria-label="t(&quot;تقليل الكمية&quot;)"><Minus :size="18"/></button><span>{{number(quantity)}}</span><button :disabled="quantity>=20" @click="quantity++" :aria-label="t(&quot;زيادة الكمية&quot;)"><Plus :size="18"/></button></div></div><section class="payment-methods" :aria-label="t(&quot;طرق الدفع&quot;)"><h3>{{t("الدفع بواسطة")}}</h3><div class="payment-method-grid"><button type="button" :class="{selected:paymentMethod==='Qi'}" :aria-pressed="paymentMethod==='Qi'" @click="paymentMethod='Qi'" :aria-label="t(&quot;الدفع بواسطة&quot;)+' Qi'"><span class="payment-logo"><img src="payments/qi.svg" alt=""/></span><span dir="ltr">Qi</span></button><button type="button" :class="{selected:paymentMethod==='ZainCash'}" :aria-pressed="paymentMethod==='ZainCash'" @click="paymentMethod='ZainCash'" :aria-label="t(&quot;الدفع بواسطة&quot;)+' ZainCash'"><span class="payment-logo zaincash"><img src="payments/zaincash.svg" alt=""/></span><span dir="ltr">ZainCash</span></button></div></section><div class="total"><span>{{t("المجموع")}}</span><strong>{{number(price)}} <small>{{t("د.ع")}}</small></strong></div><button class="primary wide" @click="startCheckout()">{{t("إتمام الشراء")}}</button></template><template v-else><div class="success"><span><Check :size="36"/></span><h2>{{t("اكتملت التجربة!")}}</h2><p>{{t("أضفنا طلبك التجريبي إلى طلباتي.")}}</p><button class="primary wide" @click="close();go('orders')">{{t("عرض طلباتي")}}</button></div></template></template></dialog>
<Transition name="toast"><div v-if="toast" class="toast" role="status">{{t(toast)}}</div></Transition>
</div></div>`});app.component('MasalMark',MasalMark);app.component('ThemeToggle',ThemeToggle);app.use(router);app.mount('#app');
