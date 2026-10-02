# Motor de planificación local de Zancada

Las reglas se ejecutan en JavaScript, sin IA, reloj, Strava ni petición de red. El perfil, las actividades propias autorizadas y el calendario son la entrada; sesiones con bloques comprobables y razones son la salida. `planningVersion: 3` identifica estas propuestas. Los calendarios guardados se conservan hasta aceptar una revisión; no se reescriben al abrir la aplicación.

## Problemas corregidos por impacto

1. La mediana histórica podía ocultar una caída reciente y un cero declarado podía sustituirse por kilometraje antiguo. Ahora la carga parte del menor volumen fiable reciente y distingue cero de desconocido.
2. El reparto limitaba artificialmente la tirada de media maratón y maratón, mientras otros días aparentaban cubrir el volumen. Ahora hay límites específicos, presupuesto semanal y una comprobación de lo que realmente permite la disponibilidad.
3. Un plazo corto podía mostrar fases comprimidas. Ahora se reservan adaptación y puesta a punto, omitiendo desarrollo específico cuando no cabe.
4. Las rotaciones incorporaban intervalos o cuestas sin una necesidad del objetivo. Ahora la distancia, terreno, prioridad, continuidad y recuperación deciden su inclusión. Los rodajes de recuperación tienen esfuerzo 2/10 y menos carga.
5. Las marcas antiguas sin contexto fijaban ritmos y una marca corta extrapolaba un ritmo de maratón. Ahora se conservan sin prescribir rendimiento hasta confirmar sus datos; no se extrapola maratón desde 5–10 km.
6. Faltaba una sesión de referencia concreta y las alternativas calculadas no se podían elegir desde la revisión del plan. Ahora ambas tienen controles en la interfaz.

## Carga de partida y evidencia

- El perfil aporta volumen, frecuencia y tirada realizados, separados de la disponibilidad futura. Frecuencia cero inicia correr/caminar aunque exista kilometraje antiguo.
- Usar historial exige elección explícita y confirmar que están registradas todas las carreras de las cuatro semanas completas. Se necesitan seis carreras propias en al menos tres semanas. Se admiten registros manuales y archivos propios del dispositivo autorizados para seguimiento. Strava y fuentes sin autorización no intervienen. Los grupos se suman como una sesión; la frecuencia cuenta días reales distintos.
- La base histórica es el mínimo entre mediana de cuatro semanas, última semana, media de las últimas dos y volumen declarado cuando existe. La frecuencia también se limita por la última semana; continuidad significa semanas consecutivas al final del periodo, no sumar semanas separadas. Un cero se mantiene.
- La tirada histórica se obtiene del mismo periodo completo. Dolor, esfuerzo alto, antigüedad u origen estimado reducen su peso. Los minutos observados limitan la primera semana cuando falta ritmo para convertir distancia en duración.
- Reducciones de diseño: vuelta o lesión reciente ×0,7; pausa de cuatro semanas ×0,6; recuperación mala ×0,75; volumen incierto o ritmo incómodo ×0,85. Se toma la más conservadora, no se multiplican todas. Molestias actuales aplican además ×0,6; dolor relevante o restricción de no correr producen pausa.
- Minutos desconocidos: techo provisional visible de 20 minutos. Se resta el tiempo de otros deportes. Una actividad exigente o sin duración/intensidad conocida reserva su día y evita exigencia alrededor. La fuerza complementaria reserva su día.
- La primera semana completa fija el presupuesto alcanzable después de los límites diarios y de tirada. Los días incompletos iniciales no provocan una falsa reducción. Los rodajes quedan por debajo de la tirada larga; la carga que no cabe no se redistribuye.

Estas constantes son decisiones prudentes del producto, no diagnósticos ni umbrales científicamente validados.

## Viabilidad y preparación por distancia

