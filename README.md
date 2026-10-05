# Zancada

Aplicación web de entrenamiento de running que crea un plan personal según tu nivel, tus días disponibles y tu objetivo de carrera.

- **Configuración guiada** la primera vez: cuenta, Strava (opcional), objetivo, experiencia, disponibilidad, molestias y revisión del plan.
- **Plan por reglas, sin IA**: base, desarrollo, descargas, puesta a punto y «Día de la carrera». Cada sesión indica calentamiento, bloque principal, recuperaciones y vuelta a la calma, con ritmos legibles («2 km a 6:00 min/km · 10 km/h»).
- **Valoración de la meta**: si es demasiado exigente, lo dice y propone alternativas. No promete resultados.
- **Seguimiento**: registra carreras o recibe archivos propios autorizados. Estadísticas y calendario distinguen completadas, realizadas con cambios, sin vincular y adicionales. Puedes corregir, agrupar y deshacer asociaciones; el análisis pide sensaciones ausentes y compara bloques. Los ajustes se muestran antes de aceptarlos y pueden deshacerse.
- **Datos separados por usuario**, comprobados en el servidor.

En **Inicio** puedes ver qué toca hoy, su propósito y cómo realizarlo. Después de registrar una carrera, el análisis explica primero qué implica para el plan. En móvil, **Más** abre entrenador, perfil y ajustes; las cinco acciones principales quedan siempre disponibles.

## Ejecutarlo en tu ordenador

