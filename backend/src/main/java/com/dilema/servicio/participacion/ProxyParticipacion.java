package com.dilema.servicio.participacion;

import com.dilema.modelo.Catalogo;
import com.dilema.modelo.Participacion;
import com.dilema.modelo.SesionCaso;
import com.dilema.servicio.ReglaNegocio;
import com.dilema.servicio.programacion.EstadosDeSesion;

import java.time.LocalDateTime;

/** Proxy de protección (RF-22, RF-23 y RF-25). */
public class ProxyParticipacion {
    public void sesionAbierta(SesionCaso sesion, LocalDateTime ahora) {
        if (sesion.estado() == Catalogo.EstadoSesion.FINALIZADO) {
            throw new ReglaNegocio("Esta sesión ya finalizó, así que ya no puedes participar.");
        }
        if (!EstadosDeSesion.de(sesion).permiteParticipar()) {
            throw new ReglaNegocio("La sesión todavía no está en curso.");
        }
        if (!sesion.ventanaAbierta(ahora)) {
            throw new ReglaNegocio("Esta convocatoria ya terminó. La fecha de cierre pasó y ya no puedes entrar con este código.");
        }
    }

    public void ingresoTardio(SesionCaso sesion, LocalDateTime ahora) {
        if (!sesion.permiteIngreso(ahora)) {
            throw new ReglaNegocio("Ya pasó el tiempo que el docente dejó para entrar. Pídele que amplíe el plazo si todavía debes participar.");
        }
    }

    public void puedeRepetir(Participacion previa) {
        if (previa != null && previa.autorizacion == null) {
            throw new ReglaNegocio("Ya completaste este caso. Para intentarlo otra vez, el docente que lo creó tiene que autorizarlo.");
        }
    }
}
