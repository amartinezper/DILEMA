package com.dilema.servicio;

import com.dilema.dto.Contratos;
import com.dilema.modelo.Catalogo;
import com.dilema.modelo.Usuario;
import com.dilema.repo.GrupoRepo;
import com.dilema.repo.UsuarioRepo;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AdminServicioTest {
    private UsuarioRepo usuarios;
    private FabricaCuentas fabrica;
    private PasswordEncoder cifrado;
    private Tokens tokens;
    private AdminServicio servicio;
    private Usuario admin;

    @BeforeEach
    void preparar() {
        usuarios = mock(UsuarioRepo.class);
        GrupoRepo grupos = mock(GrupoRepo.class);
        fabrica = mock(FabricaCuentas.class);
        cifrado = mock(PasswordEncoder.class);
        tokens = mock(Tokens.class);
        servicio = new AdminServicio(usuarios, grupos, new ProxyOperacion(), new Mapeador(), fabrica, cifrado, tokens);
        admin = new Usuario();
        admin.id = 1L;
        admin.nombre = "Admin";
        admin.email = "admin@psicosim.edu";
        admin.rol = Catalogo.Rol.ADMIN;
        admin.permisos = new java.util.HashSet<>();
    }

    @Test
    @DisplayName("el administrador crea un docente y rechaza crear un estudiante")
    void crearDocente() {
        when(usuarios.findByEmailIgnoreCase("docente@psicosim.edu")).thenReturn(Optional.empty());
        when(cifrado.encode("secreta")).thenReturn("hash");
        Usuario creado = new Usuario();
        creado.rol = Catalogo.Rol.PROFESOR;
        creado.permisos = new java.util.HashSet<>();
        when(fabrica.nuevoDocente()).thenReturn(creado);
        when(usuarios.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Contratos.UsuarioVista vista = servicio.crear(admin, new Contratos.UsuarioIn("Docente", "docente@psicosim.edu", "secreta", "DOCENTE"));
        assertEquals("DOCENTE".equals(vista.rol()) || "PROFESOR".equals(vista.rol()), true);
        assertEquals("docente@psicosim.edu", creado.email);
        assertEquals("hash", creado.contrasena);
        verify(usuarios).save(creado);

        assertThrows(ReglaNegocio.class, () -> servicio.crear(admin,
                new Contratos.UsuarioIn("Ana", "ana@psicosim.edu", "secreta", "ESTUDIANTE")));
    }

    @Test
    @DisplayName("solo administra permisos de un docente")
    void permisos() {
        Usuario docente = new Usuario();
        docente.id = 8L;
        docente.nombre = "Docente";
        docente.email = "d@psicosim.edu";
        docente.rol = Catalogo.Rol.PROFESOR;
        docente.permisos = new java.util.HashSet<>();
        when(usuarios.findById(8L)).thenReturn(Optional.of(docente));
        servicio.permiso(admin, 8L, List.of(FabricaCuentas.EDITAR));
        verify(fabrica).reemplazarPermisosDocente(docente, List.of(FabricaCuentas.EDITAR));

        docente.rol = Catalogo.Rol.ADMIN;
        assertThrows(ReglaNegocio.class, () -> servicio.permiso(admin, 8L, List.of()));
    }

    @Test
    @DisplayName("desactiva una cuenta y no permite desactivar la propia")
    void desactivaCuenta() {
        Usuario docente = new Usuario();
        docente.id = 8L;
        docente.nombre = "Docente";
        docente.email = "d@psicosim.edu";
        docente.rol = Catalogo.Rol.PROFESOR;
        docente.activo = true;
        docente.permisos = new java.util.HashSet<>();
        when(usuarios.findById(8L)).thenReturn(Optional.of(docente));
        when(usuarios.save(any())).thenAnswer(inv -> inv.getArgument(0));
        Contratos.UsuarioVista vista = servicio.activo(admin, 8L, false);
        assertEquals(false, vista.activo());
        assertThrows(ReglaNegocio.class, () -> servicio.activo(admin, 1L, false));
    }

    @Test
    @DisplayName("da de alta un estudiante sin contraseña y rechaza el correo repetido")
    void matriculaEstudiante() {
        when(usuarios.findByEmailIgnoreCase("ana@psicosim.edu")).thenReturn(Optional.empty());
        Usuario creado = estudiante(4L, true);
        when(fabrica.nuevoEstudiante("Ana Ruiz", "ana@psicosim.edu")).thenReturn(creado);

        Contratos.UsuarioVista vista = servicio.matricular(admin, "Ana Ruiz", "ana@psicosim.edu");
        assertEquals("ESTUDIANTE", vista.rol());
        assertEquals("ana@psicosim.edu", vista.email());
        verify(fabrica).nuevoEstudiante("Ana Ruiz", "ana@psicosim.edu");

        when(usuarios.findByEmailIgnoreCase("ana@psicosim.edu")).thenReturn(Optional.of(creado));
        assertEquals("Ya existe una cuenta con ese correo.",
                assertThrows(ReglaNegocio.class, () -> servicio.matricular(admin, "Ana Ruiz", "ana@psicosim.edu")).getMessage());
    }

    @Test
    @DisplayName("lista activos e inactivos y desactivar no saca al estudiante de la lista")
    void listaActivosEInactivos() {
        Usuario activo = estudiante(2L, true);
        Usuario inactivo = estudiante(3L, false);
        when(usuarios.findByRol(Catalogo.Rol.ESTUDIANTE)).thenReturn(List.of(activo, inactivo));
        assertEquals(2, servicio.estudiantes(admin).size());

        when(usuarios.findById(2L)).thenReturn(Optional.of(activo));
        when(usuarios.save(any())).thenAnswer(inv -> inv.getArgument(0));
        Contratos.UsuarioVista vista = servicio.activo(admin, 2L, false);
        assertEquals(false, vista.activo());
        assertEquals(false, activo.activo);
        assertEquals(2, servicio.estudiantes(admin).size());
    }

    @Test
    @DisplayName("corrige nombre y correo y conserva la clave si el campo viene vacío")
    void actualizaSinCambiarClave() {
        Usuario docente = cuenta(8L, Catalogo.Rol.PROFESOR, "d@psicosim.edu");
        docente.contrasena = "vieja";
        when(usuarios.findById(8L)).thenReturn(Optional.of(docente));
        when(usuarios.findByEmailIgnoreCase("nuevo@psicosim.edu")).thenReturn(Optional.empty());
        when(usuarios.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Contratos.UsuarioVista vista = servicio.actualizar(admin, 8L,
                new Contratos.DatosCuentaIn("Nombre Nuevo", "nuevo@psicosim.edu", "  "));

        assertEquals("Nombre Nuevo", vista.nombre());
        assertEquals("nuevo@psicosim.edu", docente.email);
        assertEquals("vieja", docente.contrasena);
        assertEquals(Catalogo.Rol.PROFESOR, docente.rol);
        verify(cifrado, never()).encode(any());
        verify(tokens, never()).revocarUsuario(any());
    }

    @Test
    @DisplayName("rechaza el correo que ya usa otra cuenta")
    void rechazaCorreoDeOtraCuenta() {
        Usuario docente = cuenta(8L, Catalogo.Rol.PROFESOR, "d@psicosim.edu");
        Usuario otra = cuenta(9L, Catalogo.Rol.PROFESOR, "otra@psicosim.edu");
        when(usuarios.findById(8L)).thenReturn(Optional.of(docente));
        when(usuarios.findByEmailIgnoreCase("otra@psicosim.edu")).thenReturn(Optional.of(otra));

        assertEquals("Ya existe una cuenta con ese correo.",
                assertThrows(ReglaNegocio.class, () -> servicio.actualizar(admin, 8L,
                        new Contratos.DatosCuentaIn("Docente", "otra@psicosim.edu", null))).getMessage());
    }

    @Test
    @DisplayName("cambia la clave del docente y revoca sus tokens")
    void cambiaClaveDelDocente() {
        Usuario docente = cuenta(8L, Catalogo.Rol.PROFESOR, "d@psicosim.edu");
        docente.contrasena = "vieja";
        when(usuarios.findById(8L)).thenReturn(Optional.of(docente));
        when(usuarios.findByEmailIgnoreCase("d@psicosim.edu")).thenReturn(Optional.of(docente));
        when(cifrado.encode("nueva1")).thenReturn("hash-nuevo");
        when(usuarios.save(any())).thenAnswer(inv -> inv.getArgument(0));

        servicio.actualizar(admin, 8L, new Contratos.DatosCuentaIn("Docente", "d@psicosim.edu", "nueva1"));

        assertEquals("hash-nuevo", docente.contrasena);
        verify(tokens).revocarUsuario(8L);
    }

    @Test
    @DisplayName("rechaza ponerle contraseña a un estudiante")
    void rechazaClaveEnEstudiante() {
        Usuario alumno = estudiante(4L, true);
        when(usuarios.findById(4L)).thenReturn(Optional.of(alumno));
        when(usuarios.findByEmailIgnoreCase("ana@psicosim.edu")).thenReturn(Optional.of(alumno));

        assertEquals("El estudiante entra sin contraseña.",
                assertThrows(ReglaNegocio.class, () -> servicio.actualizar(admin, 4L,
                        new Contratos.DatosCuentaIn("Ana", "ana@psicosim.edu", "secreta"))).getMessage());
    }

    private Usuario cuenta(long id, Catalogo.Rol rol, String email) {
        Usuario cuenta = new Usuario();
        cuenta.id = id;
        cuenta.nombre = "Docente";
        cuenta.email = email;
        cuenta.rol = rol;
        cuenta.permisos = new java.util.HashSet<>();
        return cuenta;
    }

    private Usuario estudiante(long id, boolean activo) {
        Usuario estudiante = new Usuario();
        estudiante.id = id;
        estudiante.nombre = "Ana";
        estudiante.email = "ana@psicosim.edu";
        estudiante.rol = Catalogo.Rol.ESTUDIANTE;
        estudiante.activo = activo;
        estudiante.permisos = new java.util.HashSet<>();
        return estudiante;
    }
}