Necesitas **Node.js 22.13 o posterior** ([descarga](https://nodejs.org/)) y conexión a Internet para instalar las dependencias. Los comandos son los mismos en Windows (PowerShell), macOS y Linux.

```sh
git clone https://github.com/danielcrespo23/ZancadaChispazo.git
cd ZancadaChispazo

# 1. Instalar dependencias (unos minutos la primera vez)
npm run install:ci

# 2. Compilar y crear la base de datos local vacía
node preparar-local.mjs

# 3. Arrancar el servidor
npm run dev -- --hostname 127.0.0.1
```

Abre **http://127.0.0.1:5173/** en el navegador.

- El inicio de sesión local simula un usuario de prueba («Seedy»). No pide contraseñas ni se conecta a ningún servicio de IA.
- La primera vez se abre la configuración guiada. En el paso de Strava verás «no disponible» y la lista de lo que falta configurar: es lo esperado en local. Pulsa **Continuar sin Strava**.
- Si solo quieres echar un vistazo, pulsa **Ver una demostración**: carga datos ficticios sin tocar los tuyos.
- Para empezar de cero: **Perfil y objetivo → Borrar todos mis datos**.

Los datos se guardan en `.wrangler/state` y se conservan al reiniciar el servidor. Para borrar la base local, elimina esa carpeta.

> Usa `npm run dev` para probar. `npm start` sirve la versión compilada pero no simula el inicio de sesión.

## Revisar el reparto y las referencias del plan

En **Mi plan → Revisar plan → Calcular propuesta de plan** puedes comparar las distancias antes de aceptar. Se conservan las sesiones pasadas y las ya realizadas; los cambios quedan en el historial.

- La tirada larga limita el reparto semanal: los otros rodajes no superan el 90 % de su distancia. Si tu tirada reciente o el tiempo disponible no permiten más, se reduce el volumen sin acumularlo en otro día.
- Las sesiones se acortan respetando los minutos disponibles y conservan su tipo cuando cabe; la puesta a punto se calcula también por la fecha de cada sesión.
- Las marcas se normalizan a una distancia común para estimar ritmos: un 5 km y una media maratón no se tratan como esfuerzos equivalentes por kilómetro. Un ritmo suave declarado más lento se respeta.
- Al revisar con historial completo, las carreras propias en asfalto, sin molestias y con esfuerzo de al menos 7/10 pueden aportar referencias. Un rodaje fácil no se interpreta como una marca.
- Los calendarios antiguos con rodajes mayores que la tirada larga muestran un aviso para revisarlos.

Estas reglas son orientativas; no constituyen una validación profesional del plan ni una garantía de rendimiento.

## Comprobar que todo funciona

```sh
npm test                        # regresiones: motor, datos, usuarios e interfaz
npm run check:types              # tipos
npm run verify:storage           # HTTP y D1 aislados: guardar, registrar, reiniciar y conflictos
npm run verify:storage -- --browser # añade cerrar/reabrir Chrome con lecturas reales de D1
npm run verify:local             # servidor local arrancado: comprobaciones sin borrar datos
```

La prueba de almacenamiento crea una base independiente en `.tools/` y usa el puerto 5174. `npm run verify:browser` recorre la interfaz si Chrome tiene depuración local habilitada en el puerto 9223; intercepta las peticiones de datos y no escribe en tu base. La captura de pantalla es opcional (`--screenshot`). Consulta los resultados y límites en [`docs/revision-fiabilidad.md`](docs/revision-fiabilidad.md).

La [revisión completa de experiencia](docs/revision-experiencia.md) mantiene problemas, impacto, criterios de aceptación, doce escenarios y resultados comprobados. `npm run verify:experience -- http://127.0.0.1:5273` comprueba el flujo con datos aislados; `--audit-only` comprueba contraste y controles en siete pantallas, dos temas y tres anchuras. Sustituye la dirección por tu servidor local.

## Strava

La conexión con Strava está implementada (OAuth y tokens cifrados). En desarrollo existe una consulta local que no guarda sus actividades; en el despliegue se usa una caché temporal. La configuración y una autorización válida son necesarias: tener las variables completas no confirma que la conexión funcione. Los pasos están en [`integrations/README-Strava.md`](integrations/README-Strava.md).

Aunque la conectes, la [política de la API de Strava](https://www.strava.com/legal/api_policy) vigente restringe analizar sus datos, usarlos con IA y guardarlos más de 7 días. Por eso Zancada solo te **muestra** tus carreras de Strava; el plan y las estadísticas usan registros manuales y archivos propios autorizados del dispositivo. Un archivo con origen API de Strava no puede usarse para este seguimiento.

## Entrenador sin API obligatoria

El chat visible en **Mi entrenador** explica sesiones por fecha, revisa CrossFit y cansancio, compara vueltas de intervalos y pide referencias para calibrar ritmos. Distingue negaciones y varias preguntas; separa observación, inferencia, propuesta y datos que faltan. El seguimiento breve pertenece a tu cuenta y se revalida cuando cambian tus datos. Guardar una propuesta conserva el calendario; la aceptación en Mi plan vuelve a comprobarla en el motor y el servidor.

Puedes activar Ollama en la versión PC, con consentimiento y comprobación del modelo; su JSON solo selecciona análisis de la consulta y acciones permitidas. Una respuesta inválida vuelve a reglas sin acciones del modelo. La copia manual para ChatGPT sigue disponible aparte y no simula una conexión. Consulta los [casos reproducidos y pruebas del chat](docs/revision-chat-entrenador.md); `node scripts/reproduce-coach-dialog.mjs` genera los siete ejemplos con datos ficticios.

Consulta [configuración, condiciones vigentes, instalación opcional y límites comprobados](docs/integraciones-entrenador.md). No se ha validado una cuenta real de Strava ni generación con un modelo instalado. ChatGPT y su API tienen acceso y facturación separados.

## Estructura

| Carpeta | Contenido |
| --- | --- |
| `app/` | Interfaz (React) y rutas del servidor (`app/api/…`) |
| `lib/engine.mjs` | Motor del plan: sesiones, ritmos, viabilidad, ajustes |
| `lib/session-library.mjs` | Biblioteca de sesiones: propósito, requisitos, dosis, recuperaciones, progresión y fuerza |
| `lib/planning-rules.mjs` | Reglas explícitas de carga, fases, distancia y fuentes técnicas |
| `lib/training.mjs` | Revisión del plan, progreso, calendario exportable |
| `lib/state-store.mjs` | Lectura y escritura de datos por usuario |
| `lib/strava-*.mjs` | Integración con Strava |
| `drizzle/` | Migraciones de la base de datos (Cloudflare D1 / SQLite) |
| `tests/` | Pruebas automáticas |

Funciona sobre [vinext](https://github.com/cloudflare/vinext) (Next.js en Cloudflare Workers) con D1 como base de datos. Más detalles en [`LEEME-PRIMERO.md`](LEEME-PRIMERO.md) y [`docs/entorno-tecnico.md`](docs/entorno-tecnico.md).

## Limitaciones

El cuestionario y el perfil comparten un resumen editable de datos medidos, estimaciones e información ausente. Consulta la [relación entre respuestas, decisiones del motor y pruebas](docs/cuestionario-corredor.md). Editar el perfil mantiene el calendario hasta aceptar su nueva propuesta.

El motor funciona sin IA y documenta carga real, viabilidad, fases, recuperación, puesta a punto, métodos de ritmo y límites. Consulta las [reglas contrastadas con fuentes primarias y la comparación de perfiles](docs/motor-planificacion.md). Los calendarios anteriores se actualizan al aceptar una revisión.

La [evaluación de referencias y calibración de ritmos](docs/calibracion-ritmos.md) compara marcas coherentes, contradictorias, antiguas y ausentes, distingue capacidad estimada, rodajes observados y objetivo de carrera, y documenta las propuestas graduales y sus pruebas.

El calendario y el detalle muestran instrucciones por bloques, recuperaciones contadas, esfuerzo y alternativas concretas por cansancio. Consulta los [totales, conversiones y comprobaciones de las sesiones](docs/prescripcion-sesiones.md).

La [biblioteca de entrenamientos y sus ejemplos generados](docs/biblioteca-sesiones.md) documenta la selección para 5 km, 10 km, media y maratón, los recortes por tiempo, la progresión de una sola variable y la fuerza sin duplicar CrossFit. Incluye ocho perfiles ficticios reproducibles y comprobaciones de revisiones del plan.

El seguimiento conserva el calendario hasta aceptar un cambio. Consulta [reglas de interpretación, asociaciones y progresión comparable](docs/seguimiento-actividades.md). La [importación de TCX, CSV con mapeo, FIT y JSON](docs/importacion-dispositivo.md) incluye vista previa, confirmación de unidades y zona, tiempos separados, vínculos con registros manuales sin perder notas, API autenticada y casos comprobados. Documenta los formatos y métricas que siguen pendientes.

- En local solo existe un usuario simulado. Para varias personas reales hace falta desplegarlo con un inicio de sesión seguro (ver `LEEME-PRIMERO.md`).
- Los planes son orientativos y no sustituyen el consejo de un profesional, sobre todo si tienes molestias o lesiones.
- No mide GPS ni envía sesiones al reloj.
