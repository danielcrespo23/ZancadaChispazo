export function stableStringify(value){
 return JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
}
// A compact change detector, not an authorization token. The server also rebuilds
// the proposed calendar from its own state before allowing a plan replacement.
export function fingerprint(value){
 const text=stableStringify(value),words=[0x811c9dc5,0x9e3779b9,0x85ebca6b,0xc2b2ae35];
 for(let i=0;i<text.length;i++)for(let n=0;n<words.length;n++)words[n]=Math.imul(words[n]^text.charCodeAt(i),0x01000193+n*2);
 return words.map(n=>(n>>>0).toString(16).padStart(8,'0')).join('');
}
