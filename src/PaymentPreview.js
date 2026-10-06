import {t} from './i18n.js';
import {computed} from 'vue/dist/vue.esm-bundler.js';
import {ArrowRight,Check,ShieldCheck} from 'lucide-vue-next';
import './payment-preview.css';
export default {
 components:{ArrowRight,Check,ShieldCheck},
 props:{checkout:Object,receipt:{type:String,default:''}},emits:['confirm','back','orders'],
 setup(props){const amount=computed(()=>new Intl.NumberFormat('en-US').format(props.checkout.amount));return {t,amount};},
 template:`<section class="payment-preview" :aria-label="t('صفحة الدفع التجريبي')">
 <button v-if="!receipt" class="account-back" @click="$emit('back')"><ArrowRight :size="18"/>{{t('العودة إلى البطاقة')}}</button>
 <div class="payment-preview-card">
 <span class="payment-preview-brand" :class="{zaincash:checkout.method==='ZainCash'}"><img :src="checkout.method==='Qi'?'payments/qi.svg':'payments/zaincash.svg'" :alt="checkout.method"/></span>
 <span class="payment-preview-tag">{{t('دفع تجريبي')}}</span>
 <template v-if="!receipt"><h2>{{t('الدفع بواسطة')}} {{checkout.method}}</h2><p class="payment-preview-note">{{t('هذه صفحة دفع وهمية؛ لا تدخل بيانات مالية ولا يتم خصم أموال.')}}</p>
 <dl class="payment-preview-summary"><div><dt>{{t('البطاقة')}}</dt><dd>{{t(checkout.product.name)}}</dd></div><div><dt>{{t('فئة البطاقة')}}</dt><dd>{{checkout.product.values[checkout.denom]}} {{t(checkout.product.unit||'د.ع')}}</dd></div><div><dt>{{t('الكمية')}}</dt><dd>{{checkout.quantity}}</dd></div><div class="payment-preview-total"><dt>{{t('المجموع')}}</dt><dd>{{amount}} {{t('د.ع')}}</dd></div></dl>
 <div class="payment-preview-wallet"><ShieldCheck :size="23"/><span>{{t('حساب دفع تجريبي')}}<small dir="ltr">{{checkout.method==='Qi'?'•••• 4242':'•••• 7788'}}</small></span></div>
 <button class="primary wide" @click="$emit('confirm')">{{t('تأكيد الدفع التجريبي')}}</button></template>
 <div v-else class="success"><span><Check :size="36"/></span><h2>{{t('تم تأكيد الدفع التجريبي')}}</h2><p>{{t('أضفنا طلبك التجريبي إلى طلباتي.')}}</p><p dir="ltr">{{receipt}}</p><button class="primary wide" @click="$emit('orders')">{{t('عرض طلباتي')}}</button></div>
 </div></section>`
};
