// Prueba de principio a fin de la novela del ESTUDIANTE (app + backend reales, sesión de prueba).
// Uso: node tools/casos-prueba/probar-estudiante.mjs --codigo DL-XXXX [--estudiante estudiante@psicosim.edu] [--salida carpeta]
//
// Recorrido: briefing (portada y presentación, sin reloj) → aceptar reglas → "Iniciar simulación" → escenario 1
// (responde) → escenario 2 (responde) → vuelve atrás y cambia una respuesta → "Ver narración otra vez" →
// "Deshacer" → finaliza → resultados → vuelve al panel y entra a "Ver resultados".
// Revisa además que durante el caso ninguna respuesta del backend traiga la opción correcta ni explicaciones.
import puppeteer from '../medir/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const APP = arg('app', 'http://localhost:4200'), API = arg('api', 'http://localhost:8080'), SALIDA = arg('salida', '.');
const CODIGO = arg('codigo'), ESTUDIANTE = arg('estudiante', 'estudiante@psicosim.edu');
if (!CODIGO) throw new Error('Falta --codigo (el de la sesión de prueba).');
const espera = ms => new Promise(r => setTimeout(r, ms));
const r = { pasos: [] };
const anotar = t => { r.pasos.push(t); console.error('·', t); };

const ingreso = await (await fetch(`${API}/api/auth/ingresar`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: ESTUDIANTE, clave: null, rol: 'ESTUDIANTE', codigoAutorizacion: CODIGO }) })).json();
if (!ingreso.token) throw new Error('No pude entrar como estudiante: ' + JSON.stringify(ingreso));

const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
  userDataDir: mkdtempSync(join(tmpdir(), 'probar-estudiante-')), args: ['--window-size=1366,900', '--ignore-gpu-blocklist'] });
