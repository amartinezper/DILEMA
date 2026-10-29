package com.dilema.modelo;

/**
 * State (RF-09). Contrato único de Borrador, Publicado y Archivado.
 * Caso no pregunta el enum para decidir: le pide la operación a este objeto
 * y el objeto aplica su propia regla o la rechaza.
 */
public interface EstadoDelCaso {
    void publicar(Caso caso);

    void despublicar(Caso caso);

    void archivar(Caso caso);

    /** Verdadero solo en borrador. El resto del sistema no edita el caso si esto es falso. */
    boolean permiteEdicion();

    /**
     * Valor que se guarda en {@code caso.estado}. Lo declara el propio objeto
     * para que el enum y el comportamiento no se asignen por separado.
     */
    Catalogo.EstadoCaso codigo();
}
