package com.dilema.servicio.evaluacion;

import com.dilema.modelo.Participacion;
import com.dilema.modelo.Pregunta;
import com.dilema.modelo.Respuesta;

/**
 * RF-14: resumen de aciertos, errores y preguntas sin responder de un intento.
 * Pasa por el mismo control del Proxy de protección: mientras el intento está en
 * curso no se anticipa nada y el resumen es {@code null}.
 */
public record ResumenIntento(int aciertos, int errores, int sinResponder) {

    public static ResumenIntento de(Participacion participacion) {
        if (!RetroalimentacionProxy.visible(participacion)) return null;
        int aciertos = 0;
        int errores = 0;
        int sinResponder = 0;
        for (Pregunta pregunta : EstrategiaCalificacion.preguntas(participacion.sesion.caso)) {
            Respuesta respuesta = participacion.respuestas.stream()
                    .filter(r -> r.pregunta.id.equals(pregunta.id)).findFirst().orElse(null);
            if (respuesta == null) sinResponder++;
            else if (respuesta.opcion.esCorrecta) aciertos++;
            else errores++;
        }
        return new ResumenIntento(aciertos, errores, sinResponder);
    }
}
