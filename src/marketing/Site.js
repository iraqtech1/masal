import {shared} from './components.js';
import './site.css';
import './pages.css';
import './motion.css';
import './contrast.css';
import {useRoute} from 'vue-router';
import {useReveal} from './reveal.js';
export default {components:shared,setup(){const route=useRoute();useReveal(route);return {route}},template:`<div class="dz-site" dir="rtl"><RouterLink class="dz-skip" :to="{path:route.path,hash:'#dz-content'}">انتقل إلى المحتوى</RouterLink><Navbar/><main class="dz-main" id="dz-content" tabindex="-1"><RouterView/></main><Footer/></div>`};
