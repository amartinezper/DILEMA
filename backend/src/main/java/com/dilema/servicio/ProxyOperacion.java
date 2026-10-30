package com.dilema.servicio;

import com.dilema.modelo.Catalogo;
import com.dilema.modelo.Usuario;
import org.springframework.stereotype.Component;

/**
 * Proxy de protección (RF-02). La autorización vive en esta puerta, antes de tocar el caso o el grupo.
 * Crear un caso exige docente con Editar. Revisar el grupo exige Visualizar.
 * Gestionar un espacio exige Gestionar espacios académicos. Administrar usuarios exige el rol de administración.
 * Participar exige el rol de estudiante. Si falta el rol, el mensaje es de operación.
 * Si el rol está y falta el permiso, el mensaje es de permiso.
 */
@Component
public class ProxyOperacion {
    public void crearCaso(Usuario usuario) {
        exigirRol(usuario, Catalogo.Rol.PROFESOR);
        exigir(usuario, FabricaCuentas.EDITAR);
    }

    public void revisarGrupo(Usuario usuario) {
        exigirRol(usuario, Catalogo.Rol.PROFESOR);
        exigir(usuario, FabricaCuentas.VISUALIZAR);
    }

    public void gestionarEspacio(Usuario usuario) {
        exigirRol(usuario, Catalogo.Rol.PROFESOR);
        exigir(usuario, FabricaCuentas.GESTIONAR_ESPACIOS);
    }

    public void gestionarUsuarios(Usuario usuario) {
        exigirRol(usuario, Catalogo.Rol.ADMIN);
    }

    public void participar(Usuario usuario) {
        exigirRol(usuario, Catalogo.Rol.ESTUDIANTE);
    }

    private void exigirRol(Usuario usuario, Catalogo.Rol rol) {
        if (usuario == null || usuario.rol != rol) {
            throw new AccesoDenegado("No tienes permiso para esta operación.");
        }
    }

    private void exigir(Usuario usuario, String permiso) {
        if (!usuario.tiene(permiso)) {
            throw new AccesoDenegado("No tienes el permiso requerido.");
        }
    }
}
