package com.dilema.servicio.diseno;

final class Texto {
    private Texto() {}

    static boolean vacio(String valor) {
        return valor == null || valor.isBlank();
    }

    static String limpio(String valor) {
        return valor == null ? "" : valor.trim();
    }
}
