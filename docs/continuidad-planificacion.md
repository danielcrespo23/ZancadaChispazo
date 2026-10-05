# Continuidad de la planificación

Caso reproducido antes de modificar el código: media maratón iniciada el 05/10/2026, carrera el 25/01/2027 y revisión el 09/11/2026. Se usó un perfil ficticio regular: 30 km semanales, tres días, tirada reciente de 12 km y ritmo suave de 6:00 min/km. No se abrió ni modificó la base personal.

## Calendario y fallo reproducido

| Calendario | Origen | Fin de base | Inicio específico | Puesta a punto | Carrera |
| --- | --- | --- | --- | --- | --- |
| Aceptado el 05/10 | 05/10/2026 | 19/10/2026 | 11/12/2026 | 15/01/2027 | 25/01/2027 |
| Reinicio al revisar: comportamiento anterior | 09/11/2026 | 16/11/2026 | 25/12/2026 | 15/01/2027 | 25/01/2027 |
| Revisión corregida: ambas coberturas | 05/10/2026 | 19/10/2026 | 11/12/2026 | 15/01/2027 | 25/01/2027 |

El 09/11 pasaba de Desarrollo a Base. La primera descarga se desplazaba del 23/11 al 30/11. Repetir el reinicio cada semana aplazaba esa descarga otra semana y volvía a prescribir base. La revisión corregida conserva las fechas aceptadas, el índice de semana y la rotación de sesiones.

## Comparación concreta en la revisión del 09/11

Kilómetros de entrenamiento, sin sumar carrera ni fuerza. Cada fila compara el calendario aceptado con una revisión única realizada el 09/11. La columna confirmada usa todas las sesiones realmente registradas hasta el día anterior; la columna incompleta no inventa adaptación ni inactividad.

| Semana | Fase aceptada → reinicio anterior → corregida | km aceptados | km reinicio | km sin cobertura confirmada | km con registros confirmados | Sesiones clave aceptadas → corregidas con registros |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 09/11/2026 | Desarrollo → Base → Desarrollo | 32.8 | 30 | 30 | 31.8 | Tempo 9.3 km; Carrera larga 14.2 km → Tempo 8.8 km; Carrera larga 14.2 km |
| 16/11/2026 | Desarrollo → Desarrollo → Desarrollo | 34 | 30.9 | 30 | 32.8 | Progresivo 9.5 km; Carrera larga 15 km → Progresivo 8.9 km; Carrera larga 15 km |
| 23/11/2026 | Descarga → Desarrollo → Descarga | 27.2 | 31.9 | 24 | 26.2 | Carrera larga 12 km → Carrera larga 12 km |
| 30/11/2026 | Desarrollo → Descarga → Desarrollo | 34.9 | 25.6 | 30 | 33.7 | Progresivo 9.6 km; Carrera larga 15.7 km → Progresivo 9 km; Carrera larga 15.7 km |
| 07/12/2026 | Desarrollo / Trabajo específico → Desarrollo → Desarrollo / Trabajo específico | 35.4 | 32.8 | 30 | 34.2 | Tempo 9.7 km; Carrera larga 16 km → Tempo 9.1 km; Carrera larga 16 km |
| 14/12/2026 | Trabajo específico → Desarrollo → Trabajo específico | 35.6 | 34 | 30 | 34.4 | Tempo 9.8 km; Carrera larga 16 km → Tempo 9.2 km; Carrera larga 16 km |
| 21/12/2026 | Descarga → Desarrollo / Trabajo específico → Descarga | 29.6 | 34.9 | 24 | 28.6 | Carrera larga 13.8 km → Carrera larga 13.8 km |
| 28/12/2026 | Trabajo específico → Descarga → Trabajo específico | 36 | 28 | 30 | 34.8 | Tempo 10 km; Carrera larga 16 km → Tempo 9.4 km; Carrera larga 16 km |
| 04/01/2027 | Trabajo específico → Trabajo específico → Trabajo específico | 36.2 | 35.4 | 30 | 35 | Tempo 10.1 km; Carrera larga 16 km → Tempo 9.5 km; Carrera larga 16 km |
| 11/01/2027 | Trabajo específico / Puesta a punto → Trabajo específico / Puesta a punto → Trabajo específico / Puesta a punto | 34 | 31.6 | 23.4 | 32.9 | Tempo 10.2 km; Carrera larga 13.6 km → Tempo 9.7 km; Carrera larga 13.5 km |
| 18/01/2027 | Puesta a punto → Puesta a punto → Puesta a punto | 20.4 | 19 | 14.2 | 19.7 | Carrera larga 8.7 km → Carrera larga 8.7 km |
| 25/01/2027 | — → — → — | 0 | 0 | 0 | 0 | sin calidad ni tirada larga → sin calidad ni tirada larga |

Motivos: la continuidad conserva la fase y sus fechas; la base medida del 09/11 es 30.9 km, obtenida de mediana, última semana y últimas dos semanas comparables. El primer volumen propuesto es 31.8 km. El incremento requiere carreras suficientes y sensaciones registradas compatibles. No recupera los incrementos previstos de semanas anteriores. Sin confirmar historial, la primera semana queda en 30 km y mantiene Desarrollo, con una pregunta visible sobre cobertura.

El [JSON de la comparación](continuidad-comparacion.json) conserva kilómetros, minutos, fechas y sesiones clave, junto con los motivos de cada semana. Mi plan muestra la misma comparación entre calendario vigente y propuesta antes de aceptar.

## Once revisiones semanales sucesivas

