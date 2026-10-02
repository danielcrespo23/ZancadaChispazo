# Prescripción de las sesiones

El calendario semanal y el detalle comparten las instrucciones de `lib/session-instructions.mjs`. Se leen los bloques reales, incluso en planes anteriores; abrir una sesión no modifica el calendario ni los datos. El calendario mensual conserva una vista compacta y abre el mismo detalle.

Cada detalle conserva tipo, propósito, relación con la carrera y fase. Muestra calentamiento, bloque principal, recuperaciones y vuelta a la calma, una lista en orden de ejecución y una guía por bloques. Los bloques incluyen medida, ritmo cuando existe una referencia suficiente, velocidad equivalente para cinta, esfuerzo y conversación. La procedencia del ritmo y la progresión aparecen juntas, sin duplicar explicaciones.

## Distancia y tiempo

- La distancia total suma **todos** los bloques por distancia. Las sesiones por tiempo no reciben kilómetros inventados.
- Un bloque por tiempo prescribe sus segundos. Un bloque por distancia estima su duración desde el ritmo central orientativo; el tiempo real puede variar. Tener un ritmo orientativo en un calentamiento por tiempo no lo convierte en una duración estimada.
- En sesiones mixtas se distingue el tiempo prescrito del tiempo estimado y se explica cómo se forma la duración total.
- Las distancias cortas se presentan como 200 m o 400 m; los kilómetros usan coma decimal y omiten ceros innecesarios. La distancia oficial conserva su precisión.
- La velocidad se calcula como `3600 / segundos_por_km`. Por ejemplo, **6:00 min/km = 10 km/h**. El rango de velocidad se muestra de menor a mayor: 6:00–6:40 min/km corresponde a 9–10 km/h.
- En el día de carrera solo se suma la distancia oficial. El calentamiento previo y caminar tras la meta quedan fuera. Sin una estimación válida se muestra «Sin estimación».

## Recuperaciones explícitas

Los intervalos llevan `n − 1` recuperaciones **entre** repeticiones. Después de la última no se añade otra; puede quedar rodaje suave por tiempo antes de la vuelta a la calma, y las instrucciones lo indican. Las cuestas incluyen una bajada de recuperación después de **cada** subida, también de la última. Correr/caminar conserva su caminata después de cada tramo de carrera.

El motor guarda `recoveryCount` y `recoveryPlacement` para planes nuevos. La interfaz obtiene el número de los bloques existentes y comprueba que coincide con esos metadatos. Si un plan guardado presenta un total o una etiqueta incoherente, se avisa en el calendario y en el detalle; no se oculta el problema ni se sobrescribe el plan. Los intervalos muy cortos que solo contienen carrera suave pasan a ser carrera fácil al generar una nueva propuesta.

Ejemplo real del motor: referencia confirmada de 5 km en 25:00, carrera objetivo de 5 km, sesión de intervalos de 4 km, semana inicial, fecha de referencia 05/10/2026:

| Parte | Distancia |
| --- | ---: |
| Calentamiento suave | 800 m |
| Aproximación suave a las repeticiones | 400 m |
| 4 × 400 m | 1.600 m |
| 3 × 200 m de recuperación | 600 m |
| Vuelta a la calma | 600 m |
| **Total** | **4.000 m** |

El calentamiento agrupado suma 1,2 km. El trabajo usa 4:54–5:06 min/km como rango de diseño, no como umbral medido. La duración central calculada suma 24 min 18 s y se etiqueta como **estimada**. Es un caso de comprobación; el motor no impone esta estructura a todos los corredores.

## Tempo, esfuerzo y referencias

El tempo tiene aproximación suave, un tramo continuo controlado y salida suave, además del calentamiento y vuelta a la calma. La aproximación forma parte del bloque principal; su clasificación coincide con la proporción descrita en la progresión. El tramo tempo crece por etapas, con el límite del objetivo y del tiempo disponible; la versión por tiempo aplica la misma lógica y conserva la suma exacta. No hay pausas entre repeticiones porque el tramo tempo es continuo.

Cada bloque muestra su propio esfuerzo y conversación. Un intervalo por esfuerzo sin ritmo numérico se describe como trabajo controlado; no recibe la instrucción «recuperación muy suave». El ritmo parte de la referencia aceptada al generar el plan: una marca válida, ritmo cómodo declarado para carrera suave, o esfuerzo y conversación cuando falta información. El cambio de semana no acelera automáticamente los ritmos. Los métodos, supuestos, límites y fuentes primarias están en [Motor de planificación](motor-planificacion.md).

La FC solo se presenta si existen máxima y reposo coherentes, declarados como medidos. El rango por reserva cardíaca es orientativo y cambia entre bloques suaves y exigentes; no identifica un umbral medido. No se recupera un rango antiguo guardado cuando el perfil actual ya no dispone de datos suficientes. No se muestra FC pautada para carrera, fuerza o descanso.

## Alternativa por cansancio

La alternativa sustituye la sesión completa y muestra sus propios bloques, total, tiempos, esfuerzo y conversación. Las carreras se reducen con la misma función del motor que genera los ajustes conservadores: menor duración y esfuerzo suave, respetando los minutos y restricciones actuales. Correr/caminar mantiene la alternancia. Para fuerza se propone movilidad concreta; con dolor relevante, restricción de no correr, o fatiga importante en el día de carrera, se propone descanso y revisión.

La alternativa no cambia silenciosamente el calendario. El corredor registra lo que realmente ha hecho, incluido su tipo, y la prescripción original permite comparar previsto y realizado. No se acumula después lo omitido.

## Comprobaciones y límites

Se han añadido 14 pruebas específicas: sumas de bloques, tres recuperaciones en cuatro intervalos, recuperación final en cuestas y correr/caminar, tempos por tiempo y distancia, clasificación de sesiones cortas, conversiones, FC condicionada, alternativas, restricciones actuales, lectura de datos anteriores y renderizado compartido de calendario/detalle. También se comprueban planes completos generados para principiantes, corredores regulares, distintas distancias y terreno con cuestas.

La suite completa pasa **155 pruebas**. TypeScript y compilación de producción pasan. Chrome real verifica calendario y detalle de un entrenamiento generado, alternativa desplegable, cronómetro, registro y estadísticas, reapertura y anchura móvil de 390 px, sin errores de ejecución. La persistencia HTTP/D1 se verifica con reinicio real del servidor en una base aislada. La prueba del navegador intercepta las escrituras y no usa datos reales del corredor.

La guía no mide GPS, distancia, ritmo ni FC. Los bloques por distancia avanzan cuando el corredor confirma haberlos completado; los bloques por tiempo tienen cuenta atrás. La voz depende del navegador y el cronómetro puede suspenderse al bloquear el móvil. No se ha comprobado audio real ni ejecución en segundo plano o en un reloj. Estas instrucciones funcionan sin IA y no requieren una integración externa nueva. Strava, autenticación y despliegue mantienen su configuración externa independiente.
