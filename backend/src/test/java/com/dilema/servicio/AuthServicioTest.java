package com.dilema.servicio;

import com.dilema.dto.Contratos;
import com.dilema.modelo.Caso;
import com.dilema.modelo.Catalogo;
import com.dilema.modelo.SesionCaso;
import com.dilema.modelo.Usuario;
import com.dilema.repo.ParticipacionRepo;
import com.dilema.repo.SesionEstudianteRepo;
import com.dilema.repo.SesionRepo;
import com.dilema.repo.UsuarioRepo;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Pruebas unitarias de RF-01. Eligen la estrategia de ingreso y la ejecutan en memoria,
 * sin base de datos ni Spring.
 * Un código, aunque el resto del pedido traiga clave, tiene que elegir al estudiante.
 * Una clave rechazada no modifica la cuenta. Un rechazo del estudiante no publica el caso ni inicia la sesión.
 */
class AuthServicioTest {
    private UsuarioRepo usuarios;
    private SesionRepo sesiones;
    private ParticipacionRepo participaciones;
    private SesionEstudianteRepo autorizados;
    private PasswordEncoder cifrado;
    private AuthServicio servicio;

    @BeforeEach
    void preparar() {
        usuarios = mock(UsuarioRepo.class);
        sesiones = mock(SesionRepo.class);
        participaciones = mock(ParticipacionRepo.class);
        autorizados = mock(SesionEstudianteRepo.class);
        cifrado = mock(PasswordEncoder.class);
        servicio = new AuthServicio(usuarios, sesiones, participaciones, autorizados, null, null, cifrado);
    }

    @Test
    @DisplayName("con código elige el ingreso del estudiante")
    void conCodigoEligeEstudiante() {
        Contratos.Ingreso pedido = new Contratos.Ingreso("estudiante@psicosim.edu", null, "DILEMA-2026", null);

        AuthServicio.Autenticacion elegida = servicio.new GestorAcceso().elegir(pedido);

        assertInstanceOf(AuthServicio.AutenticacionEstudiante.class, elegida);
    }

    @Test
    @DisplayName("sin código elige el ingreso con clave")
    void sinCodigoEligeClave() {
        Contratos.Ingreso pedido = new Contratos.Ingreso("docente@psicosim.edu", "docente123", "  ", "DOCENTE");

        AuthServicio.Autenticacion elegida = servicio.new GestorAcceso().elegir(pedido);

        assertInstanceOf(AuthServicio.AutenticacionCuenta.class, elegida);
    }

    @Test
    @DisplayName("el estudiante no entra con clave")
    void estudianteNoEntraConClave() {
        Contratos.Ingreso pedido = new Contratos.Ingreso("estudiante@psicosim.edu", "secreta", null, "ESTUDIANTE");

        ReglaNegocio error = assertThrows(ReglaNegocio.class, () -> cuenta().ingresar(pedido));

        assertEquals("El estudiante ingresa con el código de autorización de la convocatoria.", error.getMessage());
    }

    @Test
    @DisplayName("una clave incorrecta se rechaza y la cuenta no cambia")
    void claveIncorrectaSeRechaza() {
        Usuario docente = cuentaDocente();
        when(usuarios.findByEmailIgnoreCase("docente@psicosim.edu")).thenReturn(Optional.of(docente));
        when(cifrado.matches("mala", "hash")).thenReturn(false);
        Contratos.Ingreso pedido = new Contratos.Ingreso("docente@psicosim.edu", "mala", null, "DOCENTE");

        ReglaNegocio error = assertThrows(ReglaNegocio.class, () -> cuenta().ingresar(pedido));

        assertEquals("Correo o clave incorrectos.", error.getMessage());
        assertEquals("hash", docente.contrasena);
        assertEquals(Catalogo.Rol.PROFESOR, docente.rol);
    }

    @Test
    @DisplayName("docente y administrador entran con clave y sin sesión")
    void docenteEntraConClaveSinSesion() {
        Usuario docente = cuentaDocente();
        when(usuarios.findByEmailIgnoreCase("docente@psicosim.edu")).thenReturn(Optional.of(docente));
        when(cifrado.matches("docente123", "hash")).thenReturn(true);
        Contratos.Ingreso pedido = new Contratos.Ingreso("docente@psicosim.edu", "docente123", null, "DOCENTE");

        AuthServicio.Resultado resultado = cuenta().ingresar(pedido);

        assertSame(docente, resultado.usuario());
        assertNull(resultado.sesion());
    }

