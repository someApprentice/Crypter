import { TestBed, ComponentFixture, async } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { Component } from '@angular/core';

import { AutofocusModule } from './autofocus.module';
import { AutofocusDirective } from './autofocus.directive';

describe('AutofocusDirective', () => {
  @Component({template: `<input autofocus>`})
  class AutoFocusStubComponent {}

  @Component({template: `<input [autofocus]=true>`})
  class ThruthyConditionalAutoFocusStubComponent {}
  
  @Component({template: `<input [autofocus]=false>`})
  class FalsyConditionalAutoFocusStubComponent {}

  let autofocusComponent: AutoFocusStubComponent;
  let autofocusFixture: ComponentFixture<AutoFocusStubComponent>;

  let truthyConditionalAutofocusComponent: AutoFocusStubComponent;
  let truthyConditionalAutofocusFixture: ComponentFixture<AutoFocusStubComponent>;

  let falsyConditionalAutofocusComponent: AutoFocusStubComponent;
  let falsyConditionalAutofocusFixture: ComponentFixture<AutoFocusStubComponent>;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      declarations: [ AutoFocusStubComponent, ThruthyConditionalAutoFocusStubComponent, FalsyConditionalAutoFocusStubComponent ],
      imports:      [ AutofocusModule ]
    })
    .compileComponents();
  });

  it("should take focus after content init", () => {
    autofocusFixture = TestBed.createComponent(AutoFocusStubComponent);

    autofocusFixture.detectChanges();
    
    let inputDe = autofocusFixture.debugElement.query(By.directive(AutofocusDirective));

    let input = inputDe.nativeElement;

    expect(input).not.toBeNull();
    
    expect(document.activeElement).toBe(input);
  });

  it("should take focus after content init if condition is true", () => {
    truthyConditionalAutofocusFixture = TestBed.createComponent(AutoFocusStubComponent);

    truthyConditionalAutofocusFixture.detectChanges();
    
    let inputDe = truthyConditionalAutofocusFixture.debugElement.query(By.directive(AutofocusDirective));

    let input = inputDe.nativeElement;

    expect(input).not.toBeNull();
    
    expect(document.activeElement).toBe(input);
  });

  it("should not take focus after content init if condition is false", () => {
    falsyConditionalAutofocusFixture = TestBed.createComponent(FalsyConditionalAutoFocusStubComponent);

    falsyConditionalAutofocusFixture.detectChanges();
    
    let inputDe = falsyConditionalAutofocusFixture.debugElement.query(By.directive(AutofocusDirective));

    let input = inputDe.nativeElement;

    expect(input).not.toBeNull();
    
    expect(document.activeElement).not.toBe(input);
  });
});
