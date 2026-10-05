import {reactive} from 'vue/dist/vue.esm-bundler.js';
const initialProducts=[{id:1,name:'زين العراق',en:'Zain',category:'اتصالات',color:'#173f39',tag:'الأكثر طلباً',values:[5000,10000,25000],prices:[5250,10500,25800]}, {id:2,name:'آسياسيل',en:'asiacell',category:'اتصالات',color:'#c1343a',tag:'شحن رصيد',values:[5000,10000,25000],prices:[5250,10400,25800]}, {id:3,name:'ببجي موبايل',en:'PUBG',category:'ألعاب',color:'#282d3b',tag:'شدّات UC',values:[60,325,660],prices:[1500,7500,14500]}, {id:4,name:'Apple',en:'Apple',category:'عالمية',color:'#4b4550',tag:'المتجر الأمريكي',values:[10,25,50],prices:[15500,38500,76500]}, {id:5,name:'الرابعة',en:'AL RABIAA',category:'اتصالات',color:'#7749a5',tag:'بطاقات تعبئة',values:[5000,10000,25000],prices:[5250,10500,26000]}, {id:6,name:'PlayStation',en:'PS',category:'ألعاب',color:'#254c9a',tag:'المتجر الأمريكي',values:[10,25,50],prices:[15500,38500,76500]}, {id:7,name:'كورك',en:'KOREK',category:'اتصالات',color:'#0076aa',tag:'شحن رصيد',values:[5000,10000,25000],prices:[5200,10400,25800]}, {id:8,name:'Steam',en:'STEAM',category:'عالمية',color:'#203447',tag:'المتجر الأمريكي',values:[5,10,20],prices:[8000,15500,31000]}];
export const store=reactive({
  products:initialProducts.map(p=>({...p,active:true,wholesale:[...p.prices],stock:p.values.map(()=>0)})),
  orders:[],customers:[],tickets:[],imports:[],suppliers:[],events:[],
  settings:{name:'ماسال',lowStock:5,supportEmail:'',supportPhone:''},
});
export const number=n=>new Intl.NumberFormat('en-US').format(n);
export const isoDate=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Baghdad',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export function record(text){const time=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Baghdad',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date());store.events.unshift({id:crypto.randomUUID(),text,date:isoDate()+'T'+time+'+03:00'});store.events.splice(30);}
export function upsertCustomer(user){
  if(!user)return;
  const customer=store.customers.find(c=>c.email===user.email);
  if(customer){Object.assign(customer,user);return;}
  if(!customer){store.customers.push({...user,id:crypto.randomUUID(),kind:'فرد',active:true,discount:0,date:isoDate()});record('انضم حساب تجريبي جديد إلى ماسال');}
}
export function createOrder(product,denom,quantity,customer,merchant){
  const unit=(merchant?product.wholesale:product.prices)[denom];
  const order={id:'DEMO-'+String(store.orders.length+1).padStart(4,'0'),productId:product.id,name:product.name,value:product.values[denom],price:unit*quantity,quantity,date:isoDate(),customer:customer?.name||'زائر',email:customer?.email||'',kind:merchant?'محل':'فرد',status:'مكتمل',payment:'Qi / محاكاة'};
  if(product.stock[denom]>=quantity)product.stock[denom]-=quantity;
  store.orders.unshift(order);record('طلب تجريبي جديد: '+product.name);return order;
}
export function createTicket(subject,message,customer){
  store.tickets.unshift({id:'TICKET-'+String(store.tickets.length+1).padStart(4,'0'),subject,message,customer:customer?.name||'زائر',email:customer?.email||'',date:isoDate(),status:'مفتوحة',reply:''});record('تذكرة دعم جديدة');
}
