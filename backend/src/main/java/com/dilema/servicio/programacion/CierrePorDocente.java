package com.dilema.servicio.programacion;

import com.dilema.modelo.SesionCaso;
import com.dilema.repo.ParticipacionRepo;
import com.dilema.servicio.BitacoraServicio;
import com.dilema.servicio.ParticipacionServicio;

public class CierrePorDocente extends CierreSesion {
    public CierrePorDocente(ParticipacionServicio a, ParticipacionRepo b) {
        super(a, b);
    }

    public CierrePorDocente(ParticipacionServicio a, ParticipacionRepo b, BitacoraServicio bitacora) {
        super(a, b, bitacora);
    }

    @Override
    protected boolean puedeCerrar(SesionCaso sesion) {
        EstadosDeSesion.de(sesion).finalizar(sesion);
        return true;
    }
}
