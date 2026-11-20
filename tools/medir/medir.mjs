// Abre /demo-personaje en Chrome, pulsa "Medir todos" y guarda la tabla de tiempos.
// Uso: node medir.mjs [url] [salida.json] [mbps]
//   url    por defecto http://localhost:4200/demo-personaje (con `ng serve` corriendo)
//   mbps   si se indica, limita la red a esa velocidad (por ejemplo 20) para simular una conexión real
import puppeteer from 'puppeteer-core';
import { writeFileSync } from 'node:fs';

const url = process.argv[2] ?? 'http://localhost:4200/demo-personaje';
const salida = process.argv[3] ?? 'tiempos.json';
const mbps = Number(process.argv[4] ?? 0);
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const navegador = await puppeteer.launch({
  executablePath: CHROME, headless: true,
  args: ['--window-size=1280,900', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader']
});
try {
  const pagina = await navegador.newPage();
  await pagina.setViewport({ width: 1280, height: 900 });
  pagina.on('pageerror', e => console.error('error en la página:', e.message));
  if (mbps > 0) {
    const cdp = await pagina.createCDPSession();
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false, latency: 40, downloadThroughput: (mbps * 1e6) / 8, uploadThroughput: (mbps * 1e6) / 8
    });
  }
  await pagina.goto(url, { waitUntil: 'networkidle0', timeout: 120000 });
  await pagina.waitForSelector('select#personaje option', { timeout: 60000 });
  const total = await pagina.$$eval('select#personaje option', o => o.length);
  console.log(`modelos en el catálogo: ${total}${mbps ? ` (red limitada a ${mbps} Mbps)` : ''}`);

  const boton = await pagina.waitForSelector('xpath/.//button[contains(., "Medir todos")]');
  await boton.click();
  // Espera hasta que la tabla tenga una fila por modelo (cada uno puede tardar varios segundos).
  await pagina.waitForFunction(n => document.querySelectorAll('.medidos tbody tr').length >= n,
    { timeout: total * 90000, polling: 1000 }, total);

  const filas = await pagina.$$eval('.medidos tbody tr', trs => trs.map(tr => {
    const c = [...tr.querySelectorAll('th,td')].map(x => x.textContent.trim());
    return c.length === 5
      ? { archivo: c[0], peso: c[1], descarga: +c[2], preparacion: +c[3], total: +c[4] }
      : { archivo: c[0], error: c[1] };
  }));
  writeFileSync(salida, JSON.stringify({ url, mbps: mbps || null, medido: new Date().toISOString(), filas }, null, 2));
  for (const f of filas.slice(0, 5)) console.log(f);
  console.log(`guardado en ${salida}`);
} catch (e) {
  console.error('FALLÓ LA MEDICIÓN:', e?.message ?? e);
  process.exitCode = 1;
} finally {
  await navegador.close().catch(() => {});
}
