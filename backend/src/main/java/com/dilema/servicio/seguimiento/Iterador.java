package com.dilema.servicio.seguimiento;

/**
 * Iterator (RF-15). Recorre una colección sin mostrar si por dentro es una lista,
 * una tabla o una consulta. Quien lo usa solo pregunta si hay siguiente y lo toma.
 */
public interface Iterador<T> {
    boolean haySiguiente();

    T siguiente();

    void reiniciar();
}
