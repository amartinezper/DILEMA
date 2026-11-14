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

class CadenaAgendamientoTest {
    private final CadenaAgendamiento cadena = new CadenaAgendamiento();

    @Test
    @DisplayName("RF-18: acepta agenda con caso publicado, grupo del docente y tiempos válidos")
    void aceptaAgendaConCasoPublicadoGrupoYTiemposValidos() {
        assertDoesNotThrow(() -> cadena.validar(valido()));
    }

    @Test
    @DisplayName("INV-17: rechaza un caso que no está publicado")
    void rechazaCasoNoPublicado() {
        ContextoAgenda contexto = valido();
        contexto.caso().estado = Catalogo.EstadoCaso.BORRADOR;
        assertEquals("INV-17: el caso debe estar publicado para agendarlo.",
                assertThrows(ReglaNegocio.class, () -> cadena.validar(contexto)).getMessage());
    }

    @Test
    @DisplayName("RF-04: rechaza un grupo sin estudiantes autorizados")
    void rechazaGrupoSinEstudiantes() {
        ContextoAgenda contexto = valido();
        contexto.grupo().estudiantes.clear();
        assertEquals("RF-04: asocia al menos un estudiante autorizado.",
                assertThrows(ReglaNegocio.class, () -> cadena.validar(contexto)).getMessage());
    }

    @Test
    @DisplayName("RF-18: rechaza tiempo máximo mayor al estimado del caso")
    void rechazaTiempoMaximoMayorAlEstimado() {
        ContextoAgenda contexto = new ContextoAgenda(valido().docente(), valido().caso(), valido().grupo(),
                valido().inicio(), valido().fin(), 90, 10);
        contexto.caso().tiempoEstimadoMin = 45;
        assertEquals("RF-18: el tiempo máximo no puede superar el estimado del caso.",
                assertThrows(ReglaNegocio.class, () -> cadena.validar(contexto)).getMessage());
    }

    @Test
    @DisplayName("INV-18: rechaza fin anterior al inicio")
    void rechazaFinAnteriorAlInicio() {
        ContextoAgenda fechas = new ContextoAgenda(valido().docente(), valido().caso(), valido().grupo(),
                LocalDateTime.of(2026, 6, 2, 10, 0), LocalDateTime.of(2026, 6, 2, 9, 0), 30, 5);
        assertEquals("INV-18: el fin debe ser posterior al inicio.",
                assertThrows(ReglaNegocio.class, () -> cadena.validar(fechas)).getMessage());
    }

    @Test
    @DisplayName("INV-18: rechaza tolerancia negativa")
    void rechazaToleranciaNegativa() {
        ContextoAgenda tolerancia = new ContextoAgenda(valido().docente(), valido().caso(), valido().grupo(),
                valido().inicio(), valido().fin(), 30, -1);
        assertEquals("INV-18: la tolerancia no puede ser negativa.",
                assertThrows(ReglaNegocio.class, () -> cadena.validar(tolerancia)).getMessage());
    }

    private ContextoAgenda valido() {
        Usuario docente = new Usuario();
        docente.id = 1L;
        docente.rol = Catalogo.Rol.PROFESOR;
        Usuario estudiante = new Usuario();
        estudiante.id = 2L;
        estudiante.rol = Catalogo.Rol.ESTUDIANTE;
        Caso caso = new Caso();
        caso.estado = Catalogo.EstadoCaso.PUBLICADO;
        caso.tiempoEstimadoMin = 45;
        Grupo grupo = new Grupo();
        grupo.docente = docente;
        grupo.estudiantes.add(estudiante);
        return new ContextoAgenda(docente, caso, grupo,
                LocalDateTime.of(2026, 6, 2, 8, 0), LocalDateTime.of(2026, 6, 2, 10, 0), 30, 10);
    }
}
