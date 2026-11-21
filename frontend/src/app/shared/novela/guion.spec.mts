// Pruebas del motor del guion. Se corren con: npm run test:novela (node --test, sin dependencias).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  armarGuion, dividirFrases, expresionDe, htmlATexto, reconocerDialogo,
  type CasoGuion, type Paso, type PersonajeGuion
} from './guion.ts';

const elenco: PersonajeGuion[] = [
  { id: 0, nombre: 'Ana', rol: 'madre', genero: 'mujer', etiqueta: 'Madre · 38 años', escenarios: [0, 1] },
  { id: 1, nombre: 'Mateo', rol: 'nino', genero: 'hombre', etiqueta: 'Niño · 7 años', escenarios: [1] },
  { id: 2, nombre: 'Rosa', rol: 'abuela', genero: 'mujer', etiqueta: 'Abuela · 70 años', escenarios: [1] },
  { id: 3, nombre: 'Gloria', rol: 'trabajadora_social', genero: 'mujer', etiqueta: 'Trabajadora social · 45 años', escenarios: [] }
];
const tipos = (pasos: Paso[]) => pasos.map(p => p.tipo);
const caso = (desarrollo: string, bloques: CasoGuion['bloques'] = []): CasoGuion => ({ nombre: 'Caso', desarrolloSituacional: desarrollo, bloques });

// ---------------------------------------------------------------- frases

test('1. quita el HTML: párrafos, saltos y entidades', () => {
  assert.equal(htmlATexto('<p>Hola&nbsp;Ana.</p><p>Adi&oacute;s<br>mam&aacute;</p>'), 'Hola Ana.\nAdiós\nmamá');
});

test('2. divide frases y respeta abreviaturas (Sr., Dra.) y números', () => {
  assert.deepEqual(dividirFrases('La Dra. Gómez llegó a las 3.30 con el Sr. Pérez. Luego se fue.'),
    ['La Dra. Gómez llegó a las 3.30 con el Sr. Pérez.', 'Luego se fue.']);
  assert.deepEqual(dividirFrases('Dijo que no. Luego se fue.'), ['Dijo que no.', 'Luego se fue.']);
  assert.deepEqual(dividirFrases('Vive en la casa No. 5 del barrio.'), ['Vive en la casa No. 5 del barrio.']);
});

test('3. puntos suspensivos: siguen si lo que viene va en minúscula; terminan si va en mayúscula', () => {
  assert.deepEqual(dividirFrases('No sé... tal vez mañana. ¿Vienes?'), ['No sé... tal vez mañana.', '¿Vienes?']);
  assert.deepEqual(dividirFrases('Esperó… Nadie llegó.'), ['Esperó…', 'Nadie llegó.']);
});

test('4. frases de más de 180 caracteres se parten en las comas', () => {
  const larga = 'Ana camina por el barrio, ' + 'mira las casas cerradas y las tiendas vacías, '.repeat(4) + 'y piensa en su hijo.';
  const partes = dividirFrases(larga);
  assert.ok(partes.length > 1);
  assert.ok(partes.every(p => p.length <= 180), partes.map(p => p.length).join(','));
  assert.equal(partes.join(' '), larga);
});

test('5. no corta frases dentro de comillas', () => {
  assert.deepEqual(dividirFrases('Ana dijo: "No sé. Tengo miedo." Después calló.'), ['Ana dijo: "No sé. Tengo miedo."', 'Después calló.']);
});

// ---------------------------------------------------------------- diálogos

test('6. diálogo formato a) "Nombre: texto" (sin importar mayúsculas ni tildes)', () => {
  assert.deepEqual(reconocerDialogo('Ana: No sé qué hacer.', elenco), { hablante: 0, texto: 'No sé qué hacer.' });
  assert.equal(reconocerDialogo('ANA: No sé.', elenco)?.hablante, 0);
  assert.equal(reconocerDialogo('mateo: ¿Dónde está mi mamá?', elenco)?.hablante, 1);
  assert.equal(reconocerDialogo('La abuela: Ya pasó.', elenco)?.hablante, 2, 'por su rol');
  assert.equal(reconocerDialogo('Nota: esto no es un diálogo.', elenco), null, 'nombre que no es personaje');
});

test('7. diálogo formato b) raya + verbo de habla + nombre', () => {
  assert.deepEqual(reconocerDialogo('—No sé qué hacer —dijo Ana.', elenco), { hablante: 0, texto: 'No sé qué hacer.', verbo: 'dijo' });
  const r = reconocerDialogo('—Estoy cansada —sollozó la abuela—. No puedo más.', elenco)!;
  assert.equal(r.hablante, 2);
  assert.equal(r.texto, 'Estoy cansada. No puedo más.');
  assert.equal(r.verbo, 'sollozo');
  assert.equal(reconocerDialogo('—Ya voy —le respondió Mateo.', elenco)?.hablante, 1);
  assert.equal(reconocerDialogo('—¿Quién anda ahí?', elenco)?.hablante, null, 'raya sin autor: lo dice el narrador');
});

