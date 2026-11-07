package com.dilema.servicio.evaluacion;

import com.dilema.modelo.Participacion;
import com.dilema.servicio.BitacoraServicio;

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

    /**
     * RF-27: publica la nota de un intento (finalizado o ausente) al estudiante,
     * por correo y como aviso dentro del sistema.
     */
    public static void publicarNota(Participacion participacion, BitacoraServicio bitacora) {
        if (participacion.nota() == null) return;
        SujetoNotificador sujeto = new SujetoNotificador();
        sujeto.agregar(new ObservadorEstudiante(participacion.estudiante, bitacora));
        String mensaje = participacion.sesion.caso.nombre + ": " + participacion.nota() + " / 5,0.";
        sujeto.notificar("NOTA_PUBLICADA", mensaje, "CORREO");
        sujeto.notificar("NOTA_PUBLICADA", mensaje, "SISTEMA");
    }
}
