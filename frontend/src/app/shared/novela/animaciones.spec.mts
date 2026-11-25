// Pruebas del formato liviano de animaciones (public/animaciones/vrm/*.json, generado con tools/animaciones).
// Se corren con: npm run test:novela.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import {
  DURACION_MAXIMA_GESTO, convertirMixamo, desdeLiviana, suavizarReposo, type AnimacionBase, type AnimacionLiviana
} from './animaciones-vrm.ts';

const carpeta = new URL('../../../../public/animaciones/', import.meta.url);
const catalogo: { id: string; archivo: string; categoria: string }[] = JSON.parse(readFileSync(new URL('animaciones.json', carpeta), 'utf8')).animaciones;

function desdeFbx(archivo: string, reposo: boolean): AnimacionBase {
  (globalThis as any).self ??= globalThis;
  const b = readFileSync(new URL(archivo, carpeta));
  const avisos = console.warn; console.warn = () => {};
  try {
    const base = convertirMixamo(new FBXLoader().parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer, ''));
    return reposo ? suavizarReposo(base) : base;
  } finally { console.warn = avisos; }
}

/** Rotación de un hueso en el tiempo t (la misma interpolación que usa three.js). */
function rotacion(base: AnimacionBase, hueso: string, t: number): THREE.Quaternion {
  const p = base.rotaciones.find(r => r.hueso === hueso)!;
  const pista = new THREE.QuaternionKeyframeTrack('x.quaternion', p.tiempos, p.valores);
  const v = pista.createInterpolant().evaluate(t);
  return new THREE.Quaternion(v[0], v[1], v[2], v[3]);
}

test('1. hay un JSON liviano por cada animación del catálogo', () => {
  for (const a of catalogo) assert.ok(existsSync(new URL(`vrm/${a.id}.json`, carpeta)), `falta vrm/${a.id}.json (correr tools/animaciones)`);
});

test('2. el JSON se ve igual que el FBX convertido en el navegador (diferencia < 1°)', () => {
  for (const id of ['reposo', 'reposo2', 'hablar', 'llanto', 'asentir']) {
    const a = catalogo.find(x => x.id === id)!;
    const reposo = a.categoria === 'reposo';
    const fbx = desdeFbx(a.archivo, reposo);
    const json = desdeLiviana(JSON.parse(readFileSync(new URL(`vrm/${id}.json`, carpeta), 'utf8')) as AnimacionLiviana);
    const hasta = reposo ? fbx.duracion : Math.min(fbx.duracion, DURACION_MAXIMA_GESTO);
    assert.ok(Math.abs(json.duracion - hasta) < 1e-3, `${id}: duración ${json.duracion} y no ${hasta}`);
    let peor = 0;
    for (const hueso of ['hips', 'spine', 'chest', 'neck', 'head', 'leftUpperArm', 'rightLowerArm', 'leftHand', 'rightIndexProximal']) {
      for (let k = 0; k <= 40; k++) {
        const t = hasta * k / 40;
        peor = Math.max(peor, rotacion(fbx, hueso, t).angleTo(rotacion(json, hueso, t)) * 180 / Math.PI);
      }
    }
    assert.ok(peor < 1, `${id}: ${peor.toFixed(2)}°`);
  }
});
