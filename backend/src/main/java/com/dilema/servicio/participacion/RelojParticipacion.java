package com.dilema.servicio.participacion;

import com.dilema.modelo.Participacion;

import java.time.LocalDateTime;

/** RF-12 y RF-23: el tiempo del estudiante y el fin de la sesión cierran el intento. */
public final class RelojParticipacion {
    private RelojParticipacion() {}

    public static boolean debeCerrar(Participacion participacion, LocalDateTime ahora) {
        if (participacion == null || !participacion.enCurso()) return false;
        return participacion.sesion.limiteDeIntentoAlcanzado(participacion.inicio, ahora);
    }

    public static LocalDateTime finPorLimite(Participacion participacion, LocalDateTime ahora) {
        LocalDateTime porTiempo = participacion.inicio.plusMinutes(participacion.sesion.tiempoMaxMin);
        LocalDateTime porVentana = participacion.sesion.fin;
        LocalDateTime limite = porTiempo;
        if (porVentana != null && porVentana.isBefore(limite)) limite = porVentana;
        return ahora.isBefore(limite) ? ahora : limite;
    }
}
