// Ephemeral, bounded, authenticated-user conversation references. No raw chat log.
export class CoachConversationStore{
 constructor({ttl=1800000,maximum=256,clock=Date.now}={}){this.ttl=ttl;this.maximum=maximum;this.clock=clock;this.entries=new Map();}
 read(user,id){
  if(!user)throw Error('Inicia sesión.');
  const entry=this.entries.get(id);if(!entry||entry.user!==user)return null;
  if(this.clock()-entry.updatedAt>=this.ttl){this.entries.delete(id);return null;}
  return structuredClone(entry.context);
 }
 save(user,id,context){
  if(!user)throw Error('Inicia sesión.');
  for(const [key,value] of this.entries)if(this.clock()-value.updatedAt>=this.ttl)this.entries.delete(key);
  const owned=this.entries.get(id)?.user===user,key=owned?id:globalThis.crypto.randomUUID();
  this.entries.delete(key);this.entries.set(key,{user,context:structuredClone(context),updatedAt:this.clock()});
  const own=[...this.entries].filter(([,entry])=>entry.user===user);while(own.length>4)this.entries.delete(own.shift()[0]);
  while(this.entries.size>this.maximum)this.entries.delete(this.entries.keys().next().value);
  return key;
 }
}
export const coachConversations=new CoachConversationStore();
