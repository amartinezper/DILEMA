// Prueba visual del editor ("Diseño de escena") sin backend: sesión de docente de prueba y API simulada
// dentro de un Chrome temporal (perfil nuevo que se descarta al cerrar). No escribe nada fuera de <carpeta-salida>.
// Uso: node novela-editor.mjs <url-base> <carpeta-salida>
import puppeteer from 'puppeteer-core';
const [base = 'http://localhost:4300', salida = '.', modo = ''] = process.argv.slice(2);
// Con modo "sin3d" Chrome arranca sin WebGL para probar el plan B (fondo + texto).
const sin3d = modo === 'sin3d';
const caso = {
  id: 123, nombre: 'Laura y Mateo en urgencias', estado: 'BORRADOR', tiempoEstimadoMin: 30, sensible: false, advertencia: '',
  desarrolloSituacional: '<p>Laura, la madre de 38 años, llega a urgencias con su hijo Mateo de 7 años. Álvaro, el abuelo, llega después.</p>',
  contexto: '<p>Posible caso de violencia intrafamiliar.</p>', repartoRubrica: 'PONDERADA', rubrica: [],
  bloques: [
    { id: 1, nombre: 'Urgencias del hospital', contexto: 'Laura espera con Mateo en urgencias. Mateo tiene un golpe en el brazo.', preguntas: [] },
    { id: 2, nombre: 'Visita a la casa en la noche', contexto: 'La trabajadora social visita la casa de la familia en la noche.', preguntas: [] }
  ],
  personajes: [
    { id: 1, nombre: 'Laura', descripcion: 'madre de 38 años', escenarios: [0, 1] },
    { id: 2, nombre: 'Mateo', descripcion: 'niño de 7 años, hijo de Laura', escenarios: [0, 1] },
    { id: 3, nombre: 'Persona 3', descripcion: '', escenarios: [0] },
    { id: 4, nombre: 'Gloria', descripcion: 'trabajadora social de 45 años', escenarios: [1] }
  ]
};
const espera = ms => new Promise(r => setTimeout(r, ms));
const sinCargar = () => !document.querySelector('app-escena-novela .aviso')?.textContent?.includes('Cargando');
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
  args: sin3d ? ['--window-size=1280,1000', '--disable-3d-apis'] : ['--window-size=1280,1000', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
try {
  const p = await b.newPage();
  await p.setViewport({ width: 1280, height: 1000 });
  const errores = [];
  p.on('pageerror', e => errores.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errores.push(m.text()); });
  await p.setRequestInterception(true);
  p.on('request', r => {
    const u = new URL(r.url());
    if (!u.pathname.startsWith('/api/')) return r.continue();
    const cuerpo = u.pathname === '/api/docente/casos/123' ? caso : [];
    r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(cuerpo) });
  });
  // Sesión de docente de prueba (solo en este Chrome temporal).
  await p.goto(base + '/ingreso', { waitUntil: 'networkidle0' });
  await p.evaluate(() => {
    localStorage.setItem('dilema-token', 'prueba');
    localStorage.setItem('dilema-usuario', JSON.stringify({ id: 1, nombre: 'Docente Prueba', email: 'd@x', rol: 'PROFESOR', permisos: ['EDITAR'] }));
  });
  await p.goto(base + '/docente/casos/123', { waitUntil: 'networkidle0' });
  await (await p.waitForSelector('xpath/.//button[contains(., "Diseño de escena")]')).click();
  await p.waitForSelector('app-escena-novela .novela');
  for (const i of [0, 1]) {
    await (await p.waitForSelector(`xpath/.//button[normalize-space(.)="Escenario ${i + 1}"]`)).click();
    await espera(1500);
    await p.waitForFunction(sinCargar, { timeout: 120000 });
    await espera(1500);
    await (await p.$('app-escena-novela')).screenshot({ path: `${salida}/editor-escenario${i + 1}${sin3d ? '-sin3d' : ''}.png` });
  }
  const info = await p.evaluate(() => ({
    etiquetas: [...document.querySelectorAll('.entendido')].map(e => e.textContent.trim()),
    marcas: [...document.querySelectorAll('app-escena-novela .marca .etiqueta')].map(e => e.textContent.trim()),
    fondo: document.querySelector('app-escena-novela img.fondo')?.getAttribute('src'),
    aviso: document.querySelector('app-escena-novela .aviso')?.textContent ?? null
  }));
  // Listas de ayuda en la Persona 3: edad 66 + rol abuela -> se escribe en la descripción y deja de ser silueta.
  const fila3 = (await p.$$('.personaje-fila'))[2];
  const [, edad, rol] = await fila3.$$('select');
  await edad.select('66');
  await rol.select('abuela');
  const descripcion = await fila3.$eval('input[placeholder]', i => i.value);
  await (await p.waitForSelector('xpath/.//button[normalize-space(.)="Escenario 1"]')).click();
  await espera(2500);
  await p.waitForFunction(sinCargar, { timeout: 120000 });
  await espera(1500);
  await (await p.$('app-escena-novela')).screenshot({ path: `${salida}/editor-con-abuela${sin3d ? '-sin3d' : ''}.png` });
  const despues = await p.evaluate(() => [...document.querySelectorAll('.entendido')].map(e => e.textContent.trim()));
  console.log(JSON.stringify({ info, descripcion, despues, errores }, null, 1));
} catch (e) { console.error('FALLÓ:', e.message); process.exitCode = 1; }
finally { await b.close().catch(() => {}); }
