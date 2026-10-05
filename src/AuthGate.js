import {store} from './store.js';
import {ref,watch,nextTick} from 'vue/dist/vue.esm-bundler.js';
import {Layers,ChevronLeft,Eye,EyeOff,User,Smartphone,Mail,LockKeyhole} from 'lucide-vue-next';

export default {
  components:{Layers,ChevronLeft,Eye,EyeOff,User,Smartphone,Mail,LockKeyhole},
  props:{request:Number},
  emits:['enter'],
  setup(props,{emit}){
    const view=ref('welcome'),name=ref(''),phone=ref(''),email=ref(''),password=ref(''),show=ref(false),error=ref(''),busy=ref(false),heading=ref(null);
    // Demo accounts live only in this tab's memory; no credentials are persisted.
    const accounts=new Map();
    async function change(next){view.value=next;error.value='';password.value='';show.value=false;await nextTick();heading.value?.focus();window.scrollTo({top:0,behavior:'instant'});}
    watch(()=>props.request,()=>change('login'));
    const digest=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(v=>v.toString(16).padStart(2,'0')).join('');
    function enter(user){password.value='';error.value='';show.value=false;emit('enter',user);}
    async function submit(){
      if(busy.value)return;
      error.value='';
      const address=email.value.trim().toLowerCase();
      const mobile=phone.value.replace(/[\s()-]/g,'');
      if(view.value==='register'&&(!name.value.trim()||!/^\+?[0-9]{7,15}$/.test(mobile))){error.value='اكتب اسمك ورقم هاتف صحيح بالأرقام الإنجليزية.';return;}
      busy.value=true;
      try{
        const hash=await digest(password.value);
        if(view.value==='register'){
          if(accounts.has(address)){error.value='هذا الإيميل مسجّل بالتجربة. سجّل دخولك.';return;}
          const user={name:name.value.trim(),phone:mobile,email:address};
          accounts.set(address,{user,hash});enter(user);
        }else{
          const account=accounts.get(address);
          if(!account||account.hash!==hash){error.value='الإيميل أو الباسورد غير صحيح. أنشئ حساباً تجريبياً أولاً.';return;}
          const customer=store.customers.find(c=>c.email===address);
          if(customer&&!customer.active){error.value='هذا الحساب موقوف بالمعاينة. راجع إدارة المتجر.';return;}
          enter(customer?{name:customer.name,phone:customer.phone,email:customer.email}:account.user);
        }
      }catch{error.value='تعذّر إكمال التجربة. حاول مرة ثانية.';}finally{busy.value=false;}
    }
    return {store,view,name,phone,email,password,show,error,busy,heading,change,submit,guest:()=>enter(null)};
  },
  template:`<div class="auth-shell">
    <div class="auth-story" aria-hidden="true"><span class="auth-wordmark">MASAL / DIGITAL STORE</span><div><span class="auth-kicker">مساحتك الرقمية</span><h2>كل عالمك.<br>بمكان واحد.</h2><p>رصيدك، ألعابك وبطاقاتك المفضّلة.<br>اختارها على كيفك.</p></div><div class="auth-art"><span>Zain<small>رصيد واتصالات</small></span><span>PUBG<small>عالم الألعاب</small></span><span>Apple<small>بطاقات عالمية</small></span></div></div>
    <section class="auth-panel"><a href="#" class="brand auth-brand" @click.prevent="change('welcome')"><span class="brand-mark"><MasalMark/></span><span>{{store.settings.name}}<small>DIGITAL STORE</small></span></a>
      <div class="auth-body" :key="view">
        <template v-if="view==='welcome'"><span class="eyebrow">أهلاً بيك بماسال</span><h1 ref="heading" tabindex="-1">بطاقتك الجاية،<br><span>تبدأ من هنا.</span></h1><button class="primary auth-action" @click="guest">الدخول كزائر <ChevronLeft :size="18"/></button><button class="auth-outline auth-action" @click="change('login')">تسجيل الدخول <User :size="18"/></button><p class="auth-switch">جديد على ماسال؟ <button @click="change('register')">إنشاء حساب</button></p></template>
        <template v-else><button class="auth-back" @click="change('welcome')"><ChevronLeft :size="16"/> رجوع</button><span class="eyebrow">{{view==='login'?'نورت من جديد':'خلّينا نتعرّف عليك'}}</span><h1 ref="heading" tabindex="-1">{{view==='login'?'تسجيل الدخول':'إنشاء حساب'}}</h1><p class="auth-intro">{{view==='login'?'ادخل إيميلك والباسورد حتى تدخل لحسابك.':'كم معلومة بسيطة ونجهّز حسابك.'}}</p>
        <form class="auth-form" @submit.prevent="submit">
          <template v-if="view==='register'"><label for="auth-name">الاسم الكامل</label><div class="auth-field"><User :size="18"/><input id="auth-name" v-model="name" autocomplete="name" placeholder="اسمك الكامل" required maxlength="80"/></div><label for="auth-phone">رقم الهاتف</label><div class="auth-field"><Smartphone :size="18"/><input id="auth-phone" v-model="phone" type="tel" inputmode="tel" autocomplete="tel" dir="ltr" placeholder="07XXXXXXXXX" required maxlength="20"/></div></template>
          <label for="auth-email">الإيميل</label><div class="auth-field"><Mail :size="18"/><input id="auth-email" v-model="email" type="email" autocomplete="email" dir="ltr" placeholder="name@example.com" required maxlength="254"/></div>
          <label for="auth-password">الباسورد</label><div class="auth-field"><LockKeyhole :size="18"/><input id="auth-password" v-model="password" :type="show?'text':'password'" :autocomplete="view==='register'?'new-password':'current-password'" dir="ltr" :placeholder="view==='register'?'8 characters or more':'Password'" required :minlength="view==='register'?8:1" maxlength="128"/><button type="button" @click="show=!show" :aria-label="show?'إخفاء الباسورد':'إظهار الباسورد'" :aria-pressed="show"><EyeOff v-if="show" :size="18"/><Eye v-else :size="18"/></button></div><small v-if="view==='register'" class="auth-help">الباسورد يكون 8 أحرف أو أكثر.</small>
          <p v-if="error" class="auth-error" role="alert">{{error}}</p><button class="primary auth-action" :disabled="busy">{{busy?'لحظة...':view==='register'?'إنشاء حساب':'تسجيل الدخول'}} <ChevronLeft :size="18"/></button>
        </form><p class="auth-switch">{{view==='login'?'ما عندك حساب؟':'عندك حساب؟'}} <button @click="change(view==='login'?'register':'login')">{{view==='login'?'إنشاء حساب':'تسجيل الدخول'}}</button></p><button class="auth-guest" @click="guest">كمّل كزائر</button></template>

      </div><span class="auth-footer" dir="ltr">MASAL · YOUR DIGITAL EVERYDAY</span>
    </section>
  </div>`
};