test('8. diálogo formato c) con comillas "" “” o «»', () => {
  assert.deepEqual(reconocerDialogo('Ana dijo: "No sé qué hacer."', elenco), { hablante: 0, texto: 'No sé qué hacer.', verbo: 'dijo' });
  assert.equal(reconocerDialogo('Luego Mateo preguntó: «¿Ya nos vamos?»', elenco)?.hablante, 1);
  assert.equal(reconocerDialogo('“Todo va a estar bien”, respondió Gloria.', elenco)?.hablante, 3);
  assert.equal(reconocerDialogo('El letrero decía "Cerrado".', elenco), null);
});

// ---------------------------------------------------------------- expresiones

test('9. expresiones desde el texto con su nivel', () => {
  assert.deepEqual(expresionDe('Ana llora en silencio.'), { emocion: 'tristeza', nivel: 'normal' });
  assert.deepEqual(expresionDe('Ana llora desconsolada.'), { emocion: 'tristeza', nivel: 'fuerte' });
  assert.deepEqual(expresionDe('Mateo grita furioso.'), { emocion: 'enojo', nivel: 'fuerte' });
  assert.deepEqual(expresionDe('Está molesta.'), { emocion: 'enojo', nivel: 'leve' });
  assert.deepEqual(expresionDe('De repente suena el timbre.'), { emocion: 'sorpresa', nivel: 'normal' });
  assert.deepEqual(expresionDe('Ana sonríe aliviada.'), { emocion: 'alegria', nivel: 'leve' });
  assert.deepEqual(expresionDe('Respira y se queda tranquila.'), { emocion: 'relajado', nivel: 'leve' });
  assert.deepEqual(expresionDe('Baja la mirada.'), { emocion: 'tristeza', nivel: 'leve' });
  assert.equal(expresionDe('Ana abre la puerta.'), null);
});

test('10. la emoción va al personaje nombrado; con "ella" o sujeto implícito, al último mencionado', () => {
  const pasos = armarGuion(caso('<p>Ana y Mateo llegan a la casa. Mateo sonríe. Ella llora en silencio.</p>'), elenco);
  const narr = pasos.filter(p => p.tipo === 'narracion');
  assert.deepEqual(narr[1].tipo === 'narracion' && narr[1].reacciones, [{ personaje: 1, emocion: 'alegria', nivel: 'leve' }]);
  // "Ella" se aplica al último mencionado (Mateo en la frase anterior); el texto no distingue el género.
  assert.equal(narr[2].tipo === 'narracion' && narr[2].reacciones[0].personaje, 1);
});

test('11. en los diálogos cuenta lo que dice y el verbo de habla ("sollozó" → tristeza)', () => {
  const pasos = armarGuion(caso('<p>—No quiero ir —sollozó Mateo.</p><p>Ana: Estoy muy contenta de verte.</p>'), elenco);
  const d = pasos.filter(p => p.tipo === 'dialogo');
  assert.equal(d[0].tipo === 'dialogo' && d[0].emocion, 'tristeza');
  assert.equal(d[1].tipo === 'dialogo' && d[1].emocion, 'alegria');
  assert.equal(d[1].escena.emociones[1].emocion, 'tristeza', 'la emoción de Mateo dura hasta que cambie');
});

// ---------------------------------------------------------------- entradas y orden

test('12. en la presentación cada personaje entra la primera vez que se le nombra (por nombre o por rol)', () => {
  const pasos = armarGuion(caso('<p>Ana espera en la sala. Su hijo juega. La abuela llega y saluda a Ana.</p>'), elenco);
  assert.deepEqual(tipos(pasos).slice(0, 7), ['portada', 'entrada', 'narracion', 'entrada', 'narracion', 'entrada', 'narracion']);
  assert.deepEqual(pasos.filter(p => p.tipo === 'entrada').map(p => p.tipo === 'entrada' && p.personaje), [0, 1, 2]);
  const ultimoPaso = pasos.filter(p => p.tipo === 'narracion').at(-1)!;
  assert.deepEqual(ultimoPaso.escena.presentes, [0, 1, 2], 'Ana no vuelve a entrar');
});

