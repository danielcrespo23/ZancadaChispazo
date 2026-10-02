# Revisión funcional de Zancada

Fecha: 2 de octubre de 2026. Trabajo sobre la aplicación existente, conservando los registros y la estructura de almacenamiento. No se ha borrado ni sustituido la base del corredor. Las escrituras de prueba se hicieron en fixtures o en una D1 independiente dentro de `.tools/`.

Esta revisión inicial se amplió con el [seguimiento posterior a la actividad](seguimiento-actividades.md): archivos propios autorizados, datos desconocidos, agrupación/deshacer, comparación de bloques y revisión obligatoria antes de aplicar ajustes del registro. Los resultados numéricos de la sección inicial corresponden a aquella etapa; las pruebas actuales incluyen las ampliaciones.

## Problemas por impacto y soluciones comprobadas

| Prioridad | Problema detectado | Corrección y evidencia |
| --- | --- | --- |
| Crítica | Una pestaña antigua podía recrear un perfil borrado, e incluso sobrescribir un perfil nuevo al reutilizar su revisión. | La creación exige revisión inicial válida y el borrado conserva un contador creciente, con el JSON personal vacío. Prueba de regresión en SQLite y prueba HTTP con D1: las escrituras antiguas reciben 409 antes y después de crear otro perfil. |
| Crítica | Justo después del asistente inicial, Perfil y objetivo podía mostrar los valores vacíos del formulario anterior. Guardarlos podía sustituir la configuración recién creada. | El guardado de un perfil actualiza también su formulario. Chrome comprueba nombre y objetivo inmediatamente después de crear el plan, sin recargar. |
| Alta | Salir de la demostración conservaba el formulario de una actividad ficticia, que podía terminar guardándose en el espacio real. | Se restablecen formulario, selección, revisión y filtros al cambiar de modo. Chrome edita una actividad de demostración, sale y verifica que el formulario real esté vacío y los datos guardados sigan iguales. |
| Alta | Cambiar de sección ocultaba el error de guardado y el acceso a reintentarlo. | Aviso persistente de cambios sin guardar, reintento, exportación y protección al cerrar la pestaña. El guardado evita solicitudes simultáneas. Chrome simula un 503, cambia de sección y comprueba el reintento y la persistencia de los ajustes. |
| Alta | Editar la fecha del objetivo y reabrir podía modificar automáticamente el plan aceptado, añadiendo otra carrera. | La actualización de calendarios antiguos usa el objetivo con el que se creó el plan. Editar el perfil mantiene el calendario hasta aceptar la revisión. Prueba de regresión y recorrido en Chrome con reapertura entre edición y aceptación. |
| Alta | Editar la fecha de una carrera con vínculo automático seguía completando la sesión anterior. | El vínculo automático se calcula por la fecha realizada. Una carrera adicional deja de conservar el análisis de una sesión antigua. Pruebas y Chrome verifican desvinculación, vuelta a pendiente, revinculación y estadísticas. Los vínculos manuales siguen siendo explícitos. |
| Alta | Revisar un plan podía colocar una nueva tirada exigente junto a otra ya completada, sin 48 horas de separación. | La revisión considera las sesiones exigentes conservadas, incluidas las tiradas largas, y reduce la nueva carga. La prueba conserva el entrenamiento anterior y comprueba que el siguiente deje de ser exigente. |
| Alta | Las propuestas de progresión podían ocupar los minutos reservados a otros deportes. | Se comprueba el tiempo disponible después de restar otros deportes, los bloques, el reparto respecto a la tirada larga y la separación de sesiones exigentes. Se conserva la fase del entrenamiento. La regresión reproduce una propuesta que excedía una reserva de ciclismo y comprueba su rechazo. Las actividades de proveedores externos no cuentan como evidencia para subir carga. |
| Alta | Reorganizar permitía modificar sesiones realizadas o ignorar periodos declarados sin entrenamiento. La validación de planes no comprobaba expresamente los días disponibles. | Se protegen sesiones pasadas, omitidas y realizadas; se comprueban fechas reales, días, periodos bloqueados, minutos y recuperación. Las propuestas del servicio del entrenador usan las mismas restricciones. Pruebas de carrera y fuerza completadas, vacaciones y fecha inválida. |
| Crítica en las pruebas | El antiguo `smoke-local.mjs` borraba los datos del usuario local para ejecutar la prueba. | Se sustituyó por comprobaciones que dejan perfil, plan y actividades intactos. Las escrituras y el borrado se comprueban exclusivamente en una D1 aislada con `verify-state-http.mjs`. |

