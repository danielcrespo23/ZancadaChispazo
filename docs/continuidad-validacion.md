# Validación de la continuidad

Comprobaciones realizadas sobre datos ficticios. La comparación completa de fases, volumen y sesiones está en [continuidad-planificacion.md](continuidad-planificacion.md) y sus datos reproducibles en [continuidad-comparacion.json](continuidad-comparacion.json).

## Cambios

- lib/planning-rules.mjs: decisión compartida entre ajustar, cambiar objetivo, retomar y crear preparación; origen de fases y descargas independiente del día de revisión; reentrada acotada y puesta a punto ligada a la carrera.
- lib/training.mjs: referencia futura desde registros reales cuando se confirma cobertura; ausencia no confirmada no se convierte en pausa; no se atribuye adaptación por semanas transcurridas; comparación antes/después con motivos; conservación del pasado y de sesiones completadas, incluidos fuerza y carrera.
- lib/engine.mjs: calendario aceptado y número de semana conservados al generar futuras sesiones; rotación de calidad estable; incrementos condicionados a evidencia; regeneración antigua conserva el reloj del plan.
- lib/race-coach.mjs: fase y recorrido usan las fechas conservadas del calendario.
- app/training-hub.tsx: elección de tipo de revisión, confirmación de cobertura y comparación de fases, kilómetros, minutos y sesiones clave antes de aceptar.

La protección anterior contra propuestas desactualizadas sigue activa. El servidor reconstruye también las propuestas con estos nuevos datos de continuidad.

## Casos comprobados mediante aserciones

| Caso | Resultado comprobado |
| --- | --- |
| Media maratón 05/10/2026 → 25/01/2027, revisión 09/11 | Desarrollo permanece; específico 11/12; puesta a punto 15/01; carrera 25/01; descarga 23/11 |
| Historial completo frente a no confirmado | Misma distribución de fases; referencia realizada 30,9 km y primera propuesta 31,8 km con registros; 30 km sin cobertura, sin crecimiento y con pregunta visible |
| Once revisiones semanales hasta 18/01 | Origen y bloques idénticos; descargas 23/11 y 21/12; rotación tempo/progresivo; carga evoluciona con lo registrado; no hay compensación después de descarga |
| Seis revisiones con historial vacío o parcial sin confirmar | Se mantiene la preparación; se pregunta por cobertura; no se inventa una pausa ni adaptación |
| Pausa declarada | Referencia declarada de 30 km reducida a 18 km; reentrada cómoda hasta 23/11 |
| Repetir la vuelta por casilla o selector | No vuelve a reducir 18 km, no mueve el origen 09/11 ni aplaza la reentrada; una segunda pausa tras haber corrido abre un episodio nuevo |
| Pausa real y cobertura confirmada | Se detectan al menos 14 días sin correr; volumen observado cero no reutiliza 30 km antiguos |
| Bicicleta, fuerza y datos de proveedores durante la pausa | No se convierten en carreras para ocultar la pausa de running |
| Cambiar a 10 km el 15/02/2027 | Decisión de cambio de objetivo; nuevo origen 09/11; carrera nueva exacta; pasado y asociaciones preservados |
| Preparación nueva para la misma carrera | Decisión explícita distinta del ajuste: origen 09/11, específico 25/12 y carrera 25/01 |
| Cambiar solo tiempo deseado | Mantiene las fechas del calendario; no atribuye capacidad al nuevo tiempo |
| Revisión durante puesta a punto, incluso tras una pausa | Mantiene la carrera; factores de reducción 0,70 y 0,45; ninguna nueva sesión exigente |
| Revisión dentro de descarga y repetición el mismo día | Se conserva lo restante de la descarga; la siguiente semana no cambia al aceptar y recalcular sin nuevos registros |
| Revisión ordinaria repetida el mismo día | No acumula incrementos ni cambia el volumen de las semanas futuras |
| Descarga realmente realizada frente a omitida | Solo la realizada puede excluirse de la referencia de semanas normales; omitirla sigue limitando el volumen observado |
| Fatiga y molestias actuales o registradas | Menor carga y sin calidad, o pausa por molestias relevantes, sin reiniciar automáticamente las fechas |
| Sesiones ya completadas | Igualdad exacta de las sesiones anteriores, fuerza y carrera registrada; notas, grupos y asociaciones conservados |
| Calendarios antiguos y regeneración del motor | Se conserva el origen guardado; si no existe schedule, se recupera del inicio del calendario |
| Persistencia en servidor | Revisión válida guardada con origen 05/10 y específico 11/12; se conservan registros; reproducción desactualizada rechazada sin escritura |

Las pruebas están en [planning-continuity.test.mjs](../tests/planning-continuity.test.mjs) y [training-ui.test.mjs](../tests/training-ui.test.mjs). SQLite de continuidad se ejecuta en memoria y fija explícitamente el día de revisión del caso.

## Resultados

- **263/263 pruebas pasan**, incluidas **17 regresiones nuevas** de continuidad y representación de la comparación. Ninguna omitida.
- **Tipos pasan**: tsc --noEmit.
- **Compilación pasa**: scripts/run-framework.mjs build.
- **HTTP y D1 aislados pasan**: aceptación válida y persistencia tras reiniciar; rechazo de propuestas antiguas tras cambios de molestias, disponibilidad, actividades y objetivo; la revisión actual no permite eludir la reconstrucción del servidor.
- **Lint no añade errores ni advertencias** en los archivos de esta entrega. Persisten 51 errores y 6 advertencias previos en los archivos comprobados; comparación con el estado anterior en .tools/continuity-lint-comparison.json.
- **10 archivos originales comparados con SHA-256; cero cambios**, incluidos .wrangler/state y .dev.vars. No se migraron ni borraron datos.
- **Diff sin errores de espacios**.

Registros de ejecución: .tools/continuity-tests.log, .tools/continuity-regressions.log, .tools/continuity-build.log y .tools/continuity-http.log. La verificación HTTP crea su base dentro de .tools/verify-*; no se ha recorrido una sesión personal en el navegador. La interfaz se comprobó mediante representación y aserciones automáticas.

La carga futura continúa siendo una propuesta: completar una fase del calendario no prueba adaptación. El historial confirmado, las sensaciones y las limitaciones actuales deciden la carga que puede proponerse.
