package com.dilema.servicio.programacion;

import com.dilema.modelo.Grupo;
import com.dilema.modelo.SesionCaso;
import com.dilema.modelo.Usuario;
import com.dilema.servicio.BitacoraServicio;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Observer (RF-21): al agendar, agregar o retirar se avisa al afectado
 * con el caso, el mensaje, la URL y el código.
 */
@Component
public class NotificadorConvocatoria {
    private final BitacoraServicio bitacora;
    private final String urlApp;

    public NotificadorConvocatoria(BitacoraServicio bitacora, @Value("${dilema.app.url:http://localhost:4200}") String urlApp) {
        this.bitacora = bitacora;
        this.urlApp = urlApp == null || urlApp.isBlank() ? "http://localhost:4200" : urlApp;
    }

    public void convocado(Usuario estudiante, SesionCaso sesion) {
        String mensaje = sesion.mensaje == null ? "" : sesion.mensaje.trim();
        String cuerpo = (mensaje.isEmpty() ? "" : mensaje + "\n\n")
                + "Caso: " + sesion.caso.nombre + "\n"
                + "Código de autorización: " + sesion.codigo + "\n"
                + "URL: " + urlApp + "/ingreso\n"
                + "Inicio: " + sesion.inicio + "\n"
                + "Fin: " + sesion.fin
                + (sesion.lugar == null || sesion.lugar.isBlank() ? "" : "\nLugar: " + sesion.lugar);
        bitacora.avisar(estudiante, "CORREO", "Convocatoria: " + sesion.caso.nombre, cuerpo);
    }

    public void agregadoSinSesion(Usuario estudiante, Grupo grupo) {
        bitacora.avisar(estudiante, "CORREO", "Convocatoria actualizada",
                "Fuiste agregado al espacio " + grupo.nombre
                        + ". El código de acceso se enviará cuando el docente programe la sesión. Entra en "
                        + urlApp + "/ingreso.");
    }

    public void retirado(Usuario estudiante, Grupo grupo) {
        bitacora.avisar(estudiante, "CORREO", "Cambio de convocatoria",
                "Fuiste retirado del espacio " + grupo.nombre + ".");
    }
}
