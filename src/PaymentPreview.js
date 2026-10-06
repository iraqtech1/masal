import {t} from './i18n.js';
import {computed,ref} from 'vue/dist/vue.esm-bundler.js';
import {ArrowRight,Check,ShieldCheck} from 'lucide-vue-next';
import './payment-preview.css';
export default {
 components:{ArrowRight,Check,ShieldCheck},
 props:{checkout:Object,receipt:{type:String,default:''}},emits:['confirm','back','orders'],
 setup(props){const amount=computed(()=>new Intl.NumberFormat('en-US').format(props.checkout.amount));const buyer=ref(''),account=ref(''),expiry=ref('');return {t,amount,buyer,account,expiry};},
 template:`<section class="payment-preview" :aria-label="t('صفحة الدفع التجريبي')">
 <button v-if="!receipt" class="account-back" @click="$emit('back')"><ArrowRight :size="18"/>{{t('العودة إلى البطاقة')}}</button>
 <div class="payment-preview-card">
 <span class="payment-preview-brand" :class="{zaincash:checkout.method==='ZainCash'}"><img :src="checkout.method==='Qi'?'payments/qi.svg':'payments/zaincash.svg'" :alt="checkout.method"/></span>
 <span class="payment-preview-tag">{{t('دفع تجريبي')}}</span>
 <template v-if="!receipt"><h2>{{t('الدفع بواسطة')}} {{checkout.method}}</h2><p class="payment-preview-note">{{t('هذه صفحة دفع وهمية؛ لا تدخل بيانات مالية ولا يتم خصم أموال.')}}</p>
 <dl class="payment-preview-summary"><div><dt>{{t('البطاقة')}}</dt><dd>{{t(checkout.product.name)}}</dd></div><div><dt>{{t('فئة البطاقة')}}</dt><dd>{{checkout.product.values[checkout.denom]}} {{t(checkout.product.unit||'د.ع')}}</dd></div><div><dt>{{t('الكمية')}}</dt><dd>{{checkout.quantity}}</dd></div><div class="payment-preview-total"><dt>{{t('المجموع')}}</dt><dd>{{amount}} {{t('د.ع')}}</dd></div></dl>
 <form class="payment-details-form" @submit.prevent="$emit('confirm')">
 <label>{{t('اسم المشتري')}}<input v-model="buyer" required maxlength="80" autocomplete="off" :placeholder="t('اسم تجريبي')"/></label>
 <label v-if="checkout.method==='Qi'">{{t('رقم البطاقة التجريبي')}}<input v-model="account" required inputmode="numeric" pattern="[0-9]{16}" maxlength="16" dir="ltr" placeholder="4242424242424242" autocomplete="off"/></label>
 <label v-else>{{t('رقم محفظة زين كاش التجريبي')}}<input v-model="account" required inputmode="numeric" pattern="07[0-9]{9}" @input="account=$event.target.value.replace(/[^0-9]/g,'');$event.target.value=account" maxlength="11" dir="ltr" placeholder="07700000000" autocomplete="off"/></label>
 <label v-if="checkout.method==='Qi'">{{t('تاريخ الانتهاء')}}<input v-model="expiry" required pattern="(0[1-9]|1[0-2])/[0-9]{2}" maxlength="5" dir="ltr" placeholder="12/30" autocomplete="off"/></label>
 <button class="primary wide" type="submit">{{t('إتمام الشراء')}}</button></form></template>
 <div v-else class="success"><span><Check :size="36"/></span><h2>{{t('تم تأكيد الدفع التجريبي')}}</h2><p>{{t('أضفنا طلبك التجريبي إلى طلباتي.')}}</p><p dir="ltr">{{receipt}}</p><button class="primary wide" @click="$emit('orders')">{{t('عرض طلباتي')}}</button></div>
 </div></section>`
};
