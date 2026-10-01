import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const file=fileURLToPath(new URL('../.dev.vars',import.meta.url));
const existing=existsSync(file)?readFileSync(file,'utf8'):'';
const defaults={
 STRAVA_CLIENT_ID:'',
 STRAVA_CLIENT_SECRET:'',
 STRAVA_REDIRECT_URI:'http://localhost:5173/api/strava/callback',
 STRAVA_TOKEN_KEY:randomBytes(32).toString('base64'),
 STRAVA_JOB_SECRET:randomBytes(32).toString('base64url'),
 STRAVA_WEBHOOK_PATH_SECRET:randomBytes(32).toString('base64url'),
 STRAVA_WEBHOOK_VERIFY_TOKEN:randomBytes(32).toString('base64url'),
 STRAVA_RETENTION_JOB_ENABLED:'false',
};
let content=existing;
for(const [name,value] of Object.entries(defaults)){
 if(!new RegExp(`^\\s*${name}\\s*=`, 'm').test(existing))content+=`${content&&!content.endsWith('\n')?'\n':''}${name}=${JSON.stringify(value)}\n`;
}
if(content!==existing)writeFileSync(file,content,{mode:0o600});
console.log('Configuración preparada en .dev.vars (ignorado por Git).');
console.log('Introduce allí STRAVA_CLIENT_ID y STRAVA_CLIENT_SECRET; no los pegues en el chat.');
console.log('En Strava, usa localhost como Authorization Callback Domain para la prueba local.');
console.log('Reinicia npm run dev y abre http://localhost:5173/.');
console.log('La conexión seguirá pendiente hasta configurar y verificar la limpieza automática. Consulta integrations/README-Strava.md.');
