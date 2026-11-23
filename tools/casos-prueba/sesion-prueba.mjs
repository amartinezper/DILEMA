// Sesión de PRUEBA para recorrer la novela como estudiante, sin tocar las sesiones reales.
//
// Uso (desde la raíz del proyecto, con el backend corriendo):
//   node tools/casos-prueba/sesion-prueba.mjs --caso 102            (la crea o reutiliza y la inicia)
//   node tools/casos-prueba/sesion-prueba.mjs --caso 102 --cerrar   (la finaliza al terminar las pruebas)
//
// Qué hace:
//   1. Inicia sesión como docente.
//   2. Si el caso está en borrador, lo publica (el backend solo programa sesiones de casos publicados).
//   3. Usa un grupo propio, «Grupo de prueba · novela del estudiante», solo con el estudiante de práctica, para que
//      las convocatorias no lleguen a nadie más.
//   4. Programa e inicia una sesión de ese caso para ese grupo. Se reconoce por su mensaje, que empieza con
//      «[PRUEBA]»: el script nunca inicia, finaliza ni cambia una sesión que no tenga esa marca.
// No hay forma de borrar sesiones por la API: al terminar, --cerrar la deja FINALIZADA y marcada como prueba.
// Solo usa la API: no toca la base de datos directamente.

const arg = (nombre, defecto) => { const i = process.argv.indexOf(`--${nombre}`); return i > 0 ? process.argv[i + 1] : defecto; };
const BASE = arg('base', 'http://localhost:8080');
const EMAIL = arg('email', 'docente@psicosim.edu');
const CLAVE = arg('clave', 'docente123');
const ESTUDIANTE = arg('estudiante', 'estudiante@psicosim.edu');
const CASO = Number(arg('caso', '102'));
const CERRAR = process.argv.includes('--cerrar');
const GRUPO = 'Grupo de prueba · novela del estudiante';
/** Marca de la sesión de prueba (así se distingue de las reales). */
const MARCA = '[PRUEBA]';
const MENSAJE = `${MARCA} Sesión de prueba de la novela del estudiante. Se puede ignorar.`;

let token = '';
async function api(metodo, ruta, cuerpo) {
  const r = await fetch(BASE + ruta, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo)
  });
  const texto = await r.text();
  let dato = null;
  try { dato = texto ? JSON.parse(texto) : null; } catch { dato = texto; }
  if (!r.ok) throw new Error(`${metodo} ${ruta} → ${r.status}: ${dato?.mensaje ?? texto}`);
  return dato;
}
const fechaLocal = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

token = (await api('POST', '/api/auth/ingresar', { email: EMAIL, clave: CLAVE, rol: null, codigoAutorizacion: null })).token;

const caso = await api('GET', `/api/docente/casos/${CASO}`);
const sesiones = await api('GET', '/api/docente/sesiones');
const propia = sesiones.find(s => s.casoId === CASO && (s.mensaje ?? '').startsWith(MARCA) && s.estado !== 'FINALIZADO');

if (CERRAR) {
  if (!propia) { console.log('No hay una sesión de prueba abierta de ese caso.'); process.exit(0); }
  const fin = await api('POST', `/api/docente/sesiones/${propia.id}/finalizar`);
  console.log(`✓ Sesión de prueba ${fin.codigo} (id ${fin.id}) finalizada. Queda marcada como ${MARCA}.`);
  process.exit(0);
}

if (caso.estado !== 'PUBLICADO') {
  await api('POST', `/api/docente/casos/${CASO}/publicar`);
  console.log(`✓ Publicado: «${caso.nombre}» (id ${CASO}).`);
}

let grupos = await api('GET', '/api/docente/grupos');
let grupo = grupos.find(g => g.nombre === GRUPO);
if (!grupo) {
  grupo = await api('POST', '/api/docente/grupos', { nombre: GRUPO, espacioAcademico: '2026-II' });
  console.log(`+ Grupo de prueba creado (id ${grupo.id}).`);
}
if (!grupo.estudiantes?.some(e => e.email.toLowerCase() === ESTUDIANTE.toLowerCase())) {
  grupo = await api('POST', `/api/docente/grupos/${grupo.id}/estudiantes`, { nombre: 'Estudiante de práctica', email: ESTUDIANTE });
  console.log(`+ ${ESTUDIANTE} agregado al grupo de prueba.`);
}
const otros = (grupo.estudiantes ?? []).filter(e => e.email.toLowerCase() !== ESTUDIANTE.toLowerCase());
if (otros.length) throw new Error(`El grupo de prueba tiene a otras personas (${otros.map(e => e.email).join(', ')}); no sigo.`);

let s = propia;
if (!s) {
  const ahora = new Date();
  s = await api('POST', '/api/docente/sesiones', {
    casoId: CASO, grupoId: grupo.id,
    inicio: fechaLocal(ahora), fin: fechaLocal(new Date(ahora.getTime() + 86400000)),
    tiempoMaxMin: caso.tiempoEstimadoMin ?? 30, toleranciaMin: 24 * 60,
    lugar: 'Prueba', mensaje: MENSAJE
  });
  console.log(`+ Sesión de prueba programada (id ${s.id}).`);
}
if (s.estado === 'SIN_INICIAR') {
  s = await api('POST', `/api/docente/sesiones/${s.id}/iniciar`);
  console.log('✓ Sesión de prueba iniciada.');
}
console.log(JSON.stringify({ id: s.id, codigo: s.codigo, estado: s.estado, caso: s.caso, grupo: grupo.nombre, estudiante: ESTUDIANTE }));
