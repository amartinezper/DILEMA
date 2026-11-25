// Convierte los FBX de Mixamo del catálogo (frontend/public/animaciones/animaciones.json) al formato liviano
// listo para VRM: frontend/public/animaciones/vrm/<id>.json.
//
// Usa el MISMO código de conversión de la app (src/app/shared/novela/animaciones-vrm.ts: huesos de VRM,
// personaje anclado y reposo suavizado) y el three.js ya instalado en frontend/node_modules, así que no
// agrega dependencias. Requiere Node 22.18 o más nuevo (lee TypeScript sin compilar).
//
// Uso (desde esta carpeta): npm run convertir
// Hay que volver a correrlo cada vez que se agregue o cambie una animación del catálogo.
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const frontend = join(aqui, '..', '..', 'frontend');
const carpeta = join(frontend, 'public', 'animaciones');
const destino = join(carpeta, 'vrm');

globalThis.self ??= globalThis;   // FBXLoader espera un entorno de navegador
const { FBXLoader } = await import(pathToFileURL(join(frontend, 'node_modules/three/examples/jsm/loaders/FBXLoader.js')).href);
const { convertirMixamo, suavizarReposo, aLiviana, FPS_LIVIANA, DURACION_MAXIMA_GESTO } =
  await import(pathToFileURL(join(frontend, 'src/app/shared/novela/animaciones-vrm.ts')).href);

const catalogo = JSON.parse(readFileSync(join(carpeta, 'animaciones.json'), 'utf8')).animaciones;
mkdirSync(destino, { recursive: true });
const avisos = console.warn;
console.warn = () => {};   // FBXLoader avisa de cada nodo sin geometría: no aporta nada aquí
let antes = 0, despues = 0;
for (const a of catalogo) {
  const ruta = join(carpeta, a.archivo);
  const b = readFileSync(ruta);
  const fbx = new FBXLoader().parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '');
  let base = convertirMixamo(fbx);
  const reposo = a.categoria === 'reposo';
  if (reposo) base = suavizarReposo(base);
  const liviana = reposo ? aLiviana(base, FPS_LIVIANA.reposo) : aLiviana(base, FPS_LIVIANA.gesto, DURACION_MAXIMA_GESTO);
  const salida = join(destino, `${a.id}.json`);
  writeFileSync(salida, JSON.stringify(liviana));
  const kbAntes = statSync(ruta).size / 1024, kbDespues = statSync(salida).size / 1024;
  antes += kbAntes; despues += kbDespues;
  console.log(`${a.id.padEnd(16)} ${a.archivo.padEnd(28)} ${kbAntes.toFixed(0).padStart(6)} KB → ${kbDespues.toFixed(0).padStart(5)} KB`
    + `  (${Object.keys(liviana.huesos).length} huesos, ${liviana.tiempos.length} cuadros)`);
}
console.warn = avisos;
console.log(`\nTotal: ${(antes / 1024).toFixed(1)} MB en FBX → ${(despues / 1024).toFixed(1)} MB en JSON (${catalogo.length} animaciones)`);
