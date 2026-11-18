package com.dilema.servicio.diseno;

import com.dilema.modelo.Caso;
import com.dilema.modelo.Catalogo;
import com.dilema.servicio.ReglaNegocio;

/**
 * State (RF-09). Estado inicial de todo caso nuevo y de toda copia.
 * Es el único que se edita. Solo puede pasar a Publicado, y únicamente
 * por la validación compartida. Despublicar y archivar no le corresponden.
 */
public final class Borrador extends EstadoConPublicacion {
    public Borrador(UsoDelCaso uso) {
        super(uso);
    }

    @Override
    public void publicar(Caso caso) {
        pasarAPublicado(caso);
    }

    @Override
    public void despublicar(Caso caso) {
        throw new ReglaNegocio("Este caso todavía es un borrador, así que no está publicado.");
    }

    @Override
    public void archivar(Caso caso) {
        throw new ReglaNegocio("Para archivar el caso, primero publícalo.");
    }

    @Override
    public boolean permiteEdicion() {
        return true;
    }

    @Override
    public Catalogo.EstadoCaso codigo() {
        return Catalogo.EstadoCaso.BORRADOR;
    }
}
