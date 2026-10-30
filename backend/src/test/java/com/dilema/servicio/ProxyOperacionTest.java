package com.dilema.servicio;

import com.dilema.modelo.Catalogo;
import com.dilema.modelo.Permiso;
import com.dilema.modelo.Usuario;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * Pruebas unitarias de RF-02. Recorren la puerta de autorización en memoria,
 * sin base de datos ni Spring.
 * Si el rol no corresponde, el mensaje es de operación y la cuenta no cambia de rol.
 * Si el rol corresponde y falta el permiso, el mensaje es de permiso.
 */
class ProxyOperacionTest {
    private final ProxyOperacion proxy = new ProxyOperacion();

    @Test
    @DisplayName("el docente que solo visualiza revisa el grupo y no crea un caso ni un espacio")
    void docenteConSoloVisualizarRevisaYNoCrea() {
        Usuario docente = usuario(Catalogo.Rol.PROFESOR, FabricaCuentas.VISUALIZAR);

        proxy.revisarGrupo(docente);
        AccesoDenegado caso = assertThrows(AccesoDenegado.class, () -> proxy.crearCaso(docente));
        AccesoDenegado espacio = assertThrows(AccesoDenegado.class, () -> proxy.gestionarEspacio(docente));

        assertEquals("No tienes el permiso requerido.", caso.getMessage());
        assertEquals("No tienes el permiso requerido.", espacio.getMessage());
        assertEquals(Catalogo.Rol.PROFESOR, docente.rol);
    }

    @Test
    @DisplayName("el docente con Editar crea el caso")
    void docenteConEditarCreaElCaso() {
        Usuario docente = usuario(Catalogo.Rol.PROFESOR, FabricaCuentas.VISUALIZAR, FabricaCuentas.EDITAR);

        proxy.crearCaso(docente);

        assertEquals(Catalogo.Rol.PROFESOR, docente.rol);
    }

    @Test
    @DisplayName("el docente con gestionar espacios crea el grupo")
    void docenteConGestionarEspaciosCreaElGrupo() {
        Usuario docente = usuario(Catalogo.Rol.PROFESOR, FabricaCuentas.VISUALIZAR, FabricaCuentas.GESTIONAR_ESPACIOS);

        proxy.gestionarEspacio(docente);

        assertEquals(Catalogo.Rol.PROFESOR, docente.rol);
    }

    @Test
    @DisplayName("el administrador gestiona usuarios y no crea un caso")
    void administradorGestionaUsuariosYNoCreaCaso() {
        Usuario admin = usuario(Catalogo.Rol.ADMIN, FabricaCuentas.GESTIONAR_ESPACIOS);

        proxy.gestionarUsuarios(admin);
        AccesoDenegado error = assertThrows(AccesoDenegado.class, () -> proxy.crearCaso(admin));

        assertEquals("No tienes permiso para esta operación.", error.getMessage());
        assertEquals(Catalogo.Rol.ADMIN, admin.rol);
    }

    @Test
    @DisplayName("el estudiante participa y no crea un caso")
    void estudianteParticipaYNoCreaCaso() {
        Usuario estudiante = usuario(Catalogo.Rol.ESTUDIANTE);

        proxy.participar(estudiante);
        AccesoDenegado error = assertThrows(AccesoDenegado.class, () -> proxy.crearCaso(estudiante));

        assertEquals("No tienes permiso para esta operación.", error.getMessage());
        assertEquals(Catalogo.Rol.ESTUDIANTE, estudiante.rol);
    }

    @Test
    @DisplayName("sin usuario la puerta rechaza la operación")
    void sinUsuarioRechaza() {
        AccesoDenegado error = assertThrows(AccesoDenegado.class, () -> proxy.crearCaso(null));

        assertEquals("No tienes permiso para esta operación.", error.getMessage());
    }

    private static Usuario usuario(Catalogo.Rol rol, String... permisos) {
        Usuario usuario = new Usuario();
        usuario.rol = rol;
        for (String tipo : permisos) {
            Permiso permiso = new Permiso();
            permiso.tipo = tipo;
            usuario.permisos.add(permiso);
        }
        return usuario;
    }
}
