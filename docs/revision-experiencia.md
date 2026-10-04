# Revisión de la experiencia del corredor

Fecha: 4 de octubre de 2026. Revisión terminada para los criterios y entornos descritos aquí. Se conservaron los perfiles originales: la huella de sus datos y revisiones en SQLite permanece igual antes y después de las pruebas. El alcance no incluye instalar servicios externos ni reescribir la aplicación.

## Lista priorizada y criterios de aceptación

| Prioridad | Problema e impacto | Criterio de aceptación | Estado |
| --- | --- | --- | --- |
| Alta | Inicio destaca una sesión futura y obliga a deducir si hoy se corre. | Distingue entrenamiento de hoy, descanso, sesión realizada, omitida y bloque terminado; ofrece la siguiente sesión con su fecha sin sugerir adelantarla. | Comprobado |
| Alta | Una molestia relevante de hoy no destaca frente al entrenamiento aceptado. | Se ve la precaución antes de salir y el detalle considera las sensaciones guardadas; el calendario no cambia sin aceptación. | Comprobado |
| Alta | Editar una meta puede mostrar un objetivo diferente al calendario aceptado. | Inicio distingue la meta del plan vigente de cambios de perfil pendientes; la fecha de carrera sigue siendo la aceptada. | Comprobado |
| Alta | Una base antigua sin motivos de generación podía cerrar la pantalla del plan. | El calendario sigue visible, se identifica la explicación ausente y no se modifican datos para inventarla. | Comprobado |
| Alta | Siete destinos y letras de 9 px dificultan la navegación móvil. | Cinco acciones principales legibles, destinos secundarios accesibles, estado actual identificado y controles de al menos 44 px en las acciones principales. | Comprobado |
| Alta | El modal incluye controles ocultos en su manejo de Tab y pierde el punto de regreso. | Foco visible, Tab dentro del diálogo, Escape cierra, fondo inactivo y retorno al control que lo abrió. | Comprobado |
| Alta | Texto secundario, controles y ciertos estados tienen poco contraste. | Medición de colores reales en temas claro y oscuro: texto normal ≥4,5:1, texto grande ≥3:1 y contornos/foco relevantes ≥3:1. | Comprobado |
| Alta | Errores de red o respuestas inválidas pueden mostrar mensajes técnicos. | Carga anunciada, reintento comprensible, borradores intactos y errores de guardado visibles sin afirmar éxito; conflictos conservan exportación. | Comprobado |
| Media | El registro mezcla medidas opcionales con los datos necesarios. | Fecha, distancia/duración, tipo y sensaciones están accesibles; FC, desnivel y pausas se despliegan opcionalmente, sin exigir datos desconocidos. | Comprobado |
| Media | La interpretación posterior y sus cambios aparecen después de comparaciones largas. | Se muestra primero qué implica para el plan; comparación y datos ausentes siguen disponibles, con propuestas revisables y reversibles. | Comprobado |
| Media | Vacíos y filtros sin resultados no indican claramente el siguiente paso. | Mensajes distintos para falta de plan, falta de carreras y filtro vacío; acciones concretas para continuar. | Comprobado |

El criterio de contraste sigue la [documentación W3C](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), sin redondear un valor inferior para aprobarlo. Los 44 px son un criterio de producto para las acciones principales; el mínimo AA de WCAG 2.2 y sus excepciones se describen en [tamaño de objetivos](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html). Se comprobó también el manejo del [foco](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html). No equivale a una certificación completa de accesibilidad.

## Las cinco preguntas del corredor

- **¿Qué entreno hoy?** La tarjeta de Inicio distingue la fecha actual de la próxima sesión. Una carrera sin vincular de hoy advierte antes de sugerir otra salida. Al terminar el bloque hay acceso al siguiente objetivo.
- **¿Cómo lo hago?** Acceso al detalle con calentamiento, bloques, recuperaciones, vuelta a la calma, esfuerzo, conversación, referencias y alternativa por cansancio.
- **¿Por qué me toca?** Propósito y motivo del motor junto a la sesión; los límites de minutos por día se explican en la revisión.
- **¿Cómo voy?** Estadísticas de lo realmente registrado, constancia y evolución comparable. Las estimaciones del plan siguen diferenciadas de lo realizado.
- **¿Qué cambia después de mi carrera?** Acceso al análisis y decisión antes de las tablas. Las propuestas siguen requiriendo aceptar; puede rechazarse o deshacerse sin borrar notas ni pasado.

