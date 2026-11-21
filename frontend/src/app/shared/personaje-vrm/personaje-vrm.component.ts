import {
  AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, NgZone, OnDestroy,
  effect, inject, input, output, viewChild
} from '@angular/core';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRM, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import {
  CapacidadesExpresion, CaraVrm, NIVEL_POR_DEFECTO, NivelExpresion, buscarPartes, posarEnReposo, respirar
} from '../novela/cara-vrm';

export { NIVEL_POR_DEFECTO } from '../novela/cara-vrm';
export type { CapacidadesExpresion, NivelExpresion } from '../novela/cara-vrm';

/** Tiempos de carga en segundos: descarga del archivo, preparación del modelo y total hasta el primer cuadro. */
export interface TiemposCarga {
  descarga: number;
  preparacion: number;
  total: number;
  bytes: number;
}

/**
 * Personaje VRM en plano de busto (solo demostración: /demo-personaje).
 * Dibuja sobre un canvas transparente que se adapta a su contenedor. La cara (expresiones por niveles,
 * parpadeo y bocas) la maneja CaraVrm, la misma que usa la escena de novela.
 */
@Component({
  selector: 'app-personaje-vrm',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<canvas #lienzo></canvas>`,
  styles: [`
    :host { display: block; width: 100%; height: 100%; position: relative; }
    canvas { display: block; width: 100%; height: 100%; }
  `]
})
export class PersonajeVrmComponent implements AfterViewInit, OnDestroy {
  readonly url = input.required<string>();
  readonly expresion = input<string>('neutral');
  readonly hablando = input<boolean>(false);
  readonly nivel = input<NivelExpresion>(NIVEL_POR_DEFECTO);

  readonly progreso = output<number>();
  readonly cargado = output<void>();
  readonly fallo = output<string>();
  readonly tiempos = output<TiemposCarga>();
  readonly capacidades = output<CapacidadesExpresion>();

  private readonly zona = inject(NgZone);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly lienzo = viewChild.required<ElementRef<HTMLCanvasElement>>('lienzo');

  private renderer?: THREE.WebGLRenderer;
  private escena = new THREE.Scene();
  private camara = new THREE.PerspectiveCamera(22, 1, 0.1, 20);
  private reloj = new THREE.Clock();
  private vrm?: VRM;
  /** Expresiones del personaje cargado (público para las herramientas de tools/medir). */
  cara?: CaraVrm;
  private raf = 0;
  private observador?: ResizeObserver;
  private destruido = false;
  private movimientoReducido = false;
  /** Medición en curso: se completa al dibujar el primer cuadro con el personaje. */
  private medicion?: { inicio: number; descarga: number; preparacion: number; bytes: number };

  constructor() {
    // Recalcula los pesos objetivo cada vez que cambian las entradas.
    // Las entradas se leen siempre (aunque aún no haya modelo) para que el efecto se vuelva a ejecutar.
    effect(() => {
      const expresion = this.expresion(), nivel = this.nivel(), hablando = this.hablando();
      this.cara?.fijar(expresion, nivel, hablando);
    });
  }

