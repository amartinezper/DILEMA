package com.dilema.servicio.programacion;

/** Chain of Responsibility (RF-18): caso publicado, grupo, fechas, tiempo máximo y tolerancia. */
public class CadenaAgendamiento {
    public void validar(ContextoAgenda contexto) {
        PasoAgenda caso = new ValidadorCasoPublicado();
        PasoAgenda grupo = new ValidadorGrupoDelProfesor();
        PasoAgenda fechas = new ValidadorFechas();
        PasoAgenda tiempo = new ValidadorTiempoMaximo();
        PasoAgenda tolerancia = new ValidadorTolerancia();
        caso.enlazar(grupo).enlazar(fechas).enlazar(tiempo).enlazar(tolerancia);
        caso.validar(contexto);
    }
}
