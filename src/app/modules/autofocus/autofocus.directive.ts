import { AfterContentInit, Directive, ElementRef, Input } from '@angular/core';

@Directive({
    selector: '[autofocus]'
})
export class AutofocusDirective implements AfterContentInit {
  private _autofocus: boolean;

  @Input() public set autofocus(value: any) {
    console.log('autofocus', value);
    this._autofocus = value !== false
                   && value !== null
                   && value !== undefined
                   && value !== 0
                   && value !== 'false'
                   && value !== 'null'
                   && value !== 'undefined'
                   && value !== '0'
                   && value !== ''
    ;
  }

  public constructor(private el: ElementRef) { }

  public ngAfterContentInit() {
    if (this._autofocus) {
      this.el.nativeElement.focus();
    }
  }
}
