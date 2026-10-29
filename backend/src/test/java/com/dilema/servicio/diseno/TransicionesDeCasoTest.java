package com.dilema.servicio.diseno;

import com.dilema.modelo.Caso;
import com.dilema.modelo.Catalogo;
import com.dilema.servicio.ReglaNegocio;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Pruebas unitarias de RF-09. Recorren Borrador, Publicado y Archivado en memoria,
 * sin base de datos ni Spring. El doble de {@link UsoDelCaso} fija la validación
 * y la existencia de sesiones o participaciones.
 */
class TransicionesDeCasoTest {

    @Test
    @DisplayName("el borrador publica cuando la validación no devuelve errores")
    void borradorPublicaCuandoLaValidacionEstaLimpia() {
        UsoFijo uso = usoSinErrores();
        Caso caso = casoEn(Catalogo.EstadoCaso.BORRADOR, uso);

        caso.publicar();

        assertEquals(Catalogo.EstadoCaso.PUBLICADO, caso.estado);
        assertFalse(caso.permiteEdicion());
        assertEquals(1, uso.llamadasAValidar());
    }

    @Test
    @DisplayName("el borrador sigue en borrador si validar devuelve errores")
    void borradorConservaElEstadoCuandoLaValidacionFalla() {
        UsoFijo uso = usoConErrores("Falta la rúbrica.");
        Caso caso = casoEn(Catalogo.EstadoCaso.BORRADOR, uso);

        ReglaNegocio error = assertThrows(ReglaNegocio.class, caso::publicar);

        assertEquals(Catalogo.EstadoCaso.BORRADOR, caso.estado);
        assertTrue(caso.permiteEdicion());
        assertEquals("RF-09: no se puede publicar. Falta la rúbrica.", error.getMessage());
        assertEquals(1, uso.llamadasAValidar());
    }

    @Test
    @DisplayName("el borrador rechaza despublicar y archivar, y es el único que se edita")
    void borradorRechazaDespublicarYArchivar() {
        Caso caso = casoEn(Catalogo.EstadoCaso.BORRADOR, usoSinErrores());

        assertTrue(caso.permiteEdicion());
        ReglaNegocio despublicar = assertThrows(ReglaNegocio.class, caso::despublicar);
        ReglaNegocio archivar = assertThrows(ReglaNegocio.class, caso::archivar);

        assertEquals(Catalogo.EstadoCaso.BORRADOR, caso.estado);
        assertEquals("RF-09: un borrador no se despublica.", despublicar.getMessage());
        assertEquals("RF-09: un borrador no se archiva. Primero se publica.", archivar.getMessage());
    }

    @Test
    @DisplayName("el publicado rechaza publicar otra vez")
    void publicadoRechazaPublicarOtraVez() {
        UsoFijo uso = usoSinErrores();
        Caso caso = casoEn(Catalogo.EstadoCaso.PUBLICADO, uso);

        ReglaNegocio error = assertThrows(ReglaNegocio.class, caso::publicar);

        assertEquals(Catalogo.EstadoCaso.PUBLICADO, caso.estado);
        assertFalse(caso.permiteEdicion());
        assertEquals("RF-09: el caso ya está publicado.", error.getMessage());
        assertEquals(0, uso.llamadasAValidar());
    }

    @Test
    @DisplayName("el publicado archiva aunque tenga sesiones y participaciones")
    void publicadoArchivaAunqueTengaSesiones() {
        UsoFijo uso = new UsoFijo(List.of(), true, true);
        Caso caso = casoEn(Catalogo.EstadoCaso.PUBLICADO, uso);

        caso.archivar();

        assertEquals(Catalogo.EstadoCaso.ARCHIVADO, caso.estado);
        assertFalse(caso.permiteEdicion());
        assertEquals(0, uso.llamadasAValidar());
    }

    @Test
    @DisplayName("el publicado despublica a borrador cuando no hay sesiones ni participaciones")
    void publicadoDespublicaSinSesionesNiParticipaciones() {
        Caso caso = casoEn(Catalogo.EstadoCaso.PUBLICADO, usoSinErrores());

        caso.despublicar();

        assertEquals(Catalogo.EstadoCaso.BORRADOR, caso.estado);
        assertTrue(caso.permiteEdicion());
    }

    @ParameterizedTest(name = "sesiones={0}, participaciones={1}")
    @CsvSource({"true,false", "false,true", "true,true"})
    @DisplayName("el publicado no despublica si hay sesiones o participaciones")
    void publicadoConservaElEstadoSiHaySesionesOParticipaciones(boolean sesiones, boolean participaciones) {
        Caso caso = casoEn(Catalogo.EstadoCaso.PUBLICADO, new UsoFijo(List.of(), sesiones, participaciones));

        ReglaNegocio error = assertThrows(ReglaNegocio.class, caso::despublicar);

        assertEquals(Catalogo.EstadoCaso.PUBLICADO, caso.estado);
        assertEquals("RF-09: no se puede despublicar porque el caso tiene sesiones o participaciones.", error.getMessage());
    }

