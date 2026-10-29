package com.dilema.servicio.diseno;

import com.dilema.modelo.Caso;

import java.util.List;

/**
 * Lo que el estado necesita preguntarle al caso y no está dentro de la entidad.
 * La validación de estructura y rúbrica ya vive en el árbol del caso.
 * Las sesiones y las participaciones están en otras tablas.
 */
public interface UsoDelCaso {
    List<String> validar(Caso caso);

    boolean tieneSesiones(Caso caso);

    boolean tieneParticipaciones(Caso caso);
}
