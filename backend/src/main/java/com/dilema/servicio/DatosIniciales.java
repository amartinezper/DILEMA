package com.dilema.servicio;

import com.dilema.modelo.*;
import com.dilema.repo.*;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Component
public class DatosIniciales implements CommandLineRunner {
    private final UsuarioRepo usuarios;
    private final GrupoRepo grupos;
    private final CasoRepo casos;
    private final SesionRepo sesiones;
    private final SesionEstudianteRepo autorizados;
    private final EscenarioPersonajeRepo vinculos;
    private final FabricaCuentas fabrica;
    private final PasswordEncoder cifrado;

    public DatosIniciales(UsuarioRepo usuarios, GrupoRepo grupos, CasoRepo casos, SesionRepo sesiones,
                          SesionEstudianteRepo autorizados, EscenarioPersonajeRepo vinculos,
                          FabricaCuentas fabrica, PasswordEncoder cifrado) {
        this.usuarios = usuarios;
        this.grupos = grupos;
        this.casos = casos;
        this.sesiones = sesiones;
        this.autorizados = autorizados;
        this.vinculos = vinculos;
        this.fabrica = fabrica;
        this.cifrado = cifrado;
    }

    @Override
    @Transactional
    public void run(String... args) {
        fabrica.asegurarCatalogo();
        if (usuarios.count() > 0) {
            usuarios.findAll().forEach(fabrica::otorgarSiVacio);
            return;
        }

        Usuario admin = cuenta("Administración DILEMA", "admin@psicosim.edu", "admin123", Catalogo.Rol.ADMIN, cifrado);
        Usuario docente = cuenta("Docente de práctica", "docente@psicosim.edu", "docente123", Catalogo.Rol.PROFESOR, cifrado);
        Usuario estudiante = new Usuario();
        estudiante.nombre = "Estudiante de práctica";
        estudiante.email = "estudiante@psicosim.edu";
        estudiante.rol = Catalogo.Rol.ESTUDIANTE;
        estudiante.activo = true;
        usuarios.save(admin);
        usuarios.save(docente);
        usuarios.save(estudiante);
        fabrica.otorgarSiVacio(admin);
        fabrica.otorgarSiVacio(docente);

        Grupo grupo = new Grupo();
        grupo.nombre = "Psicología Social";
        grupo.semestre = "2026-I";
        grupo.docente = docente;
        grupo.estudiantes.add(estudiante);
        grupos.save(grupo);

        Caso caso = new Caso();
        caso.nombre = "Feminicidio en Las Colinas";
        caso.desarrolloSituacional = "Caso formativo de psicología social. El estudiante llega a un barrio de ladera después de un feminicidio. No reconstruye el crimen ni ve la escena violenta: escucha a la comunidad, cuida el consentimiento y activa la ruta de atención.";
        caso.contexto = "Atardece en Las Colinas. Hay presencia institucional a distancia. Tu rol es de práctica: contención, encuadre y derivación. El trabajo empieza en la calle, con las vecinas.";
        caso.tiempoEstimadoMin = 40;
        caso.estado = Catalogo.EstadoCaso.PUBLICADO;
        caso.docente = docente;
        caso.escenarios.add(escenario(caso, "Llegada al barrio", "Atardece en Las Colinas. Hay cinta a lo lejos, en una vivienda. Doña Carmen espera en la esquina. Nadie te ha pedido aún que entres.", 0,
                pregunta(caso, "¿Cuál es tu primer paso al llegar?", "Piensa en el permiso antes que en la intervención.", "Encuadre ético", "2.0", 0,
                        opcion("Presentarte y pedir permiso para hablar.", true, "El encuadre reconoce a las personas antes de intervenir. La relación se construye cuando el otro autoriza la conversación.", "El encuadre ético pide consentimiento antes de intervenir.", 0),
                        opcion("Entrar de inmediato a la vivienda.", false, "Entrar sin autorización desplaza a la comunidad y confunde tu rol con el de investigación criminal.", "Dirigir sin permiso desplaza la voz del grupo.", 1),
                        opcion("Grabar con el celular para tener evidencia.", false, "Grabar sin consentimiento expone a las personas y no es el objeto de esta práctica.", "La evidencia no sustituye el consentimiento.", 2))));
        caso.escenarios.add(escenario(caso, "Conversación con la vecina", "Doña Carmen habla en voz baja. Quiere contar lo que oyó, pero pide que no la expongas frente al barrio.", 1,
                pregunta(caso, "¿Cómo sostienes la conversación?", "Escucha el relato sin convertirlo en interrogatorio.", "Participación del grupo", "1.5", 0,
                        opcion("Escuchar, no presionar el relato y explicar los límites de tu rol.", true, "La escucha protege a quien habla y deja claro que no eres autoridad investigativa.", "La participación se sostiene dando la palabra, no cerrándola.", 0),
                        opcion("Pedirle todos los detalles del hecho para armar el caso.", false, "Forzar el relato revictimiza y sale del encuadre de la práctica.", "La prisa por el dato no equivale a contención.", 1),
                        opcion("Prometerle que el responsable va a pagar si firma una denuncia ahora.", false, "Una promesa de resultado no está en tu competencia y puede ponerla en riesgo.", "No se ofrecen garantías que el rol no puede cumplir.", 2))));
        caso.escenarios.add(escenario(caso, "Cierre y ruta de atención", "Ya hay una idea de qué necesita el barrio: contención, información y un canal institucional. Falta dejar el siguiente paso escrito.", 2,
                pregunta(caso, "¿Qué dejas registrado al cerrar?", null, "Cierre y registro", "1.5", 0,
                        opcion("Los acuerdos, los disensos y la ruta de atención a la que se deriva.", true, "El registro permite retomar el trabajo sin perder matices y conecta con la ruta institucional.", "La memoria del grupo incluye lo que no se cerró.", 0),
                        opcion("Solo tu opinión sobre lo que ocurrió.", false, "Una opinión personal borra a la comunidad y no activa la atención.", "Reducir el cierre a una frase pierde el disenso.", 1),
                        opcion("Nada: cierras y te vas para no involucrarte.", false, "Salir sin registro deja a las personas sin un siguiente paso visible.", "La derivación forma parte del cierre ético.", 2))));
        String[] nombres = {"Doña Carmen", "Lucía", "Inspector Ramírez"};
        String[] roles = {
                "Vecina que espera en la esquina y pide no ser expuesta.",
                "Líder comunitaria que conoce la ruta de atención del barrio.",
                "Autoridad presente a distancia. No es el rol del estudiante."
        };
        for (int i = 0; i < nombres.length; i++) {
            Personaje personaje = new Personaje();
            personaje.caso = caso;
            personaje.nombre = nombres[i];
            personaje.descripcion = roles[i];
            caso.personajes.add(personaje);
        }
        casos.save(caso);
        for (Escenario escenario : caso.escenarios) {
            for (Pregunta pregunta : escenario.preguntas) pregunta.casoId = caso.id;
        }
        for (Personaje personaje : caso.personajes) {
            for (Escenario escenario : caso.escenarios) {
                EscenarioPersonaje vinculo = new EscenarioPersonaje();
                vinculo.escenarioId = escenario.id;
                vinculo.personajeId = personaje.id;
                vinculo.casoId = caso.id;
                vinculos.save(vinculo);
            }
        }

        SesionCaso sesion = new SesionCaso();
        sesion.caso = caso;
        sesion.grupo = grupo;
        sesion.codigo = "DILEMA-2026";
        sesion.inicio = LocalDateTime.now().minusHours(1);
        sesion.fin = LocalDateTime.now().plusDays(20);
        sesion.tiempoMaxMin = 30;
        sesion.toleranciaMin = 180;
        sesion.lugar = "Aula 3";
        sesion.mensaje = "Caso formativo. El objetivo es el encuadre ético y la ruta de atención, no reconstruir el crimen. No hay escena violenta.";
        sesion.inicioReal = LocalDateTime.now().minusMinutes(15);
        sesiones.save(sesion);

        SesionEstudiante fila = new SesionEstudiante();
        fila.sesionId = sesion.id;
        fila.estudianteId = estudiante.id;
        fila.grupoId = grupo.id;
        autorizados.save(fila);
    }

