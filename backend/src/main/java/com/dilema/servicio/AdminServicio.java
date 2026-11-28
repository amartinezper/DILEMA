package com.dilema.servicio;

import com.dilema.dto.Contratos;
import com.dilema.modelo.Catalogo;
import com.dilema.modelo.Usuario;
import com.dilema.repo.GrupoRepo;
import com.dilema.repo.UsuarioRepo;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Service
public class AdminServicio {
    private final UsuarioRepo usuarios;
    private final GrupoRepo grupos;
    private final ProxyOperacion proxy;
    private final Mapeador mapeador;
    private final FabricaCuentas fabrica;
    private final PasswordEncoder cifrado;
    private final Tokens tokens;

    public AdminServicio(UsuarioRepo usuarios, GrupoRepo grupos, ProxyOperacion proxy,
                         Mapeador mapeador, FabricaCuentas fabrica, PasswordEncoder cifrado, Tokens tokens) {
        this.usuarios = usuarios;
        this.grupos = grupos;
        this.proxy = proxy;
        this.mapeador = mapeador;
        this.fabrica = fabrica;
        this.cifrado = cifrado;
        this.tokens = tokens;
    }

    @Transactional(readOnly = true)
    public List<Contratos.UsuarioVista> usuarios(Usuario admin) {
        proxy.gestionarUsuarios(admin);
        List<Usuario> cuentas = new ArrayList<>();
        cuentas.addAll(usuarios.findByRol(Catalogo.Rol.ADMIN));
        cuentas.addAll(usuarios.findByRol(Catalogo.Rol.PROFESOR));
        return cuentas.stream().map(mapeador::usuario).toList();
    }

    @Transactional(readOnly = true)
    public Contratos.UsuarioVista cuenta(Usuario admin, Long id) {
        proxy.gestionarUsuarios(admin);
        return mapeador.usuario(buscar(id));
    }

    /**
     * Corrige nombre y correo de una cuenta ya creada. No cambia el rol ni vuelve a nacer la cuenta,
     * para no borrar los permisos que ya tiene. La clave solo se reemplaza si viene escrita, y nunca en un estudiante.
     */
    @Transactional
    public Contratos.UsuarioVista actualizar(Usuario admin, Long id, Contratos.DatosCuentaIn entrada) {
        proxy.gestionarUsuarios(admin);
        Usuario cuenta = buscar(id);
        if (entrada.nombre() == null || entrada.nombre().isBlank() || entrada.email() == null || entrada.email().isBlank()) {
            throw new ReglaNegocio("Indica nombre y correo institucional.");
        }
        String correo = entrada.email().trim().toLowerCase();
        if (!correo.contains("@") || correo.length() < 5) {
            throw new ReglaNegocio("Indica un correo institucional válido.");
        }
        var ocupado = usuarios.findByEmailIgnoreCase(correo);
        if (ocupado.isPresent() && ocupado.get().id != null && !ocupado.get().id.equals(cuenta.id)) {
            throw new ReglaNegocio("Ya existe una cuenta con ese correo.");
        }
        cuenta.nombre = entrada.nombre().trim();
        cuenta.email = correo;
        String clave = entrada.clave() == null ? "" : entrada.clave().trim();
        if (!clave.isEmpty()) {
            if (cuenta.rol == Catalogo.Rol.ESTUDIANTE) {
                throw new ReglaNegocio("El estudiante entra sin contraseña.");
            }
            if (clave.length() < 6) {
                throw new ReglaNegocio("La clave debe tener al menos 6 caracteres.");
            }
            cuenta.contrasena = cifrado.encode(clave);
            tokens.revocarUsuario(cuenta.id);
        }
        usuarios.save(cuenta);
        return mapeador.usuario(cuenta);
    }

