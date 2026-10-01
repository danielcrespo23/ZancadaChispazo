// Questionnaire decisions are explicit product heuristics, not injury predictions.
export const QUALITY_TYPES=['tempo','interval','hills','progressive'];
export function runnerContext(p){
 const known=v=>v!==''&&v!=null&&Number.isFinite(+v);
 const km=+p.weeklyKm||0,frequency=known(p.recentFrequency)?+p.recentFrequency:null;
 const weeks=known(p.consistentWeeks)?+p.consistentWeeks:null;
 const returning=p.consistency==='returning'||p.consistency==='intermittent'||weeks!=null&&weeks<4||frequency===0;
 const recovery=p.recovery==='poor'||known(p.fatigue)&&+p.fatigue>=7;
 const injury=!!p.recentInjury;
 const sports=(p.otherSports||[]).filter(s=>Number.isInteger(+s.day)&&+s.day>=0&&+s.day<=6);
 const hardDays=sports.filter(s=>s.intensity==='hard').map(s=>+s.day);
 const blockedDays=[...new Set([...hardDays,...(p.strength?[+p.strengthDay]:[])])];
 const available=p.days.filter(d=>!blockedDays.includes(+d)&&runningMinutes(p,+d)>=15);
 const count=Math.min(+p.trainingDays,available.length,frequency===0?3:frequency==null?(p.experience==='beginner'?3:4):Math.max(1,frequency+(weeks>=8?1:0)));
 const cautious=p.experience==='beginner'||km<8||returning||recovery||injury;
 const quality=km>=12&&p.experience!=='beginner'&&!returning&&!recovery&&!injury&&p.pain==='none'&&(frequency==null||frequency>=3);
 const notes=[];
 if(frequency==null)notes.push('Frecuencia reciente desconocida: los días elegidos son una disponibilidad, no una base demostrada.');
 if(weeks==null)notes.push('Constancia sin confirmar: el volumen declarado es provisional. Revisa el plan tras dos semanas registradas.');
 if(returning)notes.push('Base intermitente o vuelta tras una pausa: menos carga inicial y sin trabajo de calidad.');
 if(frequency===0)notes.push('Sin carreras actuales, comenzamos con hasta tres sesiones cortas de correr/caminar en días separados. No se reutiliza un volumen antiguo ni se asume carrera continua.');
 if(injury)notes.push('Lesión reciente: propuesta de vuelta suave, sin intensidad. Las notas no sustituyen las indicaciones profesionales.');
 if(recovery)notes.push('Fatiga alta o mala recuperación: menos carga y sin intensidad hasta revisar las sensaciones.');
 if(sports.length)notes.push('Otros deportes cuentan como contexto de recuperación, nunca como kilómetros de running. Se evita correr el día de un deporte exigente y hacer calidad el día anterior o posterior.');
 if(p.strength)notes.push('El día de fuerza se reserva antes de repartir las carreras, sin añadir otra sesión ese día.');
 if(sports.some(s=>s.intensity!=='hard'))notes.push('El tiempo de otros deportes suaves o moderados se resta del máximo diario disponible; si quedan menos de 15 minutos, ese día no se usa para correr.');
 if(count<+p.trainingDays)notes.push(`Se programan como máximo ${count} días de carrera: frecuencia reciente o deportes adicionales limitan los ${p.trainingDays} solicitados. No se compensa la carga.`);
 return {frequency,weeks,returning,recovery,injury,cautious,quality,sports,hardDays,blockedDays,available,count,notes,initialScale:returning||injury?.7:recovery?.75:1,
  // Absolute increments chosen by baseline; deliberately not a universal percentage.
  stepKm:cautious?.5:km<20?.75:km<40?1:1.5,stepMinutes:cautious?1:2};
}
export function runningMinutes(p,dateDay){return Math.max(0,(+p.minutes[dateDay]||0)-(p.otherSports||[]).filter(s=>+s.day===dateDay).reduce((n,s)=>n+(+s.minutes||0),0));}
export function nearHardSport(p,dateDay){return (p.otherSports||[]).some(s=>s.intensity==='hard'&&Math.min(Math.abs(+s.day-dateDay),7-Math.abs(+s.day-dateDay))<=1);}
export function usableMark(m,start,seconds,daysBetween){
 if(!(m.distance>0&&seconds(m.time)>0&&m.date&&daysBetween(m.date,start)>=0&&daysBetween(m.date,start)<=180))return false;
 if(m.effort&&m.effort!=='race')return false;
 if(m.terrain&&m.terrain!=='asphalt'||+m.elevation/+m.distance>15)return false;
 if(m.elapsedTime&&seconds(m.elapsedTime)>seconds(m.time)*1.05)return false;
 return true;
}
export function profileContextErrors(p){
 const e=[],known=v=>v!==''&&v!=null;
 if(p.otherSports!=null&&!Array.isArray(p.otherSports))return ['Otros deportes: se necesita una lista válida.'];
 if(known(p.recentFrequency)&&!(Number.isInteger(+p.recentFrequency)&&+p.recentFrequency>=0&&+p.recentFrequency<=7))e.push('Frecuencia reciente: entre 0 y 7 días.');
 if(known(p.consistentWeeks)&&!(Number.isInteger(+p.consistentWeeks)&&+p.consistentWeeks>=0&&+p.consistentWeeks<=520))e.push('Constancia reciente: entre 0 y 520 semanas.');
 if(known(p.fatigue)&&!(+p.fatigue>=0&&+p.fatigue<=10))e.push('Fatiga: entre 0 y 10, o No lo sé.');
 if(known(p.goal?.elevation)&&!(+p.goal.elevation>=0&&+p.goal.elevation<=15000))e.push('Desnivel de carrera: entre 0 y 15000 metros.');
 if(p.consistency!=null&&!['unknown','continuous','intermittent','returning'].includes(p.consistency))e.push('Revisa la constancia declarada.');
 if(p.recovery!=null&&!['unknown','good','poor'].includes(p.recovery))e.push('Revisa la recuperación declarada.');
 if(p.recentInjury!=null&&typeof p.recentInjury!=='boolean')e.push('Revisa el indicador de lesión reciente.');
 if((p.otherSports||[]).length>14||(p.otherSports||[]).some(s=>!['strength','crossfit','cycling','other'].includes(s.type)||!Number.isInteger(+s.day)||+s.day<0||+s.day>6||!(+s.minutes>=10&&+s.minutes<=600)||!['easy','moderate','hard'].includes(s.intensity)))e.push('Revisa día, duración e intensidad de tus otros deportes.');
 return e;
}