## Escenarios que deben quedar comprobados

1. Principiante sin marcas: esfuerzo/conversación, referencia ausente explícita y bloques coherentes.
2. Corredor regular con marca reciente válida: referencias y calidad justificadas.
3. Objetivo con siete semanas: fases según plazo y carrera en su fecha.
4. Meta próxima/exigente: explicación y alternativas compatibles con flexibilidad.
5. Poco tiempo: disponibilidad y duración respetadas, sin acumular carga.
6. Registro con/sin FC: estadísticas inmediatas y ninguna referencia fisiológica inventada.
7. Carrera más rápida a mayor esfuerzo/otro terreno: no dispara una progresión.
8. Fatiga, molestias y sesiones perdidas: precauciones, revisión explícita y ninguna compensación automática.
9. Aceptar, rechazar y deshacer: calendario coherente y pasado conservado.
10. Dos usuarios: almacenamiento y propuestas independientes.
11. Cerrar/reabrir y reiniciar servidor: datos y revisión conservados.
12. Día de la carrera y sumas de bloques: fecha y unidades correctas.

## Resultados

Todas las comprobaciones siguientes pasaron tras corregir los fallos encontrados:

- **206 pruebas automatizadas** del motor, cuestionario, seguimiento, almacén, usuarios, permisos e integraciones. Los proveedores de estas pruebas están simulados; SQLite/D1 usa almacenes aislados según el archivo.
- **Chrome con API controlada:** configuración y plan (23 guardados de prueba), seguimiento (17), integraciones (5) y experiencia (2). Cero excepciones de ejecución en los cuatro recorridos. Los guiones interceptan las API antes de navegar y conservan los perfiles originales.
- **85 vistas y estados de contraste y controles:** 42 vistas principales (siete pantallas × dos temas × anchuras 1280, 360 y 320 px) y 43 estados adicionales de calendario, tipos de sesión, detalle y explicación antigua ausente. 9.070 mediciones de texto visible sin incumplimientos detectados en esas vistas. Se comprueban además valores y placeholders de formularios, contornos, foco, ausencia de desbordamiento de página, nombres de controles y tamaño de la navegación móvil. Se excluye el contenido de desplegables cerrados hasta abrirlo.
- **HTTP y D1 reales, aislados:** autenticación, origen de petición, revisiones, duplicados, medianoche local, agrupación, consentimiento/revocación, reinicios y dos aperturas nuevas de Chrome. Sin fixtures de API en la comprobación de reapertura.
- **Tipos y compilación:** TypeScript y build completados. ESLint de los componentes y módulos nuevos que se verificaron, sin errores; no se afirma que el lint global del repositorio esté limpio.
- **Inspección visual:** captura móvil de Chrome; identidad azul oscuro/lima conservada y navegación legible. La captura contiene un perfil ficticio.

El reintento se contrastó con fallo HTTP 503 y edición de 5 a 5,2 km antes de reintentar: guardó 5,2 km y abrió el análisis. Los fallos de carga y JSON inválido muestran un mensaje comprensible y permiten reintentar. El diálogo se comprobó con Tab, Shift+Tab, Escape y retorno al control inicial; el enlace de saltar al contenido también funciona con teclado.

Las comprobaciones adicionales detectaron y corrigieron contraste de etiquetas de tipos de sesión, «Completada» y recuperaciones atenuadas en cuestas. Se usan sesiones del motor para construir estados de presentación; su combinación en este fixture de colores no representa una recomendación de entrenamiento. La validez deportiva de los planes completos se comprueba por separado en los perfiles de la tabla. Un calendario sin motivos de generación se reabrió sin cambiar su contenido y mostró la información ausente, en lugar de cerrar la pantalla.