    @Test
    @DisplayName("el archivado publica cuando la validación no devuelve errores")
    void archivadoPublicaCuandoLaValidacionEstaLimpia() {
        UsoFijo uso = usoSinErrores();
        Caso caso = casoEn(Catalogo.EstadoCaso.ARCHIVADO, uso);

        caso.publicar();

        assertEquals(Catalogo.EstadoCaso.PUBLICADO, caso.estado);
        assertFalse(caso.permiteEdicion());
        assertEquals(1, uso.llamadasAValidar());
    }

    @Test
    @DisplayName("el archivado sigue archivado si validar devuelve errores")
    void archivadoConservaElEstadoCuandoLaValidacionFalla() {
        UsoFijo uso = usoConErrores("Falta la rúbrica.");
        Caso caso = casoEn(Catalogo.EstadoCaso.ARCHIVADO, uso);

        ReglaNegocio error = assertThrows(ReglaNegocio.class, caso::publicar);

        assertEquals(Catalogo.EstadoCaso.ARCHIVADO, caso.estado);
        assertFalse(caso.permiteEdicion());
        assertEquals("RF-09: no se puede publicar. Falta la rúbrica.", error.getMessage());
        assertEquals(1, uso.llamadasAValidar());
    }

    @Test
    @DisplayName("el archivado rechaza despublicar y archivar, y no se edita")
    void archivadoRechazaDespublicarYArchivar() {
        Caso caso = casoEn(Catalogo.EstadoCaso.ARCHIVADO, usoSinErrores());

        assertFalse(caso.permiteEdicion());
        ReglaNegocio despublicar = assertThrows(ReglaNegocio.class, caso::despublicar);
        ReglaNegocio archivar = assertThrows(ReglaNegocio.class, caso::archivar);

        assertEquals(Catalogo.EstadoCaso.ARCHIVADO, caso.estado);
        assertEquals("RF-09: un caso archivado no vuelve a borrador. Se publica de nuevo.", despublicar.getMessage());
        assertEquals("RF-09: el caso ya está archivado.", archivar.getMessage());
    }

    @Test
    @DisplayName("borrador y archivado consultan validar una sola vez y no cambian si hay errores")
    void borradorYArchivadoCompartenLaValidacionAntesDePublicar() {
        List<String> errores = List.of("Falta el nombre.", "Falta la rúbrica.");
        UsoFijo usoBorrador = new UsoFijo(errores, false, false);
        UsoFijo usoArchivado = new UsoFijo(errores, false, false);
        Caso borrador = casoEn(Catalogo.EstadoCaso.BORRADOR, usoBorrador);
        Caso archivado = casoEn(Catalogo.EstadoCaso.ARCHIVADO, usoArchivado);

        ReglaNegocio desdeBorrador = assertThrows(ReglaNegocio.class, borrador::publicar);
        ReglaNegocio desdeArchivado = assertThrows(ReglaNegocio.class, archivado::publicar);

        assertEquals(Catalogo.EstadoCaso.BORRADOR, borrador.estado);
        assertEquals(Catalogo.EstadoCaso.ARCHIVADO, archivado.estado);
        assertEquals(1, usoBorrador.llamadasAValidar());
        assertEquals(1, usoArchivado.llamadasAValidar());
        assertEquals("RF-09: no se puede publicar. Falta el nombre. Falta la rúbrica.", desdeBorrador.getMessage());
        assertEquals(desdeBorrador.getMessage(), desdeArchivado.getMessage());
    }

    private static Caso casoEn(Catalogo.EstadoCaso estado, UsoDelCaso uso) {
        Caso caso = new Caso();
        caso.estado = estado;
        caso.colocarEstado(EstadosDelCaso.de(estado, uso));
        return caso;
    }

    private static UsoFijo usoSinErrores() {
        return new UsoFijo(List.of(), false, false);
    }

    private static UsoFijo usoConErrores(String error) {
        return new UsoFijo(List.of(error), false, false);
    }

    /**
     * Sustituye la consulta real. Cada caso de prueba decide los errores de validar()
     * y si el caso ya tiene sesiones o participaciones.
     */
    private static final class UsoFijo implements UsoDelCaso {
        private final List<String> errores;
        private final boolean sesiones;
        private final boolean participaciones;
        private int llamadasAValidar;

        private UsoFijo(List<String> errores, boolean sesiones, boolean participaciones) {
            this.errores = new ArrayList<>(errores);
            this.sesiones = sesiones;
            this.participaciones = participaciones;
        }

        @Override
        public List<String> validar(Caso caso) {
            llamadasAValidar++;
            return List.copyOf(errores);
        }

        @Override
        public boolean tieneSesiones(Caso caso) {
            return sesiones;
        }

        @Override
        public boolean tieneParticipaciones(Caso caso) {
            return participaciones;
        }

        private int llamadasAValidar() {
            return llamadasAValidar;
        }
    }
}
