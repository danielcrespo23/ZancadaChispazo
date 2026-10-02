// Read-only checks against an existing local instance. Never erases user data.
// Writes and restart persistence are covered by verify-state-http.mjs in an
// isolated D1 store, and by verify-running-browser.mjs with intercepted APIs.
import assert from 'node:assert/strict';
const base=process.argv[2]||'http://127.0.0.1:5173';
const auth={cookie:'__sites_local_auth=1'},write={...auth,'Content-Type':'application/json',Origin:base};
const call=async(path,init={})=>{const r=await fetch(base+path,{redirect:'manual',...init});const raw=await r.text();let data;try{data=JSON.parse(raw);}catch{data={error:raw};}return {status:r.status,data};};
const anon=await call('/');assert.ok([302,303,307].includes(anon.status),`anonymous visit should go to sign-in, got ${anon.status}`);
const spoof=await call('/api/state',{headers:{'oai-authenticated-user-id':'someone-else','oai-authenticated-user-email':'x@example.invalid'}});assert.equal(spoof.status,401,'browser identity headers are ignored');
const before=await call('/api/state',{headers:auth});assert.equal(before.status,200);assert.ok(Number.isSafeInteger(before.data.revision));
const strava=await call('/api/strava/status',{headers:auth});assert.equal(strava.status,200);assert.equal(typeof strava.data.configured,'boolean');assert.ok(Array.isArray(strava.data.checklist));assert.ok(!JSON.stringify(strava.data).match(/"(cipher|accessToken|refreshToken|access_token|refresh_token)"/),'status must not expose credentials');
assert.equal((await call('/api/state',{method:'PUT',headers:write,body:JSON.stringify({state:null,revision:-1})})).status,400,'invalid writes are rejected before touching D1');
assert.equal((await call('/api/state',{method:'PUT',headers:{...write,Origin:'https://invalid.example'},body:'{}'})).status,403);
const page=await fetch(base+'/',{headers:auth});assert.equal(page.status,200);
const after=await call('/api/state',{headers:auth});assert.deepEqual(after.data,before.data,'checks leave the existing profile, plan and activities unchanged');
console.log(JSON.stringify({result:'PASS',scope:'Existing local instance; user data unchanged',checks:['authentication','state read','invalid write rejection','request origin','page response','Strava configuration status'],stravaConfigured:strava.data.configured}));
