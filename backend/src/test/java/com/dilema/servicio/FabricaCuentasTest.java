package com.dilema.servicio;

import com.dilema.modelo.Catalogo;
import com.dilema.modelo.Permiso;
import com.dilema.modelo.Usuario;
import com.dilema.repo.PermisoRepo;
import com.dilema.repo.UsuarioRepo;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Pruebas unitarias de RF-03. Recorren el alta de cada rol en memoria,
 * sin base de datos ni Spring. El doble del catálogo devuelve el permiso pedido.
 * El docente no puede nacer con Editar: si la fábrica se lo diera, la primera prueba fallaría.
 * Un permiso distinto de Editar o de gestionar espacios no se conserva al reemplazar.
 */
class FabricaCuentasTest {
    private PermisoRepo permisos;
    private UsuarioRepo usuarios;
    private FabricaCuentas fabrica;

    @BeforeEach
    void preparar() {
        permisos = mock(PermisoRepo.class);
        usuarios = mock(UsuarioRepo.class);
        when(permisos.findByTipo(anyString())).thenAnswer(invocacion -> {
            Permiso permiso = new Permiso();
            permiso.tipo = invocacion.getArgument(0);
            return Optional.of(permiso);
        });
        when(usuarios.save(any(Usuario.class))).thenAnswer(invocacion -> invocacion.getArgument(0));
        fabrica = new FabricaCuentas(permisos, usuarios);
    }

    @Test
    @DisplayName("el docente nace solo con Visualizar y sin clave")
    void docenteNaceSoloConVisualizar() {
        Usuario docente = fabrica.nuevoDocente();

        assertEquals(Catalogo.Rol.PROFESOR, docente.rol);
        assertTrue(docente.activo);
        assertNull(docente.contrasena);
        assertEquals(1, docente.permisos.size());
        assertTrue(docente.tiene(FabricaCuentas.VISUALIZAR));
        verify(usuarios, never()).save(any());
    }

    @Test
    @DisplayName("el administrador nace con gestionar espacios académicos")
    void administradorNaceConGestionarEspacios() {
        Usuario admin = fabrica.nuevoAdministrador();

        assertEquals(Catalogo.Rol.ADMIN, admin.rol);
        assertNull(admin.contrasena);
        assertEquals(1, admin.permisos.size());
        assertTrue(admin.tiene(FabricaCuentas.GESTIONAR_ESPACIOS));
    }

    @Test
    @DisplayName("el estudiante nace sin clave, sin permisos y con el correo en minúsculas")
    void estudianteNaceSinClaveNiPermisos() {
        Usuario estudiante = fabrica.nuevoEstudiante("  Ana Ruiz  ", "Ana@Psicosim.edu");

        assertEquals(Catalogo.Rol.ESTUDIANTE, estudiante.rol);
        assertEquals("Ana Ruiz", estudiante.nombre);
        assertEquals("ana@psicosim.edu", estudiante.email);
        assertNull(estudiante.contrasena);
        assertTrue(estudiante.permisos.isEmpty());
        verify(usuarios).save(estudiante);
    }

    @Test
    @DisplayName("al reemplazar permisos el docente conserva Visualizar y solo suma Editar o gestionar")
    void reemplazarConservaVisualizarYSoloAceptaDosExtras() {
        Usuario docente = fabrica.nuevoDocente();

        fabrica.reemplazarPermisosDocente(docente, List.of(FabricaCuentas.EDITAR, "OTRO"));

        assertEquals(2, docente.permisos.size());
        assertTrue(docente.tiene(FabricaCuentas.VISUALIZAR));
        assertTrue(docente.tiene(FabricaCuentas.EDITAR));
        verify(usuarios).save(docente);
    }

    @Test
    @DisplayName("otorgar si vacío no toca una cuenta que ya tiene permisos")
    void otorgarSiVacioNoPisaPermisosExistentes() {
        Usuario docente = fabrica.nuevoDocente();

        fabrica.otorgarSiVacio(docente);

        assertEquals(1, docente.permisos.size());
        assertTrue(docente.tiene(FabricaCuentas.VISUALIZAR));
        verify(usuarios, never()).save(docente);
    }
}
