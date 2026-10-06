// Local UI preview only. No WhatsApp delivery or production authentication.
// Accounts and challenges stay in memory; registration commits after verification.
export function normalizePhone(value){
  let mobile=String(value||'').replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776)).replace(/[\s()+-]/g,'');
  if(mobile.startsWith('00964'))mobile='0'+mobile.slice(5);
  else if(mobile.startsWith('964'))mobile='0'+mobile.slice(3);
  return mobile;
}
export function createPreviewAuth({now=Date.now,makeCode=()=>String(crypto.getRandomValues(new Uint32Array(1))[0]%1000000).padStart(6,'0')}={}){
  const accounts=new Map();
  let pending=null;
  function issue(mode,user){
    const time=now();
    pending={mode,user,code:makeCode(),expiresAt:time+300000,resendAt:time+60000,attempts:0};
    return {mode,previewCode:pending.code,expiresAt:pending.expiresAt,resendAt:pending.resendAt};
  }
  return {
    start({mode,phone,name,email}){
      pending=null;
      const mobile=normalizePhone(phone);
      if(!/^07[3-9][0-9]{8}$/.test(mobile))throw Error('اكتب رقم هاتف عراقي صحيح، مثل 07712345678.');
      if(mode==='login'){
        const user=accounts.get(mobile);
        if(!user)throw Error('هذا الرقم غير مسجّل بالمعاينة. اضغط «إنشاء حساب» أولاً.');
        return issue(mode,user);
      }
      if(mode!=='register')throw Error('تعذّر بدء التحقق.');
      const fullName=String(name||'').trim(),address=String(email||'').trim().toLowerCase();
      if(fullName.length<2||fullName.length>80)throw Error('اكتب اسمك الكامل.');
      if(address.length>254||!/^\S+@\S+\.\S+$/.test(address))throw Error('اكتب بريداً إلكترونياً صحيحاً.');
      if(accounts.has(mobile))throw Error('هذا الرقم مسجّل بالفعل. ارجع لتسجيل الدخول.');
      if([...accounts.values()].some(user=>user.email===address))throw Error('هذا البريد مستخدم بحساب آخر بالمعاينة.');
      return issue(mode,{name:fullName,phone:mobile,email:address});
    },
    verify(code){
      if(!pending)throw Error('اطلب رمز تحقق جديداً.');
      if(now()>=pending.expiresAt)throw Error('انتهت صلاحية الرمز. اطلب رمزاً جديداً.');
      if(pending.attempts>=5)throw Error('تجاوزت عدد المحاولات. اطلب رمزاً جديداً.');
      pending.attempts++;
      if(!/^[0-9]{6}$/.test(code)||code!==pending.code)throw Error(pending.attempts>=5?'تجاوزت عدد المحاولات. اطلب رمزاً جديداً.':'رمز التحقق غير صحيح. حاول مرة ثانية.');
      const user={...pending.user};
      if(pending.mode==='register')accounts.set(user.phone,user);
      pending=null;
      return user;
    },
    resend(){
      if(!pending)throw Error('ابدأ التحقق مرة ثانية.');
      if(now()<pending.resendAt)throw Error('انتظر قبل طلب رمز جديد.');
      return issue(pending.mode,pending.user);
    },
    cancel(){pending=null;}
  };
}
