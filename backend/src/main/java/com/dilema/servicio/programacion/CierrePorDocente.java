package com.dilema.servicio.programacion;

import com.dilema.modelo.SesionCaso;
import com.dilema.repo.ParticipacionRepo;
import com.dilema.servicio.ParticipacionServicio;

public class CierrePorDocente extends CierreSesion {
    public CierrePorDocente(ParticipacionServicio a, ParticipacionRepo b) {
        super(a, b);
    }

    @Override
    protected boolean puedeCerrar(SesionCaso sesion) {
        EstadosDeSesion.de(sesion).finalizar(sesion);
        return true;
    }
}
