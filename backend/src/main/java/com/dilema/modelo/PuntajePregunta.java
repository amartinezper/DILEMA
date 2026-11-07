package com.dilema.modelo;

import jakarta.persistence.*;
import java.math.BigDecimal;

/**
 * RF-24 / RF-13: puntaje obtenido en cada pregunta de un intento. Lo llena la Strategy
 * de calificación; el ausente queda con 0,0 por pregunta. La suma es Evaluacion.puntaje.
 */
@Entity
@Table(name = "puntaje_pregunta",
        uniqueConstraints = @UniqueConstraint(columnNames = {"participacion_id", "pregunta_id"}))
public class PuntajePregunta {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;
    @ManyToOne(optional = false)
    @JoinColumn(name = "participacion_id")
    public Participacion participacion;
    @ManyToOne(optional = false)
    @JoinColumn(name = "pregunta_id")
    public Pregunta pregunta;
    @Column(nullable = false, precision = 2, scale = 1)
    public BigDecimal puntaje;
}
