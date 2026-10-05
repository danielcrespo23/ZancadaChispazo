import {runnerContext,nearHardSport} from './runner-context.mjs';
import {recentLong} from './profile-evidence.mjs';
import {activityToday} from './activity-source.mjs';

// Product heuristics. These are controlled practice sessions, never maximal tests.
const common={reduceWhen:['Fatiga o recuperación insuficiente: reducir o descansar.','Dolor relevante o restricción de carrera: pausa.','Calor o terreno adverso: esfuerzo y menos carga.','Tiempo insuficiente: bloques completos o sustitución cómoda.'],substitute:'easy',progression:{axes:['volume','repetitions','pace','difficulty'],maximumSimultaneousIncreases:1,requires:'Sesiones comparables realizadas y recuperación actual confirmada; avanzar de semana no es evidencia.'}};
const prescriptions={
 'easy-continuous':{kind:'continuous',work:'Conversación cómoda; duración limitada por carga tolerada.'},
 'recovery-soft':{kind:'continuous',work:'Más breve y suave que el rodaje ordinario; sin compensar kilómetros.'},
 'long-comfortable':{kind:'continuous',work:'Desde tirada reciente tolerada; sin final rápido automático.'},
 'tempo-continuous':{kind:'continuous',workShare:.4,count:1},
 'tempo-broken':{kind:'repeated',workShare:.4,count:2,minimumRepeatSeconds:180,recoverySeconds:90,recoveryKm:.2,recoveryPlacement:'between'},
 'interval-short':{kind:'repeated',initialCount:4,maximumCount:6,minimumCount:2,workSeconds:60,workKm:{five:.4,tenBuild:.6,tenSpecific:1},recoverySeconds:90,recoveryKm:.2,recoveryPlacement:'between'},
 'interval-endurance':{kind:'repeated',initialCount:4,maximumCount:6,minimumCount:2,workSeconds:60,workKm:.8,recoverySeconds:90,recoveryKm:.2,recoveryPlacement:'between'},
 'progressive-control':{kind:'continuous',workShareTime:.3,workShareDistance:.35},
 'hills-technique':{kind:'repeated',initialCount:4,maximumCount:8,minimumCount:4,workSeconds:30,recoverySeconds:90,recoveryPlacement:'after-each'},
 'run-walk':{kind:'repeated',workSeconds:60,recoverySeconds:120,recoveryPlacement:'after-each'},
 'strength-basic':{kind:'circuit',exerciseSeconds:45,recoverySeconds:45,exercisesPerRound:5,maximumRounds:2}
};
const progressionExamples={
 'easy-continuous':'Añadir unos minutos cómodos tras confirmar tolerancia, manteniendo ritmo y frecuencia.',
 'recovery-soft':'Conservar esfuerzo 2/10; volver al rodaje ordinario cuando la recuperación esté confirmada.',
 'long-comfortable':'Aumentar solo la duración dentro del límite de tirada; mantener esfuerzo y otros días.',
 'tempo-continuous':'Sustituir unos minutos suaves por tempo al mismo ritmo, sin aumentar duración total.',
 'tempo-broken':'Alargar por igual los dos bloques retirando rodaje suave; conservar pausa, ritmo y duración total.',
 'interval-short':'Pasar de 4 a 5 repeticiones retirando rodaje suave para conservar volumen total, ritmo y longitud de cada repetición.',
 'interval-endurance':'Alargar cada repetición retirando rodaje suave; conservar repeticiones, ritmo y volumen total.',
 'progressive-control':'Ampliar solo el final controlado retirando tramo fácil, con el mismo ritmo y duración total.',
 'hills-technique':'Añadir una subida con su bajada retirando tiempo en llano; conservar pendiente, esfuerzo y duración total.',
 'run-walk':'Alargar ligeramente los tramos de carrera retirando caminata, sin aumentar duración ni esfuerzo.',
 'strength-basic':'Cambiar repeticiones o resistencia tras dominar el movimiento; conservar rondas y minutos.'
};
const entry=(id,type,title,purpose,level,requirements,blocks,recovery,minimumWorkSeconds,rpe)=>({...common,id,type,title,purpose,level,requirements,blocks,recovery,prescription:prescriptions[id],progression:{...common.progression,example:progressionExamples[id]},minimumWorkSeconds,rpe,duration:{minimumSessionSeconds:['tempo','interval','progressive','hills'].includes(type)?1200:0,limit:'Minutos disponibles y carga tolerada; no compensar recortes.'},load:{kind:'planned',effortCeiling:rpe,calculation:'Suma de minutos de cada bloque × esfuerzo pautado; no es recuperación ni carga interna medida.'}});
export const SESSION_LIBRARY=[
 entry('easy-continuous','easy','Carrera fácil','Construir constancia y resistencia con conversación cómoda.','Carrera continua tolerada',['Sin dolor relevante; correr/caminar si todavía no toleras continuidad.'],['Calentamiento suave','Carrera cómoda','Vuelta a la calma'],'Sin pausas obligatorias; camina si lo necesitas.',0,3),
 entry('recovery-soft','recovery','Recuperación','Moverte con poco esfuerzo dejando margen para recuperarte.','Todos los niveles que toleran carrera continua',['No añadirla como día extra; descanso si la fatiga no mejora.'],['Inicio suave','Carrera muy suave','Final suave'],'Conversación sin esfuerzo; puede sustituirse por descanso.',0,2),
 entry('long-comfortable','long','Tirada larga cómoda','Practicar resistencia sostenida desde la tirada reciente, sin perseguir velocidad.','Base continua confirmada',['Tirada reciente tolerada; límites de carga, minutos y recuperación del plan.'],['Inicio cómodo','Carrera sostenida cómoda','Final suave'],'Sin trabajo rápido al final por defecto.',0,3),
 entry('tempo-continuous','tempo','Tempo continuo','Practicar esfuerzo sostenido y controlado; no afirmar un umbral medido.','Base regular',['Al menos 12 km/semana; sin restricciones de intensidad ni señales de mala recuperación.'],['Calentamiento','Aproximación suave','Tempo controlado','Salida suave','Vuelta a la calma'],'Continuo; no añadir pausas ficticias.',360,6),
 entry('tempo-broken','tempo','Tempo fraccionado','Acumular esfuerzo sostenido con una pausa que permita mantener control.','Base regular confirmada',['24 km/semana, 8 semanas constantes, 3 días recientes, tirada medida y cómoda de al menos 8 km en los últimos 42 días y recuperación buena.'],['Calentamiento','2 bloques tempo iguales','Trote entre bloques','Salida suave','Vuelta a la calma'],'Una recuperación de 90 s o 200 m suaves solo entre dos bloques; mínimo 3 min por bloque.',360,6),
 entry('interval-short','interval','Intervalos controlados','Practicar cambios de ritmo y técnica con recuperación suficiente.','Base regular',['Calidad autorizada por el contexto; 48 horas de margen con trabajo exigente.'],['Calentamiento','4 repeticiones iguales','3 recuperaciones','Rodaje restante','Vuelta a la calma'],'200 m suaves o 90 s entre repeticiones; no hay otra pausa tras la última.',240,7),
 entry('interval-endurance','interval','Repeticiones de resistencia','Apoyo a la economía de carrera y control del esfuerzo en preparaciones largas.','Base consolidada',['24 km/semana, 8 semanas constantes, 3 días recientes, tirada medida y cómoda de al menos 8 km en los últimos 42 días y recuperación buena.'],['Calentamiento','Hasta 4 repeticiones controladas','Recuperaciones amplias','Salida suave','Vuelta a la calma'],'200 m muy suaves o 90 s entre repeticiones; esfuerzo 6/10, sin perseguir ritmo de maratón.',240,6),
 entry('progressive-control','progressive','Progresivo controlado','Aprender a cambiar de esfuerzo y terminar con control sin esprintar.','Base regular',['Calidad permitida; no combinar final rápido con incremento de tirada larga.'],['Calentamiento','Carrera cómoda','Final breve controlado','Vuelta a la calma'],'Sin pausas; final controlado a esfuerzo 5/10.',180,5),
 entry('hills-technique','hills','Cuestas suaves','Practicar técnica y fuerza de carrera cuando el recorrido exige pendientes.','Base regular',['Recorrido con pendientes; subida segura; sin deporte exigente alrededor.'],['Calentamiento en llano','4 subidas de 30 s','4 bajadas suaves de 90 s','Vuelta a la calma'],'Bajada caminando o a trote, también después de la última subida.',120,6),
 entry('run-walk','walk','Correr y caminar','Construir tolerancia y hábito sin presuponer carrera continua.','Iniciación o vuelta',['Sin restricción de carrera; alternancia adecuada a la tolerancia declarada.'],['Caminar para calentar','Carrera suave y caminata','Caminar para terminar'],'Caminar después de cada tramo de carrera.',0,3),
 entry('strength-basic','strength','Fuerza complementaria','Practicar piernas y tronco dejando margen para correr y recuperarte.','Todos los niveles, con apoyos',['Sin dolor relevante; comprobar fuerza y CrossFit existentes; esfuerzo moderado.'],['Movilidad','Ejercicios de piernas y tronco','Descansos entre ejercicios','Movilidad final'],'45 s para practicar y 45 s para descansar o preparar el siguiente ejercicio.',0,4)
];
export const SESSION_LIBRARY_SOURCES=[
 {title:'B.A.A.: sesiones de preparación de 5 km',url:'https://www.baa.org/races/boston-5k/info-for-athletes/boston-5k-training/'},
 {title:'B.A.A.: preparación de 10 km',url:'https://www.baa.org/races/boston-10k/info-for-athletes/b-a-a-10k-training/'},
 {title:'B.A.A.: preparación de media maratón con tempo e intervalos',url:'https://www.baa.org/races/boston-half/info-for-athletes/boston-half-training/'},
 {title:'B.A.A.: preparación de maratón por nivel',url:'https://www.baa.org/races/boston-marathon/info-for-athletes/boston-marathon-training/'}
];
export const sessionDefinition=id=>SESSION_LIBRARY.find(s=>s.id===id);
export const sessionLoad=blocks=>({kind:'planned',effortMinutes:Math.round(blocks.reduce((n,b)=>n+b.seconds/60*b.effort,0)),workSeconds:blocks.filter(b=>b.role==='work').reduce((n,b)=>n+b.seconds,0)});
export function progressionAudit(before,after){
 const axes=[];
 const work=s=>(s.blocks||[]).filter(b=>b.role==='work');
 const targets=s=>work(s).filter(b=>b.targetPace>0).map(b=>b.targetPace);
 const oldPaces=targets(before),newPaces=targets(after);
 if(oldPaces.length&&newPaces.length&&Math.min(...newPaces)<Math.min(...oldPaces))axes.push('pace');
 if(before.distance!=null&&after.distance!=null?after.distance>before.distance+.01:after.seconds>before.seconds)axes.push('volume');
 if((after.repetitions?.count||0)>(before.repetitions?.count||0))axes.push('repetitions');
 if(after.rpe>before.rpe||before.dose&&after.dose&&before.dose.unit===after.dose.unit&&after.dose.work>before.dose.work+.001)axes.push('difficulty');
 return {allowed:axes.length<=1,increasedAxes:axes,reason:axes.length>1?'Aumentan varias variables; conserva las demás y revisa una sola.':'No se aumenta más de una variable.'};
}
export function enduranceReady(p,date=activityToday(p.timezone||'Europe/Madrid')){const long=recentLong(p,date);return +p.weeklyKm>=24&&+p.consistentWeeks>=8&&+p.recentFrequency>=3&&long.value>=8&&long.age!=null&&long.age>=0&&long.age<=42&&p.longestSource==='measured'&&p.longestResult==='comfortable'&&p.recovery==='good'&&p.pain==='none';}
export function sessionFormat(p,type,phase,{format=null,referenceDate}={}){
 const distance=+p.goal?.distance||0;
 let id=format;
 if(!id)id=type==='tempo'?(distance>=20&&phase?.key==='build'&&enduranceReady(p,referenceDate)?'tempo-broken':'tempo-continuous'):type==='interval'?(distance>10?'interval-endurance':'interval-short'):({easy:'easy-continuous',recovery:'recovery-soft',long:'long-comfortable',progressive:'progressive-control',hills:'hills-technique',walk:'run-walk',strength:'strength-basic'})[type];
 const definition=sessionDefinition(id);if(!definition||definition.type!==type)throw Error('Formato incompatible con el tipo de sesión.');return definition;
}
export function formatEligibility(p,definition,date){
 const reasons=[],quality=['tempo','interval','progressive','hills'].includes(definition.type);
 if(quality&&!runnerContext(p,date).quality)reasons.push('La base, restricciones o recuperación actuales no permiten calidad.');
 if(['tempo-broken','interval-endurance'].includes(definition.id)&&!enduranceReady(p,date))reasons.push('Faltan base consolidada, constancia, tirada reciente medida y tolerada o recuperación buena para este formato.');
 if(definition.type==='hills'&&p.terrain==='treadmill')reasons.push('No se prescribe una cuesta exterior en un perfil que entrena en cinta.');
 return {eligible:reasons.length===0,reasons};
}
export function selectQualitySession(p,phase,{previous=[],date}={}){
 const context=runnerContext(p,date),distance=+p.goal?.distance||0;
 if(!context.quality||['base','deload','taper'].includes(phase?.key))return {type:'easy',reason:'La fase y la recuperación piden carrera cómoda, sin intensidad nueva.'};
 const specific=phase?.key==='specific';
 const priorities=distance&&distance<=5?{interval:specific?3:2,tempo:1,progressive:.6}:distance<=10&&distance>0?{tempo:specific?2.5:2,interval:1.5,progressive:.6}:distance<30&&distance>10?{tempo:specific?3:2,progressive:1,interval:enduranceReady(p,date)?.7:0}:{tempo:specific?3:2,progressive:1,interval:enduranceReady(p,date)?.5:0};
 if(!distance)Object.assign(priorities,{tempo:1,progressive:1,interval:0});
 const hilly=p.terrain!=='treadmill'&&(p.goal?.terrain==='trail'||+p.goal?.elevation/distance>=5);if(hilly)priorities.hills=specific?1:2;
 const recent=previous.filter(s=>['tempo','interval','progressive','hills'].includes(s.type)&&s.phase?.key===phase?.key).slice(-6);
 const choices=Object.entries(priorities).filter(([,weight])=>weight>0).map(([type,weight])=>({type,score:weight/(1+recent.filter(s=>s.type===type).length)})).sort((a,b)=>b.score-a.score||a.type.localeCompare(b.type));
 const selected=choices[0]?.type||'easy';
 return {type:selected,reason:(specific?'Práctica específica':'Desarrollo')+' para '+(distance?distance+' km':'constancia')+': '+sessionFormat(p,selected,phase,{referenceDate:date}).purpose+' La prioridad depende de objetivo, base, fase y trabajo ya previsto; no del número par o impar de semana.'};
}

