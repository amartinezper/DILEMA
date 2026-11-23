import { Component, ElementRef, OnDestroy, effect, input, model, viewChild } from '@angular/core';

@Component({
  selector: 'app-editor',
  template: `
    <div class="editor">
      <div class="editor-bar">
        <button type="button" (mousedown)="$event.preventDefault()" (click)="cmd('bold')" [disabled]="bloqueado()">Negrita</button>
        <button type="button" (mousedown)="$event.preventDefault()" (click)="cmd('italic')" [disabled]="bloqueado()">Cursiva</button>
        <button type="button" (mousedown)="$event.preventDefault()" (click)="cmd('insertUnorderedList')" [disabled]="bloqueado()">Lista</button>
      </div>
      <div #area class="editor-area" [attr.contenteditable]="bloqueado() ? 'false' : 'true'" (input)="emitir()"></div>
    </div>
  `
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
