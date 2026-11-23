// Pruebas del motor del elenco. Se corren con: npm run test:novela (node --test, sin dependencias).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  asignarElenco, detectarPersonajes, idElencoDe, llevaCanas, personajesValidos, perfilDe,
  type ModeloCatalogo, type TextosCaso
} from './elenco.ts';

const catalogo: ModeloCatalogo[] = JSON.parse(
  readFileSync(new URL('../../../../public/personajes/catalogo/personajes.json', import.meta.url), 'utf8')
).personajes;

const sinTexto: TextosCaso = { nombre: '', desarrolloSituacional: '', contexto: '', bloques: [] };
const persona = (nombre: string, descripcion = '', escenarios = [0]) => ({ nombre, descripcion, escenarios });
const perfil = (nombre: string, descripcion = '', textos: TextosCaso = sinTexto) => perfilDe({ nombre, descripcion }, textos);

test('1. ignora los "Persona N" sin descripción y conserva los que sí tienen', () => {
  const validos = personajesValidos([
    persona('Persona 1'), persona('Persona 2', 'madre de 38 años'), persona('Laura'), persona('Persona 4')
  ], sinTexto);
  assert.deepEqual(validos.map(v => [v.indice, v.nombre]), [[1, 'Persona 2'], [2, 'Laura']]);
});

test('2. sin personajes válidos, los detecta en el texto del caso (nombres y roles, máximo 4)', () => {
  const textos: TextosCaso = {
    nombre: 'Caso Laura',
    desarrolloSituacional: '<p>Laura, la madre de 38 años, llega a urgencias con su hijo Mateo de 7 años. '
      + 'La trabajadora social del hospital la atiende. Álvaro, el abuelo, llega después. La policía también acude.</p>',
    bloques: [{ nombre: 'Urgencias', contexto: 'Laura espera' }, { nombre: 'Visita', contexto: 'La trabajadora social visita la casa de Mateo' }]
  };
  const detectados = detectarPersonajes(textos);
  assert.equal(detectados.length, 4);
  assert.deepEqual(detectados.map(d => d.nombre), ['Laura', 'Mateo', 'Trabajadora social', 'Álvaro']);
  assert.deepEqual(detectados[1].escenarios, [1], 'Mateo solo aparece en el escenario 2');
  const perfiles = detectados.map(d => perfilDe(d, textos));
  assert.equal(perfiles[0].etiqueta, 'Madre · 38 años');
  assert.equal(perfiles[1].etiqueta, 'Hijo · 7 años', 'el rol más cercano al nombre, no el primero de la oración');
});

test('3. perfil desde la descripción: género, edad y rol', () => {
  const p = perfil('Persona 1', 'Madre de 38 años, trabaja en una panadería');
  assert.equal(p.genero, 'mujer');
  assert.equal(p.edad, 38);
  assert.equal(p.rol, 'madre');
  assert.equal(p.etiqueta, 'Madre · 38 años');
  assert.equal(idElencoDe(p), 'M05');
});

test('4. el género sale del artículo cuando el rol es neutro ("el docente", "la estudiante")', () => {
  assert.equal(perfil('Persona 1', 'el docente del colegio').genero, 'hombre');
  assert.equal(perfil('Persona 2', 'la estudiante de grado once, 16 años').genero, 'mujer');
  assert.equal(idElencoDe(perfil('Persona 2', 'la estudiante de grado once, 16 años')), 'M02');
});

test('5. si la descripción no dice nada, usa el nombre (nombres comunes en Colombia) y luego el texto del caso', () => {
  assert.equal(perfil('Jhon Fredy').genero, 'hombre');
  assert.equal(perfil('Yesenia').genero, 'mujer');
  const textos: TextosCaso = { desarrolloSituacional: 'Don Hernán, el vecino de 63 años, escuchó los gritos.' };
  const p = perfil('Hernán', '', textos);
  assert.equal(p.rol, 'vecina');
  assert.equal(p.edad, 63);
  assert.equal(p.fuentes.edad, 'texto');
  assert.equal(idElencoDe(p), 'H09');
});

