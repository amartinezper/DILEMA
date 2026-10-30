package com.dilema.servicio.diseno;

import com.dilema.dto.Contratos;
import com.dilema.modelo.Caso;
import com.dilema.modelo.Catalogo;
import com.dilema.modelo.Escenario;
import com.dilema.modelo.Usuario;
import com.dilema.servicio.ReglaNegocio;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Pruebas unitarias de RF-05. Construyen y copian el caso en memoria,
 * sin base de datos ni Spring.
 * El borrador se acepta con solo el nombre. La copia no arrastra el estado publicado del origen
 * ni comparte sus escenarios: si los compartiera, editar la copia cambiaría el caso original.
 */
class DirectorCasoTest {
    private final DirectorCaso director = new DirectorCaso();

    @Test
    @DisplayName("un borrador con solo el nombre se guarda incompleto")
    void borradorConSoloElNombreSeGuarda() {
        Caso caso = director.construirNuevo(docente(), entrada("Encuadre", null, null, null));

        assertEquals("Encuadre", caso.nombre);
        assertEquals(Catalogo.EstadoCaso.BORRADOR, caso.estado);
        assertTrue(caso.escenarios.isEmpty());
        assertEquals(1, caso.tiempoEstimadoMin);
    }

    @Test
    @DisplayName("sin nombre el borrador se rechaza")
    void sinNombreSeRechaza() {
        ReglaNegocio error = assertThrows(ReglaNegocio.class,
                () -> director.construirNuevo(docente(), entrada("  ", null, null, null)));

        assertEquals("El borrador necesita al menos un nombre.", error.getMessage());
    }

    @Test
    @DisplayName("la copia nace en borrador, se llama copia y no comparte el caso de origen")
    void copiaNaceEnBorradorSinCompartirElOrigen() {
        Caso origen = director.construirNuevo(docente(), entrada("Encuadre", "Desarrollo", "Contexto", 30));
        origen.estado = Catalogo.EstadoCaso.PUBLICADO;
        Escenario escenario = new Escenario();
        escenario.titulo = "Sala";
        escenario.contexto = "El grupo llega.";
        escenario.orden = 0;
        origen.escenarios.add(escenario);

        Caso copia = director.duplicar(docente(), origen);

        assertEquals(Catalogo.EstadoCaso.BORRADOR, copia.estado);
        assertEquals("Encuadre (copia)", copia.nombre);
        assertNotSame(origen, copia);
        assertNotSame(escenario, copia.escenarios.get(0));
        assertEquals(Catalogo.EstadoCaso.PUBLICADO, origen.estado);
        assertEquals("Encuadre", origen.nombre);
    }

    private static Usuario docente() {
        Usuario docente = new Usuario();
        docente.id = 2L;
        return docente;
    }

    private static Contratos.CasoIn entrada(String nombre, String desarrollo, String contexto, Integer tiempo) {
        return new Contratos.CasoIn(nombre, desarrollo, contexto, tiempo, false, "", null, null, null, null);
    }
}
