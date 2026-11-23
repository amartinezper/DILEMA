// Captura el escenario de /demo-personaje con un modelo: node captura.mjs <url> <archivo> <salida.png>
import puppeteer from 'puppeteer-core';
const [url, archivo, salida] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
  args: ['--window-size=1280,900', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
try {
  const p = await b.newPage(); await p.setViewport({ width: 1280, height: 900 });
  p.on('pageerror', e => console.log('error:', e.message));
  await p.goto(url, { waitUntil: 'networkidle0', timeout: 120000 });
  await p.waitForSelector('select#personaje option');
  await p.select('select#personaje', archivo);
  await p.waitForFunction(a => document.querySelector('.tiempos caption')?.textContent.includes(a)
    && document.querySelectorAll('.tiempos td').length === 4, { timeout: 120000 }, archivo);
  // Oculta el cuadro de diálogo y la tabla para ver el cuerpo completo del encuadre.
  await p.addStyleTag({ content: '.dialogo, .tiempos { display: none !important; }' });
  await new Promise(r => setTimeout(r, 1500));
  const el = await p.$('.escenario'); await el.screenshot({ path: salida });
  console.log('ok', archivo, salida);
} catch (e) { console.error('FALLÓ:', e.message); process.exitCode = 1; }
finally { await b.close().catch(() => {}); }
