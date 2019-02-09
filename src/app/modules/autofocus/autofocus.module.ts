import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { AutofocusDirective } from './autofocus.directive';

// should I make pull request for macking it standard angular functionality?
@NgModule({
  declarations: [AutofocusDirective],
  imports: [
    CommonModule
  ],
  exports: [
    AutofocusDirective
  ]
})
export class AutofocusModule { }
