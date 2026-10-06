import {t,language} from './i18n.js';
import {ref,watch} from 'vue/dist/vue.esm-bundler.js';
import ThemeScene from './ThemeScene.js';
export const dark=ref(false);
try{dark.value=localStorage.getItem('masal-theme')==='dark';}catch{}
function apply(){document.documentElement.dataset.theme=dark.value?'dark':'light';document.querySelector('meta[name="theme-color"]')?.setAttribute('content',dark.value?'#09131f':'#a21c2d');}
apply();
watch(dark,()=>{apply();try{localStorage.setItem('masal-theme',dark.value?'dark':'light');}catch{}});
window.addEventListener('storage',event=>{if(event.key==='masal-theme'){dark.value=event.newValue==='dark';apply();}});
export default {components:{ThemeScene},setup(){return {t,language,dark};},template:`<button type="button" class="theme-toggle theme-scenic-toggle" @click="dark=!dark" :aria-pressed="dark" :aria-label="dark?t(&quot;تفعيل الوضع النهاري&quot;):t(&quot;تفعيل الوضع الليلي&quot;)" :title="dark?t(&quot;الوضع النهاري&quot;):t(&quot;الوضع الليلي&quot;)"><ThemeScene :dark="dark"/></button>`};
