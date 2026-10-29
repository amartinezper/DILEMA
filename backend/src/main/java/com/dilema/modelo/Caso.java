package com.dilema.modelo;

import jakarta.persistence.*;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "caso")
public class Caso {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;
    @ManyToOne(optional = false)
    @JoinColumn(name = "autor_id")
    public Usuario docente;
    @Column(nullable = false, length = 200)
    public String nombre;
    @Column(name = "desarrollo_situacional", columnDefinition = "text")
    public String desarrolloSituacional;
    @Column(columnDefinition = "text")
    public String contexto;
    @Column(name = "tiempo_estimado_minutos", nullable = false)
    public Integer tiempoEstimadoMin;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    public Catalogo.EstadoCaso estado = Catalogo.EstadoCaso.BORRADOR;
    @Column(name = "reparto_rubrica", length = 20)
    public String repartoRubrica = "PONDERADA";

    @OneToMany(mappedBy = "caso", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("orden")
    public List<Escenario> escenarios = new ArrayList<>();

    @OneToMany(mappedBy = "caso", cascade = CascadeType.ALL, orphanRemoval = true)
    public List<Personaje> personajes = new ArrayList<>();

    /**
     * Comportamiento del estado durante esta petición. No se guarda:
     * en la base queda el enum {@code estado}. Al cargar el caso, el servicio
     * vuelve a armar el objeto con {@code colocarEstado}.
     */
    @Transient
    private EstadoDelCaso comportamiento;

    /**
     * Deja listo el objeto que corresponde al enum ya guardado.
     * Si no coinciden, la operación no sigue: el caso no puede comportarse
     * como un estado distinto del que tiene persistido.
     */
    public void colocarEstado(EstadoDelCaso estado) {
        if (estado == null || estado.codigo() != this.estado) {
            throw new IllegalStateException("RF-09: el comportamiento no coincide con el estado guardado del caso.");
        }
        this.comportamiento = estado;
    }

    /** Delega en el estado actual. La regla vive en Borrador, Publicado o Archivado. */
    public void publicar() {
        estadoActual().publicar(this);
    }

    /** Delega en el estado actual. Solo Publicado puede completar esta operación. */
    public void despublicar() {
        estadoActual().despublicar(this);
    }

    /** Delega en el estado actual. Solo Publicado pasa a Archivado. */
    public void archivar() {
        estadoActual().archivar(this);
    }

    /** Verdadero únicamente cuando el estado actual es el borrador. */
    public boolean permiteEdicion() {
        return estadoActual().permiteEdicion();
    }

    /**
     * Lo usa el estado concreto después de aceptar la transición.
     * Escribe el enum y el objeto juntos, con el valor que declara el estado nuevo.
     */
    public void cambiarEstado(EstadoDelCaso siguiente) {
        if (siguiente == null) {
            throw new IllegalStateException("RF-09: la transición no tiene estado de destino.");
        }
        this.estado = siguiente.codigo();
        this.comportamiento = siguiente;
    }

    private EstadoDelCaso estadoActual() {
        if (comportamiento == null || comportamiento.codigo() != estado) {
            throw new IllegalStateException("RF-09: el caso no tiene cargado su estado de comportamiento.");
        }
        return comportamiento;
    }
}
