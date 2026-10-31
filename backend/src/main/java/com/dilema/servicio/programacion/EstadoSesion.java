package com.dilema.servicio.programacion;

import com.dilema.modelo.SesionCaso;

/** State (RF-19): lo permitido depende de SIN_INICIAR, EN_CURSO o FINALIZADO. */
public interface EstadoSesion {
    void iniciar(SesionCaso sesion);
    void finalizar(SesionCaso sesion);
    boolean permiteParticipar();
}
