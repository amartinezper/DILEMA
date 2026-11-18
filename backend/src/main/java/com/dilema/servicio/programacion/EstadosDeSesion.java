package com.dilema.servicio.programacion;

import com.dilema.modelo.SesionCaso;
import com.dilema.servicio.ReglaNegocio;

import java.time.LocalDateTime;

public final class EstadosDeSesion {
    private EstadosDeSesion() {}

    public static EstadoSesion de(SesionCaso sesion) {
        return switch (sesion.estado()) {
            case EN_CURSO -> new EnCurso();
            case FINALIZADO -> new Finalizado();
            default -> new SinIniciar();
        };
    }

    public static class SinIniciar implements EstadoSesion {
        @Override
        public void iniciar(SesionCaso sesion) {
            sesion.inicioReal = LocalDateTime.now();
        }

        @Override
        public void finalizar(SesionCaso sesion) {
            throw new ReglaNegocio("Solo puedes cerrar una sesión que esté en curso.");
        }

        @Override
        public boolean permiteParticipar() {
            return false;
        }
    }

    public static class EnCurso implements EstadoSesion {
        @Override
        public void iniciar(SesionCaso sesion) {
            throw new ReglaNegocio("Solo puedes abrir una sesión que todavía no ha comenzado.");
        }

        @Override
        public void finalizar(SesionCaso sesion) {
            // Permitido. El cierre de participaciones lo aplica CierreSesion.
        }

        @Override
        public boolean permiteParticipar() {
            return true;
        }
    }

    public static class Finalizado implements EstadoSesion {
        @Override
        public void iniciar(SesionCaso sesion) {
            throw new ReglaNegocio("Solo puedes abrir una sesión que todavía no ha comenzado.");
        }

        @Override
        public void finalizar(SesionCaso sesion) {
            throw new ReglaNegocio("Esta sesión ya finalizó y no se puede volver a abrir ni a cerrar.");
        }

        @Override
        public boolean permiteParticipar() {
            return false;
        }
    }

    /**
     * CU-15-P04: el cierre automático vence un día después del fin previsto,
     * aunque la sesión no se haya iniciado.
     */
    public static boolean vencioPlazoDeCierre(SesionCaso sesion, LocalDateTime ahora) {
        return sesion.cierreReal == null
                && sesion.fin != null
                && !sesion.fin.plusDays(1).isAfter(ahora);
    }
}
