# Revisión del chat de entrenamiento

Revisión del 05/10/2026. Se reprodujeron los problemas antes de editar. Se utilizaron perfiles ficticios; se conservan los datos existentes, los registros y las asociaciones. No se cambian credenciales ni se instala un modelo.

## Casos reproducidos y resultado

Perfil de ejemplo: corredor regular, 36 km semanales declarados y medidos, cuatro días de carrera, tirada medida de 14 km, ritmo cómodo declarado 6:30, molestias ausentes. Calendario iniciado el 07/09/2026 para media maratón el 25/01/2027. Consulta el lunes 05/10/2026; viernes disponible durante 120 minutos. No hay actividades registradas en este primer ejemplo: no se interpreta esa ausencia como inactividad.

| Consulta | Antes de modificar | Comportamiento actual |
| --- | --- | --- |
| ¿Por qué hoy tengo este entrenamiento? | Siguiente sesión y explicación genérica del método. | Identifica la recuperación del 05/10, 5,1 km, esfuerzo 2/10; utiliza propósito, fase, selección, recortes y sesiones exigentes cercanas del calendario. |
| Ayer hice CrossFit; ¿qué cambia? | Respuesta sobre la disponibilidad del sábado. | Sitúa la declaración el 04/10. Pide minutos y esfuerzo si faltan; utiliza registros propios si existen y revisa las sesiones exigentes dentro de 48 horas. No presupone que todo CrossFit sea exigente. |
| No tengo dolor, pero estoy cansado | Respuesta reservada al dolor relevante, con pausa de carrera. | Trata el cansancio por separado, pide fatiga de hoy y sueño, ofrece la alternativa pautada. «8/10» como seguimiento prepara una reducción de una sesión futura; no registra sensaciones ni cambia el calendario. Si hay dolor relevante guardado, muestra la contradicción y pide confirmarlo. |
| ¿Puedo cambiar la tirada al viernes? | Respuesta sobre el sábado. | Propone mover la tirada de 14,7 km del domingo 11/10 al viernes 09/10, con la misma sesión y carga; comprueba tiempo, disponibilidad, ocupación y recuperación. El borrador queda pendiente. |
| ¿Qué parte de los intervalos estoy haciendo demasiado rápido? | Explicación genérica de progreso. | Sin vueltas vinculadas pide fecha y bloques; no compara el promedio total con el ritmo rápido. Con el ejemplo adicional identifica la segunda repetición a 4:40 frente a 5:05–5:25 min/km previstos. Indica que falta temperatura. |
| ¿Por qué mi plan todavía no ha cambiado? | Respuesta de reorganización del sábado. | Muestra cuándo se calculó el calendario, su objetivo aceptado, propuestas pendientes y limitaciones de la evidencia. Explica que registrar o preguntar no acepta cambios. Pide confirmar si el historial está completo. |
| ¿Qué referencia necesitas para ajustar mis ritmos? | Respuesta genérica de la siguiente sesión. | Usa la evaluación de calibración del motor, separa capacidad estimada, ritmo cómodo observado y objetivo. Pide medición, esfuerzo, pausas y condiciones; con preparación insuficiente propone rodajes cómodos, no una prueba máxima. |

Para reproducir los ejemplos actuales:

```sh
node scripts/reproduce-coach-dialog.mjs
node --test tests/coach-dialog.test.mjs tests/coach-boundaries.test.mjs tests/coach-ui.test.mjs
```

También se comprueban «viernes que viene», fechas completas, una sesión de origen concreta, destinos alternativos ambiguos, negativa a cambiar, varias intenciones y «¿y la segunda?». En una pregunta sobre intervalos realizados y mover la tirada, cada tema conserva su propia sesión.

## Implementación y comprobaciones compartidas

`lib/coach-dialog.mjs` interpreta intenciones, negaciones, fechas, tipos y declaraciones. Produce observaciones, inferencias, propuestas y preguntas desde el calendario y registros actuales. `coach()` y el chat utilizan esa misma evaluación. La interpretación por reglas tiene vocabulario limitado: ante una referencia insuficiente solicita concretar en lugar de inventar una sesión o una medición.

`lib/coach-actions.mjs` concentra el constructor y la revalidación de propuestas para reglas, Ollama y MCP. Permite mover, reducir o descansar sesiones futuras pendientes; conserva pasado, carrera y sesiones realizadas. Usa las operaciones del motor, límites existentes y validación del calendario. No aplica automáticamente propuestas del chat, incluso con ajustes conservadores automáticos activados.