    @Test
    @DisplayName("el estudiante se rechaza si el caso no está publicado")
    void estudianteSeRechazaSiElCasoNoEstaPublicado() {
        Usuario estudiante = estudiante();
        SesionCaso sesion = sesion(Catalogo.EstadoCaso.BORRADOR, true);
        prepararEstudiante(estudiante, sesion, true);
        Contratos.Ingreso pedido = ingresoEstudiante();

        ReglaNegocio error = assertThrows(ReglaNegocio.class, () -> estudianteAuth().ingresar(pedido));

        assertEquals("El caso de esta convocatoria no está publicado.", error.getMessage());
        assertEquals(Catalogo.EstadoCaso.BORRADOR, sesion.caso.estado);
    }

    @Test
    @DisplayName("el estudiante se rechaza si no está convocado")
    void estudianteSeRechazaSiNoEstaConvocado() {
        Usuario estudiante = estudiante();
        SesionCaso sesion = sesion(Catalogo.EstadoCaso.PUBLICADO, true);
        prepararEstudiante(estudiante, sesion, false);
        Contratos.Ingreso pedido = ingresoEstudiante();

        ReglaNegocio error = assertThrows(ReglaNegocio.class, () -> estudianteAuth().ingresar(pedido));

        assertEquals("Este código pertenece a una convocatoria en la que no estás autorizado.", error.getMessage());
        assertNull(estudiante.contrasena);
    }

    @Test
    @DisplayName("el estudiante se rechaza si la sesión no ha iniciado")
    void estudianteSeRechazaSiLaSesionNoHaIniciado() {
        Usuario estudiante = estudiante();
        SesionCaso sesion = sesion(Catalogo.EstadoCaso.PUBLICADO, false);
        prepararEstudiante(estudiante, sesion, true);
        Contratos.Ingreso pedido = ingresoEstudiante();

        ReglaNegocio error = assertThrows(ReglaNegocio.class, () -> estudianteAuth().ingresar(pedido));

        assertEquals("La sesión todavía no ha sido iniciada por el docente.", error.getMessage());
        assertEquals(Catalogo.EstadoSesion.SIN_INICIAR, sesion.estado());
    }

    private AuthServicio.AutenticacionCuenta cuenta() {
        return servicio.new AutenticacionCuenta();
    }

    private AuthServicio.AutenticacionEstudiante estudianteAuth() {
        return servicio.new AutenticacionEstudiante();
    }

    private void prepararEstudiante(Usuario estudiante, SesionCaso sesion, boolean autorizado) {
        when(usuarios.findByEmailIgnoreCase("estudiante@psicosim.edu")).thenReturn(Optional.of(estudiante));
        when(sesiones.findByCodigoIgnoreCase("DILEMA-2026")).thenReturn(Optional.of(sesion));
        when(autorizados.existsBySesionIdAndEstudianteId(sesion.id, estudiante.id)).thenReturn(autorizado);
        when(participaciones.findByEstudianteIdAndSesionId(estudiante.id, sesion.id)).thenReturn(List.of());
    }

    private static Contratos.Ingreso ingresoEstudiante() {
        return new Contratos.Ingreso("estudiante@psicosim.edu", null, "DILEMA-2026", null);
    }

    private static Usuario cuentaDocente() {
        Usuario docente = new Usuario();
        docente.id = 2L;
        docente.email = "docente@psicosim.edu";
        docente.rol = Catalogo.Rol.PROFESOR;
        docente.activo = true;
        docente.contrasena = "hash";
        return docente;
    }

    private static Usuario estudiante() {
        Usuario estudiante = new Usuario();
        estudiante.id = 3L;
        estudiante.email = "estudiante@psicosim.edu";
        estudiante.rol = Catalogo.Rol.ESTUDIANTE;
        estudiante.activo = true;
        return estudiante;
    }

    private static SesionCaso sesion(Catalogo.EstadoCaso estadoCaso, boolean iniciada) {
        Caso caso = new Caso();
        caso.estado = estadoCaso;
        SesionCaso sesion = new SesionCaso();
        sesion.id = 7L;
        sesion.caso = caso;
        sesion.toleranciaMin = 30;
        if (iniciada) sesion.inicioReal = LocalDateTime.now();
        return sesion;
    }
}
