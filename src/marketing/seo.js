export const pageMeta={
 '/ar':['ديجيتال زون — الخدمات الرقمية','بوابة الخدمات الرقمية: القسائم، التعبئة، التذاكر، السفر والمدفوعات في العراق والشرق الأوسط.'],
 '/ar/about':['من نحن — ديجيتال زون','رحلة ديجيتال زون من بغداد إلى المنطقة، رؤيتنا وقيمنا وشراكتنا مع كي كارد.'],
 '/ar/mini-apps':['التطبيقات المصغّرة — ديجيتال زون','اكتشف القسائم والاشتراكات ومنطقة التذاكر ورحال وشريحة رحال الإلكترونية.'],
 '/ar/business':['حلول الأعمال — ديجيتال زون','نماذج شراكة للتجار والموزعين واستضافة التطبيقات المصغّرة داخل منصتك.'],
 '/ar/insights':['المقالات والرؤى — ديجيتال زون','أحدث الاتجاهات والرؤى في التجارة الرقمية عبر الشرق الأوسط.'],
 '/ar/business/partnerships':['كن شريكاً — ديجيتال زون','مزايا الشراكة وخطوات التكامل مع منظومة ديجيتال زون الرقمية.'],
};
export function updateMeta(path){
 const [title,description]=pageMeta[path]||['ماسال','بطاقات الرصيد والألعاب والبطاقات العالمية بمكان واحد.'];
 document.title=title;
 const set=(key,value,property=false)=>{const attr=property?'property':'name';let el=document.head.querySelector(`meta[${attr}="${key}"]`);if(!el){el=document.createElement('meta');el.setAttribute(attr,key);document.head.appendChild(el)}el.setAttribute('content',value)};
 set('description',description);set('og:title',title,true);set('og:description',description,true);set('og:type','website',true);set('og:locale','ar_IQ',true);set('og:url',location.origin+location.pathname+'#'+path,true);set('twitter:card','summary');
 let canonical=document.head.querySelector('link[rel="canonical"]');if(!canonical){canonical=document.createElement('link');canonical.rel='canonical';document.head.appendChild(canonical)}canonical.href=location.origin+location.pathname+'#'+path;
}
