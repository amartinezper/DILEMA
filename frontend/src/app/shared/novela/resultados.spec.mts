// Pruebas de los resultados de la vista previa. Se corren con: npm run test:novela.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularResultados, nivelDeNota, resumenPorCriterio, type CasoResultado } from './resultados.ts';

const op = (texto: string, correcta = false) => ({ texto, correcta, explicacion: `Porque ${texto}`, fundamento: `Fundamento ${texto}` });
const caso: CasoResultado = {
  bloques: [
    { nombre: 'Salón', preguntas: [{ enunciado: '<p>P1</p>', criterio: 'Decisión', peso: 2, opciones: [op('a', true), op('b')] }] },
    { nombre: 'Orientación', preguntas: [
      { enunciado: '<p>P2</p>', criterio: 'Norma', peso: 1.5, opciones: [op('c'), op('d', true)] },
      { enunciado: '<p>P3</p>', criterio: 'Decisión', peso: 1.5, opciones: [op('e', true), op('f')] }
    ] }
  ]
};

test('1. aciertos, fallos, sin responder y nota según los pesos', () => {
  const r = calcularResultados(caso, { '0:0': 0, '1:0': 0 });
  assert.deepEqual([r.aciertos, r.fallos, r.sinResponder, r.nota], [1, 1, 1, 2]);
});

test('2. por pregunta: elegida, acierto y, si falló, la correcta con explicación y fundamento', () => {
  const r = calcularResultados(caso, { '0:0': 0, '1:0': 0 });
  assert.deepEqual(r.preguntas[0], { escenario: 'Salón', numeroEscenario: 1, numeroPregunta: 1, criterio: 'Decisión', peso: 2, puntos: 2,
    enunciado: '<p>P1</p>', elegida: 'a', acierto: true, explicacionElegida: 'Porque a', fundamentoElegida: 'Fundamento a',
    correcta: null, explicacionCorrecta: null, fundamentoCorrecta: null });
  assert.deepEqual([r.preguntas[2].numeroEscenario, r.preguntas[2].numeroPregunta, r.preguntas[1].puntos], [2, 2, 0]);
  assert.equal(r.preguntas[1].acierto, false);
  assert.equal(r.preguntas[1].explicacionElegida, 'Porque c');
  assert.deepEqual([r.preguntas[1].correcta, r.preguntas[1].explicacionCorrecta, r.preguntas[1].fundamentoCorrecta], ['d', 'Porque d', 'Fundamento d']);
  assert.equal(r.preguntas[2].acierto, null, 'sin responder');
  assert.equal(r.preguntas[2].correcta, 'e');
});

test('3. todo bien = 5,0; pesos que no suman 5 se escalan; sin pesos, por cantidad de aciertos', () => {
  assert.equal(calcularResultados(caso, { '0:0': 0, '1:0': 1, '1:1': 0 }).nota, 5);
  const borrador: CasoResultado = { bloques: [{ nombre: 'A', preguntas: [
    { enunciado: 'x', peso: 1, opciones: [op('a', true)] }, { enunciado: 'y', peso: 1, opciones: [op('b', true), op('c')] }] }] };
  assert.equal(calcularResultados(borrador, { '0:0': 0, '0:1': 1 }).nota, 2.5);
  const sinPesos: CasoResultado = { bloques: [{ nombre: 'A', preguntas: [
    { enunciado: 'x', peso: 0, opciones: [op('a', true)] }, { enunciado: 'y', opciones: [op('b', true)] }] }] };
  assert.equal(calcularResultados(sinPesos, { '0:0': 0 }).nota, 2.5);
});

test('4. desempeño por criterio y nivel de la nota', () => {
  const r = calcularResultados(caso, { '0:0': 0, '1:0': 0 });
  assert.deepEqual(resumenPorCriterio(r.preguntas), [
    { criterio: 'Decisión', puntos: 2, peso: 3.5 }, { criterio: 'Norma', puntos: 0, peso: 1.5 }]);
  assert.deepEqual([nivelDeNota(4.3), nivelDeNota(3), nivelDeNota(2.9)], ['alto', 'medio', 'bajo']);
});