## Validación realizada

- **115 pruebas automáticas aprobadas.** Incluyen perfiles con distintas disponibilidades, suma de bloques, tiempos, distancias, ritmos, descarga, carrera, duplicados, conservación de sesiones y separación entre dos usuarios en el almacenamiento y el servicio del entrenador.
- **Recorrido completo en Chrome aprobado**, con 10 guardados en un API de prueba interceptado y cero excepciones JavaScript: asistente, objetivo, disponibilidad, creación y revisión del plan, perfil sin recarga, consulta de bloques, reloj de la guía, evento «Día de la carrera» en su semana, registro y edición de actividad, calendario, estadísticas, ajustes, fallo/reintento, demostración y reapertura.
- **HTTP y D1 reales aprobados en almacenamiento aislado:** guardado de perfil/objetivo/plan, actividad, lectura, parada y arranque del servidor con recuperación exacta de los datos, rechazo de revisiones antiguas, borrado y recreación, identidad no autenticada y origen inválido.
- **Instancia local existente:** respuestas de página, autenticación, lectura y rechazo de escrituras inválidas comprobados sin cambiar su perfil, plan ni actividades.
- **TypeScript y compilación de producción aprobados.** Los archivos nuevos y el motor/almacenamiento/configuración modificados pasan ESLint. La comparación con HEAD confirma que los errores de tipado flexible de la interfaz ya existían; el lint completo todavía no está limpio. No se desactivaron reglas para ocultarlo.

No se ha confirmado GPS, grabación en segundo plano, voz en todos los dispositivos ni sincronización con relojes. La guía se comprobó como instrucciones y temporizador en primer plano; no registra automáticamente una actividad. La captura de pantalla es opcional y no forma parte del resultado funcional.

## Limitaciones reales

- El motor sigue siendo orientativo y basado en reglas. Las pruebas comprueban coherencia interna; no constituyen una validación deportiva individual ni garantizan rendimiento.
- Los datos que el corredor no aporta siguen siendo desconocidos. Un ritmo suave declarado no se convierte en una marca competitiva ni en un umbral medido.
- Los cambios de perfil requieren calcular y aceptar un plan revisado. El calendario ya aceptado conserva su base hasta entonces.
- Un conflicto entre pestañas se rechaza; no hay fusión automática de dos versiones. Los cambios pendientes pueden exportarse antes de recargar.
- Los planes antiguos que necesitan otro reparto se revisan mediante propuesta; no se reescriben masivamente ni se eliminan registros para adaptarlos.
- El entrenador de la página responde con reglas. «Consultar con mi ChatGPT» prepara una consulta manual; no es una llamada directa a un modelo. La existencia del servicio de propuestas no confirma que un plugin esté instalado en una cuenta externa.
- El lint completo tiene deuda anterior de tipos `any` en la interfaz y otras reglas. Resolverla requiere trabajo de tipado independiente; no se realizó una refactorización general.

## Estado externo pendiente

- **Autenticación para usuarios reales:** el servidor local usa un único usuario simulado. La separación entre usuarios se ha probado en el almacenamiento y en el servicio; un inicio de sesión multiusuario real requiere el entorno de autenticación del despliegue. No se ha desplegado ni validado ese entorno externo.
- **Strava:** la instancia existente devuelve configuración completa y estado `connection_error`, sin actividades disponibles. No se ha completado ni comprobado una autorización real satisfactoria durante esta revisión. Hay que resolver su conexión externa y verificar OAuth y consulta antes de darla por operativa. No se han editado credenciales ni se ha iniciado una nueva autorización. Los registros propios funcionan sin esta integración.

## Repetir las comprobaciones

```sh
npm test
npm run check:types
npm run build
npm run verify:storage
# Con el servidor de desarrollo abierto en 127.0.0.1:5173:
npm run verify:local
# Con Chrome de prueba y depuración local en 9223:
npm run verify:browser
```

`verify:storage` necesita el puerto 5174 libre y mantiene sus artefactos dentro de `.tools/verify-<id>/`; no comparte la base habitual. La prueba de navegador intercepta `/api/*` antes de navegar, por lo que sus guardados no llegan a los datos del usuario.
