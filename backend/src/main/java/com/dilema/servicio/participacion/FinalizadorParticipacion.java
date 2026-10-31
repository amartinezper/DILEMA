package com.dilema.servicio.participacion;

import com.dilema.modelo.Participacion;
import com.dilema.servicio.BitacoraServicio;
import com.dilema.servicio.evaluacion.ObservadorEstudiante;
import com.dilema.servicio.evaluacion.SujetoNotificador;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.function.Function;

/**
 * Template Method (RF-12): siempre registra el fin, calcula la nota y avisa.
 * Cambia solo cómo se determina el instante de cierre. La nota (RF-13) la trae
 * ya calculada la función inyectada; el aviso (RF-27) se dispara con el Observer.
 */
public abstract class FinalizadorParticipacion {
    private final BitacoraServicio bitacora;
    private final Function<Participacion, BigDecimal> calcularNota;

    protected FinalizadorParticipacion(BitacoraServicio bitacora, Function<Participacion, BigDecimal> calcularNota) {
        this.bitacora = bitacora;
        this.calcularNota = calcularNota;
    }

    public final void finalizar(Participacion participacion) {
        if (!participacion.enCurso()) return;
        participacion.fin = determinarFin(participacion);
        participacion.fijarNota(calcularNota.apply(participacion));
        if (participacion.nota() != null) {
            SujetoNotificador sujeto = new SujetoNotificador();
            sujeto.agregar(new ObservadorEstudiante(participacion.estudiante, bitacora));
            sujeto.notificar("NOTA_PUBLICADA",
                    participacion.sesion.caso.nombre + ": " + participacion.nota() + " / 5,0.", "CORREO");
        }
    }

    protected abstract LocalDateTime determinarFin(Participacion participacion);

    public static final class PorEstudiante extends FinalizadorParticipacion {
        public PorEstudiante(BitacoraServicio bitacora, Function<Participacion, BigDecimal> calcularNota) {
            super(bitacora, calcularNota);
        }

        @Override
        protected LocalDateTime determinarFin(Participacion participacion) {
            return LocalDateTime.now();
        }
    }

    public static final class PorLimite extends FinalizadorParticipacion {
        public PorLimite(BitacoraServicio bitacora, Function<Participacion, BigDecimal> calcularNota) {
            super(bitacora, calcularNota);
        }

        @Override
        protected LocalDateTime determinarFin(Participacion participacion) {
            return RelojParticipacion.finPorLimite(participacion, LocalDateTime.now());
        }
    }
}
