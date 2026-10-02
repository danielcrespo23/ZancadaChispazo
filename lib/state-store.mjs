import {validateStateShape} from './engine.mjs';
export async function readStateRevision(db,user){
 if(!user)throw Error('unauthenticated');
 const row=await db.prepare('SELECT revision FROM runner_state WHERE user_id = ?').bind(user).first();return row?.revision??0;
}
// Every query is scoped by the authenticated user ID that the route obtains from the server, never from the request body.
export async function readState(db,user){
 if(!user)throw Error('unauthenticated');
 const row=await db.prepare('SELECT data, revision FROM runner_state WHERE user_id = ?').bind(user).first();
 return {state:row?JSON.parse(row.data):null,revision:row?.revision??0};
}
export async function writeState(db,user,state,revision){
 if(!user)throw Error('unauthenticated');
 if(!Number.isInteger(revision)||revision<0)return {status:400,error:'Datos inválidos.'};
 const invalid=validateStateShape(state);if(invalid.length)return {status:400,error:`No se ha guardado: ${invalid.join(' ')}`};
 // Optimistic concurrency: a stale tab cannot overwrite newer data.
 const result=await db.prepare('INSERT INTO runner_state (user_id, data, revision, updated_at) SELECT ?, ?, 1, ? WHERE ? = 0 OR EXISTS (SELECT 1 FROM runner_state WHERE user_id = ?) ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, revision = runner_state.revision + 1, updated_at = excluded.updated_at WHERE runner_state.revision = ?').bind(user,JSON.stringify(state),new Date().toISOString(),revision,user,revision).run();
 if(!result.meta.changes)return {status:409,error:'Otra pestaña ha cambiado tus datos. Exporta tus cambios y recarga antes de continuar.'};
 return {status:200,revision:revision+1};
}
export async function eraseState(db,user){
 if(!user)throw Error('unauthenticated');
 // Remove all personal data but keep a monotonically increasing revision. A
 // stale tab must never resurrect an erased profile or overwrite its successor.
 return await db.prepare("INSERT INTO runner_state (user_id, data, revision, updated_at) VALUES (?, 'null', 1, ?) ON CONFLICT(user_id) DO UPDATE SET data = 'null', revision = runner_state.revision + 1, updated_at = excluded.updated_at RETURNING revision").bind(user,new Date().toISOString()).first();
}