Después de aceptar cada revisión se registran las sesiones realmente realizadas esa semana antes de la siguiente. Las cifras siguientes son revisiones sucesivas, no las proyecciones de una propuesta única.

| Revisión | Fase | Referencia realizada (km) | Propuesta semanal (km) | Sesiones clave |
| --- | --- | ---: | ---: | --- |
| 09/11/2026 | Desarrollo | 30.9 | 31.8 | Tempo 8.8 km; Carrera larga 14.2 km |
| 16/11/2026 | Desarrollo | 31.8 | 32.7 | Progresivo 8.9 km; Carrera larga 14.9 km |
| 23/11/2026 | Descarga | 31.9 | 25.5 | Carrera larga 11.9 km |
| 30/11/2026 | Desarrollo | 31.9 | 32.8 | Progresivo 8.6 km; Carrera larga 15.6 km |
| 07/12/2026 | Desarrollo / Trabajo específico | 32.7 | 33.2 | Tempo 8.6 km; Carrera larga 16 km |
| 14/12/2026 | Trabajo específico | 32.8 | 33 | Tempo 8.5 km; Carrera larga 16 km |
| 21/12/2026 | Descarga | 33 | 26.4 | Carrera larga 12.8 km |
| 28/12/2026 | Trabajo específico | 33 | 33.2 | Tempo 8.6 km; Carrera larga 16 km |
| 04/01/2027 | Trabajo específico | 33.1 | 33.2 | Tempo 8.6 km; Carrera larga 16 km |
| 11/01/2027 | Trabajo específico / Puesta a punto | 33.2 | 29.1 | Tempo 8.7 km; Carrera larga 11.7 km |
| 18/01/2027 | Puesta a punto | 29.1 | 14.7 | Carrera larga 6.5 km |

Todas mantienen origen 05/10, específico 11/12 y puesta a punto 15/01. Las descargas siguen el 23/11 y el 21/12. Una descarga realmente completada no se interpreta como pérdida de base al revisar: se mantienen como referencia las semanas normales sin devolver los kilómetros reducidos. Una descarga sin completar sí sigue limitando la carga observada. La reducción final respeta la carrera del 25/01 y no incorpora intensidad.

## Cuándo volver a base

- **adjust**: Misma carrera, preparación vigente y sin pausa confirmada. Mantiene origen, fases y descargas. La carga parte de lo realizado si la cobertura está confirmada; con historial incompleto limita la referencia declarada y detiene el crecimiento.
- **goal_change**: Cambia fecha, distancia, tipo o demanda de terreno del objetivo. Reparte las fases desde la revisión para la nueva carrera. No traslada adaptación del objetivo anterior; conserva pasado y asociaciones. Cambiar solo el tiempo deseado no reinicia el calendario.
- **resume**: Pausa declarada, o al menos 14 días sin correr con historial confirmado. Reduce la referencia disponible y abre dos semanas cómodas. Repetir la revisión no vuelve a aplicar esa reducción ni mueve su origen. Una segunda pausa tras haber retomado sí inicia otra reentrada.
- **new**: Decisión explícita de nueva preparación, ausencia de calendario o bloque terminado. Crea un origen nuevo; la carga sigue limitada por evidencia y recuperación. Conserva las sesiones realizadas y sus registros.

El umbral de 14 días, la reentrada de dos semanas y los factores de reducción son reglas conservadoras del producto, no medidas de recuperación. Una pausa con historial completo sin carreras recientes no conserva automáticamente los 30 km antiguos: la propuesta parte del volumen observado, incluso cero, con sesiones de correr/caminar. No se interpreta como pausa la ausencia sin confirmar cobertura. Bicicleta, fuerza y registros de proveedores no acreditan continuidad de running.

Dolor relevante mantiene la pausa; fatiga alta reduce carga y suprime calidad sin cambiar por sí sola las fechas del calendario. Cerca de la carrera, la puesta a punto tiene prioridad sobre la vuelta a base: conserva la fecha, baja carga y advierte de las limitaciones; no comprime una preparación nueva.

## Pruebas y conservación

Las regresiones comprueban las fechas, fases, kilómetros, descargas y rotación de calidad; once revisiones semanales hasta la carrera; seis revisiones sin cobertura confirmada; pausa declarada repetida y segunda pausa real; ausencia confirmada; cambio de carrera, cambio de tiempo y bloque terminado; nueva preparación; revisión dentro de descarga y puesta a punto; calendarios antiguos; regeneración directa del motor; dolor y fatiga; conservación exacta de pasado, sesiones completadas, fuerza, carrera registrada, grupos, notas y asociaciones.

El servidor reconstruye también las propuestas con continuidad, acepta una revisión válida y rechaza una propuesta tras cambios de registros. SQLite de estas regresiones vive solo en memoria. La verificación HTTP usa su propia base en .tools/verify-*.

Las [pruebas de continuidad](../tests/planning-continuity.test.mjs) y [pruebas de interfaz](../tests/training-ui.test.mjs) verifican estos resultados mediante aserciones. Los [resultados de validación](continuidad-validacion.md) documentan la ejecución completa y la comprobación de los archivos originales.

La comparación puede regenerarse sin acceder a datos existentes:

```powershell
.\.tools\node.exe scripts/compare-planning-continuity.mjs
.\.tools\node.exe --test tests/*.test.mjs
.\.tools\node.exe node_modules/typescript/bin/tsc --noEmit
.\.tools\node.exe scripts/run-framework.mjs build
.\.tools\node.exe scripts/verify-state-http.mjs
```
