import { Pipe, PipeTransform, SecurityContext } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

import { escape } from 'lodash';

@Pipe({
  name: 'sanitize'
})
export class SanitizePipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) { }

  transform(value: string, args?: any): string {
    return this.sanitizer.sanitize(SecurityContext.HTML, escape(value));
  }
}
