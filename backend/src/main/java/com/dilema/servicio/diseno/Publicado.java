package com.dilema.servicio.diseno;

import com.dilema.modelo.Caso;
import com.dilema.modelo.Catalogo;
import com.dilema.servicio.ReglaNegocio;

/**
 * State (RF-09). Único estado que se puede agendar.
 * Archiva aunque ya tenga sesiones: el archivo solo impide programaciones nuevas.
 * Despublica a Borrador solo cuando no hay sesiones ni participaciones.
 * No se edita y no se vuelve a publicar.
 */
public final class Publicado extends EstadoDeCaso {
    public Publicado(UsoDelCaso uso) {
        super(uso);
    }

    @Override
    public void publicar(Caso caso) {
        throw new ReglaNegocio("RF-09: el caso ya está publicado.");
    }

    @Override
    public void despublicar(Caso caso) {
        if (uso().tieneSesiones(caso) || uso().tieneParticipaciones(caso)) {
            throw new ReglaNegocio("RF-09: no se puede despublicar porque el caso tiene sesiones o participaciones.");
        }
        caso.cambiarEstado(new Borrador(uso()));
    }

    @Override
    public void archivar(Caso caso) {
        caso.cambiarEstado(new Archivado(uso()));
    }

    @Override
    public boolean permiteEdicion() {
        return false;
    }

    @Override
    public Catalogo.EstadoCaso codigo() {
        return Catalogo.EstadoCaso.PUBLICADO;
    }
}