| Objetivo | Plazo orientativo | Base orientativa, km/semana | Tirada orientativa de revisión | Techo nuevo de tirada | Techo de duración | Puesta a punto |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Hasta 5 km | 8 semanas | 3 | Distancia objetivo | 7 km | 60 min | 7 días |
| Hasta 10 km | 10 semanas | 10 | Hasta 8 km | 12 km | 90 min | 7 días |
| Más de 10 y menos de 30 km | 16 semanas | 18 | 75 % de distancia, hasta 16 km | 20 km | 120 min | 10 días |
| 30–42,3 km | 24 semanas | 30 | 26 km | 32 km | 180 min | 14 días |

Los valores sirven para señalar limitaciones; no exigen alcanzar esas cargas ni completar la distancia de carrera entrenando. Una tirada reciente mayor que el techo de una distancia corta se puede conservar como límite inicial, sin ampliarla por ese objetivo.

El motor comprueba la tirada que cabe en la propuesta y la referencia reciente utilizable. Si no se desarrolla la resistencia orientativa, explica el límite y propone una distancia menor cuando la flexibilidad lo permite. Sin ritmo no afirma cuántos kilómetros se cubrirán: utiliza duración y declara la incertidumbre. Las alternativas de fecha, distancia, tiempo o terminar respetan la flexibilidad elegida. Elegir una alternativa guarda el objetivo; el calendario cambia al recalcular y aceptar la propuesta. Ultradistancia y terreno muy técnico quedan fuera de la preparación específica soportada.

## Fases, progresión y recuperación

La fecha real determina los días disponibles. Primero se reserva la puesta a punto. La base ocupa al menos 7 días, o 14 en perfiles prudentes, y hasta 28 según el plazo. Un bloque específico solo se incorpora con fecha conocida y al menos 21 días antes de la puesta a punto; toma aproximadamente el 35 % del periodo de preparación, redondeado a semanas. El resto es desarrollo. En plazos cortos no se comprimen meses de trabajo.

La progresión de diseño usa pasos absolutos: 0,5 km en contexto prudente; 0,75 por debajo de 20 km semanales; 1 entre 20 y 40; 1,5 desde 40. El aumento total queda acotado a 3 km en contexto prudente, 8 para objetivos cortos, 16 para media y 24 para maratón. La tirada crece como máximo 0,25, 0,5 o 0,75 km por paso según base y distancia. Por tiempo se usan pasos de 1–2 minutos. Solo se desarrolla carga en fases normales, con una base de al menos 5 km, sin molestias, mala recuperación, lesión reciente, restricciones, volumen incierto o esfuerzo cómodo contradictorio.

Son cargas **previstas**, pendientes de comprobar con lo realizado; no acreditan adaptación solo por pasar semanas. No se aplica un aumento automático del 10 %. La descarga tras tres semanas utiliza factor 0,8 cuando existe un bloque suficientemente largo. El presupuesto de antes de la descarga evita un salto para compensarla. Los rodajes de recuperación reducen su propia carga un 30 %, sin añadirla a otros días. Esa reducción no se resta repetidamente de la base en semanas posteriores.

En puesta a punto, el factor de carga pasa de 0,7 a 0,45 en la segunda mitad. Se mantiene esfuerzo cómodo y se omite intensidad en esta versión conservadora; no se intenta replicar la puesta a punto de atletas competitivos. Correr/caminar también reduce su duración total, manteniendo bloques coherentes.

Una calidad semanal como máximo, con base regular ≥12 km, prioridad que la justifique, recuperación compatible y un hueco apropiado. Al menos 48 horas entre sesiones exigentes, incluidas tiradas largas y competición. Una sesión demasiado corta para calentamiento, trabajo y vuelta a la calma se convierte en carrera fácil. Terminar/correr sin parar, iniciación, pausas, incertidumbre y molestias explican la ausencia de calidad. Las sesiones omitidas se confirman antes de reducir base; no se trasladan ni se acumulan.

## Sesiones y ritmos

