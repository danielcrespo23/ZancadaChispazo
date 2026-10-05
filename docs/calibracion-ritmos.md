# Referencias, ritmos y calibración

Comprobación del 05/10/2026 con datos ficticios y fechas fijas. Las pruebas no modifican la base personal. El detalle reproducible de las referencias, exclusiones, contradicciones y propuestas está en [calibracion-comparacion.json](./calibracion-comparacion.json).

## Comportamientos reproducidos antes de modificar

Una competición de 10 km en 52:07, llana y anterior en veinte días, convivía con una prueba de 5 km en 20:00 más reciente, realizada a 28 °C y con 60 m positivos. `metrics` elegía la prueba reciente y utilizaba 4:00/km como base de sus factores; `raceEstimate` elegía la competición de 10 km. No aparecía ninguna contradicción entre ambas referencias. Entrenamiento y competición partían de criterios diferentes.

Tres rodajes a los que faltaba temperatura producían el mensaje genérico «0/3 sesiones comparables». El usuario no veía qué impedía interpretar la aparente mejora. Ahora la falta de temperatura se identifica como limitación, se conservan los registros y se explica que el plan se mantiene porque no se pueden confirmar condiciones comparables.

## Evaluación compartida

`lib/reference-evidence.mjs` evalúa todas las referencias y conserva el motivo de utilización o exclusión. `metrics`, `raceEstimate` y `workoutRange` utilizan esa evaluación. Una marca necesita fecha real, distancia y tiempo válidos, medición confirmada, contexto de competición o prueba, esfuerzo máximo sostenible declarado y asfalto para orientar capacidad. Un entrenamiento habitual se analiza como rodaje; no se convierte en una marca máxima.

La evaluación incorpora antigüedad, distancia al objetivo, contexto, tiempo total frente a tiempo en movimiento, desnivel, temperatura y condiciones declaradas. Desconocer un dato no lo convierte en cero ni en condiciones ideales. Los datos incompletos se conservan con confianza provisional. Una actividad registrada como estimada o con medición desconocida nunca se importa como una competición medida. Se mantienen las restricciones de origen y consentimiento existentes.

Se combinan tiempos equivalentes mediante media geométrica ponderada. La referencia que acompaña al texto es la de mayor peso por comparabilidad; la estimación utiliza el conjunto. El orden de entrada no altera el resultado y los duplicados no aportan apoyo independiente. Una referencia completa puede pesar más que otra más reciente con condiciones desconocidas, calor, viento o desnivel.

Reglas de diseño, visibles en el código y sujetas a revisión:

| Criterio | Regla implementada |
| --- | --- |
| Antigüedad | Hasta 30 días: peso 1; hasta 90: 0,85; hasta 180: 0,4. Más antiguas quedan como historial. Competición actual utiliza hasta 90 días. |
| Contexto | Competición: 1; prueba: 0,9. Entrenamiento no fija capacidad máxima. |
| Información incompleta | Sin total: ×0,8; sin desnivel: ×0,85; sin temperatura: ×0,85; sin condiciones: ×0,9. |
| Condiciones conocidas | Más de 5 m positivos/km: ×0,65; temperatura ≥25 °C: ×0,6; calor declarado: ×0,65; viento declarado: ×0,7. No se corrige el tiempo observado. |
| Pausas | Se usa el tiempo total conocido. Una pausa pequeña reduce comparabilidad; más del 5 % excluye una marca de rendimiento. |
| Terreno y extrapolación | Sin normalización de trail, terreno desconocido o más de 15 m positivos/km. Relación máxima entre distancias: 4,3; límites de duración para extrapolar. Maratón exige una distancia de referencia dentro del 10 % de la distancia objetivo. |
| Coherencia | Diferencia ≥8 % entre tiempos equivalentes: contradicción explícita, confianza baja, sin ritmo numérico de calidad ni tiempo puntual de competición. |
| Rango de capacidad | Margen orientativo de 3 %, 6 % u 8 %, ampliado para contener los resultados discrepantes; extremos redondeados hacia fuera a 5 segundos. |

Estos pesos, límites y márgenes son heurísticas del producto. No son probabilidades, umbrales fisiológicos medidos ni intervalos estadísticos validados. En contradicción, el resultado conservador protege la referencia más lenta con peso comparable; no se selecciona automáticamente la más rápida. La discrepancia se conserva, incluso si las condiciones conocidas pueden explicarla, porque no permiten calcular una corrección personal fiable.

## Comparación concreta después del cambio

Perfil ficticio: ritmo cómodo declarado de 6:30/km, medido y con conversación; objetivo de 10 km en 50:00 para el 25/01/2027. Las referencias completas incluyen tiempo total, asfalto, desnivel cero, 16 °C y ausencia de incidencias conocidas. «Capacidad» es ritmo equivalente estimado para 5 km; no es el ritmo de rodaje ni la meta.