test('13. al empezar cada escenario están los marcados en "Aparece en" y todos vuelven a neutral', () => {
  const pasos = armarGuion(caso('<p>Ana llora desconsolada.</p>', [
    { nombre: 'Urgencias', contexto: 'Ana espera.', preguntas: [{}] },
    { nombre: 'Casa', contexto: 'Mateo y la abuela están en la cocina.', preguntas: [{}, {}] }
  ]), elenco);
  const transiciones = pasos.filter(p => p.tipo === 'transicion');
  assert.deepEqual(transiciones[0].escena.presentes, [0]);
  assert.deepEqual(transiciones[0].escena.emociones, {}, 'neutral al empezar el escenario');
  assert.deepEqual(transiciones[1].escena.presentes, [0, 1, 2]);
  assert.equal(transiciones[1].tipo === 'transicion' && transiciones[1].titulo, 'Escena 2: Casa');
  assert.ok(!pasos.slice(pasos.indexOf(transiciones[0])).some(p => p.tipo === 'entrada'), 'en los escenarios ya están en escena');
});

test('14. orden de pasos: portada → presentación → (transición → contexto → preguntas) → fin', () => {
  const pasos = armarGuion(caso('<p>Presentación.</p>', [
    { nombre: 'A', contexto: 'Contexto A.', preguntas: [{}, {}] },
    { nombre: 'B', contexto: '', preguntas: [{}] }
  ]), elenco);
  assert.deepEqual(tipos(pasos), ['portada', 'narracion', 'transicion', 'narracion', 'pregunta', 'pregunta', 'transicion', 'pregunta', 'fin']);
  assert.deepEqual(pasos.filter(p => p.tipo === 'pregunta').map(p => p.tipo === 'pregunta' && [p.bloqueIndice, p.preguntaIndice]), [[0, 0], [0, 1], [1, 0]]);
});

test('15. una línea "Nombre: …" con varias frases es toda de ese personaje', () => {
  const pasos = armarGuion(caso('<p>Ana: No sé qué hacer. Estoy cansada. ¿Me ayudan?</p>'), elenco);
  const d = pasos.filter(p => p.tipo === 'dialogo');
  assert.equal(d.length, 3);
  assert.ok(d.every(p => p.tipo === 'dialogo' && p.personaje === 0));
  assert.equal(d[1].tipo === 'dialogo' && d[1].emocion, 'tristeza');
});

test('16. un hablante que no estaba en escena entra antes de hablar', () => {
  const pasos = armarGuion(caso('', [{ nombre: 'Oficina', contexto: 'Gloria: Buenos días, vengo de la comisaría.', preguntas: [] }]), elenco);
  assert.deepEqual(tipos(pasos), ['portada', 'transicion', 'entrada', 'dialogo', 'fin']);
});

test('17. el guion nunca dice cuál opción es correcta', () => {
  const conRespuestas = caso('<p>Texto.</p>', [{ nombre: 'A', contexto: 'B', preguntas: [{ enunciado: 'P', opciones: [{ texto: 'x', correcta: true, explicacion: 'secreto' }] }] }]);
  const json = JSON.stringify(armarGuion(conRespuestas, elenco));
  assert.ok(!json.includes('correcta') && !json.includes('secreto') && !json.includes('"x"'));
});

test('19. "muriendo" no es alegría y un rol del otro género no nombra al personaje ("don" no es una señora)', () => {
  assert.equal(expresionDe('Pensé que me estaba muriendo.'), null);
  const conSenora: PersonajeGuion[] = [
    { id: 0, nombre: 'Álvaro', rol: 'abuelo', genero: 'hombre', escenarios: [0] },
    { id: 1, nombre: 'Gladys', rol: 'senora', genero: 'mujer', escenarios: [0] }
  ];
  const pasos = armarGuion(caso('', [{ nombre: 'Parque', contexto: 'Don Álvaro ríe contento.', preguntas: [] }]), conSenora);
  const n = pasos.find(p => p.tipo === 'narracion');
  assert.deepEqual(n?.tipo === 'narracion' && n.reacciones, [{ personaje: 0, emocion: 'alegria', nivel: 'normal' }]);
});

test('20. un nombre por rol que empieza con artículo ("La sobreviviente") no se reconoce por "la"', () => {
  const porRol: PersonajeGuion[] = [{ id: 0, nombre: 'La sobreviviente', rol: 'adulta', genero: 'mujer', escenarios: [1] }];
  const pasos = armarGuion(caso('<p>Son las 11 de la noche en la casa.</p><p>La sobreviviente está en shock.</p>'), porRol);
  assert.deepEqual(tipos(pasos), ['portada', 'narracion', 'entrada', 'narracion', 'fin']);
});

test('18. sin personajes, todo lo cuenta el narrador', () => {
  const pasos = armarGuion(caso('<p>Ana: Hola.</p><p>—Adiós —dijo Ana.</p>'), []);
  assert.ok(pasos.every(p => p.tipo !== 'dialogo' && p.tipo !== 'entrada'));
  assert.equal(pasos.filter(p => p.tipo === 'narracion').length, 2);
});
