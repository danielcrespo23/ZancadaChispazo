// Deterministic, fictional case. No database or existing runner data is opened.
import {writeFileSync} from 'node:fs';
import {blankProfile,empty,generate,addDays,monday,round,TYPES} from '../lib/engine.mjs';
import {buildPlanPreview,acceptPlanPreview} from '../lib/training.mjs';

const origin='2026-10-05',review='2026-11-09',race='2027-01-25';
const profile={...blankProfile(),experience:'regular',weeklyKm:30,weeklySource:'measured',weeklyTrend:'stable',recentFrequency:3,consistentWeeks:12,consistency:'continuous',longest:12,longestSource:'measured',longestDate:'2026-10-04',longestResult:'comfortable',easyPace:'6:00',easySource:'measured',easyEffort:3,easyConversation:'yes',recovery:'good',runningRestriction:'none',days:[1,3,6],minutes:{1:70,3:70,6:100},longDay:6,timezone:'Europe/Madrid',goal:{type:'race',distance:21.1,date:race,time:'',intent:'improve',terrain:'asphalt'}};
const running=s=>!['rest','race','strength'].includes(s.type);
const record=s=>({id:'actual-'+s.id,date:s.date,type:s.type,distance:s.distance??round(s.seconds/360),seconds:s.seconds,rpe:s.rpe,fatigue:2,pain:'none',feeling:'bien',terrain:'asphalt',temperature:16,sessionId:s.id});
const initial=generate(profile,origin);
const fixture=until=>({...empty(),profile:structuredClone(profile),plan:structuredClone(initial),activities:until?initial.sessions.filter(s=>running(s)&&s.date<until).map(record):[]});
const describe=(plan,date)=>{
 const sessions=plan.sessions.filter(s=>running(s)&&monday(s.date)===date);
 return {phases:[...new Set(sessions.map(s=>s.phase.label))],km:round(sessions.reduce((n,s)=>n+(s.distance||0),0)),minutes:Math.round(sessions.reduce((n,s)=>n+s.seconds,0)/60),keySessions:sessions.filter(s=>['long','tempo','progressive','interval','hills'].includes(s.type)).map(s=>({date:s.date,type:s.type,km:s.distance,minutes:Math.round(s.seconds/60)}))};
};
// The pre-fix algorithm restarted phaseSchedule(profile, review). A fresh
// generation without continuity reproduces that behavior for comparison.
const reset=generate(profile,review);
const unconfirmed=buildPlanPreview(fixture(),{},review);
const measured=buildPlanPreview(fixture(review),{completeHistory:true},review);
const weeks=measured.comparison.map(week=>({date:week.date,accepted:week.before,reset:describe(reset,week.date),unconfirmed:unconfirmed.comparison.find(w=>w.date===week.date).after,measured:week.after,reasons:week.reasons}));
let state=fixture(review);
const successive=[];
for(let i=0;i<11;i++){
 const date=addDays(review,i*7),preview=buildPlanPreview(state,{completeHistory:true},date);
 successive.push({date,phaseOrigin:preview.continuity.phaseOrigin,specificStart:preview.plan.schedule.specificStart,taperStart:preview.plan.schedule.taperStart,referenceWeeklyKm:preview.continuity.load.referenceWeeklyKm,...describe(preview.plan,date),reasons:preview.comparison[0].reasons});
 state=acceptPlanPreview(state,preview,date);
 state.activities.push(...state.plan.sessions.filter(s=>running(s)&&s.date>=date&&s.date<addDays(date,7)).map(record));
}
const report={case:{origin,review,race,distance:21.1,declaredWeeklyKm:30,history:'Ficticio: las sesiones del calendario se registran con esfuerzo prescrito, fatiga 2/10 y sin molestias. No son datos del usuario.'},schedules:{accepted:initial.schedule,reset:reset.schedule,unconfirmed:unconfirmed.plan.schedule,measured:measured.plan.schedule},weeks,successive,decisions:[
 {mode:'adjust',when:'Misma carrera, preparación vigente y sin pausa confirmada.',effect:'Mantiene origen, fases y descargas. La carga parte de lo realizado si la cobertura está confirmada; con historial incompleto limita la referencia declarada y detiene el crecimiento.'},
 {mode:'goal_change',when:'Cambia fecha, distancia, tipo o demanda de terreno del objetivo.',effect:'Reparte las fases desde la revisión para la nueva carrera. No traslada adaptación del objetivo anterior; conserva pasado y asociaciones. Cambiar solo el tiempo deseado no reinicia el calendario.'},
 {mode:'resume',when:'Pausa declarada, o al menos 14 días sin correr con historial confirmado.',effect:'Reduce la referencia disponible y abre dos semanas cómodas. Repetir la revisión no vuelve a aplicar esa reducción ni mueve su origen. Una segunda pausa tras haber retomado sí inicia otra reentrada.'},
 {mode:'new',when:'Decisión explícita de nueva preparación, ausencia de calendario o bloque terminado.',effect:'Crea un origen nuevo; la carga sigue limitada por evidencia y recuperación. Conserva las sesiones realizadas y sus registros.'}
]};
writeFileSync(new URL('../docs/continuidad-comparacion.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
const date=d=>d.split('-').reverse().join('/');
const phases=w=>w.phases.join(' / ')||'—';
const keys=w=>w.keySessions.map(s=>TYPES[s.type]+' '+(s.km??s.distance??s.minutes)+(s.km!=null||s.distance!=null?' km':' min')).join('; ')||'sin calidad ni tirada larga';
const scheduleRow=(name,s)=>'| '+name+' | '+date(s.start)+' | '+date(s.baseEnd)+' | '+date(s.specificStart)+' | '+date(s.taperStart)+' | '+date(s.end)+' |';
const md=[
 '# Continuidad de la planificación',
 '',
 'Caso reproducido antes de modificar el código: media maratón iniciada el 05/10/2026, carrera el 25/01/2027 y revisión el 09/11/2026. Se usó un perfil ficticio regular: 30 km semanales, tres días, tirada reciente de 12 km y ritmo suave de 6:00 min/km. No se abrió ni modificó la base personal.',
 '',
 '## Calendario y fallo reproducido',
 '',
 '| Calendario | Origen | Fin de base | Inicio específico | Puesta a punto | Carrera |',
 '| --- | --- | --- | --- | --- | --- |',
 scheduleRow('Aceptado el 05/10',initial.schedule),scheduleRow('Reinicio al revisar: comportamiento anterior',reset.schedule),scheduleRow('Revisión corregida: ambas coberturas',measured.plan.schedule),
 '',
 'El 09/11 pasaba de Desarrollo a Base. La primera descarga se desplazaba del 23/11 al 30/11. Repetir el reinicio cada semana aplazaba esa descarga otra semana y volvía a prescribir base. La revisión corregida conserva las fechas aceptadas, el índice de semana y la rotación de sesiones.',
 '',
 '## Comparación concreta en la revisión del 09/11',
 '',
 'Kilómetros de entrenamiento, sin sumar carrera ni fuerza. Cada fila compara el calendario aceptado con una revisión única realizada el 09/11. La columna confirmada usa todas las sesiones realmente registradas hasta el día anterior; la columna incompleta no inventa adaptación ni inactividad.',
 '',
 '| Semana | Fase aceptada → reinicio anterior → corregida | km aceptados | km reinicio | km sin cobertura confirmada | km con registros confirmados | Sesiones clave aceptadas → corregidas con registros |',
 '| --- | --- | ---: | ---: | ---: | ---: | --- |',
 ...weeks.map(w=>'| '+date(w.date)+' | '+phases(w.accepted)+' → '+phases(w.reset)+' → '+phases(w.measured)+' | '+w.accepted.km+' | '+w.reset.km+' | '+w.unconfirmed.km+' | '+w.measured.km+' | '+keys(w.accepted)+' → '+keys(w.measured)+' |'),
 '',
 'Motivos: la continuidad conserva la fase y sus fechas; la base medida del 09/11 es '+measured.continuity.load.referenceWeeklyKm+' km, obtenida de mediana, última semana y últimas dos semanas comparables. El primer volumen propuesto es '+measured.comparison[0].after.km+' km. El incremento requiere carreras suficientes y sensaciones registradas compatibles. No recupera los incrementos previstos de semanas anteriores. Sin confirmar historial, la primera semana queda en '+unconfirmed.comparison[0].after.km+' km y mantiene Desarrollo, con una pregunta visible sobre cobertura.',
 '',
 'El [JSON de la comparación](continuidad-comparacion.json) conserva kilómetros, minutos, fechas y sesiones clave, junto con los motivos de cada semana. Mi plan muestra la misma comparación entre calendario vigente y propuesta antes de aceptar.',
 '',
 '## Once revisiones semanales sucesivas',
 '',
 'Después de aceptar cada revisión se registran las sesiones realmente realizadas esa semana antes de la siguiente. Las cifras siguientes son revisiones sucesivas, no las proyecciones de una propuesta única.',
 '',
 '| Revisión | Fase | Referencia realizada (km) | Propuesta semanal (km) | Sesiones clave |',
 '| --- | --- | ---: | ---: | --- |',
 ...successive.map(w=>'| '+date(w.date)+' | '+phases(w)+' | '+w.referenceWeeklyKm+' | '+w.km+' | '+keys(w)+' |'),
 '',
 'Todas mantienen origen 05/10, específico 11/12 y puesta a punto 15/01. Las descargas siguen el 23/11 y el 21/12. Una descarga realmente completada no se interpreta como pérdida de base al revisar: se mantienen como referencia las semanas normales sin devolver los kilómetros reducidos. Una descarga sin completar sí sigue limitando la carga observada. La reducción final respeta la carrera del 25/01 y no incorpora intensidad.',
 '',
 '## Cuándo volver a base',
 '',
 ...report.decisions.map(d=>'- **'+d.mode+'**: '+d.when+' '+d.effect),
 '',
 'El umbral de 14 días, la reentrada de dos semanas y los factores de reducción son reglas conservadoras del producto, no medidas de recuperación. Una pausa con historial completo sin carreras recientes no conserva automáticamente los 30 km antiguos: la propuesta parte del volumen observado, incluso cero, con sesiones de correr/caminar. No se interpreta como pausa la ausencia sin confirmar cobertura. Bicicleta, fuerza y registros de proveedores no acreditan continuidad de running.',
 '',
 'Dolor relevante mantiene la pausa; fatiga alta reduce carga y suprime calidad sin cambiar por sí sola las fechas del calendario. Cerca de la carrera, la puesta a punto tiene prioridad sobre la vuelta a base: conserva la fecha, baja carga y advierte de las limitaciones; no comprime una preparación nueva.',
 '',
 '## Pruebas y conservación',
 '',
 'Las regresiones comprueban las fechas, fases, kilómetros, descargas y rotación de calidad; once revisiones semanales hasta la carrera; seis revisiones sin cobertura confirmada; pausa declarada repetida y segunda pausa real; ausencia confirmada; cambio de carrera, cambio de tiempo y bloque terminado; nueva preparación; revisión dentro de descarga y puesta a punto; calendarios antiguos; regeneración directa del motor; dolor y fatiga; conservación exacta de pasado, sesiones completadas, fuerza, carrera registrada, grupos, notas y asociaciones.',
 '',
 'El servidor reconstruye también las propuestas con continuidad, acepta una revisión válida y rechaza una propuesta tras cambios de registros. SQLite de estas regresiones vive solo en memoria. La verificación HTTP usa su propia base en .tools/verify-*.',
 '',
 'Las [pruebas de continuidad](../tests/planning-continuity.test.mjs) y [pruebas de interfaz](../tests/training-ui.test.mjs) verifican estos resultados mediante aserciones. Los [resultados de validación](continuidad-validacion.md) documentan la ejecución completa y la comprobación de los archivos originales.',
 '',
 'La comparación puede regenerarse sin acceder a datos existentes:',
 '',
 String.fromCharCode(96).repeat(3)+'powershell',
 '.\\.tools\\node.exe scripts/compare-planning-continuity.mjs',
 '.\\.tools\\node.exe --test tests/*.test.mjs',
 '.\\.tools\\node.exe node_modules/typescript/bin/tsc --noEmit',
 '.\\.tools\\node.exe scripts/run-framework.mjs build',
 '.\\.tools\\node.exe scripts/verify-state-http.mjs',
 String.fromCharCode(96).repeat(3),
 ''
];
writeFileSync(new URL('../docs/continuidad-planificacion.md',import.meta.url),md.join('\n'));
console.log(JSON.stringify({schedules:report.schedules,successive:successive.map(({date,phases,referenceWeeklyKm,km})=>({date,phases,referenceWeeklyKm,km})),report:'docs/continuidad-planificacion.md'},null,2));
