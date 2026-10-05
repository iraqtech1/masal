import {ref,onMounted,onBeforeUnmount} from 'vue/dist/vue.esm-bundler.js';
import {useRegisterSW} from 'virtual:pwa-register/vue';
import {Download,RefreshCw,WifiOff,X} from 'lucide-vue-next';

export default {
  components:{Download,RefreshCw,WifiOff,X},
  setup(){
    const offline=ref(!navigator.onLine),installPrompt=ref(null),dismissed=ref(false),showHelp=ref(false),installError=ref('');
    const standalone=ref(matchMedia('(display-mode: standalone)').matches||navigator.standalone===true);
    const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
    let registration;
    const {needRefresh,updateServiceWorker}=useRegisterSW({onRegisteredSW(_url,reg){registration=reg;}});
    function network(){offline.value=!navigator.onLine;}
    function beforeInstall(event){event.preventDefault();installPrompt.value=event;dismissed.value=false;}
    function installed(){standalone.value=true;installPrompt.value=null;}
    function checkUpdate(){if(navigator.onLine)registration?.update().catch(()=>{});}
    async function install(){
      if(!installPrompt.value){showHelp.value=!showHelp.value;return;}
      installError.value='';
      try{await installPrompt.value.prompt();const {outcome}=await installPrompt.value.userChoice;if(outcome==='accepted')dismissed.value=true;installPrompt.value=null;}
      catch{installError.value='تعذّر التثبيت. جرّب من قائمة المتصفح.';}
    }
    onMounted(()=>{window.addEventListener('online',network);window.addEventListener('offline',network);window.addEventListener('beforeinstallprompt',beforeInstall);window.addEventListener('appinstalled',installed);window.addEventListener('focus',checkUpdate);});
    onBeforeUnmount(()=>{window.removeEventListener('online',network);window.removeEventListener('offline',network);window.removeEventListener('beforeinstallprompt',beforeInstall);window.removeEventListener('appinstalled',installed);window.removeEventListener('focus',checkUpdate);});
    return {offline,needRefresh,installPrompt,dismissed,standalone,ios,showHelp,installError,install,updateServiceWorker};
  },
  template:`<div class="pwa-controls">
    <div v-if="offline" class="pwa-offline" role="status"><WifiOff :size="15"/> بدون اتصال — تعرض النسخة المحفوظة</div>
    <div v-if="needRefresh" class="pwa-banner" role="status"><RefreshCw :size="20"/><div><b>تحديث جديد جاهز</b><p>حدّث التطبيق حتى تشوف آخر الإضافات.</p></div><button class="primary" @click="updateServiceWorker(true)">تحديث</button><button class="pwa-close" @click="needRefresh=false" aria-label="إغلاق تنبيه التحديث"><X :size="16"/></button></div>
    <div v-else-if="!standalone&&!dismissed&&(installPrompt||ios)" class="pwa-banner"><Download :size="20"/><div><b>خلّي ماسال على تلفونك</b><p v-if="showHelp">من زر المشاركة في Safari اختار «إضافة إلى الشاشة الرئيسية».</p><p v-else>ثبّت التطبيق وافتحه من الشاشة الرئيسية.</p><p v-if="installError" role="alert">{{installError}}</p></div><button class="primary" @click="install">{{ios&&!installPrompt?'الطريقة':'تثبيت'}}</button><button class="pwa-close" @click="dismissed=true" aria-label="إغلاق تنبيه التثبيت"><X :size="16"/></button></div>
  </div>`
};