  ngAfterViewInit(): void {
    this.movimientoReducido = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    this.zona.runOutsideAngular(() => {
      const renderer = new THREE.WebGLRenderer({ canvas: this.lienzo().nativeElement, alpha: true, antialias: true });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0x000000, 0);
      this.renderer = renderer;

      const luz = new THREE.DirectionalLight(0xffffff, 2.2);
      luz.position.set(0.3, 1.2, 1.5);
      this.escena.add(luz, new THREE.AmbientLight(0xffffff, 0.35));

      this.observador = new ResizeObserver(() => this.ajustarTamano());
      this.observador.observe(this.host.nativeElement);
      this.ajustarTamano();
      this.cargarModelo();
      this.bucle();
    });
  }

  ngOnDestroy(): void {
    this.destruido = true;
    cancelAnimationFrame(this.raf);
    this.observador?.disconnect();
    if (this.vrm) {
      this.escena.remove(this.vrm.scene);
      VRMUtils.deepDispose(this.vrm.scene);
    }
    this.renderer?.dispose();
    this.renderer?.forceContextLoss();
  }

  /** Descarga el archivo (sin caché, para medir como una primera visita) y luego prepara el modelo. */
  private async cargarModelo(): Promise<void> {
    const inicio = performance.now();
    try {
      const buffer = await this.descargar(this.url());
      const descarga = performance.now() - inicio;
      if (this.destruido) return;

      const cargador = new GLTFLoader();
      cargador.register(parser => new VRMLoaderPlugin(parser));
      const gltf = await cargador.parseAsync(buffer, '');
      const vrm = gltf.userData['vrm'] as VRM | undefined;
      if (this.destruido) { if (gltf.scene) VRMUtils.deepDispose(gltf.scene); return; }
      if (!vrm) throw new Error('El archivo no contiene un modelo VRM válido.');
      const cara = new CaraVrm(vrm, buscarPartes(gltf.scene, gltf.parser));
      cara.movimientoReducido = this.movimientoReducido;
      VRMUtils.removeUnnecessaryVertices(gltf.scene);
      VRMUtils.rotateVRM0(vrm);
      vrm.scene.traverse(o => { o.frustumCulled = false; });
      this.vrm = vrm;
      posarEnReposo(vrm);
      this.escena.add(vrm.scene);
      if (vrm.lookAt) vrm.lookAt.target = this.camara;
      vrm.update(0);
      this.encuadrar(vrm);
      const preparacion = performance.now() - inicio - descarga;
      // El total se cierra en el bucle, cuando se dibuja el primer cuadro con el personaje.
      this.medicion = { inicio, descarga, preparacion, bytes: buffer.byteLength };
      // Con el modelo ya cargado se sabe qué partes y expresiones trae: se fijan los objetivos.
      cara.fijar(this.expresion(), this.nivel(), this.hablando());
      this.cara = cara;
      this.zona.run(() => {
        this.capacidades.emit(cara.capacidades());
        this.cargado.emit();
      });
    } catch (error) {
      if (this.destruido) return;
      const mensaje = error instanceof Error ? error.message : String(error);
      this.zona.run(() => this.fallo.emit(mensaje || 'No se pudo cargar el modelo.'));
    }
  }

  private async descargar(url: string): Promise<ArrayBuffer> {
    const respuesta = await fetch(url, { cache: 'no-store' });
    if (!respuesta.ok) throw new Error(`El servidor respondió ${respuesta.status} al pedir ${url}`);
    const tipo = respuesta.headers.get('content-type') ?? '';
    if (tipo.includes('text/html')) throw new Error(`${url} no existe (el servidor devolvió una página HTML).`);
    // Con compresión el content-length es el tamaño comprimido; el avance se limita a 99 %.
    const total = Number(respuesta.headers.get('content-length')) || 0;
    if (!respuesta.body) return respuesta.arrayBuffer();
    const lector = respuesta.body.getReader();
    const partes: Uint8Array[] = [];
    let recibidos = 0;
    for (;;) {
      const { done, value } = await lector.read();
      if (done) break;
      partes.push(value);
      recibidos += value.byteLength;
      if (total) {
        const avance = Math.min(99, Math.round((recibidos / total) * 100));
        this.zona.run(() => this.progreso.emit(avance));
      }
    }
    const datos = new Uint8Array(recibidos);
    let pos = 0;
    for (const p of partes) { datos.set(p, pos); pos += p.byteLength; }
    return datos.buffer;
  }

  /** Plano de busto a partir de la altura mundial del hueso de la cabeza. */
  private encuadrar(vrm: VRM): void {
    const cabeza = vrm.humanoid.getNormalizedBoneNode('head');
    const pos = new THREE.Vector3();
    cabeza?.getWorldPosition(pos);
    const y = (cabeza ? pos.y : 1.4) - 0.08;
    this.camara.position.set(0, y, 1.9);
    this.camara.lookAt(0, y, 0);
  }

  private ajustarTamano(): void {
    if (!this.renderer) return;
    const { clientWidth: w, clientHeight: h } = this.host.nativeElement;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camara.aspect = w / h;
    // En contenedores verticales se abre el campo para no cortar hombros.
    this.camara.fov = w / h < 0.8 ? 30 : 22;
    this.camara.updateProjectionMatrix();
  }

  private bucle = (): void => {
    if (this.destruido) return;
    this.raf = requestAnimationFrame(this.bucle);
    const dt = Math.min(this.reloj.getDelta(), 0.1);
    const t = this.reloj.elapsedTime;
    const vrm = this.vrm;
    if (vrm && this.cara && this.renderer) {
      this.cara.antesDeActualizar(dt);
      if (!this.movimientoReducido) respirar(vrm, t);
      vrm.update(dt);
      this.cara.despuesDeActualizar();
    }
    this.renderer?.render(this.escena, this.camara);
    if (this.medicion && vrm) {
      const m = this.medicion;
      this.medicion = undefined;
      const s = (ms: number) => Math.round(ms) / 1000;
      const tiempos: TiemposCarga = {
        descarga: s(m.descarga), preparacion: s(m.preparacion), total: s(performance.now() - m.inicio), bytes: m.bytes
      };
      this.zona.run(() => this.tiempos.emit(tiempos));
    }
  };
}