- Fácil y tirada: conversación completa, esfuerzo orientativo 3/10. Recuperación: 2/10 y menor duración. Sin referencias válidas se prescribe tiempo, sin kilómetros inventados.
- 5–10 km: tempo o repeticiones controladas, con distancias y rangos de trabajo distintos. La media prioriza esfuerzo sostenido y tempo; maratón, resistencia y progresivos/tempo controlados, sin insertar intervalos rápidos para añadir variedad.
- Cuestas: solo con pendientes declaradas en la carrera y una oportunidad compatible con recuperación y tiempo. No se prescriben ritmos exactos en pendiente ni bajadas rápidas; en cinta no se asignan cuestas exteriores.
- Referencias de rendimiento: distancia, tiempo, fecha real ≤180 días, esfuerzo máximo explícito, medición registrada, competición/prueba y asfalto comparable, sin pausas o desnivel que invaliden la comparación. Datos incompletos o anteriores al formulario nuevo permanecen guardados, pendientes de confirmar. No se deduce esfuerzo máximo de pulsaciones ni de un RPE alto aislado.
- Para normalizar una marca a 5 km se usa potencia con exponente 1,06 y multiplicadores de diseño. La normalización entre distancias se limita conservadoramente a referencias de 3,5–230 minutos; esta ventana es un límite del producto. Una referencia de la misma distancia puede compararse sin esa extrapolación. Los rangos son estimaciones, no VO₂máx ni umbral medidos; la fecha deseada no los acelera.
- Un ritmo suave declarado admite rangos provisionales solo para fácil, larga y recuperación. Origen estimado amplía el margen. Esfuerzo >4/10 o conversación insuficiente invalida su uso como suave. El método y sus supuestos quedan visibles.
- Ritmo de competición: referencia comparable ≤90 días; extrapolaciones cortas acotadas. Maratón requiere referencia de distancia comparable, nunca una marca corta. Una marca de maratón lento puede servir para comparar esa misma distancia, pero no se convierte en una marca rápida de 5 km fuera de los límites del modelo.
- Sin marca válida se ofrece una carrera cómoda concreta del calendario, con calentamiento, bloques, enfriamiento y enlace para abrirla. Se registran tiempo, distancia, esfuerzo y sensaciones; la conversación puede anotarse en notas. No se presenta como prueba máxima ni permite inventar un umbral. Con pausa o dolor relevante se aplaza.

La carrera sustituye cualquier sesión en su fecha, aunque sea un día no disponible habitual. Se llama **Día de la carrera**, tiene distancia oficial, fecha fija y 48 horas previas sin exigencia. Una meta limitada o sin referencia suficiente no tiene ritmo ni duración exactos de competición. Las sumas de distancia y segundos coinciden con los bloques; calentamiento y recuperación tras la meta quedan fuera de la distancia oficial.

## Contraste con fuentes primarias