| Referencias | Capacidad estimada | Confianza | Rodaje fácil | Tempo | Competición de 10 km |
| --- | --- | --- | --- | --- | --- |
| 5 km en 25:00 y 10 km en 52:07, en fechas distintas | 4:50–5:10/km | Coherentes | 6:20–6:55/km | 5:10–5:40/km | Rango 50:30–53:45, orientativo |
| 5 km en 25:00 y 5 km en 20:00 | 4:00–5:25/km | Baja; contradicción visible | 6:20–6:55/km | Por esfuerzo | Sin tiempo puntual |
| 10 km en 52:07; después 5 km en 20:00 con 28 °C y 60 m | 4:00–5:25/km | Baja; se prioriza la referencia comparable de 10 km | 6:20–6:55/km | Por esfuerzo | Sin tiempo puntual |
| Solo 5 km en 25:00 con 126 días | 4:40–5:20/km | Provisional por antigüedad | 6:20–6:55/km | Por esfuerzo | Sin estimación actual |
| Sin marcas; 6:30/km cómodo declarado | Sin estimación | Sin referencias de rendimiento | 6:15–6:45/km | Por esfuerzo | Sin estimación |
| Sin marcas ni ritmo cómodo declarado | Sin estimación | Sin referencias | Por esfuerzo y conversación | Por esfuerzo | Sin estimación |

Los tres conceptos se muestran por separado en Mi plan: capacidad de competición estimada; ritmo cómodo observado en registros; ritmo objetivo solicitado. En este ejemplo, la meta sigue siendo 5:00/km aunque la capacidad estimada, el ritmo observado y la prescripción sean distintos. El objetivo mostrado pertenece al calendario aceptado; un cambio pendiente del perfil conserva la protección anterior.

La prescripción distingue el tipo de sesión y su fase. Los intervalos de una preparación de 10 km utilizan referencias comparables a 10 km: en el caso coherente, 5:05–5:25/km. El tempo específico de media maratón utiliza la distancia objetivo; el motor conserva las restricciones de maratón y cuestas. Los rodajes utilizan observación o declaración cómoda sin convertirla en ritmo máximo. Los factores iniciales de rendimiento siguen siendo orientativos; una calibración posterior no aplica un multiplicador a todos los entrenamientos. Los bloques de distancia se mantienen en pasos prácticos de 100 m y los rangos se leen en min/km con extremos a 5 segundos.

## Evidencia de progreso y actualización gradual

El ejemplo registra tres rodajes fáciles de 5 km en 31:15, los días 21/09, 28/09 y 05/10: ritmo observado 6:15/km, esfuerzo 3/10, fatiga 2/10, sin molestias, conversación cómoda, distancia y tiempos medidos, sin pausas, asfalto llano y 16 °C. Estos datos describen lo realizado; no miden una mejora fisiológica.

La propuesta de seguimiento cambia solo dos rodajes fáciles futuros:

| Fecha | Distancia | Rango vigente | Rango propuesto | Motivo |
| --- | --- | --- | --- | --- |
| 07/10/2026 | 5 km → 5 km | 6:20–6:55/km | 6:15–6:50/km | Tres sesiones comparables, mismo esfuerzo y al menos una semana; paso de 5 s/km. |
| 12/10/2026 | 5 km → 5 km | 6:20–6:55/km | 6:15–6:50/km | Mismo apoyo observado; sin incremento de distancia. |

La sesión tempo, fechas, fases, calentamientos y vueltas a la calma se conservan. La aceptación vuelve a comprobar evidencia, condiciones y estado actual; una propuesta alterada o con registros modificados se rechaza. Los identificadores de evidencia ya aceptada impiden reutilizarla para encadenar aceleraciones.

El seguimiento requiere tres fechas distintas en los últimos 21 días, separadas por al menos siete días, asociación con sesiones continuas del mismo tipo, distancias dentro del 20 %, ritmo al menos un 3 % más rápido que su objetivo orientativo y esfuerzo declarado no superior al previsto. Exige medición, temperatura, desnivel, tiempo total y sensaciones confirmados; limita calor, pausas y viento relevante conocido. Una carrera aislada, una marca contradictoria, sensaciones adversas recientes, base insuficiente o las dos semanas previas a la carrera impiden recomendar incremento. Cada exclusión conserva su motivo.

Al retirar la temperatura de esos mismos tres registros no hay propuesta: «Temperatura desconocida: no sabemos si las condiciones son comparables; se mantiene el plan. Regístrala si la conoces, sin inventarla». También se explican medición, desnivel o pausas desconocidos. No se atribuye progreso al simple paso de semanas.

La revisión de plan con calibración utiliza rodajes comparables de los últimos 28 días y al menos una semana para proponer como máximo 5 s/km en los ritmos cómodos, con ajustes diferenciados por tipo. Los ritmos de calidad requieren apoyo independiente de rendimiento; una sola marca nueva no acelera el calendario aceptado. Las referencias sin cambios mantienen sus ritmos de calidad y el mismo conjunto de registros no vuelve a acelerar los rodajes al recalcular. La revisión conserva las fases y revalida el origen de la propuesta en motor y servidor.