try {
  const p = await b.newPage();
  await p.setViewport({ width: 1366, height: 900 });
  const errores = []; p.on('pageerror', e => errores.push(e.message));
  // Ninguna respuesta del backend con el intento EN_CURSO puede traer la correcta ni explicaciones.
  r.fugas_durante_el_caso = [];
  let respuestasRevisadas = 0;
  p.on('response', async res => {
    const u = new URL(res.url());
    if (!u.pathname.startsWith('/api/participaciones') && !u.pathname.startsWith('/api/estudiante/sesiones')) return;
    try {
      const d = await res.json();
      if (d?.estado !== 'EN_CURSO') return;
      respuestasRevisadas++;
      for (const q of d.preguntas ?? []) for (const o of q.opciones ?? []) {
        if (o.correcta != null || o.explicacion || o.fundamento) r.fugas_durante_el_caso.push(`${u.pathname} pregunta ${q.id} opción ${o.id}`);
      }
    } catch { /* no era JSON */ }
  });
  await p.evaluateOnNewDocument(() => {
    window.__ultimo = null;
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () { window.__ultimo = this; return play.call(this); };
  });
  const sonando = () => p.evaluate(() => !!window.__ultimo && !window.__ultimo.paused);

  await p.goto(`${APP}/ingreso`, { waitUntil: 'networkidle0' });
  await p.evaluate((t, u) => { localStorage.setItem('dilema-token', t); localStorage.setItem('dilema-usuario', JSON.stringify(u)); }, ingreso.token, ingreso.usuario);

  // ---------------------------------------------------------------- briefing
  const t0 = Date.now();
  await p.goto(`${APP}/estudiante/sesion/${ingreso.sesionId}`, { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('.novela-briefing .portada h2', { timeout: 60000 });
  r.briefing_portada_ms = Date.now() - t0;
  r.briefing_portada = await p.$eval('.novela-briefing .portada h2', e => e.textContent.trim());
  r.reglas_y_boton = await p.evaluate(() => ({
    casilla: !!document.querySelector('label.check input[type=checkbox]'),
    iniciar: [...document.querySelectorAll('button')].some(x => /Iniciar simulación|Iniciar nuevo intento/.test(x.textContent)),
    imagen_colinas: !!document.querySelector('img[src*="colinas"]')
  }));
  const principal = sel => p.$(`${sel} .controles .principal`);
  // Presentación: avanzar hasta el final.
  let fotoPresentacion = false;
  for (let k = 0; k < 60; k++) {
    const e = await p.evaluate(() => {
      const n = document.querySelector('.novela-briefing');
      return { boton: n.querySelector('.controles .principal')?.textContent.trim(), fin: n.querySelector('.portada h2')?.textContent.trim() ?? null,
        dialogo: !!n.querySelector('.dialogo'), cargando: !!n.querySelector('app-escena-novela .aviso') };
    });
    if (e.fin === 'Fin de la presentación') break;
    if (e.dialogo && !fotoPresentacion) {
      await p.waitForFunction(() => !document.querySelector('.novela-briefing app-escena-novela .aviso'), { timeout: 90000 }).catch(() => {});
      r.briefing_primera_escena_ms = Date.now() - t0;
      await espera(1200);
      const caja = await p.$('.novela-briefing');
      await caja.screenshot({ path: `${SALIDA}/est-1-briefing.png` });
      fotoPresentacion = true;
    }
    await (await principal('.novela-briefing')).click(); await espera(e.boton === 'Completar' ? 80 : 250);
  }
  r.briefing_fin = await p.$eval('.novela-briefing .portada h2', e => e.textContent.trim()).catch(() => null);
  r.briefing_sin_reloj = !(await p.$('.reloj-juego'));
  await p.screenshot({ path: `${SALIDA}/est-1b-briefing-pagina.png`, fullPage: true });

  await p.click('label.check input[type=checkbox]');
  const t1 = Date.now();
  await (await p.waitForSelector('xpath/.//button[contains(., "Iniciar simulación") or contains(., "Iniciar nuevo intento")]')).click();
  await p.waitForSelector('app-novela-reproductor .letrero, app-novela-reproductor .pregunta', { timeout: 60000 });
  r.simulacion_transicion_ms = Date.now() - t1;
  anotar('inició la simulación');
  r.musica_antes_del_primer_clic = await sonando();

  // ---------------------------------------------------------------- simulación
  const leer = () => p.evaluate(() => {
    const n = document.querySelector('app-novela-reproductor');
    const opciones = [...(n?.querySelectorAll('.pregunta .opcion') ?? [])];
    return {
      titulo: document.querySelector('.barra-juego h2')?.textContent.trim(),
      reloj: document.querySelector('.reloj-juego')?.textContent.trim(),
      musica: !!document.querySelector('.barra-juego .musica'),
      letrero: n?.querySelector('.letrero')?.textContent.trim() ?? null,
      dialogo: n?.querySelector('.dialogo')?.textContent.trim().slice(0, 50) ?? null,
      pregunta: n?.querySelector('.pregunta .enunciado')?.textContent.trim() ?? null,
      elegida: opciones.findIndex(o => o.classList.contains('elegida')),
      verNarracion: [...(n?.querySelectorAll('.acciones-pregunta button') ?? [])].some(x => x.textContent.includes('Ver narración')),
      boton: n?.querySelector('.controles .principal')?.textContent.trim(),
      anteriorDeshabilitado: n?.querySelector('.controles button')?.disabled ?? null,
      fin: n?.querySelector('.portada h2')?.textContent.trim() ?? null,
      resultados: !!document.querySelector('.resultados-estudiante'),
      cargando: !!n?.querySelector('app-escena-novela .aviso'),
      textoPregunta: n?.querySelector('.pregunta')?.innerText ?? ''
    };
  });
  const clic = async (texto) => {
    const boton = await p.waitForSelector(`xpath/.//app-novela-reproductor//button[normalize-space(.)="${texto}"]`, { timeout: 10000 });
    await boton.click();
  };
  const siguiente = async () => { await (await principal('app-novela-reproductor')).click(); };
  /** Avanza hasta la próxima pregunta (o la pantalla final), completando el texto. */
  const hastaPregunta = async () => {
    for (let k = 0; k < 80; k++) {
      const e = await leer();
      if (e.pregunta || e.fin || e.resultados) return e;
      await siguiente(); await espera(e.boton === 'Completar' ? 80 : 200);
    }
    throw new Error('No llegué a una pregunta');
  };
  const responder = async (i) => {
    const antes = await leer();
    await (await p.$$('app-novela-reproductor .pregunta .opcion'))[i].click();
    await p.waitForFunction(i => [...document.querySelectorAll('app-novela-reproductor .pregunta .opcion')][i]?.classList.contains('elegida'), { timeout: 10000 }, i);
    if (/correcta|incorrecta|acierto|fallo|fundamento/i.test((await leer()).textoPregunta)) r.revela_durante_el_caso = (await leer()).textoPregunta;
    anotar(`${antes.titulo} · «${antes.pregunta?.slice(0, 40)}» → opción ${'ABCD'[i]}`);
  };

  // Escenario 1: espera los personajes y toma la foto de la escena.
  let e = await leer();
  while (!e.dialogo) { await espera(150); e = await leer(); if (e.pregunta) break; }
  await p.waitForFunction(() => !document.querySelector('app-novela-reproductor app-escena-novela .aviso'), { timeout: 90000 }).catch(() => {});
  r.simulacion_personajes_ms = Date.now() - t1;
  r.barra = { titulo: e.titulo, reloj: e.reloj, musica: e.musica };
  // Primer clic en la página: ahora sí puede sonar la música.
  await p.mouse.click(5, 5); await espera(1500);
  r.musica_despues_del_primer_clic = await sonando();
  await espera(800);
  await p.screenshot({ path: `${SALIDA}/est-2-escena.png` });

  // Escenario 1: A (incorrecta), B, D.
  await hastaPregunta(); await responder(0); await siguiente(); await espera(200);
  await hastaPregunta(); await responder(1); await siguiente(); await espera(200);
  await hastaPregunta(); await responder(3); await siguiente(); await espera(300);
  // Escenario 2: Q1 B.
  e = await hastaPregunta();
  r.escenario2_titulo = e.titulo;
  await responder(1);

  // Volver atrás: desde la primera pregunta del escenario 2 (ya respondido) "Anterior" salta su narración.
  const recorrido = [];
  for (let k = 0; k < 6; k++) {
    const antes = await leer();
    if (antes.anteriorDeshabilitado) { recorrido.push('Anterior deshabilitado'); break; }
    await clic('Anterior'); await espera(250);
    const d = await leer();
    recorrido.push(d.pregunta ? `pregunta: ${d.titulo} · ${d.pregunta.slice(0, 30)}` : d.letrero ? `transición ${d.letrero}` : d.dialogo ? `narración: ${d.dialogo}` : 'otro');
  }
  r.atras = recorrido;
  // Ahora en la primera pregunta del escenario 1: cambiar la respuesta A → B.
  e = await leer();
  r.cambio_en = `${e.titulo} · ${e.pregunta?.slice(0, 40)} (antes: ${'ABCD'[e.elegida]})`;
  await responder(1);
  r.boton_ver_narracion = e.verNarracion;
  await p.screenshot({ path: `${SALIDA}/est-3-pregunta.png` });
  // "Ver narración otra vez": vuelve a la transición del escenario 1 y su narración, y luego a la pregunta.
  await clic('Ver narración otra vez'); await espera(300);
  const releida = [];
  for (let k = 0; k < 40; k++) {
    const d = await leer();
    releida.push(d.pregunta ? 'pregunta' : d.letrero ? 'transición' : d.dialogo ? 'narración' : 'otro');
    if (d.pregunta) break;
    await siguiente(); await espera(d.boton === 'Completar' ? 80 : 200);
  }
  r.ver_narracion = [...new Set(releida)];
  // Hacia adelante: al pasar al escenario 2 (ya respondido) va directo a su pregunta.
  await siguiente(); await espera(200); await siguiente(); await espera(200); await siguiente(); await espera(300);
  e = await leer();
  r.adelante_a_escenario_respondido = e.pregunta ? `directo a la pregunta (${e.titulo})` : `pasó por ${e.letrero ? 'transición' : e.dialogo ? 'narración' : 'otro'}`;
  e = await hastaPregunta();
  // Escenario 2: Q2 A, deshacer, luego B (incorrecta). Q3 sin responder.
  await siguiente(); await espera(200);
  e = await hastaPregunta();
  await responder(0);
  await clic('Deshacer última respuesta');
  await p.waitForFunction(() => ![...document.querySelectorAll('app-novela-reproductor .pregunta .opcion')].some(o => o.classList.contains('elegida')), { timeout: 10000 })
    .then(() => { r.deshacer = 'quitó la respuesta'; }).catch(() => { r.deshacer = 'NO quitó la respuesta'; });
  await responder(1);
  await siguiente(); await espera(200);
  e = await hastaPregunta();
  r.boton_ultima_pregunta = e.boton;
  // Finalizar.
  await siguiente();
  await p.waitForSelector('.resultados-estudiante .rn-resumen', { timeout: 30000 });
  await espera(1500);
  r.musica_en_resultados = await sonando();
  r.resultados = await p.evaluate(() => {
    const m = document.querySelector('.resultados-estudiante');
    const t = x => x?.innerText.replace(/\s+/g, ' ').trim();
    return {
      tarjetas: [...m.querySelectorAll('.rn-resumen .rn-tarjeta')].map(t),
      criterios: [...m.querySelectorAll('.rn-criterio')].map(t),
      filtros: [...m.querySelectorAll('.rn-filtros button')].map(t),
      escenas: [...m.querySelectorAll('.rn-escena')].map(t),
      comentario: t(m.querySelector('.rn-comentario')),
      botones: [...m.querySelectorAll('.rn-acciones button')].map(t),
      fondo: getComputedStyle(m).backgroundImage.slice(0, 90)
    };
  });
  await p.screenshot({ path: `${SALIDA}/est-4-resultados.png` });
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2)); await espera(300);
  await p.screenshot({ path: `${SALIDA}/est-4b-resultados.png` });
  r.respuestas_revisadas_en_curso = respuestasRevisadas;

  // "Volver al panel" y entrar de nuevo por "Ver resultados".
  const url = p.url();
  await (await p.waitForSelector('xpath/.//div[contains(@class,"rn-acciones")]/button[normalize-space(.)="Volver al panel"]')).click();
  await p.waitForFunction(() => location.pathname === '/estudiante', { timeout: 10000 });
  await p.goto(url, { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('.resultados-estudiante .rn-resumen', { timeout: 30000 });
  r.ver_resultados_de_nuevo = await p.$eval('.resultados-estudiante .rn-resumen', x => x.innerText.replace(/\s+/g, ' ').trim());
  r.errores = errores;
} catch (e) { r.fallo = e.message; process.exitCode = 1; }
finally { await b.close().catch(() => {}); }
console.log(JSON.stringify(r, null, 1));
