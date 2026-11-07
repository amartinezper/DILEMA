package com.dilema.servicio.evaluacion;

/**
 * Observer (RF-27): reacciona a un evento de notificación disparado por el sujeto
 * (la participación). Tipos usados por el Módulo 6: NOTA_PUBLICADA (canal CORREO) y
 * RETROALIMENTACION_AGREGADA (canal SISTEMA).
 */
public interface ObservadorNotificacion {
    void actualizar(String tipo, String mensaje, String canal);
}
