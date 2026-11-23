/**
 * Foto de portada del caso: se prepara en el navegador antes de subirla.
 * Recorte centrado a 1200 x 675 (16:9) y compresión en WebP (o JPEG si el navegador no genera WebP)
 * hasta quedar en unos 300 KB. El backend acepta como máximo 400 KB.
 */
export const PORTADA_ANCHO = 1200;
export const PORTADA_ALTO = 675;
export const PORTADA_MAX_BYTES = 300 * 1024;

export async function prepararPortada(archivo: File): Promise<Blob> {
  if (!archivo.type.startsWith('image/')) throw new Error('El archivo no es una imagen.');
  let imagen: ImageBitmap;
  try {
    imagen = await createImageBitmap(archivo);
  } catch {
    throw new Error('No se pudo leer la imagen. Prueba con una foto JPG, PNG o WebP.');
  }
  const lienzo = document.createElement('canvas');
  lienzo.width = PORTADA_ANCHO;
  lienzo.height = PORTADA_ALTO;
  const contexto = lienzo.getContext('2d');
  if (!contexto) throw new Error('El navegador no pudo preparar la imagen.');
  // Recorte centrado que cubre todo el 16:9, como object-fit: cover.
  const escala = Math.max(PORTADA_ANCHO / imagen.width, PORTADA_ALTO / imagen.height);
  const ancho = PORTADA_ANCHO / escala;
  const alto = PORTADA_ALTO / escala;
  contexto.imageSmoothingQuality = 'high';
  contexto.drawImage(imagen, (imagen.width - ancho) / 2, (imagen.height - alto) / 2, ancho, alto, 0, 0, PORTADA_ANCHO, PORTADA_ALTO);
  imagen.close();

  for (const tipo of ['image/webp', 'image/jpeg']) {
    for (let calidad = 0.85; calidad >= 0.45; calidad -= 0.1) {
      const blob = await new Promise<Blob | null>((listo) => lienzo.toBlob(listo, tipo, calidad));
      if (!blob || blob.type !== tipo) break; // este navegador no genera ese formato: se prueba el siguiente
      if (blob.size <= PORTADA_MAX_BYTES) return blob;
    }
  }
  throw new Error('No se pudo dejar la imagen por debajo de 300 KB. Prueba con otra foto.');
}
