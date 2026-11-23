package com.dilema.servicio;

import com.dilema.modelo.Caso;
import com.dilema.modelo.Catalogo;
import com.dilema.modelo.Usuario;
import com.dilema.repo.CasoRepo;
import com.dilema.repo.SesionEstudianteRepo;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Optional;

/**
 * Foto de portada del caso. Se guarda como archivo (portada-&lt;id&gt;.webp o .jpg) en DILEMA_PORTADAS_DIR,
 * que en Railway es un volumen: no toca la base de datos. El navegador la deja en 1200 x 675 y ~300 KB;
 * aquí solo se acepta WebP o JPEG de hasta 400 KB.
 */
@Service
public class PortadaServicio {
    public static final int MAXIMO_BYTES = 400 * 1024;
    private static final Logger log = LoggerFactory.getLogger(PortadaServicio.class);
    private static final String[] EXTENSIONES = {"webp", "jpg"};

    private final Path carpeta;
    private final CasoRepo casos;
    private final SesionEstudianteRepo convocados;
    private final ProxyOperacion proxy;

    public PortadaServicio(@Value("${dilema.portadas.dir}") String carpeta, CasoRepo casos,
                           SesionEstudianteRepo convocados, ProxyOperacion proxy) {
        this.carpeta = Path.of(carpeta).toAbsolutePath().normalize();
        this.casos = casos;
        this.convocados = convocados;
        this.proxy = proxy;
    }

    public record Portada(byte[] datos, String tipo, long version) {}

    /** Sube o reemplaza la portada. Solo el docente dueño; se permite aunque el caso esté publicado. */
    public long guardar(Usuario docente, Long casoId, byte[] datos) {
        proxy.crearCaso(docente);
        propio(docente, casoId);
        if (datos == null || datos.length == 0) throw new ReglaNegocio("Elige una imagen para la portada.");
        if (datos.length > MAXIMO_BYTES) throw new ReglaNegocio("La portada no puede pasar de 400 KB.");
        String extension = extensionDe(datos);
        if (extension == null) throw new ReglaNegocio("La portada debe ser una imagen WebP o JPEG.");
        try {
            Files.createDirectories(carpeta);
            Path destino = archivo(casoId, extension);
            Path temporal = Files.createTempFile(carpeta, "portada-" + casoId + "-", ".tmp");
            Files.write(temporal, datos);
            try {
                Files.move(temporal, destino, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
            } catch (AtomicMoveNotSupportedException sinAtomico) {
                Files.move(temporal, destino, StandardCopyOption.REPLACE_EXISTING);
            }
            for (String otra : EXTENSIONES) {
                if (!otra.equals(extension)) Files.deleteIfExists(archivo(casoId, otra));
            }
            return Files.getLastModifiedTime(destino).toMillis();
        } catch (IOException error) {
            log.warn("No se pudo guardar la portada del caso {}: {}", casoId, error.getMessage());
            throw new UncheckedIOException("No se pudo guardar la portada.", error);
        }
    }

    /** Quita la portada; el estudiante vuelve a ver la escena automática. */
    public void quitar(Usuario docente, Long casoId) {
        proxy.crearCaso(docente);
        propio(docente, casoId);
        try {
            for (String extension : EXTENSIONES) Files.deleteIfExists(archivo(casoId, extension));
        } catch (IOException error) {
            throw new UncheckedIOException("No se pudo quitar la portada.", error);
        }
    }

    /**
     * Portada para mostrar. La ven el docente dueño, la administración y los estudiantes convocados
     * a alguna sesión del caso. Vacío si el caso no tiene portada.
     */
    public Optional<Portada> leer(Usuario usuario, Long casoId) {
        Caso caso = casos.findById(casoId).orElseThrow(() -> new NoEncontrado("Caso no encontrado."));
        boolean puede = switch (usuario.rol) {
            case ADMIN -> true;
            case PROFESOR -> caso.docente != null && caso.docente.id.equals(usuario.id);
            case ESTUDIANTE -> convocados.estaConvocadoAlCaso(casoId, usuario.id);
        };
        if (!puede) throw new AccesoDenegado("No tienes acceso a este caso.");
        try {
            for (String extension : EXTENSIONES) {
                Path ruta = archivo(casoId, extension);
                if (Files.isRegularFile(ruta)) {
                    return Optional.of(new Portada(Files.readAllBytes(ruta), "webp".equals(extension) ? "image/webp" : "image/jpeg",
                            Files.getLastModifiedTime(ruta).toMillis()));
                }
            }
            return Optional.empty();
        } catch (IOException error) {
            log.warn("No se pudo leer la portada del caso {}: {}", casoId, error.getMessage());
            return Optional.empty();
        }
    }

    /** Al duplicar un caso, la copia conserva la portada del original. Un fallo no impide duplicar. */
    public void copiar(Long origenId, Long copiaId) {
        try {
            for (String extension : EXTENSIONES) {
                Path origen = archivo(origenId, extension);
                if (Files.isRegularFile(origen)) {
                    Files.copy(origen, archivo(copiaId, extension), StandardCopyOption.REPLACE_EXISTING);
                    return;
                }
            }
        } catch (IOException error) {
            log.warn("No se pudo copiar la portada del caso {} al {}: {}", origenId, copiaId, error.getMessage());
        }
    }

    private void propio(Usuario docente, Long casoId) {
        Caso caso = casos.findById(casoId).orElseThrow(() -> new NoEncontrado("Caso no encontrado."));
        if (caso.docente == null || !caso.docente.id.equals(docente.id)) {
            throw new AccesoDenegado("Este caso pertenece a otro docente.");
        }
    }

    private Path archivo(Long casoId, String extension) {
        return carpeta.resolve("portada-" + casoId + "." + extension);
    }

    /** WebP: "RIFF" .... "WEBP". JPEG: FF D8 FF. Cualquier otra cosa se rechaza. */
    static String extensionDe(byte[] datos) {
        if (datos.length >= 12
                && "RIFF".equals(new String(datos, 0, 4, StandardCharsets.US_ASCII))
                && "WEBP".equals(new String(datos, 8, 4, StandardCharsets.US_ASCII))) return "webp";
        if (datos.length >= 3 && (datos[0] & 0xFF) == 0xFF && (datos[1] & 0xFF) == 0xD8 && (datos[2] & 0xFF) == 0xFF) return "jpg";
        return null;
    }
}
