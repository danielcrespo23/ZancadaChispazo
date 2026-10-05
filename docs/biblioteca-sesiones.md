# Biblioteca de entrenamientos y comparación reproducible

La selección y los bloques de carrera se definen en `lib/session-library.mjs`. `session` aplica el contexto del corredor, `timedSession` utiliza el mismo constructor sin inventar kilómetros y `fitSession` adapta la sesión a los minutos disponibles. El calendario aceptado solo cambia al aceptar una propuesta vigente.

## Comportamientos comprobados antes de modificar el motor

Se reprodujeron con perfiles ficticios y fecha fija, 05/10/2026:

| Caso | Resultado anterior | Resultado actual |
| --- | --- | --- |
| Misma preparación, semanas 0, 1, 2 y 3 | Intervalos / tempo según paridad | La prioridad depende de objetivo, fase, preparación y trabajo ya previsto; cambiar solo el número de semana no altera la selección |
| Intervalos de 8 km para 10 km, semanas 0, 6 y 12 | 4, 5 y 6 repeticiones sin registros nuevos | Se conservan 4 repeticiones y la longitud del trabajo |
| Intervalos de 30 min sin referencia de ritmo, semanas 0, 3 y 6 | 6 repeticiones de 60, 90 y 120 s | 4 × 60 s y 3 × 90 s de recuperación, sin crecimiento por calendario |
| Intervalos que no caben en 12 min | Se convertían en carrera fácil | Sigue siendo carrera fácil; ahora queda registrado el formato solicitado y el motivo de sustitución |
| Fuerza solicitada de 10 min | Devolvía 25 min | 10 min de movilidad: no cabe una ronda completa de cinco ejercicios con sus descansos |
| Fuerza complementaria y CrossFit o fuerza semanal declarados | Podían añadirse circuitos redundantes | Se utiliza el complemento existente y se explica por qué no se añade otro |

La fotografía anterior se guardó en `.tools/session-library-before.json`, sin abrir datos personales. No se cambiaron migraciones, bases locales, credenciales ni registros existentes.

## Contenido de la biblioteca

Cada entrada contiene propósito, nivel, requisitos, prescripción estructurada, bloques, recuperaciones, duración mínima útil, esfuerzo, cálculo de carga pautada, progresión posible y condiciones de reducción o sustitución. Los números son límites de diseño prudentes, no umbrales fisiológicos medidos.

| Formato | Propósito y requisitos | Construcción inicial y recuperación | Progresión posible, previa evidencia de tolerancia |
| --- | --- | --- | --- |
| Carrera fácil | Constancia y resistencia; continuidad tolerada | Inicio suave, carrera cómoda y final suave; esfuerzo 3/10 | Añadir solo duración cómoda, conservando ritmo y frecuencia |
| Recuperación | Movimiento suave alrededor de carga exigente | Menor duración, esfuerzo 2/10; descanso si la fatiga no mejora | Volver al rodaje ordinario tras confirmar recuperación; no añadir un día extra |
| Tirada larga cómoda | Resistencia desde una tirada reciente tolerada | Inicio, tramo cómodo sostenido y final suave; esfuerzo 3/10 | Solo duración dentro de los límites de tirada; sin acelerar también el final |
| Tempo continuo | Esfuerzo sostenido controlado; calidad autorizada | Aproximadamente 40 % del tramo principal; al menos 6 min útiles, esfuerzo 6/10; sin pausas | Cambiar tramo suave por tempo, conservando ritmo y duración total |
| Tempo fraccionado | Acumular esfuerzo sostenido con control; base consolidada | Dos bloques iguales, al menos 3 min cada uno; una recuperación de 200 m o 90 s; esfuerzo 6/10 | Alargar ambos bloques retirando tramo suave; mantener pausa, ritmo y duración total |
| Intervalos controlados | Cambios de ritmo y técnica; base regular y recuperación suficiente | Inicialmente 4 × 400 m para 5 km; 4 × 600 m en desarrollo de 10 km, o plantilla de 1.000 m en específico; sin ritmo fiable, 4 × 60 s. Tres recuperaciones de 200 m o 90 s; esfuerzo hasta 7/10 | Añadir una repetición retirando rodaje suave; mantener volumen total, ritmo y longitud del trabajo |
| Repeticiones de resistencia | Trabajo complementario útil también en carreras largas; base consolidada | Inicialmente 4 × 800 m, o 4 × 60 s sin ritmo fiable; tres recuperaciones de 200 m o 90 s; esfuerzo 6/10 | Alargar solo el trabajo retirando tramo suave; mantener repeticiones, ritmo y volumen total |
| Progresivo controlado | Aprender a terminar con control; calidad autorizada | Final de aproximadamente 30 % del tramo principal por tiempo o 35 % por distancia; al menos 3 min, esfuerzo 5/10; sin esprint | Ampliar solo el final retirando tramo fácil; mantener ritmo y duración total |
| Cuestas suaves | Técnica para un objetivo con pendientes; subida segura y recuperación suficiente | 4 × 30 s a esfuerzo 6/10; cuatro bajadas suaves de 90 s, incluida la última; sin velocidad pautada en subida | Añadir una subida con su bajada retirando tiempo en llano; mantener pendiente, esfuerzo y duración total |
| Correr y caminar | Iniciación o vuelta sin continuidad confirmada | 60 s de carrera suave y 120 s caminando, dentro de la duración tolerada; caminata tras cada tramo | Alargar ligeramente la carrera retirando caminata; mantener duración y esfuerzo |
| Fuerza complementaria | Piernas y tronco, con apoyos y margen de recuperación | Rondas completas de cinco ejercicios; hasta 45 s por ejercicio y 45 s de descanso; esfuerzo máximo pautado 4/10 | Cambiar repeticiones o resistencia o rondas, una sola variable y sin crecimiento semanal automático |

