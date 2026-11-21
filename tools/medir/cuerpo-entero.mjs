// Fotos de cuerpo entero de cada modelo del catálogo (para revisar la ropa), usando /demo-personaje.
// Uso: node cuerpo-entero.mjs <url-demo> <carpeta-salida>
import puppeteer from 'puppeteer-core';
const [url, salida] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
  args: ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const espera = ms => new Promise(r => setTimeout(r, ms));
try {
  const p = await b.newPage();
  await p.setViewport({ width: 1100, height: 800 });
  await p.goto(url, { waitUntil: 'networkidle0', timeout: 120000 });
  await p.waitForSelector('select#personaje option');
  const archivos = await p.$$eval('select#personaje option', o => o.map(x => x.value));
  await p.addStyleTag({ content: '.dialogo, .tiempos, .aviso { display: none !important; }' });
  for (const archivo of archivos) {
    await p.select('select#personaje', archivo);
    await p.waitForFunction(a => document.querySelector('.tiempos caption')?.textContent.includes(a)
      && document.querySelectorAll('.tiempos td').length === 4, { timeout: 120000 }, archivo);
    await p.evaluate(() => {
      const c = window.ng.getComponent(document.querySelector('app-personaje-vrm'));
      c.camara.fov = 30; c.camara.position.set(0, 0.85, 4.2); c.camara.lookAt(0, 0.8, 0); c.camara.updateProjectionMatrix();
    });
    await espera(400);
    await (await p.$('.escenario')).screenshot({ path: `${salida}/${archivo.replace('.vrm', '')}.png` });
  }
  console.log('ok', archivos.length);
} catch (e) { console.error('FALLÓ:', e.message); process.exitCode = 1; }
finally { await b.close().catch(() => {}); }
