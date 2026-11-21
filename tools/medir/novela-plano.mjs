// Prueba visual del plano medio en el editor con 1, 2 y 4 personajes (Chrome temporal y API simulada).
// Uso: node novela-plano.mjs <url-base> <carpeta-salida>
import puppeteer from 'puppeteer-core';
const [base = 'http://localhost:4300', salida = '.'] = process.argv.slice(2);
const caso = {
  id: 321, nombre: 'Plano medio', estado: 'BORRADOR', tiempoEstimadoMin: 30, sensible: false, advertencia: '',
  desarrolloSituacional: '<p>Caso de prueba.</p>', contexto: '', repartoRubrica: 'PONDERADA', rubrica: [],
  bloques: [
    { id: 1, nombre: 'Consultorio', contexto: 'Laura llega sola a la consulta.', preguntas: [] },
    { id: 2, nombre: 'Sala de la casa', contexto: 'Laura conversa con su hijo Mateo en la sala.', preguntas: [] },
    { id: 3, nombre: 'Cocina de la casa', contexto: 'La trabajadora social visita a la familia: Laura, Mateo y la abuela Rosa.', preguntas: [] }
  ],
  personajes: [
    { id: 1, nombre: 'Laura', descripcion: 'madre de 38 años', escenarios: [0, 1, 2] },
    { id: 2, nombre: 'Mateo', descripcion: 'niño de 7 años', escenarios: [1, 2] },
    { id: 3, nombre: 'Rosa', descripcion: 'abuela de 68 años', escenarios: [2] },
    { id: 4, nombre: 'Gloria', descripcion: 'trabajadora social de 45 años', escenarios: [2] }
  ]
};
const espera = ms => new Promise(r => setTimeout(r, ms));
const sinCargar = () => !document.querySelector('app-escena-novela .aviso')?.textContent?.includes('Cargando');
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
  args: ['--window-size=1280,1000', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
try {
  const p = await b.newPage();
  await p.setViewport({ width: 1280, height: 1000 });
  const errores = [];
  p.on('pageerror', e => errores.push(e.message));
  await p.setRequestInterception(true);
  p.on('request', r => {
    const u = new URL(r.url());
    if (!u.pathname.startsWith('/api/')) return r.continue();
    r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(u.pathname === '/api/docente/casos/321' ? caso : []) });
  });
  await p.goto(base + '/ingreso', { waitUntil: 'networkidle0' });
  await p.evaluate(() => {
    localStorage.setItem('dilema-token', 'prueba');
    localStorage.setItem('dilema-usuario', JSON.stringify({ id: 1, nombre: 'Docente Prueba', email: 'd@x', rol: 'PROFESOR', permisos: ['EDITAR'] }));
  });
  await p.goto(base + '/docente/casos/321', { waitUntil: 'networkidle0' });
  await (await p.waitForSelector('xpath/.//button[contains(., "Diseño de escena")]')).click();
  await p.waitForSelector('app-escena-novela .novela');
  const medidas = [];
  for (const i of [0, 1, 2]) {
    await (await p.waitForSelector(`xpath/.//button[normalize-space(.)="Escenario ${i + 1}"]`)).click();
    await espera(1500);
    await p.waitForFunction(sinCargar, { timeout: 120000 });
    await espera(2000);
    await (await p.$('app-escena-novela')).screenshot({ path: `${salida}/plano-${i === 0 ? 1 : i === 1 ? 2 : 4}.png` });
    medidas.push(await p.evaluate(() => {
      const caja = document.querySelector('app-escena-novela .novela').getBoundingClientRect();
      const dialogo = document.querySelector('app-escena-novela .dialogo').getBoundingClientRect();
      return {
        alto: Math.round(caja.height), bordeDialogo: Math.round(dialogo.top - caja.top),
        personajes: [...document.querySelectorAll('app-escena-novela .marca')].map(m => {
          const r = m.getBoundingClientRect();
          return { nombre: m.querySelector('b')?.textContent, coronilla: Math.round(r.top - caja.top), centro: Math.round(r.left + r.width / 2 - caja.left), ancho: Math.round(r.width) };
        })
      };
    }));
  }
  // Arrastre: Laura hacia la derecha y más cerca; debe seguir en plano medio (cintura en el mismo lugar).
  const laura = await p.$('app-escena-novela .marca');
  const r = await laura.boundingBox();
  await p.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
  await p.mouse.down();
  for (let k = 1; k <= 10; k++) await p.mouse.move(r.x + r.width / 2 + k * 9, r.y + r.height / 2 + k * 5);
  await p.mouse.up();
  await espera(800);
  await (await p.$('app-escena-novela')).screenshot({ path: `${salida}/plano-4-arrastre.png` });
  const arrastre = await p.evaluate(() => {
    const caja = document.querySelector('app-escena-novela .novela').getBoundingClientRect();
    const m = document.querySelector('app-escena-novela .marca').getBoundingClientRect();
    return { coronilla: Math.round(m.top - caja.top), centro: Math.round(m.left + m.width / 2 - caja.left), ancho: Math.round(m.width),
      boceto: localStorage.getItem('dilema-boceto-321') };
  });
  console.log(JSON.stringify({ medidas, arrastre, errores }, null, 1));
} catch (e) { console.error('FALLÓ:', e.message); process.exitCode = 1; }
finally { await b.close().catch(() => {}); }
