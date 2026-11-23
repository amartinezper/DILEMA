// Mide un solo modelo varias veces: node uno.mjs <url> <archivo> <veces> [mbps]
import puppeteer from 'puppeteer-core';
const [url, archivo, veces = '3', mbps = '0'] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
  args: ['--window-size=1280,900', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
try {
  const p = await b.newPage(); await p.setViewport({ width: 1280, height: 900 });
  if (+mbps) { const c = await p.createCDPSession(); await c.send('Network.enable');
    await c.send('Network.emulateNetworkConditions', { offline: false, latency: 40, downloadThroughput: mbps * 125000, uploadThroughput: mbps * 125000 }); }
  for (let i = 0; i < +veces; i++) {
    // Página nueva en cada medición: la tabla empieza vacía y no queda nada en memoria.
    await p.goto(url, { waitUntil: 'networkidle0', timeout: 120000 });
    await p.waitForSelector('select#personaje option');
    await p.select('select#personaje', archivo);
    await p.waitForFunction(a => { const c = document.querySelector('.tiempos caption'); const td = document.querySelectorAll('.tiempos td');
      return c?.textContent.includes(a) && td.length === 4; }, { timeout: 120000 }, archivo);
    const v = await p.$$eval('.tiempos td', t => t.map(x => x.textContent.trim()));
    console.log(JSON.stringify({ archivo, mbps: +mbps || null, peso: v[0], descarga: +v[1], preparacion: +v[2], total: +v[3] }));
    await new Promise(r => setTimeout(r, 500));
  }
} catch (e) { console.error('FALLÓ:', e.message); process.exitCode = 1; }
finally { await b.close().catch(() => {}); }
