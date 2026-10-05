import {createRouter,createWebHashHistory} from 'vue-router';
import Home from './Home.js';
const pending={template:'<Hero badge="ديجيتال زون" title="الخدمات الرقمية" accent=""/>',components:Home.components};
export const router=createRouter({history:createWebHashHistory(),routes:[{path:'/ar',component:Home},...['about','mini-apps','business','insights','business/partnerships'].map(path=>({path:'/ar/'+path,component:pending})),{path:'/:pathMatch(.*)*',component:{template:'<span/>'}}],scrollBehavior(to,from,saved){if(saved)return saved;if(to.hash)return {el:to.hash,top:95,behavior:'smooth'};return {top:0}}});
