import {providerOperation,providerView,runProvider,recoverProviders} from './providers.mjs';
import {createVault} from './vault.mjs';
import {prepareOperations,releaseExpired,syncStock,operation,operationsView,historyView,receipt,returnExport,PERMISSIONS,allowed,requirePermission,audit,fingerprint,fault} from './operations.mjs';
import {upsertCompany,validateProductCompanies} from '../src/companies.js';
import {categoriesForProducts,upsertCategory} from '../src/categories.js';
import {createServer} from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID,randomInt,createHash,timingSafeEqual,randomBytes,scryptSync} from 'node:crypto';
import {mkdirSync,existsSync,readFileSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
import {initialProducts} from '../src/catalog.js';
import {defaults} from '../src/slide-defaults.js';
import {normalizePhone} from '../src/auth-preview.js';
import {defaultSettings} from '../src/preview-settings.js';
import {validateInventory,findInventoryCard} from '../src/inventory.js';
import {inventoryReport} from '../src/inventory-report.js';

const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const text=(value,max=2000)=>{if(typeof value!=='string'||value.length>max)fail('بيانات غير صحيحة');return value.trim();};
const date=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Baghdad',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const hash=value=>createHash('sha256').update(value).digest('hex');
const equal=(a,b)=>timingSafeEqual(Buffer.from(hash(a)),Buffer.from(hash(b)));
export function createMasalServer({dbPath='server/data/masal.sqlite',adminUser=process.env.ADMIN_USER||'masal',adminPassword=process.env.ADMIN_PASSWORD,developmentOtp=process.env.DEV_OTP==='true',secureCookies=process.env.NODE_ENV==='production',otpUrl=process.env.OTP_WEBHOOK_URL,otpToken=process.env.OTP_WEBHOOK_TOKEN,dist=resolve('dist'),providerAdapters={},demonstration=process.env.MASAL_DEMO==='true'}={}){
  if(!adminPassword||adminPassword.length<12)throw Error('Set ADMIN_PASSWORD to at least 12 characters.');
  if(dbPath!==':memory:')mkdirSync(resolve(dbPath,'..'),{recursive:true});
  const vault=createVault(dbPath);
  const db=new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY, value TEXT NOT NULL); CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, role TEXT, customer TEXT, expires INTEGER); CREATE TABLE IF NOT EXISTS credentials (customer TEXT PRIMARY KEY, salt TEXT NOT NULL, digest TEXT NOT NULL);');
  db.exec('CREATE TABLE IF NOT EXISTS staff (id TEXT PRIMARY KEY, username TEXT UNIQUE, name TEXT, salt TEXT, digest TEXT, permissions TEXT, active INTEGER)');
  const decode=raw=>{
    const s=JSON.parse(raw);for(const c of s.codes){if(c.codeCipher){c.code=vault.open(c.codeCipher);delete c.codeCipher;}if(c.metadataCipher){c.extra=vault.open(c.metadataCipher);delete c.metadataCipher;}}
    if(s.ops){for(const p of s.ops.purchases||[]){if(p.rowsCipher){p.rows=vault.open(p.rowsCipher);delete p.rowsCipher;}}for(const provider of Object.values(s.ops.providers||{})){if(provider.secretCipher){provider.secret=vault.open(provider.secretCipher);delete provider.secretCipher;}}for(const o of s.ops.serviceOrders||[]){if(o.secretCipher){o.secret=vault.open(o.secretCipher);delete o.secretCipher;}}}
    return s;
  };
  const encode=s=>{
    const stored=JSON.parse(JSON.stringify(s));for(const c of stored.codes){c.codeCipher=vault.seal(c.code);delete c.code;if(c.extra){c.metadataCipher=vault.seal(c.extra);delete c.extra;}}
    if(stored.ops){for(const p of stored.ops.purchases){p.rowsCipher=vault.seal(p.rows);delete p.rows;}for(const provider of Object.values(stored.ops.providers)){if(provider.secret){provider.secretCipher=vault.seal(provider.secret);delete provider.secret;}}for(const o of stored.ops.serviceOrders){if(o.secret){o.secretCipher=vault.seal(o.secret);delete o.secret;}}}
    return JSON.stringify(stored);
  };
  const initial={revision:0,companies:[],categories:categoriesForProducts(initialProducts),products:initialProducts.map(p=>({...p,active:true,stock:p.values.map(()=>0)})),customers:[],orders:[],tickets:[],imports:[],suppliers:[],events:[],codes:[],slides:[],middleSlides:defaults,settings:{...defaultSettings}};
  if(!db.prepare('SELECT id FROM state WHERE id=1').get())db.prepare('INSERT INTO state VALUES (1,?)').run(JSON.stringify(initial));
  const read=()=>{const s=decode(db.prepare('SELECT value FROM state WHERE id=1').get().value);prepareOperations(s);s.settings={...defaultSettings,...s.settings};if(!Array.isArray(s.categories))s.categories=categoriesForProducts(s.products);if(!Array.isArray(s.companies))s.companies=[];syncStock(s);return s;};
  const commit=s=>{s.revision++;db.prepare('UPDATE state SET value=? WHERE id=1').run(encode(s));};
  const migrationSnapshot=JSON.parse(db.prepare('SELECT value FROM state WHERE id=1').get().value);
  const scrubLegacyPages=migrationSnapshot.codes.some(c=>Object.hasOwn(c,'code'))||(migrationSnapshot.ops?.purchases||[]).some(p=>Object.hasOwn(p,'rows'));
  // One transaction migrates legacy codes to encrypted storage without changing IDs or quantities.
  db.exec('BEGIN IMMEDIATE');try{const migrated=read();db.prepare('UPDATE state SET value=? WHERE id=1').run(encode(migrated));db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
  if(scrubLegacyPages)db.exec('PRAGMA wal_checkpoint(TRUNCATE); VACUUM; PRAGMA wal_checkpoint(TRUNCATE);');
  const event=(s,message)=>{s.events.unshift({id:randomUUID(),text:message,date:new Date().toISOString()});s.events.splice(30);};
  const challenges=new Map(),limits=new Map();
  const rate=(key,max)=>{const now=Date.now();let entry=limits.get(key);if(!entry||now>entry.until){entry={count:0,until:now+60000};limits.set(key,entry);}if(++entry.count>max)fail('انتظر دقيقة وحاول مرة ثانية',429);};
  function session(req,role){const name=role==='admin'?'masal_admin':'masal_customer';const token=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))?.slice(name.length+1);const row=token&&db.prepare('SELECT * FROM sessions WHERE token=? AND expires>?').get(hash(token),Date.now());if(!row||row.role!==role)fail('سجّل الدخول أولاً',401);if(role==='admin'&&row.customer){const staff=db.prepare('SELECT active FROM staff WHERE id=?').get(row.customer);if(!staff?.active)fail('حساب الموظف موقوف',403);}return row;}
  function actor(req){const row=session(req,'admin');if(!row.customer)return {id:'owner',name:adminUser,owner:true,permissions:Object.keys(PERMISSIONS)};const staff=db.prepare('SELECT * FROM staff WHERE id=?').get(row.customer);return {id:staff.id,name:staff.name,owner:false,permissions:JSON.parse(staff.permissions)};}
  function cookie(res,role,customer=''){const token=randomUUID()+randomUUID();const age=role==='admin'?28800:2592000;db.prepare('DELETE FROM sessions WHERE expires<=?').run(Date.now());db.prepare('INSERT INTO sessions VALUES (?,?,?,?)').run(hash(token),role,customer,Date.now()+age*1000);res.setHeader('Set-Cookie',`masal_${role}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}${secureCookies?'; Secure':''}`);}
  function user(req,s){const row=session(req,'customer');const customer=s.customers.find(c=>c.id===row.customer);if(!customer?.active)fail('الحساب موقوف',403);return customer;}
  const identity=c=>({id:c.id,name:c.name,phone:c.phone,email:c.email,...(c.previewId?{previewId:c.previewId}:{})});
  function state(req,s,admin=false){if(admin){const a=actor(req),{ops,...safe}=s;return {...safe,demonstration,codes:undefined,orders:allowed(a,'sales.read')?s.orders.map(({costSnapshot,...o})=>o):[],customers:allowed(a,'customers.manage')?s.customers:allowed(a,'sales.write')||allowed(a,'providers.sell')?s.customers.map(({id,name,phone,active})=>({id,name,phone,active})):[],tickets:allowed(a,'customers.manage')?s.tickets:[],suppliers:allowed(a,'inventory.import')||allowed(a,'inventory.approve')||allowed(a,'providers.manage')||allowed(a,'returns.manage')?s.suppliers:[],imports:allowed(a,'inventory.read')?s.imports:[],events:allowed(a,'reports.read')?s.events:[],staffSession:a};}let c;try{c=user(req,s);}catch(e){if(e.status!==401&&e.status!==403)throw e;}return {demonstration,revision:s.revision,categories:s.categories.filter(c=>c.active),products:s.products.filter(p=>p.active&&s.categories.some(c=>c.active&&c.name===p.category)).map(p=>({...p,stock:p.stock.map(()=>0)})),settings:s.settings,slides:s.slides,middleSlides:s.middleSlides,customers:[],orders:c?s.orders.filter(o=>o.customerId===c.id).map(({costSnapshot,...o})=>o):[],tickets:c?s.tickets.filter(t=>t.customerId===c.id):[],imports:[],suppliers:[],companies:[],events:[]};}
  const revision=(s,b)=>{if(b.revision!==s.revision)fail('البيانات تغيرت. حدّث الصفحة وأعد المحاولة.',409);};
  function profile(b){const name=text(b.name,80),email=text(b.email||'',254).toLowerCase();if(name.length<2||email&&!/^\S+@\S+\.\S+$/.test(email))fail('اكتب اسماً وبريداً صحيحاً');return {name,email};}
  function image(src){if(typeof src!=='string'||src.length>3000000||!(src===''||/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(src)||/^https:\/\/[^\s]+$/.test(src)||/^(cards|middle-banners)\/[\w.-]+$/.test(src)))fail('رابط الصورة غير صحيح');}
  async function body(req){let bytes=0;const chunks=[];for await(const chunk of req){bytes+=chunk.length;if(bytes>30*1024*1024)fail('حجم البيانات كبير',413);chunks.push(chunk);}try{return JSON.parse(Buffer.concat(chunks).toString()||'{}');}catch{fail('بيانات غير صحيحة');}}
  async function issue(req,res,b,resend=false){
    rate('otp:'+req.socket.remoteAddress,10);const now=Date.now();const challengeId=resend?text(b.challengeId,100):randomUUID();const previous=challenges.get(challengeId);
    if(resend&&(!previous||now<previous.resendAt))fail('انتظر قبل طلب رمز جديد');
    const s=read();let account,mode;
    if(resend){account=previous.account;mode=previous.mode;}else{mode=b.mode;const phone=normalizePhone(b.phone);if(!/^07[3-9][0-9]{8}$/.test(phone))fail('اكتب رقم هاتف عراقي صحيح');const existing=s.customers.find(c=>c.phone===phone);if(mode==='login'||mode==='reset'){if(!existing?.active)fail('الحساب غير موجود أو موقوف');account=existing;}else if(mode==='register'){if(existing)fail('هذا الرقم مسجّل بالفعل');account={...profile(b),phone,id:randomUUID(),active:true,kind:'فرد',date:date()};if(account.email&&s.customers.some(c=>c.email===account.email))fail('البريد مستخدم');}else fail('طريقة التحقق غير صحيحة');}
    const code=String(randomInt(100000,1000000));const challenge={account,mode,code:hash(code),expiresAt:now+300000,resendAt:now+60000,attempts:0};
    if(!developmentOtp){if(!otpUrl||!otpToken||!otpUrl.startsWith('https://'))fail('خدمة إرسال رموز التحقق غير مهيأة',503);const result=await fetch(otpUrl,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+otpToken},body:JSON.stringify({phone:account.phone,code}),signal:AbortSignal.timeout(10000)});if(!result.ok)fail('تعذّر إرسال الرمز',502);}
    challenges.set(challengeId,challenge);for(const [key,c] of challenges)if(c.expiresAt<now)challenges.delete(key);
    return {challengeId,mode,expiresAt:challenge.expiresAt,resendAt:challenge.resendAt,...(developmentOtp?{previewCode:code}:{})};
  }
  const server=createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');
    const url=new URL(req.url,'http://localhost'),path=url.pathname;
    const json=(value,status=200)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
    try{
      if(!path.startsWith('/api/')){if(req.method!=='GET'&&req.method!=='HEAD')fail('غير موجود',404);const file=resolve(dist,'.'+decodeURIComponent(path==='/'?'/index.html':path));if(!file.startsWith(dist+sep)||!existsSync(file))fail('غير موجود',404);const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.ttf':'font/ttf','.ico':'image/x-icon','.webmanifest':'application/manifest+json'};res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');res.end(req.method==='HEAD'?undefined:readFileSync(file));return;}
      if(!['GET','POST','PUT'].includes(req.method))fail('غير مسموح',405);
      if(req.method!=='GET'){if(req.headers.origin&&req.headers.origin!==`${secureCookies?'https':'http'}://${req.headers.host}`)fail('طلب غير مسموح',403);if(!(req.headers['content-type']||'').startsWith('application/json'))fail('صيغة غير صحيحة',415);}
      const b=req.method==='GET'?{}:await body(req);if(!b||Array.isArray(b)||typeof b!=='object')fail('بيانات غير صحيحة');let s=read();
      if(path==='/api/health'&&req.method==='GET')return json({ok:true});
      if(path==='/api/state'&&req.method==='GET')return json(state(req,s));
      if(path==='/api/admin/login'&&req.method==='POST'){
        rate('admin:'+req.socket.remoteAddress,10);
        if(b.username===adminUser&&typeof b.password==='string'&&equal(b.password,adminPassword)){cookie(res,'admin');return json({ok:true});}
        const staff=typeof b.username==='string'?db.prepare('SELECT * FROM staff WHERE username=?').get(b.username):null;
        const password=typeof b.password==='string'&&b.password.length<=128?b.password:'';const digest=scryptSync(password,staff?.salt||'missing-staff',64);
        if(!staff?.active||!timingSafeEqual(digest,Buffer.from(staff.digest,'hex')))fail('اسم المستخدم أو الباسورد غير صحيح',401);
        cookie(res,'admin',staff.id);return json({ok:true});
      }
      if(path==='/api/admin/session'&&req.method==='GET'){session(req,'admin');return json({ok:true});}
      if(path==='/api/admin/state'&&req.method==='GET'){session(req,'admin');return json(state(req,s,true));}
      if(path==='/api/admin/inventory/report'&&req.method==='GET'){const a=actor(req);requirePermission(a,'inventory.export');releaseExpired(s);syncStock(s);audit(s,a,'inventory.export','stock');commit(s);return json(inventoryReport(s));}
      if(path==='/api/admin/import/preview'&&req.method==='POST'){
        session(req,'admin');revision(s,b);
        if(!Array.isArray(b.rows)||!b.rows.length||b.rows.length>(b.purchase?50000:5000))fail('تجاوزت حد بطاقات الاستيراد.');
        const checked=validateInventory(b.rows,s.products,new Set(s.codes.map(c=>c.code)),new Set(s.codes.filter(c=>c.serial).map(c=>c.productId+':'+c.value+':'+c.serial)));
        return json({...checked,revision:s.revision});
      }
      if(path==='/api/admin/providers'&&req.method==='GET')return json(providerView(s,actor(req),providerAdapters));
      if(path==='/api/admin/providers/run'&&req.method==='POST')return json(await runProvider({read,commit,db,adapters:providerAdapters},b,actor(req)));
      if(path==='/api/admin/operations/history'&&req.method==='GET')return json(historyView(s,actor(req),Object.fromEntries(url.searchParams)));
      if(path==='/api/admin/operations'&&req.method==='GET'){
        const a=actor(req);if(releaseExpired(s))commit(s);return json(operationsView(s,a,Object.fromEntries(url.searchParams)));
      }
      if(path==='/api/admin/operations'&&req.method==='POST'){
        const a=actor(req),key=text(b.key,100);if(!key)fail('مفتاح الإجراء مطلوب');const {key:_,revision:__,...payload}=b;const digest=fingerprint(payload);
        db.exec('BEGIN IMMEDIATE');let result;
        try{
          s=read();const previous=s.ops.actions.find(v=>v.key===key&&v.actor===a.id);
          if(previous){if(previous.digest!==digest)fail('المفتاح مستخدم لبيانات مختلفة',409);result=previous.result;}
          else{revision(s,b);releaseExpired(s);result=/^(provider|service)\./.test(b.action)?providerOperation(s,b,a,providerAdapters):operation(s,b,a);s.ops.actions.push({key,actor:a.id,digest,result});commit(s);}
          db.exec('COMMIT');
        }catch(e){db.exec('ROLLBACK');throw e;}
        return json({...result,revision:s.revision});
      }
      if(path==='/api/admin/receipt'&&req.method==='POST'){
        const a=actor(req);const result=receipt(s,text(b.id,100),a);commit(s);return json(result);
      }
      if(path==='/api/orders/receipt'&&req.method==='POST'){
        const c=user(req,s),result=receipt(s,text(b.id,100),{id:c.id,name:c.name,owner:false,permissions:[]},c.id);commit(s);return json(result);
      }
      if(path==='/api/orders/receipt/event'&&req.method==='POST'){
        const c=user(req,s),o=s.orders.find(o=>o.id===b.id&&o.customerId===c.id);if(!o?.issuedAt)fail('الوصل غير متاح',403);
        if(!['download','print_requested','print_dialog_closed'].includes(b.event))fail('إجراء غير صالح');audit(s,{id:c.id,name:c.name},'receipt.'+b.event,o.id);commit(s);return json({ok:true});
      }
      if(path==='/api/admin/receipt/event'&&req.method==='POST'){
        const a=actor(req);requirePermission(a,'inventory.reveal');requirePermission(a,'sales.read');if(!s.orders.some(o=>o.id===b.id&&o.issuedAt))fail('الوصل غير متاح');if(b.event!=='download')fail('إجراء غير صالح');audit(s,a,'receipt.download',b.id);commit(s);return json({ok:true});
      }
      if(path==='/api/admin/receipt/print'&&req.method==='POST'){
        const a=actor(req);requirePermission(a,'sales.read');requirePermission(a,'inventory.reveal');const o=s.orders.find(o=>o.id===b.id);if(!o?.issuedAt)fail('لا يوجد وصل مصدر');
        if(!['requested','dialog_closed','failed'].includes(b.result))fail('حالة طباعة غير صحيحة');o.printAttempts||=[];o.printAttempts.push({at:new Date().toISOString(),actor:a.id,result:b.result});audit(s,a,'receipt.print',o.id,b.result);commit(s);return json({ok:true});
      }
      if(path==='/api/admin/returns/export'&&req.method==='POST'){
        const result=returnExport(s,b,actor(req));commit(s);return json(result);
      }
      if(path==='/api/admin/staff'&&req.method==='GET'){
        const a=actor(req);if(!a.owner)fail('إدارة الموظفين للمالك فقط',403);return json({staff:db.prepare('SELECT id,username,name,permissions,active FROM staff').all().map(v=>({...v,permissions:JSON.parse(v.permissions)})),permissions:PERMISSIONS});
      }
      if(path==='/api/admin/staff'&&req.method==='POST'){
        const a=actor(req);if(!a.owner)fail('إدارة الموظفين للمالك فقط',403);
        const username=text(b.username,80),name=text(b.name,80);if(!username||username===adminUser||!name)fail('اسم المستخدم أو الاسم غير صالح');
        if(!Array.isArray(b.permissions)||b.permissions.some(p=>!PERMISSIONS[p]))fail('صلاحيات غير صحيحة');
        const old=b.id?db.prepare('SELECT * FROM staff WHERE id=?').get(b.id):null;if(b.id&&!old)fail('الموظف غير موجود');
        if(db.prepare('SELECT id FROM staff WHERE username=? AND id<>?').get(username,old?.id||''))fail('اسم المستخدم موجود');
        if(!old||b.password){if(typeof b.password!=='string'||b.password.length<12||b.password.length>128)fail('الباسورد من 12 إلى 128 حرف');}
        const salt=b.password?randomBytes(16).toString('hex'):old.salt,digest=b.password?scryptSync(b.password,salt,64).toString('hex'):old.digest,id=old?.id||randomUUID();
        db.prepare('INSERT OR REPLACE INTO staff VALUES (?,?,?,?,?,?,?)').run(id,username,name,salt,digest,JSON.stringify([...new Set(b.permissions)]),b.active===false?0:1);
        db.prepare("DELETE FROM sessions WHERE role='admin' AND customer=?").run(id);audit(s,a,'staff.save',id);commit(s);return json({id});
      }
      if(['/api/admin/logout','/api/auth/logout'].includes(path)&&req.method==='POST'){const role=path.includes('/admin/')?'admin':'customer';const row=session(req,role);db.prepare('DELETE FROM sessions WHERE token=?').run(row.token);res.setHeader('Set-Cookie',`masal_${role}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secureCookies?'; Secure':''}`);return json({ok:true});}
      if(path==='/api/auth/guest'&&req.method==='POST'){rate('guest:'+req.socket.remoteAddress,20);try{return json(identity(user(req,s)));}catch{}const c={id:randomUUID(),previewId:randomUUID(),name:'زائر',email:'',phone:'',active:true,kind:'فرد',date:date()};s.customers.push(c);event(s,'انضم حساب زائر');commit(s);cookie(res,'customer',c.id);return json(identity(c));}
      if(['/api/auth/login','/api/auth/register'].includes(path)&&req.method==='POST'){
        rate('password:'+req.socket.remoteAddress,10);
        const phone=normalizePhone(b.phone),password=b.password;
        if(!/^07[3-9][0-9]{8}$/.test(phone))fail('اكتب رقم هاتف عراقي صحيح');
        if(typeof password!=='string'||password.length<8||password.length>128)fail('الباسورد لازم يكون من 8 إلى 128 حرف.');
        let account=s.customers.find(c=>c.phone===phone);
        if(path.endsWith('/register')){
          if(account)fail('هذا الرقم مسجّل بالفعل');
          const p=profile(b);if(p.email&&s.customers.some(c=>c.email===p.email))fail('البريد مستخدم');
          account={...p,phone,id:randomUUID(),active:true,kind:'فرد',date:date()};
          const salt=randomBytes(16).toString('hex'),digest=scryptSync(password,salt,64).toString('hex');
          db.exec('BEGIN');
          try{db.prepare('INSERT INTO credentials VALUES (?,?,?)').run(account.id,salt,digest);s.customers.push(account);event(s,'انضم حساب جديد');commit(s);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
        }else{
          const credential=account&&db.prepare('SELECT * FROM credentials WHERE customer=?').get(account.id);
          const actual=scryptSync(password,credential?.salt||'masal-missing-account',64);
          if(!credential||!timingSafeEqual(actual,Buffer.from(credential.digest,'hex')))fail('رقم الهاتف أو الباسورد غير صحيح.',401);
          if(!account.active)fail('الحساب موقوف',403);
        }
        cookie(res,'customer',account.id);return json(identity(account));
      }
      if(path==='/api/auth/me'&&req.method==='GET')return json(identity(user(req,s)));
      if(path==='/api/auth/start'&&req.method==='POST')return json(await issue(req,res,b));
      if(path==='/api/auth/resend'&&req.method==='POST')return json(await issue(req,res,b,true));
      if(path==='/api/auth/reset-password'&&req.method==='POST'){
        rate('reset:'+req.socket.remoteAddress,10);
        const c=challenges.get(b.challengeId);
        if(!c||c.mode!=='reset'||Date.now()>=c.expiresAt||c.attempts>=5)fail('اطلب رمز تحقق جديداً');
        c.attempts++;if(typeof b.code!=='string'||!equal(hash(b.code),c.code))fail('رمز التحقق غير صحيح');
        if(typeof b.password!=='string'||b.password.length<8||b.password.length>128)fail('الباسورد لازم يكون من 8 إلى 128 حرف.');
        const account=s.customers.find(a=>a.id===c.account.id);if(!account?.active||account.phone!==c.account.phone)fail('الحساب موقوف',403);
        const salt=randomBytes(16).toString('hex'),digest=scryptSync(b.password,salt,64).toString('hex');
        db.prepare('INSERT OR REPLACE INTO credentials VALUES (?,?,?)').run(account.id,salt,digest);
        db.prepare("DELETE FROM sessions WHERE role='customer' AND customer=?").run(account.id);
        for(const [id,challenge] of challenges)if(challenge.account.id===account.id)challenges.delete(id);
        return json({ok:true});
      }
      if(path==='/api/auth/verify'&&req.method==='POST'){
        rate('verify:'+req.socket.remoteAddress,30);const c=challenges.get(b.challengeId);if(!c||c.mode==='reset'||Date.now()>=c.expiresAt||c.attempts>=5)fail('اطلب رمز تحقق جديداً');c.attempts++;if(typeof b.code!=='string'||!equal(hash(b.code),c.code))fail('رمز التحقق غير صحيح');
        s=read();let account=s.customers.find(a=>a.id===c.account.id);
        if(c.mode==='register'){if(s.customers.some(a=>a.phone===c.account.phone||c.account.email&&a.email===c.account.email))fail('الحساب مسجّل بالفعل');account=c.account;s.customers.push(account);event(s,'انضم حساب جديد');commit(s);}if(!account?.active)fail('الحساب موقوف',403);challenges.delete(b.challengeId);cookie(res,'customer',account.id);return json(identity(account));
      }
      if(path==='/api/auth/profile'&&req.method==='PUT'){const c=user(req,s),p=profile(b);if(p.email&&s.customers.some(a=>a.id!==c.id&&a.email===p.email))fail('البريد مستخدم');Object.assign(c,p);commit(s);return json(identity(c));}
      if(path==='/api/orders'&&req.method==='POST'){
        const c=user(req,s);if(typeof b.reference==='string'){const saved=s.orders.find(o=>o.customerId===c.id&&o.reference===b.reference);if(saved?.requestFingerprint){if(saved.requestFingerprint!==hash(JSON.stringify([b.productId,b.denom,b.quantity,b.payment])))fail('مرجع الطلب مستخدم لبيانات مختلفة',409);return json(saved);}}const p=s.products.find(p=>p.id===b.productId&&p.active&&s.categories.some(c=>c.active&&c.name===p.category));if(!p||!Number.isInteger(b.denom)||b.denom<0||b.denom>=p.values.length||!Number.isInteger(b.quantity)||b.quantity<1||b.quantity>20)fail('تفاصيل الطلب غير صحيحة');if(!['Qi','ZainCash'].includes(b.payment))fail('وسيلة الدفع غير صحيحة');
        if(typeof b.reference!=='string'||b.reference.length>100)fail('مرجع الطلب مطلوب');const old=s.orders.find(o=>o.customerId===c.id&&o.reference===b.reference);if(old){if(old.productId!==p.id||old.value!==p.values[b.denom]||old.quantity!==b.quantity||old.payment!==b.payment)fail('مرجع الطلب مستخدم لبيانات مختلفة',409);return json(old);}
        if((p.fulfillmentModes?.[b.denom]||'local')!=='local')fail('هذه الفئة خدمة رقمية؛ تحتاج حقول المستفيد ومسار تنفيذ المزود');const o={requestFingerprint:hash(JSON.stringify([b.productId,b.denom,b.quantity,b.payment])),fulfillment:'unreserved',paymentState:'unpaid',deliveryState:'hidden',priceRevision:s.revision,id:'ORDER-'+randomUUID(),reference:b.reference,customerId:c.id,customer:c.name,phone:c.phone,email:c.email,...(c.previewId?{previewId:c.previewId}:{}),productId:p.id,name:p.name,value:p.values[b.denom],quantity:b.quantity,price:p.prices[b.denom]*b.quantity,date:date(),kind:c.kind,status:'قيد المراجعة',payment:b.payment};
        s.orders.unshift(o);event(s,'طلب جديد: '+p.name);commit(s);return json(o,201);
      }
      if(path==='/api/tickets'&&req.method==='POST'){const c=user(req,s),subject=text(b.subject,100),message=text(b.message,2000);if(!subject||!message)fail('اكتب عنوان ورسالة');const ticket={id:'TICKET-'+randomUUID(),customerId:c.id,customer:c.name,phone:c.phone,email:c.email,...(c.previewId?{previewId:c.previewId}:{}),subject,message,date:date(),status:'مفتوحة',reply:''};s.tickets.unshift(ticket);event(s,'تذكرة دعم جديدة');commit(s);return json(ticket,201);}
      if(path.startsWith('/api/admin/')&&req.method==='PUT'){
        const a=actor(req);revision(s,b);const collection=path.slice('/api/admin/'.length),d=b.data;
        const required={products:'catalog.write',companies:'catalog.write',categories:'catalog.write',settings:'settings.write',slides:'catalog.write',middleSlides:'catalog.write',customers:'customers.manage',tickets:'customers.manage',orders:'sales.write',suppliers:'providers.manage'}[collection];if(!required)fail('غير موجود',404);requirePermission(a,required);
        if(!d||typeof d!=='object')fail('بيانات غير صحيحة');
        if(collection==='categories'){try{upsertCategory(s.categories,s.products,d,randomUUID);}catch(e){fail(e.message);}}
        else if(collection==='companies'){try{const previous=s.companies.find(c=>c.id===d.id);if(previous&&s.products.some(p=>p.manufacturerId===d.id&&d.role!=='manufacturer'&&d.role!=='both'||p.supplierCompanyId===d.id&&d.role!=='supplier'&&d.role!=='both'))fail('نوع الشركة مرتبط ببطاقات. عدّل ربط البطاقات أولاً.');upsertCompany(s.companies,d,randomUUID);}catch(e){fail(e.message);}}
        else if(collection==='settings'){const name=text(d.name,60),supportEmail=text(d.supportEmail,254),supportPhone=text(d.supportPhone,30),privacyText=text(d.privacyText??s.settings.privacyText,10000),aboutText=text(d.aboutText??s.settings.aboutText,10000);if(!name||!Number.isInteger(d.lowStock)||d.lowStock<0||d.lowStock>10000||supportEmail&&!/^\S+@\S+\.\S+$/.test(supportEmail))fail('إعدادات غير صحيحة');s.settings={name,supportEmail,supportPhone,privacyText,aboutText,lowStock:d.lowStock};}
        else if(['slides','middleSlides'].includes(collection)){if(!Array.isArray(d)||d.length>10)fail('الحد الأقصى 10 صور');s[collection]=d.map(slide=>{image(slide.src);return {id:text(slide.id,100),name:text(slide.name,200),src:slide.src};});}
        else if(['products','customers','suppliers','tickets','orders'].includes(collection)){
          const old=s[collection].find(item=>item.id===d.id);let item;
          if(collection==='products'){try{validateProductCompanies(s.companies,d);}catch(e){fail(e.message);}if(!s.categories.some(c=>c.name===d.category))fail('اختر تصنيفاً من التصنيفات المتوفرة');image(d.image||'');if(!Array.isArray(d.values)||!d.values.length||d.values.length>100||!Array.isArray(d.prices)||d.prices.length!==d.values.length||new Set(d.values).size!==d.values.length||d.values.some((v,i)=>!Number.isFinite(v)||v<=0||!Number.isSafeInteger(d.prices[i])||d.prices[i]<=0))fail('فئات وأسعار غير صحيحة');if(old&&old.values.some((v,i)=>!d.values.includes(v)&&(old.stock[i]>0||s.orders.some(o=>o.productId===old.id&&o.value===v))))fail('الفئة مرتبطة بمخزون أو طلب');if(d.denomImages){if(!Array.isArray(d.denomImages)||d.denomImages.length>d.values.length)fail('صور الفئات غير صحيحة');d.denomImages.forEach(src=>image(src||''));}if(d.fulfillmentModes&&(!Array.isArray(d.fulfillmentModes)||d.fulfillmentModes.length!==d.values.length||d.fulfillmentModes.some(mode=>!['local','topup','rabia','premium'].includes(mode))))fail('طريقة تنفيذ غير صحيحة');if(old&&s.codes.some(c=>c.productId===old.id&&!d.values.includes(c.value)))fail('الفئة مرتبطة بسجل مخزون؛ لا يمكن حذفها');
          if(old&&d.values.some((v,i)=>(d.fulfillmentModes?.[i]||old.fulfillmentModes?.[old.values.indexOf(v)]||'local')!=='local'&&s.codes.some(c=>c.productId===old.id&&c.value===v&&['available','reserved','quarantined'].includes(c.status))))fail('الفئة تحتوي مخزوناً؛ لا يمكن تحويلها لخدمة رقمية');
          if(old&&s.ops.services.some(service=>service.productId===old.id&&(!d.values.includes(service.value)||(d.fulfillmentModes?.[d.values.indexOf(service.value)]||old.fulfillmentModes?.[old.values.indexOf(service.value)]||'local')!==(service.kind==='premium'?'premium':service.provider))))fail('الفئة مرتبطة بخدمة مزود؛ عدل الربط من قسم الخدمات');
          if(d.denominationRules&&(!Array.isArray(d.denominationRules)||d.denominationRules.length!==d.values.length||d.denominationRules.some(r=>typeof r.serialRequired!=='boolean'||typeof r.expiryRequired!=='boolean'||!Array.isArray(r.requiredFields)||r.requiredFields.length>10||r.requiredFields.some(f=>typeof f!=='string'||!f||f.length>60||['__proto__','constructor','prototype'].includes(f)))))fail('متطلبات الفئة غير صحيحة');
          item={denominationRules:d.values.map((v,i)=>d.denominationRules?.[i]||old?.denominationRules?.[old.values.indexOf(v)]||{serialRequired:false,expiryRequired:false,requiredFields:[]}),fulfillmentModes:d.values.map((v,i)=>d.fulfillmentModes?.[i]||old?.fulfillmentModes?.[old.values.indexOf(v)]||'local'),id:old?.id||Math.max(0,...s.products.map(p=>p.id))+1,name:text(d.name,60),en:text(d.en,24),category:text(d.category,40),tag:text(d.tag,40),color:/^#[a-f0-9]{6}$/i.test(d.color)?d.color:'#a21c2d',unit:text(d.unit,20),manufacturerId:d.manufacturerId||'',supplierCompanyId:d.supplierCompanyId||'',image:d.image||'',denomImages:d.denomImages||[],values:d.values,prices:d.prices,active:d.active===true,stock:d.values.map(v=>old?.stock[old.values.indexOf(v)]||0)};}
          if(collection==='customers'){const p=profile(d),phone=normalizePhone(d.phone);if(!old?.previewId&&!/^07[3-9][0-9]{8}$/.test(phone))fail('رقم هاتف غير صحيح');if(s.customers.some(c=>c.id!==d.id&&(phone&&c.phone===phone||p.email&&c.email===p.email)))fail('الهاتف أو البريد مستخدم');item={...old,...p,phone,id:old?.id||randomUUID(),kind:old?.kind||'فرد',active:d.active===true,date:old?.date||date()};}
          if(collection==='suppliers'){if(!['API','Excel'].includes(d.method)||d.method==='API'&&!/^https:\/\//.test(d.url))fail('بيانات مورّد غير صحيحة');item={id:old?.id||randomUUID(),name:text(d.name,80),url:text(d.url||'',2000),method:d.method,active:d.active===true};}
          if(collection==='tickets'){if(!old||!['مفتوحة','قيد المعالجة','مغلقة'].includes(d.status))fail('تذكرة غير صحيحة');item={...old,status:d.status,reply:text(d.reply||'',2000)};}
          if(collection==='orders'){if(!old||!['مكتمل','قيد المراجعة','ملغي'].includes(d.status))fail('طلب غير صحيح');if(old.fulfillment&&d.status==='مكتمل'&&old.fulfillment!=='issued')fail('أصدر البطاقات من إدارة المبيعات بعد تسجيل الدفع');if(old.fulfillment&&d.status==='ملغي')fail('ألغ الطلب من إدارة المبيعات لتحرير الحجز بأمان');item={...old,status:d.status};}
          if(collection==='customers'&&d.password){
            if(typeof d.password!=='string'||d.password.length<8||d.password.length>128)fail('الباسورد لازم يكون من 8 إلى 128 حرف.');
            const salt=randomBytes(16).toString('hex'),digest=scryptSync(d.password,salt,64).toString('hex');
            db.prepare('INSERT OR REPLACE INTO credentials VALUES (?,?,?)').run(item.id,salt,digest);
            db.prepare("DELETE FROM sessions WHERE role='customer' AND customer=?").run(item.id);
          }
          if(old)Object.assign(old,item);else s[collection].push(item);
        }else fail('غير موجود',404);
        event(s,'تحديث الإدارة: '+collection);commit(s);return json(state(req,s,true));
      }
      if(path==='/api/admin/cards/search'&&req.method==='POST'){requirePermission(actor(req),'inventory.read');const serial=text(b.serial,256);if(!serial)fail('اكتب سيريل الكارت');return json({card:findInventoryCard(s.codes,s.products,serial)});}
      if(path==='/api/admin/import'&&req.method==='POST'){requirePermission(actor(req),'inventory.approve');revision(s,b);if(!Array.isArray(b.rows)||b.rows.length>5000)fail('الحد الأقصى 5000 صف');const checked=validateInventory(b.rows,s.products,new Set(s.codes.map(c=>c.code)),new Set(s.codes.filter(c=>c.serial).map(c=>c.productId+':'+c.value+':'+c.serial)));if(b.strict&&(!checked.accepted.length||checked.errors.length))fail('تغيّرت صلاحية البطاقات. أعد المعاينة قبل الاستيراد.',409);for(const r of checked.accepted){s.products.find(p=>p.id===r.productId).stock[r.index]++;s.codes.push({code:r.code,serial:r.serial,expiry:r.expiry,extra:r.extra,productId:r.productId,value:r.value,...(r.source?{source:r.source,sheet:r.sheet,sourceRow:r.sourceRow}:{})});}s.imports.unshift({id:randomUUID(),name:text(b.name,200),count:checked.accepted.length,rejected:checked.errors.length+(b.strict&&Number.isSafeInteger(b.rejectedCount)&&b.rejectedCount>=0&&b.rejectedCount<=5000?b.rejectedCount:0),date:date()});prepareOperations(s);syncStock(s);event(s,'استيراد '+checked.accepted.length+' بطاقة');commit(s);return json({state:state(req,s,true),accepted:checked.accepted.length,errors:checked.errors});}
      fail('غير موجود',404);
    }catch(e){if(!res.headersSent)json({error:e.status?e.message:'تعذّر تنفيذ الطلب'},e.status||500);else res.end();}
  });
  recoverProviders(read,commit);
  const housekeeping=setInterval(()=>{try{const latest=read();if(releaseExpired(latest))commit(latest);}catch{}},10000);housekeeping.unref();
  return {server,close:()=>{clearInterval(housekeeping);db.close();}};
}
