package com.dilema.servicio.programacion;

import com.dilema.modelo.SesionCaso;
import com.dilema.repo.ParticipacionRepo;
import com.dilema.servicio.ParticipacionServicio;

import java.time.LocalDateTime;

public class CierrePorFecha extends CierreSesion {
    public CierrePorFecha(ParticipacionServicio a, ParticipacionRepo b) {
        super(a, b);
    }

    @Override
    protected boolean puedeCerrar(SesionCaso sesion) {
        return EstadosDeSesion.vencioPlazoDeCierre(sesion, LocalDateTime.now());
    }
}
