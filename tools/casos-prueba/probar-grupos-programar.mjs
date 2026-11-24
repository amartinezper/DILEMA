// Prueba de las pantallas Grupos y Programar del docente (app + backend reales), solo con datos de prueba.
// Uso: node tools/casos-prueba/probar-grupos-programar.mjs [--caso 102] [--salida carpeta]
//
// Grupos: crea «[PRUEBA] Grupo temporal», lo busca, lo edita desde el menú "⋯", matricula y quita a
// estudiante@psicosim.edu (cuenta que ya existe) y lo elimina con su confirmación.
// Programar: agenda una sesión del caso de prueba para «Grupo de prueba · novela del estudiante» con un mensaje
// que empieza con «[PRUEBA]», la edita, la inicia y la finaliza. Solo toca la sesión que esta prueba crea.
import puppeteer from '../medir/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const APP = arg('app', 'http://localhost:4200'), API = arg('api', 'http://localhost:8080'), SALIDA = arg('salida', '.');
const CASO = Number(arg('caso', '102'));
const GRUPO_PRUEBA = 'Grupo de prueba · novela del estudiante';
const TEMPORAL = '[PRUEBA] Grupo temporal';
const MENSAJE = '[PRUEBA] Sesión creada por la prueba de Programar. Se puede ignorar.';
const espera = ms => new Promise(r => setTimeout(r, ms));
const r = {};

const ing = await (await fetch(`${API}/api/auth/ingresar`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'docente@psicosim.edu', clave: 'docente123', rol: null, codigoAutorizacion: null }) })).json();
const api = async (ruta) => (await fetch(API + ruta, { headers: { Authorization: `Bearer ${ing.token}` } })).json();

const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
  userDataDir: mkdtempSync(join(tmpdir(), 'probar-gp-')), args: ['--window-size=1440,1000'] });
