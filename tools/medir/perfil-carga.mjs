// Mide cuánto tarda cada parte de crear un personaje (descarga, lectura del VRM, recolor) en el navegador.
// Uso: node perfil-carga.mjs <url-base>
import puppeteer from 'puppeteer-core';
import { casoEjemplo } from './caso-ejemplo.mjs';
const [base = 'http://localhost:4300'] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
  args: ['--ignore-gpu-blocklist'] });
try {
  const p = await b.newPage();
  await p.setRequestInterception(true);
  p.on('request', q => {
    const u = new URL(q.url());
    if (!u.pathname.startsWith('/api/')) return q.continue();
    q.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(u.pathname === '/api/docente/casos/777' ? casoEjemplo : []) });
  });
  await p.goto(base + '/ingreso', { waitUntil: 'networkidle0' });
  await p.evaluate(() => {
    localStorage.setItem('dilema-token', 'prueba');
    localStorage.setItem('dilema-usuario', JSON.stringify({ id: 1, nombre: 'D', email: 'd', rol: 'PROFESOR', permisos: ['EDITAR'] }));
  });
  await p.goto(base + '/docente/casos/777', { waitUntil: 'networkidle0' });
  await (await p.waitForSelector('xpath/.//button[normalize-space(.)="Diseño de escena"]')).click();
  await p.waitForSelector('app-escena-novela');
  const r = await p.evaluate(async () => {
    const esc = window.ng.getComponent(document.querySelector('app-escena-novela'));
    const srv = esc.elencoSrv;
    const caso = esc.caso();
    const t = performance.now();
    const asignados = await srv.asignar(caso.id, esc.personajes(), caso);
    const out = { asignar_ms: Math.round(performance.now() - t), modelos: [] };
    const seta = asignados.find(x => x.modelo.archivo === 'M05-01.vrm');
    for (const variante of [{ ...seta, aspecto: { ...seta.aspecto, recolorear: false } }, seta, seta]) {
      const t0 = performance.now(); const pers = await srv.crear(variante); srv.liberar(pers);
      out.modelos.push({ prueba: variante.aspecto.recolorear ? 'M05-01 con recolor' : 'M05-01 sin recolor', crear_ms: Math.round(performance.now() - t0) });
    }
    for (const a of []) {
      const t0 = performance.now();
      await srv.bytes(a.modelo.archivo);
      const t1 = performance.now();
      const pers = await srv.crear(a);
      const t2 = performance.now();
      out.modelos.push({ archivo: a.modelo.archivo, descarga_ms: Math.round(t1 - t0), crear_ms: Math.round(t2 - t1), recolor: a.aspecto.recolorear, cabello: a.aspecto.cabello.modo });
      srv.liberar(pers);
    }
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
} catch (e) { console.error('FALLÓ:', e.message); process.exitCode = 1; }
finally { await b.close().catch(() => {}); }
