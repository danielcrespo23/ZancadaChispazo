# Seguimiento después de una actividad

Implementado el 2 de octubre de 2026. El seguimiento funciona por reglas locales, sin IA. Registrar, editar o recibir una actividad actualiza sus estadísticas y su fecha realizada; conserva el calendario aceptado hasta que el corredor acepte una propuesta concreta.

## Fallos corregidos por impacto

| Impacto | Antes | Ahora |
| --- | --- | --- |
| Alto | El formulario rellenaba esfuerzo, fatiga, molestias y tipo sin preguntarlos. | Empiezan sin confirmar. El análisis pide los datos ausentes y evita asumir recuperación buena. |
| Alto | Se podía interpretar calidad a partir del ritmo medio de toda la carrera. | Intervalos, tempo y cuestas se contrastan con bloques identificados. La media incluye calentamiento y recuperación y no demuestra intensidad de trabajo. |
| Alto | Registrar podía aplicar una reducción con un ajuste antiguo activado. | Todas las propuestas del registro se muestran antes de aplicarlas y requieren aceptación. La preferencia antigua permanece almacenada, sin activar ajustes del registro. |
| Alto | Tres rodajes podían acelerar ritmos de sesiones de calidad. | La evidencia comparable solo permite proponer un aumento moderado de distancia fácil. No acelera calidad ni añade intensidad. |
| Alto | La fecha o la proximidad del registro bastaban para asociarlo. | Se exige una correspondencia clara; el vínculo puede corregirse, agruparse o deshacerse. La fecha real de cada actividad permanece visible. |
| Alto | Una sesión dividida entre varios registros no podía completarse conjuntamente. | La agrupación explícita suma los fragmentos una vez y conserva cada registro y nota. |

## Estados y asociaciones

- **Completada:** el trabajo declarado, el tipo y el volumen son compatibles, sin discrepancias conocidas en bloques ni señales relevantes de fatiga o molestias. Este estado indica realización compatible; el análisis puede seguir señalando información ausente y no prueba adaptación fisiológica.
- **Realizada con cambios:** hay vínculo explícito y diferencias en tipo, volumen, bloques o esfuerzo/sensaciones.
- **Actividad sin vincular:** aún no se conoce una correspondencia suficientemente clara.
- **Carrera adicional:** el corredor confirma que no corresponde a una sesión prevista.

El vínculo automático exige una única sesión libre de carrera en la misma fecha local, tipo compatible y distancia dentro del 25 % o duración dentro del 30 % si se prescribió por tiempo. En calidad se exige el tipo declarado correspondiente o bloques compatibles; nunca se deduce el tipo de una media rápida. Son tolerancias de producto, no umbrales fisiológicos. Una carrera parcial puede asociarse manualmente y quedar «Realizada con cambios».

Desde «Corregir, agrupar o desvincular actividades» se elige sesión, registros y papel: calentamiento, principal, recuperaciones o vuelta a la calma. Se incluyen todos los registros ya asociados. Los grupos abarcan el mismo día o una actividad que cruza medianoche con horas confirmadas y una separación máxima de 12 horas. Deshacer restaura solo las asociaciones y conserva notas editadas posteriormente; se rechaza si existen cambios posteriores incompatibles.

Dos carreras en un día suman kilómetros por separado. Un grupo cuenta como una sesión completada y no duplica kilómetros. Para reconstruir frecuencia del historial se cuentan días distintos de carrera. Las sesiones antiguas sin registro siguen «sin confirmar»; omitirlas es una decisión explícita y no redistribuye su carga.

## Interpretación y progresión

El detalle muestra tipo, distancia, duración prescrita o estimada, tiempo realizado en movimiento y total con pausas cuando existe, esfuerzo, fatiga y molestias. Los bloques identificados comparan trabajo, recuperaciones, su ubicación, calentamiento y vuelta a la calma. La ausencia de bloques no se rellena desde el ritmo medio. Las vueltas pueden representar solo parte de la carrera; sus sumas no pueden superar el total. Una recuperación parado suma tiempo transcurrido y no inventa tiempo en movimiento.

Las tolerancias explícitas son: volumen total ±10 % por distancia o ±15 % por duración; trabajo ±15 %; esfuerzo de bloque ±1; ritmo dentro del rango orientativo con margen del 5 %; recuperación ±20 % por distancia o ±25 % por tiempo; calentamiento/enfriamiento ±20 %. Sirven para señalar diferencias que revisar, no para certificar cumplimiento deportivo.