test('6. sin datos: mujer adulta de 30 años', () => {
  const p = perfil('X', '');
  assert.equal(p.genero, 'mujer');
  assert.equal(p.edad, 30);
  assert.equal(idElencoDe(p), 'M04');
});

test('7. Id del elenco por rol y por edad', () => {
  const casos: [string, string][] = [
    ['niña de 6 años', 'M01'], ['adolescente de 15 años, la hija', 'M02'], ['joven universitario de 20 años', 'H03'],
    ['mujer de 29 años', 'M04'], ['padre de 41 años', 'H05'], ['la docente de matemáticas', 'M06'],
    ['comisaria de familia', 'M06'], ['psicóloga del colegio', 'M07'], ['médico de urgencias', 'H07'],
    ['vecina de 52 años', 'M08'], ['abuela de 68 años', 'M09'], ['anciano de 82 años', 'H10'],
    ['patrullera de la policía', 'M11'], ['el policía del cuadrante', 'H11'],
    // Los roles de trabajo no aplican a menores ni a mayores de 60: manda la edad.
    ['médica jubilada de 70 años', 'M09'], ['estudiante de 9 años', 'M01']
  ];
  for (const [descripcion, esperado] of casos) assert.equal(idElencoDe(perfil('Persona 1', descripcion)), esperado, descripcion);
});

test('8. "trabajadora social" no se confunde con "trabajadora"; "comisaria" persona vs. lugar', () => {
  assert.equal(perfil('Persona 1', 'trabajadora social de 35 años').rol, 'trabajadora_social');
  const lugar: TextosCaso = { desarrolloSituacional: 'La familia fue a la comisaría de familia del barrio.' };
  assert.ok(!detectarPersonajes(lugar).some(d => /comisari/i.test(d.nombre)), 'la comisaría (lugar) no es un personaje');
  const personaje: TextosCaso = { desarrolloSituacional: 'La comisaria de familia escuchó a la niña.' };
  assert.ok(detectarPersonajes(personaje).some(d => /comisaria/i.test(d.nombre)));
});

test('9. asignación determinista: mismo caso, mismos modelos; otro caso puede cambiar', () => {
  const personajes = [persona('Ana', 'madre de 36 años'), persona('Luis', 'padre de 40 años'), persona('Sofía', 'niña de 8 años')];
  const a = asignarElenco(12, personajes, sinTexto, catalogo).map(x => x.modelo?.archivo);
  const b = asignarElenco(12, personajes, sinTexto, catalogo).map(x => x.modelo?.archivo);
  assert.deepEqual(a, b);
  assert.ok(a.every(Boolean));
});

test('10. nunca repite archivo en un caso y respeta no_juntar_con', () => {
  // Cuatro niñas: M01 solo tiene 2 modelos y se vetan entre sí (no_juntar_con) -> se buscan Ids cercanos.
  const personajes = [1, 2, 3, 4].map(n => persona(`Niña ${n}`, `niña de ${6 + n} años`));
  for (const casoId of [1, 2, 3, 99, 1234]) {
    const asignados = asignarElenco(casoId, personajes, sinTexto, catalogo);
    const archivos = asignados.map(x => x.modelo!.archivo);
    assert.equal(new Set(archivos).size, archivos.length, `repetido en el caso ${casoId}`);
    for (const x of asignados) {
      for (const otro of archivos) assert.ok(!x.modelo!.no_juntar_con.includes(otro), `${x.modelo!.archivo} junto a ${otro}`);
    }
    assert.ok(asignados.slice(1).some(x => x.avisos.some(a => a.includes('No hay modelo libre'))), 'avisa el cambio de Id');
  }
});

