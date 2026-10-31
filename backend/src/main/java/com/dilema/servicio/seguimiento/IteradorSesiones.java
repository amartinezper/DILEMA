package com.dilema.servicio.seguimiento;

import com.dilema.modelo.SesionCaso;

import java.util.ArrayList;
import java.util.List;
import java.util.NoSuchElementException;

/**
 * Iterator (RF-15). Recorre las sesiones finalizadas que HistorialSesiones ya filtró.
 * La posición queda dentro del iterador; la lista original no se modifica.
 */
public final class IteradorSesiones implements Iterador<SesionCaso> {
    private final List<SesionCaso> sesiones;
    private int posicion;

    public IteradorSesiones(List<SesionCaso> sesiones) {
        this.sesiones = new ArrayList<>();
        if (sesiones != null) {
            for (SesionCaso sesion : sesiones) {
                if (sesion != null) this.sesiones.add(sesion);
            }
        }
    }

    @Override
    public boolean haySiguiente() {
        return posicion < sesiones.size();
    }

    @Override
    public SesionCaso siguiente() {
        if (!haySiguiente()) {
            throw new NoSuchElementException("RF-15: no hay más sesiones en el recorrido.");
        }
        return sesiones.get(posicion++);
    }

    @Override
    public void reiniciar() {
        posicion = 0;
    }
}
