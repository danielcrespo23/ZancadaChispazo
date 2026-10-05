# Objetivo aceptado y propuestas vigentes

Revisión del 4 de octubre de 2026. Los casos se reprodujeron antes de modificar el código, con estados ficticios en memoria y SQLite aislado. No se utilizaron los registros personales de la instalación.

## Casos reproducidos

| Caso | Resultado anterior | Resultado corregido |
| --- | --- | --- |
| Generar y aceptar 10 km a 70 días; guardar 21,1 km a 7 días sin revisar el calendario | `raceCoaching` mostraba 7 días; el entrenador sustituía el resumen por un aviso de fechas | El resumen sigue mostrando 10 km y 70 días, mantiene la fase del calendario y muestra 21,1 km a 7 días como objetivo pendiente |
| Calcular una propuesta; declarar molestias relevantes ese mismo día | El motor aceptaba la propuesta antigua, tanto con molestias del perfil como del registro diario | Rechazo antes de cambiar calendario o historial; se ofrece recalcular |
| Cambiar días/minutos disponibles o añadir un periodo sin entrenamiento | El motor aceptaba la propuesta antigua | Se detectan los nuevos datos y se exige otra propuesta |
| Añadir, corregir, eliminar o vincular una actividad; completar o modificar una sesión | El motor podía aceptar una propuesta calculada con otro estado | La propuesta queda desactualizada; los registros se conservan |
| Cambiar fecha, distancia, tipo, tiempo o terreno del objetivo | Se podía aplicar una propuesta de otro objetivo | Se exige recalcular; la meta aceptada sigue separada de la pendiente |
| Enviar al servidor el plan antiguo con la revisión actual, sin pasar por la interfaz | El guardado devolvía HTTP 200 tras cambiar las molestias | Devuelve HTTP 409, `stale_plan_preview` y `recalculate: true`; estado y revisión permanecen intactos |
| Cambiar molestias y aceptar el plan antiguo en una sola petición, o alterar sus datos de origen | Los controles del navegador no protegían esta vía | El servidor contrasta tanto los datos guardados como los enviados y reconstruye la propuesta |

## Cambios

`acceptedGoal`, `goalAwaitingReview` y el mensaje de objetivo pendiente comparten implementación en `lib/plan-goal.mjs`. `lib/daily-focus.mjs` mantiene las exportaciones existentes. Inicio, Mi plan, entrenador local y contexto de IA, estrategia de carrera y estadísticas usan ese criterio. Los planes nuevos guardan una copia del perfil de generación. Los calendarios antiguos con carrera recuperan fecha y distancia de sus sesiones; no inventan el tiempo deseado a partir del perfil editado. Una carrera histórica conservada no reemplaza el objetivo de un bloque nuevo.

Cada propuesta guarda día, calendario de origen, huella estable de los datos, opciones de cálculo y revisión cuando procede del flujo persistido. La huella evita duplicar todo el estado y no funciona como autorización. El motor reconstruye el plan y compara sus prescripciones antes de aceptarlo. El servidor hace la misma validación contra su estado autenticado y mantiene la comprobación atómica de revisión al escribir.

PlanStudio utiliza la validación compartida y ofrece **Recalcular propuesta de plan**. Las propuestas de ChatGPT documentan la revisión leída y la revisión posterior a guardarlas; mantienen su restricción a datos manuales para el cálculo. Se conservan las actividades propias y la posibilidad de restaurar un calendario anterior verificado. Las propuestas antiguas sin datos de origen necesitan recalcularse; los calendarios existentes siguen disponibles.

## Resultados

- **246 pruebas automáticas pasan**, incluidas 40 regresiones nuevas del motor, servidor y representación de la interfaz.
- **Tipos y compilación pasan**.
- **HTTP y D1 real aislados pasan**: rechazos tras cambios de molestias, disponibilidad, actividades y objetivo; revisión actual sin posibilidad de eludir la revalidación; aceptación válida, conservación de registros y persistencia tras reiniciar.
- **Lint conserva los errores preexistentes**, sin errores ni advertencias añadidos en los archivos modificados; comparación con `HEAD` guardada en `.tools/review-protection-lint-comparison.json`.
- **10 archivos originales comprobados con SHA-256, ninguno modificado**, incluidos los de `.wrangler/state` y `.dev.vars`. No se borraron ni migraron los datos existentes.

Las pruebas HTTP crean su propia base dentro de `.tools/verify-*`. No se ha recorrido manualmente una sesión personal en el navegador.

```powershell
.\.tools\node.exe --test tests/*.test.mjs
.\.tools\node.exe node_modules/typescript/bin/tsc --noEmit
.\.tools\node.exe scripts/run-framework.mjs build
.\.tools\node.exe scripts/verify-state-http.mjs
```

Pruebas principales: `tests/plan-review-protection.test.mjs`, `tests/training-ui.test.mjs` y `scripts/verify-state-http.mjs`.