Los [planes oficiales de 10 km de B.A.A.](https://www.baa.org/races/boston-10k/info-for-athletes/b-a-a-10k-training/) distinguen nivel de entrada y organizan preparación, trabajo principal y puesta a punto. Respaldan separar base y especificidad; sus calendarios no se han copiado. Los parámetros individuales y límites de Zancada son propios.

La [preparación oficial de maratón de B.A.A.](https://www.baa.org/races/boston-marathon/info-for-athletes/boston-marathon-training/) parte incluso en su nivel inicial de una base regular importante y tiradas progresivas que no completan la carrera. Sirve para contrastar la demanda específica. Zancada no fuerza esa carga en un principiante ni utiliza ese programa como garantía de viabilidad.

[Vickers y Vertosick, estudio original de corredores recreativos](https://doi.org/10.1186/s13102-016-0052-y), encontraron limitaciones importantes al predecir maratón con fórmulas simples entre distancias. Por eso una referencia corta no fija un ritmo de maratón. El exponente, filtros y márgenes concretos de esta aplicación son decisiones de diseño, no el modelo individual validado por ese estudio.

[Shepley et al., experimento de puesta a punto](https://pubmed.ncbi.nlm.nih.gov/1559951/) estudió nueve corredores masculinos muy entrenados y combinaciones de volumen e intensidad. Apoya distinguir reducción de carga de abandono del entrenamiento, pero no valida nuestros factores ni permite extrapolar su protocolo a principiantes. La omisión de intensidad de Zancada es una elección conservadora expresamente distinta de la intervención competitiva.

[Frandsen et al., cohorte observacional de 5.205 corredores](https://pubmed.ncbi.nlm.nih.gov/40623829/) relaciona cambios de distancia de una sesión con lesiones. Motiva revisar la tirada reciente y los saltos por sesión, además de la suma semanal. No demuestra causalidad ni establece que nuestros incrementos absolutos prevengan lesiones; tampoco justifica un aumento automático semanal del 10 %.

## Comparación reproducible

Datos ficticios, generación desde 05/10/2026. Corredor regular: 24 km/semana, tres días, tirada cómoda de 8 km, marca medida de 5 km en 25:00 y 90 minutos para la tirada. Mismo historial, distintas metas:

| Perfil / meta | Semanas | Primera semana completa | Tirada máxima prevista | Calidad | Puesta a punto | Revisión de meta |
| --- | ---: | ---: | ---: | --- | ---: | --- |
| Iniciación, 0 km, terminar 5 km | 8 | Por tiempo, correr/caminar | No se separa una tirada | Ninguna | 7 días | Sí |
| Regular, mejorar 5 km | 10 | 22,4 km | 8 km | Tempo e intervalos cortos | 7 días | No señalada |
| Mismo corredor, mejorar 10 km | 10 | 22,4 km | 11 km | Tempo e intervalos más largos | 7 días | No señalada |
| Mismo corredor, media maratón | 16 | 22,4 km | 12,5 km | Tempo y progresivos | 10 días | Sí: resistencia/tiempo limitados |
| Mismo corredor, 10 km en dos semanas | 2 | 22,4 km | 8 km | Ninguna; mantener base | 7 días | Sin bloque específico completo |
| Experiencia, 60 km, tirada 24 km, maratón | 24 | 57,7 km | 26 km / 179 min | Tempo y progresivos | 14 días | No señalada por carga; sin ritmo de maratón desde marca corta |
| Regular con molestias leves, 10 km | 10 | 13,4 km | 4,8 km | Ninguna | 7 días | Sí |

“No señalada” significa que estas reglas no encuentran ese límite concreto; no confirma preparación, seguridad ni resultado.

Las regresiones están en `tests/planning-rules.test.mjs`: perfiles y plazos contrastados, límites iniciales, caída reciente y cero, historial autorizado, restricciones, recuperación, fases, descarga, taper, ritmo válido, referencia concreta, terreno, disponibilidad, integridad de bloques y generación con la red prohibida. La suite restante comprueba registro, persistencia y separación de usuarios. Las comprobaciones ejecutadas y sus límites se recogen en la entrega.

El 2 de octubre de 2026 se ejecutaron **141 pruebas correctas**. Chrome real completó el flujo con **23 guardados simulados y cero errores de ejecución**, incluidos abrir la referencia, consultar las fuentes, elegir una alternativa, aceptar su calendario y volver a abrirlo. HTTP y D1 aislados comprobaron guardar perfil/plan/actividad, reiniciar el servidor, leer el mismo estado y controlar identidad, origen, revisiones y borrado. No se utilizaron carreras reales para validar científicamente las reglas ni cuentas externas de producción para esos ensayos.

## Límites reales

Este es un motor de reglas, no un modelo clínico ni una predicción individual validada. No interpreta médicamente texto libre, no demuestra adaptación por calendario y no garantiza marcas. Trail técnico, ultras y estrategias avanzadas de entrenamiento quedan fuera. Las respuestas y sensaciones necesitan revisión conforme cambia el corredor.

No requiere configuración externa nueva. Autenticación real en despliegue y autorización efectiva de Strava mantienen sus requisitos anteriores; los datos de Strava no alimentan estas decisiones.
