# Zancada en tu PC

Abre **Iniciar-Zancada.cmd** y visita **http://localhost:5173**. Mantén la
ventana del servidor abierta mientras usas la aplicación. Ctrl+C lo detiene.
Esta instalación incluye un ejecutable de Node en `.tools`, excluido de Git.
Si distribuyes solo el código, instala Node.js 22.13 o posterior y las dependencias.

## Strava sin servidor público

En el panel de tu aplicación de Strava configura:

- Sitio web: `http://localhost:5173`.
- Authorization Callback Domain: `localhost`.

Las credenciales están en `.dev.vars`, nunca en el navegador. El retorno debe ser
`STRAVA_REDIRECT_URI="http://localhost:5173/api/strava/callback"`.
Abre Ajustes y pulsa **Connect with Strava**; acepta los permisos en Strava.
La autorización real requiere tu intervención y conexión a Internet.

En desarrollo con retorno local, las actividades se consultan directamente y
solo se devuelven en la respuesta: no se escriben en la base de datos ni se
mantiene una caché de actividades en el servidor. No necesitas cron ni webhook.
**Deja `STRAVA_RETENTION_JOB_ENABLED=false`**: el requisito de limpieza no se
aplica a este modo sin caché. En producción sigue siendo obligatorio.

Los tokens se conservan cifrados para que no tengas que autorizar cada vez.
Al completar OAuth se consultan automáticamente los últimos siete días (168 horas).
Las fechas mostradas conservan la hora local que devuelve Strava; los filtros de
la API utilizan segundos Unix en UTC, no milisegundos. Se solicita también acceso
a carreras privadas, salvo que desmarques esa opción al autorizar. Si Strava no
concede ese permiso, la interfaz lo indica y permite volver a autorizar.

La consulta muestra hasta 1.000 actividades del periodo seleccionado; puede incluir
menos carreras si hay otros deportes. No consulta los detalles de cada actividad:
las vueltas y otros campos ausentes del listado aparecen como no disponibles.
Actualizar consulta de nuevo a Strava y respeta sus cuotas compartidas.
Si había una caché o trabajos antiguos de Strava, este modo los elimina al
consultar su estado. Tus registros propios y planes se mantienen.

El entrenamiento usa tu perfil y los registros propios de Zancada. Las actividades
de Strava se muestran aparte; no se usan para análisis ni para consultas de IA.
No distribuyas `.dev.vars`, `.tools`, `.wrangler` ni tus credenciales a amigos.
Esta copia simula un usuario local; no es todavía una app nativa para iOS.

Si vuelves de Strava y aparece un error, vuelve a conectar desde la misma ventana.
La cookie OAuth solo dura quince minutos y el código de autorización solo se puede
utilizar una vez. Un error de Internet, permisos o cuota se muestra como error;
«No se encontraron carreras» solo aparece tras una consulta correcta.

En la ventana del servidor hay diagnósticos con prefijo `component: strava`:
validación del estado, intercambio o renovación de tokens y consulta de actividades.
Indican estado HTTP, intervalo y conteos; no muestran tokens, secretos, nombres,
IDs de usuario ni URLs OAuth. Los tokens siguen cifrados en D1. En el modo PC no
se persisten las actividades: cada consulta vuelve a leer Strava.

Arranca con `Iniciar-Zancada.cmd` desde Windows. Si un entorno de desarrollo
aislado bloquea las peticiones de red con `EACCES`, la aplicación no podrá
intercambiar el código ni leer actividades hasta arrancar fuera de ese aislamiento.

## Preparar una carrera

1. Guarda distancia y fecha en Perfil, junto con tu volumen reciente, tirada larga,
   días disponibles y minutos por día. Añade una marca reciente si la conoces.
2. En **Mi plan**, revisa y acepta la propuesta de preparación.
3. Consulta la nueva tarjeta de carrera: días restantes, prioridad de la fase,
   sesión clave, resumen semanal y las próximas ocho semanas.
4. Registra las carreras que realizas y tus sensaciones. Revisa los ajustes
   propuestos antes de aplicarlos; no compenses las sesiones omitidas.
5. Si has dejado de correr durante dos o más semanas, abre **Revisar plan** y
   marca **Retomo tras dos o más semanas sin correr**. La propuesta usa una base
   menor y elimina calidad durante los primeros catorce días; conserva la carrera
   y el historial. Los porcentajes son una regla conservadora del motor, no una
   medición individual de recuperación.

No se ha validado una conexión con una cuenta real hasta que completes OAuth.

## Chat de entrenamiento sin servicios externos

En **Mi entrenador** está visible el chat por reglas: usa tu contexto y no pide claves ni una suscripción de API. La consulta manual para ChatGPT está debajo, plegada.

Ollama es opcional y requiere instalar y descargar un modelo, desactivar sus funciones cloud, configurarlo y conceder consentimiento. Los [pasos, requisitos y comprobaciones](docs/integraciones-entrenador.md#instalación-opcional-en-este-pc) explican cómo hacerlo sin modificar las credenciales existentes. Este PC dispone de 16 GB de RAM, pero no se ha probado inferencia real; Ollama no está instalado ahora. Si falta el modelo, sigue funcionando el chat por reglas.
