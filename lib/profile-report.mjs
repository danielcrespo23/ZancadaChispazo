import {metrics,today,DAYS} from './engine.mjs';
import {runnerContext} from './runner-context.mjs';
import {known,comfortableEasy,goalPriority,recentLong} from './profile-evidence.mjs';
export function profileWarnings(p,start=today()){
 const warnings=[];
 if(+p.recentFrequency===0&&known(p.recentFrequency)&&+p.weeklyKm>0)warnings.push('Indicas cero días actuales y kilómetros semanales positivos. Conservamos ambos datos, pero el plan empieza sin reutilizar ese volumen.');
 if(+p.longest>+p.weeklyKm&&known(p.weeklyKm))warnings.push('La tirada supera la media semanal. Puede haber semanas distintas; comprueba que ambos datos pertenecen al mismo periodo.');
 if(p.easyPace&&!comfortableEasy(p))warnings.push('Tu ritmo suave y tus sensaciones no coinciden. Conservamos el ritmo, pero no lo usamos como referencia cómoda.');
 if(p.consistency==='continuous'&&+p.pauseWeeks>=2)warnings.push('Has marcado continuidad sin pausas y una pausa de dos o más semanas. Conservamos ambas respuestas y se aplica la vuelta conservadora.');
 if((p.marks||[]).some(m=>!m.date||!m.distance||!m.time))warnings.push('Hay marcas incompletas: se guardarán sin calcular ritmos ni completar los datos que faltan.');
 if((p.marks||[]).some(m=>m.context==='training'&&m.effort==='race'))warnings.push('Una marca figura como entrenamiento y máximo esfuerzo. Confirma si fue una prueba máxima: mientras tanto no predice rendimiento.');
 if(p.runningRestriction==='time-limit'&&!known(p.restrictionMinutes))warnings.push('La restricción tiene un límite de duración desconocido. Se propondrá pausa hasta que confirmes los minutos permitidos.');
 if(p.goal?.time&&goalPriority(p)!=='improve')warnings.push('Conservamos el tiempo deseado, pero tu prioridad es completar la distancia: ese tiempo no impone ritmos ni intensidad.');
 if(p.restrictions&&['unknown','none'].includes(p.runningRestriction||'unknown'))warnings.push('Las notas libres no se interpretan automáticamente. Si incluyen un límite para correr, selecciónalo en «Restricción para correr».');
 if(recentLong(p,start).age>42)warnings.push('La tirada tiene más de seis semanas: se conserva como registro, con un límite de partida reducido.');
 return warnings;
}
export function profileReport(p,start=today()){
 const m=metrics(p,start),c=runnerContext(p,start),g=p.goal||{},priority=goalPriority(p),source=v=>v==='measured'?'medido':v==='estimated'?'estimado':'origen sin confirmar';
 const rows=[
  {key:'goal',step:2,title:'Objetivo',text:`${['race','time','nonstop'].includes(g.type)?`${known(g.distance)?`${g.distance} km`:'distancia: No lo sé'}${g.date?` · ${g.date}`:' · fecha sin fijar'}`:g.type==='unknown'?'Objetivo: No lo sé':g.type==='start'?'Empezar a correr':'Resistencia y rutina'} · ${g.intent==='unknown'?'prioridad: No lo sé':priority==='improve'?'mejorar marca':priority==='nonstop'?'correr sin parar':'terminar / constancia'}${g.time?` · tiempo deseado ${g.time}`:''}`,effect:g.type==='unknown'?'Base cómoda de doce semanas hasta definir la meta.':priority==='improve'?'Intensidad solo si la base y recuperación lo permiten; el tiempo deseado se contrasta con una marca.':'Prioriza resistencia cómoda y continuidad.'},
  {key:'base',step:3,title:'Base reciente',text:`${known(p.weeklyKm)?`${p.weeklyKm} km/semana (${source(p.weeklySource)})`:'Kilómetros: No lo sé'} · ${known(p.recentFrequency)?`${p.recentFrequency} días realizados`:'Días realizados: No lo sé'} · ${known(p.consistentWeeks)?`${p.consistentWeeks} semanas consecutivas`:'Constancia sin confirmar'}`,effect:c.returning||c.cautious?'Carga inicial conservadora y progresión lenta.':'Carga limitada por el volumen realizado y la frecuencia reciente.'},
  {key:'long',step:3,title:'Tirada reciente',text:known(p.longest)?`${p.longest} km (${source(p.longestSource)})${p.longestDate?` · ${p.longestDate}`:' · fecha: No lo sé'} · ${({comfortable:'cómoda',hard:'difícil',pain:'con molestias'})[p.longestResult]||'resultado: No lo sé'}`:'No lo sé',effect:recentLong(p,start).factor<1?'Se reduce el límite de la tirada.':'Limita la tirada de partida; sin dato se empieza con un límite corto.'},
  {key:'pace',step:3,title:'Ritmos y marcas',text:`${p.easyPace?`${p.easyPace} min/km (${source(p.easySource)})`:'Ritmo cómodo: No lo sé'} · ${m.mark?`referencia ${m.mark.distance} km · ${m.mark.date}`:'sin marca utilizable'}`,effect:m.source==='effort'?'Sesiones por tiempo, esfuerzo y conversación; sin ritmos ni distancias inventados.':m.source==='declared-easy'?'Ritmos suaves provisionales; no calcula umbral ni ritmo rápido.':'Rangos estimados desde una referencia comparable; no son umbrales medidos.'},
  {key:'availability',step:4,title:'Disponibilidad y otros deportes',text:`${p.days.map(d=>`${DAYS[d]} ${known(p.minutes[d])?p.minutes[d]:'?'} min`).join(' · ')} · tirada preferida: ${DAYS[+p.longDay]} · ${(p.otherSports||[]).length} deportes${p.strength?' + fuerza complementaria':''}`,effect:`Hasta ${c.count} días de carrera, restando tiempo de otros deportes y reservando recuperación.`},
  {key:'care',step:5,title:'Cuidados y sensaciones',text:`${({none:'sin molestias',mild:'molestias leves',relevant:'molestias relevantes',unknown:'molestias: No lo sé'})[p.pain]||'sin confirmar'} · fatiga ${known(p.fatigue)?`${p.fatigue}/10`:'No lo sé'} · ${({none:'sin restricción',unknown:'restricción sin confirmar','no-intensity':'sin intensidad','no-running':'no correr','time-limit':`límite ${known(p.restrictionMinutes)?p.restrictionMinutes:'?'} min`})[p.runningRestriction]||'restricción sin confirmar'}`,effect:c.paused||p.pain==='relevant'?'Se propone pausa. La carrera queda como recordatorio.':!c.quality?'No se añade intensidad mientras se revisan la base, la prioridad o las sensaciones.':'La calidad sigue condicionada a recuperación, minutos y separación entre sesiones.'}
 ];
 const reliable=[],missing=[],estimated=[];
 for(const [label,key,origin] of [['Volumen semanal','weeklyKm','weeklySource'],['Tirada','longest','longestSource'],['Ritmo cómodo','easyPace','easySource']]){
  if(p[key]===''||p[key]==null)missing.push(`${label}: No lo sé.`);
  else if(key==='easyPace'&&!comfortableEasy(p))estimated.push('Ritmo registrado incompatible con esfuerzo cómodo: no se usa como referencia suave.');
  else if(p[origin]==='measured')reliable.push(`${label}: origen medido declarado.`);
  else estimated.push(`${label}: ${source(p[origin])}; referencia provisional.`);
 }
 if(m.mark&&m.confidence==='reference')reliable.push('Marca reciente comparable: permite estimar rangos, sin garantizar tiempos.');else missing.push('Marca reciente comparable: ausente o provisional; precisión de rendimiento limitada.');
 if(!known(p.recentFrequency)||!known(p.consistentWeeks))missing.push('Frecuencia o continuidad sin confirmar: disponibilidad no equivale a entrenamiento realizado.');
 if(!known(p.longest)||!p.longestDate||!p.longestResult||p.longestResult==='unknown')missing.push('Fecha o resultado de la tirada sin confirmar: su capacidad cómoda no está demostrada.');
 if(!known(p.easyEffort)||!p.easyConversation||p.easyConversation==='unknown')missing.push('Esfuerzo o conversación sin confirmar: el ritmo suave sigue siendo provisional.');
 if(p.days.some(d=>!known(p.minutes[d])))missing.push('Minutos sin confirmar: límite provisional de 20 min en esos días.');
 if(g.type==='unknown'||['race','time','nonstop'].includes(g.type)&&(!known(g.distance)||!g.date))missing.push('Distancia o fecha sin confirmar: preparación general provisional, sin garantizar preparación específica.');
 if(!p.weeklyTrend||p.weeklyTrend==='unknown')missing.push('Variaciones semanales sin confirmar: revisa la carga inicial con tus registros.');
 if(!known(p.fatigue)||!p.recovery||p.recovery==='unknown'||p.pain==='unknown')missing.push('Sensaciones o recuperación sin confirmar: revisa el esfuerzo antes de cada sesión.');
 if((p.otherSports||[]).some(s=>s.intensity==='unknown'||!known(s.minutes)))missing.push('Otros deportes sin duración o intensidad: se reservan su día y recuperación alrededor.');
 return {rows,reliable,missing,estimated,warnings:profileWarnings(p,start),decisions:c.notes,paceSource:m.source};
}