El informe explica evidencia, información ausente, propósito probable, siguiente sesión y motivo para conservar o revisar. Esfuerzo percibido, fatiga y molestias se solicitan si faltan. Dolor relevante propone pausa de la siguiente carrera; molestias leves, fatiga ≥7, esfuerzo dos puntos superior al previsto o malas sensaciones proponen reducción. La recomendación aparece inmediatamente, pero el calendario cambia únicamente al aceptar. No se diagnostica una lesión.

Para proponer progresión se necesitan tres carreras en días distintos de los **últimos 21 días respecto a hoy**, del mismo tipo continuo fácil, recuperación o tirada larga y terreno comparable. Cada una debe estar vinculada, tener volumen comparable (±20 %), esfuerzo no superior al previsto, fatiga ≤4, ausencia de molestias y ritmo al menos un 3 % más rápido que el centro del rango orientativo. No hace falta marcar «Mejor de lo esperado».

También se exige base ≥12 km, experiencia y referencia de ritmo válida, sin restricciones o retorno prudente. Se bloquea por calor ≥25 °C, diferencia térmica >5 °C, temperatura desconocida, trail, desnivel >15 m/km, pausas superiores al 10 % del tiempo en movimiento, sensaciones incompletas o preocupantes de los últimos siete días y las dos semanas previas a competir. Los fragmentos agrupados no cuentan como tres muestras independientes. El terreno, desnivel y pausas conocidos limitan la comparación; su ausencia no permite afirmar que las condiciones fueron idénticas. No existe corrección meteorológica ni modelo fisiológico.

La propuesta afecta como máximo a tres sesiones fáciles futuras de las próximas dos semanas: hasta un 5 % de distancia, redondeado hacia abajo a 100 m, conservando ritmo y días. Se comprueban minutos, otros deportes, recuperación, fases y límites de tirada. No se modifica calidad, carrera objetivo ni sesiones pasadas. El 3 %, las tres muestras y el 5 % son decisiones conservadoras del producto, **no reglas científicas validadas ni garantías de mejora**.

Se muestran sesiones y bloques antes/después. Aceptar valida que la evidencia siga disponible, autorizada, reciente y sin editar, y que el calendario y el perfil todavía admitan el cambio. Rechazar conserva el plan. Deshacer restaura conjuntamente las sesiones mientras sigan futuras y sin cambios posteriores. Se conserva el historial de propuestas y acciones; editar, eliminar o desvincular evidencia deja obsoletas las propuestas pendientes relacionadas. Una eliminación conserva copia del registro y notas en el historial, aunque deja de sumar estadísticas. Borrar todos los datos elimina también ese historial.

## Recepción autorizada

En Historial hay un selector real de **archivo JSON propio**, con vista previa, errores por registro, selección y consentimiento explícito. No se configura ni se simula una sincronización con un reloj. Se admiten 1–500 actividades y hasta 2 MB. Ejemplo:

```json
{
  "activities": [{
    "id": "reloj-123",
    "startedAt": "2026-10-01T22:30:00Z",
    "timezone": "Europe/Madrid",
    "distance": 5,
    "seconds": 1800,
    "elapsedSeconds": 1860,
    "type": "easy",
    "measurement": "measured",
    "notes": "Mi registro"
  }]
}
```

La fecha local de este ejemplo es **2026-10-02**. `startedAt` exige zona u offset; sin hora se puede aportar `date: "AAAA-MM-DD"`. La zona es la de la actividad o, si falta, la del perfil. No se utiliza el recorte de la fecha UTC. Corregir la fecha en el formulario conserva la fecha originalmente calculada y la hora fuente.

Distancias en km, tiempos en segundos (o `time` en mm:ss/hh:mm:ss). Son opcionales `rpe`, `fatigue`, `pain` (`none`, `mild`, `relevant`), `feeling`, `terrain`, `temperature`, `elevation`, pulsaciones y `laps`. Cada vuelta admite `kind`, distancia, segundos, esfuerzo y recuperación: `recoverySeconds`, `recoveryDistance` y `recoveryType` (`jog`, `walk`, `stop`). Se omite lo desconocido; recibir un archivo no convierte una estimación en una medida ni autoriza su envío a IA.

El identificador externo impide importar otra vez la misma actividad y conserva el registro existente, incluidas sus correcciones. Fecha/distancia/tiempo casi iguales sin hora se señalan como posible duplicado. El formulario manual permite confirmar que son carreras distintas; la importación conserva la existente y pide revisión. Horas separadas permiten varias carreras reales en un día.

