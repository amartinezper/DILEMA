// Revisa los casos de prueba con los mismos motores de la app (elenco, guion y fondos), sin backend.
// Uso: node --no-warnings tools/casos-prueba/revisar-guion.mjs [archivo.json ...]
import { readFileSync, readdirSync } from 'node:fs';
import { asignarElenco } from '../../frontend/src/app/shared/novela/elenco.ts';
import { armarGuion } from '../../frontend/src/app/shared/novela/guion.ts';
import { elegirFondo } from '../../frontend/src/app/shared/novela/escena.ts';

const raiz = new URL('../../', import.meta.url);
const catalogo = JSON.parse(readFileSync(new URL('frontend/public/personajes/catalogo/personajes.json', raiz), 'utf8')).personajes;
const indice = JSON.parse(readFileSync(new URL('frontend/public/escenas/escenas.json', raiz), 'utf8'));
const carpeta = new URL('casos/', import.meta.url);
const archivos = process.argv.slice(2).length ? process.argv.slice(2) : readdirSync(carpeta).filter(f => f.endsWith('.json')).sort();

for (const archivo of archivos) {
  const caso = JSON.parse(readFileSync(new URL(archivo, carpeta), 'utf8'));
  const asignados = asignarElenco(caso.id ?? archivo, caso.personajes, caso, catalogo);
  const personajes = asignados.map((a, orden) => ({
    id: a.personaje.indice >= 0 ? a.personaje.indice : 10 + orden, nombre: a.personaje.nombre, rol: a.perfil.rol,
    genero: a.perfil.genero, etiqueta: a.perfil.etiqueta, escenarios: a.personaje.escenarios
  }));
  const nombre = id => personajes.find(p => p.id === id)?.nombre ?? `#${id}`;
  const pasos = armarGuion(caso, personajes);
  console.log(`\n=== ${caso.nombre}  (${archivo})`);
  for (const a of asignados) {
    console.log(`  ${a.personaje.nombre.padEnd(10)} "${caso.personajes[a.personaje.indice]?.descripcion}" → ${a.perfil.etiqueta} · ${a.idElenco} · ${a.modelo?.archivo} (${a.modelo?.ropa_oficio ?? 'común'})${a.avisos.length ? ' · ' + a.avisos.join(' ') : ''}`);
  }
  const habla = {};
  for (const p of pasos) if (p.tipo === 'dialogo') habla[nombre(p.personaje)] = (habla[nombre(p.personaje)] ?? 0) + 1;
  console.log('  diálogos reconocidos:', JSON.stringify(habla));
  // Líneas "Algo: ..." que el narrador terminó leyendo (diálogo no reconocido).
  const sospechosas = pasos.filter(p => p.tipo === 'narracion' && /^[^:]{1,30}:\s/.test(p.texto)).map(p => p.texto);
  if (sospechosas.length) console.log('  ⚠ diálogos no reconocidos:', sospechosas);
  const emociones = pasos.flatMap(p => p.tipo === 'narracion' ? p.reacciones.map(r => `${nombre(r.personaje)} ${r.emocion}/${r.nivel}`)
    : p.tipo === 'dialogo' && p.emocion ? [`${nombre(p.personaje)} ${p.emocion}/${p.nivel} (al hablar)`] : []);
  console.log('  emociones:', emociones.join(' · ') || '(ninguna)');
  caso.bloques.forEach((b, i) => {
    const f = elegirFondo(indice, { id: archivo, ...caso }, { indice: i, nombre: b.nombre, contexto: b.contexto });
    const presentes = pasos.find(p => p.tipo === 'transicion' && p.bloqueIndice === i)?.escena.presentes.map(nombre) ?? [];
    console.log(`  escena ${i + 1} «${b.nombre}» → fondo ${f.escenaId} (${f.variante}${f.motivo === 'tipo-caso' ? ', neutro' : ''}) · en escena: ${presentes.join(', ') || '(nadie)'}`);
  });
  const pesos = caso.bloques.flatMap(b => b.preguntas.map(q => q.peso)).reduce((s, x) => s + x, 0);
  const sinFundamento = caso.bloques.flatMap(b => b.preguntas.flatMap(q => q.opciones)).filter(o => !o.texto || !o.explicacion || !o.fundamento).length;
  const correctas = caso.bloques.flatMap(b => b.preguntas.map(q => q.opciones.filter(o => o.correcta).length));
  const sinEscena = caso.personajes.filter(p => !p.escenarios.length).map(p => p.nombre);
  console.log(`  pesos: ${pesos.toFixed(1)} · correctas por pregunta: ${correctas.join(',')} · opciones incompletas: ${sinFundamento} · personajes sin escenario: ${sinEscena.join(', ') || 'ninguno'} · pasos: ${pasos.length}`);
}
