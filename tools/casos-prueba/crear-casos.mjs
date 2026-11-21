// Crea los casos de prueba por la API, igual que lo haría un docente desde el editor.
//
// Uso (desde la raíz del proyecto, con el backend corriendo):
//   node tools/casos-prueba/crear-casos.mjs
//   node tools/casos-prueba/crear-casos.mjs --base http://localhost:8080 --email docente@psicosim.edu --clave docente123
//   node tools/casos-prueba/crear-casos.mjs --actualizar    (reescribe los que siguen en borrador)
//
// Qué hace:
//   1. Inicia sesión como docente.
//   2. Crea cada caso de tools/casos-prueba/casos/*.json (POST /api/docente/casos). Si ya existe uno con el
//      mismo nombre, no lo repite.
//   3. Publica los casos de PUBLICAR (por defecto, el caso a).
//   4. Programa e inicia una sesión de prueba del caso a para el grupo del estudiante de práctica, si aún no
//      tiene una. La sesión dura 30 días y el estudiante puede entrar durante todo ese tiempo.
// Solo usa la API: no toca la base de datos directamente.
import { readFileSync, readdirSync } from 'node:fs';

const arg = (nombre, defecto) => { const i = process.argv.indexOf(`--${nombre}`); return i > 0 ? process.argv[i + 1] : defecto; };
const BASE = arg('base', 'http://localhost:8080');
const EMAIL = arg('email', 'docente@psicosim.edu');
const CLAVE = arg('clave', 'docente123');
const ESTUDIANTE = arg('estudiante', 'estudiante@psicosim.edu');
const PUBLICAR = ['a-santiago-senales-en-el-colegio.json'];
const CON_SESION = 'a-santiago-senales-en-el-colegio.json';
const DIAS_SESION = 30;
/** Mensaje de la sesión de prueba: así el script reconoce la suya y no toca las que programe un docente. */
const MENSAJE_SESION = 'Sesión de prueba del caso de Santiago para revisar la novela visual.';
/** --actualizar: reescribe con el archivo los casos que ya existen y siguen en borrador. */
const ACTUALIZAR = process.argv.includes('--actualizar');

let token = '';
async function api(metodo, ruta, cuerpo) {
  const r = await fetch(BASE + ruta, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo)
  });
  const texto = await r.text();
  const dato = texto ? JSON.parse(texto) : null;
  if (!r.ok) throw new Error(`${metodo} ${ruta} → ${r.status}: ${dato?.mensaje ?? texto}`);
  return dato;
}
/** Fecha local "AAAA-MM-DDTHH:mm" como la pide el formulario de programación. */
const fechaLocal = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

const sesion = await api('POST', '/api/auth/ingresar', { email: EMAIL, clave: CLAVE, rol: null, codigoAutorizacion: null });
token = sesion.token;
console.log(`Sesión iniciada como ${sesion.usuario.nombre} (${sesion.usuario.email}).`);

const carpeta = new URL('casos/', import.meta.url);
const archivos = readdirSync(carpeta).filter(f => f.endsWith('.json')).sort();
const existentes = await api('GET', '/api/docente/casos');
const creados = {};
for (const archivo of archivos) {
  const caso = JSON.parse(readFileSync(new URL(archivo, carpeta), 'utf8'));
  const previo = existentes.find(c => c.nombre === caso.nombre);
  if (previo) {
    creados[archivo] = previo;
    // Con --actualizar, los casos en borrador se reescriben con el contenido del archivo.
    if (ACTUALIZAR && previo.estado === 'BORRADOR') {
      await api('PUT', `/api/docente/casos/${previo.id}`, caso);
      console.log(`~ Actualizado: «${caso.nombre}» (id ${previo.id}).`);
    } else {
      console.log(`= Ya existe: «${caso.nombre}» (id ${previo.id}, ${previo.estado}).`);
    }
    continue;
  }
  const nuevo = await api('POST', '/api/docente/casos', caso);
  creados[archivo] = { id: nuevo.id, nombre: nuevo.nombre, estado: nuevo.estado };
  console.log(`+ Creado: «${nuevo.nombre}» (id ${nuevo.id}).`);
}

for (const archivo of PUBLICAR) {
  const c = creados[archivo];
  if (!c) continue;
  if (c.estado === 'PUBLICADO') { console.log(`= Ya publicado: «${c.nombre}».`); continue; }
  const publicado = await api('POST', `/api/docente/casos/${c.id}/publicar`);
  c.estado = publicado.estado;
  console.log(`✓ Publicado: «${c.nombre}».`);
}

const casoSesion = creados[CON_SESION];
if (casoSesion) {
  const sesiones = await api('GET', '/api/docente/sesiones');
  // Solo se toca la sesión de prueba que crea este script (se reconoce por su mensaje). Las sesiones que
  // programe un docente desde la app no se inician ni se modifican.
  let s = sesiones.find(x => x.casoId === casoSesion.id && x.estado !== 'FINALIZADO' && x.mensaje === MENSAJE_SESION);
  if (!s) {
    const grupos = await api('GET', '/api/docente/grupos');
    const grupo = grupos.find(g => g.estudiantes.some(e => e.email.toLowerCase() === ESTUDIANTE.toLowerCase()));
    if (!grupo) throw new Error(`No hay un grupo del docente con el estudiante ${ESTUDIANTE}.`);
    const caso = JSON.parse(readFileSync(new URL(CON_SESION, carpeta), 'utf8'));
    const ahora = new Date();
    s = await api('POST', '/api/docente/sesiones', {
      casoId: casoSesion.id, grupoId: grupo.id,
      inicio: fechaLocal(ahora), fin: fechaLocal(new Date(ahora.getTime() + DIAS_SESION * 86400000)),
      tiempoMaxMin: caso.tiempoEstimadoMin, toleranciaMin: DIAS_SESION * 24 * 60,
      lugar: 'Aula virtual', mensaje: MENSAJE_SESION
    });
    console.log(`+ Sesión programada para el grupo «${grupo.nombre}».`);
  }
  if (s.estado === 'SIN_INICIAR') {
    s = await api('POST', `/api/docente/sesiones/${s.id}/iniciar`);
    console.log('✓ Sesión iniciada.');
  }
  console.log(`  Código de la sesión: ${s.codigo} · estado ${s.estado} · cierra ${s.fin}`);
}

console.log('\nCasos del docente:');
for (const c of await api('GET', '/api/docente/casos')) console.log(`  ${c.id}  ${c.estado.padEnd(10)} ${c.nombre} (${c.bloques} escenarios, ${c.preguntas} preguntas)`);
