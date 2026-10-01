export const DAYS=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
export const TYPES={easy:'Carrera fácil',recovery:'Recuperación',long:'Carrera larga',race:'Día de la carrera',hills:'Cuestas',tempo:'Tempo',interval:'Intervalos',progressive:'Progresivo',walk:'Correr / caminar',strength:'Fuerza',rest:'Descanso'};
export const uid=()=>globalThis.crypto.randomUUID();
// Calendar dates are local to the runner. The browser sets its zone; the server uses the zone saved in the profile.
let zone='Europe/Madrid';
export function validTimeZone(tz){if(typeof tz!=='string'||!tz||tz.length>64)return false;try{new Intl.DateTimeFormat('en',{timeZone:tz});return true;}catch{return false;}}
export const setTimeZone=tz=>{if(validTimeZone(tz))zone=tz;return zone;};
export const timeZone=()=>zone;
export const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export const dateObj=d=>new Date(d+'T12:00:00Z');
export const addDays=(d,n)=>{const v=dateObj(d);v.setUTCDate(v.getUTCDate()+n);return v.toISOString().slice(0,10)};
export const day=d=>dateObj(d).getUTCDay();
export const daysBetween=(a,b)=>Math.round((dateObj(b)-dateObj(a))/86400000);
export const monday=d=>addDays(d,-((day(d)+6)%7));
export const round=n=>Math.round(n*100)/100;
export const planKm=n=>Math.max(0,Math.floor((n+1e-8)*10)/10);
export const targetSeconds=n=>Math.round(n/5)*5;
export const speed=s=>s>0?round(3600/s):null;
export const pace=s=>!s?'Por esfuerzo':`${Math.floor(Math.round(s)/60)}:${String(Math.round(s)%60).padStart(2,'0')}`;
export function seconds(v){if(!v)return 0;if(typeof v==='number')return v;const p=String(v).trim().split(':');if(p.length<2||p.length>3||p.some(x=>!/^\d+$/.test(x))||p.slice(1).some(x=>+x>=60))return NaN;return p.reduce((a,x)=>a*60+Number(x),0)}
export const duration=value=>{const s=Math.max(0,Math.round(value));return `${Math.floor(s/3600)?Math.floor(s/3600)+':':''}${String(Math.floor(s/60)%60).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;};
export const empty=()=>({profile:null,plan:null,activities:[],changes:[],proposals:[],version:1});
export const blankProfile=()=>({name:'',age:'',experience:'beginner',weeklyKm:'',trainingDays:3,longest:'',easyPace:'',restHR:'',maxHR:'',hrSource:'measured',injuries:'',pain:'none',restrictions:'',days:[1,3,6],minutes:{1:45,3:45,6:60},longDay:6,strength:false,strengthDay:2,terrain:'asphalt',marks:[],goal:{type:'routine',distance:5,date:'',time:''}});
export function metrics(p,start=today()){
 const marks=(p.marks||[]).filter(m=>m.distance>0&&seconds(m.time)>0&&m.date&&daysBetween(m.date,start)>=0&&daysBetween(m.date,start)<=180).sort((a,b)=>b.date.localeCompare(a.date));
 const m=marks[0];const base=m?seconds(m.time)/m.distance:null;
 let ranges=base?{easy:[base*1.2,base*1.45],recovery:[base*1.3,base*1.55],long:[base*1.2,base*1.45],tempo:[base*1.04,base*1.13],interval:[base*.94,base*1.02],progressive:[base*1.12,base*1.35]}:{};
 const declared=seconds(p.easyPace),source=m?'recent-mark':declared>0?'declared-easy':'effort';
 if(!m&&declared>0){const targets={easy:declared,recovery:declared+30,long:declared+15,tempo:declared*.95,interval:declared*.9,progressive:declared*.96};ranges=Object.fromEntries(Object.entries(targets).map(([type,value])=>{const target=targetSeconds(value);return [type,[target-15,target+15]]}));}
 const missing=[];if(!m)missing.push(declared>0?'Sin marca reciente: los objetivos numéricos parten del ritmo suave que has declarado. Son referencias provisionales, no umbral ni rendimiento medidos; manda el esfuerzo.':'Sin marca válida ni ritmo suave conocido: las sesiones se guían por esfuerzo y conversación.');if(p.weeklyKm==='')missing.push('Sin volumen reciente: empezaremos con sesiones cortas de correr y caminar.');if(!p.maxHR||!p.restHR)missing.push('Sin FC máxima y en reposo: no se muestran zonas cardíacas.');if(!p.longest)missing.push('Sin tirada reciente: la duración larga se limitará conservadoramente.');
 return {ranges,source,mark:m,basePace:base||declared||null,reference:m?`Tu punto de partida: ${m.distance} km en ${m.time}, a ${pace(base)} min/km, el ${m.date}.`:p.easyPace?`Ritmo suave declarado: ${p.easyPace} min/km. No es una marca ni permite estimar tu umbral.`:"Sin marca reciente: partimos de esfuerzo 3/10 y conversación cómoda.",method:m?`Estimación por tu marca de ${m.distance} km (${m.date}). Multiplicadores conservadores sobre su ritmo; no es un umbral medido. Marcas de más de 180 días se excluyen.`:declared>0?'Objetivos provisionales desde tu ritmo suave declarado: fácil igual al declarado, recuperación +30 s/km, larga +15 s/km, tempo un 5 % y repeticiones un 10 % más rápidas. Redondeo a 5 s; ajustar por esfuerzo. Estas reglas iniciales no miden tu umbral ni garantizan la marca objetivo.':'Esfuerzo percibido y prueba de conversación. No calculamos ritmos a partir de las pulsaciones.',missing};
}
export function feasibility(p,start=today()){
 const g=p.goal, weeks=g.date?daysBetween(start,g.date)/7:12, notes=[];let cautious=false;
 if(g.date&&weeks<=0)throw Error('La fecha objetivo debe ser posterior a hoy.');if(weeks>52)throw Error('Elige una fecha dentro de los próximos 12 meses y revisa el objetivo más adelante.');
 if(!p.days.length)throw Error('Selecciona al menos un día disponible.');if(+p.trainingDays<1||+p.trainingDays>p.days.length)throw Error('Los días de entrenamiento no pueden superar los disponibles.');
 if(!p.days.includes(+p.longDay))throw Error('El día de tirada larga debe estar disponible.');if(p.strength&&!p.days.includes(+p.strengthDay))throw Error('El día de fuerza debe estar disponible.');if(p.days.some(d=>!Number.isFinite(+p.minutes[d])||+p.minutes[d]<15))throw Error('Indica al menos 15 minutos en cada día disponible.');
 const distance=+g.distance||0, km=+p.weeklyKm||0;
 const recommended=distance>=40?24:distance>=20?16:distance>=10?10:8;
 const baseline=distance>=40?30:distance>=20?18:distance>=10?10:3;
 if(['race','time','nonstop'].includes(g.type)&&(weeks<recommended||km<baseline)){cautious=true;notes.push(`La meta de ${distance} km necesita revisión: dispones de ${Math.floor(weeks)} semanas y vienes de ${km} km/semana. Como referencia conservadora proponemos ${recommended} semanas y una base de ${baseline} km/semana. Alternativa: ${distance>=20?'preparar primero 10 km':distance>=10?'completar 5 km cómodos':'alternar carrera y caminata sin objetivo de tiempo'}. El plan no fuerza el volumen para alcanzar la meta.`);}
 if(p.pain!=='none'){cautious=true;notes.push('Has indicado molestias actuales. El plan limita la carga y sustituye la intensidad por opciones suaves; con dolor relevante, pausa y valora la situación con un profesional.');}
 const alternatives=[];
 if(['race','time','nonstop'].includes(g.type)&&g.date&&weeks<recommended&&recommended<=52)alternatives.push({kind:'date',text:`Mantener ${distance} km con una fecha a partir del ${addDays(start,recommended*7).split('-').reverse().join('/')} (${recommended} semanas).`,goal:{...g,date:addDays(start,recommended*7)}});
 if(['race','time','nonstop'].includes(g.type)&&km<baseline&&distance>5){const shorter=distance>=20?10:5;alternatives.push({kind:'distance',text:`Preparar primero ${shorter} km en la misma fecha y revisar la meta después.`,goal:{...g,distance:shorter,time:''}});}
 const {mark}=metrics(p,start);if(g.time&&mark){const prediction=seconds(mark.time)*Math.pow(distance/mark.distance,1.06);if(seconds(g.time)<prediction*.94){cautious=true;notes.push(`Tu marca sugiere aproximadamente ${duration(prediction)} para ${distance} km, por extrapolación de potencia (exponente 1,06). El tiempo deseado es exigente; propone completar la distancia o revisar el tiempo tras varias sesiones comparables. Esta extrapolación pierde precisión en distancias largas.`);alternatives.push({kind:'time',text:`Usar ${duration(targetSeconds(prediction))} como tiempo orientativo, derivado de tu marca reciente.`,goal:{...g,time:duration(targetSeconds(prediction))}},{kind:'finish',text:'Terminar la distancia sin objetivo de tiempo.',goal:{...g,time:''}});}}
 if(g.time&&!mark)notes.push('Sin marca reciente no podemos valorar el tiempo deseado; empieza con una sesión de referencia.');
 if(p.days.length<3)notes.push('Con menos de tres días priorizamos rodajes fáciles y constancia, con menor variedad de intensidad.');
 return {cautious,notes:notes.length?notes:['Objetivo orientativamente compatible con los datos aportados. No garantiza una marca ni alcanzar la distancia.'],weeks,alternatives};
}
// Older saved plans have no block kind; the label is enough to recover it.
export function blockKind(label=''){if(/^(Calentamiento|Calienta|Camina cómodo para calentar|Movilidad$|Rodaje de aproximación|Aproximación suave)/.test(label))return 'warmup';if(/^(Vuelta a la calma|Camina para terminar|Movilidad suave)/.test(label))return 'cooldown';if(/^(Recuperación|Baja )/.test(label))return 'recovery';return 'main';}
export const BLOCK_KINDS={warmup:'Calentamiento',main:'Bloque principal',recovery:'Recuperación',cooldown:'Vuelta a la calma'};
export function profileErrors(d,start=today()){
 const e=[],n=v=>v===''||v==null?null:+v,g=d.goal||{};
 if(n(d.age)!=null&&!(n(d.age)>=18&&n(d.age)<=100))e.push('Este plan está diseñado para adultos de 18 a 100 años.');
 if(n(d.weeklyKm)!=null&&!(n(d.weeklyKm)>=0&&n(d.weeklyKm)<=250))e.push('Kilómetros semanales: entre 0 y 250.');
 if(n(d.longest)!=null&&!(n(d.longest)>=0&&n(d.longest)<=150))e.push('Tirada más larga: entre 0 y 150 km.');
 if(d.easyPace&&!(seconds(d.easyPace)>=150&&seconds(d.easyPace)<=1200))e.push('Ritmo suave: usa mm:ss por kilómetro, entre 2:30 y 20:00.');
 if(d.maxHR&&d.restHR&&+d.maxHR<=+d.restHR)e.push('La FC máxima debe superar la de reposo.');
 if(['nonstop','time','race'].includes(g.type)&&!(+g.distance>0&&+g.distance<=100))e.push('Indica una distancia objetivo entre 0,1 y 100 km.');
 if(g.type==='race'&&!g.date)e.push('Indica la fecha de la carrera.');
 if(g.time&&!(seconds(g.time)>0))e.push('Tiempo objetivo: usa mm:ss o hh:mm:ss.');
 if((d.marks||[]).some(m=>!m.date||m.date>start||!(+m.distance>0)||!(seconds(m.time)>0)))e.push('Revisa fecha, distancia y tiempo de tus marcas.');
 if(!e.length)try{feasibility(d,start);}catch(x){e.push(x.message);}
 return e;
}
export function hrRange(p,type){if(!(+p.restHR>0&&+p.maxHR>+p.restHR))return null;const fractions=['tempo','interval','hills'].includes(type)?[.7,.85]:[.5,.7];return fractions.map(f=>Math.round(+p.restHR+(+p.maxHR-p.restHR)*f));}
export function session(p,type,date,km,minutes,week,phase=null){
 const m=metrics(p),range=type==='hills'?null:m.ranges[type]||m.ranges.easy||null;
 const easy=m.ranges.easy||null, mean=r=>r?(r[0]+r[1])/2:(seconds(p.easyPace)||420);
 const block=(label,distance,sec,effort,r=easy)=>({label,distance:planKm(distance),seconds:r&&distance?Math.round(planKm(distance)*targetSeconds(mean(r))):Math.round(sec),effort,range:r,targetPace:r?targetSeconds(mean(r)):null,paceSource:m.source});
 let blocks=[],repetitions=null;km=planKm(km);
 const warm=planKm(Math.min(1.2,km*.2)),cool=planKm(Math.min(.8,km*.15)),remaining=planKm(km-warm-cool);
 if(type==='strength')blocks=[block('Movilidad',0,300,2,null),block('2 rondas: 8 sentadillas, 8 bisagras de cadera, 10 elevaciones de gemelo y 20 s de plancha. Descansa 60 s entre ejercicios.',0,900,4,null),block('Movilidad suave',0,300,1,null)];
 else if(type==='walk'){
  const runSeconds=Math.min(360,60+Math.floor(week/2)*30),recoverySeconds=week>=4?60:120;
  const reps=Math.max(1,Math.floor((minutes*60-600)/(runSeconds+recoverySeconds)));
  const run=Math.min(runSeconds,Math.max(30,minutes*60-600-recoverySeconds));
  repetitions={count:reps,workSeconds:run,recoverySeconds,recoveryType:'Caminar'};
  blocks=[block('Camina cómodo para calentar',0,300,2,null),...Array.from({length:reps},(_,i)=>[block(`Carrera suave ${i+1}/${reps}`,0,run,3,null),block('Recuperación caminando',0,recoverySeconds,2,null)]).flat(),block('Camina para terminar',0,300,1,null)];
 }else if(type==='hills'){
  const total=Math.max(900,Math.round(minutes*60)),reps=Math.min(8,4+Math.floor(week/4)),work=30+Math.min(15,Math.floor(week/4)*5),rec=90;
  repetitions={count:reps,workSeconds:work,recoverySeconds:rec,recoveryType:'Baja caminando o a trote muy suave; no corras rápido cuesta abajo.'};
  blocks=[block('Calienta en llano a ritmo cómodo',0,Math.max(300,total-300-reps*(work+rec)),2,easy),...Array.from({length:reps},(_,i)=>[block(`Cuesta ${i+1}/${reps} · pendiente suave del 3–5 %`,0,work,6,null),block('Baja caminando o a trote suave; espera hasta completar 90 s',0,rec,2,null)]).flat(),block('Vuelta a la calma en llano',0,300,2,easy)];
 }else{
  blocks.push(block('Calentamiento suave',warm,warm*mean(easy),2,easy));
  if(type==='interval'){
   const reps=Math.max(2,Math.min(6,4+Math.floor(week/6),Math.floor((remaining+.2)/.3))),rec=.2,goal=+p.goal.distance||10;
   const standard=goal<=5?.4:goal<=10?(phase?.key==='specific'?1:.6):goal<30?.8:1;
   const rep=Math.max(.1,Math.min(standard,planKm((remaining-rec*(reps-1))/reps))),lead=planKm(remaining-reps*rep-rec*(reps-1));
   repetitions={count:reps,workDistance:rep,recoveryDistance:rec,recoveryType:'Trote muy suave o caminar',workRange:range};
   if(lead>0)blocks.push(block('Rodaje de aproximación a las repeticiones',lead,lead*mean(easy),3,easy));
   for(let i=0;i<reps;i++){blocks.push(block(`Repetición ${i+1}/${reps} · ${rep.toLocaleString('es-ES')} km`,rep,rep*mean(range),7,range));if(i<reps-1)blocks.push(block('Recuperación · 200 m a trote suave o caminando',rec,rec*mean(m.ranges.recovery)*1.1,2,m.ranges.recovery||null));}
  }else if(type==='tempo'){
   const tempoFraction=Math.min(.7,.4+Math.floor(week/4)*.1),work=planKm(remaining*tempoFraction),lead=planKm((remaining-work)/2),tail=planKm(remaining-work-lead);
   blocks.push(block('Aproximación suave',lead,lead*mean(easy),3,easy),block('Tempo continuo · controlado, sin esprintar',work,work*mean(range),6,range),block('Rodaje suave tras el tempo',tail,tail*mean(easy),3,easy));
  }else if(type==='progressive'){
   const first=planKm(remaining*.65),last=planKm(remaining-first);blocks.push(block('Empieza cómodo y estable',first,first*mean(easy),3,easy),block('Acelera de forma gradual hasta el objetivo de este bloque',last,last*mean(range),5,range));
  }else blocks.push(block('Carrera continua cómoda',remaining,remaining*mean(range),3,range));
  blocks.push(block('Vuelta a la calma suave',cool,cool*mean(easy),2,easy));
 }
 blocks=blocks.filter(b=>b.seconds>0).map(b=>({...b,kind:blockKind(b.label)}));const timed=['walk','strength','hills'].includes(type),distance=timed?null:round(blocks.reduce((a,b)=>a+b.distance,0)),total=blocks.reduce((a,b)=>a+b.seconds,0);
 return {id:uid(),date,type,week,blocks,repetitions,distance,seconds:total,estimated:!timed,range,reference:m.reference,basePace:m.basePace,paceSource:m.source,phase,rpe:type==='interval'?7:['tempo','hills'].includes(type)?6:type==='progressive'?5:type==='strength'?4:3,hr:hrRange(p,type),hrSource:p.hrSource,hard:['tempo','interval','hills','progressive'].includes(type)||(type==='long'&&distance>=6),progression:type==='interval'?`${repetitions.count} repeticiones. Se parte de 4 y se amplía hasta 6 en bloques posteriores; no se exige correr más rápido sin nuevas referencias.`:type==='tempo'?`El bloque tempo ocupa ${Math.round(Math.min(.7,.4+Math.floor(week/4)*.1)*100)} % del bloque principal; comienza en 40 % y crece gradualmente hasta 70 %.`:type==='hills'?`Comienza con 4 subidas de 30 s y amplía repeticiones o duración por bloques, con esfuerzo controlado.`:type==='walk'?`Hoy alternas ${repetitions.workSeconds} s de carrera con ${repetitions.recoverySeconds} s caminando. El tiempo de carrera crece gradualmente.`:'La duración o distancia progresa desde tu volumen inicial, limitada por tus días, minutos disponibles y semanas de descarga. El ritmo no se acelera automáticamente por avanzar de semana.',purpose:{easy:'Construir base aeróbica con poco esfuerzo.',recovery:'Moverte con suavidad y facilitar la vuelta a la rutina.',long:'Practicar resistencia sostenida sin perseguir velocidad.',tempo:'Sostener un esfuerzo controlado; umbral estimado, no medido.',interval:'Practicar cambios de ritmo con recuperación suficiente.',hills:'Practicar técnica y fuerza de carrera en subidas suaves, sin perseguir un ritmo en pendiente.',progressive:'Aprender a terminar con control.',walk:'Construir el hábito alternando carrera y caminata.',strength:'Reforzar piernas y tronco para complementar la carrera.'}[type],conversation:['tempo','interval','hills'].includes(type)?'Frases cortas, sin llegar al máximo.':'Puedes mantener una conversación completa.',advice:type==='hills'?'Busca una cuesta regular sin tráfico. Pasos cortos, tronco estable y recuperación tranquila al bajar. Si no tienes una cuesta segura, haz carrera fácil de la misma duración.':'En calor, cuestas o caminos, manda el esfuerzo; reduce el ritmo. Detente si aparece dolor que altera la zancada.',alternative:type==='strength'?'Haz solo movilidad suave.':'Reduce la duración un 30 %, mantén conversación cómoda o descansa. No recuperes después el volumen omitido.'};
}
export function raceSession(p,plan){
 const m=metrics(p),date=p.goal.date,km=+p.goal.distance;
 const prediction=m.mark?seconds(m.mark.time)*Math.pow(km/m.mark.distance,1.06):null;
 const desired=seconds(p.goal.time),safeDesired=desired>0&&prediction&&desired>=prediction*.94&&!plan.viability?.cautious;
 const racePace=safeDesired?desired/km:prediction?prediction/km:null,range=racePace?[racePace*.98,racePace*1.04]:null;
 const review=p.pain==='relevant'||plan.viability?.cautious;
 const blocks=[{label:`Día de la carrera · ${km.toLocaleString('es-ES')} km de distancia oficial. Empieza controlado y revisa sensaciones cada kilómetro.`,kind:'main',distance:km,seconds:racePace?Math.round(km*racePace):0,effort:review?3:6,range,targetPace:racePace?Math.round(racePace):null}];
 return {id:uid(),date,type:'race',week:Math.floor(daysBetween(monday(plan.start),date)/7),distance:km,seconds:blocks[0].seconds,blocks,range,estimated:!!racePace,rpe:review?3:6,hard:true,fixedDate:true,reference:m.reference,basePace:m.basePace,hr:null,purpose:review?'Fecha de tu carrera. La participación o el tiempo deseado requieren revisión según tu base y molestias; esta anotación no prescribe competir ni confirma que sea seguro hacerlo.':'Participar en tu carrera objetivo, empezando con control y sin prometer una marca.',conversation:'Primeros kilómetros controlados; no salgas por encima del esfuerzo ensayado.',progression:'Este día sustituye cualquier entrenamiento habitual. Las 48 horas anteriores no incluyen sesiones exigentes.',advice:p.pain==='relevant'?'No tomes la salida con dolor relevante sin valorar la situación con un profesional.':review?'Valora una distancia menor, correr/caminar o posponer según tu preparación. No persigas el tiempo deseado por encima de tus sensaciones.':'Antes de salir, haz 10–15 minutos de movilidad y trote suave, si lo toleras. Ese calentamiento no está incluido en la distancia oficial. Tras la meta, camina para recuperar.',alternative:'Si hay dolor o fatiga importante, no compenses ni fuerces la participación. Revisa el objetivo.',raceNote:racePace?`${safeDesired?'Tiempo deseado compatible con la estimación':'Estimación por tu marca reciente'}: objetivo de ritmo ${pace(racePace)} min/km, con margen ${pace(range[0])}–${pace(range[1])}. No es una garantía.`:'Sin marca válida: no fijamos ritmo ni duración de carrera. Decide la participación y el esfuerzo según tu preparación.',durationUnknown:!racePace};
}
export function withRaceDay(plan,p){
 if(!plan||!p?.goal?.date||!['race','time'].includes(p.goal.type))return plan;
 const event=raceSession(p,plan),old=plan.sessions.find(s=>s.date===event.date);if(old)event.id=old.id;
 const sessions=plan.sessions.filter(s=>s.date!==event.date).map(s=>{
  if(s.date<event.date&&daysBetween(s.date,event.date)<=2&&s.hard){const easy=session(p,'easy',s.date,s.distance||0,0,s.week);if(s.distance===null)return {...s,type:'rest',distance:null,seconds:0,blocks:[],hard:false,rpe:0,range:null,hr:null,purpose:'Descanso previo a la carrera.',progression:'Pausa antes del objetivo.'};return {...easy,id:s.id};}
  return s;
 });return {...plan,engineVersion:2,sessions:[...sessions,event].sort((a,b)=>a.date.localeCompare(b.date))};
}
export function upgradeRaceDay(state){
 const p=state.profile,plan=state.plan;if(!plan||!p?.goal?.date||!['race','time'].includes(p.goal.type))return state;
 if(plan.sessions.some(s=>s.date===p.goal.date&&s.type==='race'))return state;
 const next=withRaceDay(plan,p);return {...state,plan:next,proposals:state.proposals.map(v=>v.status==='pending'?{...v,status:'superseded'}:v),changes:[{id:uid(),date:new Date().toISOString(),type:'Día de carrera corregido',reason:'La fecha objetivo sustituye la sesión habitual. Las 48 horas anteriores quedan sin sesiones exigentes.',before:plan,after:next},...state.changes]};
}
export function generate(p,start=today()){
 const viable=feasibility(p,start), m=metrics(p,start),end=p.goal.date||addDays(start,83), selected=[...p.days].sort((a,b)=>((a+6)%7)-((b+6)%7));
 let chosen=selected.slice(0,+p.trainingDays);if(selected.includes(+p.longDay)&&!chosen.includes(+p.longDay))chosen=[...chosen.slice(0,-1),+p.longDay].sort((a,b)=>((a+6)%7)-((b+6)%7));
 const sessions=[];const base=+p.weeklyKm||0;const beginner=p.experience==='beginner'||base<8;let peak=base*(p.pain!=='none'?.6:1);
 for(let w=0;w<=Math.floor(daysBetween(monday(start),end)/7);w++){
 const weekStart=addDays(monday(start),w*7);const phase=trainingPhase(p,weekStart,w,start),unload=phase.key==='deload',taper=phase.key==='taper';
 if(w>0&&!unload&&!taper&&p.pain==='none')peak=Math.min(base*(+p.goal.distance>=20?1.4:1.25),peak+Math.min(1,Math.max(.25,base*.04)));let target=peak*(unload?.8:taper?.6:1);
 const slots=chosen.map(d=>({d,date:addDays(weekStart,(d+6)%7)})).filter(x=>x.date>=start&&x.date<=end);const fullCount=chosen.length;
 for(const {d,date} of slots){const long=d===+p.longDay;const weights=chosen.map(x=>x===+p.longDay?1.4:1),share=(long?1.4:1)/weights.reduce((a,b)=>a+b,0);let km=round(target*share);
 let type=long&&fullCount>=3?'long':'easy';const previousHard=sessions.filter(s=>s.hard).at(-1);const distanceToLong=Math.min(...slots.filter(s=>s.d===+p.longDay).map(s=>Math.abs(daysBetween(date,s.date))).concat(99));
 if(!beginner&&base>=12&&p.pain==='none'&&w>=1&&!unload&&!taper&&!long&&fullCount>=3&&distanceToLong>=2&&(!previousHard||daysBetween(previousHard.date,date)>=2)&&!sessions.some(s=>s.week===w&&['tempo','interval','hills','progressive'].includes(s.type)))type=qualityType(p,phase,w);
 const meanEasy=m.ranges.easy?(m.ranges.easy[0]+m.ranges.easy[1])/2:(seconds(p.easyPace)||420);const capacity=(+p.minutes[d]*60)/meanEasy;km=Math.min(km,planKm(capacity));if(long){const initial=p.longest?+p.longest:Math.max(2,base/fullCount),goal=+p.goal.distance||10,cap=goal>=40?32:goal>=20?18:goal>=10?Math.max(initial,10):Math.max(initial,7),growth=Math.min(.5,base*.025)*w;const longCap=Math.min(cap,initial+growth)*(unload?.8:taper?.6:1);km=Math.min(km,longCap);}km=planKm(km);
 let s;if(base<5||p.goal.type==='start')s=session(p,'walk',date,0,Math.min(+p.minutes[d],20+Math.floor(w/2)*3)*(unload?.8:1),w);else {if(km<2&&['interval','tempo','progressive'].includes(type))type='easy';s=session(p,type,date,km,type==='hills'?Math.min(+p.minutes[d],Math.max(20,km*meanEasy/60)):0,w,phase);if(s.hard&&previousHard&&daysBetween(previousHard.date,date)<2)s=session(p,'easy',date,km,0,w);if(s.seconds>+p.minutes[d]*60){s=session(p,'easy',date,planKm(km*.85),0,w,phase);while(s.seconds>+p.minutes[d]*60&&s.distance>.1)s=session(p,'easy',date,planKm(s.distance-.1),0,w,phase);}}
 if(p.pain==='relevant')s={...s,type:'rest',distance:null,seconds:0,blocks:[],hard:false,range:null,hr:null,rpe:0,purpose:'Pausa por molestias relevantes. Valora la situación con un profesional antes de retomar.',conversation:'No se prescribe carrera.',alternative:'Mantén la pausa y revisa las molestias.',advice:'El plan no autoriza volver a correr con dolor.'};sessions.push(s);}
 if(p.strength&&p.pain!=='relevant'&&p.days.includes(+p.strengthDay)&&!chosen.includes(+p.strengthDay)){const date=addDays(weekStart,(+p.strengthDay+6)%7);if(date>=start&&date<=end&&+p.minutes[p.strengthDay]>=25)sessions.push(session(p,'strength',date,0,25,w));}
 }
 const result=withRaceDay({structureVersion:4,id:uid(),created:start,start,end,sessions:sessions.sort((a,b)=>a.date.localeCompare(b.date)),method:m.method,missing:m.missing,viability:viable,reference:m.mark?null:beginner?'En una sesión suave, registra 15–20 minutos de correr y caminar con esfuerzo 3/10. Úsala como referencia de duración, sin exigir una marca.':'Tras 2–3 semanas cómodas, registra 20 minutos suaves en terreno llano, esfuerzo 3/10. No es una prueba máxima ni estima por sí sola tu umbral.',rules:['El volumen inicial parte de los kilómetros declarados y se limita por minutos disponibles y tirada reciente.','La progresión nominal suma el menor entre 1 km y el 4 % del volumen inicial (mínimo 0,25 km), con descarga cada cuarta semana; no es una regla universal. Dolor actual impide progresar.','Una sola sesión de calidad por semana, con base ≥12 km y experiencia regular; sin marca reciente se prescribe por esfuerzo, no por ritmo; alternancia de tempo, intervalos, cuestas y progresivos. Al menos 48 h entre sesiones exigentes.','El ciclo cambia según distancia y semanas disponibles: base, desarrollo, trabajo específico, descargas y puesta a punto (7 días para 5/10 km, 10 para media y 14 para maratón). No se acumulan sesiones perdidas.','Las duraciones de sesiones por distancia son estimaciones; caminar, cuestas y fuerza se prescriben por tiempo.','Una carrera mejor de lo esperado es una señal; se necesitan al menos tres sesiones comparables sin molestias y con poca fatiga para proponer una subida.']},p);
 return {...result,racePreparation:{distance:+p.goal.distance,totalWeeks:round(daysBetween(start,end)/7),initialWeeklyKm:base,initialLong:+p.longest||null,desiredPace:p.goal.time&&+p.goal.distance?seconds(p.goal.time)/+p.goal.distance:null,paceSource:m.source,description:'La distancia objetivo determina el tamaño de las repeticiones y la progresión larga; los días hasta la carrera determinan las fases y la puesta a punto. El tiempo deseado es una meta, no una medición de tu nivel.'},qualitySummary:qualitySummary(p,result)};
}
export function validateActivity(a){
 const errors=[];if(!/^\d{4}-\d{2}-\d{2}$/.test(a.date||'')||Number.isNaN(dateObj(a.date).getTime())||dateObj(a.date).toISOString().slice(0,10)!==a.date||a.date>today())errors.push('Introduce una fecha real que no sea futura.');if(!(Number.isFinite(a.distance)&&a.distance>0&&a.distance<=200))errors.push('Introduce una distancia mayor que 0 y hasta 200 km.');if(!(Number.isFinite(a.seconds)&&a.seconds>0&&a.seconds<=172800))errors.push('Duración válida: mm:ss o hh:mm:ss, hasta 48 horas.');
 const calculated=a.seconds/a.distance;if(a.manualPace&&(!Number.isFinite(seconds(a.manualPace))||Math.abs(seconds(a.manualPace)-calculated)>5))errors.push('El ritmo introducido no coincide con tiempo ÷ distancia (tolerancia de 5 s/km).');
 if(a.avgHR&&a.maxHR&&+a.avgHR>+a.maxHR)errors.push('Las pulsaciones medias no pueden superar las máximas.');if(!(a.rpe>=1&&a.rpe<=10))errors.push('El esfuerzo debe estar entre 1 y 10.');
 for(const l of a.laps||[])if(!(l.distance>0&&l.seconds>0)||!Number.isFinite(+l.recoverySeconds)||l.recoverySeconds<0)errors.push('Cada vuelta necesita distancia y tiempo positivos, y recuperación válida.');
 if((a.laps||[]).length){if(a.laps.reduce((x,l)=>x+l.distance,0)>+a.distance+.01)errors.push('Las distancias de las vueltas superan la distancia total.');if(a.laps.reduce((x,l)=>x+l.seconds+(+l.recoverySeconds||0),0)>a.seconds)errors.push('El tiempo de vueltas y recuperaciones supera la duración total.');}
 return errors;
}
export function analyze(a,s){
 const context=(a.temperature>=25||a.terrain==='trail')?'El calor o el terreno pueden explicar parte de la diferencia de ritmo. ':'';
 const high=+a.rpe>(s?.rpe??3)+2||+a.fatigue>=7||a.feeling==='mal', pain=a.pain==='relevant';const dk=s?.distance?round(a.distance-s.distance):null,dt=s?Math.round((a.seconds-s.seconds)/60):null;
 const sameType=!s||a.type===s.type;let purpose=!s?'Carrera sin sesión vinculada: no podemos comprobar el propósito previsto.':high?'El esfuerzo declarado fue mayor que el previsto; podría haber resultado más exigente.':!sameType?'El tipo realizado difiere del previsto; revisa si mantuviste el propósito de la sesión.':'El esfuerzo declarado es compatible con el propósito previsto.';
 if(s?.distance&&Math.abs(dk)/s.distance>.25)purpose+=' La distancia se aparta más de un 25 % de la prevista.';
 const actualPace=a.seconds/a.distance, paceMismatch=s?.range?(actualPace<s.range[0]?'Más rápido que el rango orientativo.':actualPace>s.range[1]?'Más lento que el rango orientativo.':'Dentro del rango orientativo.'): 'Sin rango de ritmo fiable: utiliza esfuerzo y conversación.';
 return {purpose,context,deltaKm:dk,deltaMinutes:dt,paceMismatch,action:pain?'revisar':high?'reducir':'mantener',reason:pain?'Has indicado dolor relevante. Pausa la siguiente carrera y valora la situación con un profesional antes de retomar.':high?'Tus sensaciones sugieren que conviene reducir la próxima carrera un 30 % y sustituir calidad por rodaje suave. No podemos confirmar tu estado de recuperación.':a.performance==='better'?'Has declarado que fue mejor de lo esperado. Revisaremos si hay suficientes sesiones comparables para proponer una subida; una carrera aislada no basta.':'Mantén el plan y revisa sensaciones antes de la siguiente sesión. Una carrera rápida aislada no justifica subir la carga.'};
}
export function progressEvidence(a,plan,p,history=[],previousProposals=[]){
 if(!p||p.pain!=='none'||p.experience==='beginner'||+p.weeklyKm<12||a.performance!=='better')return {count:0,eligible:false,reason:'Una sola carrera o una base insuficiente no justifica aumentar carga.'};
 const used=new Set(previousProposals.filter(v=>v.status==='accepted'&&v.direction==='increase').flatMap(v=>v.evidenceIds||[]));
 const all=[...history.filter(v=>v.id!==a.id),a];
 const candidates=all.filter(v=>{
  const s=plan?.sessions.find(s=>s.id===v.sessionId);
  return !used.has(v.id)&&v.date<=a.date&&daysBetween(v.date,a.date)<=21&&['easy','recovery','long'].includes(v.type)&&v.type===a.type&&s?.type===v.type&&s.range&&v.distance>0&&s.distance>0&&Math.abs(v.distance-s.distance)/s.distance<=.2&&v.rpe<=s.rpe&&v.fatigue<=4&&v.pain==='none'&&v.feeling!=='mal'&&v.terrain&&v.terrain===a.terrain&&((v.temperature!=null&&a.temperature!=null&&Math.abs(v.temperature-a.temperature)<=5)||(v.temperature==null&&a.temperature==null))&&v.seconds/v.distance<=((s.range[0]+s.range[1])/2)*.97;
 }).sort((x,y)=>y.date.localeCompare(x.date));
 const distinct=candidates.filter((v,i)=>candidates.findIndex(x=>x.date===v.date)===i).slice(0,3);
 const unsafe=all.some(v=>v.date<=a.date&&daysBetween(v.date,a.date)<=7&&(v.pain!=='none'||v.fatigue>=7||v.feeling==='mal'));
 const taper=plan?.end&&['race','time'].includes(p.goal.type)&&daysBetween(a.date,plan.end)<=14;
 return {count:distinct.length,eligible:distinct.length>=3&&!unsafe&&!taper,activities:distinct,reason:unsafe?'Hay señales recientes de molestias o fatiga: no recomendamos aumentar.':taper?'Estás en las dos semanas previas a la carrera: mantén la descarga.':distinct.length<3?`Has indicado una carrera mejor de lo esperado. Tenemos ${distinct.length}/3 sesiones comparables recientes con esfuerzo controlado y poca fatiga; por ahora mantenemos la carga.`:'Tres sesiones comparables en los últimos 21 días han resultado al menos un 3 % más rápidas que su objetivo orientativo, sin mayor esfuerzo declarado.'};
}
export function proposal(a,plan,p,history=[],previousProposals=[]){
 const s=plan?.sessions.find(s=>s.id===a.sessionId),analysis=analyze(a,s),evidence=progressEvidence(a,plan,p,history,previousProposals);
 if(analysis.action==='mantener'){
  if(!evidence.eligible)return null;
  const eligible=plan.sessions.filter(v=>v.date>a.date&&v.date>today()&&daysBetween(a.date,v.date)<=14&&!v.skipped&&['easy','long','tempo','interval','progressive'].includes(v.type)&&(!p.goal.date||!['race','time'].includes(p.goal.type)||daysBetween(v.date,p.goal.date)>14)).slice(0,3);
  const changes=eligible.map(before=>{
   let after;
   if(['tempo','interval','progressive'].includes(before.type)){
    if(!before.range)return null;const blocks=before.blocks.map(b=>b.effort>=5&&b.range?{...b,range:b.range.map(n=>n*.98),targetPace:Math.round(b.targetPace*.98),seconds:Math.round(b.seconds*.98)}:b);
    after={...before,blocks,range:before.range.map(n=>n*.98),seconds:blocks.reduce((n,b)=>n+b.seconds,0),progression:'Ajuste aceptable por tres sesiones comparables: objetivo de ritmo de calidad aproximadamente un 2 % más rápido, sin añadir repeticiones ni distancia.',reference:before.reference+' Calibración orientativa propuesta a partir de tres carreras comparables; no es un umbral medido.'};
   }else{
    if(!before.distance)return null;const target=round(before.distance*1.05);
    if(before.type==='long'&&p.longest&&target>+p.longest+Math.min(before.week*.25,2))return null;
    after=session(p,before.type,before.date,target,0,before.week);after.id=before.id;after.progression='Propuesta: hasta un 5 % más de distancia en esta sesión, manteniendo su ritmo fácil.';
    if(after.seconds>+p.minutes[day(before.date)]*60)return null;
   }
   return {sessionId:before.id,before,after};
  }).filter(Boolean);
  if(!changes.length)return null;
  return {id:uid(),activityId:a.id,created:today(),direction:'increase',evidenceIds:evidence.activities.map(v=>v.id),changes,sessionId:changes[0].sessionId,before:changes[0].before,after:changes[0].after,reason:evidence.reason+' Proponemos un pequeño aumento en las próximas sesiones: hasta un 5 % de distancia fácil o un 2 % de ritmo de calidad, sin añadir días ni intensidad consecutiva. Es una inferencia, no una confirmación de mejora física.'+(a.temperature==null?' La temperatura es desconocida; la comparación tiene esa limitación.':''),status:'pending'};
 }
 const next=plan?.sessions.find(v=>v.date>a.date&&v.date>today()&&!v.skipped&&!['strength','rest','race'].includes(v.type));if(!next)return null;
 let after=analysis.action==='revisar'?{...next,type:'rest',distance:null,seconds:0,blocks:[],hard:false,rpe:0,purpose:'Pausa por dolor relevante. Revisar con un profesional.',range:null,hr:null}:session(p,next.type==='walk'?'walk':'recovery',next.date,round((next.distance||0)*.7),next.seconds/60*.7,next.week);
 if(next.type==='hills'&&analysis.action!=='revisar')after=session(p,'walk',next.date,0,Math.max(15,next.seconds/60*.7),next.week);
 after.id=next.id;return {id:uid(),activityId:a.id,created:today(),sessionId:next.id,before:next,after,reason:analysis.reason,status:'pending'};
}
export function moveSession(plan,id,date,p){const s=plan.sessions.find(s=>s.id===id);if(!s)throw Error('No se encuentra la sesión.');if(s.type==='race')throw Error('La carrera tiene fecha fija. Para cambiarla, edita el objetivo y regenera el plan.');if(date<today()||date<plan.start||date>plan.end)throw Error('Elige una fecha futura dentro del plan.');if(!p.days.includes(day(date)))throw Error('Ese día no figura como disponible en tu perfil.');if(s.hard&&plan.sessions.some(v=>v.type==='race'&&date<v.date&&daysBetween(date,v.date)<=2))throw Error('Las 48 horas anteriores a la carrera se reservan sin entrenamientos exigentes.');if(plan.sessions.some(v=>v.id!==id&&v.date===date))throw Error('Ya hay una sesión ese día. No acumulamos entrenamientos.');if(s.seconds>+p.minutes[day(date)]*60)throw Error('La sesión supera el tiempo disponible de ese día.');if(s.hard&&plan.sessions.some(v=>v.id!==id&&v.hard&&Math.abs(daysBetween(v.date,date))<2))throw Error('Deja al menos 48 horas entre sesiones exigentes.');return {...plan,sessions:plan.sessions.map(v=>v.id===id?{...v,date,week:Math.floor(daysBetween(monday(plan.start),date)/7)}:v).sort((a,b)=>a.date.localeCompare(b.date))};}
export function coach(question,state){const q=question.toLowerCase(),p=state.profile,plan=state.plan;if(/chatgpt|inteligencia artificial|\bia\b|conectad[oa]|modelo de lenguaje/.test(q))return 'Este chat de la página funciona con reglas locales y no está conectado directamente a ChatGPT. Para una respuesta de IA, usa «Consultar con mi ChatGPT»: copia tu consulta y contexto, abre ChatGPT y pégalos. También puedes usar el plugin de Zancada desde ChatGPT si sus herramientas están disponibles allí. No puedo comprobar desde esta página si el plugin está conectado. No se ha enviado esta pregunta a ninguna IA.';if(!p||!plan)return 'Crea tu perfil y genera un plan para que pueda responder con tus datos.';const next=plan.sessions.find(s=>s.date>=today()&&!s.skipped&&!state.activities.some(a=>a.sessionId===s.id));if(/dolor|lesi[oó]n|molest/.test(q)||p.pain==='relevant')return 'Con dolor relevante, pausa la carrera y consulta con un profesional. No puedo diagnosticar una lesión ni confirmar que sea seguro correr. Tu plan no debe aumentar intensidad con estas molestias.';if(/mejor|progres|exigen|rápid|rapido/.test(q)){const last=[...state.activities].sort((a,b)=>b.date.localeCompare(a.date))[0];return last?progressEvidence({...last,performance:'better'},plan,p,state.activities,state.proposals).reason+' Al registrar tu carrera, marca «Mejor de lo esperado». Las propuestas se revisan en Historial.':'Registra carreras y sensaciones para valorar la progresión; no aumentamos la carga solo por una carrera rápida.';}if(/cans|fatiga|descans/.test(q))return next?`La próxima sesión es ${TYPES[next.type]}, el ${next.date}, de ${next.distance?next.distance+' km':Math.round(next.seconds/60)+' min'}. Si estás cansado: ${next.alternative} Es una recomendación según tus datos, no una medición de recuperación. Los cambios se revisan antes de aplicarlos.`:'No hay sesiones futuras. Revisa tu objetivo.';if(/s[aá]bado|cambi|mover|reorgan/.test(q))return `Tu tirada larga está prevista preferentemente el ${DAYS[+p.longDay].toLowerCase()}. ${p.days.includes(6)?'El sábado está disponible.':'El sábado no está disponible: edita el perfil primero.'} Abre el detalle en Mi plan y elige Reorganizar. Se comprueba el tiempo disponible y 48 horas entre sesiones exigentes, sin acumular entrenamientos.`;if(/perd|salt|no pude/.test(q))return 'Marca la sesión como omitida desde Mi plan. No compenses acumulando intensidad; continúa con la siguiente o reorganiza respetando la recuperación.';if(!/hoy|pr[oó]xim|sesi[oó]n|entrenamiento|plan|ritmo/.test(q))return 'Este asistente local responde sobre la próxima sesión, cansancio, dolor, sesiones perdidas y cambios de día. Para otras preguntas, utiliza «Consultar con mi ChatGPT» arriba. No voy a sustituir tu pregunta por una explicación de la próxima sesión.';return next?`Tu siguiente sesión es ${TYPES[next.type]} (${next.date}). Propósito: ${next.purpose} Esfuerzo ${next.rpe}/10. ${next.conversation} ${plan.method} Puedo orientarte sobre cansancio, dolor, sesiones perdidas y cambios de día; no interpreto preguntas fuera de esas reglas como una evaluación clínica.`:'Tu plan ha terminado. Actualiza el objetivo para generar otro.';}

// A record is always shown on its real date. A plan link is separate from that date.
export function findActivitySession(a,plan,activities=[]){
 const sessions=plan?.sessions||[];
 if(a.linkMode==='none')return null;
 if(a.sessionId){const linked=sessions.find(s=>s.id===a.sessionId);if(linked)return linked;}
 if(a.linkMode==='manual')return null;
 const available=sessions.filter(s=>s.date===a.date&&!['rest','strength'].includes(s.type)&&!activities.some(v=>v.id!==a.id&&v.sessionId===s.id));
 return available.length===1?available[0]:null;
}
export function analysisForActivity(a,state){
 const s=state.plan?.sessions.find(s=>s.id===a.sessionId)||a.plannedSnapshot;
 const base=analyze(a,s),progress=a.performance==='better'?progressEvidence(a,state.plan,state.profile,state.activities,state.proposals).reason:null;
 const pending=state.proposals.find(v=>v.activityId===a.id&&v.status==='pending');
 return {...base,progress,decision:pending?'Hay un ajuste pendiente. Revísalo y acéptalo para modificar las próximas sesiones.':base.action==='mantener'?'Plan mantenido: el registro completa tu sesión, pero no cambia automáticamente el tipo de las siguientes.':state.proposals.some(v=>v.activityId===a.id&&v.status==='accepted')?'El ajuste de esta carrera ya se aceptó y está en el historial.':'No hay una próxima sesión modificable o un ajuste pendiente. Revisa tu objetivo si el plan ha terminado.'};
}
export function recordActivity(state,activity){
 const errors=validateActivity(activity);if(errors.length)throw Error(errors.join(' '));
 if((state.activities||[]).some(v=>v.id!==activity.id&&v.date===activity.date&&Math.abs(v.distance-activity.distance)<=.05&&Math.abs(v.seconds-activity.seconds)<=10))throw Error('Ya tienes una carrera con la misma fecha, distancia y duración. Edita ese registro en lugar de duplicarlo.');
 const linked=findActivitySession(activity,state.plan,state.activities);
 if(linked?.date>today())throw Error('No puedes completar una sesión futura. Reorganízala primero.');
 if(activity.linkMode==='manual'&&activity.sessionId&&!linked)throw Error('La sesión elegida ya no está en el plan. Selecciona otra o usa la vinculación por fecha.');
 if(linked&&state.activities.some(v=>v.id!==activity.id&&v.sessionId===linked.id))throw Error('Esta sesión ya tiene una carrera vinculada. Edita esa carrera o elige otra sesión.');
 const a={...activity,sessionId:linked?.id||'',linkMode:activity.linkMode||'auto',plannedSnapshot:linked||activity.plannedSnapshot||null};
 const prop=proposal(a,state.plan,state.profile,state.activities,state.proposals);
 const next={...state,activities:[...state.activities.filter(v=>v.id!==a.id),a].sort((x,y)=>y.date.localeCompare(x.date)),proposals:[...state.proposals.filter(v=>v.activityId!==a.id||v.status!=='pending'),...(prop?[prop]:[])]};
 const adjusted=applyConservativeProposal(next,prop);a.analysis=analysisForActivity(a,adjusted);return {state:adjusted,activity:a,proposal:prop};
}
export function repairActivityLinks(state){
 if(!state.plan)return state;let updated=state,changed=false;
 const activities=[];
 for(const original of state.activities){
  const linked=findActivitySession(original,state.plan,[...activities,...state.activities.filter(v=>v.id!==original.id)]);
  if(!linked||original.sessionId===linked.id){activities.push(original);continue;}
  changed=true;activities.push({...original,sessionId:linked.id,linkMode:original.linkMode||'auto',plannedSnapshot:linked});
 }
 if(!changed)return state;
 updated={...state,activities,changes:[{id:uid(),date:new Date().toISOString(),type:'Carreras vinculadas al calendario',reason:'Se han vinculado los registros existentes con una única sesión de su misma fecha. Los días sin sesión se muestran como carreras adicionales.',before:null,after:null},...state.changes]};
 for(const a of activities){if(state.activities.find(v=>v.id===a.id)?.sessionId===a.sessionId)continue;const prop=proposal(a,updated.plan,updated.profile,activities,updated.proposals);if(prop&&!updated.proposals.some(v=>v.activityId===a.id&&v.status==='pending'))updated.proposals=[...updated.proposals,prop];}
 return updated;
}
export function regeneratePlan(state,start=today()){
 const generated=generate(state.profile,start),old=state.plan;
 if(!old)return generated;
 const preserved=old.sessions.filter(s=>s.date<start||state.activities.some(a=>a.sessionId===s.id));
 const dates=new Set(preserved.map(s=>s.date));
 return {...generated,start:old.start<generated.start?old.start:generated.start,sessions:[...preserved,...generated.sessions.filter(s=>!dates.has(s.date)).map(s=>{const previous=old.sessions.find(v=>v.date===s.date);return previous?{...s,id:previous.id}:s;})].sort((a,b)=>a.date.localeCompare(b.date))};
}

export function qualitySummary(p,plan){
 const types=['tempo','interval','hills','progressive'],quality=(plan?.sessions||[]).filter(s=>types.includes(s.type)&&!s.skipped),m=metrics(p);
 const reasons=[];
 if(p.experience==='beginner'||+p.weeklyKm<8||p.goal.type==='start')reasons.push('Nivel de iniciación: priorizamos un plan sencillo de carrera cómoda o correr/caminar.');
 if(+p.weeklyKm<12)reasons.push('Menos de 12 km semanales actuales: construye primero una base cómoda y estable.');
 if(p.pain!=='none')reasons.push('Has indicado molestias: no se programa trabajo exigente.');
 if(+p.trainingDays<3)reasons.push('Con menos de tres días, se prioriza constancia y recuperación.');
 if(!reasons.length&&!quality.length)reasons.push('No hay huecos adecuados en este periodo con 48 horas de separación y tiempo suficiente; también se omite calidad en descarga y en las dos semanas previas a la carrera.');
 return {count:quality.length,byType:Object.fromEntries(types.map(t=>[t,quality.filter(s=>s.type===t).length])),firstTempo:quality.find(s=>s.type==='tempo')?.date||null,firstInterval:quality.find(s=>s.type==='interval')?.date||null,reasons,method:m.method,schedule:'Una sesión de calidad por semana normal desde la segunda semana. La distancia objetivo y la fase deciden si se usa tempo, intervalos, cuestas o progresivos; se reduce carga en descarga y puesta a punto.'};
}

// Mirrors the conditions used by generate(), so the explanation matches the calendar.
export function qualityEligibility(p,plan){
 const base=+p.weeklyKm||0,days=Math.min(+p.trainingDays||0,(p.days||[]).length),walkMode=base<5||p.goal?.type==='start',beginner=p.experience==='beginner'||base<8;
 const count=t=>(plan?.sessions||[]).filter(s=>s.type===t&&!s.skipped).length;
 const qualityBlock=walkMode?'Primero alternas carrera y caminata hasta correr de forma continua con comodidad.':p.pain!=='none'?'Has indicado molestias: no programamos intensidad hasta que desaparezcan.':beginner?`Nivel de iniciación${base<8?` (${base} km/semana)`:''}: la intensidad llegará cuando sostengas al menos 12 km semanales cómodos.`:base<12?`Tu base es de ${base} km/semana; la intensidad se incorpora a partir de 12 km semanales cómodos.`:days<3?'Con menos de tres días de carrera, cada sesión se dedica a construir base y constancia.':null;
 const when='Revisa el plan cuando registres tres semanas completas con esa base, sin molestias.';
 const purpose={easy:'Base aeróbica con poco esfuerzo; es la mayor parte del plan.',long:'Resistencia: la sesión más larga de la semana, a ritmo cómodo.',tempo:'Esfuerzo continuo y controlado para sostener ritmos más rápidos.',interval:'Repeticiones más rápidas con recuperación, para trabajar cambios de ritmo.',hills:'Subidas cortas por esfuerzo para técnica y fuerza de carrera.',progressive:'Terminar más rápido de lo que empiezas, con control.',walk:'Alternar carrera y caminata para construir el hábito con seguridad.',strength:'Ejercicios de fuerza que complementan la carrera.'};
 const row=(type,blocked,hint)=>{const n=count(type);return {type,count:n,included:n>0,reason:n?purpose[type]:blocked||hint};};
 return [
  row('walk',null,'Ya puedes correr de forma continua; no necesitas alternar con caminata.'),
  row('easy',walkMode?'Todavía alternas carrera y caminata; la carrera continua llega de forma gradual.':null,'Sin huecos disponibles.'),
  row('long',walkMode?'Antes de una tirada larga necesitas correr de forma continua.':days<3?'Con menos de tres días de carrera no separamos una tirada larga; tus sesiones ya cubren la resistencia.':null,'Sin hueco para tirada larga en este periodo.'),
  ...['tempo','interval','progressive','hills'].map(t=>row(t,qualityBlock?`${qualityBlock} ${when}`:null,t==='hills'&&p.terrain==='treadmill'?'Entrenas en cinta: sustituimos las cuestas por progresivos.':'La fase actual del plan, las semanas de descarga y la puesta a punto no dejan hueco para este tipo; aparece en otras fases o con más semanas.')),
  row('strength',null,p.strength?'Tu día de fuerza coincide con un día de carrera o tiene menos de 25 minutos.':'No has activado la fuerza complementaria en tu perfil.')
 ];
}
export function validateStateShape(state){
 const errors=[];if(!state||typeof state!=='object')return ['Datos inválidos.'];
 for(const key of ['activities','changes','proposals'])if(!Array.isArray(state[key]))errors.push(`Falta la lista ${key}.`);if(errors.length)return errors;
 const unique=(items,label)=>{const ids=items.map(v=>v?.id);if(ids.some(id=>typeof id!=='string'||!id))errors.push(`Hay ${label} sin identificador.`);else if(new Set(ids).size!==ids.length)errors.push(`Hay ${label} duplicados.`);};
 unique(state.activities,'registros de carrera');
 if(state.activities.some(a=>!/^\d{4}-\d{2}-\d{2}$/.test(a?.date||'')))errors.push('Hay registros de carrera sin una fecha válida.');
 const links=state.activities.map(a=>a.sessionId).filter(Boolean);if(new Set(links).size!==links.length)errors.push('Una sesión del plan tiene más de una carrera vinculada.');
 if(state.plan!=null){if(!Array.isArray(state.plan.sessions))errors.push('El plan no tiene sesiones.');else{unique(state.plan.sessions,'sesiones del plan');if(state.plan.sessions.some(s=>!/^\d{4}-\d{2}-\d{2}$/.test(s?.date||'')))errors.push('Hay sesiones sin una fecha válida.');}}
 if(state.profile?.timezone!=null&&!validTimeZone(state.profile.timezone))errors.push('Zona horaria no válida.');
 return errors;
}
export function trainingPhase(p,date,week,start){
 const goal=+p.goal.distance||10,remaining=p.goal.date?daysBetween(date,p.goal.date):999,total=p.goal.date?Math.max(1,daysBetween(start,p.goal.date)/7):12;
 const taperDays=goal>=40?14:goal>=20?10:7;
 if(p.goal.date&&['race','time'].includes(p.goal.type)&&remaining<=taperDays)return {key:'taper',label:'Puesta a punto',reason:`Reducimos volumen en los últimos ${taperDays} días antes de ${goal} km.`};
 if(week>0&&week%4===3)return {key:'deload',label:'Descarga',reason:'Menos volumen y carrera cómoda para dar margen a recuperar.'};
 if(week<Math.max(1,Math.floor(total*.2)))return {key:'base',label:'Base',reason:'Adaptación inicial desde tu volumen real.'};
 if(p.goal.date&&remaining<=Math.max(taperDays+7,Math.floor(total*.4)*7))return {key:'specific',label:'Trabajo específico',reason:`Bloques orientados a sostener el esfuerzo de ${goal} km, sin forzar el tiempo deseado.`};
 return {key:'build',label:'Desarrollo',reason:'Desarrollar resistencia y esfuerzo controlado de forma gradual.'};
}
export function qualityType(p,phase,week){
 const goal=+p.goal.distance||10;
 if(['routine','start','nonstop'].includes(p.goal.type))return (p.terrain==='treadmill'?['progressive','tempo','interval']:['progressive','tempo','interval','hills'])[Math.max(0,week-Math.floor((week+1)/4)-1)%(p.terrain==='treadmill'?3:4)];
 if(phase.key==='base')return p.terrain==='treadmill'?'progressive':'hills';
 if(goal<=5)return week%2?'tempo':'interval';
 if(goal<=10&&p.goal.date)return week%2?'tempo':'interval';
 if(goal<=10)return phase.key==='specific'?(week%2?'tempo':'interval'):['progressive','tempo','interval','tempo'][week%4];
 if(goal<30)return ['tempo','interval','tempo','progressive'][week%4];
 return ['progressive','tempo','progressive','interval'][week%4];
}

// Automatic adjustments require an explicit preference and can only reduce future load.
export function applyConservativeProposal(state,v,start=today()){
 if(!state.settings?.autoConservative||!v||v.direction==='increase'||v.status!=='pending')return state;
 const edits=v.changes||[{sessionId:v.sessionId,before:v.before,after:v.after}];
 if(edits.some(e=>e.before.date<=start||e.before.type==='race'||e.after.hard||e.after.seconds>e.before.seconds||(e.after.distance||0)>(e.before.distance||0)||JSON.stringify(state.plan?.sessions.find(s=>s.id===e.sessionId))!==JSON.stringify(e.before)))return state;
 const changes=edits.map(e=>({id:uid(),date:new Date().toISOString(),type:'Ajuste conservador automático',reason:v.reason,before:e.before,after:e.after,proposalId:v.id}));
 return {...state,plan:{...state.plan,sessions:state.plan.sessions.map(s=>edits.find(e=>e.sessionId===s.id)?.after||s)},proposals:state.proposals.map(p=>p.id===v.id?{...p,status:'accepted',automatic:true}:p),changes:[...changes,...state.changes]};
}
export function undoPlanChange(state,id,start=today()){
 const change=state.changes.find(c=>c.id===id);if(!change?.before?.date||!change.after?.id)throw Error('Este cambio no corresponde a una sesión reversible.');
 const current=state.plan?.sessions.find(s=>s.id===change.after.id);
 if(change.before.date<=start||change.after.date<=start||change.before.type==='race'||state.activities.some(a=>a.sessionId===current?.id))throw Error('Solo puedes deshacer cambios de sesiones futuras pendientes.');
 if(JSON.stringify(current)!==JSON.stringify(change.after))throw Error('La sesión tiene cambios posteriores. Revisa el calendario antes de deshacer.');
 if(change.before.hard&&state.plan.sessions.some(s=>s.id!==current.id&&s.hard&&Math.abs(daysBetween(s.date,change.before.date))<2))throw Error('Deshacer dejaría sesiones exigentes con menos de 48 horas de separación.');
 return {...state,plan:{...state.plan,sessions:state.plan.sessions.map(s=>s.id===current.id?change.before:s)},changes:[{id:uid(),date:new Date().toISOString(),type:'Cambio deshecho',reason:'Has restaurado la sesión anterior desde el historial.',before:change.after,after:change.before,undoOf:id},...state.changes],proposals:state.proposals.map(v=>v.id===change.proposalId?{...v,status:'undone'}:v)};
}
