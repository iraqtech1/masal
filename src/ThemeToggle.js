import {ref,watch} from 'vue/dist/vue.esm-bundler.js';
import {Moon,Sun} from 'lucide-vue-next';
const dark=ref(false);
try{dark.value=localStorage.getItem('masal-theme')==='dark';}catch{}
function apply(){document.documentElement.dataset.theme=dark.value?'dark':'light';document.querySelector('meta[name="theme-color"]')?.setAttribute('content',dark.value?'#09131f':'#a21c2d');}
apply();
watch(dark,()=>{apply();try{localStorage.setItem('masal-theme',dark.value?'dark':'light');}catch{}});
window.addEventListener('storage',event=>{if(event.key==='masal-theme'){dark.value=event.newValue==='dark';apply();}});
export default {components:{Moon,Sun},setup(){return {dark};},template:`<button type="button" class="theme-toggle" @click="dark=!dark" :aria-pressed="dark" :aria-label="dark?'تفعيل الوضع النهاري':'تفعيل الوضع الليلي'" :title="dark?'الوضع النهاري':'الوضع الليلي'"><Sun v-if="dark" :size="20"/><Moon v-else :size="20"/></button>`};
