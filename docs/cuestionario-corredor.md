# Cuestionario y perfil del corredor

El asistente inicial y el perfil comparten las preguntas y el resumen. Los cambios del perfil se guardan primero; el calendario existente se mantiene hasta que el corredor acepta la propuesta nueva. Se conservan actividades, sesiones completadas, marcas, notas y los datos anteriores. No se requiere una migración de la base de datos: el perfil sigue almacenado como JSON por usuario.

## Problemas encontrados, por impacto

1. La prioridad declarada apenas afectaba al plan. Las restricciones en texto libre no cambiaban la prescripción.
2. Un ritmo llamado suave se aceptaba sin contrastar esfuerzo ni conversación; una tirada agotadora o antigua tenía el mismo peso que una cómoda.
3. No se distinguían estimaciones de volumen, pausas cuantificadas ni variaciones entre semanas. Faltaba el origen y contexto de las marcas.
4. Una marca opcional incompleta impedía continuar. La fecha de carrera desconocida también bloqueaba la configuración.
5. Faltaba un resumen editable de evidencia y precisión. Al editar disponibilidad podían quedar seleccionados una tirada o un número de días incompatibles.

## Respuesta y decisión que cambia

| Información | Uso en el motor |
| --- | --- |
| Objetivo, distancia y fecha | Duración del bloque, fases, límite de tirada y evento «Día de la carrera». Sin fecha: bloque general sin evento. Sin distancia: preparación provisional sin distancia oficial inventada. |
| Prioridad | Terminar o correr sin parar prioriza resistencia cómoda y excluye tempo, intervalos, progresivos y cuestas exigentes. Mejorar marca permite calidad si base, recuperación y calendario lo admiten. |
| Tiempo deseado | Se contrasta con una marca comparable y se señalan metas exigentes. Nunca impone ritmos de entrenamiento. |
| Flexibilidad | Filtra alternativas de tiempo, fecha o distancia; mantener la meta conserva el objetivo sin forzar carga. Las alternativas requieren elección explícita. |
| Experiencia, frecuencia realizada y semanas de continuidad | Número de carreras, separación, progresión y admisión de intensidad. Disponibilidad futura y días realizados se preguntan por separado. |
| Kilómetros y origen | Límite de volumen inicial. Un valor estimado reduce la base y aplaza intensidad. Desconocido permanece vacío; no se convierte en kilometraje realizado. |
| Variaciones y pausas en ocho semanas | Volumen variable, creciente o decreciente reduce carga inicial; pausas de dos o más semanas activan una vuelta conservadora, con una reducción mayor desde cuatro semanas. |
| Tirada, fecha, origen y resultado | Límite inicial de tirada reducido si fue difícil, dolorosa, estimada o de hace más de seis semanas. Molestias en esa tirada también suprimen intensidad. |
| Marca: fecha, distancia, tiempo, contexto y origen | Solo referencias completas, recientes y comparables calibran rendimiento. Competición o prueba máxima, esfuerzo confirmado, terreno y pausas determinan su uso. Estimaciones y marcas incompletas se conservan sin fijar ritmos. |
| Ritmo cómodo, esfuerzo y conversación | Se descarta el ritmo como suave si el esfuerzo supera 4/10 o no permite conversación completa. Estas sensaciones también aplazan intensidad aunque el ritmo sea desconocido. El ritmo estimado usa un margen mayor. |
| Días, minutos y día de tirada | Distribución real y duración máxima, después de restar otros deportes. Cambiar días actualiza los selectores incompatibles. Minutos desconocidos usan un límite provisional visible de 20 min, sin escribir ese valor como respuesta. |
| Fuerza, CrossFit y otros deportes | Consumen tiempo y reservan recuperación. Si duración o intensidad son desconocidas, se reserva ese día. Si no queda ningún hueco, se propone pausa y se explica cómo revisar disponibilidad. |
| Molestias, fatiga, recuperación y lesión reciente | Menos carga, ausencia de intensidad o pausa según las respuestas. Son sensaciones declaradas. |
| Restricción explícita | Evitar intensidad, limitar minutos o no correr. Un límite desconocido o menor de 15 min propone pausa. Las notas libres se muestran y se avisa de que no se interpretan automáticamente. |
| FC y su origen, opcionales | Solo ambos valores con origen medido habilitan zonas orientativas. El formulario nuevo parte de origen desconocido, sin estimar FC máxima por edad. |

Los umbrales, factores de reducción y márgenes son reglas de producto conservadoras; no son mediciones fisiológicas ni un programa clínicamente validado. La recuperación y la estabilidad deben revisarse cuando cambian las sensaciones o se dispone de registros completos.

## Preguntas condicionales y valores desconocidos