test('11. sin modelo para el Id: el más cercano en edad del mismo género', () => {
  const soloMayores = catalogo.filter(m => m.genero === 'hombre' && ['H08', 'H09', 'H10'].includes(m.id_elenco));
  const [x] = asignarElenco(5, [persona('Pedro', 'hombre de 47 años')], sinTexto, soloMayores.filter(m => m.id_elenco !== 'H08'));
  assert.equal(x.idElenco, 'H08');
  assert.equal(x.modelo!.id_elenco, 'H09', '47 años está más cerca de H09 (67) que de H10 (80)');
});

test('12. canas: todos los de 60+, algunos de 45–59, ninguno de menos (salvo que la descripción lo diga)', () => {
  const nunca = () => 0.99, siempre = () => 0;
  assert.equal(llevaCanas({ edad: 65, canas: null }, nunca), true);
  assert.equal(llevaCanas({ edad: 50, canas: null }, siempre), true);
  assert.equal(llevaCanas({ edad: 50, canas: null }, nunca), false);
  assert.equal(llevaCanas({ edad: 30, canas: null }, siempre), false);
  assert.equal(llevaCanas({ edad: 40, canas: true }, nunca), true);
  const abuela = asignarElenco(3, [persona('Rosa', 'abuela de 70 años')], sinTexto, catalogo)[0];
  assert.equal(abuela.aspecto.cabello.canas, true);
  assert.equal(abuela.aspecto.cabello.modo, abuela.modelo!.materiales_fusionados ? 'ninguno' : 'canvas');
});

test('13. aspecto: respeta lo que dice la descripción y no recolorea modelos con materiales fusionados', () => {
  const [x] = asignarElenco(8, [persona('Carmen', 'mujer afrodescendiente de 40 años, de ojos verdes y cabello negro')], sinTexto, catalogo);
  assert.equal(x.aspecto.piel, 'morena_oscura');
  assert.deepEqual(x.aspecto.iris, [0.34, 0.46, 0.3]);
  assert.equal(x.aspecto.cabello.canas, false);
  const fusionado = catalogo.find(m => m.materiales_fusionados)!;
  const [y] = asignarElenco(8, [persona('A', 'mujer de 30 años')], sinTexto, [fusionado]);
  assert.equal(y.aspecto.recolorear, false);
  assert.equal(y.aspecto.cabello.modo, 'ninguno');
});

test('14. "camisa blanca" o "chaqueta negra" no cambian el color de piel', () => {
  assert.equal(perfil('Persona 1', 'señor de camisa blanca y chaqueta negra').piel, null);
});

// ---- ropa de oficio (catálogo de prueba pequeño para que cada caso sea claro)
const modelo = (archivo: string, id_elenco: string, ropa_oficio: ModeloCatalogo['ropa_oficio']): ModeloCatalogo => ({
  archivo, id_elenco, ropa_oficio, extra: false, genero: id_elenco.startsWith('M') ? 'mujer' : 'hombre', edad_aparente: null,
  luminancia_cabello: 0.3, materiales_fusionados: false, no_juntar_con: [], materiales: {}
});
const elegido = (cat: ModeloCatalogo[], descripcion: string, casoId: number | string = 1) =>
  asignarElenco(casoId, [persona('Persona 1', descripcion)], sinTexto, cat)[0];

test('15. ropa de salud o de policía solo para ese rol: una madre nunca recibe bata ni uniforme', () => {
  const cat = [modelo('M05-bata.vrm', 'M05', 'salud'), modelo('M05-uniforme.vrm', 'M05', 'policia'), modelo('M05-comun.vrm', 'M05', null)];
  for (let caso = 1; caso <= 40; caso++) assert.equal(elegido(cat, 'madre de 38 años', caso).modelo!.archivo, 'M05-comun.vrm');
  // Si en ese Id solo hay bata y uniforme, busca en un Id cercano antes que vestirla de médica.
  const soloOficio = [modelo('M05-bata.vrm', 'M05', 'salud'), modelo('M08-comun.vrm', 'M08', null)];
  assert.equal(elegido(soloOficio, 'madre de 38 años').modelo!.archivo, 'M08-comun.vrm');
});

