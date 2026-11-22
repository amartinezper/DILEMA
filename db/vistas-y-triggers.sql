-- Vistas y triggers de consulta y de integridad.
-- Spring no ejecuta este archivo. Se aplica a mano sobre PostgreSQL.
-- No cambia las tablas ni el programa: las vistas solo leen y los triggers rechazan datos inválidos.
-- El backend no hace SELECT sobre estas vistas. El frontend tampoco.
-- Las consultas equivalentes, escritas directo sobre las tablas, están en consultas-sin-vistas.sql.

DROP VIEW IF EXISTS v_seguimiento_sesion;
DROP VIEW IF EXISTS v_convocatoria;
DROP VIEW IF EXISTS v_respuesta_detalle;
DROP VIEW IF EXISTS v_rubrica_caso;
DROP VIEW IF EXISTS v_avisos_pendientes;
DROP VIEW IF EXISTS v_nota_con_nivel;
DROP VIEW IF EXISTS v_estado_participacion;
DROP VIEW IF EXISTS v_estado_sesion;

DROP TRIGGER IF EXISTS trg_sesion_tiempo ON sesion;
DROP TRIGGER IF EXISTS trg_sesion_fechas ON sesion;
DROP TRIGGER IF EXISTS trg_participacion_convocada ON participacion;
DROP TRIGGER IF EXISTS trg_respuesta_coherente ON respuesta;
DROP TRIGGER IF EXISTS trg_autorizacion_intento_cerrado ON autorizacion_repeticion;

-- trg_sesion_tiempo. Antes de insertar o actualizar una sesión.
-- Lee caso.tiempo_estimado_minutos y compara con el tiempo máximo de la fila nueva.
-- Rechaza si el caso no existe, si el tiempo es nulo o no es mayor que 0,
-- o si el reloj de la sesión pasa el tope del caso. No modifica el número: lo deja pasar o lo bloquea.
CREATE OR REPLACE FUNCTION fn_sesion_tiempo() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    estimado integer;
BEGIN
    SELECT tiempo_estimado_minutos INTO estimado FROM caso WHERE id = NEW.caso_id;
    IF estimado IS NULL THEN
        RAISE EXCEPTION 'La sesión debe apuntar a un caso que exista.';
    END IF;
    IF NEW.tiempo_maximo_minutos IS NULL OR NEW.tiempo_maximo_minutos <= 0 THEN
        RAISE EXCEPTION 'El tiempo máximo de la sesión debe ser mayor que 0.';
    END IF;
    IF NEW.tiempo_maximo_minutos > estimado THEN
        RAISE EXCEPTION 'El tiempo máximo de la sesión no puede superar los % minutos del caso.', estimado;
    END IF;
    RETURN NEW;
END;
$$;

-- trg_sesion_fechas. Antes de insertar o actualizar una sesión.
-- fin_programado tiene que ser posterior a inicio_programado.
-- No deja guardar cierre_real si inicio_real está vacío: no se cierra una sesión que no se abrió.
-- Corre junto con trg_sesion_tiempo. Los dos tienen que dejar pasar la fila.
CREATE OR REPLACE FUNCTION fn_sesion_fechas() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.inicio_programado IS NULL OR NEW.fin_programado IS NULL
       OR NEW.fin_programado <= NEW.inicio_programado THEN
        RAISE EXCEPTION 'El fin programado debe ser posterior al inicio programado.';
    END IF;
    IF NEW.cierre_real IS NOT NULL AND NEW.inicio_real IS NULL THEN
        RAISE EXCEPTION 'No puede haber cierre real si la sesión no tiene inicio real.';
    END IF;
    RETURN NEW;
END;
$$;

-- trg_participacion_convocada. Solo al insertar una participación, no al actualizarla.
-- La sesión tiene que existir. El caso_id de la participación tiene que ser el de esa sesión.
-- El estudiante tiene que estar en sesion_estudiante. Estar en el grupo no basta.
CREATE OR REPLACE FUNCTION fn_participacion_convocada() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    caso_sesion bigint;
BEGIN
    SELECT caso_id INTO caso_sesion FROM sesion WHERE id = NEW.sesion_id;
    IF caso_sesion IS NULL THEN
        RAISE EXCEPTION 'La participación debe apuntar a una sesión que exista.';
    END IF;
    IF NEW.caso_id IS DISTINCT FROM caso_sesion THEN
        RAISE EXCEPTION 'El caso de la participación debe ser el caso de la sesión.';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM sesion_estudiante
        WHERE sesion_id = NEW.sesion_id AND estudiante_id = NEW.estudiante_id
    ) THEN
        RAISE EXCEPTION 'El estudiante no está convocado en esta sesión.';
    END IF;
    RETURN NEW;