El tempo fraccionado y las repeticiones de resistencia necesitan, además de calidad permitida, 24 km/semana, ocho semanas constantes, tres días recientes de carrera y una tirada medida y cómoda de al menos 8 km en los últimos 42 días, con recuperación buena. Una tirada antigua, estimada, difícil o fechada en el futuro no cumple el requisito.

La calidad sigue limitada a una sesión por semana y a las fases adecuadas. Se conservan los controles anteriores de molestias, restricciones, fatiga, días disponibles, descarga, puesta a punto y separación de 48 horas entre trabajos exigentes. No se elevan los techos de volumen ni de tirada larga para introducir variedad.

## Selección por objetivo y continuidad

Para 5 km tienen mayor prioridad los cambios de ritmo; para 10 km, el esfuerzo sostenido y las repeticiones más largas. En media y maratón predominan la resistencia cómoda y el esfuerzo sostenido; las repeticiones son un apoyo condicionado a preparación y recuperación. Las cuestas ganan utilidad con un objetivo que tiene pendientes; un perfil de cinta recibe una alternativa cómoda.

Entre formatos útiles se reduce la prioridad de los ya previstos recientemente dentro de la misma fase. Esto distribuye propósitos sin usar paridad, módulo o azar. Ese trabajo previsto **no acredita adaptación**. Base, descarga y puesta a punto no reciben calidad nueva por esta selección.

Las revisiones guardan el contexto de selección y la dosis vigente por formato. No vuelven a la primera elección ni aumentan el trabajo al recalcular. El cambio de formato dentro de una misma familia también se compara con la sesión anterior. Pasar de tempo fraccionado a continuo conserva como máximo la suma del trabajo anterior, por distancia o tiempo; la nueva fase no añade dosis. Si el presupuesto crece, no se utiliza ese crecimiento para aumentar a la vez repeticiones o dificultad. Si se recorta, se conserva la reducción.

`progressionAudit` comprueba ritmo, volumen total, repeticiones y dificultad. Permite aumentar como máximo una variable. Por ejemplo, pasar de cuatro a cinco repeticiones exige retirar tramo suave para mantener volumen total. Las progresiones de la tabla son posibilidades sujetas a sesiones realmente realizadas y recuperación confirmada; no se ejecutan automáticamente porque avance la semana. Una plantilla específica de 1.000 m tampoco sustituye automáticamente las repeticiones de 600 m ya aceptadas.

La calibración gradual del ritmo cómodo desde varias carreras comparables continúa separada de la calidad y del ritmo objetivo de carrera. Las reglas existentes de referencias, continuidad de fases, historial incompleto y propuestas desactualizadas se mantienen bajo regresión.

## Recortes coherentes por tiempo

Primero se retira carrera suave adicional; después se eliminan repeticiones completas junto con su recuperación. Se mantienen calentamiento, trabajo útil y vuelta a la calma. El trabajo de calidad requiere al menos 20 min totales; en sesiones por distancia, al menos 5 min estimados de calentamiento y 3 min de vuelta a la calma. Por tiempo se reservan 5 min en cada extremo. Los intervalos necesitan al menos dos repeticiones y cuatro minutos de trabajo total; el tempo necesita seis minutos de trabajo y el fraccionado tres minutos por bloque.

