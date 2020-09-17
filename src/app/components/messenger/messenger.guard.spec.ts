import { TestBed, async, inject } from '@angular/core/testing';

import { MessengerGuard } from './messenger.guard';

describe('MessengerGuard', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [MessengerGuard]
    });
  });

  it('should ...', inject([MessengerGuard], (guard: MessengerGuard) => {
    expect(guard).toBeTruthy();
  }));
});
