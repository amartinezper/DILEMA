// Prueba de la pantalla Mis casos del docente (app + backend reales), con datos de prueba.
// Uso: node tools/casos-prueba/probar-mis-casos.mjs [--salida carpeta]
//
// Crea «[PRUEBA] Caso temporal» con "Crear caso", lo abre con "Abrir editor ›" y lo duplica desde el menú "⋯".
// Revisa filtros con contador, búsqueda, orden, paginación de 9 y el aviso de filtro vacío.
// No hay forma de borrar casos por la API: los dos casos de prueba quedan en borrador con «[PRUEBA]» en el nombre.
import puppeteer from '../medir/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const APP = arg('app', 'http://localhost:4200'), API = arg('api', 'http://localhost:8080'), SALIDA = arg('salida', '.');
const NOMBRE = '[PRUEBA] Caso temporal';
const espera = ms => new Promise(r => setTimeout(r, ms));
const r = {};

const ing = await (await fetch(`${API}/api/auth/ingresar`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'docente@psicosim.edu', clave: 'docente123', rol: null, codigoAutorizacion: null }) })).json();
const api = async ruta => (await fetch(API + ruta, { headers: { Authorization: `Bearer ${ing.token}` } })).json();

const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
  userDataDir: mkdtempSync(join(tmpdir(), 'probar-mc-')), args: ['--window-size=1440,1000'] });
