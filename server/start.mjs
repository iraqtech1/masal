import {createMasalServer} from './app.mjs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const providerAdapters=process.env.PROVIDER_ADAPTER_MODULE?(await import(pathToFileURL(resolve(process.env.PROVIDER_ADAPTER_MODULE)).href)).default:{};
const {server}=createMasalServer({dbPath:process.env.DB_PATH||'server/data/masal.sqlite',providerAdapters});
server.listen(Number(process.env.PORT||3001),process.env.HOST||'127.0.0.1',()=>console.log('Masal server ready on port '+(process.env.PORT||3001)));
