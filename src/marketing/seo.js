export const pageMeta={
 '/ar':['ماسال — بطاقاتك الرقمية','بطاقات الرصيد والألعاب والبطاقات العالمية في مكان واحد، للأفراد.'],
 '/ar/about':['من نحن — ماسال','تعرّف على ماسال وخدمات البطاقات وتجربة الأفراد.'],
 '/ar/mini-apps':['البطاقات والخدمات — ماسال','أرصدة الاتصالات والألعاب والبطاقات العالمية والخدمات المحلية.'],
 '/ar/business':['حلول الأعمال — ماسال','خيارات لموردي البطاقات وربط مصادر التزويد.'],
 '/ar/insights':['المقالات — ماسال','مقالات عن البطاقات الإلكترونية والتجارة الرقمية.'],
 '/ar/business/partnerships':['كن شريكاً — ماسال','تعرّف على خيارات التعاون مع ماسال للمورّدين.'],
};
export function updateMeta(path){
 const [title,description]=pageMeta[path]||['ماسال','بطاقات الرصيد والألعاب والبطاقات العالمية بمكان واحد.'];
 document.title=title;
 const set=(key,value,property=false)=>{const attr=property?'property':'name';let el=document.head.querySelector(`meta[${attr}="${key}"]`);if(!el){el=document.createElement('meta');el.setAttribute(attr,key);document.head.appendChild(el)}el.setAttribute('content',value)};
 set('description',description);set('og:title',title,true);set('og:description',description,true);set('og:type','website',true);set('og:locale','ar_IQ',true);set('og:url',location.origin+location.pathname+'#'+path,true);set('twitter:card','summary');set('og:image',new URL(import.meta.env.BASE_URL+'brand/masal-logo.png',location.origin).href,true);set('og:site_name','ماسال',true);
 let canonical=document.head.querySelector('link[rel="canonical"]');if(!canonical){canonical=document.createElement('link');canonical.rel='canonical';document.head.appendChild(canonical)}canonical.href=location.origin+location.pathname+'#'+path;
}
