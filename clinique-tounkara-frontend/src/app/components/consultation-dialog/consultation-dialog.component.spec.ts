import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConsultationDialogComponent } from './consultation-dialog.component';

describe('ConsultationDialogComponent', () => {
  let component: ConsultationDialogComponent;
  let fixture: ComponentFixture<ConsultationDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConsultationDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ConsultationDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
