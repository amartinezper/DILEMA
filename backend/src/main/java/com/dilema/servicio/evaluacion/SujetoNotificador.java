package com.dilema.servicio.evaluacion;

import java.util.ArrayList;
import java.util.List;

/**
 * Observer (RF-27): sujeto concreto. La participación notifica a sus observadores
 * (el estudiante) cuando se publica la nota o se agrega la retroalimentación general.
 * Si no hay nota nueva ni comentario nuevo, quien dispara la notificación simplemente
 * no llama a notificar(...) y no hay aviso.
 */
public class SujetoNotificador {
    private final List<ObservadorNotificacion> observadores = new ArrayList<>();

    public void agregar(ObservadorNotificacion observador) {
        observadores.add(observador);
    }

    public void notificar(String tipo, String mensaje, String canal) {
        for (ObservadorNotificacion observador : observadores) observador.actualizar(tipo, mensaje, canal);
    }
}
