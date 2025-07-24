import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RescheduleAppointmentDialogComponent } from './reschedule-appointment-dialog.component';

describe('RescheduleAppointmentDialogComponent', () => {
  let component: RescheduleAppointmentDialogComponent;
  let fixture: ComponentFixture<RescheduleAppointmentDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RescheduleAppointmentDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RescheduleAppointmentDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
