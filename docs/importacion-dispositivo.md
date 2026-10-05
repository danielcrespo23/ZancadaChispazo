# Importar archivos propios del dispositivo

En **Historial → Recibir actividades de un archivo propio** se pueden seleccionar varios archivos, confirmar unidades y zona, preparar una vista previa y escoger qué guardar. Leer o preparar un archivo no guarda actividades. El calendario conserva su prescripción; cualquier ajuste posterior necesita revisión y aceptación.

## Formatos que funcionan

| Formato | Contenido admitido | Datos recuperados y límites particulares |
| --- | --- | --- |
| TCX | XML de `TrainingCenterDatabase/Activities/Activity`, con una o varias actividades y vueltas; solo `Sport="Running"` | Distancia y `TotalTimeSeconds` por vuelta; hora original; FC de resumen/vuelta/muestra; cadencia, altitud, posiciones, velocidad, potencia, calorías, intensidad y disparador si existen. Extensiones reconocidas: movimiento, cronómetro, tiempo transcurrido, desnivel, temperatura y cinta. |
| CSV | Texto UTF-8 con encabezados; coma, punto y coma o tabulador; comillas y saltos de línea dentro de celdas | Mapeo editable de fecha/hora, deporte, distancia, los cuatro significados de tiempo, FC, desnivel, temperatura, cadencia, potencia, notas e identificadores. Una actividad por fila, vueltas agrupadas por identificador o resumen y vueltas en formato mixto. Todas las columnas originales se conservan aunque no estén asignadas. |
| FIT | Archivo binario de actividad con cabecera de 12/14 bytes, tamaño exacto, CRC válido y uno o varios mensajes `session`; solo sesiones `running` | Distancia, tiempos separados, vueltas, muestras, FC, cadencia, potencia, calorías, desnivel, temperatura, coordenadas, eventos de cronómetro y cinta cuando están declarados. Se usa `@garmin/fitsdk` **21.217.0**, cargado al seleccionar FIT. |
| JSON | Lista de actividades o `{ "activities": [...] }`; se mantiene el formato anterior | Distancia en km y `seconds` en movimiento por defecto, o `time` en mm:ss/hh:mm:ss. Se conservan `elapsedSeconds`, vueltas y métricas opcionales. Se pueden confirmar otras unidades y declarar `timeBasis` (`moving`, `timer`, `recorded`, `elapsed`) sin convertir cronómetro en movimiento. El identificador externo anterior sigue funcionando. |

