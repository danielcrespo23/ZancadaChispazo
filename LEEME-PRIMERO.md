# Zancada — aplicación completa

Para usar esta versión en tu PC, empieza por [USAR-EN-PC.md](USAR-EN-PC.md). Incluye el acceso Iniciar-Zancada.cmd y Strava sin caché de actividades ni programador.

Versión exportada el 1 de octubre de 2026. Código de la versión publicada:
`43ed6c6e36873490c7ed510561414468ea2b1388`.

## Probar la web sin instalar nada

La web es https://zancada-running.cramirezgar.chatgpt.site.
Actualmente es privada: el propietario debe autorizar el correo de tu cuenta antes de que puedas entrar.
Después inicia sesión con tu propia cuenta, crea tu perfil y tu objetivo y entra en **Mi plan → Revisar mi plan**.
Tus registros se guardan en tu espacio por usuario. No necesitas ni debes usar los tokens, las credenciales o la cuenta del propietario.

## Qué contiene esta copia

Código de la interfaz, motor de planes, servidor, base de datos y migraciones, integración de Strava, plugin MCP y pruebas.
Incluye registro manual, calendario semanal y mensual, ritmos e instrucciones por bloques, propuestas de ajustes,
historial, sensaciones diarias, periodos sin entrenamiento, fuerza, guía de sesión y exportación del calendario.

La copia no contiene datos personales, bases de datos de usuarios, contraseñas, tokens ni credenciales de despliegue.
Las dependencias se instalan desde `package-lock.json`; `node_modules` no está incluido.

## Probar en tu ordenador

Necesitas Node.js 22.13 o posterior, npm y conexión a Internet para instalar las dependencias.
Los mismos pasos se pueden ejecutar en Windows PowerShell, macOS y Linux.

1. Descomprime el ZIP y abre una terminal dentro de la carpeta `zancada-completa`.
2. Instala las dependencias:

```sh
npm run install:ci
```

3. Compila e inicializa una base de datos local vacía:

```sh
node preparar-local.mjs
```

4. Inicia el servidor de desarrollo:

```sh
npm run dev -- --hostname 127.0.0.1
```

5. Abre `http://127.0.0.1:5173/`. El inicio de sesión local simula un único usuario de prueba llamado Seedy.
   No te pide contraseñas de ChatGPT ni consume solicitudes de IA.
6. La primera vez se abre la **configuración guiada**, en siete pasos: cuenta, Strava, objetivo, experiencia,
   disponibilidad, cuidados y revisión del plan. Puedes saltarla con «Usar el formulario completo» o ver una demostración ficticia.
   En local, Strava aparece como «no disponible» con la lista real de lo que falta configurar. Es lo esperado: continúa sin Strava.
7. Para volver a ver la configuración guiada, usa **Perfil → Borrar todos mis datos**.

Con el servidor en marcha, `node scripts/smoke-local.mjs` comprueba por HTTP:

- que las cabeceras de identidad enviadas por el navegador se ignoran;
- el guardado y la recuperación;
- el conflicto entre pestañas;
- el rechazo de duplicados y de otros orígenes;
- el día de la carrera;
- que Strava no simula conexiones sin configuración.

Deja la base local vacía para ese usuario.

Los registros locales se conservan en `.wrangler/state`. Reiniciar el servidor no los borra.
`preparar-local.mjs` se puede repetir sin borrar las tablas ni las carreras existentes.
Eliminar `.wrangler/state` elimina la base de datos local.

Usa `npm run dev` para esta prueba: `npm start` previsualiza el Worker compilado, pero no simula el inicio de sesión local.
Esta prueba local no ofrece cuentas reales para varias personas ni sustituye el inicio de sesión seguro del despliegue.

## IA y Strava: estado real

- Los planes funcionan con reglas locales, sin un servicio de IA.
- La consulta de IA se realiza en ChatGPT. El plugin del despliegue publicado permite leer registros propios y guardar propuestas para aceptar en la web.
  Esta copia local no instala ni conecta ese plugin automáticamente.
- Strava necesita registrar una aplicación propia, configurar credenciales de servidor, OAuth, webhook y ejecución de tareas.
  Consulta `integrations/README-Strava.md`. Sus referencias a claves «ya generadas» corresponden al despliegue original;
  en tu copia debes generar y guardar tus propias claves. No están en este ZIP.
- La política de la API de Strava en vigor desde el 1/6/2026, revisada el 1/10/2026, prohíbe:
  - analizar sus datos (5.4);
  - usarlos con IA (5.3);
  - combinarlos con otros datos o guardarlos más de 7 días (6.2).

  Por eso Strava solo sirve para que cada persona consulte sus propias carreras. El plan, las estadísticas y las adaptaciones
  usan exclusivamente los registros introducidos en Zancada. La conexión es solo OAuth, sin tokens manuales.
  Detalle en `integrations/README-Strava.md`.
- Las fechas usan la zona horaria del dispositivo. Se guarda en el perfil para que el plugin de ChatGPT use el mismo «hoy».
- La guía no mide GPS ni envía sesiones al reloj. No hay entrenamiento humano contratado ni API de IA de pago conectada.

## Comprobar el código

```sh
node --test tests/*.test.mjs
npx tsc --noEmit
npm run build
```

Las 66 pruebas verifican:

- planificación (disponibilidad, minutos, un único día de carrera, 48 h sin intensidad antes, bloques que suman el total);
- unidades y zonas horarias;
- metas exigentes con alternativas, y explicaciones de qué entrenamientos aún no corresponden;
- ajustes y duplicados;
- separación de datos entre dos usuarios sobre SQLite;
- servicios con proveedores simulados y renderizado del asistente y de la conexión con Strava.

No equivalen a una conexión de Strava real.

## Publicar una copia independiente

Esta aplicación está preparada para Sites con Cloudflare Workers y D1. El archivo `.openai/hosting.json`
de esta exportación conserva las capacidades pero no lleva el identificador del sitio original.
Registra un sitio nuevo y proporciona sus propias variables de servidor y autenticación.
No publiques el servidor de desarrollo ni aceptes cabeceras de identidad que pueda enviar directamente un navegador.
Fuera de Sites necesitas implementar una frontera de autenticación fiable antes de exponer la aplicación.

Si publicas una copia independiente, configura el callback de Strava con tu dominio. Los enlaces de revisión del plugin
ya usan el dominio desde el que se llama.

`docs/entorno-tecnico.md` conserva la documentación técnica del entorno y `integrations/README-Strava.md` la configuración de Strava.
