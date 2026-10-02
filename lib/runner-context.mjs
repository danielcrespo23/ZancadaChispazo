// Questionnaire decisions are explicit product heuristics, not injury predictions.
import {known,realDate,comfortableEasy,recentLong,endurancePriority} from './profile-evidence.mjs';
import {isTrainingActivity} from './activity-source.mjs';
export const QUALITY_TYPES=['tempo','interval','hills','progressive'];
export function runnerContext(p,start){
 const km=+p.weeklyKm||0,frequency=known(p.recentFrequency)?+p.recentFrequency:null;
 const weeks=known(p.consistentWeeks)?+p.consistentWeeks:null;
 const returning=p.consistency==='returning'||p.consistency==='intermittent'||weeks!=null&&weeks<4||frequency===0||+p.pauseWeeks>=2;
 const recovery=p.recovery==='poor'||known(p.fatigue)&&+p.fatigue>=7;
 const injury=!!p.recentInjury||p.longestResult==='pain';
 const uncertainLoad=p.weeklySource==='estimated'||['variable','decreasing','increasing'].includes(p.weeklyTrend);
 const uncomfortable=!comfortableEasy(p),restricted=['no-intensity','no-running','time-limit'].includes(p.runningRestriction);
 const paused=p.runningRestriction==='no-running'||p.runningRestriction==='time-limit'&&(!known(p.restrictionMinutes)||+p.restrictionMinutes<15);
 const sports=(p.otherSports||[]).filter(s=>Number.isInteger(+s.day)&&+s.day>=0&&+s.day<=6);
 const hardDays=sports.filter(s=>['hard','unknown'].includes(s.intensity)||!known(s.minutes)).map(s=>+s.day);
 const blockedDays=[...new Set([...hardDays,...(p.strength?[+p.strengthDay]:[])])];
 const available=paused?[...p.days]:p.days.filter(d=>!blockedDays.includes(+d)&&runningMinutes(p,+d)>=15);
 const count=Math.min(+p.trainingDays,available.length,frequency===0?3:frequency==null?(p.experience==='beginner'?3:4):Math.max(1,frequency+(weeks>=8?1:0)));
 const cautious=['beginner','unknown'].includes(p.experience)||p.goal.type==='unknown'||km<8||returning||recovery||injury||uncertainLoad||uncomfortable||restricted;
 const quality=km>=12&&p.goal.type!=='unknown'&&!['beginner','unknown'].includes(p.experience)&&!returning&&!recovery&&!injury&&!uncertainLoad&&!uncomfortable&&!restricted&&!endurancePriority(p)&&p.pain==='none'&&(frequency==null||frequency>=3);
 const notes=[];
 if(frequency==null)notes.push('Frecuencia reciente desconocida: los días elegidos son una disponibilidad, no una base demostrada.');
 if(weeks==null)notes.push('Constancia sin confirmar: el volumen declarado es provisional. Revisa el plan tras dos semanas registradas.');
 if(returning)notes.push('Base intermitente o vuelta tras una pausa: menos carga inicial y sin trabajo de calidad.');
 if(frequency===0)notes.push('Sin carreras actuales, comenzamos con hasta tres sesiones cortas de correr/caminar en días separados. No se reutiliza un volumen antiguo ni se asume carrera continua.');
 if(injury)notes.push(p.recentInjury?'Lesión reciente: propuesta de vuelta suave, sin intensidad. Las notas no sustituyen las indicaciones profesionales.':'Molestias en la tirada reciente: menos carga y sin intensidad hasta revisar las sensaciones. No se presume una lesión.');
 if(recovery)notes.push('Fatiga alta o mala recuperación: menos carga y sin intensidad hasta revisar las sensaciones.');
 if(uncertainLoad)notes.push('Volumen estimado o semanas variables: reducimos la carga de partida y posponemos intensidad hasta confirmar una base estable.');
 if(+p.pauseWeeks>=2)notes.push(`Pausa reciente de ${p.pauseWeeks} semanas: se reduce la base sin reutilizar de golpe la carga anterior.`);
 if(uncomfortable)notes.push('El ritmo llamado suave no permite conversar o supera esfuerzo 4/10: no se usa como referencia cómoda y se pospone intensidad.');
 if(endurancePriority(p))notes.push('Tu prioridad es terminar o correr sin parar: se construye resistencia cómoda, sin tempo, intervalos ni cuestas exigentes.');
 if(p.goal.type==='unknown')notes.push('Objetivo sin definir: bloque de base cómoda, sin intensidad ni preparación específica de competición.');
 if(restricted)notes.push(paused?'Restricción de carrera: el calendario propone pausa; la fecha de competición queda solo como recordatorio.':'Se aplica tu restricción: sin intensidad y, si lo indicas, con un límite de minutos por sesión.');
 if(recentLong(p,start).factor<1)notes.push('La tirada declarada fue difícil, dolorosa, estimada o antigua: se reduce el límite de tirada; no se toma como capacidad cómoda demostrada.');
 if(p.days.some(d=>!known(p.minutes[d])))notes.push('Minutos disponibles sin confirmar: se usa un límite provisional de 20 minutos, que puedes corregir en el perfil.');
 if(sports.some(s=>s.intensity==='unknown'||!known(s.minutes)))notes.push('Deporte con duración o intensidad desconocida: se reserva ese día y recuperación alrededor hasta aclararlo.');
 if(sports.length)notes.push('Otros deportes cuentan como contexto de recuperación, nunca como kilómetros de running. Se evita correr el día de un deporte exigente y hacer calidad el día anterior o posterior.');
 if(p.strength)notes.push('El día de fuerza se reserva antes de repartir las carreras, sin añadir otra sesión ese día.');
 if(sports.some(s=>s.intensity!=='hard'))notes.push('El tiempo de otros deportes suaves o moderados se resta del máximo diario disponible; si quedan menos de 15 minutos, ese día no se usa para correr.');
 if(count<+p.trainingDays)notes.push(`Se programan como máximo ${count} días de carrera: frecuencia reciente o deportes adicionales limitan los ${p.trainingDays} solicitados. No se compensa la carga.`);
 return {frequency,weeks,returning,recovery,injury,cautious,quality,paused,restricted,uncertainLoad,uncomfortable,sports,hardDays,blockedDays,available,count,notes,initialScale:Math.min(+p.pauseWeeks>=4?.6:returning||injury?.7:1,recovery?.75:1,uncertainLoad||uncomfortable?.85:1),
  // Absolute increments chosen by baseline; deliberately not a universal percentage.
  stepKm:cautious?.5:km<20?.75:km<40?1:1.5,stepMinutes:cautious?1:2};
}
export function runningMinutes(p,dateDay){const daily=known(p.minutes[dateDay])?+p.minutes[dateDay]:20,net=Math.max(0,daily-(p.otherSports||[]).filter(s=>+s.day===dateDay).reduce((n,s)=>n+(known(s.minutes)?+s.minutes:daily),0));return Math.min(net,p.runningRestriction==='time-limit'&&known(p.restrictionMinutes)?+p.restrictionMinutes:Infinity);}
export function nearHardSport(p,dateDay){return (p.otherSports||[]).some(s=>(['hard','unknown'].includes(s.intensity)||!known(s.minutes))&&Math.min(Math.abs(+s.day-dateDay),7-Math.abs(+s.day-dateDay))<=1);}
export function usableMark(m,start,seconds,daysBetween){
 if(!isTrainingActivity(m))return false;
 if(!(m.distance>=1.5&&m.distance<=42.3&&seconds(m.time)>0&&seconds(m.time)<=86400&&realDate(m.date)&&daysBetween(m.date,start)>=0&&daysBetween(m.date,start)<=180))return false;
 if(m.effort!=='race'||m.measurement!=='measured'||!['competition','test'].includes(m.context))return false;
 if(m.terrain!=='asphalt'||+m.elevation/+m.distance>15)return false;
 if(m.elapsedTime&&seconds(m.elapsedTime)>seconds(m.time)*1.05)return false;
 return true;
}
export function profileContextErrors(p){
 const e=[],known=v=>v!==''&&v!=null;
 if(p.otherSports!=null&&!Array.isArray(p.otherSports))return ['Otros deportes: se necesita una lista válida.'];
 if(known(p.recentFrequency)&&!(Number.isInteger(+p.recentFrequency)&&+p.recentFrequency>=0&&+p.recentFrequency<=7))e.push('Frecuencia reciente: entre 0 y 7 días.');
 if(known(p.consistentWeeks)&&!(Number.isInteger(+p.consistentWeeks)&&+p.consistentWeeks>=0&&+p.consistentWeeks<=520))e.push('Constancia reciente: entre 0 y 520 semanas.');
 if(known(p.fatigue)&&!(+p.fatigue>=0&&+p.fatigue<=10))e.push('Fatiga: entre 0 y 10, o No lo sé.');
 if(known(p.pauseWeeks)&&!(Number.isInteger(+p.pauseWeeks)&&+p.pauseWeeks>=0&&+p.pauseWeeks<=8))e.push('Pausa reciente: entre 0 y 8 semanas, o No lo sé.');
 if(known(p.easyEffort)&&!(+p.easyEffort>=0&&+p.easyEffort<=10))e.push('Ritmo cómodo: esfuerzo entre 0 y 10, o No lo sé.');
 if(known(p.restrictionMinutes)&&!(+p.restrictionMinutes>=1&&+p.restrictionMinutes<=360))e.push('Restricción de duración: entre 1 y 360 minutos, o No lo sé.');
 for(const [key,values] of Object.entries({weeklySource:['unknown','measured','estimated'],longestSource:['unknown','measured','estimated'],easySource:['unknown','measured','estimated'],weeklyTrend:['unknown','stable','increasing','decreasing','variable'],longestResult:['unknown','comfortable','hard','pain'],easyConversation:['unknown','yes','short','no'],runningRestriction:['unknown','none','no-intensity','no-running','time-limit']}))if(p[key]!=null&&!values.includes(p[key]))e.push(`Revisa la respuesta ${key}.`);
 if(p.goal?.flexibility!=null&&!['unknown','any','time','date','distance','fixed'].includes(p.goal.flexibility))e.push('Revisa la flexibilidad del objetivo.');
 if(p.goal?.intent!=null&&!['unknown','finish','nonstop','improve','time'].includes(p.goal.intent))e.push('Revisa la prioridad del objetivo.');
 if(known(p.goal?.elevation)&&!(+p.goal.elevation>=0&&+p.goal.elevation<=15000))e.push('Desnivel de carrera: entre 0 y 15000 metros.');
 if(p.consistency!=null&&!['unknown','continuous','intermittent','returning'].includes(p.consistency))e.push('Revisa la constancia declarada.');
 if(p.recovery!=null&&!['unknown','good','poor'].includes(p.recovery))e.push('Revisa la recuperación declarada.');
 if(p.hrSource!=null&&!['unknown','measured','estimated'].includes(p.hrSource))e.push('Revisa el origen de los valores de FC.');
 if(p.recentInjury!=null&&typeof p.recentInjury!=='boolean')e.push('Revisa el indicador de lesión reciente.');
 if(p.injuryAnswer!=null&&!['unknown','no','yes'].includes(p.injuryAnswer))e.push('Revisa la respuesta sobre lesión reciente.');
 if((p.otherSports||[]).length>14||(p.otherSports||[]).some(s=>!['strength','crossfit','cycling','other'].includes(s.type)||!Number.isInteger(+s.day)||+s.day<0||+s.day>6||known(s.minutes)&&!(+s.minutes>=10&&+s.minutes<=600)||!['unknown','easy','moderate','hard'].includes(s.intensity)))e.push('Revisa día, duración e intensidad de tus otros deportes.');
 return e;
}