try {
  const p = await b.newPage();
  await p.setViewport({ width: 1440, height: 1000 });
  const errores = []; p.on('pageerror', e => errores.push(e.message));
  await p.goto(`${APP}/ingreso`, { waitUntil: 'networkidle0' });
  await p.evaluate((t, u) => { localStorage.setItem('dilema-token', t); localStorage.setItem('dilema-usuario', JSON.stringify(u)); localStorage.removeItem('dilema-agenda'); }, ing.token, ing.usuario);
  const boton = async (texto, dentro = '') => (await p.waitForSelector(`xpath/.//${dentro}button[normalize-space(.)="${texto}"]`, { timeout: 10000 })).click();
  const escribir = async (selector, texto) => { const e = await p.waitForSelector(selector); await e.click({ clickCount: 3 }); await e.press('Backspace'); await e.type(texto); };
  const textos = sel => p.$$eval(sel, l => l.map(x => x.innerText.replace(/\s+/g, ' ').trim()));

  // ------------------------------------------------------------------ GRUPOS
  await p.goto(`${APP}/docente/grupos`, { waitUntil: 'networkidle0' });
  await p.screenshot({ path: `${SALIDA}/gp-grupos-1440.png`, fullPage: true });
  r.grupos_paginacion = await textos('.gp-lista .gp-paginacion');
  r.grupos_por_pagina = (await p.$$('.gp-lista .gp-fila')).length;

  await boton('Nuevo grupo');
  await escribir('input[name="nombre"]', TEMPORAL);
  await escribir('input[name="espacio"]', '2026-II');
  await boton('Crear grupo');
  await p.waitForFunction(() => !document.querySelector('input[name="nombre"]'), { timeout: 10000 });
  // Buscar y elegir el grupo nuevo.
  await escribir('.gp-lista input[type=search]', 'PRUEBA] Grupo temporal');
  await p.waitForFunction(t => [...document.querySelectorAll('.gp-fila strong')].some(s => s.textContent.trim() === t), { timeout: 10000 }, TEMPORAL);
  r.busqueda_grupos = await textos('.gp-fila strong');
  await (await p.waitForSelector(`xpath/.//li[contains(@class,"gp-fila")][.//strong[normalize-space(.)="${TEMPORAL}"]]//button[contains(@class,"gp-fila-boton")]`)).click();
  await p.waitForFunction(t => document.querySelector('#titulo-grupo')?.textContent.trim() === t, { timeout: 10000 }, TEMPORAL);
  r.crear = 'ok';

  // Menú "⋯": se abre, Escape lo cierra y devuelve el foco; luego Editar.
  const mas = `xpath/.//li[contains(@class,"gp-fila")][.//strong[normalize-space(.)="${TEMPORAL}"]]//button[contains(@class,"gp-mas")]`;
  await (await p.waitForSelector(mas)).click();
  r.menu_items = await textos('.gp-menu [role=menuitem]');
  r.menu_aria = await p.$eval('.gp-mas[aria-expanded="true"]', e => e.getAttribute('aria-label'));
  await p.keyboard.press('Escape'); await espera(150);
  r.menu_escape = { cerrado: !(await p.$('.gp-menu')), foco_en_boton: await p.evaluate(() => document.activeElement?.classList.contains('gp-mas')) };
  await (await p.waitForSelector(mas)).click();
  await boton('Editar', '*[contains(@class,"gp-menu")]//');
  await escribir('input[name="nombreEdicion"]', TEMPORAL + ' editado');
  await boton('Guardar');
  await p.waitForFunction(t => document.querySelector('#titulo-grupo')?.textContent.trim() === t, { timeout: 10000 }, TEMPORAL + ' editado');
  r.editar = 'ok';

  // Asignar y quitar (cuenta que ya existe: no crea usuarios nuevos).
  await p.waitForFunction(() => [...document.querySelectorAll('select[name="correoEstudiante"] option')].some(o => o.value === 'estudiante@psicosim.edu'), { timeout: 10000 });
  await p.select('select[name="correoEstudiante"]', 'estudiante@psicosim.edu');
  await boton('Asignar');
  await p.waitForFunction(() => [...document.querySelectorAll('.gp-correo')].some(c => c.textContent.includes('estudiante@psicosim.edu')), { timeout: 10000 });
  r.matricular = await textos('.gp-tabla tbody tr');
  r.paginacion_estudiantes = await textos('.gp-detalle .gp-paginacion');
  await p.screenshot({ path: `${SALIDA}/gp-grupos-seleccionado-1440.png`, fullPage: true });
  await (await p.waitForSelector('xpath/.//td[contains(@class,"gp-dc")]//button[contains(@class,"gp-mas")]')).click();
  await boton('Quitar del grupo');
  await p.waitForFunction(() => !document.querySelector('.gp-correo'), { timeout: 10000 });
  r.quitar = 'ok';

  // Eliminar con confirmación.
  await boton('Eliminar', '*[contains(@class,"gp-detalle-acciones")]//');
  r.confirmacion = await textos('.gp-confirmar');
  await boton('Confirmar');
  await p.waitForFunction(t => ![...document.querySelectorAll('.gp-fila strong')].some(s => s.textContent.includes(t)), { timeout: 10000 }, TEMPORAL);
  r.eliminar = (await api('/api/docente/grupos')).some(g => g.nombre.startsWith(TEMPORAL)) ? 'SIGUE EXISTIENDO' : 'ok';

  // Panel derecho fijo al bajar.
  await escribir('.gp-lista input[type=search]', '');
  await p.evaluate(() => window.scrollTo(0, 600)); await espera(200);
  r.panel_fijo_top = await p.$eval('.gp-detalle', e => Math.round(e.getBoundingClientRect().top));
  await p.evaluate(() => window.scrollTo(0, 0));

  // ------------------------------------------------------------------ PROGRAMAR
  const antes = await api('/api/docente/sesiones');
  const grupos = await api('/api/docente/grupos');
  const grupo = grupos.find(g => g.nombre === GRUPO_PRUEBA);
  if (!grupo) throw new Error(`No existe «${GRUPO_PRUEBA}» (créalo con sesion-prueba.mjs).`);
  if (grupo.estudiantes.some(e => e.email !== 'estudiante@psicosim.edu')) throw new Error('El grupo de prueba tiene a otras personas; no sigo.');
  await p.goto(`${APP}/docente/programar`, { waitUntil: 'networkidle0' });
  await p.screenshot({ path: `${SALIDA}/gp-programar-1440.png`, fullPage: true });
  r.resumen_vacio = await textos('.pg-resumen');
  r.filtros = await textos('.pg-filtros button');
  r.convocatorias_titulo = await textos('#titulo-convocatorias');
  r.paginacion_convocatorias = await textos('.pg-convocatorias .gp-paginacion');

  // Elegir caso y grupo por su texto (ngValue: se elige la opción por índice).
  const elegirOpcion = (sel, texto) => p.evaluate((sel, texto) => {
    const s = document.querySelector(sel); const i = [...s.options].findIndex(o => o.textContent.trim().startsWith(texto));
    s.selectedIndex = i; s.dispatchEvent(new Event('change', { bubbles: true })); return i;
  }, sel, texto);
  const caso = (await api('/api/docente/casos')).find(c => c.id === CASO);
  r.elegir = [await elegirOpcion('select[name="casoId"]', caso.nombre), await elegirOpcion('select[name="grupoId"]', GRUPO_PRUEBA)];
  const fecha = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const ponerFecha = (sel, v) => p.evaluate((sel, v) => { const e = document.querySelector(sel); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }, sel, v);
  await ponerFecha('input[name="inicio"]', fecha(new Date(Date.now() + 3600000)));
  await ponerFecha('input[name="fin"]', fecha(new Date(Date.now() + 86400000)));
  await escribir('input[name="tiempoMax"]', '30');
  await escribir('input[name="tolerancia"]', '15');
  await escribir('input[name="lugar"]', 'Prueba');
  await escribir('textarea[name="mensaje"]', MENSAJE);
  r.resumen_lleno = await textos('.pg-resumen');
  await boton('Agendar y notificar');
  await p.waitForSelector('.gp-ok', { timeout: 15000 });
  const despues = await api('/api/docente/sesiones');
  const nueva = despues.find(s => !antes.some(a => a.id === s.id));
  if (!nueva || !nueva.mensaje?.startsWith('[PRUEBA]')) throw new Error('No encontré la sesión de prueba nueva.');
  r.agendar = `${nueva.codigo} (${nueva.estado})`;
  // Buscarla en la tabla por su código.
  const fila = `xpath/.//tr[td[normalize-space(.)="${nueva.codigo}"]]`;
  await escribir('.pg-convocatorias input[type=search]', nueva.codigo);
  await p.waitForSelector(fila, { timeout: 10000 });
  r.fila_nueva = await textos('.pg-tabla tbody tr');
  // Editar.
  await (await p.waitForSelector(`${fila}//button[normalize-space(.)="Editar"]`)).click();
  r.chip_editando = await textos('.pg-chip');
  await escribir('input[name="lugar"]', 'Prueba editada');
  await boton('Guardar cambios');
  await p.waitForFunction(() => document.querySelector('.gp-ok')?.textContent.includes('actualizada'), { timeout: 15000 });
  r.editar_sesion = (await api('/api/docente/sesiones')).find(s => s.id === nueva.id)?.lugar;
  // Iniciar y finalizar (solo esta sesión de prueba).
  await (await p.waitForSelector(`${fila}//button[normalize-space(.)="Iniciar"]`)).click();
  await p.waitForSelector(`${fila}//span[contains(@class,"pg-estado")][normalize-space(.)="En curso"]`, { timeout: 15000 });
  r.iniciar = (await api('/api/docente/sesiones')).find(s => s.id === nueva.id)?.estado;
  await (await p.waitForSelector(`${fila}//button[normalize-space(.)="Finalizar"]`)).click();
  await p.waitForSelector(`${fila}//span[contains(@class,"pg-estado")][normalize-space(.)="Finalizada"]`, { timeout: 15000 });
  r.finalizar = (await api('/api/docente/sesiones')).find(s => s.id === nueva.id)?.estado;
  // Filtros.
  await escribir('.pg-convocatorias input[type=search]', '');
  for (const f of ['Sin iniciar', 'En curso', 'Finalizadas', 'Todas']) {
    await boton(f, '*[contains(@class,"pg-filtros")]//'); await espera(150);
    r['filtro_' + f] = await p.$$eval('.pg-tabla tbody .pg-estado', l => [...new Set(l.map(x => x.textContent.trim()))]);
  }
  // Limpiar.
  await boton('Limpiar');
  r.limpiar = await p.evaluate(() => ({ lugar: document.querySelector('input[name="lugar"]').value, mensaje: document.querySelector('textarea[name="mensaje"]').value }));
  // Ninguna otra sesión cambió de estado.
  const final = await api('/api/docente/sesiones');
  r.otras_sesiones_sin_cambios = antes.every(a => final.find(s => s.id === a.id)?.estado === a.estado);
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.screenshot({ path: `${SALIDA}/gp-programar-final-1440.png`, fullPage: true });
  // Pantalla angosta.
  await p.setViewport({ width: 390, height: 900 });
  await p.goto(`${APP}/docente/grupos`, { waitUntil: 'networkidle0' });
  await p.screenshot({ path: `${SALIDA}/gp-grupos-390.png`, fullPage: true });
  r.scroll_horizontal_390 = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  r.errores = errores;
} catch (e) { r.fallo = e.message; process.exitCode = 1; }
finally { await b.close().catch(() => {}); }
console.log(JSON.stringify(r, null, 1));
