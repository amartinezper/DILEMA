// Compara "antes" (expresión completa al 100 %) y "después" (alegría normal) en /demo-personaje (servidor de desarrollo).
// Uso: node expresiones.mjs <url> <carpeta-salida> <archivo.vrm>...
import puppeteer from 'puppeteer-core';
const [url, salida, ...modelos] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
  args: ['--window-size=1280,900', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const espera = ms => new Promise(r => setTimeout(r, ms));
try {
  const p = await b.newPage();
  await p.setViewport({ width: 1280, height: 900, deviceScaleFactor: 2 });
  await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  p.on('pageerror', e => console.log('error en la página:', e.message));
  for (const archivo of modelos) {
    await p.goto(url, { waitUntil: 'networkidle0', timeout: 120000 });
    await p.waitForSelector('select#personaje option');
    await p.select('select#personaje', archivo);
    await p.waitForFunction(a => document.querySelector('.tiempos caption')?.textContent.includes(a)
      && document.querySelectorAll('.tiempos td').length === 4, { timeout: 120000 }, archivo);
    await p.waitForFunction(() => !document.querySelector('.dialogo .cursor'), { timeout: 30000 });
    await p.addStyleTag({ content: '.dialogo, .tiempos { display: none !important; }' });
    const info = await p.evaluate(() => {
      const el = document.querySelector('app-personaje-vrm');
      const c = window.ng.getComponent(el);
      c.cara.proximoParpadeo = 1e9; c.cara.faseParpadeo = -1;   // sin parpadeo durante la captura
      const cabeza = c.vrm.humanoid.getNormalizedBoneNode('head');
      const v = cabeza.getWorldPosition(cabeza.position.clone());
      v.y += 0.07; v.project(c.camara);
      const r = el.getBoundingClientRect();
      return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height, partes: c.cara.tienePartes(), version: c.vrm.meta.metaVersion };
    });
    const clip = { x: info.x - 130, y: info.y - 120, width: 260, height: 260 };
    for (const [nivel, nombre, expr] of [['normal', 'neutral', 'neutral'], ['completa', 'antes', 'alegre'], ['normal', 'despues', 'alegre']]) {
      await p.evaluate((n, e) => {
        const el = document.querySelector('app-demo-personaje');
        const d = window.ng.getComponent(el);
        d.nivel.set(n); d.expresion.set(e); window.ng.applyChanges(el);
      }, nivel, expr);
      await espera(1500);   // la transición dura ~250 ms
      await p.screenshot({ path: `${salida}/${archivo.replace('.vrm', '')}-${nombre}.png`, clip });
    }
    console.log('ok', archivo, JSON.stringify(info));
  }
} catch (e) { console.error('FALLÓ:', e.message); process.exitCode = 1; }
finally { await b.close().catch(() => {}); }