test('16. roles familiares o sin rol: prefieren ropa común; si no hay en ese Id, traje como segunda opción', () => {
  const cat = [modelo('M08-traje.vrm', 'M08', 'formal'), modelo('M08-comun.vrm', 'M08', null), modelo('M08-bata.vrm', 'M08', 'salud')];
  for (let caso = 1; caso <= 40; caso++) {
    assert.equal(elegido(cat, 'vecina de 52 años', caso).modelo!.archivo, 'M08-comun.vrm');
    assert.equal(elegido(cat, 'mujer de 50 años', caso).modelo!.archivo, 'M08-comun.vrm');
  }
  const sinComun = [modelo('M08-traje.vrm', 'M08', 'formal'), modelo('M08-bata.vrm', 'M08', 'salud'), modelo('M08-escolar.vrm', 'M08', 'escolar')];
  assert.equal(elegido(sinComun, 'vecina de 52 años').modelo!.archivo, 'M08-traje.vrm');
});

test('17. la médica y el policía prefieren su ropa de oficio (aunque esté en otro Id del mismo género)', () => {
  const cat = [modelo('M07-comun.vrm', 'M07', null), modelo('M07-bata.vrm', 'M07', 'salud')];
  for (let caso = 1; caso <= 20; caso++) assert.equal(elegido(cat, 'médica de urgencias', caso).modelo!.archivo, 'M07-bata.vrm');
  const policias = [modelo('H11-escolar.vrm', 'H11', 'escolar'), modelo('H06-uniforme.vrm', 'H06', 'policia'), modelo('H04-comun.vrm', 'H04', null)];
  const x = elegido(policias, 'el policía del cuadrante');
  assert.equal(x.idElenco, 'H11');
  assert.equal(x.modelo!.archivo, 'H06-uniforme.vrm');
  // Sin uniforme disponible, un policía usa traje o ropa común, nunca una bata.
  const sinUniforme = [modelo('H11-bata.vrm', 'H11', 'salud'), modelo('H11-comun.vrm', 'H11', null)];
  assert.equal(elegido(sinUniforme, 'el policía del cuadrante').modelo!.archivo, 'H11-comun.vrm');
});

test('19. uniforme de colegio solo para estudiantes menores; un universitario usa ropa común', () => {
  const cat = [modelo('H03-escolar.vrm', 'H03', 'escolar'), modelo('H03-comun.vrm', 'H03', null), modelo('H02-escolar.vrm', 'H02', 'escolar'), modelo('H02-comun.vrm', 'H02', null)];
  for (let caso = 1; caso <= 20; caso++) {
    assert.equal(elegido(cat, 'estudiante universitario de 21 años', caso).modelo!.archivo, 'H03-comun.vrm');
  }
  assert.ok(['H02-escolar.vrm', 'H02-comun.vrm'].includes(elegido(cat, 'el estudiante de 15 años').modelo!.archivo));
});

test('18. en el catálogo real: ningún familiar recibe ropa de salud o de policía', () => {
  const familiares = ['madre de 38 años', 'padre de 40 años', 'abuela de 70 años', 'abuelo de 72 años', 'vecina de 52 años',
    'vecino de 50 años', 'niña de 8 años', 'hijo de 15 años', 'mujer de 24 años', 'hombre de 30 años', 'tía de 40 años'];
  for (const descripcion of familiares) {
    for (let caso = 1; caso <= 25; caso++) {
      const ropa = elegido(catalogo, descripcion, caso).modelo!.ropa_oficio;
      assert.ok(ropa !== 'salud' && ropa !== 'policia', `${descripcion} (caso ${caso}) recibió ropa de ${ropa}`);
    }
  }
  assert.equal(elegido(catalogo, 'psicóloga de 38 años').modelo!.ropa_oficio, 'salud');
});
