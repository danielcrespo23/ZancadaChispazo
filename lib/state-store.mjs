import {validateStateShape} from './engine.mjs';
import {activityToday} from './activity-source.mjs';
import {validatePlanPreview,restorePreviousPlan} from './training.mjs';
import {stableStringify} from './plan-review.mjs';
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
 const current=await readState(db,user);
 if(current.revision!==revision)return {status:409,error:'Otra pestaña ha cambiado tus datos. Exporta tus cambios y recarga antes de continuar.'};
 const previous=current.state,planChanged=stableStringify(previous?.plan)!==stableStringify(state.plan);
 const newReview=state.changes.find(c=>!previous?.changes?.some(old=>old.id===c.id)&&['Plan creado','Plan revisado'].includes(c.type));
 const replacesPlan=state.plan&&planChanged&&(state.plan.id!==previous?.plan?.id||stableStringify(state.plan.basis)!==stableStringify(previous?.plan?.basis)||newReview);
 if(replacesPlan){
  const start=activityToday(previous?.profile?.timezone||state.profile?.timezone);
  const restored=state.changes.find(c=>!previous?.changes?.some(old=>old.id===c.id)&&c.type==='Plan anterior restaurado'&&c.undoOf);
  try{
   if(restored){
    if(!previous||stableStringify(restorePreviousPlan(previous,restored.undoOf,start).plan)!==stableStringify(state.plan))throw Error('La restauración ya no corresponde al calendario vigente. Revisa el plan.');
   }else{
    const sourceState=previous||{...state,plan:null};
    // Onboarding may save its draft profile and first calendar together.
    const inputs=sourceState.profile?sourceState:{...sourceState,profile:state.profile};
    validatePlanPreview(inputs,{source:state.plan.basis?.review,plan:state.plan},start,revision);
    // Changes submitted in the same request must also match the proposal. This
    // prevents accepting an old calendar while changing or reverting its inputs.
    validatePlanPreview({...state,plan:inputs.plan},{source:state.plan.basis?.review,plan:state.plan},start,revision);
   }
  }catch(error){return {status:409,code:'stale_plan_preview',error:error.message,recalculate:true};}
 }
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
