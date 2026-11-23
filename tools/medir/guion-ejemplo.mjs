// Imprime el guion (lista de pasos) del caso de ejemplo, con el mismo motor que usa la app.
// Uso: node --no-warnings guion-ejemplo.mjs
import { readFileSync } from 'node:fs';
import { asignarElenco } from '../../frontend/src/app/shared/novela/elenco.ts';
import { armarGuion } from '../../frontend/src/app/shared/novela/guion.ts';
import { casoEjemplo } from './caso-ejemplo.mjs';

const catalogo = JSON.parse(readFileSync(new URL('../../frontend/public/personajes/catalogo/personajes.json', import.meta.url), 'utf8')).personajes;
const asignados = asignarElenco(casoEjemplo.id, casoEjemplo.personajes, casoEjemplo, catalogo);
const personajes = asignados.map((a, orden) => ({
  id: a.personaje.indice >= 0 ? a.personaje.indice : 10 + orden, nombre: a.personaje.nombre, rol: a.perfil.rol,
  genero: a.perfil.genero, etiqueta: a.perfil.etiqueta, escenarios: a.personaje.escenarios
}));
const nombre = id => personajes.find(p => p.id === id)?.nombre ?? `#${id}`;
const emociones = e => Object.entries(e).map(([id, v]) => `${nombre(+id)}=${v.emocion}/${v.nivel}`).join(', ');
for (const p of personajes) console.log(`personaje ${p.id}: ${p.nombre} (${p.etiqueta}) escenarios ${JSON.stringify(p.escenarios)}`);
console.log('');
armarGuion(casoEjemplo, personajes).forEach((p, i) => {
  const n = String(i + 1).padStart(2);
  const en = `[${p.escena.presentes.map(nombre).join(', ')}]${Object.keys(p.escena.emociones).length ? ' · ' + emociones(p.escena.emociones) : ''}`;
  switch (p.tipo) {
    case 'portada': console.log(`${n}. PORTADA «${p.titulo}»`); break;
    case 'transicion': console.log(`${n}. TRANSICIÓN «${p.titulo}» ${en}`); break;
    case 'entrada': console.log(`${n}. ENTRA ${nombre(p.personaje)} ${en}`); break;
    case 'narracion': console.log(`${n}. NARRADOR: ${p.texto}${p.reacciones.length ? '  → ' + p.reacciones.map(r => `${nombre(r.personaje)} ${r.emocion}/${r.nivel}`).join(', ') : ''}`); break;
    case 'dialogo': console.log(`${n}. ${nombre(p.personaje).toUpperCase()}: ${p.texto}${p.emocion ? `  (${p.emocion}/${p.nivel})` : ''}`); break;
    case 'pregunta': console.log(`${n}. PREGUNTA escenario ${p.bloqueIndice + 1}, pregunta ${p.preguntaIndice + 1}`); break;
    case 'fin': console.log(`${n}. FIN`); break;
  }
});
