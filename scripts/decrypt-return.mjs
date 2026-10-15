import {readFileSync,writeFileSync} from 'node:fs';
import {scryptSync} from 'node:crypto';
import {open} from '../server/vault.mjs';
const [input,output]=process.argv.slice(2);
if(!input||!output||!process.env.MASAL_EXPORT_PASSWORD)throw Error('Usage: set MASAL_EXPORT_PASSWORD, then node scripts/decrypt-return.mjs input.masal output.json.');
const file=JSON.parse(readFileSync(input,'utf8'));
if(file.format!=='masal-encrypted-v1')throw Error('Unsupported encrypted export format.');
const key=scryptSync(process.env.MASAL_EXPORT_PASSWORD,Buffer.from(file.salt,'base64'),32);delete process.env.MASAL_EXPORT_PASSWORD;
const value=open(file.payload,key);writeFileSync(output,JSON.stringify(value,null,2),{flag:'wx',mode:0o600});console.log('Decrypted export saved. Protect this file: it contains card codes.');