    private Usuario cuenta(String nombre, String email, String clave, Catalogo.Rol rol, PasswordEncoder cifrado) {
        Usuario usuario = new Usuario();
        usuario.nombre = nombre;
        usuario.email = email;
        usuario.contrasena = cifrado.encode(clave);
        usuario.rol = rol;
        usuario.activo = true;
        return usuario;
    }

    private Escenario escenario(Caso caso, String titulo, String contexto, int orden, Pregunta pregunta) {
        Escenario escenario = new Escenario();
        escenario.caso = caso;
        escenario.titulo = titulo;
        escenario.contexto = contexto;
        escenario.orden = orden;
        pregunta.escenario = escenario;
        escenario.preguntas.add(pregunta);
        return escenario;
    }

    private Pregunta pregunta(Caso caso, String enunciado, String pista, String criterio, String peso, int orden, Opcion... opciones) {
        Pregunta pregunta = new Pregunta();
        pregunta.casoId = caso.id == null ? 0L : caso.id;
        pregunta.enunciado = enunciado;
        pregunta.pista = pista;
        pregunta.orden = orden;
        CriterioRubrica rubrica = new CriterioRubrica();
        rubrica.pregunta = pregunta;
        rubrica.criterio = criterio;
        rubrica.peso = new BigDecimal(peso);
        pregunta.criterio = rubrica;
        int i = 0;
        for (Opcion opcion : opciones) {
            opcion.orden = i++;
            opcion.pregunta = pregunta;
            pregunta.opciones.add(opcion);
        }
        return pregunta;
    }

    private Opcion opcion(String texto, boolean correcta, String explicacion, String fundamento, int orden) {
        Opcion opcion = new Opcion();
        opcion.descripcion = texto;
        opcion.esCorrecta = correcta;
        opcion.orden = orden;
        Retroalimentacion retro = new Retroalimentacion();
        retro.opcion = opcion;
        retro.explicacion = explicacion;
        retro.fundamento = fundamento;
        opcion.retroalimentacion = retro;
        return opcion;
    }
}