END;
$$;

-- trg_respuesta_coherente. Antes de insertar o actualizar una respuesta.
-- La opción tiene que existir y su pregunta_id tiene que ser el de esta respuesta.
-- El caso_id de la respuesta tiene que ser el caso_id de esa pregunta.
-- No basta con que la opción exista en otra pregunta del mismo caso.
CREATE OR REPLACE FUNCTION fn_respuesta_coherente() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    pregunta_de_opcion bigint;
    caso_de_pregunta bigint;
BEGIN
    SELECT pregunta_id INTO pregunta_de_opcion FROM opcion WHERE id = NEW.opcion_id;
    IF pregunta_de_opcion IS NULL THEN
        RAISE EXCEPTION 'La opción elegida no existe.';
    END IF;
    IF pregunta_de_opcion IS DISTINCT FROM NEW.pregunta_id THEN
        RAISE EXCEPTION 'La opción no pertenece a esa pregunta.';
    END IF;
    SELECT caso_id INTO caso_de_pregunta FROM pregunta WHERE id = NEW.pregunta_id;
    IF caso_de_pregunta IS NULL THEN
        RAISE EXCEPTION 'La pregunta de la respuesta no existe.';
    END IF;
    IF NEW.caso_id IS DISTINCT FROM caso_de_pregunta THEN
        RAISE EXCEPTION 'El caso de la respuesta debe ser el caso de la pregunta.';
    END IF;
    RETURN NEW;
END;
$$;

-- trg_autorizacion_intento_cerrado. Solo al insertar una autorización.
-- Busca la participación y mira fin. Si no existe, o si fin está vacío, rechaza el permiso.
-- Un intento en curso o un ausente no puede recibir autorización. No crea el intento nuevo.
CREATE OR REPLACE FUNCTION fn_autorizacion_intento_cerrado() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    fin_intento timestamp;
BEGIN
    SELECT fin INTO fin_intento FROM participacion WHERE id = NEW.participacion_id;
    IF NOT FOUND OR fin_intento IS NULL THEN
        RAISE EXCEPTION 'Solo se autoriza repetir un intento ya terminado.';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sesion_tiempo
    BEFORE INSERT OR UPDATE ON sesion
    FOR EACH ROW EXECUTE FUNCTION fn_sesion_tiempo();

CREATE TRIGGER trg_sesion_fechas
    BEFORE INSERT OR UPDATE ON sesion
    FOR EACH ROW EXECUTE FUNCTION fn_sesion_fechas();

CREATE TRIGGER trg_participacion_convocada
    BEFORE INSERT ON participacion
    FOR EACH ROW EXECUTE FUNCTION fn_participacion_convocada();

CREATE TRIGGER trg_respuesta_coherente
    BEFORE INSERT OR UPDATE ON respuesta
    FOR EACH ROW EXECUTE FUNCTION fn_respuesta_coherente();

CREATE TRIGGER trg_autorizacion_intento_cerrado
    BEFORE INSERT ON autorizacion_repeticion
    FOR EACH ROW EXECUTE FUNCTION fn_autorizacion_intento_cerrado();

-- v_estado_sesion. Una fila por sesión, con el estado que la tabla no guarda.
-- FINALIZADO si hay cierre_real. EN_CURSO si hay inicio_real y no hay cierre.
-- SIN_INICIAR si faltan las dos. Las fechas programadas se muestran y no deciden el estado.
CREATE VIEW v_estado_sesion AS
SELECT
    s.id,
    s.caso_id,
    s.grupo_id,
    s.codigo_autorizacion,
    s.inicio_programado,
    s.fin_programado,
    s.inicio_real,
    s.cierre_real,
    CASE
        WHEN s.cierre_real IS NOT NULL THEN 'FINALIZADO'
        WHEN s.inicio_real IS NOT NULL THEN 'EN_CURSO'
        ELSE 'SIN_INICIAR'
    END AS estado
FROM sesion s;