| Escenario | Pruebas y resultado |
| --- | --- |
| 1. Principiante sin marcas | `runner-review`, `onboarding-plan`, `questionnaire-decisions` y navegador de configuración: minutos, esfuerzo y conversación; sin ritmos de rendimiento inventados. |
| 2. Corredor con referencias recientes | `runner-review`, `precision` y `planning-rules`: marca comparable, método explícito y calidad condicionada a la base. |
| 3. Siete semanas | `runner-review`: 49 días, fases adaptadas y una carrera en su fecha exacta. |
| 4. Meta próxima/exigente | `runner-review` y `planning-rules`: diez días para maratón no comprimen meses; cautela, alternativas y ausencia de calidad nueva. El navegador comprueba elegir una alternativa antes de aceptar su calendario. |
| 5. Poco tiempo | `runner-review`: 15, 20 y 30 min en tres días; suma de todos los bloques dentro de cada límite. `planning-rules` cubre restricciones adicionales. |
| 6. Con/sin FC | `runner-review`, `activity-followup` y Chrome: estadísticas inmediatas; un valor desconocido conserva su ausencia y no fija ritmos. |
| 7. Carrera rápida con condiciones distintas | `runner-review` y `progression`: esfuerzo 8/10, trail y calor no se toman como progreso comparable; una carrera rápida no dispara un aumento. |
| 8. Fatiga, molestias y omisiones | `runner-review`, `conservative` y Chrome: precaución, alternativa de descanso, omisiones confirmadas y ninguna recolocación automática. |
| 9. Aceptar/rechazar/deshacer | `runner-review`, `activity-followup`, `coach-plan` y Chrome: decisiones explícitas, reversión conjunta y conservación de registros y notas. |
| 10. Dos usuarios | `state-store`, `strava-flow` e `integration-boundaries`: identidades ficticias distintas, operaciones reales del almacén sobre SQLite aislado, propuestas y credenciales separadas. No es una prueba de dos logins reales en producción. |
| 11. Cerrar/reabrir | HTTP y D1 aislados tras reiniciar el servidor; Chrome cierra y abre dos pestañas con lecturas reales de esa base, sin interceptar API. Perfil y actividades recuperados, estado y revisión sin cambios. También se reabren flujos con fixtures. |
| 12. Carrera y bloques | `runner-review`, `session-prescription`, `planning-rules` y navegador: «Día de la carrera», fecha exacta, recuperaciones entre repeticiones y totales/conversiones coincidentes. |

```sh
npm test
npm run check:types
npm run build
npm run verify:storage -- --browser
npm run verify:browser -- http://127.0.0.1:5273
npm run verify:followup -- http://127.0.0.1:5273
npm run verify:integrations -- http://127.0.0.1:5273
npm run verify:experience -- http://127.0.0.1:5273
npm run verify:experience -- http://127.0.0.1:5273 --audit-only
```

Los guiones de navegador necesitan Chrome con depuración local en `127.0.0.1:9223`. El puerto 5273 fue el servidor aislado de esta revisión; admite otra dirección como argumento. Almacenamiento inicia y detiene su propio proceso en 5174 y crea una base nueva en `.tools/verify-<UUID>/state`; no cambia `.wrangler/state`. `--browser` requiere Chrome y añade dos aperturas reales. Los guiones no instalan ni habilitan depuración en un navegador personal.

## Límites reales y siguiente trabajo prioritario

No se han comprobado teléfonos físicos, Safari, VoiceOver o TalkBack. Las mediciones de color comprueban los estados visibles de los datos de prueba; no cubren todos los estados posibles, gradientes, imágenes o cada combinación de ayuda técnica. El siguiente trabajo de experiencia prioritario es una prueba de teclado virtual y lector de pantalla en un teléfono real, con estas mismas cinco preguntas como criterio.

La versión PC simula una sola identidad. La separación de almacenamiento está probada con usuarios ficticios independientes; un despliegue para personas reales necesita autenticación configurada y una prueba con dos cuentas reales. Los calendarios antiguos sin instantánea del perfil conservan su fecha/distancia de carrera, pero no permiten reconstruir con certeza la prioridad o el tiempo originales; aceptar una revisión crea la base trazable actual sin borrar registros pasados.

**Configuración externa pendiente:** esta revisión no completa OAuth con una cuenta real de Strava, no verifica una sincronización real ni instala/prueba inferencia de Ollama. Las pantallas se han contrastado con estados y respuestas simulados; planificación, registro manual y entrenador por reglas se comprobaron sin esos servicios. Consulta [condiciones, configuración y límites de las integraciones](integraciones-entrenador.md). No se garantizan marcas ni resultados deportivos.
