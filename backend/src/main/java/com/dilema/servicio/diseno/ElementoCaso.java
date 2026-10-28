package com.dilema.servicio.diseno;

import java.util.List;

/**
 * Composite (RF-06). Caso, escenario y pregunta son compuestos; la opción es la hoja.
 * Las listas del modelo siguen siendo Escenario, Pregunta y Opcion.
 */
public interface ElementoCaso {
    void validar(List<String> errores);

    String presentar();

    boolean esCompleto();
}
