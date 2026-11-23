package com.dilema.servicio;

import com.dilema.modelo.Caso;
import com.dilema.modelo.Catalogo;
import com.dilema.modelo.Usuario;
import com.dilema.repo.CasoRepo;
import com.dilema.repo.SesionEstudianteRepo;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * PRUEBA DE: portada del caso guardada como archivo en DILEMA_PORTADAS_DIR (sin base de datos).
 * PATRÓN: servicio con archivos en una carpeta temporal; repositorios y permisos simulados.
 * REQUISITO: portada del caso en la tarjeta "Dilema Destacado" del estudiante.
 * COMANDO: mvn -f backend/pom.xml test -Dtest=PortadaServicioTest
 */
class PortadaServicioTest {
    @TempDir
    Path carpeta;
    private final CasoRepo casos = mock(CasoRepo.class);
    private final SesionEstudianteRepo convocados = mock(SesionEstudianteRepo.class);
    private final Usuario docente = usuario(2L, Catalogo.Rol.PROFESOR);
    private PortadaServicio servicio;

    @BeforeEach
    void preparar() {
        servicio = new PortadaServicio(carpeta.toString(), casos, convocados, mock(ProxyOperacion.class));
        Caso caso = new Caso();
        caso.id = 7L;
        caso.docente = docente;
        when(casos.findById(7L)).thenReturn(Optional.of(caso));
    }

    @Test
    @DisplayName("el dueño sube una WebP y al reemplazarla por JPEG queda un solo archivo")
    void guardaYReemplaza() throws Exception {
        // Qué prueba: guardar, reemplazar con otro formato y leer.
        // Esperado: portada-7.jpg reemplaza a portada-7.webp y se lee como image/jpeg.
        // ACT
        servicio.guardar(docente, 7L, webp());
        assertTrue(Files.exists(carpeta.resolve("portada-7.webp")));
        servicio.guardar(docente, 7L, jpeg());

        // ASSERT
        assertFalse(Files.exists(carpeta.resolve("portada-7.webp")));
        PortadaServicio.Portada portada = servicio.leer(docente, 7L).orElseThrow();
        assertEquals("image/jpeg", portada.tipo());
        assertArrayEquals(jpeg(), portada.datos());
    }

    @Test
    @DisplayName("rechaza a otro docente, un archivo que no es imagen y uno de más de 400 KB")
    void rechazaInvalidos() {
        // Qué prueba: dueño, formato por los primeros bytes y tamaño máximo.
        // Esperado: AccesoDenegado y ReglaNegocio; no se crea ningún archivo.
        byte[] grande = Arrays.copyOf(webp(), PortadaServicio.MAXIMO_BYTES + 1);

        assertThrows(AccesoDenegado.class, () -> servicio.guardar(usuario(9L, Catalogo.Rol.PROFESOR), 7L, webp()));
        assertThrows(ReglaNegocio.class, () -> servicio.guardar(docente, 7L, "<svg/>".getBytes(StandardCharsets.UTF_8)));
        assertThrows(ReglaNegocio.class, () -> servicio.guardar(docente, 7L, grande));
        assertFalse(Files.exists(carpeta.resolve("portada-7.webp")));
    }

    @Test
    @DisplayName("la ve el estudiante convocado; el no convocado no; sin portada devuelve vacío")
    void permisosDeLectura() {
        // Qué prueba: quién puede ver la portada.
        // Esperado: convocado ve vacío (aún no hay foto) y luego la foto; no convocado recibe AccesoDenegado.
        Usuario convocado = usuario(3L, Catalogo.Rol.ESTUDIANTE);
        when(convocados.estaConvocadoAlCaso(7L, 3L)).thenReturn(true);

        assertTrue(servicio.leer(convocado, 7L).isEmpty());
        servicio.guardar(docente, 7L, webp());
        assertEquals("image/webp", servicio.leer(convocado, 7L).orElseThrow().tipo());
        assertThrows(AccesoDenegado.class, () -> servicio.leer(usuario(4L, Catalogo.Rol.ESTUDIANTE), 7L));
    }

    @Test
    @DisplayName("quitar borra la portada y duplicar la copia al caso nuevo")
    void quitarYCopiar() {
        // Qué prueba: quitar() y copiar() al duplicar.
        // Esperado: la copia tiene el mismo archivo; tras quitar, el original ya no tiene portada.
        servicio.guardar(docente, 7L, webp());

        servicio.copiar(7L, 8L);
        servicio.quitar(docente, 7L);

        assertTrue(Files.exists(carpeta.resolve("portada-8.webp")));
        assertTrue(servicio.leer(docente, 7L).isEmpty());
    }

    private static byte[] webp() {
        byte[] datos = new byte[64];
        System.arraycopy("RIFF".getBytes(StandardCharsets.US_ASCII), 0, datos, 0, 4);
        System.arraycopy("WEBP".getBytes(StandardCharsets.US_ASCII), 0, datos, 8, 4);
        return datos;
    }

    private static byte[] jpeg() {
        byte[] datos = new byte[64];
        datos[0] = (byte) 0xFF;
        datos[1] = (byte) 0xD8;
        datos[2] = (byte) 0xFF;
        return datos;
    }

    private static Usuario usuario(Long id, Catalogo.Rol rol) {
        Usuario usuario = new Usuario();
        usuario.id = id;
        usuario.rol = rol;
        return usuario;
    }
}
