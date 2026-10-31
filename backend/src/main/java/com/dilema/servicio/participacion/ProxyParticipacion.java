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
            throw new ReglaNegocio("RF-25: la sesión ya finalizó y no admite participación.");
        }
        if (!EstadosDeSesion.de(sesion).permiteParticipar()) {
            throw new ReglaNegocio("La sesión todavía no está en curso.");
        }
        if (!sesion.ventanaAbierta(ahora)) {
            throw new ReglaNegocio("RF-23: la ventana de la sesión ya cerró.");
        }
    }

    public void ingresoTardio(SesionCaso sesion, LocalDateTime ahora) {
        if (!sesion.permiteIngreso(ahora)) {
            throw new ReglaNegocio("RF-22: ya pasó el tiempo definido por el docente para iniciar.");
        }
    }

    public void puedeRepetir(Participacion previa) {
        if (previa != null && previa.autorizacion == null) {
            throw new ReglaNegocio("RF-25: ya registraste una participación. Solo el docente creador puede autorizar otra.");
        }
    }
}
