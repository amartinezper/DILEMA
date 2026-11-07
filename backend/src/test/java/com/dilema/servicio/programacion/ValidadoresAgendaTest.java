package com.dilema.servicio.programacion;

import com.dilema.modelo.Caso;
import com.dilema.modelo.Catalogo;
import com.dilema.modelo.Grupo;
import com.dilema.modelo.Usuario;
import com.dilema.servicio.ReglaNegocio;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ValidadoresAgendaTest {

    @Test
    @DisplayName("INV-17: el validador acepta un caso publicado")
    void aceptaCasoPublicado() {
        assertDoesNotThrow(() -> new ValidadorCasoPublicado().validar(valido()));
    }

    @Test
    @DisplayName("INV-17: el validador rechaza un caso archivado")
    void rechazaCasoArchivado() {
        assertEquals("INV-17: el caso debe estar publicado para agendarlo.",
                assertThrows(ReglaNegocio.class, () -> new ValidadorCasoPublicado().validar(conCaso(Catalogo.EstadoCaso.ARCHIVADO))).getMessage());
    }

    @Test
    @DisplayName("INV-17: el validador rechaza un grupo que no es del docente")
    void rechazaGrupoDeOtroDocente() {
        Usuario otro = new Usuario();
        otro.id = 99L;
        ContextoAgenda ok = valido();
        ContextoAgenda ajeno = new ContextoAgenda(otro, ok.caso(), ok.grupo(), ok.inicio(), ok.fin(), 30, 5);
        assertEquals("INV-17: el grupo debe estar a cargo del docente.",
                assertThrows(ReglaNegocio.class, () -> new ValidadorGrupoDelProfesor().validar(ajeno)).getMessage());
    }

    @Test
    @DisplayName("INV-18: el validador rechaza tiempo máximo igual a cero")
    void rechazaTiempoMaximoCero() {
        ContextoAgenda ok = valido();
        assertEquals("INV-18: el tiempo máximo debe ser mayor que cero.",
                assertThrows(ReglaNegocio.class, () -> new ValidadorTiempoMaximo().validar(
                        new ContextoAgenda(ok.docente(), ok.caso(), ok.grupo(), ok.inicio(), ok.fin(), 0, 5))).getMessage());
    }

    @Test
    @DisplayName("INV-18: el validador acepta tolerancia no negativa")
    void aceptaToleranciaNoNegativa() {
        assertDoesNotThrow(() -> new ValidadorTolerancia().validar(valido()));
    }

    private ContextoAgenda conCaso(Catalogo.EstadoCaso estado) {
        ContextoAgenda base = valido();
        base.caso().estado = estado;
        return base;
    }

    private ContextoAgenda valido() {
        Usuario docente = new Usuario();
        docente.id = 1L;
        Usuario estudiante = new Usuario();
        estudiante.id = 2L;
        Caso caso = new Caso();
        caso.estado = Catalogo.EstadoCaso.PUBLICADO;
        caso.tiempoEstimadoMin = 40;
        Grupo grupo = new Grupo();
        grupo.docente = docente;
        grupo.estudiantes.add(estudiante);
        return new ContextoAgenda(docente, caso, grupo,
                LocalDateTime.of(2026, 6, 2, 8, 0), LocalDateTime.of(2026, 6, 2, 10, 0), 30, 5);
    }
}
