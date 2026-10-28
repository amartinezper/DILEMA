package com.dilema.servicio;

import com.dilema.dto.Contratos;
import com.dilema.modelo.*;
import com.dilema.repo.CasoRepo;
import com.dilema.repo.EscenarioPersonajeRepo;
import com.dilema.repo.SesionRepo;
import com.dilema.servicio.diseno.ArbolCaso;
import com.dilema.servicio.diseno.DirectorCaso;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class CasoServicio {
    private final CasoRepo casos;
    private final SesionRepo sesiones;
    private final EscenarioPersonajeRepo vinculos;
    private final ProxyOperacion proxy;
    private final Mapeador mapeador;
    private final EntityManager em;

    public CasoServicio(CasoRepo casos, SesionRepo sesiones, EscenarioPersonajeRepo vinculos,
                        ProxyOperacion proxy, Mapeador mapeador, EntityManager em) {
        this.casos = casos;
        this.sesiones = sesiones;
        this.vinculos = vinculos;
        this.proxy = proxy;
        this.mapeador = mapeador;
        this.em = em;
    }

    @Transactional(readOnly = true)
    public List<Contratos.CasoResumen> listar(Usuario docente) {
        proxy.revisarGrupo(docente);
        return casos.findByDocenteIdOrderByIdDesc(docente.id).stream().map(mapeador::resumen).toList();
    }

    @Transactional(readOnly = true)
    public Contratos.CasoVista obtener(Usuario docente, Long id) {
        proxy.revisarGrupo(docente);
        Caso caso = propio(docente, id);
        return mapeador.caso(caso, vinculos.findByCasoId(caso.id));
    }

    @Transactional
    public Contratos.CasoVista crear(Usuario docente, Contratos.CasoIn entrada) {
        proxy.crearCaso(docente);
        Caso caso = new DirectorCaso().construirNuevo(docente, entrada);
        casos.save(caso);
        em.flush();
        fijarCasoId(caso);
        enlazar(caso, entrada);
        return mapeador.caso(caso, vinculos.findByCasoId(caso.id));
    }

    @Transactional
    public Contratos.CasoVista actualizar(Usuario docente, Long id, Contratos.CasoIn entrada) {
        proxy.crearCaso(docente);
        Caso caso = propio(docente, id);
        estadoDe(caso).editar();
        vinculos.deleteByCasoId(caso.id);
        caso.escenarios.clear();
        caso.personajes.clear();
        em.flush();
        new DirectorCaso().reconstruir(caso, entrada);
        em.flush();
        fijarCasoId(caso);
        enlazar(caso, entrada);
        return mapeador.caso(caso, vinculos.findByCasoId(caso.id));
    }

    @Transactional
    public Contratos.CasoVista publicar(Usuario docente, Long id) {
        proxy.crearCaso(docente);
        Caso caso = propio(docente, id);
        estadoDe(caso).publicar(caso, validar(caso));
        return mapeador.caso(caso, vinculos.findByCasoId(caso.id));
    }

    @Transactional
    public Contratos.CasoVista archivar(Usuario docente, Long id) {
        proxy.crearCaso(docente);
        Caso caso = propio(docente, id);
        estadoDe(caso).archivar(caso);
        return mapeador.caso(caso, vinculos.findByCasoId(caso.id));
    }

    @Transactional
    public Contratos.CasoVista despublicar(Usuario docente, Long id) {
        proxy.crearCaso(docente);
        Caso caso = propio(docente, id);
        boolean usado = sesiones.findAll().stream().anyMatch(s -> s.caso.id.equals(caso.id))
                || em.createQuery("select count(p) from Participacion p where p.casoId = :id", Long.class)
                .setParameter("id", caso.id).getSingleResult() > 0;
        estadoDe(caso).despublicar(caso, usado);
        return mapeador.caso(caso, vinculos.findByCasoId(caso.id));
    }

    /** INV-12: la copia nace en borrador, sin sesiones ni participaciones. */
    @Transactional
    public Contratos.CasoVista duplicar(Usuario docente, Long id) {
        proxy.crearCaso(docente);
        Caso origen = propio(docente, id);
        Caso copia = new DirectorCaso().duplicar(docente, origen);
        casos.save(copia);
        em.flush();
        fijarCasoId(copia);
        copiarVinculos(origen, copia);
        return mapeador.caso(copia, vinculos.findByCasoId(copia.id));
    }

    private void copiarVinculos(Caso origen, Caso copia) {
        for (EscenarioPersonaje vinculo : vinculos.findByCasoId(origen.id)) {
            Escenario escenarioOrigen = origen.escenarios.stream().filter(e -> e.id.equals(vinculo.escenarioId)).findFirst().orElse(null);
            Personaje personajeOrigen = origen.personajes.stream().filter(p -> p.id.equals(vinculo.personajeId)).findFirst().orElse(null);
            if (escenarioOrigen == null || personajeOrigen == null) continue;
            int indice = origen.personajes.indexOf(personajeOrigen);
            Escenario escenarioNuevo = copia.escenarios.stream().filter(e -> e.orden == escenarioOrigen.orden).findFirst().orElse(null);
            if (escenarioNuevo == null || indice < 0 || indice >= copia.personajes.size()) continue;
            EscenarioPersonaje nuevo = new EscenarioPersonaje();
            nuevo.escenarioId = escenarioNuevo.id;
            nuevo.personajeId = copia.personajes.get(indice).id;
            nuevo.casoId = copia.id;
            em.persist(nuevo);
        }
    }

    public Caso propio(Usuario docente, Long id) {
        Caso caso = casos.findById(id).orElseThrow(() -> new NoEncontrado("Caso no encontrado."));
        if (!caso.docente.id.equals(docente.id)) throw new AccesoDenegado("Este caso pertenece a otro docente.");
        return caso;
    }

    private void fijarCasoId(Caso caso) {
        for (Escenario escenario : caso.escenarios) {
            for (Pregunta pregunta : escenario.preguntas) pregunta.casoId = caso.id;
        }
    }

    private void enlazar(Caso caso, Contratos.CasoIn entrada) {
        List<Contratos.PersonajeIn> pedidos = entrada.personajes() == null ? List.of() : entrada.personajes();
        for (int i = 0; i < pedidos.size() && i < caso.personajes.size(); i++) {
            Personaje personaje = caso.personajes.get(i);
            List<Integer> ordenes = pedidos.get(i).escenarios() == null ? List.of() : pedidos.get(i).escenarios();
            for (Integer orden : ordenes) {
                Escenario escenario = caso.escenarios.stream().filter(e -> e.orden == orden).findFirst().orElse(null);
                if (escenario == null || escenario.id == null || personaje.id == null) continue;
                EscenarioPersonaje vinculo = new EscenarioPersonaje();
                vinculo.escenarioId = escenario.id;
                vinculo.personajeId = personaje.id;
                vinculo.casoId = caso.id;
                em.persist(vinculo);
            }
        }
    }

    /** Composite (RF-06): Caso, Escenario, Pregunta y Opción se validan como un solo árbol. */
    public List<String> validar(Caso caso) {
        List<String> errores = new java.util.ArrayList<>();
        java.util.Set<Long> ligados = vinculos.findByCasoId(caso.id).stream()
                .map(v -> v.personajeId).collect(Collectors.toSet());
        new ArbolCaso.NodoCaso(caso, ligados).validar(errores);
        return errores;
    }

    private EstadoCaso estadoDe(Caso caso) {
        return switch (caso.estado) {
            case PUBLICADO -> new Publicado();
            case ARCHIVADO -> new Archivado();
            default -> new Borrador();
        };
    }
    /** State (RF-09): cada estado acepta o rechaza editar, publicar, despublicar y archivar. */
    interface EstadoCaso {
        void editar();
        void publicar(Caso caso, List<String> errores);
        void archivar(Caso caso);
        void despublicar(Caso caso, boolean usado);
    }

    class Borrador implements EstadoCaso {
        public void editar() {}
        public void publicar(Caso caso, List<String> errores) {
            if (!errores.isEmpty()) throw new ReglaNegocio(String.join(" ", errores));
            caso.estado = Catalogo.EstadoCaso.PUBLICADO;
        }
        public void archivar(Caso caso) {
            throw new ReglaNegocio("INV-11: un borrador se publica. Solo un caso publicado se archiva.");
        }
        public void despublicar(Caso caso, boolean usado) {
            throw new ReglaNegocio("Solo un caso publicado puede volver a borrador.");
        }
    }

    class Publicado implements EstadoCaso {
        public void editar() { throw new ReglaNegocio("RF-09: solo se edita un caso en borrador."); }
        public void publicar(Caso caso, List<String> errores) {
            throw new ReglaNegocio("RF-09: solo un borrador puede publicarse.");
        }
        public void archivar(Caso caso) { caso.estado = Catalogo.EstadoCaso.ARCHIVADO; }
        public void despublicar(Caso caso, boolean usado) {
            if (usado) throw new ReglaNegocio("INV-11: no se puede volver a borrador un caso que ya tiene sesiones o participaciones.");
            caso.estado = Catalogo.EstadoCaso.BORRADOR;
        }
    }

    class Archivado implements EstadoCaso {
        public void editar() { throw new ReglaNegocio("RF-09: solo se edita un caso en borrador."); }
        public void publicar(Caso caso, List<String> errores) {
            if (!errores.isEmpty()) throw new ReglaNegocio(String.join(" ", errores));
            caso.estado = Catalogo.EstadoCaso.PUBLICADO;
        }
        public void archivar(Caso caso) { throw new ReglaNegocio("El caso ya está archivado."); }
        public void despublicar(Caso caso, boolean usado) {
            throw new ReglaNegocio("Solo un caso publicado puede volver a borrador.");
        }
    }
}