-- v_estado_participacion. Una fila por intento.
-- FINALIZADA si hay fin. EN_CURSO si hay inicio y no hay fin. AUSENTE si las dos fechas están vacías.
-- minutos_corridos va de inicio a fin. Si el intento sigue abierto, usa la hora actual.
-- Si nunca empezó, los minutos quedan vacíos.
CREATE VIEW v_estado_participacion AS
SELECT
    p.id,
    p.sesion_id,
    p.estudiante_id,
    p.caso_id,
    p.numero_intento,
    p.inicio,
    p.fin,
    CASE
        WHEN p.fin IS NOT NULL THEN 'FINALIZADA'
        WHEN p.inicio IS NOT NULL THEN 'EN_CURSO'
        ELSE 'AUSENTE'
    END AS estado,
    CASE
        WHEN p.inicio IS NULL THEN NULL
        ELSE ROUND(EXTRACT(EPOCH FROM (COALESCE(p.fin, NOW()) - p.inicio)) / 60.0, 1)
    END AS minutos_corridos
FROM participacion p;

-- v_nota_con_nivel. El puntaje guardado en evaluacion y el nivel calculado al leer.
-- SUPERIOR desde 4,6. ALTO desde 4,0. BASICO desde 3,0. BAJO por debajo, o si el puntaje viene vacío.
-- El nivel no se escribe en la tabla.
CREATE VIEW v_nota_con_nivel AS
SELECT
    e.participacion_id,
    e.puntaje,
    CASE
        WHEN e.puntaje IS NULL THEN 'BAJO'
        WHEN e.puntaje >= 4.6 THEN 'SUPERIOR'
        WHEN e.puntaje >= 4.0 THEN 'ALTO'
        WHEN e.puntaje >= 3.0 THEN 'BASICO'
        ELSE 'BAJO'
    END AS nivel
FROM evaluacion e;

-- v_rubrica_caso. Cada pregunta del caso, aunque no tenga criterio.
-- Muestra orden, texto del criterio y peso. suma_pesos repite en cada fila la suma del caso.
-- Sirve para ver si los pesos llegan a 5,0. Un caso sin preguntas no aparece.
CREATE VIEW v_rubrica_caso AS
SELECT
    c.id AS caso_id,
    c.nombre AS caso,
    p.id AS pregunta_id,
    p.orden,
    cr.criterio,
    cr.peso,
    SUM(cr.peso) OVER (PARTITION BY c.id) AS suma_pesos
FROM caso c
JOIN escenario es ON es.caso_id = c.id
JOIN pregunta p ON p.escenario_id = es.id
LEFT JOIN criterio_rubrica cr ON cr.pregunta_id = p.id;

-- v_respuesta_detalle. Lo que el estudiante eligió en cada pregunta respondida.
-- Junta el enunciado, el texto de la opción, si era correcta, la explicación y el fundamento.
-- Explicación y fundamento salen de retroalimentacion y pueden ir vacíos.
-- No inventa filas para las preguntas que no contestó.
CREATE VIEW v_respuesta_detalle AS
SELECT
    r.participacion_id,
    r.pregunta_id,
    r.caso_id,
    r.opcion_id,
    r.fecha_respuesta,
    p.enunciado,
    o.descripcion AS opcion,
    o.es_correcta,
    rt.explicacion,
    rt.fundamento
FROM respuesta r
JOIN pregunta p ON p.id = r.pregunta_id
JOIN opcion o ON o.id = r.opcion_id
LEFT JOIN retroalimentacion rt ON rt.opcion_id = o.id;

-- v_avisos_pendientes. Una fila por usuario, también si no tiene avisos.
-- sin_leer cuenta solo notificacion.leida en falso. Quien ya leyó todo, o no tiene avisos, queda en 0.
-- No mira si el mismo texto se envió además por correo.
CREATE VIEW v_avisos_pendientes AS
SELECT
    u.id AS usuario_id,
    u.nombre,
    u.email,
    COUNT(n.id) FILTER (WHERE NOT n.leida) AS sin_leer
FROM usuario u
LEFT JOIN notificacion n ON n.usuario_id = u.id
GROUP BY u.id, u.nombre, u.email;

