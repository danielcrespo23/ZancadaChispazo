export function timedSession({id,p,type,date,minutes,week,phase,reference,source}){
 const limit=Math.max(0,Math.floor(minutes*60)),warm=Math.min(300,Math.floor(limit*.2)),cool=warm,main=limit-warm-cool;
 const requestedType=type;
 if(type==='interval'&&main<480||['tempo','progressive'].includes(type)&&main<180)type='easy';
 const block=(label,seconds,effort,kind,role=null)=>({label,seconds,distance:0,effort,kind,role,durationType:'prescribed',range:null,targetPace:null,paceSource:source});
 const blocks=[block('Calentamiento suave',warm,2,'warmup')];let repetitions=null;
 if(type==='interval'&&main>=480){
  const work=60+Math.min(60,Math.floor(week/3)*30),recovery=90,count=Math.min(6,Math.floor((main+recovery)/(work+recovery)));
  repetitions={count,workSeconds:work,recoverySeconds:recovery,recoveryCount:count-1,recoveryPlacement:'between',recoveryType:'Camina o trota cómodo'};
  for(let i=0;i<count;i++){blocks.push(block(`Repetición ${i+1}/${count}`,work,7,'main','work'));if(i<count-1)blocks.push(block(`Recuperación ${i+1}/${count-1} caminando o a trote`,recovery,2,'recovery','recovery'));}
  const remainder=main-count*work-(count-1)*recovery;if(remainder)blocks.push(block('Rodaje suave tras las repeticiones',remainder,3,'main'));
 }else if(type==='tempo'){
  const fraction=Math.min(+p.goal?.distance>=20?.55:.7,.4+Math.floor(week/4)*.1),work=Math.floor(main*fraction/30)*30,lead=Math.floor((main-work)/60)*30,tail=main-work-lead;
  blocks.push(block('Aproximación suave',lead,3,'main'),block('Tempo continuo controlado; frases cortas',work,6,'main','work'),block('Rodaje suave tras el tempo',tail,3,'main'));
 }else if(type==='progressive'){
  const work=Math.floor(main*.3);blocks.push(block('Carrera cómoda',main-work,3,'main'),block('Termina con control, sin esprintar',work,5,'main'));
 }else blocks.push(block('Carrera cómoda; puedes conversar',main,type==='recovery'?2:3,'main'));
 blocks.push(block('Vuelta a la calma suave',cool,2,'cooldown'));
 const rpe=type==='interval'?7:type==='tempo'?6:type==='progressive'?5:type==='recovery'?2:3;
 return {id,date,type,week,phase,blocks:blocks.filter(b=>b.seconds>0),repetitions,distance:null,seconds:limit,estimated:false,range:null,hr:null,rpe,hard:['tempo','interval','progressive'].includes(type)||type==='long'&&limit>=3600,reference,basePace:null,paceSource:source,
  purpose:type==='long'?'Practicar resistencia cómoda por tiempo.':rpe>=5?'Practicar cambios de esfuerzo controlados con recuperación.':'Construir constancia y resistencia con poco esfuerzo.',
  conversation:rpe>=6?'Frases cortas, sin llegar al máximo.':'Conversación completa y respiración controlada.',
  advice:'No hay una referencia fiable para convertir minutos en kilómetros. En cuestas o calor, reduce el esfuerzo. Detente si el dolor altera la zancada.',
  progression:requestedType!==type?'No cabe trabajo de calidad con bloques suficientes: esta sesión es carrera fácil.':type==='interval'?`${repetitions.count} repeticiones de ${repetitions.workSeconds} s y ${repetitions.recoveryCount} recuperaciones de ${repetitions.recoverySeconds} s, solo entre repeticiones. La duración del trabajo crece por etapas; no se presupone más velocidad.`:type==='tempo'?'El bloque continuo crece por etapas hasta el límite correspondiente a tu distancia y disponibilidad. Se mantiene esfuerzo controlado, sin inventar un umbral ni un ritmo más rápido.':'La duración progresa desde una propuesta conservadora, limitada por disponibilidad y recuperación; no se impone un ritmo inventado.',
  alternative:`Opción reducida: ${Math.floor(limit*.7/60)} min cómodos, contando calentamiento y vuelta a la calma. Con dolor relevante, descansa.`};
}
