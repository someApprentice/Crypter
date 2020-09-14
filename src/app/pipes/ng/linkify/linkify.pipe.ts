import { Pipe, PipeTransform } from '@angular/core';

import { toUnicode, toASCII } from 'punycode';

@Pipe({
  name: 'linkify'
})
export class LinkifyPipe implements PipeTransform {
  // https://stackoverflow.com/a/190405/12948018
  readonly regexp: RegExp = /(((https?|ftps?):\/\/)?(?:www\.|(?!www)))?(((?!-))(((?!-))(xn--|_)?[a-z0-9-]{0,255}[a-z0-9]@)?(xn--|_)?[a-z0-9-]{0,255}[a-z0-9]\.)(xn--)?([a-z0-9][a-z0-9\-]{0,255}|[a-z0-9-]{1,30}\.[a-z]{2,})((?:[\+~%\/.\w-_]*)?\??(?:[-\+=&;%@.\w_]*)\#?(?:[\w]*))?/gmi;

  transform(value: string, args?: any): string {
    return toASCII(value).replace(this.regexp, (match: string) => {
      let href = `${match.toLowerCase()}`;

      if (match.indexOf('http') === -1 && match.indexOf('ftp') === -1)
        href = '//' + href;

      return `<a target="_blank" rel="noopener noreferrer" href="${href}">${toUnicode(match)}</a>`
    });
  }
}