Cada borrador conserva petición original, día y firma de perfil deportivo, actividades autorizadas, sensaciones, sesiones completadas, disponibilidad y calendario. Al aceptar se reconstruye la operación y se compara con el borrador. El servidor rechaza firmas caducadas, modificaciones del borrador, creación y aceptación juntas, eliminación de la revisión para aplicar cambios y calendarios que no coinciden con la operación validada. Una revisión HTTP reciente no permite aceptar un borrador basado en datos antiguos.

Las propuestas antiguas sin estos metadatos siguen visibles y pueden rechazarse. Para aceptarlas hace falta recalcular; no se migran ni eliminan los datos originales.

La interfaz muestra el borrador sin aplicar y permite guardarlo para revisión. Después de cambiar datos marca las respuestas anteriores y deshabilita guardar sus propuestas. Si el estado o la revisión cambian mientras se obtiene una respuesta, la descarta. Las conversaciones de otras cuentas y de la demostración no aparecen en la cuenta activa.

`lib/coach-conversation.mjs` conserva referencias breves por usuario autenticado, con caducidad de 30 minutos, máximo de cuatro conversaciones por cuenta y 256 entradas totales. Conserva tema, sesiones y datos declarados, sin transcripción completa. El cliente envía un identificador opaco; el servidor obtiene su contexto. Cambio de día, cuenta o datos invalida las referencias anteriores. Un reinicio puede perder este contexto; se vuelve a pedir concretar.

La herramienta MCP `consultar_entrenador_running` consulta sin guardar ni aplicar cambios. Devuelve una propuesta validada y su petición; `proponer_ajuste_running` puede guardarla para revisión con control de concurrencia. Mantiene consentimiento y separación por cuenta. Las herramientas MCP y Ollama siguen limitadas a datos manuales autorizados; las reglas locales pueden analizar archivos propios autorizados. Strava permanece excluido del seguimiento.

## Ollama

Se mantiene el servicio local opcional y el formato JSON estricto. Los hechos ahora contienen el análisis concreto de la pregunta y sus referencias de seguimiento, con fecha y firma del estado. El modelo debe cubrir todas las intenciones y respetar las acciones permitidas para esa sesión y destino. No basta seleccionar un consejo genérico. Se rechazan texto inventado, hechos desconocidos o caducados, intenciones omitidas, otro destino, otras sesiones, acciones no solicitadas, aumentos, respuestas incompletas y llamadas a herramientas.

La respuesta inválida vuelve a reglas sin conservar acciones del modelo. No se exige una API de pago. Se ha validado el protocolo con un servidor Ollama ficticio y respuestas estructuradas controladas; no se ha descargado un modelo ni comprobado la calidad de una generación real instalada en este equipo.

## Resultados

- 347 pruebas automáticas pasan: 313 previas y 34 nuevas. Incluyen negaciones, ambigüedad, referencias de sesión, varios temas, vueltas, falta de temperatura, aislamiento y caducidad, aceptación válida, cambios de datos, propuestas alteradas y respuestas inválidas.
- `tsc --noEmit` y compilación de producción completados.
- `scripts/verify-state-http.mjs` pasa con servidor y D1 desechables: seguimiento autenticado, borrador sin cambiar calendario, rechazo tras molestias relevantes con la última revisión HTTP, seguimiento invalidado, aceptación válida y conservación tras reinicio.
- Las pruebas de interfaz renderizada verifican separación por cuenta y desactivación de propuestas antiguas o con cambios sin guardar.
- `scripts/verify-coach-browser.mjs` pasa en Chrome real con API y perfiles ficticios: seguimiento, explicación, propuesta pendiente, aceptación y deshacer, viernes, llegada de actividades durante una consulta, descarte de la respuesta anterior, botón de propuesta caducada desactivado, respuesta inválida de Ollama sin acciones y anchura móvil. Cero errores de ejecución. Requiere un servidor local de pruebas y Chrome con depuración en 9223; intercepta las peticiones de datos antes de navegar.
- La verificación de integraciones anterior también pasa en Chrome, incluida autorización y revocación, fallo del modelo, aceptación y deshacer, reapertura y estados de Strava. El lint de los módulos, rutas y pruebas del chat comprobados no presenta errores.

Las pruebas no utilizan la base personal `.wrangler/state`. Los diez archivos originales de datos y configuración comprobados conservan su SHA-256. No se modifican las variables privadas.
