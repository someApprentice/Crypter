import { environment } from '../../../environments/environment';

import { Directive, Input, ElementRef, Inject, NgZone, AfterViewInit, OnDestroy, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

import { PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, isPlatformServer } from '@angular/common';

declare const grecaptcha: any; // ReCaptchaV2.ReCaptcha

declare global {
  interface Window {
    grecaptcha: any;
    gRecaptchaOnLoad: () => void
  }
};

@Directive({
  selector: '[gRecaptcha]',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RecaptchaDirective),
      multi: true
    }
  ]
})
export class RecaptchaDirective implements ControlValueAccessor, AfterViewInit, OnDestroy {
  @Input() key: string;

  grecaptcha?: any; // ReCaptchaV2.ReCaptcha

  onChange = (...args: any[]) => { };
  onTouched = (...args: any[]) => { };

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private el: ElementRef,
    private zone: NgZone
  ) { }

  ngAfterViewInit() {
    if (isPlatformBrowser(this.platformId)) {
      let script: HTMLScriptElement|null = document.querySelector(`script[src="${environment.recaptcha_url}"]`);

      if (!script) {
        window.gRecaptchaOnLoad = () => {
          this.grecaptcha = grecaptcha;

          this.grecaptcha.render(this.el.nativeElement, {
            'sitekey': this.key,
            'callback': this.onSuccess.bind(this),
            'expired-callback': this.onExpired.bind(this)
          });
        };

        script = document.createElement('script');

        script.src = environment.recaptcha_url;
        script.async = true;
        script.defer = true;

        document.body.appendChild(script);
      }
    }
  }

  writeValue(value: any) {
    if (!value && !!this.grecaptcha) {
      this.grecaptcha.reset();
    }
  }

  registerOnChange(fn: any) {
    this.onChange = fn;
  }

  registerOnTouched(fn: any) {
    this.onTouched = fn;
  }

  onSuccess(token: string) {
    this.zone.run(() => {
      this.onChange(token);
      this.onTouched(token);
    });
  }

  onExpired() {
    this.zone.run(() => {
      this.onChange(null);
      this.onTouched(null);
    });
  }

  ngOnDestroy() {
    if (isPlatformBrowser(this.platformId)) {
      delete window.gRecaptchaOnLoad;

      let script: HTMLScriptElement|null = document.querySelector(`script[src="${environment.recaptcha_url}"]`);

      if (script)
        script.remove();
    }
  }
}
