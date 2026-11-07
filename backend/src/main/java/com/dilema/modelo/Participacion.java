package com.dilema.modelo;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "participacion")
public class Participacion {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;
    @ManyToOne(optional = false)
    @JoinColumn(name = "sesion_id")
    public SesionCaso sesion;
    @ManyToOne(optional = false)
    @JoinColumn(name = "estudiante_id")
    public Usuario estudiante;
    @Column(name = "caso_id", nullable = false)
    public Long casoId;
    @Column(name = "numero_intento", nullable = false)
    public int numeroIntento = 1;
    public LocalDateTime inicio;
    public LocalDateTime fin;

    @OneToMany(mappedBy = "participacion", cascade = CascadeType.ALL, orphanRemoval = true)
    public List<Respuesta> respuestas = new ArrayList<>();

    @OneToOne(mappedBy = "participacion", cascade = CascadeType.ALL, orphanRemoval = true)
    public Evaluacion evaluacion;

    @OneToMany(mappedBy = "participacion", cascade = CascadeType.ALL, orphanRemoval = true)
    public List<PuntajePregunta> puntajes = new ArrayList<>();

    @OneToOne(mappedBy = "participacion", cascade = CascadeType.ALL, orphanRemoval = true)
    public RetroalimentacionDocente retroalimentacionDocente;

    @OneToOne(mappedBy = "participacion", cascade = CascadeType.ALL, orphanRemoval = true)
    public AutorizacionRepeticion autorizacion;

    public boolean enCurso() { return inicio != null && fin == null; }
    public boolean finalizada() { return fin != null; }
    public boolean ausente() { return inicio == null && fin == null; }

    public String estadoNombre() {
        if (fin != null) return "FINALIZADA";
        if (inicio != null) return "EN_CURSO";
        return "AUSENTE";
    }

    public Double nota() {
        return evaluacion == null || evaluacion.puntaje == null ? null : evaluacion.puntaje.doubleValue();
    }

    public String comentarioDocente() {
        return retroalimentacionDocente == null ? null : retroalimentacionDocente.comentario;
    }

    public void fijarNota(BigDecimal puntaje) {
        if (evaluacion == null) {
            evaluacion = new Evaluacion();
            evaluacion.participacion = this;
        }
        evaluacion.puntaje = puntaje;
    }

    /** RF-24: registra (o actualiza) el puntaje obtenido en una pregunta. */
    public void registrarPuntaje(Pregunta pregunta, BigDecimal puntaje) {
        PuntajePregunta registro = puntajes.stream()
                .filter(p -> p.pregunta == pregunta || (p.pregunta.id != null && p.pregunta.id.equals(pregunta.id)))
                .findFirst().orElse(null);
        if (registro == null) {
            registro = new PuntajePregunta();
            registro.participacion = this;
            registro.pregunta = pregunta;
            puntajes.add(registro);
        }
        registro.puntaje = puntaje;
    }

    public BigDecimal puntajeDe(Pregunta pregunta) {
        return puntajes.stream()
                .filter(p -> p.pregunta == pregunta || (p.pregunta.id != null && p.pregunta.id.equals(pregunta.id)))
                .map(p -> p.puntaje).findFirst().orElse(null);
    }
}
