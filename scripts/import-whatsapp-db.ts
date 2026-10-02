import {z} from 'zod';
import {importHistory} from '../src/importers/history.js';
import {closePool} from '../src/db/pool.js';
const [file,externalId,displayName,owners,rawMode='unknown',offset='-03:00']=process.argv.slice(2);
if(!file||!externalId||!displayName||!owners)throw new Error('Uso: npm run import:whatsapp:db -- arquivo.txt externalId nome "Dimas,Dimas Nogueira" modo -03:00');
const mode=z.enum(['unknown','venom_sales','venom_support','negotiation','personal']).parse(rawMode);
try{console.log(JSON.stringify(await importHistory({file,externalId,displayName,owners:owners.split(','),mode,offset})));}finally{await closePool();}
