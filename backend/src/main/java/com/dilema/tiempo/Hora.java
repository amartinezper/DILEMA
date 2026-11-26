package com.dilema.tiempo;

import java.time.LocalDateTime;
import java.time.ZoneId;

/** Hora de Colombia. El formulario guarda la hora de reloj sin zona, y el servidor la lee aquí. */
public final class Hora {
    public static final ZoneId ZONA = ZoneId.of("America/Bogota");

    private Hora() {}

    public static LocalDateTime ahora() {
        return LocalDateTime.now(ZONA);
    }
}
