// Allowlisted metadata only. Never log URLs, response bodies, identifiers or errors.
const fields=['stage','outcome','httpStatus','elapsedMs','pages','received','runs','filtered','invalid','after','before','days','privateAccess','cookiePresent'];
export function stravaDiagnostic(event,sink=console.info){
 const record={component:'strava',at:new Date().toISOString()};
 for(const field of fields)if(['string','number','boolean'].includes(typeof event[field]))record[field]=event[field];
 sink(JSON.stringify(record));
}
export function oauthCookie(request,value,{local=false,clear=false}={}){
 const url=new URL(request.url),loopback=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
 const secure=!(local&&loopback&&url.protocol==='http:');
 return `zancada-strava=${value}; Max-Age=${clear?0:900}; Path=/api/strava; HttpOnly; SameSite=Lax${secure?'; Secure':''}`;
}
export function oauthCookieValue(request){
 const values=(request.headers.get('cookie')||'').split(';').map(s=>s.trim()).filter(s=>s.startsWith('zancada-strava='));
 return values.length===1?values[0].slice('zancada-strava='.length):'';
}
export function localRedirect(request,configured){
 const current=new URL(request.url),target=new URL(configured);
 const loopback=url=>['localhost','127.0.0.1','[::1]'].includes(url.hostname);
 if(loopback(current)&&loopback(target)&&current.protocol==='http:'&&target.protocol==='http:')return `${current.origin}/api/strava/callback`;
 return configured;
}