## Flujo de calibración en la aplicación

1. En Mi plan, abre «Calibrar y revisar mis ritmos». Consulta estimación, observación y meta, los datos pendientes y por qué se utiliza o limita cada referencia.
2. Utiliza la sesión cómoda indicada del calendario. Para una persona que empieza, puede ser correr/caminar con sus bloques. Registra distancia y tiempo medidos o estimados tal como se conozcan, tiempo total, terreno, desnivel, temperatura si la conoces, condiciones, conversación, esfuerzo, fatiga y molestias. Puedes completar una referencia existente sin borrar su historia.
3. Tras registrar varias sesiones comparables, pulsa «Revisar ritmos con mis registros». Compara y acepta la propuesta si procede. Si faltan datos, se explica por qué sigue pendiente.
4. Una referencia máxima de 5–10 km solo se sugiere cuando se confirma base, recuperación, tolerancia y rodajes cómodos comparables. No se añade automáticamente al calendario. Principiantes, restricciones, molestias y fatiga actuales o recientes impiden ofrecerla; con dolor relevante se aplaza la referencia.

## Contraste con fuentes primarias y supuestos

La fórmula empleada es `T₂ = T₁ × (D₂/D₁)^1,06`. Se mantiene 1,06 como exponente de diseño del motor. No se presenta como la implementación exacta validada por Vickers y Vertosick: su comparación principal utiliza 1,07. En 2.303 corredores recreativos encontraron buena calibración hasta media maratón, pero predicciones de maratón demasiado rápidas por al menos diez minutos para aproximadamente la mitad; los modelos con más información mejoraron el error. El estudio usa datos declarados y no valida los pesos, márgenes o reglas de entrenamiento de esta aplicación. Nuestra ponderación propia y el límite de maratón son decisiones conservadoras, no una reproducción de sus modelos. [Vickers y Vertosick, 2016, estudio original](https://pmc.ncbi.nlm.nih.gov/articles/PMC5000509/).

Persinger y colaboradores compararon conversación e intercambio gaseoso en 16 voluntarios sanos, en cinta y bicicleta. Los resultados apoyan la conversación como control práctico de intensidad próximo al umbral ventilatorio. La aplicación registra conversación y esfuerzo como señales declaradas; no calcula ni afirma haber medido el umbral individual, y no sustituye su protocolo experimental por una etiqueta de rodaje. [Persinger et al., 2004, estudio original](https://pubmed.ncbi.nlm.nih.gov/15354048/).

Ely y colaboradores observaron pérdida de rendimiento de maratón al aumentar el índice WBGT entre 5 y 25 °C, con mayor efecto en corredores más lentos. WBGT incorpora componentes ambientales y no equivale a temperatura del aire. El motor recoge temperatura y condiciones declaradas, reduce comparabilidad y evita corregir tiempos mediante porcentajes universales. Los cortes de 25 °C y diferencias de 5 °C son reglas propias; este estudio no los valida como umbrales personales. [Ely et al., 2007, estudio original](https://pubmed.ncbi.nlm.nih.gov/17473775/).

## Reproducción y validación

Desde la raíz del proyecto, usando el Node local incluido en este entorno:

```powershell
.\.tools\node.exe scripts/compare-reference-calibration.mjs
.\.tools\node.exe --test tests/*.test.mjs
.\.tools\node.exe node_modules/typescript/bin/tsc --noEmit
.\.tools\node.exe scripts/run-framework.mjs build
.\.tools\node.exe scripts/verify-state-http.mjs
```

El primer comando reconstruye el JSON de comparación únicamente con fixtures ficticios. La prueba HTTP crea una base D1 aislada bajo `.tools/verify-*`; comprueba persistencia, reinicios, rechazo de propuestas obsoletas y aceptación de calibración mediante reconstrucción del servidor. No utiliza `.wrangler/state` personal.

Las regresiones cubren referencias equivalentes y orden invertido, contradicciones, comparabilidad frente a recencia, datos antiguos y ausentes, duplicados, calor/viento, pausas, medición estimada, rodajes y esfuerzo, separación de capacidad/observación/meta, temperatura ausente, actualización gradual y aceptación revalidada, idempotencia de recalculados, seguridad de la referencia según nivel y sensaciones, restricciones de maratón/trail, rangos, distancias y persistencia de referencias incompletas con valores desconocidos explícitos.

Resultado: 287/287 pruebas automatizadas aprobadas, incluidas las regresiones de objetivo aceptado, propuestas obsoletas y continuidad de fases de los cambios anteriores. Comprobación de tipos y compilación aprobadas. Validación HTTP/D1 aislada aprobada, incluida aceptación de calibración mediante reconstrucción del servidor y persistencia tras reiniciar. Diez archivos originales de datos locales y configuración conservan sus hashes SHA-256. ESLint conserva los errores anteriores de tipado `any` en la interfaz y las advertencias anteriores; los módulos nuevos y sus pruebas no añaden errores ni advertencias.
