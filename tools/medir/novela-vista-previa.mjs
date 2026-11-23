// Prueba de la vista previa del docente (Chrome temporal, sesión de prueba y API simulada).
// Uso: node novela-vista-previa.mjs <url-base> <carpeta-salida>
import puppeteer from 'puppeteer-core';
import { casoEjemplo } from './caso-ejemplo.mjs';
const [base = 'http://localhost:4300', salida = '.'] = process.argv.slice(2);
const espera = ms => new Promise(r => setTimeout(r, ms));
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
  args: ['--window-size=1366,900', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const r = {};
try {
  const p = await b.newPage();
  await p.setViewport({ width: 1366, height: 900 });
  if (process.argv[4] === 'reducido') await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  const errores = [];
  p.on('pageerror', e => errores.push(e.message));
  let registrar = false;
  const pedidosApi = [];
  await p.setRequestInterception(true);
  p.on('request', q => {
    const u = new URL(q.url());
    if (!u.pathname.startsWith('/api/')) return q.continue();
    if (registrar) pedidosApi.push(`${q.method()} ${u.pathname}`);
    q.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(u.pathname === '/api/docente/casos/777' ? casoEjemplo : []) });
  });
  await p.goto(base + '/ingreso', { waitUntil: 'networkidle0' });
  await p.evaluate(() => {
    localStorage.setItem('dilema-token', 'prueba');
    localStorage.setItem('dilema-usuario', JSON.stringify({ id: 1, nombre: 'Docente Prueba', email: 'd@x', rol: 'PROFESOR', permisos: ['EDITAR'] }));
  });
  await p.goto(base + '/docente/casos/777', { waitUntil: 'networkidle0' });

  // 1) Abrir la vista previa y medir cuánto tarda en empezar.
  registrar = true;
  const t0 = Date.now();
  await (await p.waitForSelector('xpath/.//button[normalize-space(.)="Vista previa"]')).click();
  await p.waitForSelector('.modal-vista .portada h2', { timeout: 60000 });
  r.portada_ms = Date.now() - t0;
  await p.waitForFunction(() => { const i = document.querySelector('.modal-vista img.fondo.entra'); return i && i.complete && i.naturalWidth > 0; }, { timeout: 60000 });
  r.fondo_ms = Date.now() - t0;
  r.letrero = await p.$eval('.letrero-vista', e => e.textContent.trim());
  r.foco_en_reproductor = await p.evaluate(() => document.activeElement?.classList.contains('reproductor'));
  await espera(600);
  await (await p.$('.modal-vista')).screenshot({ path: `${salida}/vp-1-portada.png` });

  // 2) Teclado: Enter avanza a la presentación; los personajes entran con fundido.
  const t1 = Date.now();
  await p.keyboard.press('Enter');
  await p.waitForFunction(() => document.querySelector('.modal-vista .dialogo p')?.textContent?.length > 0, { timeout: 30000 });
  await p.waitForFunction(() => !document.querySelector('.modal-vista app-escena-novela .aviso'), { timeout: 120000 });
  r.personajes_ms = Date.now() - t1;
  await espera(2500);
  r.aria_live = await p.$eval('.modal-vista .solo-lector', e => e.textContent.trim());
  await (await p.$('.modal-vista')).screenshot({ path: `${salida}/vp-2-narracion.png` });

  // Herramienta: saltar a un tipo de paso (como hacer clic varias veces en Siguiente).
  const irA = async (tipo, n = 0) => p.evaluate((t, k) => {
    const c = window.ng.getComponent(document.querySelector('app-novela-reproductor'));
    const i = c.pasos().map((x, j) => x.tipo === t ? j : -1).filter(j => j >= 0)[k];
    c.ir(i); return i;
  }, tipo, n);

  // 3) Diálogo: nombre en el cuadro, quien habla iluminado y boca moviéndose mientras se escribe.
  // Enter mientras escribe: completa la frase (y no pasa a la siguiente).
  await irA('dialogo', 0);
  await p.focus('.modal-vista .reproductor');
  await espera(150);
  const indiceDialogo = await p.evaluate(() => window.ng.getComponent(document.querySelector('app-novela-reproductor')).indice());
  await p.keyboard.press('Enter');
  r.completa_con_enter = await p.evaluate((i) => {
    const c = window.ng.getComponent(document.querySelector('app-novela-reproductor'));
    return c.escribiendo() === false && c.indice() === i && c.textoVisible() === c.paso().texto;
  }, indiceDialogo);
  await irA('dialogo', 0);
  // Boca: visemas que aparecen mientras se escribe (muestreo cada 40 ms).
  r.visemas = await p.evaluate(async () => {
    const c = window.ng.getComponent(document.querySelector('app-novela-reproductor'));
    const vistos = [];
    for (let k = 0; k < 15; k++) { vistos.push(c.boca()?.visema ?? '-'); await new Promise(res => setTimeout(res, 40)); }
    return vistos.join(' ');
  });
  await espera(400);
  r.dialogo = await p.evaluate(() => ({ nombre: document.querySelector('.modal-vista .dialogo .nombre')?.textContent,
    texto: document.querySelector('.modal-vista .dialogo p')?.textContent }));
  await (await p.$('.modal-vista')).screenshot({ path: `${salida}/vp-3-dialogo.png` });

  // 4) Transición de escenario.
  await irA('transicion', 0);
  await espera(700);
  r.transicion = await p.$eval('.modal-vista .letrero', e => e.textContent.trim());
  await (await p.$('.modal-vista')).screenshot({ path: `${salida}/vp-4-transicion.png` });
  await espera(3500);

  // 5) Pregunta con "Mostrar respuesta correcta" y elección de opción (sin peticiones al backend).
  await irA('pregunta', 0);
  await espera(400);
  r.opciones_sin_marcar = await p.$$eval('.modal-vista .opcion.correcta', l => l.length);
  await p.click('.modal-vista .interruptor input');
  await p.click('.modal-vista .opcion:nth-child(2)');
  await espera(400);
  r.pregunta = await p.evaluate(() => ({
    correctas_marcadas: document.querySelectorAll('.modal-vista .opcion.correcta').length,
    elegida: document.querySelector('.modal-vista .opcion.elegida span')?.textContent,
    explicacion: document.querySelector('.modal-vista .explicacion')?.textContent?.trim()
  }));
  await (await p.$('.modal-vista')).screenshot({ path: `${salida}/vp-5-pregunta.png` });

  // 6) "Empezar desde": Escenario 2.
  await p.select('.modal-vista .modal-cabeza select', '1');
  await espera(800);
  r.empezar_desde_escenario2 = await p.$eval('.modal-vista .letrero', e => e.textContent.trim()).catch(() => null);

  // 7) Historial.
  await (await p.waitForSelector('xpath/.//div[contains(@class,"controles")]/button[normalize-space(.)="Historial"]')).click();
  r.historial_lineas = await p.$$eval('.modal-vista .historial p', l => l.length);

  r.pedidos_api_en_vista_previa = [...pedidosApi];
  // 8) Esc cierra y vuelve al editor sin perder nada.
  await p.focus('.modal-vista .reproductor');
  await p.keyboard.press('Escape');
  await espera(300);
  r.modal_cerrado = !(await p.$('.modal-vista'));
  r.nombre_editor = await p.$eval('h1', e => e.textContent.trim());

  // 9) Insertar diálogo en el contexto del escenario 1 (textarea) y en el desarrollo (editor enriquecido).
  await (await p.waitForSelector('xpath/.//button[normalize-space(.)="Escenas y contexto"]')).click();
  await p.waitForSelector('textarea');
  await p.evaluate(() => { const t = document.querySelector('textarea'); t.focus(); t.setSelectionRange(t.value.indexOf('Laura:'), t.value.indexOf('Laura:')); });
  await (await p.waitForSelector('xpath/(.//button[normalize-space(.)="Insertar diálogo"])[1]')).click();
  await p.select('.form-dialogo select', 'Mateo');
  await p.type('.form-dialogo input', 'Me duele el brazo.');
  await (await p.waitForSelector('xpath/.//div[contains(@class,"form-dialogo")]/button[normalize-space(.)="Insertar"]')).click();
  await espera(300);
  r.textarea = await p.$eval('textarea', t => t.value);
  r.ayuda = await p.$eval('.ayuda-dialogo', e => e.textContent.trim());
  await (await p.waitForSelector('xpath/.//button[normalize-space(.)="Información general"]')).click();
  await p.waitForSelector('.editor-area');
  await p.evaluate(() => {   // cursor al final del primer párrafo
    const pp = document.querySelector('.editor-area p'); const rg = document.createRange();
    rg.selectNodeContents(pp); rg.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(rg);
  });
  await (await p.waitForSelector('xpath/(.//button[normalize-space(.)="Insertar diálogo"])[1]')).click();
  await p.select('.form-dialogo select', 'Rosa');
  await p.type('.form-dialogo input', '¿Qué le pasó a mi nieto?');
  await (await p.waitForSelector('xpath/.//div[contains(@class,"form-dialogo")]/button[normalize-space(.)="Insertar"]')).click();
  await espera(300);
  r.desarrollo_html = await p.$eval('.editor-area', e => e.innerHTML);
  r.errores = errores;
  console.log(JSON.stringify(r, null, 1));
} catch (e) { console.error('FALLÓ:', e.message, JSON.stringify(r)); process.exitCode = 1; }
finally { await b.close().catch(() => {}); }
