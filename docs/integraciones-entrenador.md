# Integraciones y entrenador: revisión del 2 de octubre de 2026

La planificación determinista, el calendario, el registro manual y el chat por reglas funcionan sin credenciales externas, sin consentimiento para IA y sin un modelo. Los datos anteriores se conservan. No se migran carreras de Strava al historial de entrenamiento.

## Condiciones del proveedor

Se han consultado las condiciones actuales antes de modificar la integración. La [política de Strava](https://www.strava.com/legal/api_policy), vigente desde el 1 de junio de 2026, restringe análisis, combinación con otros datos, uso con IA y almacenamiento permanente. Zancada muestra exclusivamente las actividades del atleta autenticado, con caché de hasta siete días en servidor y sin guardar actividades en el modo PC. OAuth concede los permisos solicitados y concedidos; no habilita tratamientos prohibidos.

Los registros con procedencia API de Strava quedan excluidos del motor, de las marcas válidas y del contexto de IA, aunque otro campo los etiquete como manuales. Los archivos propios autorizados siguen sirviendo al seguimiento determinista, pero el consentimiento actual de IA abarca solo registros introducidos directamente en Zancada. Las notas de Strava permanecen separadas. No se aconseja copiarlas al registro manual para evitar estas restricciones.

El propietario debe comprobar la elegibilidad, la capacidad y las cuotas de su aplicación en el panel del proveedor. El [programa de desarrolladores actualizado](https://communityhub.strava.com/insider-journal-9/an-update-to-our-developer-program-13428) incluye condiciones y niveles propios: no se promete que la integración externa sea gratuita. El [changelog oficial](https://developers.strava.com/docs/changelog/) anuncia otro dominio de API para el 4 de enero de 2027; ahora se conserva el dominio actualmente documentado.

## Correcciones de Strava

| Problema | Comportamiento comprobado con proveedor de pruebas |
| --- | --- |
| Una cuenta guardada se presentaba como acceso vigente | Se diferencia cuenta vinculada, comprobación pendiente, autorización caducada y credenciales no disponibles. Una comprobación con más de 15 minutos requiere verificar de nuevo. |
| OAuth podía anunciar sincronización antes de terminar | El retorno distingue autorización comprobada y consulta pendiente de consulta realmente completada. |
| Dos solicitudes intentaban usar un refresh token en rotación | Se serializa la renovación, se consulta la credencial más reciente y se guarda la nueva pareja cifrada antes de leer actividades. Renovación en curso se diferencia de límite de cuota. |
| Reautorizar conservaba caché y fecha de sincronización anteriores | Se vacían caché y trabajos de esa conexión y se reinicia la fecha; las notas y otros usuarios se conservan. |
| Un trabajo correcto ocultaba un fallo terminal anterior | La conexión permanece incompleta o con error mientras exista un trabajo fallido. |
| El filtro de privadas no se aplicaba | Se respeta la selección además del alcance realmente concedido. |
| Una fecha local imposible podía mostrarse | Se validan fecha y hora locales; registros inválidos o una consulta truncada dejan el estado incompleto. |
| La variable de cron parecía demostrar su ejecución | Se diferencia configuración declarada de la fecha de una limpieza realmente ejecutada. |

La autorización es individual. El estado OAuth es aleatorio, de un solo uso, ligado al usuario y a una cookie, y caduca a los quince minutos. Los permisos efectivos de la respuesta del proveedor prevalecen sobre los del retorno; también se revisan al renovar si el proveedor los devuelve. Una pérdida de permisos elimina la caché correspondiente y bloquea las consultas, incluidas las que esperan esa renovación. Access y refresh tokens se cifran con AES-256-GCM, IV aleatorio y el usuario como dato autenticado. Se validan claves de 32 bytes y fechas de expiración futuras; el navegador no recibe secretos. La versión de conexión bloquea escrituras antiguas tras desconectar. [OAuth oficial](https://developers.strava.com/docs/authentication/).

Duplicados se identifican por usuario y actividad externa; las modificaciones reemplazan datos de esa actividad. Los eventos de borrado se confirman mediante la API autenticada, y se reconcilia la caché. Se usa la fecha local del proveedor, no la fecha UTC cortada. Desconectar elimina tokens, caché y trabajos; conserva perfil, plan, registros manuales y notas propias. Si falla la revocación remota, se indica cómo revocar en Strava. [Webhooks oficiales](https://developers.strava.com/docs/webhooks/).

Para producción siguen siendo necesarios aplicación y credenciales válidas, dominio de retorno correcto, usuarios individuales autenticados, cuotas/capacidad suficientes, migraciones D1 y un programador comprobado; webhook/relay si se reciben eventos. Tener variables no demuestra OAuth, consulta ni cron operativo. Los detalles están en [README-Strava](../integrations/README-Strava.md).

## Chat y modelo opcional

El chat es la primera sección de **Mi entrenador**. El modo predeterminado responde por reglas usando perfil, objetivo, plan y registros manuales, y lo identifica en cada respuesta. No hace llamadas a un modelo. La consulta manual copiable a ChatGPT sigue disponible en una sección plegable; requiere pegarla allí y no constituye una conexión de API.

Ollama es una integración HTTP real, opcional y limitada a la versión PC de desarrollo. Solo se consulta `127.0.0.1:11434`: el navegador no puede proporcionar otra URL. Antes de transmitir contexto se comprueban instalación y metadatos de un modelo local de texto. Se rechazan modelos cloud, alias remotos y respuestas sin prueba de archivos locales. La consulta de estado no demuestra generación. [Detalles del modelo](https://docs.ollama.com/api-reference/show-model-details).

El consentimiento se guarda por usuario y puede retirarse en el chat. MCP también lo exige. Se envían campos deportivos seleccionados; se excluyen nombre, correo, tokens, notas libres, actividades de Strava y archivos externos. El servidor obtiene el contexto de la cuenta autenticada, exige su revisión vigente y comprueba que no haya cambiado durante la respuesta.

El modelo selecciona explicaciones del motor y puede proponer **mover, reducir o descansar** hasta tres sesiones futuras pendientes. Esta limitación es deliberada: no genera asesoramiento libre ni una prescripción fisiológica nueva. La respuesta estructurada debe corresponder al modelo solicitado, estar terminada y utilizar hechos conocidos. Se validan disponibilidad, bloques, recuperación, pasado, sesiones completadas y carrera. Una salida inventada, insegura o fallida vuelve a reglas locales con explicación. [API chat de Ollama](https://docs.ollama.com/api/chat).

Una propuesta muestra antes y después. Guardarla solo la añade a pendientes; aceptar vuelve a comprobar el plan y permite deshacer en Mi plan o Historial, siempre que las sesiones sigan futuras y sin otros cambios. Ni el chat ni MCP aplican cambios automáticamente. La opción local permanece desactivada en la compilación remota.

## Instalación opcional en este PC

Se han comprobado Windows x64, 16 GB de RAM y aproximadamente 28 GB libres. No se ha comprobado compatibilidad de GPU, velocidad de inferencia ni consumo real del modelo. Ollama no está instalado y su puerto local no responde fuera de las pruebas.

1. Instala [Ollama para Windows](https://ollama.com/download/windows). Requiere Windows 10 22H2 o posterior y al menos 4 GB de espacio para la aplicación, además del modelo. [Requisitos oficiales](https://docs.ollama.com/windows).
2. Configura `OLLAMA_NO_CLOUD=1` como variable de usuario de **Ollama**, sal de Ollama y vuelve a abrirlo. Esto desactiva funciones cloud; no basta con poner esa variable en `.dev.vars` de Zancada. [Configuración oficial](https://docs.ollama.com/faq#how-do-i-disable-ollama-cloud-features).
3. Ejecuta `ollama pull llama3.2:3b`, después `ollama list`. El [modelo propuesto](https://ollama.com/library/llama3.2:3b) ocupa unos 2 GB y admite español; no se ha probado su calidad aquí.
4. Añade a `.dev.vars`, conservando las variables existentes:

   ```dotenv
   ZANCADA_OLLAMA_ENABLED=true
   OLLAMA_MODEL=llama3.2:3b
   ```

5. Reinicia Zancada. En **Mi entrenador**, pulsa **Comprobar modelo**, concede el consentimiento y elige Ollama. Una respuesta válida confirma esa generación; si falla o tarda más de 25 segundos, se responde por reglas y se indica el fallo.

No exige facturación de API, aunque usa los recursos del PC. No se ha descargado ni instalado un modelo automáticamente. ChatGPT y su API tienen acceso y facturación separados; una suscripción de ChatGPT no incluye saldo gratuito de API. [Información oficial de OpenAI](https://learn.chatgpt.com/docs/pricing).

## Verificación y límites

- `npm test`: regresiones del motor y de las integraciones, con bases SQLite y proveedores controlados. Incluye usuarios separados, cifrado, OAuth/state/replay, scopes, renovación concurrente, duplicados, modificaciones, eliminaciones, fecha local, desconexión, retención, consentimiento y rechazo de respuestas inseguras.
- `npm run verify:storage`: HTTP y D1 aislados, autenticación/origen, revisión del contexto, respuesta local, MCP con consentimiento y retirada, y persistencia tras reiniciar el servidor.
- `npm run verify:integrations`: Chrome real con todas las rutas de datos interceptadas antes de navegar. Comprueba chat visible, consentimiento, estados, propuestas, aceptación/deshacer, fallo del modelo, reapertura y móvil. El proveedor de esta prueba es ficticio.
- `npm run verify:browser`: recorrido completo anterior, con perfil, objetivo, plan, calendario, registro, ajustes y reapertura.

No se ha validado OAuth real con una cuenta de Strava, cron/webhook desplegados, acceso multiusuario de producción ni generación con un modelo Ollama instalado. El ensayo HTTP de Ollama comprueba el protocolo y los límites con un servidor de pruebas; no prueba calidad ni rendimiento de un modelo real. Estas comprobaciones externas siguen pendientes y la interfaz no las presenta como realizadas.

La instancia local tiene variables de Strava configuradas, pero la comprobación real del estado devuelve `connection_error`: la renovación no recibió una respuesta HTTP del proveedor. No se atribuye el fallo a permisos o credenciales sin esa evidencia. Ollama devuelve `disabled`, `available=false` y `generationVerified=false`. Se ha comparado el estado original completo tras las pruebas: perfil, plan, actividades, ajustes y revisión permanecen idénticos. Pasan 197 pruebas automáticas, TypeScript y la compilación de producción. Los tres recorridos de Chrome pasan sin errores de ejecución; HTTP/D1 comprueba también consentimiento y contexto tras reiniciar el servidor.
