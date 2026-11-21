// Prueba del botón "Música" de la vista previa del docente (app + backend reales).
// Uso: node tools/casos-prueba/probar-musica.mjs [--caso 102] [--salida carpeta] [--real]
// No necesita el archivo real: la prueba sirve un audio de 1 s generado aquí en /audio/Harp.mp3
// (y otra pasada sin archivo, donde el botón no debe aparecer).
import puppeteer from '../medir/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const APP = arg('app', 'http://localhost:4200'), API = arg('api', 'http://localhost:8080'), SALIDA = arg('salida', '.');
const espera = ms => new Promise(r => setTimeout(r, ms));
/** --real: en la pasada con archivo se usa el MP3 verdadero que sirve la app (no el audio generado). */
const REAL = process.argv.includes('--real');

/** WAV de 1 s (tono suave), para no depender de un archivo real. */
function wav() {
  const n = 8000, datos = Buffer.alloc(44 + n * 2);
  datos.write('RIFF', 0); datos.writeUInt32LE(36 + n * 2, 4); datos.write('WAVEfmt ', 8);
  datos.writeUInt32LE(16, 16); datos.writeUInt16LE(1, 20); datos.writeUInt16LE(1, 22);
  datos.writeUInt32LE(8000, 24); datos.writeUInt32LE(16000, 28); datos.writeUInt16LE(2, 32); datos.writeUInt16LE(16, 34);
  datos.write('data', 36); datos.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) datos.writeInt16LE(Math.round(Math.sin(i / 8000 * 2 * Math.PI * 220) * 3000), 44 + i * 2);
  return datos;
}

const ingreso = await (await fetch(`${API}/api/auth/ingresar`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'docente@psicosim.edu', clave: 'docente123', rol: null, codigoAutorizacion: null }) })).json();
const casos = await (await fetch(`${API}/api/docente/casos`, { headers: { Authorization: `Bearer ${ingreso.token}` } })).json();
const caso = casos.find(c => String(c.id) === arg('caso', String(casos[0].id)));

const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
  // Perfil nuevo en cada corrida: no choca con un Chrome de otra prueba que siga abierto.
  userDataDir: mkdtempSync(join(tmpdir(), 'probar-musica-')),
  args: ['--window-size=1366,900', '--autoplay-policy=no-user-gesture-required'] });
const r = { caso: caso.nombre };

async function abrir(conArchivo) {
  const p = await b.newPage();
  await p.setViewport({ width: 1366, height: 900 });
  const errores = []; p.on('pageerror', e => errores.push(e.message));
  await p.setRequestInterception(true);
  p.on('request', q => {
    if (new URL(q.url()).pathname !== '/audio/Harp.mp3') return q.continue();
    if (!conArchivo) return q.respond({ status: 404, contentType: 'text/plain', body: 'no' });
    if (REAL) return q.continue();
    q.respond({ status: 200, contentType: 'audio/wav', body: q.method() === 'HEAD' ? '' : wav() });
  });
  // Registra cada play()/pause() de los elementos de audio (la música no está en el DOM).
  await p.evaluateOnNewDocument(() => {
    window.__audio = [];
    const play = HTMLMediaElement.prototype.play, pause = HTMLMediaElement.prototype.pause;
    HTMLMediaElement.prototype.play = function () { window.__audio.push('play'); window.__ultimo = this; return play.call(this); };
    HTMLMediaElement.prototype.pause = function () { window.__audio.push('pause'); return pause.call(this); };
  });
  await p.goto(`${APP}/ingreso`, { waitUntil: 'networkidle0' });
  await p.evaluate((t, u) => { localStorage.setItem('dilema-token', t); localStorage.setItem('dilema-usuario', JSON.stringify(u)); localStorage.removeItem('dilema-musica'); }, ingreso.token, ingreso.usuario);
  await p.goto(`${APP}/docente/casos/${caso.id}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await p.waitForFunction(n => [...document.querySelectorAll('h1')].some(h => h.textContent.includes(n)), { timeout: 120000 }, caso.nombre);
  await (await p.waitForSelector('xpath/.//button[normalize-space(.)="Vista previa"]')).click();
  await p.waitForSelector('.modal-vista .portada h2', { timeout: 60000 });
  await espera(800);
  return { p, errores };
}

const boton = p => p.evaluate(() => {
  const m = document.querySelector('.modal-vista .musica'), c = document.querySelector('.modal-vista .cerrar');
  if (!m) return null;
  const bm = m.getBoundingClientRect(), bc = c.getBoundingClientRect();
  return { texto: m.textContent.trim(), pressed: m.getAttribute('aria-pressed'), label: m.getAttribute('aria-label'),
    a_la_izquierda_de_cerrar: bm.right <= bc.left, misma_altura: Math.abs(bm.height - bc.height) < 0.5, alto: bm.height,
    mismo_fondo: getComputedStyle(m).backgroundColor === getComputedStyle(c).backgroundColor,
    tachado: !!m.querySelector('path[d^="M13.5 7.5l5 5"]'), sonando: window.__ultimo ? !window.__ultimo.paused : false };
});

try {
  // 1) Sin archivo: no hay botón.
  { const { p, errores } = await abrir(false); r.sin_archivo = { boton: await boton(p), errores }; await p.close(); }
  // 2) Con archivo: activa por defecto, silenciar, volver a activar, cerrar la vista previa.
  const { p, errores } = await abrir(true);
  r.al_abrir = await boton(p);
  r.archivo = await p.evaluate(() => window.__ultimo ? { src: window.__ultimo.currentSrc, duracion_s: Math.round(window.__ultimo.duration), loop: window.__ultimo.loop, volumen: window.__ultimo.volume } : null);
  await (await p.$('.modal-vista .cabeza, .modal-vista .modal-cabeza')).screenshot({ path: `${SALIDA}/musica-activa.png` });
  await (await p.$('.modal-vista .musica')).click(); await espera(200);
  r.silenciada = await boton(p);
  await (await p.$('.modal-vista .modal-cabeza')).screenshot({ path: `${SALIDA}/musica-silenciada.png` });
  r.preferencia_guardada = await p.evaluate(() => localStorage.getItem('dilema-musica'));
  await (await p.$('.modal-vista .musica')).click(); await espera(200);
  r.reactivada = await boton(p);
  await (await p.$('.modal-vista .cerrar')).click(); await espera(200);
  r.al_cerrar_sonando = await p.evaluate(() => window.__ultimo ? !window.__ultimo.paused : false);
  r.secuencia_audio = await p.evaluate(() => window.__audio);
  r.errores = errores;
  console.log(JSON.stringify(r, null, 1));
} catch (e) { console.error('FALLÓ:', e.message, JSON.stringify(r, null, 1)); process.exitCode = 1; }
finally { await b.close().catch(() => {}); }
