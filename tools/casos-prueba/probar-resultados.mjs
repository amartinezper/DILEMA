// Prueba de principio a fin de la vista previa del docente hasta la pantalla de resultados (app + backend reales).
// Uso: node tools/casos-prueba/probar-resultados.mjs [--caso 97] [--salida carpeta]
//   Responde bien la primera pregunta, mal la segunda y deja sin responder las demás.
import puppeteer from '../medir/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const APP = arg('app', 'http://localhost:4200'), API = arg('api', 'http://localhost:8080'), SALIDA = arg('salida', '.');
const espera = ms => new Promise(r => setTimeout(r, ms));
const ingreso = await (await fetch(`${API}/api/auth/ingresar`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'docente@psicosim.edu', clave: 'docente123', rol: null, codigoAutorizacion: null }) })).json();
const casos = await (await fetch(`${API}/api/docente/casos`, { headers: { Authorization: `Bearer ${ingreso.token}` } })).json();
const caso = casos.find(c => String(c.id) === arg('caso', String(casos.find(x => x.nombre.startsWith('Santiago'))?.id)));
const detalle = await (await fetch(`${API}/api/docente/casos/${caso.id}`, { headers: { Authorization: `Bearer ${ingreso.token}` } })).json();

const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
  args: ['--window-size=1366,900', '--ignore-gpu-blocklist'] });