    /** El administrador crea docentes. El estudiante se da de alta en {@link #matricular}. */
    @Transactional
    public Contratos.UsuarioVista crear(Usuario admin, Contratos.UsuarioIn entrada) {
        proxy.gestionarUsuarios(admin);
        if (entrada.nombre() == null || entrada.nombre().isBlank()
                || entrada.email() == null || entrada.email().isBlank()) {
            throw new ReglaNegocio("Indica nombre y correo institucional.");
        }
        String correo = entrada.email().trim().toLowerCase();
        if (!correo.contains("@") || correo.length() < 5) {
            throw new ReglaNegocio("Indica un correo institucional válido.");
        }
        if (usuarios.findByEmailIgnoreCase(correo).isPresent()) {
            throw new ReglaNegocio("Ya existe una cuenta con ese correo.");
        }
        Catalogo.Rol rol = rolDe(entrada.rol());
        if (rol == Catalogo.Rol.ESTUDIANTE) {
            throw new ReglaNegocio("El estudiante se da de alta sin contraseña, en su propia lista.");
        }
        String clave = entrada.clave() == null ? "" : entrada.clave().trim();
        if (clave.length() < 6) {
            throw new ReglaNegocio("La clave debe tener al menos 6 caracteres.");
        }
        Usuario nuevo = rol == Catalogo.Rol.PROFESOR ? fabrica.nuevoDocente() : fabrica.nuevoAdministrador();
        nuevo.nombre = entrada.nombre().trim();
        nuevo.email = correo;
        nuevo.contrasena = cifrado.encode(clave);
        usuarios.save(nuevo);
        return mapeador.usuario(nuevo);
    }

    /** Cuentas de estudiante, activas e inactivas. El filtro de estado lo hace la pantalla. */
    @Transactional(readOnly = true)
    public List<Contratos.UsuarioVista> estudiantes(Usuario admin) {
        proxy.gestionarUsuarios(admin);
        return usuarios.findByRol(Catalogo.Rol.ESTUDIANTE).stream().map(mapeador::usuario).toList();
    }

    /** Alta de la cuenta. No la mete en un grupo y no le pone contraseña. */
    @Transactional
    public Contratos.UsuarioVista matricular(Usuario admin, String nombre, String email) {
        proxy.gestionarUsuarios(admin);
        if (nombre == null || nombre.isBlank() || email == null || email.isBlank()) {
            throw new ReglaNegocio("Indica nombre y correo institucional.");
        }
        String correo = email.trim().toLowerCase();
        if (!correo.contains("@") || correo.length() < 5) {
            throw new ReglaNegocio("Indica un correo institucional válido.");
        }
        if (usuarios.findByEmailIgnoreCase(correo).isPresent()) {
            throw new ReglaNegocio("Ya existe una cuenta con ese correo.");
        }
        return mapeador.usuario(fabrica.nuevoEstudiante(nombre, correo));
    }

    @Transactional
    public Contratos.UsuarioVista permiso(Usuario admin, Long id, List<String> extras) {
        proxy.gestionarUsuarios(admin);
        Usuario docente = usuarios.findById(id).orElseThrow(() -> new NoEncontrado("Docente no encontrado."));
        if (docente.rol != Catalogo.Rol.PROFESOR) {
            throw new ReglaNegocio("Solo se administran los permisos de un docente.");
        }
        fabrica.reemplazarPermisosDocente(docente, extras);
        return mapeador.usuario(docente);
    }

    @Transactional
    public Contratos.UsuarioVista activo(Usuario admin, Long id, boolean activo) {
        proxy.gestionarUsuarios(admin);
        if (admin.id.equals(id)) {
            throw new ReglaNegocio("No puedes desactivar tu propia cuenta.");
        }
        Usuario cuenta = usuarios.findById(id).orElseThrow(() -> new NoEncontrado("Cuenta no encontrada."));
        cuenta.activo = activo;
        usuarios.save(cuenta);
        if (!activo) tokens.revocarUsuario(cuenta.id);
        return mapeador.usuario(cuenta);
    }

    @Transactional(readOnly = true)
    public List<Contratos.GrupoVista> grupos(Usuario admin) {
        proxy.gestionarUsuarios(admin);
        return grupos.findAll().stream().map(mapeador::grupo).toList();
    }

    private Usuario buscar(Long id) {
        return usuarios.findById(id).orElseThrow(() -> new NoEncontrado("Cuenta no encontrada."));
    }

    private Catalogo.Rol rolDe(String texto) {
        if (texto == null) throw new ReglaNegocio("Indica el rol.");
        return switch (texto.trim().toUpperCase()) {
            case "DOCENTE", "PROFESOR" -> Catalogo.Rol.PROFESOR;
            case "ADMIN", "ADMINISTRADOR" -> Catalogo.Rol.ADMIN;
            case "ESTUDIANTE" -> Catalogo.Rol.ESTUDIANTE;
            default -> throw new ReglaNegocio("El rol debe ser docente o administración.");
        };
    }
}
