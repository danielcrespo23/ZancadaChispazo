# Zancada

Aplicación web de entrenamiento de running que crea un plan personal según tu nivel, tus días disponibles y tu objetivo de carrera.

- **Configuración guiada** la primera vez: cuenta, Strava (opcional), objetivo, experiencia, disponibilidad, molestias y revisión del plan.
- **Plan por reglas, sin IA**: base, desarrollo, descargas, puesta a punto y «Día de la carrera». Cada sesión indica calentamiento, bloque principal, recuperaciones y vuelta a la calma, con ritmos legibles («2 km a 6:00 min/km · 10 km/h»).
- **Valoración de la meta**: si es demasiado exigente, lo dice y propone alternativas. No promete resultados.
- **Seguimiento**: registras tus carreras y el calendario distingue sesiones completadas, realizadas con cambios y carreras adicionales. Los ajustes del plan se proponen y tú decides si aceptarlos; se pueden deshacer.
- **Datos separados por usuario**, comprobados en el servidor.

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
node --test tests/*.test.mjs     # 66 pruebas: plan, fechas, duplicados, separación entre usuarios, interfaz…
npx tsc --noEmit                 # tipos
node scripts/smoke-local.mjs     # con el servidor arrancado: prueba HTTP de extremo a extremo
```

## Strava

La conexión con Strava está implementada (OAuth, tokens cifrados, caché de 7 días), pero **en local no funciona**. Para activarla necesitas registrar tu propia aplicación en Strava y configurar varias variables en el servidor; los pasos están en [`integrations/README-Strava.md`](integrations/README-Strava.md).

Aunque la conectes, la [política de la API de Strava](https://www.strava.com/legal/api_policy) vigente prohíbe analizar sus datos, usarlos con IA y guardarlos más de 7 días. Por eso Zancada solo te **muestra** tus carreras de Strava; el plan y las estadísticas usan las carreras que registras en la propia app.

## Estructura

| Carpeta | Contenido |
| --- | --- |
| `app/` | Interfaz (React) y rutas del servidor (`app/api/…`) |
| `lib/engine.mjs` | Motor del plan: sesiones, ritmos, viabilidad, ajustes |
| `lib/training.mjs` | Revisión del plan, progreso, calendario exportable |
| `lib/state-store.mjs` | Lectura y escritura de datos por usuario |
| `lib/strava-*.mjs` | Integración con Strava |
| `drizzle/` | Migraciones de la base de datos (Cloudflare D1 / SQLite) |
| `tests/` | Pruebas automáticas |

Funciona sobre [vinext](https://github.com/cloudflare/vinext) (Next.js en Cloudflare Workers) con D1 como base de datos. Más detalles en [`LEEME-PRIMERO.md`](LEEME-PRIMERO.md) y [`docs/entorno-tecnico.md`](docs/entorno-tecnico.md).

## Limitaciones

- En local solo existe un usuario simulado. Para varias personas reales hace falta desplegarlo con un inicio de sesión seguro (ver `LEEME-PRIMERO.md`).
- Los planes son orientativos y no sustituyen el consejo de un profesional, sobre todo si tienes molestias o lesiones.
- No mide GPS ni envía sesiones al reloj.
