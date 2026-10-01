// Optional public ingress for a private Site. Secrets stay in this relay's server.
// This is NOT deployed by Zancada. Configure and test before enabling retention.
export default {
 async fetch(request,env,ctx){
  const url=new URL(request.url),secret=env.STRAVA_WEBHOOK_PATH_SECRET;
  if(!secret||url.pathname!==`/events/${secret}`)return new Response('Not found',{status:404});
  if(!['GET','POST'].includes(request.method))return new Response('Method not allowed',{status:405});
  const origin=new URL(env.ZANCADA_ORIGIN);
  if(origin.protocol!=='https:'||origin.pathname!=='/')return new Response('Configuration error',{status:503});
  const target=new URL(`/api/strava/webhook/${secret}`,origin);
  for(const key of ['hub.mode','hub.challenge','hub.verify_token'])if(url.searchParams.has(key))target.searchParams.set(key,url.searchParams.get(key));
  if(request.method==='GET'&&url.searchParams.get('hub.verify_token')!==env.STRAVA_WEBHOOK_VERIFY_TOKEN)return new Response('Forbidden',{status:403});
  const body=request.method==='POST'?await request.text():undefined;
  if(body&&body.length>10000)return new Response('Too large',{status:413});
  const response=await fetch(target,{method:request.method,redirect:'manual',headers:{'OAI-Sites-Authorization':`Bearer ${env.SITES_SERVICE_TOKEN}`,'Content-Type':'application/json'},body});
  if(request.method==='POST'&&response.ok)ctx.waitUntil(tick(env));
  if(response.status>=300&&response.status<400)return new Response('Private Site service access failed',{status:502});
  return new Response(response.body,{status:response.status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
 },
 scheduled(_event,env,ctx){ctx.waitUntil(tick(env));}
};
async function tick(env){const target=new URL('/api/strava/tick',env.ZANCADA_ORIGIN);const response=await fetch(target,{method:'POST',redirect:'manual',headers:{'OAI-Sites-Authorization':`Bearer ${env.SITES_SERVICE_TOKEN}`,Authorization:`Bearer ${env.STRAVA_JOB_SECRET}`}});if(!response.ok)throw Error('Zancada background job failed');}
