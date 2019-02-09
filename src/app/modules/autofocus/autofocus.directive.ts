import { AfterContentInit, Directive, ElementRef, Input } from '@angular/core';

@Directive({
    selector: '[autofocus]'
})
export class AutofocusDirective implements AfterContentInit {
  private _autofocus;

  @Input() public set autofocus(value: any) {
    this._autofocus = value !== false
                   && value !== null
                   && value !== undefined
                   && value !== 0
                   && value !== 'false'
                   && value !== 'null'
                   && value !== 'undefined'
                   && value !== '0'
    ;
  }

  public constructor(private el: ElementRef) { }

  public ngAfterContentInit() {
    if (this._autofocus) {
      this.el.nativeElement.focus();
    }
  }
}