Este ejemplo parte de intervalos de 8 km para 10 km, con referencias coherentes y ritmo cómodo observado. Los recortes mantienen cada repetición en 600 m:

| Minutos disponibles | Resultado generado | Total | Motivo |
| --- | --- | --- | --- |
| 15 | Carrera fácil | 2,2 km · 14,7 min estimados | No queda trabajo útil con calentamiento y final suficientes |
| 20 | Carrera fácil | 3,0 km · 20 min estimados | El formato deja de cumplir su mínimo útil |
| 25 | 3 × 600 m y 2 × 200 m de recuperación | 4,1 km · 25 min estimados | Se retira tramo suave y una repetición completa |
| 30 | 4 × 600 m y 3 × 200 m de recuperación | 4,9 km · 29,6 min estimados | Se recorta tramo suave, conservando toda la dosis |
| 35 | 4 × 600 m y 3 × 200 m de recuperación | 5,7 km · 34,9 min estimados | Cabe más carrera suave; el trabajo rápido sigue igual |
| 40 | 4 × 600 m y 3 × 200 m de recuperación | 6,4 km · 39,6 min estimados | Se conserva la dosis, dentro del tiempo disponible |

Las distancias de entrenamiento se expresan en múltiplos de 100 m. Sin referencia suficiente se prescriben minutos y esfuerzo y la distancia permanece desconocida. La suma de bloques, recuperaciones y total coincide. Carrera fácil, recuperación y tirada conservan su propio rango también dentro del bloque principal. Los minutos de una sesión por distancia son estimados: no garantizan una duración exacta si caminas o cambia el terreno.

La carga `planned` es la suma de minutos de cada bloque multiplicados por su esfuerzo pautado. Describe la prescripción; no mide adaptación, recuperación ni la carga interna que experimentará el corredor. Se recalcula también al reducir, cambiar ritmos o convertir una sesión en descanso.

## Fuerza comprensible y registro propio

El circuito incluye sentarse y levantarse de una silla estable, bisagra de cadera, elevación de talones con apoyo, subir un escalón bajo o usar la alternativa de silla y control de tronco a cuatro apoyos. Cada bloque explica cómo moverse, cuánto margen dejar y cuándo reducir recorrido o sustituirlo por movilidad. Hay variantes sin material, con banda y con mancuernas; el material se elige en el perfil. Disponer de peso no obliga a usarlo.

En 25 min caben dos rondas completas con diez descansos de 45 s. En 15 o 20 min se hace una ronda y movilidad, sin completar una segunda ronda parcial. En 10 min se ofrece movilidad suave. La fuerza de puesta a punto reduce su duración a movilidad y no añade trabajo exigente.

Si hay fuerza o CrossFit declarados, se explica que ya existe complemento y no se añade otro circuito. También se consideran los deportes exigentes cercanos y el tiempo que consumen. Cuando una sesión propia de fuerza se registra con esfuerzo alto, una revisión reduce la carrera exigente adyacente. La fuerza utiliza `sessionCompletions` con minutos y esfuerzo reales; no crea kilómetros ni carreras en `activities`, y corregir el registro no cambia el calendario.

## Ocho corredores y sesiones generadas

Todos los ejemplos usan datos ficticios y el mismo inicio, 05/10/2026. Las referencias comunes coherentes son 5 km en 25:00 y 10 km en 52:07, con medición, esfuerzo y condiciones conocidos, además de ritmo cómodo observado de 6:30 min/km. El corredor inicial carece de esas referencias. Los rangos mostrados son orientativos y no se convierten en mediciones.

