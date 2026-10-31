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
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AdminServicioTest {
    private UsuarioRepo usuarios;
    private FabricaCuentas fabrica;
    private PasswordEncoder cifrado;
    private AdminServicio servicio;
    private Usuario admin;

    @BeforeEach
    void preparar() {
        usuarios = mock(UsuarioRepo.class);
        GrupoRepo grupos = mock(GrupoRepo.class);
        fabrica = mock(FabricaCuentas.class);
        cifrado = mock(PasswordEncoder.class);
        servicio = new AdminServicio(usuarios, grupos, new ProxyOperacion(), new Mapeador(), fabrica, cifrado);
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
}
