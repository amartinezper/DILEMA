// Pruebas de la elección de fondo. Se corren con: npm run test:novela (node --test, sin dependencias).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { ambienteDe, elegirFondo, momentoDelDia, normalizar, tipoDeCaso, type CasoEscena, type IndiceEscenas } from './escena.ts';

const base = new URL('../../../../public/', import.meta.url);
const indice: IndiceEscenas = JSON.parse(readFileSync(new URL('escenas/escenas.json', base), 'utf8'));

const caso = (texto: string, id: number | string = 1): CasoEscena => ({ id, nombre: '', desarrolloSituacional: texto, contexto: '', bloques: [] });
const fondo = (nombre: string, contexto = '', c: CasoEscena = caso(''), indiceBloque = 0) =>
  elegirFondo(indice, c, { indice: indiceBloque, nombre, contexto });

test('1. palabras del nombre del escenario: urgencias, comisaría, colegio', () => {
  assert.equal(fondo('Llegada a urgencias').escenaId, 'hospital-urgencias');
  assert.equal(fondo('Audiencia en la comisaría de familia').escenaId, 'comisaria');
  assert.equal(fondo('Clase en el colegio').escenaId, 'colegio-salon');
});

test('2. la frase más específica gana: "habitación de hospital" sobre "habitación"', () => {
  assert.equal(fondo('Habitación de hospital').escenaId, 'hospital-habitacion');
  assert.equal(fondo('La habitación de Sofía').escenaId, 'casa-habitacion');
});

test('3. el contexto también cuenta cuando el nombre es genérico ("Escenario 2")', () => {
  assert.equal(fondo('Escenario 2', 'La familia almuerza en la cocina').escenaId, 'casa-cocina');
});

test('4. sin coincidencias: fondo neutro según el tipo de caso', () => {
  const salud = caso('Paciente atendida en el hospital por la psicóloga.');
  const r = fondo('Escenario 1', 'Primera conversación', salud);
  assert.equal(r.motivo, 'tipo-caso');
  assert.equal(r.escenaId, 'consultorio');
  assert.equal(fondo('Escenario 1', '', caso('Problema de convivencia en el colegio y el aula')).escenaId, 'colegio-orientacion');
  assert.equal(fondo('Escenario 1', '', caso('')).escenaId, 'oficina-institucional', 'sin tipo: neutro general');
});

test('5. momento del día: noche, tarde, lluvia y por defecto día', () => {
  assert.equal(momentoDelDia(normalizar('Esa noche llegó tarde')), 'noche');
  assert.equal(momentoDelDia(normalizar('A las 9 p. m. sonó el teléfono')), 'noche');
  assert.equal(momentoDelDia(normalizar('En la tarde, después del colegio')), 'tarde');
  assert.equal(momentoDelDia(normalizar('Bajo la lluvia esperó el bus')), 'lluvia');
  assert.equal(momentoDelDia(normalizar('Visita de seguimiento')), 'dia');
  assert.equal(fondo('Calle del barrio en la noche').variante, 'noche');
});

test('6. si la escena no tiene la variante pedida, usa otra disponible', () => {
  const r = fondo('Urgencias de noche');
  assert.equal(r.escenaId, 'hospital-urgencias');
  assert.equal(r.variante, 'dia', 'urgencias solo tiene variante de día');
});

test('7. ambiente: tenso o triste prefiere alternativas marcadas; neutro las evita', () => {
  assert.equal(ambienteDe(normalizar('Hubo gritos y amenazas')), 'tenso');
  assert.equal(ambienteDe(normalizar('La niña llora por la muerte de su abuelo')), 'triste');
  const triste = fondo('Calle del barrio', 'Camina sola, triste, bajo la lluvia');
  assert.equal(triste.escenaId, 'calle-barrio');
  assert.equal(triste.alternativaId, '3', 'la única alternativa marcada como triste');
  for (let id = 1; id <= 30; id++) {
    const neutro = fondo('Calle del barrio', 'Visita de rutina', caso('', id));
    assert.notEqual(neutro.alternativaId, '3', 'con ambiente neutro no usa la calle triste');
  }
});

test('8. determinista: mismo caso y escenario = mismo fondo; la ruta existe', () => {
  const c = caso('Caso de violencia intrafamiliar', 42);
  const a = fondo('Sala de la casa', 'La madre conversa con la docente', c, 1);
  const b = fondo('Sala de la casa', 'La madre conversa con la docente', c, 1);
  assert.deepEqual(a, b);
  assert.ok(existsSync(new URL(a.ruta.slice(1), base)), a.ruta);
});

test('9. todas las escenas y variantes del índice apuntan a archivos que existen', () => {
  for (const e of indice.escenas) {
    for (const alt of e.alternativas) {
      for (const ruta of Object.values(alt.variantes)) assert.ok(existsSync(new URL('escenas/' + ruta, base)), ruta);
    }
  }
});

test('10. tipo de caso a partir de todo el texto', () => {
  assert.equal(tipoDeCaso(indice, caso('Ingreso a urgencias del hospital, luego consulta con la psicóloga')), 'salud');
  assert.equal(tipoDeCaso(indice, caso('Denuncia en la estación de policía y medidas de protección')), 'proteccion');
  assert.equal(tipoDeCaso(indice, caso('Texto sin lugares')), null);
});

test('12. una palabra repetida en el índice con y sin tilde ("comisaría"/"comisaria") cuenta una sola vez', () => {
  const r = fondo('Visita a la casa de Diana', 'El equipo de la comisaría visita la casa. Los niños juegan en la sala.', caso('Comisaría de familia y medidas de protección'));
  assert.equal(r.escenaId, 'casa-sala');
});

test('11. textos con HTML y tildes', () => {
  assert.equal(fondo('<p><strong>Cafetería</strong> del colegio</p>').escenaId, 'cafeteria');
});
