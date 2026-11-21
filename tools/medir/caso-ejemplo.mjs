// Caso de ejemplo para probar el guion y la vista previa (mismo formato que el Caso del docente).
export const casoEjemplo = {
  id: 777, nombre: 'Mateo en urgencias', estado: 'BORRADOR', tiempoEstimadoMin: 30, sensible: false, advertencia: '',
  repartoRubrica: 'PONDERADA', rubrica: [], contexto: '<p>Posible maltrato infantil.</p>',
  desarrolloSituacional:
    '<p>Ana, la madre de 38 años, llega a urgencias con su hijo Mateo de 7 años. Mateo tiene un golpe en el brazo y llora en silencio.</p>' +
    '<p>Ana: No sé qué le pasó, doctora. Estaba jugando en el patio.</p>' +
    '<p>—Me caí de la escalera —murmuró Mateo.</p>' +
    '<p>La abuela Rosa llega preocupada y abraza a su nieto.</p>',
  bloques: [
    {
      id: 1, nombre: 'Consulta en urgencias',
      contexto: 'La psicóloga Laura entra al consultorio.\nLaura: Buenas tardes, ¿cómo te sientes, Mateo?\nMateo sonríe un poco.\nAna dijo: "Gracias por atendernos tan rápido."',
      preguntas: [
        { id: 11, enunciado: '<p>¿Qué debe hacer primero la psicóloga?</p>', pista: 'Piensa en la seguridad del niño.', criterio: 'Prioridad', peso: 2,
          opciones: [
            { id: 111, texto: 'Hablar a solas con Mateo en un espacio seguro.', correcta: true, explicacion: 'Permite que el niño hable sin presión.', fundamento: 'Protocolo de atención a menores.' },
            { id: 112, texto: 'Pedirle a Ana que explique otra vez.', correcta: false, explicacion: 'No aporta información nueva.', fundamento: '' }
          ] },
        { id: 12, enunciado: '<p>¿A quién se debe informar?</p>', pista: '', criterio: 'Ruta', peso: 1.5,
          opciones: [
            { id: 121, texto: 'A la comisaría de familia.', correcta: true, explicacion: 'Activa la ruta de protección.', fundamento: 'Ley 1098 de 2006.' },
            { id: 122, texto: 'A nadie todavía.', correcta: false, explicacion: '', fundamento: '' }
          ] }
      ]
    },
    {
      id: 2, nombre: 'Visita a la casa en la noche',
      contexto: 'Esa noche, la trabajadora social visita la casa. De repente, el padre llega gritando furioso.\nAna baja la mirada.\n—No me hagan esto —sollozó Ana.',
      preguntas: [
        { id: 21, enunciado: '<p>¿Cómo debe actuar la trabajadora social?</p>', pista: null, criterio: 'Seguridad', peso: 1.5,
          opciones: [
            { id: 211, texto: 'Mantener la calma y pedir apoyo a la policía si hay riesgo.', correcta: true, explicacion: 'Prioriza la seguridad.', fundamento: 'Protocolo de visita domiciliaria.' },
            { id: 212, texto: 'Discutir con el padre.', correcta: false, explicacion: '', fundamento: '' }
          ] }
      ]
    }
  ],
  personajes: [
    { id: 1, nombre: 'Ana', descripcion: 'madre de 38 años', escenarios: [0, 1] },
    { id: 2, nombre: 'Mateo', descripcion: 'niño de 7 años, hijo de Ana', escenarios: [0, 1] },
    { id: 3, nombre: 'Rosa', descripcion: 'abuela de 68 años', escenarios: [] },
    { id: 4, nombre: 'Laura', descripcion: 'psicóloga de 40 años', escenarios: [0] }
  ]
};
