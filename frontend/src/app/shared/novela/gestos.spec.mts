// Pruebas de los gestos del cuerpo y del catálogo de animaciones. Se corren con: npm run test:novela.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { CATEGORIAS, elegirGestos, elegirVersion, type AnimacionCatalogo, type PasoGestos } from './gestos.ts';

const carpeta = new URL('../../../../public/animaciones/', import.meta.url);
const catalogo: AnimacionCatalogo[] = JSON.parse(readFileSync(new URL('animaciones.json', carpeta), 'utf8')).animaciones;

const paso = (p: Partial<PasoGestos>): PasoGestos => ({
  tipo: 'dialogo', presentes: [0, 1, 2], hablante: null, emocionFrase: null, emociones: {}, reacciones: [], texto: '', ...p
});

test('1. catálogo: cada animación tiene archivo, categoría válida y un reposo disponible', () => {
  const ids = new Set<string>();
  for (const a of catalogo) {
    assert.ok(existsSync(new URL(a.archivo, carpeta)), `falta ${a.archivo}`);
    assert.ok(CATEGORIAS.includes(a.categoria), `${a.id}: categoría ${a.categoria}`);
    assert.ok(!ids.has(a.id), `id repetido ${a.id}`);
    ids.add(a.id);
  }
  assert.ok(catalogo.some(a => a.categoria === 'reposo' && !a.pendiente));
  // Las de sentado quedan pendientes.
  assert.ok(catalogo.filter(a => a.categoria === 'sentado').every(a => a.pendiente));
});

test('2. diálogo: quien habla según su frase y el primero que escucha asiente', () => {
  const g = elegirGestos(paso({ hablante: 1 }), false);
  assert.deepEqual(g[1], { categoria: 'hablar', papel: 'habla' });
  assert.equal(g[0].categoria, 'escuchar');
  assert.equal(g[2].categoria, 'reposo');
  assert.equal(elegirGestos(paso({ hablante: 0, emocionFrase: { emocion: 'enojo', nivel: 'normal' } }), false)[0].categoria, 'rabia');
  assert.equal(elegirGestos(paso({ hablante: 0, emocionFrase: { emocion: 'tristeza', nivel: 'normal' }, texto: 'No paro de llorar' }), false)[0].categoria, 'llanto');
  assert.equal(elegirGestos(paso({ hablante: 0, emocionFrase: { emocion: 'tristeza', nivel: 'normal' }, texto: 'Estoy triste' }), false)[0].categoria, 'tristeza');
  assert.equal(elegirGestos(paso({ hablante: 0, emocionFrase: { emocion: 'sorpresa', nivel: 'fuerte' } }), false)[0].categoria, 'nervios');
});

test('3. quienes escuchan siguen el tono de la frase o su propia emoción', () => {
  const triste = elegirGestos(paso({ hablante: 0, emocionFrase: { emocion: 'tristeza', nivel: 'fuerte' } }), false);
  assert.equal(triste[1].categoria, 'tristeza');
  const grito = elegirGestos(paso({ hablante: 0, emocionFrase: { emocion: 'enojo', nivel: 'normal' } }), false);
  assert.equal(grito[1].categoria, 'nervios');
  const propia = elegirGestos(paso({ hablante: 0, emociones: { 2: { emocion: 'tristeza', nivel: 'normal' } } }), false);
  assert.equal(propia[2].categoria, 'tristeza');
  assert.equal(propia[1].categoria, 'escuchar');
});

test('4. narración: todos en reposo salvo a quien la frase le describe una emoción', () => {
  const g = elegirGestos(paso({ tipo: 'narracion', texto: 'La madre rompe en llanto.', reacciones: [{ personaje: 1, emocion: 'tristeza', nivel: 'fuerte' }] }), false);
  assert.equal(g[0].categoria, 'reposo');
  assert.equal(g[1].categoria, 'llanto');
  assert.equal(g[2].categoria, 'reposo');
  const alivio = elegirGestos(paso({ tipo: 'narracion', texto: 'Respira con alivio.', reacciones: [{ personaje: 0, emocion: 'alegria', nivel: 'leve' }] }), false);
  assert.equal(alivio[0].categoria, 'alivio');
});

test('5. movimiento reducido: todos en reposo', () => {
  const g = elegirGestos(paso({ hablante: 0, emocionFrase: { emocion: 'enojo', nivel: 'fuerte' } }), true);
  assert.ok(Object.values(g).every(x => x.categoria === 'reposo'));
});

test('6. versiones: dos personajes no hacen el mismo gesto, sin pendientes ni gestos amplios junto al borde', () => {
  const ocupadas = new Set<string>();
  const a = elegirVersion(catalogo, { categoria: 'reposo', papel: 'escucha' }, { slot: 0, actual: null, ocupadas, junto_al_borde: false })!;
  ocupadas.add(a.id);
  const b = elegirVersion(catalogo, { categoria: 'reposo', papel: 'escucha' }, { slot: 0, actual: null, ocupadas, junto_al_borde: false })!;
  assert.notEqual(a.id, b.id);
  for (let slot = 0; slot < 6; slot++) {
    const r = elegirVersion(catalogo, { categoria: 'rabia', papel: 'habla' }, { slot, actual: null, ocupadas: new Set(), junto_al_borde: true })!;
    assert.ok(!r.amplio && r.papel !== 'escucha', r.id);
  }
  assert.equal(elegirVersion(catalogo, { categoria: 'sentado', papel: 'escucha' }, { slot: 0, actual: null, ocupadas: new Set(), junto_al_borde: false }), null);
  // Conserva la versión actual si sigue sirviendo.
  assert.equal(elegirVersion(catalogo, { categoria: 'hablar', papel: 'habla' }, { slot: 3, actual: 'hablar2', ocupadas: new Set(), junto_al_borde: false })?.id, 'hablar2');
});

test('7. reposo: cadera y piernas quietas y el resto del cuerpo al 35 %', async () => {
  const { suavizarReposo, INTENSIDAD_REPOSO } = await import('./animaciones-vrm.ts');
  const giro = (a: number) => [0, Math.sin(a / 2), 0, Math.cos(a / 2)];
  const pista = (hueso: string) => ({ hueso, tiempos: Float32Array.from([0, 1]), valores: Float32Array.from([...giro(-0.2), ...giro(0.2)]) });
  const base = { duracion: 1, rotaciones: [pista('hips'), pista('leftUpperLeg'), pista('head')], cadera: { tiempos: Float32Array.from([0, 1]), alturas: Float32Array.from([0.9, 1.1]) } };
  const r = suavizarReposo(base as any);
  const angulo = (v: Float32Array, i: number) => 2 * Math.atan2(v[i + 1], v[i + 3]);
  for (const h of [0, 1]) assert.ok(Math.abs(angulo(r.rotaciones[h].valores, 0) - angulo(r.rotaciones[h].valores, 4)) < 1e-6);
  assert.ok(Math.abs(angulo(r.rotaciones[2].valores, 4) - 0.2 * INTENSIDAD_REPOSO) < 1e-4);
  assert.deepEqual([...r.cadera!.alturas].map(a => +a.toFixed(4)), [1, 1]);
});