La comprobación FIT usa el [SDK oficial de Garmin](https://github.com/garmin/fit-javascript-sdk), cuya documentación define la cabecera, el CRC y la conversión de campos del perfil. Se conserva su dependencia y licencia sin modificar el SDK. El XML se valida y lee con [fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser), versión **5.11.2**, sin procesar entidades ni admitir DTD.

## Unidades, tiempo y fecha

- **TCX y FIT:** distancia fuente en metros y tiempos en segundos; se muestran para confirmación antes de convertir a km. FIT conserva los valores decodificados con las unidades del perfil del SDK, no sus enteros binarios codificados.
- **CSV:** los encabezados sugieren km/metros/millas, segundos/minutos/milisegundos y tiempos de reloj. Sin unidad reconocible se pide escogerla. El separador decimal y la fecha ISO o DD/MM/AAAA son editables. Desnivel en pies y temperatura Fahrenheit se convierten manteniendo el valor fuente.
- **Tiempo en movimiento, cronómetro y transcurrido** se almacenan por separado. TCX `TotalTimeSeconds` es tiempo registrado, cuyo significado no se presupone. Si faltan movimiento o pausas se indica expresamente. El intervalo entre primer y último punto se conserva como extensión temporal de muestras, sin llamarlo tiempo transcurrido de la actividad.
- **Hora y zona:** UTC u offset explícito se conservan; la zona IANA confirmada determina la fecha local. El valor de fecha/hora de origen también queda guardado. Si solo hay fecha, no se inventa medianoche. Una hora local inexistente por cambio de horario se rechaza; una hora repetida pide escoger primera/segunda ocurrencia o aportar el offset. La zona no se deduce de posiciones GPS. La hora local nativa FIT, si existe, queda en los originales y no se presenta como una zona IANA conocida.
- **Ausencias:** no se crean FC media, temperatura, sensaciones o tiempo en movimiento desde muestras escasas. En varios laps TCX, las pulsaciones de cada vuelta quedan conservadas; su media global queda ausente si el archivo no incluye un resumen global.

Los tiempos de cronómetro, registrados o transcurridos pueden sumar duración y volumen real, pero se excluyen de las referencias de rendimiento, rodajes cómodos comparables y progreso por ritmo. El análisis y el chat explican esa limitación. Las vueltas del reloj permanecen de papel desconocido salvo declaración explícita; su rapidez no las convierte en intervalos de trabajo. Las vueltas incompletas o con otro significado de tiempo se conservan como originales sin usarse como bloques medidos. Los valores negativos o inválidos se señalan como errores.

## Duplicados y notas

La huella SHA-256 y el índice de actividad identifican cada registro de un archivo. Además se contrastan hora, fecha local, distancia y duración con otros archivos y registros manuales. Una misma hora con duraciones distintas puede ser la misma carrera con movimiento/cronómetro diferentes: se presenta como posible duplicado, sin sustituir la medida manual.

La vista previa ofrece **omitir**, **vincular archivo al registro existente** y, en coincidencias no exactas, confirmar que fue otra carrera. Una copia exacta no puede guardarse como carrera distinta. Vincular conserva ID, distancia, tiempo principal, notas, fecha y asociación con el plan. Las notas del archivo y su evidencia se guardan por separado. La opción de completar métricas ausentes no sobrescribe las presentes y se vuelve a validar; una medida incompatible impide el guardado.

En el análisis de la actividad se puede desplegar **Archivos originales y notas conservadas**. Reimportar el archivo no multiplica actividades ni añade otra copia del vínculo. Si se vincula una nueva evidencia, las propuestas pendientes que dependían de ella requieren nueva revisión.

## Procedencia y autorización

Cada archivo guardado conserva nombre, formato, huella, índice, identificador de origen, unidades, zona confirmada, originales y autorización para seguimiento. No se guarda otra copia del binario completo; las métricas no reconocidas por el lector pueden seguir necesitando el archivo original.

Solo se reciben archivos propios autorizados del dispositivo. Los marcadores estructurados de Strava, el autor/creador TCX y su esquema de exportación CSV conocido se rechazan, incluso en columnas sin asignar. Vincular un archivo no transforma datos de su API en datos propios. Un registro manual enriquecido desde un archivo tampoco se envía al entrenador externo como si fuera exclusivamente manual. Los textos de notas se muestran como texto y no se ejecutan ni se usan como instrucciones.

## Validación y límites

La interfaz admite **10 archivos**, **10 MiB por archivo**, **30 MiB en conjunto**, **500 actividades por importación**, **1.000 vueltas por actividad** y **20.000 muestras por archivo**. CSV admite hasta 20.000 filas, 80 columnas y 20.000 caracteres por celda; la estructura tiene profundidad máxima de 64. El estado personal resultante admite hasta 1.800.000 bytes para esta operación. Si se supera ese límite se rechaza toda la operación, sin guardado parcial ni eliminación de datos anteriores. El nombre «MB» de la interfaz resume estos límites; el fichero usa MiB y el límite de estado usa bytes decimales.

Los errores estructurales impiden leer ese archivo. Los errores de una actividad aparecen en su fila y las demás se pueden revisar. Una vuelta inválida dentro de un grupo CSV impide construir una actividad con totales parciales. Los otros deportes se muestran como excluidos.

`POST /api/activities` conserva la recepción JSON autenticada y admite también el objeto `prepared` producido por los lectores, `selectedIndices` y `duplicateDecisions`. El servidor revalida consentimiento, confirmación, datos y duplicados contra el estado actual, protege origen y revisión y escribe también las vinculaciones. El cuerpo HTTP tiene límite de 2.000.000 bytes, leído por bloques. Los archivos binarios se leen en el navegador; el servidor recibe los registros preparados. Una revisión antigua devuelve `409`; hay que recargar y revisar las coincidencias.

## Pendiente o no admitido

- GPX, KML, ZIP, XLS/XLSX, sincronización directa con reloj y envío de entrenamientos al dispositivo.
- TCX de trayectos o de entrenamientos previstos, deportes sin confirmar y formatos XML distintos del TCX de actividades.
- FIT concatenados, corruptos, sin resúmenes de sesión o de tipo workout/course. No se reconstruyen sesiones desde puntos sueltos ni se interpreta automáticamente el papel de cada lap. Campos FIT de desarrollador y extensiones TCX ajenas a los campos enumerados todavía no tienen mapeo dedicado.
- Texto UTF-16, fechas CSV MM/DD/AAAA o nombres de mes, offsets aislados usados como zona IANA, GPS para adivinar la zona y cálculos de movimiento desde velocidad/posición. Se pide exportar UTF-8 y confirmar una representación admitida.
- No se ha comprobado un archivo del reloj personal del usuario ni todos los fabricantes. La compatibilidad probada es la descrita y los casos siguientes.

## Casos reproducidos y resultados

| Caso | Resultado comprobado |
| --- | --- |
| TCX sin FC, 5.000 m y 1.800 s registrados; último punto a 1.920 s | Guarda 5 km y 1.800 s registrados; FC, movimiento y transcurrido siguen ausentes; conserva el intervalo de muestras de 1.920 s. |
| FIT de cinta, cronómetro 1.800 s y transcurrido 1.920 s, dos vueltas y eventos de pausa | Conserva ambos tiempos, vueltas y eventos; no inventa movimiento. Con movimiento explícito de 1.775,5 s, conserva las vueltas de cronómetro como originales, sin compararlas como vueltas en movimiento. |
| CSV en millas, minutos, coma decimal, Fahrenheit y pies | Convierte para la aplicación, mantiene valores/unidades fuente y notas con comas/saltos de línea como texto. |
| CSV por vueltas y CSV mixto | Suma solo medidas compatibles y conserva el resumen cuando existe; una vuelta errónea impide totales parciales. |
| Hora local 02:30 en Europe/Madrid durante los cambios de 2025 | La del 30/03 se rechaza; la del 26/10 pide aclaración y ambas opciones difieren exactamente una hora. |
| Archivo con varias sesiones y ciclismo | Las sesiones de running siguen separadas; ciclismo se excluye. |
| Archivo que coincide con una carrera manual | Vincula originales y métricas ausentes sin perder nota, ID o asociación; repetir no duplica carreras o vínculos. |
| XML malformado/DTD, CSV inválido, FIT truncado/CRC incorrecto, cantidades excesivas | Errores explícitos, sin guardar datos fabricados ni modificar el estado previo. |

Se añadieron **28 pruebas de regresión** en `tests/activity-files.test.mjs`; la suite completa tiene **375 pruebas aprobadas**. Se comprobaron archivos FIT de running generados con el Encoder oficial y dos binarios publicados en el repositorio oficial de Garmin (`Activity.fit`, 94.096 bytes; `HrmPluginTestActivity.fit`, 19.220 bytes): ambos superaron integridad y se excluyeron porque su deporte no era running. Esto no se presenta como una prueba con el reloj personal del usuario.

Chrome comprobó carga CSV con mapeo manual, confirmación y vista previa, vínculo con notas manuales, reimportación, FIT binario, TCX con varios deportes, errores, reapertura y anchura móvil: cuatro actividades finales, tres guardados y cero excepciones. La regresión de seguimiento pasó también con 17 guardados ficticios y cero excepciones. HTTP con D1 aislado comprobó confirmación, revisión antigua, vínculo, repetición sin escritura y conservación tras reiniciar el servidor. TypeScript, ESLint de los módulos revisados y compilación de producción aprobados. Los archivos del almacén personal y `.dev.vars` se comprobaron mediante SHA-256; no se usaron como fixtures.

```sh
node --test tests/activity-files.test.mjs
npm test
npm run check:types
npm run build
npm run verify:storage
# Servidor aislado de prueba y Chrome con CDP en 9223:
node scripts/verify-activity-import-browser.mjs http://127.0.0.1:5175
```
