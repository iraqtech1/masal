import {randomBytes,createCipheriv,createDecipheriv,scryptSync} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';

export function seal(value,key){
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
  const data=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);
  return {v:1,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:data.toString('base64')};
}
export function open(value,key){
  const decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(value.iv,'base64'));
  decipher.setAuthTag(Buffer.from(value.tag,'base64'));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(value.data,'base64')),decipher.final()]).toString('utf8'));
}
export function createVault(dbPath){
  let key;
  const keyPath=dbPath+'.key';
  if(process.env.INVENTORY_KEY){key=Buffer.from(process.env.INVENTORY_KEY,'base64');if(key.length!==32)throw Error('INVENTORY_KEY must contain 32 base64-encoded bytes.');}
  else if(dbPath===':memory:')key=randomBytes(32);
  else if(existsSync(keyPath))key=readFileSync(keyPath);
  else {
    // Never silently replace the key for a database that already contains ciphertext.
    if(existsSync(dbPath)&&readFileSync(dbPath).includes(Buffer.from('"codeCipher"')))throw Error('Missing inventory encryption key. Restore the database key backup.');
    key=randomBytes(32);writeFileSync(keyPath,key,{flag:'wx',mode:0o600});
  }
  if(key.length!==32)throw Error('Invalid inventory encryption key.');
  return {seal:value=>seal(value,key),open:value=>open(value,key)};
}
export function encryptExport(value,password){
  if(typeof password!=='string'||password.length<12||password.length>128)throw Object.assign(Error('كلمة تشفير الملف لازم تكون من 12 إلى 128 حرف.'),{status:400});
  const salt=randomBytes(16),key=scryptSync(password,salt,32);
  return {format:'masal-encrypted-v1',kdf:'scrypt',salt:salt.toString('base64'),cipher:'AES-256-GCM',payload:seal(value,key)};
}