- El objetivo específico abre fecha, distancia, prioridad y flexibilidad. El tiempo deseado aparece para mejorar marca o cuando ya existe un tiempo guardado.
- «Aún no lo sé» también es una respuesta al objetivo: propone doce semanas de base cómoda sin intensidad hasta definir la meta.
- El origen y variación del volumen aparecen al introducir kilómetros. El detalle de tirada aparece con una distancia; el origen del ritmo, cuando se conoce ese ritmo.
- Esfuerzo y conversación aparecen si se declara carrera reciente o un ritmo. No exigen conocer min/km.
- La duración de la pausa aparece en continuidad intermitente o vuelta tras pausa, y sigue visible si ya existe una respuesta.
- Se pueden añadir varias marcas opcionales y conservarlas incompletas. No se completan fechas ni tiempos automáticamente.
- Otros deportes, FC y marcas se despliegan según necesidad. El límite de restricción solo se pregunta cuando aplica.
- Los campos numéricos y de fecha vacíos significan «No lo sé». Los selectores ofrecen esa respuesta explícita. Un dato conocido con formato imposible o fuera de rango sí requiere corrección.

Las discrepancias plausibles —cero días y kilómetros positivos, tirada superior a la media, pausa y continuidad simultáneas, ritmo incompatible con conversación— generan avisos y decisiones conservadoras, sin borrar las respuestas ni bloquear por contradicciones posibles.

## Resumen editable

Se muestra antes de crear el plan y al final del perfil. Separa punto de partida, origen medido declarado, información estimada o provisional, datos ausentes y efecto sobre precisión. Los botones llevan a las preguntas correspondientes; desde el asistente se puede volver directamente al resumen. Un origen «medido» significa que el corredor lo ha declarado o confirmado en sus registros; no acredita verificación externa.

Las marcas antiguas sin los metadatos nuevos mantienen uso provisional, con aviso para confirmar contexto y origen. No se les asigna retrospectivamente una competición ni una medición. Los planes previamente aceptados se conservan hasta aceptar una revisión. En una revisión, una carrera sin prioridad ni tiempo declarados se interpreta como terminar; una meta de marca o con tiempo se interpreta como mejorar.

## Comprobaciones

- `tests/questionnaire-decisions.test.mjs`: comparaciones del mismo corredor cambiando respuestas; carga inicial, límite de tirada, intensidad, ritmo utilizable, alternativas, restricciones, valores desconocidos y ausencia de aumentos incompatibles con el perfil.
- `tests/runner-questions.test.mjs`: preguntas condicionales, controles para editar el resumen, precisión y distancia oficial desconocida sin tramos ficticios de 0 km.
- `tests/state-store.test.mjs`: evidencia nueva, valores vacíos y marcas parciales conservados de forma distinta para dos usuarios; editar uno no altera el otro.
- `scripts/verify-running-browser.mjs`: Chrome real con API interceptada antes de navegar. Asistente completo, varias marcas parciales, edición del resumen, guardado y recarga, perfil con evidencia, aceptación del plan y cambio de intensidad al cambiar prioridad. Incluye las comprobaciones anteriores de calendario, actividades y estadísticas. Nunca escribe en la base del usuario.
- `scripts/verify-state-http.mjs`: servidor HTTP y D1 reales con almacenamiento aislado. Guarda todas las respuestas nuevas, marcas parciales y plan; reinicia el servidor y comprueba igualdad completa. Mantiene controles de revisión, identidad y origen.
- Suite completa, comprobación TypeScript y compilación de producción. Los resultados ejecutados se detallan en la entrega; este documento no sustituye esas pruebas.

Resultado ejecutado el 2 de octubre de 2026: **129 pruebas correctas**, TypeScript correcto, compilación correcta, Chrome con **18 guardados simulados y cero errores de ejecución**, y persistencia D1 tras reinicio real. Se comprobó también que el perfil, plan, actividades y revisión originales no cambiaron durante las verificaciones finales. El lint de los módulos nuevos del motor no presenta errores; el lint global de la interfaz conserva deuda de tipado con `any` y no se declara aprobado.

## Límites y configuración externa

Las reglas posteriores del motor y el tratamiento actual de referencias sin confirmar se detallan en [Motor de planificación](motor-planificacion.md). Las marcas del formulario anterior se conservan, pero ya no fijan ritmos de rendimiento hasta confirmar esfuerzo máximo, medición, contexto y terreno.

Este cambio no necesita servicios externos. Los planes siguen siendo heurísticos y no garantizan una marca o preparación suficiente para cualquier distancia. Las notas libres no se interpretan clínicamente. Las respuestas de continuidad, pausas, restricciones y sensaciones deben actualizarse cuando cambia el corredor; no se presume recuperación solo por avanzar semanas.

Strava permanece separado y no alimenta este motor. Su conexión y la autenticación real de varios usuarios en despliegue conservan los requisitos documentados en la revisión de fiabilidad. La separación de datos se comprueba con identidades de prueba, no con dos cuentas externas reales.
