import {ref,onMounted,onBeforeUnmount,nextTick} from 'vue/dist/vue.esm-bundler.js';
import {CreditCard,Gamepad2,Headphones,Smartphone,Star,ShoppingBag} from 'lucide-vue-next';
import MasalMark from './MasalMark.js';
import './splash.css';
const sessionKey='masal-intro-v1';
export default {
  components:{MasalMark,CreditCard,Gamepad2,Headphones,Smartphone,Star,ShoppingBag},
  props:{enabled:{type:Boolean,default:true}},
  setup(props){
    const visible=ref(false),leaving=ref(false),reduced=ref(false);
    const symbols=[CreditCard,Gamepad2,Star,Headphones,Smartphone,ShoppingBag];
    let timer,exitTimer,content,previousOverflow;
    function restore(){if(content)content.inert=false;if(previousOverflow!==undefined)document.body.style.overflow=previousOverflow;}
    function finish(){if(leaving.value||!visible.value)return;clearTimeout(timer);leaving.value=true;exitTimer=setTimeout(async()=>{visible.value=false;restore();await nextTick();document.querySelector('.auth-panel h1')?.focus({preventScroll:true});},reduced.value?0:260);}
    onMounted(()=>{
      if(!props.enabled)return;
      try{if(sessionStorage.getItem(sessionKey))return;sessionStorage.setItem(sessionKey,'1');}catch{}
      reduced.value=matchMedia('(prefers-reduced-motion: reduce)').matches;
      content=document.getElementById('masal-content');if(content)content.inert=true;
      previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';visible.value=true;
      timer=setTimeout(finish,reduced.value?180:1950);
    });
    onBeforeUnmount(()=>{clearTimeout(timer);clearTimeout(exitTimer);restore();});
    return {visible,leaving,reduced,symbols,finish};
  },
  template:`<div v-if="visible" class="masal-splash" :class="{'is-leaving':leaving,'is-reduced':reduced}" role="dialog" aria-modal="true" aria-label="مرحباً بك في ماسال" @keydown.esc="finish"><div class="splash-glow" aria-hidden="true"></div><div class="splash-scene"><div class="splash-symbols" aria-hidden="true"><span v-for="(symbol,i) in symbols" :key="i" :style="{'--i':i}"><component :is="symbol" :size="24"/></span></div><div class="splash-logo"><MasalMark/></div><div class="splash-wordmark"><strong>ماسال</strong><span lang="en" dir="ltr">MASAL</span></div><div class="splash-line" aria-hidden="true"></div></div><button class="splash-skip" @click="finish">تخطي</button></div>`
};
