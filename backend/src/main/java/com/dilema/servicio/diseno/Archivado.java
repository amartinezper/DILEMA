package com.dilema.servicio.diseno;

import com.dilema.modelo.Caso;
import com.dilema.modelo.Catalogo;
import com.dilema.servicio.ReglaNegocio;

/**
 * State (RF-09). El caso deja de usarse en programaciones nuevas.
 * Puede volver a Publicado si la validación sigue limpia, por el mismo
 * método que usa el borrador. No se edita, no se agenda, no se despublica
 * y no se archiva otra vez.
 */
public final class Archivado extends EstadoConPublicacion {
    public Archivado(UsoDelCaso uso) {
        super(uso);
    }

    @Override
    public void publicar(Caso caso) {
        pasarAPublicado(caso);
    }

    @Override
    public void despublicar(Caso caso) {
        throw new ReglaNegocio("RF-09: un caso archivado no vuelve a borrador. Se publica de nuevo.");
    }

    @Override
    public void archivar(Caso caso) {
        throw new ReglaNegocio("RF-09: el caso ya está archivado.");
    }

    @Override
    public boolean permiteEdicion() {
        return false;
    }

    @Override
    public Catalogo.EstadoCaso codigo() {
        return Catalogo.EstadoCaso.ARCHIVADO;
    }
}
