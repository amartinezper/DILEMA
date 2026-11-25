import { Component, ElementRef, OnDestroy, effect, input, model, viewChild } from '@angular/core';

@Component({
  selector: 'app-editor',
  template: `
    <div class="editor">
      <div class="editor-bar">
        <button type="button" title="Negrita" aria-label="Negrita" (mousedown)="$event.preventDefault()" (click)="cmd('bold')" [disabled]="bloqueado()"><b>B</b></button>
        <button type="button" title="Cursiva" aria-label="Cursiva" (mousedown)="$event.preventDefault()" (click)="cmd('italic')" [disabled]="bloqueado()"><i>I</i></button>
        <button type="button" title="Lista" aria-label="Lista" (mousedown)="$event.preventDefault()" (click)="cmd('insertUnorderedList')" [disabled]="bloqueado()">
          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
        <span class="editor-extra"><ng-content /></span>
      </div>
      <div #area class="editor-area" [attr.contenteditable]="bloqueado() ? 'false' : 'true'" (input)="emitir()"></div>
    </div>
  `,
  styles: [`
    .editor-bar { display: flex; align-items: center; gap: 2px; padding: 4px 8px; background: #f8fbff; border-bottom: 1px solid #e1e9f6; }
    .editor-bar > button { width: 30px; height: 28px; display: grid; place-items: center; padding: 0; border: 0; border-radius: 8px;
      background: transparent; color: #4d5b7c; font: inherit; font-size: 13px; font-weight: 800; cursor: pointer; box-shadow: none; }
    .editor-bar > button:hover:not(:disabled) { background: #e8eef9; transform: none; }
    .editor-bar > button svg { display: block; }
    .editor-extra { margin-left: auto; display: flex; align-items: center; }
    .editor-extra:empty { display: none; }
  `]
})
export class EditorTextoComponent implements OnDestroy {
  valor = model('');
  bloqueado = input(false);
  private area = viewChild<ElementRef<HTMLDivElement>>('area');
  /** Última posición del cursor dentro del área (se pierde al pulsar un botón fuera del editor). */
  private ultimaSeleccion: Range | null = null;
  private readonly recordar = () => {
    const sel = document.getSelection();
    const nodo = this.area()?.nativeElement;
    if (sel?.rangeCount && nodo && nodo.contains(sel.getRangeAt(0).commonAncestorContainer)) {
      this.ultimaSeleccion = sel.getRangeAt(0).cloneRange();
    }
  };

  constructor() {
    effect(() => {
      const texto = this.valor() || '';
      const nodo = this.area()?.nativeElement;
      if (!nodo || document.activeElement === nodo) return;
      if (nodo.innerHTML !== texto) nodo.innerHTML = texto;
    });
    document.addEventListener('selectionchange', this.recordar);
  }

  ngOnDestroy(): void {
    document.removeEventListener('selectionchange', this.recordar);
  }

  emitir() {
    this.valor.set(this.area()?.nativeElement.innerHTML ?? '');
  }

  cmd(comando: string) {
    document.execCommand(comando);
    this.emitir();
  }

  /**
   * Inserta `texto` en una línea nueva donde estaba el cursor (o al final si nunca se tocó el editor).
   * Si el cursor está en una línea vacía, se escribe en esa misma línea.
   */
  insertarLinea(texto: string) {
    const nodo = this.area()?.nativeElement;
    if (!nodo || this.bloqueado()) return;
    nodo.focus();
    const sel = document.getSelection();
    if (!sel) return;
    sel.removeAllRanges();
    if (this.ultimaSeleccion && nodo.contains(this.ultimaSeleccion.commonAncestorContainer)) {
      sel.addRange(this.ultimaSeleccion);
    } else {
      const fin = document.createRange();
      fin.selectNodeContents(nodo);
      fin.collapse(false);
      sel.addRange(fin);
    }
    const rango = sel.getRangeAt(0);
    const antes = document.createRange();
    antes.setStart(nodo, 0);
    antes.setEnd(rango.startContainer, rango.startOffset);
    const textoAntes = antes.toString();
    const lineaVacia = !textoAntes || /\n$/.test(textoAntes) || (rango.startContainer.textContent ?? '').trim() === '';
    if (!lineaVacia) document.execCommand('insertParagraph');
    document.execCommand('insertText', false, texto);
    this.recordar();
    this.emitir();
  }
}