try {
  const p = await b.newPage();
  await p.setViewport({ width: 1440, height: 1000 });
  const errores = []; p.on('pageerror', e => errores.push(e.message));
  await p.goto(`${APP}/ingreso`, { waitUntil: 'networkidle0' });
  await p.evaluate((t, u) => { localStorage.setItem('dilema-token', t); localStorage.setItem('dilema-usuario', JSON.stringify(u)); }, ing.token, ing.usuario);
  const textos = sel => p.$$eval(sel, l => l.map(x => x.innerText.replace(/\s+/g, ' ').trim()));
  const escribir = async (sel, texto) => { const e = await p.waitForSelector(sel); await e.click({ clickCount: 3 }); await e.press('Backspace'); if (texto) await e.type(texto); };

  await p.goto(`${APP}/docente/casos`, { waitUntil: 'networkidle0' });
  await p.waitForSelector('.mc-caso, .mc-vacio');
  await p.screenshot({ path: `${SALIDA}/mc-casos-1440.png` });
  r.filtros = await textos('.mc-filtros button');
  r.tarjetas_pagina_1 = (await p.$$('.mc-caso')).length;
  r.paginacion = await textos('.mc-listado .gp-paginacion');
  r.altura_titulos = [...new Set(await p.$$eval('.mc-cuerpo h3', l => l.map(h => Math.round(h.getBoundingClientRect().height))))];
  r.alturas_tarjetas_fila_1 = [...new Set(await p.$$eval('.mc-caso', l => l.slice(0, 3).map(c => Math.round(c.getBoundingClientRect().height))))];
  r.franjas = await p.$$eval('.mc-caso', l => [...new Set(l.map(c => `${c.dataset.estado}:${getComputedStyle(c.querySelector('.mc-franja')).backgroundColor}`))]);

  // Filtro y página 1.
  if (r.paginacion[0]?.includes('2')) {
    await (await p.waitForSelector('xpath/.//nav[contains(@class,"gp-paginacion")]//button[normalize-space(.)="2"]')).click(); await espera(150);
    r.pagina_2 = (await p.$$('.mc-caso')).length;
  }
  await (await p.waitForSelector('xpath/.//div[contains(@class,"mc-filtros")]/button[starts-with(normalize-space(.),"Publicados")]')).click(); await espera(150);
  r.filtro_publicados = { estados: [...new Set(await p.$$eval('.mc-caso', l => l.map(c => c.dataset.estado)))], pagina: await textos('.gp-pag.actual') };
  await (await p.waitForSelector('xpath/.//div[contains(@class,"mc-filtros")]/button[starts-with(normalize-space(.),"Archivados")]')).click(); await espera(150);
  r.filtro_archivados = (await textos('.mc-vacio'))[0] ?? `${(await p.$$('.mc-caso')).length} tarjetas`;
  await (await p.waitForSelector('xpath/.//div[contains(@class,"mc-filtros")]/button[starts-with(normalize-space(.),"Todos")]')).click();
  // Orden.
  await p.select('.mc-orden select', 'nombre'); await espera(150);
  const nombres = await p.$$eval('.mc-cuerpo h3', l => l.map(h => h.textContent.trim()));
  r.orden_nombre = nombres.every((n, i) => i === 0 || nombres[i - 1].localeCompare(n, 'es', { sensitivity: 'base' }) <= 0);
  await p.select('.mc-orden select', 'recientes');

  // Crear caso (como hoy: el editor nuevo y "Guardar borrador").
  const antes = await api('/api/docente/casos');
  await (await p.waitForSelector('xpath/.//a[contains(normalize-space(.),"Crear caso")]')).click();
  await p.waitForFunction(() => location.pathname === '/docente/casos/nuevo', { timeout: 10000 });
  await escribir('xpath/.//label[.//span[normalize-space(.)="Nombre"]]//input', NOMBRE);
  await (await p.waitForSelector('xpath/.//button[normalize-space(.)="Guardar borrador"]')).click();
  await p.waitForFunction(() => /\/docente\/casos\/\d+$/.test(location.pathname), { timeout: 15000 }).catch(() => {});
  const creado = (await api('/api/docente/casos')).find(c => !antes.some(a => a.id === c.id) && c.nombre === NOMBRE);
  r.crear = creado ? `ok (id ${creado.id}, ${creado.estado})` : 'NO SE CREÓ';

  // Abrir editor desde la tarjeta.
  await p.goto(`${APP}/docente/casos`, { waitUntil: 'networkidle0' });
  await escribir('.mc-buscar input', 'PRUEBA] Caso temporal');
  await p.waitForFunction(n => [...document.querySelectorAll('.mc-cuerpo h3')].some(h => h.textContent.trim() === n), { timeout: 10000 }, NOMBRE);
  r.busqueda = await textos('.mc-cuerpo h3');
  const tarjeta = `xpath/.//li[contains(@class,"mc-caso")][.//h3[normalize-space(.)="${NOMBRE}"]]`;
  await (await p.waitForSelector(`${tarjeta}//a[contains(@class,"mc-abrir")]`)).click();
  await p.waitForFunction(id => location.pathname === `/docente/casos/${id}`, { timeout: 10000 }, creado?.id);
  r.abrir = 'ok';

  // Duplicar desde el menú "⋯" (Escape lo cierra y devuelve el foco).
  await p.goto(`${APP}/docente/casos`, { waitUntil: 'networkidle0' });
  await escribir('.mc-buscar input', 'PRUEBA] Caso temporal');
  await p.waitForSelector(tarjeta);
  await (await p.waitForSelector(`${tarjeta}//button[contains(@class,"mc-mas")]`)).click();
  r.menu = await textos('.mc-menu [role=menuitem]');
  r.menu_aria = await p.$eval('.mc-mas[aria-expanded="true"]', e => e.getAttribute('aria-label'));
  await p.screenshot({ path: `${SALIDA}/mc-casos-menu-1440.png` });
  await p.keyboard.press('Escape'); await espera(150);
  r.menu_escape = { cerrado: !(await p.$('.mc-menu')), foco: await p.evaluate(() => document.activeElement?.classList.contains('mc-mas')) };
  const antesDup = await api('/api/docente/casos');
  await (await p.waitForSelector(`${tarjeta}//button[contains(@class,"mc-mas")]`)).click();
  await (await p.waitForSelector('xpath/.//div[contains(@class,"mc-menu")]//button[normalize-space(.)="Duplicar"]')).click();
  await p.waitForFunction(() => /\/docente\/casos\/\d+$/.test(location.pathname), { timeout: 15000 });
  const copia = (await api('/api/docente/casos')).find(c => !antesDup.some(a => a.id === c.id));
  r.duplicar = copia ? `ok: «${copia.nombre}» (id ${copia.id}); abrió ${await p.evaluate(() => location.pathname)}` : 'NO SE DUPLICÓ';

  // Pantalla mediana y celular.
  for (const ancho of [1024, 390]) {
    await p.setViewport({ width: ancho, height: 900 });
    await p.goto(`${APP}/docente/casos`, { waitUntil: 'networkidle0' });
    await p.waitForSelector('.mc-caso');
    r['columnas_' + ancho] = await p.$eval('.mc-rejilla', e => getComputedStyle(e).gridTemplateColumns.split(' ').length);
    r['scroll_horizontal_' + ancho] = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    await p.screenshot({ path: `${SALIDA}/mc-casos-${ancho}.png` });
  }
  r.errores = errores;
} catch (e) { r.fallo = e.message; process.exitCode = 1; }
finally { await b.close().catch(() => {}); }
console.log(JSON.stringify(r, null, 1));