const rounded=n=>Math.max(0,Math.floor((n+1e-8)*10)/10);
const target=range=>range?Math.round((range[0]+range[1])/10)*5:null;
export function buildRunningBlocks({p,type,phase,km=0,minutes=0,ranges={},range=null,source='effort',format=null,dose=null}){
 const definition=sessionFormat(p,type,phase,{format}),prescription=definition.prescription,timed=!(km>0&&ranges.easy)&&type!=='hills',easy=ranges.easy||null;
 const block=(label,value,effort,kind='main',role=null,r=easy)=>{const distance=timed||type==='hills'?0:rounded(value),pace=target(r),fallback=target(easy);return {label,distance,seconds:distance?Math.round(distance*(pace||fallback)):Math.round(value),effort,kind,role,range:r,targetPace:pace,paceSource:source,durationType:distance?'estimated':'prescribed'};};
 const total=timed||type==='hills'?Math.max(0,Math.floor(minutes*60)):rounded(km);
 const quality=['tempo','interval','hills','progressive'].includes(type),byTime=timed||type==='hills';
 const warm=byTime?Math.min(quality?300:Math.min(300,Math.floor(total*.2)),total):quality?Math.max(rounded(Math.min(1.2,total*.2)),Math.ceil(300/target(easy)*10)/10):rounded(Math.min(1.2,total*.2));
 const cool=byTime?Math.min(quality?300:warm,Math.max(0,total-warm)):quality?Math.max(rounded(Math.min(.8,total*.15)),Math.ceil(180/target(easy)*10)/10):rounded(Math.min(.8,total*.15));
 const main=timed||type==='hills'?total-warm-cool:rounded(total-warm-cool);
 if(quality&&total<warm+cool)return {failed:'La carga disponible no permite reservar calentamiento y vuelta a la calma.',definition};
 const blocks=[block(type==='hills'?'Calienta en llano a ritmo cómodo':'Calentamiento suave',warm,2,'warmup')];let repetitions=null;
 const addSoft=(label,value)=>{if(value>0)blocks.push(block(label,value,type==='recovery'?2:3));};
 if(type==='interval'){
  const endurance=definition.id==='interval-endurance',distanceWork=typeof prescription.workKm==='number'?prescription.workKm:+p.goal?.distance<=5?prescription.workKm.five:phase?.key==='specific'?prescription.workKm.tenSpecific:prescription.workKm.tenBuild,standard=timed?prescription.workSeconds:distanceWork,work=dose?.work||standard,rec=timed?prescription.recoverySeconds:prescription.recoveryKm;
  if(dose?.count>prescription.initialCount&&work>standard)return {failed:'No se aumentan a la vez repeticiones y longitud del trabajo. Revisa una sola variable.',definition};
  const count=Math.min(dose?.count||prescription.initialCount,prescription.maximumCount,Math.floor((main+rec)/(work+rec))),minimum=prescription.minimumCount;
  if(count<minimum)return {failed:'No caben al menos dos repeticiones completas con sus recuperaciones.',definition};
  repetitions={count,...(timed?{workSeconds:work,recoverySeconds:rec}:{workDistance:work,recoveryDistance:rec}),recoveryCount:count-1,recoveryPlacement:'between',recoveryType:'Trote muy suave o caminar',workRange:range};
  const used=count*work+(count-1)*rec,remaining=timed?main-used:rounded(main-used);
  if(!timed)addSoft('Rodaje de aproximación a las repeticiones',remaining);
  for(let i=0;i<count;i++){blocks.push(block('Repetición '+(i+1)+'/'+count+(timed?'':' · '+Math.round(work*1000)+' m'),work,endurance?6:7,'main','work',range));if(i<count-1)blocks.push(block('Recuperación '+(i+1)+'/'+(count-1)+(timed?' caminando o a trote':' · 200 m a trote suave o caminando'),rec,2,'recovery','recovery',ranges.recovery||null));}
  if(timed)addSoft('Rodaje suave tras las repeticiones',remaining);
 }else if(type==='tempo'){
  const broken=definition.id==='tempo-broken',rec=broken?(timed?prescription.recoverySeconds:prescription.recoveryKm):0;
  const available=timed?main-rec:rounded(main-rec),initial=timed?Math.floor(main*prescription.workShare/30)*30:rounded(main*prescription.workShare),wanted=Math.min(dose?dose.work*(broken?dose.count||prescription.count:1):initial,initial);
  const work=timed?Math.min(wanted,available):rounded(Math.min(wanted,available));
  const count=prescription.count,each=timed?Math.floor(work/count/30)*30:rounded(work/count),actual=each*count;
  const lead=timed?Math.floor((available-actual)/60)*30:rounded((available-actual)/2),tail=timed?available-actual-lead:rounded(available-actual-lead);
  addSoft('Aproximación suave',lead);
  if(broken)repetitions={count, ...(timed?{workSeconds:each,recoverySeconds:rec}:{workDistance:each,recoveryDistance:rec}),recoveryCount:1,recoveryPlacement:'between',recoveryType:'Trote suave; recupera conversación cómoda',workRange:range};
  for(let i=0;i<count;i++){blocks.push(block(broken?'Tempo fraccionado '+(i+1)+'/2':'Tempo continuo · controlado, sin esprintar',each,6,'main','work',range));if(i<count-1)blocks.push(block('Recuperación suave entre bloques tempo',rec,2,'recovery','recovery',ranges.recovery||null));}
  addSoft('Rodaje suave tras el tempo',tail);
 }else if(type==='progressive'){
  const work=dose?.work??(timed?Math.floor(main*prescription.workShareTime/30)*30:rounded(main*prescription.workShareDistance)),last=timed?Math.min(work,main):rounded(Math.min(work,main));
  addSoft('Empieza cómodo y estable',timed?main-last:rounded(main-last));blocks.push(block('Termina con control, sin esprintar',last,5,'main','work',range));
 }else if(type==='hills'){
  const work=prescription.workSeconds,rec=prescription.recoverySeconds,count=Math.min(dose?.count||prescription.initialCount,prescription.maximumCount,Math.floor(main/(work+rec)));
  if(count<prescription.minimumCount)return {failed:'No caben cuatro subidas breves y la bajada completa de cada una.',definition};
  repetitions={count,workSeconds:work,recoverySeconds:rec,recoveryCount:count,recoveryPlacement:'after-each',recoveryType:'Baja caminando o a trote muy suave; no corras rápido cuesta abajo.'};
  addSoft('Rodaje en llano antes de las subidas',main-count*(work+rec));
  for(let i=0;i<count;i++){blocks.push(block('Cuesta '+(i+1)+'/'+count+' · pendiente suave del 3–5 %',work,6,'main','work',null),block('Baja caminando o a trote suave; completa 90 s',rec,2,'recovery','recovery',null));}
 }else if(main>0)blocks.push(block(type==='recovery'?'Carrera muy suave; conversación sin esfuerzo':'Carrera continua cómoda',main,type==='recovery'?2:3,'main',null,range||easy));
 blocks.push(block(type==='hills'?'Vuelta a la calma en llano':'Vuelta a la calma suave',cool,2,'cooldown'));
 const filtered=blocks.filter(b=>b.seconds>0),seconds=filtered.reduce((n,b)=>n+b.seconds,0),distance=timed||type==='hills'?null:Math.round(filtered.reduce((n,b)=>n+b.distance,0)*100)/100;
 const workSeconds=filtered.filter(b=>b.role==='work').reduce((n,b)=>n+b.seconds,0);
 const minimum=definition.id==='tempo-broken'?filtered.filter(b=>b.role==='work').every(b=>b.seconds>=prescription.minimumRepeatSeconds):workSeconds>=definition.minimumWorkSeconds;
 return {definition,blocks:filtered,repetitions,distance,seconds,estimated:distance!=null,range,rpe:definition.rpe,hard:['tempo','interval','hills','progressive'].includes(type)||type==='long'&&(distance!=null?distance>=6:seconds>=3600),purpose:definition.purpose,load:sessionLoad(filtered),dose:{count:repetitions?.count||1,work:repetitions?.workDistance||repetitions?.workSeconds||(timed?workSeconds:Math.round(filtered.filter(b=>b.role==='work').reduce((n,b)=>n+b.distance,0)*10)/10),unit:timed||type==='hills'?'seconds':'km'},purposeMet:minimum,format:{id:definition.id,title:definition.title,level:definition.level,requirements:definition.requirements,progression:definition.progression,reduction:definition.reduceWhen},progression:'La dosis de trabajo se conserva al avanzar de semana. Para progresar, cambia una sola variable con sesiones realizadas y recuperación confirmada; no se acelera por el calendario.',conversation:definition.rpe>=6?'Frases cortas, sin llegar al máximo.':'Puedes mantener conversación cómoda; en el final progresivo, frases más breves.'};
}

