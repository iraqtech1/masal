import {ref} from 'vue/dist/vue.esm-bundler.js';
import {User,LockKeyhole,Eye,EyeOff,ArrowLeft,CreditCard,Smartphone,Gamepad2,Headphones,Monitor,Cpu} from 'lucide-vue-next';
import './admin-login.css';

export default {
  components:{User,LockKeyhole,Eye,EyeOff,ArrowLeft,CreditCard,Smartphone,Gamepad2,Headphones,Monitor,Cpu},
  emits:['login'],
  setup(props,{emit}){
    const username=ref(''),password=ref(''),visible=ref(false),error=ref('');
    function submit(){
      if(username.value.trim()==='masal'&&password.value==='masal'){
        password.value='';error.value='';emit('login');
      }else{error.value='اسم المستخدم أو الباسورد غير صحيح.';}
    }
    return {username,password,visible,error,submit};
  },
  template:`<main class="masal-login">
    <div class="masal-login-frame">
      <section class="masal-login-form-panel" aria-labelledby="admin-login-title">
        <a href="#" class="masal-login-brand"><span><MasalMark/></span><b>ماسال<small>MASAL</small></b></a>
        <div class="masal-login-form-content">
          <span class="masal-login-symbol"><LockKeyhole :size="23"/></span>
          <h1 id="admin-login-title">تسجيل الدخول</h1><p>ادخل لحسابك في لوحة ماسال.</p>
          <form @submit.prevent="submit">
            <label for="admin-username">اسم المستخدم</label>
            <div class="masal-login-field"><User :size="18"/><input id="admin-username" v-model="username" autocomplete="username" autocapitalize="none" spellcheck="false" dir="ltr" placeholder="اسم المستخدم" required maxlength="80" @input="error=''"/></div>
            <label for="admin-password">الباسورد</label>
            <div class="masal-login-field"><LockKeyhole :size="18"/><input id="admin-password" v-model="password" :type="visible?'text':'password'" autocomplete="current-password" dir="ltr" placeholder="الباسورد" required maxlength="128" @input="error=''"/><button type="button" @click="visible=!visible" :aria-label="visible?'إخفاء الباسورد':'إظهار الباسورد'" :aria-pressed="visible"><EyeOff v-if="visible" :size="18"/><Eye v-else :size="18"/></button></div>
            <p v-if="error" class="masal-login-error" role="alert">{{error}}</p>
            <button class="masal-login-submit" type="submit">دخول <ArrowLeft :size="18"/></button>
          </form>
          <a class="masal-login-store" href="#">الرجوع للتطبيق <ArrowLeft :size="15"/></a>
        </div>
        <small class="masal-login-foot">لوحة إدارة تجريبية</small>
      </section>
      <section class="masal-login-art" aria-label="ماسال للبطاقات والإلكترونيات">
        <div class="masal-login-art-heading"><span dir="ltr">MASAL</span><h2>بطاقات وإلكترونيات</h2></div>
        <div class="masal-login-orbit" aria-hidden="true">
          <span class="masal-orbit-ring ring-one"></span><span class="masal-orbit-ring ring-two"></span><span class="masal-orbit-ring ring-three"></span>
          <div class="masal-orbit-logo"><MasalMark/></div>
          <span class="masal-orbit-item orbit-card"><CreditCard/><small>بطاقات</small></span>
          <span class="masal-orbit-item orbit-phone"><Smartphone/></span>
          <span class="masal-orbit-item orbit-game"><Gamepad2/></span>
          <span class="masal-orbit-item orbit-audio"><Headphones/></span>
          <span class="masal-orbit-item orbit-screen"><Monitor/></span>
          <span class="masal-orbit-item orbit-chip"><Cpu/></span>
        </div>
        <p class="masal-login-art-footer">ماسال<small>رصيد · ألعاب · إلكترونيات</small></p>
      </section>
    </div>
  </main>`
};
