# Corrección del flujo de Strava en PC — 1/10/2026

## Hallazgos comprobados

El estado del servidor era `disconnected` y la base local no contenía conexiones
ni tokens. La lista vacía no demostraba que Strava no tuviera carreras.

El proceso arrancado desde el entorno aislado no tenía salida a Internet: una
petición a Strava fallaba con `EACCES`. Fuera del aislamiento se recibió HTTP 401
en el endpoint de atleta sin enviar ningún token, respuesta esperada que confirma
la conectividad. Se reinició el servidor fuera del aislamiento y se repitió esa
comprobación desde el propio Worker mediante el endpoint de diagnóstico.

También se reprodujeron con pruebas de regresión estos defectos del código:

- El callback invocaba `sync`, pero la implementación local no consultaba ninguna
  actividad. Solo el posterior `status` intentaba consultar Strava.
- La cookie de estado llevaba `Secure` en HTTP local. La pérdida de esa cookie
  provoca `invalid_oauth_state`. No se puede atribuir cada intento previo a este
  problema sin el diagnóstico del callback de aquel intento.
- Un inicio en 127.0.0.1 podía volver a localhost, donde faltan las cookies de esa
  sesión. El retorno local ahora conserva el origen del navegador.
- La interfaz mostraba el texto de ausencia de carreras también al cargar,
  estar desconectada o fallar la consulta.

## Comportamiento corregido

El callback comprueba usuario, estado, cookie y permisos; intercambia el código,
verifica el atleta, guarda tokens cifrados y consulta automáticamente siete días.
Los permisos de actividades privadas se solicitan por defecto y pueden rechazarse.
La interfaz avisa si solo se pueden consultar actividades visibles para terceros.

La ventana corresponde a 168 horas, usando segundos Unix UTC y límite superior.
La presentación conserva `start_date_local` de Strava. Run y TrailRun están
incluidos por defecto; VirtualRun y cinta se pueden incluir. Walk y Ride quedan
fuera. La paginación es acotada y la lista se deduplica por ID de actividad.

Sincronizar ahora devuelve la consulta al navegador directamente. Los errores de
API se conservan como errores, sin presentarse como una consulta vacía. Los tokens
se renuevan con bloqueo para evitar sobrescribir refresh tokens rotatorios.
En el modo PC se persisten los tokens cifrados y el estado de sincronización;
las actividades se devuelven en la respuesta, sin persistirlas ni copiarlas al plan.

## Verificaciones

86 pruebas verificadas (85 de la suite completa y la regresión adicional), junto
con TypeScript y la compilación. Las nuevas pruebas
ejercitan los handlers HTTP del callback y la sincronización, con un proveedor
controlado: inicio, cookies, retorno en ambos hosts, consulta automática, filtros,
límites UTC durante un cambio de hora, métricas, deduplicación, aislamiento entre
usuarios, renovación y concurrencia, códigos 401/403/429/500, desconexión de red,
registro malformado y estados renderizados de la interfaz.

Esas pruebas no equivalen a consultar las carreras de una cuenta real. Se ha
verificado la conectividad real desde el servidor; la autorización anterior no
dejó tokens utilizables. Hasta una nueva autorización no se puede comprobar la
lista real de carreras del usuario.

## Último paso con tu cuenta

1. Abre http://localhost:5173 y recarga la página.
2. En Ajustes pulsa Connect with Strava. Si usas actividades privadas, mantén
   marcada la opción correspondiente y acepta su lectura en Strava.
3. Al regresar, se mostrarán la consulta de siete días y su resultado. Usa
   Sincronizar ahora para repetirla.

No pegues tokens ni secretos. Si falla, basta con el mensaje mostrado. La terminal
registra etapas, estados HTTP y conteos sin credenciales. Para comprobar la red,
abre `/api/strava/diagnostics` con tu sesión; HTTP 401 del sondeo sin token es normal.
