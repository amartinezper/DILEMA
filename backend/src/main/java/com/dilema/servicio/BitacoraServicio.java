package com.dilema.servicio;

import com.dilema.modelo.Notificacion;
import com.dilema.modelo.Usuario;
import com.dilema.repo.NotificacionRepo;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Envía la convocatoria y la nota. Si el correo falla, la operación de negocio sigue.
 * RF-27: los avisos por el canal SISTEMA se guardan como Notificacion.
 */
@Service
public class BitacoraServicio {
    private static final Logger log = LoggerFactory.getLogger(BitacoraServicio.class);
    private final JavaMailSender correo;
    private final String desde;
    private final NotificacionRepo notificaciones;

    @Autowired
    public BitacoraServicio(JavaMailSender correo, @Value("${dilema.correo.desde}") String desde,
                            NotificacionRepo notificaciones) {
        this.correo = correo;
        this.desde = desde;
        this.notificaciones = notificaciones;
    }

    /** Sin repositorio: solo correo (los avisos de SISTEMA quedan en el log). */
    public BitacoraServicio(JavaMailSender correo, String desde) {
        this(correo, desde, null);
    }

    public void auditar(Usuario usuario, String accion, String detalle) {
        log.info("auditoria usuario={} accion={} detalle={}", usuario == null ? null : usuario.email, accion, detalle);
    }

    public void avisar(Usuario destinatario, String canal, String titulo, String cuerpo) {
        if ("SISTEMA".equals(canal)) {
            log.info("aviso sistema usuario={} titulo={} cuerpo={}", destinatario == null ? null : destinatario.email, titulo, cuerpo);
            if (destinatario != null) guardar(destinatario, canal, titulo, cuerpo, LocalDateTime.now(), null);
            return;
        }
        if (!"CORREO".equals(canal) || destinatario == null || destinatario.email == null || destinatario.email.isBlank()) {
            return;
        }
        try {
            SimpleMailMessage mensaje = new SimpleMailMessage();
            mensaje.setFrom(desde);
            mensaje.setTo(destinatario.email);
            mensaje.setSubject(titulo);
            mensaje.setText(cuerpo == null ? "" : cuerpo);
            correo.send(mensaje);
        } catch (RuntimeException error) {
            log.warn("No se pudo enviar el correo a {}: {}", destinatario.email, error.getMessage());
        }
    }

    /**
     * RF-27: guarda una sola vez el aviso identificado por {@code referencia} (por ejemplo,
     * "Caso asignado" de una sesión) para que tenga id propio y se pueda marcar como leído.
     */
    public void registrarUnaVez(Usuario destinatario, String referencia, String canal, String titulo,
                                String cuerpo, LocalDateTime fecha) {
        if (notificaciones == null || destinatario == null) return;
        if (notificaciones.findByUsuarioIdAndReferencia(destinatario.id, referencia).isPresent()) return;
        guardar(destinatario, canal, titulo, cuerpo, fecha, referencia);
    }

    public List<Notificacion> avisosDe(Usuario usuario) {
        if (notificaciones == null) return List.of();
        return notificaciones.findByUsuarioIdOrderByFechaDescIdDesc(usuario.id);
    }

    /** RF-27: marca como leído un aviso propio. */
    public void marcarLeido(Usuario usuario, Long id) {
        if (notificaciones == null) throw new NoEncontrado("Aviso no encontrado.");
        Notificacion notificacion = notificaciones.findById(id).orElseThrow(() -> new NoEncontrado("Aviso no encontrado."));
        if (!notificacion.usuario.id.equals(usuario.id)) throw new AccesoDenegado("Este aviso no es tuyo.");
        notificacion.leida = true;
        notificaciones.save(notificacion);
    }

    private void guardar(Usuario destinatario, String canal, String titulo, String cuerpo,
                         LocalDateTime fecha, String referencia) {
        if (notificaciones == null) return;
        Notificacion notificacion = new Notificacion();
        notificacion.usuario = destinatario;
        notificacion.canal = canal;
        notificacion.titulo = titulo;
        notificacion.cuerpo = cuerpo;
        notificacion.fecha = fecha == null ? LocalDateTime.now() : fecha;
        notificacion.referencia = referencia;
        notificaciones.save(notificacion);
    }
}
