// Recorre cada caso del docente en el editor y en la Vista previa (app real + backend real) y resume lo que
// entendió el motor: quién habla, fondos por escenario y si aparece algún "Persona N".
// Uso: node tools/casos-prueba/verificar-vista-previa.mjs [--app http://localhost:4200] [--api http://localhost:8080] [--salida carpeta]
import puppeteer from '../medir/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const APP = arg('app', 'http://localhost:4200');
const API = arg('api', 'http://localhost:8080');
const SALIDA = arg('salida', '.');
const espera = ms => new Promise(r => setTimeout(r, ms));

const ingreso = await (await fetch(`${API}/api/auth/ingresar`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'docente@psicosim.edu', clave: 'docente123', rol: null, codigoAutorizacion: null }) })).json();
const casos = await (await fetch(`${API}/api/docente/casos`, { headers: { Authorization: `Bearer ${ingreso.token}` } })).json();

const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
  args: ['--window-size=1366,900', '--ignore-gpu-blocklist'] });
try {
  const p = await b.newPage();
  await p.setViewport({ width: 1366, height: 900 });
  const errores = [];
  p.on('pageerror', e => errores.push(e.message));
  await p.goto(`${APP}/ingreso`, { waitUntil: 'networkidle0' });
  await p.evaluate((t, u) => { localStorage.setItem('dilema-token', t); localStorage.setItem('dilema-usuario', JSON.stringify(u)); }, ingreso.token, ingreso.usuario);

  const solo = arg('caso', null);
  for (const c of [...casos].sort((x, y) => x.id - y.id).filter(x => !solo || String(x.id) === solo)) {
    await p.goto(`${APP}/docente/casos/${c.id}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    // Espera a que el editor haya cargado el caso (si no, se ve el caso vacío con "Persona N").
    await p.waitForFunction(n => [...document.querySelectorAll('h1')].some(h => h.textContent.includes(n)), { timeout: 120000 }, c.nombre);
    // Editor: lo que entendió el motor de cada personaje (pestaña Diseño de escena).
    await (await p.waitForSelector('xpath/.//button[normalize-space(.)="Diseño de escena"]')).click();
    await p.waitForFunction(() => document.querySelectorAll('.entendido').length > 0, { timeout: 30000 });
    await espera(1500);
    const entendido = await p.$$eval('.personaje-fila', filas => filas.map(f => `${f.querySelector('input')?.value}: ${f.querySelector('.entendido')?.textContent?.trim()}`));
    const etiquetasEscena = await p.$$eval('app-escena-novela .etiqueta', l => l.map(e => e.textContent.trim()));

    // Vista previa: recorre todo el guion con el botón Siguiente.
    await (await p.waitForSelector('xpath/.//button[normalize-space(.)="Vista previa"]')).click();
    await p.waitForSelector('.modal-vista .portada h2', { timeout: 60000 });
    const t0 = Date.now();
    const hablan = {}; const fondos = new Map(); let escena = 'Presentación'; let foto = false; let pasos = 0; let preguntas = 0; let narrador = 0;
    const siguiente = async () => { const s = await p.$('xpath/.//div[contains(@class,"controles")]/button[contains(@class,"principal")]'); await s.click(); };
    for (let k = 0; k < 120; k++) {
      const estado = await p.evaluate(() => {
        const m = document.querySelector('.modal-vista');
        return {
          fin: !!m.querySelector('.portada h2')?.textContent?.includes('Fin del caso'),
          letrero: m.querySelector('.letrero')?.textContent?.trim() ?? null,
          nombre: m.querySelector('.dialogo .nombre')?.textContent?.trim() ?? null,
          dialogo: !!m.querySelector('.dialogo'),
          pregunta: !!m.querySelector('.pregunta'),
          fondo: m.querySelector('img.fondo.entra')?.getAttribute('src') ?? null,
          cargando: !!m.querySelector('app-escena-novela .aviso'),
          escribiendo: m.querySelector('.controles .principal')?.textContent?.includes('Completar') ?? false
        };
      });
      if (estado.fin) break;
      if (estado.escribiendo) { await siguiente(); await espera(80); continue; }   // completa la frase, mismo paso
      if (estado.letrero) { escena = estado.letrero; await espera(600); }
      if (estado.fondo && !fondos.has(escena)) fondos.set(escena, estado.fondo.replace('/escenas/', ''));
      if (estado.pregunta) preguntas++;
      if (estado.dialogo) {
        if (estado.nombre) hablan[estado.nombre] = (hablan[estado.nombre] ?? 0) + 1; else narrador++;
        if (estado.nombre && !foto) {
          // Foto de un diálogo con los personajes ya cargados (boca y quien habla iluminado).
          await p.waitForFunction(() => !document.querySelector('.modal-vista app-escena-novela .aviso'), { timeout: 60000 }).catch(() => {});
          await (await p.$('.modal-vista')).screenshot({ path: `${SALIDA}/verificacion-caso-${c.id}.png` });
          foto = true;
        }
      }
      pasos++;
      await siguiente(); await espera(120);
    }
    const personasN = [...entendido, ...etiquetasEscena, ...Object.keys(hablan)].filter(t => /Persona \d/.test(t));
    console.log(`\n=== [${c.id}] ${c.nombre} (${c.estado})`);
    console.log('  editor:', entendido.join(' · '));
    console.log('  hablan en la vista previa:', JSON.stringify(hablan), `· narrador: ${narrador} · preguntas: ${preguntas} · pasos: ${pasos} · ${Math.round((Date.now() - t0) / 1000)} s`);
    console.log('  fondos:', [...fondos].map(([e, f]) => `${e} → ${f}`).join(' | '));
    console.log('  "Persona N":', personasN.length ? personasN : 'ninguno');
    await p.keyboard.press('Escape').catch(() => {});
    await (await p.$('xpath/.//button[normalize-space(.)="Cerrar"]'))?.click().catch(() => {});
  }
  console.log('\nerrores de la página:', errores.length ? errores : 'ninguno');
} catch (e) { console.error('FALLÓ:', e.message); process.exitCode = 1; }
finally { await b.close().catch(() => {}); }