| Corredor | Primera semana | Ejemplo posterior y diferencia |
| --- | --- | --- |
| Inicio de 5 km, sin continuidad confirmada | 3 sesiones · 45 min prescritos; distancia sin estimar | Alternancia de 60 s corriendo y 120 s caminando; ninguna calidad nueva |
| 5 km, base de 24 km y tres días | 21,4 km · 144 min estimados | 02/11: 4 × 400 m a 4:50–5:10 min/km; sesión de 6,7 km y 42,3 min. Cambios breves con recuperación |
| 10 km, base de 36 km, fuerza propia el martes | 35 km; 236 min de carrera estimados + 25 min de fuerza | 05/11: tempo continuo de 3,6 km a 5:10–5:40 min/km; sesión de 11 km y 68,8 min. También 4 × 600 m; tres carreras y un complemento propio |
| Media, base de 36 km y tirada reciente de 14 km | 35,9 km · 242 min estimados · cuatro carreras | 20/10: 2 × 1 km tempo, una recuperación de 200 m; sesión de 7,3 km y 46,3 min. También puede usar 4 × 800 m controlados a esfuerzo 6/10 |
| Maratón, base de 50 km y tirada reciente de 22 km | 49,6 km · 336 min estimados · cuatro carreras | 03/11: 2 × 1,4 km tempo, una recuperación de 200 m; sesión de 9 km y 56,6 min. Mayor resistencia tolerada, sin aumentar automáticamente repeticiones |
| Media con CrossFit exigente el viernes | 35,9 km · 242 min estimados · cuatro carreras | Calidad el martes y tirada el domingo; sin fuerza duplicada ni carrera exigente junto al CrossFit |
| 10 km con 20 min entre semana y 40 min de tirada | 11,8 km · 80 min estimados · tres carreras | Rodajes de 3 km y tirada de 5,8 km; no se introducen fragmentos rápidos para completar variedad |
| 10 km con 100 m de desnivel en el objetivo | 34,9 km · 235 min estimados · cuatro carreras | 03/11: 4 × 30 s de subida controlada, cuatro bajadas de 90 s; sesión por tiempo, sin inventar distancia ni ritmo de cuesta |

Los [datos completos de la comparación](biblioteca-sesiones-comparacion.json) incluyen fases, volumen semanal, disponibilidad, formatos, esfuerzo, bloques, recuperaciones y motivos. Permiten comprobar que dos objetivos con la misma capacidad no reciben automáticamente la misma sesión.

## Contraste y supuestos

Los programas oficiales de la Boston Athletic Association incluyen tempo e intervalos en preparación de media. Sus planes de maratón combinan carrera cómoda, cuestas, repeticiones y esfuerzos sostenidos. Esto respalda revisar la prohibición de intervalos basada únicamente en el nombre de la distancia. Las dosis y condiciones de Zancada se diseñan por separado y conservan los límites anteriores; no reproducen calendarios ni importan sus volúmenes. Fuentes: [Boston Half Training](https://www.baa.org/races/boston-half/info-for-athletes/boston-half-training/), [Boston Marathon Training](https://www.baa.org/races/boston-marathon/info-for-athletes/boston-marathon-training/) y [documento oficial de nivel uno](https://www.baa.org/wp-content/uploads/docs/2018-07/Boston%20Marathon%20Level%20One%20Training.pdf).

Las ponderaciones de selección, mínimos útiles, comprobación de tirada reciente y progresión de una sola variable son decisiones explícitas del producto. No se presenta la tabla como una validación individual de seguridad o rendimiento. El esfuerzo, la recuperación y lo realmente realizado siguen teniendo prioridad sobre la variedad.

## Validación

Comprobaciones realizadas en Windows con Node 22.13.1:

- **313 pruebas de regresión pasan**, incluidas 24 de biblioteca, construcción, requisitos, recortes, carga, semanas sucesivas, transiciones de formato, fuerza y conservación de sesiones y asociaciones. Las regresiones anteriores de objetivo aceptado, continuidad, historial incompleto, calibración y propuestas obsoletas siguen pasando.
- **Tipos y compilación pasan**.
- **HTTP y D1 aislados pasan**: guardar, registrar, reiniciar, consentimiento, asociaciones, rechazo de propuestas antiguas tras cambios de molestias, disponibilidad, actividad y objetivo, y aceptación de una propuesta vigente.
- **Ocho ejemplos generados pasan** las comprobaciones de totales, carga, tiempo disponible, estructura, distribución y progresión comparable; los perfiles de entrada permanecen intactos.
- Los archivos nuevos y el código modificado de sesiones pasan lint. En los otros archivos editados quedan 56 avisos o errores ya presentes en `HEAD`, sin incremento de reglas ni mensajes.
- Los diez archivos personales vigilados (`.wrangler/state` y `.dev.vars`) mantienen sus hashes SHA-256. Las pruebas de almacenamiento usan una base nueva en `.tools/`.

Para repetir:

```sh
npm test
npm run check:types
npm run build
npm run verify:storage
node scripts/compare-session-library.mjs
```

El último comando escribe exclusivamente la comparación ficticia en `docs/biblioteca-sesiones-comparacion.json`. Las pruebas no migran ni sustituyen un calendario personal existente: sus nuevos formatos aparecen al aceptar una revisión revalidada.
