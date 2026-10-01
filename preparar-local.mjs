import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,readdirSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';

const root=dirname(fileURLToPath(import.meta.url));
process.chdir(root);
if(+process.versions.node.split('.')[0]<22)throw Error('Instala Node.js 22.13 o posterior.');
if(!existsSync('node_modules/vinext/dist/cli.js'))throw Error('Ejecuta primero npm run install:ci.');
function run(args){const result=spawnSync(process.execPath,args,{cwd:root,stdio:'inherit'});if(result.error)throw result.error;if(result.status!==0)process.exit(result.status||1);}
mkdirSync('.sites-runtime',{recursive:true});
writeFileSync('.sites-runtime/execution-profile.json',JSON.stringify({executionProfile:'portable'}));
run(['scripts/run-framework.mjs','build']);
const files=readdirSync('drizzle').filter(f=>/^\d+.*\.sql$/.test(f)).sort();
let sql=files.map(f=>readFileSync(resolve('drizzle',f),'utf8')).join('\n');
// These three exported migrations only create tables and indexes. Make setup repeatable without deleting data.
if(/\b(?:ALTER|DROP|DELETE|UPDATE|INSERT)\s/i.test(sql))throw Error('Las migraciones han cambiado. Aplica sus cambios con una herramienta de migración antes de continuar.');
sql=sql.replace(/CREATE TABLE\s+(?!IF NOT EXISTS)/g,'CREATE TABLE IF NOT EXISTS ')
 .replace(/CREATE UNIQUE INDEX\s+(?!IF NOT EXISTS)/g,'CREATE UNIQUE INDEX IF NOT EXISTS ')
 .replace(/CREATE INDEX\s+(?!IF NOT EXISTS)/g,'CREATE INDEX IF NOT EXISTS ');
const filename='.sites-runtime/inicializar-local.sql';writeFileSync(filename,sql);
run(['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--local','--config','dist/server/wrangler.json','--persist-to','.wrangler/state','--file',filename]);
console.log('\nPreparación terminada. Ejecuta: npm run dev -- --hostname 127.0.0.1');