-- v_convocatoria. Parte de sesion_estudiante, la lista de citados.
-- Si no tiene participación, el estado es SIN_INTENTO. Si tiene, muestra el intento y
-- FINALIZADA, EN_CURSO o AUSENTE. Un segundo intento sale como otra fila.
-- Quien está en el grupo y no fue convocado a esa sesión no aparece.
CREATE VIEW v_convocatoria AS
SELECT
    se.sesion_id,
    se.estudiante_id,
    u.nombre AS estudiante,
    u.email,
    se.grupo_id,
    p.id AS participacion_id,
    p.numero_intento,
    CASE
        WHEN p.id IS NULL THEN 'SIN_INTENTO'
        WHEN p.fin IS NOT NULL THEN 'FINALIZADA'
        WHEN p.inicio IS NOT NULL THEN 'EN_CURSO'
        ELSE 'AUSENTE'
    END AS estado
FROM sesion_estudiante se
JOIN usuario u ON u.id = se.estudiante_id
LEFT JOIN participacion p
    ON p.sesion_id = se.sesion_id AND p.estudiante_id = se.estudiante_id;

-- v_seguimiento_sesion. La fila del reporte, una por convocado y por intento.
-- El estado es el del reporte, no el de v_estado_participacion:
-- AUSENTE si no hay intento o no tiene fechas; COMPLETA si respondió todas las preguntas del caso;
-- PARCIAL si empezó y faltan preguntas. El ausente lleva intento 0 y puntaje 0,0.
-- aciertos cuenta opciones correctas. total_preguntas cuenta las preguntas de todas las escenas.
-- El nivel usa otra vez 4,6, 4,0 y 3,0. Si hay intento y todavía no hay evaluacion, el puntaje queda vacío y el nivel es BAJO.
CREATE VIEW v_seguimiento_sesion AS
WITH preguntas_caso AS (
    SELECT es.caso_id, COUNT(p.id)::integer AS total_preguntas
    FROM escenario es
    JOIN pregunta p ON p.escenario_id = es.id
    GROUP BY es.caso_id
),
aciertos AS (
    SELECT r.participacion_id, COUNT(*)::integer AS aciertos
    FROM respuesta r
    JOIN opcion o ON o.id = r.opcion_id AND o.es_correcta
    GROUP BY r.participacion_id
),
respondidas AS (
    SELECT participacion_id, COUNT(DISTINCT pregunta_id)::integer AS respondidas
    FROM respuesta
    GROUP BY participacion_id
)
SELECT
    se.sesion_id,
    s.caso_id,
    se.estudiante_id,
    u.nombre AS estudiante,
    COALESCE(p.numero_intento, 0) AS numero_intento,
    p.id AS participacion_id,
    CASE
        WHEN p.id IS NULL OR (p.inicio IS NULL AND p.fin IS NULL) THEN 'AUSENTE'
        WHEN COALESCE(pc.total_preguntas, 0) > 0
             AND COALESCE(rd.respondidas, 0) >= pc.total_preguntas THEN 'COMPLETA'
        ELSE 'PARCIAL'
    END AS estado,
    CASE
        WHEN p.id IS NULL OR (p.inicio IS NULL AND p.fin IS NULL) THEN 0.0
        ELSE ev.puntaje
    END AS puntaje,
    COALESCE(ac.aciertos, 0) AS aciertos,
    COALESCE(pc.total_preguntas, 0) AS total_preguntas,
    CASE
        WHEN (CASE
                WHEN p.id IS NULL OR (p.inicio IS NULL AND p.fin IS NULL) THEN 0.0
                ELSE ev.puntaje
              END) >= 4.6 THEN 'SUPERIOR'
        WHEN (CASE
                WHEN p.id IS NULL OR (p.inicio IS NULL AND p.fin IS NULL) THEN 0.0
                ELSE ev.puntaje
              END) >= 4.0 THEN 'ALTO'
        WHEN (CASE
                WHEN p.id IS NULL OR (p.inicio IS NULL AND p.fin IS NULL) THEN 0.0
                ELSE ev.puntaje
              END) >= 3.0 THEN 'BASICO'
        ELSE 'BAJO'
    END AS nivel
FROM sesion_estudiante se
JOIN sesion s ON s.id = se.sesion_id
JOIN usuario u ON u.id = se.estudiante_id
LEFT JOIN participacion p
    ON p.sesion_id = se.sesion_id AND p.estudiante_id = se.estudiante_id
LEFT JOIN evaluacion ev ON ev.participacion_id = p.id
LEFT JOIN preguntas_caso pc ON pc.caso_id = s.caso_id
LEFT JOIN aciertos ac ON ac.participacion_id = p.id
LEFT JOIN respondidas rd ON rd.participacion_id = p.id;
