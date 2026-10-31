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
            throw new ReglaNegocio("RF-19: solo se finaliza una sesión en curso.");
        }

        @Override
        public boolean permiteParticipar() {
            return false;
        }
    }

    public static class EnCurso implements EstadoSesion {
        @Override
        public void iniciar(SesionCaso sesion) {
            throw new ReglaNegocio("RF-19: solo se inicia una sesión sin iniciar.");
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
            throw new ReglaNegocio("RF-19: solo se inicia una sesión sin iniciar.");
        }

        @Override
        public void finalizar(SesionCaso sesion) {
            throw new ReglaNegocio("RF-19: una sesión finalizada no admite operaciones.");
        }

        @Override
        public boolean permiteParticipar() {
            return false;
        }
    }

    /** Cierre automático: un día después del fin previsto, aunque no se haya iniciado. */
    public static boolean vencioPlazoDeCierre(SesionCaso sesion, LocalDateTime ahora) {
        return sesion.cierreReal == null
                && sesion.fin != null
                && !sesion.fin.plusDays(1).isAfter(ahora);
    }
}
