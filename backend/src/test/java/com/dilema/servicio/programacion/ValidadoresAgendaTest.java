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
    @DisplayName("cada paso de RF-18 rechaza su propia regla")
    void cadaValidador() {
        ContextoAgenda ok = valido();
        assertDoesNotThrow(() -> new ValidadorCasoPublicado().validar(ok));
        assertEquals("INV-17: el caso debe estar publicado para agendarlo.",
                assertThrows(ReglaNegocio.class, () -> new ValidadorCasoPublicado().validar(conCaso(Catalogo.EstadoCaso.ARCHIVADO))).getMessage());

        Usuario otro = new Usuario();
        otro.id = 99L;
        ContextoAgenda ajeno = new ContextoAgenda(otro, ok.caso(), ok.grupo(), ok.inicio(), ok.fin(), 30, 5);
        assertEquals("INV-17: el grupo debe estar a cargo del docente.",
                assertThrows(ReglaNegocio.class, () -> new ValidadorGrupoDelProfesor().validar(ajeno)).getMessage());

        assertEquals("INV-18: el tiempo máximo debe ser mayor que cero.",
                assertThrows(ReglaNegocio.class, () -> new ValidadorTiempoMaximo().validar(
                        new ContextoAgenda(ok.docente(), ok.caso(), ok.grupo(), ok.inicio(), ok.fin(), 0, 5))).getMessage());
        assertDoesNotThrow(() -> new ValidadorTolerancia().validar(ok));
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