Para un receptor propio está disponible `POST /api/activities`, autenticado con la sesión del usuario: `{source: "personal-file", consent: true, revision, activities}`. El servidor obtiene la identidad autenticada, ignora identificadores de usuario del cuerpo y protege origen y revisión. Devuelve identificadores recibidos, duplicados, errores y nueva revisión. Un `409` exige recargar. No hay token público de importación ni webhook de un proveedor. `GET /api/activities` devuelve solo la revisión de esa cuenta.

La aplicación visible consulta esa revisión cada cinco segundos y al recuperar foco; cuando cambia, carga los datos y actualiza estadísticas. El registro/importación desde la propia interfaz actualiza inmediatamente. El refresco se suspende en formularios de carrera/perfil, durante un guardado, en demostración y con cambios pendientes. La recepción externa tiene ese intervalo de detección: no es una suscripción en tiempo real. Fallos de red no sustituyen datos locales.

Strava sigue separado: la [política oficial vigente, apartados 5.3–5.5](https://www.strava.com/legal/api_policy), restringe análisis, combinación y uso con IA de datos de su API. Los marcadores de origen Strava se rechazan aunque se añada consentimiento. Esta recepción se limita a archivos propios autorizados del dispositivo, sin sortear esa restricción. OAuth real, permisos del proveedor o una integración con reloj no se han comprobado aquí.

## Fundamento y límites

El [estudio original de Gastin et al. con 27 jugadores de fútbol australiano](https://pubmed.ncbi.nlm.nih.gov/23249820/) encontró sensibilidad de valoraciones subjetivas a carga, descarga y características individuales. Sustenta preguntar y contextualizar sensaciones; no valida nuestras escalas ni sus puntos de corte para corredores recreativos.

La [cohorte original de Frandsen et al. de 5.205 corredores](https://pubmed.ncbi.nlm.nih.gov/40623829/) examinó cambios de distancia por sesión y lesiones. Motiva revisar incrementos individuales y tirada reciente. Es observacional; no demuestra que una progresión del 5 % sea segura ni acredita adaptación por tres actividades rápidas. El seguimiento comunica inferencias y sus límites, sin prometer marcas.

## Comprobaciones reproducibles

La recepción de archivos ahora admite TCX, CSV con mapeo y FIT, además de este JSON. Los tiempos se distinguen por su significado y los duplicados se pueden vincular sin perder notas. Consulta la [documentación actualizada de importación](importacion-dispositivo.md) para formatos, límites, originales y resultados de las nuevas pruebas; los resultados históricos indicados abajo corresponden al cierre anterior del seguimiento.

```sh
npm test
npm run check:types
npm run build
npm run verify:storage
# Servidor en 5173 y Chrome de prueba con CDP en 9223:
npm run verify:browser
npm run verify:followup
```

`tests/activity-followup.test.mjs` comprueba los cuatro estados, asociación automática/manual, bloques de calidad, recuperaciones, tiempo con pausas, agrupación/deshacer, notas, fechas locales, duplicados, consentimiento y rechazo de origen protegido, ausencia de cambios automáticos, progresión comparable y evidencia caducada, fatiga/molestias y conservación del pasado. SQLite comprueba revisión y separación por usuario.

`verify:storage` ejecuta recepción HTTP real, repetición idempotente, datos desconocidos, fecha local, agrupación y reapertura tras parar/arrancar el servidor, en D1 independiente. `verify:followup` recorre Chrome con APIs interceptadas: formulario y archivo real, análisis, calendario/estadísticas, asociaciones/grupos/deshacer, aceptar/rechazar/deshacer ajustes, borrador protegido frente a recepción en otra pestaña, reapertura y anchura móvil. Ninguna prueba escribe en la base habitual del corredor.

Resultados comprobados al cerrar esta implementación: **179 pruebas aprobadas**, incluidos 24 casos de seguimiento; TypeScript y compilación de producción aprobados; Chrome con 17 guardados de fixture y cero excepciones, incluida una sesión generada de cuatro repeticiones/tres recuperaciones cuyo ritmo medio total es más lento que el rango rápido. Recepción HTTP y D1 con reinicio real aprobados. El JSON original de la cuenta local conserva exactamente su SHA-256 anterior. ESLint pasa en los módulos nuevos y el motor; el lint completo mantiene la deuda anterior de la interfaz, que no se presenta como resuelta.
