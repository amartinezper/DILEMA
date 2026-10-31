package com.dilema.servicio.participacion;

import com.dilema.modelo.Opcion;
import com.dilema.modelo.Participacion;
import com.dilema.modelo.Pregunta;
import com.dilema.modelo.Respuesta;
import com.dilema.servicio.ReglaNegocio;

import java.time.LocalDateTime;
import java.util.function.Function;

/** Command (RF-10): registrar o cambiar una respuesta, y poder deshacerla. */
public class ComandoRespuesta {
    private final Long preguntaId;
    private final Long antes;
    private final Long despues;

    public ComandoRespuesta(Long preguntaId, Long antes, Long despues) {
        this.preguntaId = preguntaId;
        this.antes = antes;
        this.despues = despues;
    }

    public boolean esNoOp() {
        return antes != null && antes.equals(despues);
    }

    public void ejecutar(Participacion participacion, Pregunta pregunta, Opcion opcion, Respuesta actual) {
        if (actual == null) {
            Respuesta respuesta = new Respuesta();
            respuesta.participacion = participacion;
            respuesta.pregunta = pregunta;
            respuesta.casoId = participacion.casoId;
            respuesta.opcion = opcion;
            respuesta.fecha = LocalDateTime.now();
            participacion.respuestas.add(respuesta);
        } else {
            actual.opcion = opcion;
            actual.fecha = LocalDateTime.now();
        }
    }

    public void revertir(Participacion participacion, Function<Long, Pregunta> buscarPregunta) {
        Respuesta actual = participacion.respuestas.stream()
                .filter(r -> r.pregunta.id.equals(preguntaId)).findFirst().orElse(null);
        if (antes == null) {
            if (actual != null) participacion.respuestas.remove(actual);
            return;
        }
        if (actual == null) return;
        Pregunta pregunta = buscarPregunta.apply(preguntaId);
        actual.opcion = pregunta.opciones.stream().filter(o -> o.id.equals(antes)).findFirst()
                .orElseThrow(() -> new ReglaNegocio("No se pudo restaurar la opción anterior."));
    }

    public Long preguntaId() { return preguntaId; }
    public Long antes() { return antes; }
    public Long despues() { return despues; }
}
