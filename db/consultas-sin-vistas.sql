-- Consultas sobre las tablas, sin usar las vistas.
-- No crea nada y no se aplica con vistas-y-triggers.sql.
-- Se pegan en psql para ver el mismo dato armando el filtro a mano.
-- Cada bloque dice qué vista reemplaza.

-- =============================================================================
-- Grupo 1. Estados y seguimiento
-- =============================================================================

-- Estado de la sesión. Equivale a v_estado_sesion, pero en tres consultas.
-- La vista mira primero cierre_real. Aquí cada estado es un WHERE distinto.

-- Finalizadas: ya tienen cierre real.
SELECT id, caso_id, grupo_id, codigo_autorizacion,
       inicio_programado, fin_programado, inicio_real, cierre_real
FROM sesion
WHERE cierre_real IS NOT NULL;

-- En curso: el docente ya la abrió y todavía no la cierra.
SELECT id, caso_id, grupo_id, codigo_autorizacion,
       inicio_programado, fin_programado, inicio_real, cierre_real
FROM sesion
WHERE inicio_real IS NOT NULL AND cierre_real IS NULL;

-- Sin iniciar: nadie ha puesto inicio real.
-- Si existiera un cierre sin inicio, esta consulta también lo traería.
-- La vista lo clasificaría como FINALIZADO. El trigger de fechas impide guardar ese caso.
SELECT id, caso_id, grupo_id, codigo_autorizacion,
       inicio_programado, fin_programado, inicio_real, cierre_real
FROM sesion
WHERE inicio_real IS NULL;

-- Estado de la participación. Equivale a v_estado_participacion, partido en tres.
-- La duración de aquí es fin - inicio. La vista lo entrega en minutos, con un decimal,
-- y usa la hora actual cuando el intento sigue abierto.

-- Finalizadas, con su duración.
SELECT id, sesion_id, estudiante_id, numero_intento, fin - inicio AS duracion
FROM participacion
WHERE fin IS NOT NULL;

-- En curso.
SELECT id, sesion_id, estudiante_id, numero_intento, inicio
FROM participacion
WHERE inicio IS NOT NULL AND fin IS NULL;

-- Ausentes: la fila existe y el estudiante no entró.
SELECT id, sesion_id, estudiante_id, numero_intento
FROM participacion
WHERE inicio IS NULL AND fin IS NULL;

-- =============================================================================
-- Grupo 2. Evaluación
-- =============================================================================

-- Nota con nivel. Equivale a v_nota_con_nivel.
-- evaluacion.puntaje es NOT NULL, así que no hay una quinta consulta para puntajes vacíos.
-- La vista igual trata un puntaje vacío como BAJO, por si la columna cambiara.

-- SUPERIOR
SELECT participacion_id, puntaje
FROM evaluacion
WHERE puntaje >= 4.6;

-- ALTO
SELECT participacion_id, puntaje
FROM evaluacion
WHERE puntaje >= 4.0 AND puntaje < 4.6;

-- BASICO
SELECT participacion_id, puntaje
FROM evaluacion
WHERE puntaje >= 3.0 AND puntaje < 4.0;

-- BAJO
SELECT participacion_id, puntaje
FROM evaluacion
WHERE puntaje < 3.0;

-- Rúbrica del caso. Equivale a v_rubrica_caso.
-- Estas dos consultas solo muestran preguntas que sí tienen criterio.
-- La vista también muestra las que no lo tienen, con el peso vacío, y repite la suma en cada fila.

-- Preguntas con su criterio y peso.
SELECT e.caso_id, e.orden AS escena, p.orden AS pregunta,
       cr.criterio, cr.peso
FROM escenario e
JOIN pregunta p ON p.escenario_id = e.id
JOIN criterio_rubrica cr ON cr.pregunta_id = p.id;

-- Suma de pesos por caso. pregunta.caso_id guarda el mismo caso que la escena.
SELECT p.caso_id, SUM(cr.peso) AS suma_pesos
FROM pregunta p
JOIN criterio_rubrica cr ON cr.pregunta_id = p.id
GROUP BY p.caso_id;

-- =============================================================================
-- Grupo 3. Respuestas
-- =============================================================================

-- Detalle de respuestas. Equivale a v_respuesta_detalle, en dos consultas.
-- La explicación y el fundamento están en retroalimentacion, no en opcion.
-- Van aparte porque una opción puede no tener retroalimentación.
-- La vista las trae en la misma fila y, si faltan, deja esas columnas vacías.

-- Lo que eligió el estudiante.
SELECT r.participacion_id, p.enunciado,
       o.descripcion AS opcion_elegida, o.es_correcta, r.fecha_respuesta
FROM respuesta r
JOIN pregunta p ON p.id = r.pregunta_id
JOIN opcion o ON o.id = r.opcion_id;

-- La explicación y el fundamento de cada opción elegida.
SELECT r.participacion_id, r.pregunta_id, rt.explicacion, rt.fundamento
FROM respuesta r
JOIN retroalimentacion rt ON rt.opcion_id = r.opcion_id;

-- =============================================================================
-- Grupo 4. Administración
-- =============================================================================

-- Avisos pendientes. Equivale a v_avisos_pendientes, solo para quien debe algo.
-- Aquí no aparecen los usuarios con cero avisos sin leer.
-- La vista sí: una fila por usuario y sin_leer en 0 cuando ya leyó todo o no tiene avisos.
SELECT usuario_id, COUNT(*) AS sin_leer
FROM notificacion
WHERE leida = false
GROUP BY usuario_id;

-- Convocatoria. Equivale a v_convocatoria para la sesión 1.
-- La primera lista es quién fue citado. La segunda es quién ya tiene intento.
-- Quien está en la primera y no en la segunda queda SIN_INTENTO en la vista.
-- Cambia el 1 si quieres mirar otra sesión.

-- Convocados a la sesión 1.
SELECT estudiante_id
FROM sesion_estudiante
WHERE sesion_id = 1;

-- Participaciones de la sesión 1.
SELECT id, estudiante_id, numero_intento, inicio, fin
FROM participacion
WHERE sesion_id = 1;

-- =============================================================================
-- Grupo 5. Reportes
-- =============================================================================

-- Seguimiento de la sesión. Estas piezas arman lo que v_seguimiento_sesion junta en una fila.
-- La vista parte de sesion_estudiante, une el intento, la nota y estas cuentas,
-- y decide AUSENTE, COMPLETA o PARCIAL.

-- Aciertos por participación: respuestas cuya opción es correcta.
SELECT r.participacion_id, COUNT(*) AS aciertos
FROM respuesta r
JOIN opcion o ON o.id = r.opcion_id
WHERE o.es_correcta = true
GROUP BY r.participacion_id;

-- Total de preguntas del caso 1. pregunta.caso_id evita recorrer la escena.
-- Cambia el 1 para otro caso.
SELECT COUNT(*) AS total_preguntas
FROM pregunta
WHERE caso_id = 1;

-- Respuestas dadas por participación.
-- La clave de respuesta es (participacion_id, pregunta_id): una sola respuesta por pregunta.
-- Si respondidas es igual al total de preguntas, el estudiante completó el caso.
-- Si es menor, quedó parcial.
SELECT participacion_id, COUNT(*) AS respondidas
FROM respuesta
GROUP BY participacion_id;

-- Puntaje guardado. El nivel no está en la tabla: se lee con los rangos del grupo 2.
SELECT participacion_id, puntaje
FROM evaluacion;
