import {buildRunningBlocks,sessionFormat,formatEligibility} from './session-library.mjs';
export function timedSession({id,p,type,date,minutes,week,phase,reference,source,format=null,dose=null,referenceDate=date}){
 const requestedType=type,definition=sessionFormat(p,type,phase,{format,referenceDate}),eligibility=formatEligibility(p,definition,referenceDate);let built=buildRunningBlocks({p,type,phase,minutes,source,format:definition.id,dose});
 const reason=!eligibility.eligible?eligibility.reasons.join(' '):built.failed||(!built.purposeMet?'El bloque de trabajo queda por debajo del mínimo útil del formato.':built.seconds<definition.duration.minimumSessionSeconds?'El tiempo disponible queda por debajo del mínimo útil del formato.':null);
 if(reason){type='easy';built=buildRunningBlocks({p,type,phase,minutes,source});}
 const prescription={...built};delete prescription.definition;delete prescription.purposeMet;
 return {id,date,type,week,phase,...prescription,hr:null,reference,basePace:null,paceSource:source,...(requestedType!==type?{substitution:{requestedType,requestedFormat:definition.id,reason},progression:reason+' Se ofrece carrera fácil de la duración disponible.'}:{}),advice:'Sin referencia fiable no se convierten minutos en kilómetros. En calor o pendientes, reduce el esfuerzo; detente si el dolor altera la zancada.',alternative:'Reduce la duración un 30 % y mantén conversación cómoda. Con dolor relevante, descansa.'};
}