export function strengthContext(p,dateDay){
 const sports=(p.otherSports||[]).filter(s=>['strength','crossfit'].includes(s.type)),same=sports.some(s=>+s.day===dateDay),existing=sports.length>0;
 if(same)return {allowed:false,reason:'Ese día ya tiene fuerza o CrossFit declarado; no se duplica el trabajo.'};
 if(nearHardSport(p,dateDay))return {allowed:false,reason:'Hay deporte exigente a menos de 48 horas; se conserva recuperación.'};
 if(existing)return {allowed:false,reason:'Ya declaras fuerza o CrossFit semanal. Se utiliza como complemento existente; revisa su contenido antes de añadir otra sesión.'};
 return {allowed:true,reason:'Complemento moderado en día propio; deja margen para las carreras exigentes.'};
}
const STRENGTH_EXERCISES=[
 {id:'squat',name:'Sentarse y levantarse',instruction:'Siéntate en una silla estable y levántate despacio. Rodillas en la dirección de los pies; 6–8 repeticiones cómodas.',options:{none:'Usa una silla o reduce el recorrido.',band:'Banda ligera sobre las rodillas; conserva el mismo recorrido.',weights:'Sujeta una mancuerna ligera delante del pecho solo si ya dominas el movimiento.'}},
 {id:'hinge',name:'Bisagra de cadera',instruction:'Lleva la cadera hacia atrás con rodillas ligeramente flexionadas y espalda estable. Vuelve apretando suavemente los glúteos; 6–8 repeticiones.',options:{none:'Practica sin peso con las manos en la cadera.',band:'Pisa una banda ligera y sujeta sus extremos.',weights:'Dos mancuernas ligeras junto a las piernas, sin redondear la espalda.'}},
 {id:'calf',name:'Elevación de talones',instruction:'Sujétate a una pared o silla. Sube y baja ambos talones despacio; 8–10 repeticiones.',options:{none:'Ambos pies y apoyo para el equilibrio.',band:'Mantén la variante sin carga; no hace falta banda.',weights:'Añade una mancuerna ligera con la otra mano apoyada.'}},
 {id:'step',name:'Subida a un escalón bajo',instruction:'Sube a un escalón estable, baja despacio y alterna piernas; 5–6 veces por lado. No uses superficies inestables.',options:{none:'Si no hay escalón seguro, repite sentarse y levantarse.',band:'Conserva el escalón sin carga extra.',weights:'Una carga ligera solo si mantienes equilibrio sin ayuda.'}},
 {id:'trunk',name:'Tronco con control',instruction:'Apoya manos y rodillas; estira un brazo y la pierna contraria sin girar el tronco. Alterna 4–6 veces por lado.',options:{none:'Mueve solo un brazo o una pierna si cuesta mantener equilibrio.',band:'La misma variante sin tensión extra.',weights:'La misma variante sin carga; prioriza el control.'}}
];
export function buildStrengthBlocks(minutes=25,equipment='none'){
 const definition=sessionDefinition('strength-basic'),prescription=definition.prescription,period=prescription.exerciseSeconds+prescription.recoverySeconds,limit=Math.max(0,Math.floor(minutes*60)),material=['none','band','weights'].includes(equipment)?equipment:'none',warm=Math.min(300,Math.floor(limit*.2)),cool=Math.min(300,Math.floor(limit*.2));
 const block=(label,seconds,kind,effort,exercise=null)=>({label,seconds,distance:0,kind,effort,range:null,targetPace:null,durationType:'prescribed',...(exercise?{exercise}: {})});
 const blocks=[block('Movilidad cómoda de tobillos, caderas y hombros',warm,'warmup',2)];
 const count=Math.min(prescription.maximumRounds,Math.floor((limit-warm-cool)/(period*prescription.exercisesPerRound)))*prescription.exercisesPerRound;
 for(let i=0;i<count;i++){const exercise=STRENGTH_EXERCISES[i%prescription.exercisesPerRound];blocks.push(block(exercise.name+' · '+exercise.instruction+' '+exercise.options[material]+' Tienes hasta 45 s; si terminas antes, descansa el resto del bloque.',prescription.exerciseSeconds,'main',4,{...exercise,selectedMaterial:material}),block('Descansa y prepara el siguiente ejercicio; respira con normalidad',prescription.recoverySeconds,'recovery',1));}
 const remainder=limit-warm-cool-count*period;if(remainder>0)blocks.push(block('Practica movilidad cómoda, sin añadir repeticiones para llenar el tiempo',remainder,'main',2));
 blocks.push(block('Movilidad suave para terminar',cool,'cooldown',1));
 return {blocks:blocks.filter(b=>b.seconds>0),load:sessionLoad(blocks),seconds:limit,distance:null,estimated:false,range:null,repetitions:null,rpe:count>=5?4:2,hard:false,purpose:count>=5?sessionDefinition('strength-basic').purpose:'Movilidad suave: el tiempo no permite una ronda completa de fuerza.',format:{id:count>=5?'strength-basic':'strength-mobility',title:count>=5?'Fuerza complementaria':'Movilidad suave',level:'Práctica con apoyos',requirements:sessionDefinition('strength-basic').requirements},strength:{equipment:material,exerciseCount:count,rounds:Math.floor(count/5),effortCeiling:4,alternatives:STRENGTH_EXERCISES},progression:'Primero completa los movimientos con control. Cambia repeticiones o carga o rondas, una sola variable; no aumentes ninguna automáticamente por semana.',conversation:'Respira con normalidad, sin contener la respiración.',advice:'Termina cada ejercicio con margen. Si molesta, reduce recorrido o sustitúyelo por movilidad cómoda; no fuerces el movimiento.',alternative:'Haz solo movilidad suave y registra los minutos y esfuerzo que realmente realizaste.'};
}
