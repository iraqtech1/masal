import {ref,computed,onMounted,onUnmounted} from 'vue/dist/vue.esm-bundler.js';
import {ChevronUp,ChevronDown} from 'lucide-vue-next';
import './card-deck.css';
import {deckSwipeStep} from './deck-gesture.js';

export default {
  components:{ChevronUp,ChevronDown},
  props:{products:Array},
  emits:['select'],
  setup(props,{emit}){
    const active=ref(0),hovered=ref(false),focused=ref(false),reduced=ref(false);
    const current=computed(()=>props.products[active.value]);
    let timer,media,start=null,moved=false;
    const move=step=>active.value=(active.value+step+props.products.length)%props.products.length;
    const offset=i=>{let n=(i-active.value+props.products.length)%props.products.length;return n>props.products.length/2?n-props.products.length:n};
    const style=i=>{const n=offset(i);return {'--slot':n,'--tilt':`${n===0?-3:n%2===0?-12:10}deg`,zIndex:10-Math.abs(n),opacity:Math.abs(n)>2?0:1,visibility:Math.abs(n)>2?'hidden':'visible'}};
    function down(e){if(e.button!==0)return;start={x:e.clientX,y:e.clientY,id:e.pointerId};moved=false;hovered.value=true}
    function drag(e){if(!start||e.pointerId!==start.id)return;if(Math.max(Math.abs(e.clientX-start.x),Math.abs(e.clientY-start.y))>12){moved=true;e.currentTarget.setPointerCapture(e.pointerId)}}
    function up(e){if(!start||e.pointerId!==start.id)return;const step=deckSwipeStep(e.clientX-start.x,e.clientY-start.y);if(step){moved=true;move(step)}cancel(e)}
    function cancel(e){if(start&&e?.currentTarget.hasPointerCapture(start.id))e.currentTarget.releasePointerCapture(start.id);start=null;hovered.value=false}
    function select(p,i){if(moved){moved=false;return}if(i===active.value)emit('select',p);else active.value=i}
    function key(e){if(e.key==='ArrowDown'||e.key==='ArrowRight'){e.preventDefault();move(1)}if(e.key==='ArrowUp'||e.key==='ArrowLeft'){e.preventDefault();move(-1)}}
    const motion=e=>reduced.value=e.matches;
    onMounted(()=>{media=matchMedia('(prefers-reduced-motion: reduce)');reduced.value=media.matches;media.addEventListener('change',motion);timer=setInterval(()=>{if(!hovered.value&&!focused.value&&!reduced.value&&!document.hidden)move(1)},3200)});
    onUnmounted(()=>{clearInterval(timer);media?.removeEventListener('change',motion)});
    return {active,current,hovered,focused,reduced,move,offset,style,down,drag,up,cancel,select,key};
  },
  template:`<section class="card-deck" aria-label="الكارتات المميزة" aria-roledescription="carousel" @mouseenter="hovered=true" @mouseleave="hovered=false" @focusin="focused=true" @focusout="focused=false" @keydown="key">
    <div class="deck-stage" @pointerdown="down" @pointermove="drag" @pointerup="up" @pointercancel="cancel" @lostpointercapture="cancel">
      <button v-for="(p,i) in products" :key="p.id" class="deck-card" :class="{'deck-current':i===active,'deck-white':i%2===1}" :style="style(i)" :tabindex="Math.abs(offset(i))<=2?0:-1" :aria-hidden="Math.abs(offset(i))>2" :aria-label="i===active?'اختيار بطاقة '+p.name:'عرض بطاقة '+p.name" @click="select(p,i)">
        <span class="deck-card-top"><span>MASAL / {{String(i+1).padStart(2,'0')}}</span><span>{{p.category}}</span></span>
        <strong dir="ltr">{{p.en}}</strong><span class="deck-card-bottom"><span>{{p.name}}</span><span>{{p.tag}}</span></span>
      </button>
    </div>
    <div class="deck-controls"><button @click="move(-1)" aria-label="الكارت السابق"><ChevronUp :size="18"/></button><span>{{current.name}} <small dir="ltr">{{active+1}} / {{products.length}}</small></span><button @click="move(1)" aria-label="الكارت التالي"><ChevronDown :size="18"/></button></div>
    <p class="deck-hint">اسحب للأعلى أو الأسفل · اضغط الكارت للشراء</p>
  </section>`
};
