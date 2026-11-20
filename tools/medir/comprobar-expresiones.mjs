// Comprueba en el motor: parpadeo con sonrisa leve/normal, duración de la transición y respaldo sin partes sueltas.
import puppeteer from 'puppeteer-core';
const [url, archivo = 'M03-01.vrm'] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
  args: ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
try {
  const p = await b.newPage();
  await p.goto(url, { waitUntil: 'networkidle0', timeout: 120000 });
  await p.waitForSelector('select#personaje option');
  await p.select('select#personaje', archivo);
  await p.waitForFunction(a => document.querySelector('.tiempos caption')?.textContent.includes(a)
    && document.querySelectorAll('.tiempos td').length === 4, { timeout: 120000 }, archivo);
  await p.waitForFunction(() => !document.querySelector('.dialogo .cursor'), { timeout: 30000 });
  const r = await p.evaluate(async () => {
    const espera = ms => new Promise(res => setTimeout(res, ms));
    const demoEl = document.querySelector('app-demo-personaje'); const d = ng.getComponent(demoEl);
    const c = ng.getComponent(document.querySelector('app-personaje-vrm'));
    const poner = (n, e) => { d.nivel.set(n); d.expresion.set(e); ng.applyChanges(demoEl); };
    const out = {};
    // 1) transición: tiempo hasta 95 % del objetivo de MTH_Fun al pasar de neutral a alegre normal
    poner('normal', 'neutral'); await espera(800);
    poner('normal', 'alegre'); const t0 = performance.now(); const obj = c.objetivosPartes.get('MTH_Fun');
    while ((c.pesosPartes.get('MTH_Fun') ?? 0) < 0.95 * obj && performance.now() - t0 < 2000) await espera(5);
    out.transicion_ms = Math.round(performance.now() - t0);
    // 2) parpadeo con sonrisa leve y normal: valor máximo de blink durante un parpadeo forzado
    for (const n of ['leve', 'normal']) {
      poner(n, 'alegre'); await espera(600);
      c.faseParpadeo = 0; let max = 0; const t1 = performance.now();
      while (performance.now() - t1 < 300) { max = Math.max(max, c.vrm.expressionManager.getValue('blink')); await espera(5); }
      out['parpadeo_max_' + n] = +max.toFixed(2);
      out['ojos_entrecerrados_' + n] = +((c.pesosPartes.get('EYE_Joy') ?? 0)).toFixed(2);
    }
    // 3) fuerte: expresión completa a 0.6; y respaldo sin partes (se simula vaciando las partes)
    poner('fuerte', 'alegre'); await espera(50); out.fuerte_happy = c.objetivos.get('happy');
    const partes = c.partes; c.partes = new Map();
    for (const n of ['leve', 'normal']) { poner(n, n === 'leve' ? 'neutral' : 'alegre'); poner(n, 'alegre'); await espera(50); out['sin_partes_happy_' + n] = c.objetivos.get('happy'); }
    c.partes = partes; poner('normal', 'neutral');
    // 4) máximos de las recetas
    out.nivel_por_defecto = d.nivel();
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
} catch (e) { console.error('FALLÓ:', e.message); process.exitCode = 1; }
finally { await b.close().catch(() => {}); }
