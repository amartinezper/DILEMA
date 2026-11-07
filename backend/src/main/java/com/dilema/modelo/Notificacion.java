package com.dilema.modelo;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * RF-27: aviso que recibe un usuario dentro del sistema. Se guarda para poder
 * listarlo en el panel y marcarlo como leído.
 */
@Entity
@Table(name = "notificacion")
public class Notificacion {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;
    @ManyToOne(optional = false)
    @JoinColumn(name = "usuario_id")
    public Usuario usuario;
    @Column(nullable = false, length = 20)
    public String canal;
    @Column(nullable = false, length = 200)
    public String titulo;
    @Column(columnDefinition = "text")
    public String cuerpo;
    @Column(nullable = false)
    public boolean leida = false;
    @Column(nullable = false)
    public LocalDateTime fecha = LocalDateTime.now();
    /** Clave opcional para no repetir un aviso derivado de una sesión (p. ej. "sesion:4:asignado"). */
    @Column(length = 80)
    public String referencia;
}
