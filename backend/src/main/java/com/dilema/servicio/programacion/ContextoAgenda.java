package com.dilema.servicio.programacion;

import com.dilema.modelo.Caso;
import com.dilema.modelo.Grupo;
import com.dilema.modelo.Usuario;

import java.time.LocalDateTime;

/** Datos que recorre la cadena de agendamiento (RF-04 y RF-18). */
public record ContextoAgenda(Usuario docente, Caso caso, Grupo grupo, LocalDateTime inicio, LocalDateTime fin,
                             int tiempoMaxMin, int toleranciaMin) {}