const r = { caso: caso.nombre };
try {
  const p = await b.newPage();
  await p.setViewport({ width: 1366, height: 900 });
  const errores = []; p.on('pageerror', e => errores.push(e.message));
  let registrar = false; const pedidos = [];
  p.on('request', q => { if (registrar && new URL(q.url()).pathname.startsWith('/api/')) pedidos.push(`${q.method()} ${new URL(q.url()).pathname}`); });
  await p.goto(`${APP}/ingreso`, { waitUntil: 'networkidle0' });
  await p.evaluate((t, u) => { localStorage.setItem('dilema-token', t); localStorage.setItem('dilema-usuario', JSON.stringify(u)); }, ingreso.token, ingreso.usuario);
  await p.goto(`${APP}/docente/casos/${caso.id}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await p.waitForFunction(n => [...document.querySelectorAll('h1')].some(h => h.textContent.includes(n)), { timeout: 120000 }, caso.nombre);

  registrar = true;
  await (await p.waitForSelector('xpath/.//button[normalize-space(.)="Vista previa"]')).click();
  await p.waitForSelector('.modal-vista .portada h2', { timeout: 60000 });
  r.cabecera = await p.$eval('.modal-vista .modal-cabeza', e => e.innerText.trim());
  r.controles = await p.$$eval('.modal-vista .controles button', l => l.map(x => x.textContent.trim()));
  r.hay_selectores = await p.$$eval('.modal-vista select, .modal-vista input[type=checkbox]', l => l.length);

  const principal = () => p.$('xpath/.//div[contains(@class,"controles")]/button[contains(@class,"principal")]');
  const leer = () => p.evaluate(() => {
    const m = document.querySelector('.modal-vista');
    const d = m.querySelector('.dialogo'), n = m.querySelector('.novela');
    return {
      boton: m.querySelector('.controles .principal')?.textContent?.trim(),
      pregunta: m.querySelector('.pregunta .enunciado')?.textContent?.trim() ?? null,
      resultados: !!m.querySelector('.resultados'),
      dialogo: d ? { nombre: d.querySelector('.nombre')?.textContent?.trim() ?? null, alto: d.getBoundingClientRect().height / n.getBoundingClientRect().height,
        arriba: (d.getBoundingClientRect().top - n.getBoundingClientRect().top) / n.getBoundingClientRect().height } : null,
      textoPanel: m.querySelector('.pregunta')?.innerText ?? '',
      letrero: m.querySelector('.letrero')?.textContent?.trim() ?? null
    };
  });
  let respondidas = 0, fotoDialogo = false, fotoPregunta = false, dialogos = [], escena = 0, fotoEscena = -1;
  for (let k = 0; k < 150; k++) {
    const e = await leer();
    if (e.resultados) break;
    if (e.boton === 'Completar') { await (await principal()).click(); await espera(60); continue; }
    if (e.dialogo) dialogos.push(e.dialogo);
    if (e.letrero) escena++;
    // Una foto de la primera narración o diálogo de cada escenario (con los personajes ya cargados).
    if (e.dialogo && escena > 0 && fotoEscena !== escena) {
      await p.waitForFunction(() => !document.querySelector('.modal-vista app-escena-novela .aviso'), { timeout: 90000 }).catch(() => {});
      await espera(1500);
      await (await p.$('.modal-vista')).screenshot({ path: `${SALIDA}/res-escena-${escena}.png` });
      fotoEscena = escena;
    }
    if (e.dialogo?.nombre && !fotoDialogo) {
      await p.waitForFunction(() => !document.querySelector('.modal-vista app-escena-novela .aviso'), { timeout: 90000 }).catch(() => {});
      await espera(1200);
      await (await p.$('.modal-vista')).screenshot({ path: `${SALIDA}/res-1-dialogo.png` });
      fotoDialogo = true;
    }
    if (e.pregunta) {
      const opciones = await p.$$('.modal-vista .pregunta .opcion');
      // Pregunta 1: la correcta; pregunta 2: una incorrecta; las demás sin responder.
      const q = detalle.bloques.flatMap(bl => bl.preguntas)[respondidas];
      if (respondidas === 0) await opciones[q.opciones.findIndex(o => o.correcta)].click();
      if (respondidas === 1) await opciones[q.opciones.findIndex(o => !o.correcta)].click();
      await espera(200);
      const despues = await leer();
      // Durante el caso no debe aparecer si es correcta ni retroalimentación.
      if (/correcta|incorrecta|acierto|fallo|fundamento|por qué/i.test(despues.textoPanel)) r.revela_durante_el_caso = despues.textoPanel;
      if (!fotoPregunta && respondidas === 1) { await (await p.$('.modal-vista')).screenshot({ path: `${SALIDA}/res-2-pregunta.png` }); fotoPregunta = true; }
      respondidas++;
      r.boton_ultima_pregunta = despues.boton;
    }
    await (await principal()).click(); await espera(150);
  }
  await p.waitForSelector('.modal-vista .resultados', { timeout: 30000 });
  await espera(800);
  r.resultados = await p.evaluate(() => {
    const m = document.querySelector('.modal-vista .resultados');
    const t = e => e?.innerText.replace(/\s+/g, ' ').trim();
    return {
      encabezado: t(m.querySelector('header')),
      tarjetas: [...m.querySelectorAll('.rn-resumen .rn-tarjeta')].map(t),
      criterios: [...m.querySelectorAll('.rn-criterio')].map(t),
      filtros: [...m.querySelectorAll('.rn-filtros button')].map(t),
      escenas: [...m.querySelectorAll('.rn-escena')].map(t),
      filas: [...m.querySelectorAll('.rn-fila')].map(li => ({ abierta: li.classList.contains('rn-abierta'), texto: t(li).slice(0, 160) })),
      comentario: t(m.querySelector('.rn-comentario')),
      botones: [...m.querySelectorAll('.rn-acciones button')].map(t),
      controles_visibles: !document.querySelector('.modal-vista .controles')?.classList.contains('oculto'),
      fondo: document.querySelector('.modal-vista img.fondo.entra')?.getAttribute('src')
    };
  });
  // Capturas bajando por la pantalla de resultados.
  const alto = await p.$eval('.modal-vista .resultados', e => [e.scrollHeight, e.clientHeight]);
  for (let k = 0, y = 0; y < alto[0] && k < 5; k++, y += alto[1] - 60) {
    await p.$eval('.modal-vista .resultados', (e, y) => { e.scrollTop = y; }, y);
    await espera(250);
    await (await p.$('.modal-vista')).screenshot({ path: `${SALIDA}/res-3-resultados-${k + 1}.png` });
  }
  // Filtro "Fallos": solo deben quedar los fallos.
  await (await p.waitForSelector('xpath/.//div[contains(@class,"rn-filtros")]/button[starts-with(normalize-space(.),"Fallos")]')).click();
  await espera(200);
  r.filtro_fallos = await p.$$eval('.modal-vista .rn-fila .rn-icono', l => l.map(i => i.classList.contains('rn-mal') ? 'fallo' : 'otro'));
  // Plegar y desplegar una fila.
  await (await p.$('.modal-vista .rn-fila-cabeza')).click(); await espera(150);
  r.plegar = await p.$eval('.modal-vista .rn-fila-cabeza', b => b.getAttribute('aria-expanded'));
  r.dialogo_alto_max = Math.max(...dialogos.map(d => d.alto)).toFixed(3);
  r.dialogo_borde_superior_min = Math.min(...dialogos.map(d => d.arriba)).toFixed(3);
  r.preguntas_respondidas = respondidas;

  await p.$eval('.modal-vista .resultados', e => { e.scrollTop = e.scrollHeight; });
  await (await p.waitForSelector('xpath/.//div[contains(@class,"rn-acciones")]/button[normalize-space(.)="Volver a empezar"]')).click();
  await espera(500);
  r.volver_a_empezar = await p.$eval('.modal-vista .portada h2', e => e.textContent.trim()).catch(() => 'no volvió a la portada');
  r.pedidos_api_en_vista_previa = [...pedidos];
  await (await p.waitForSelector('xpath/.//header//button[normalize-space(.)="Cerrar"]')).click();
  await espera(300);
  r.modal_cerrado = !(await p.$('.modal-vista'));
  r.errores = errores;
  console.log(JSON.stringify(r, null, 1));
} catch (e) { console.error('FALLÓ:', e.message, JSON.stringify(r, null, 1)); process.exitCode = 1; }
finally { await b.close().catch(() => {}); }
