package com.dilema.servicio.evaluacion;

import com.dilema.modelo.Usuario;
import com.dilema.servicio.BitacoraServicio;

/**
 * Observer (RF-27): el estudiante es el observador concreto — recibe la nota por
 * correo (NOTA_PUBLICADA) y la retroalimentación general dentro del sistema
 * (RETROALIMENTACION_AGREGADA), reutilizando BitacoraServicio.avisar(...).
 */
public class ObservadorEstudiante implements ObservadorNotificacion {
    private final Usuario estudiante;
    private final BitacoraServicio bitacora;

    public ObservadorEstudiante(Usuario estudiante, BitacoraServicio bitacora) {
        this.estudiante = estudiante;
        this.bitacora = bitacora;
    }

    @Override
    public void actualizar(String tipo, String mensaje, String canal) {
        String titulo = "NOTA_PUBLICADA".equals(tipo) ? "Nota del caso" : "Retroalimentación del docente";
        bitacora.avisar(estudiante, canal, titulo, mensaje);
    }
}
