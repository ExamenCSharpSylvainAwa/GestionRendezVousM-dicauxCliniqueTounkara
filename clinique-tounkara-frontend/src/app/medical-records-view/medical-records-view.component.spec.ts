import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MedicalRecordsViewComponent } from './medical-records-view.component';

describe('MedicalRecordsViewComponent', () => {
  let component: MedicalRecordsViewComponent;
  let fixture: ComponentFixture<MedicalRecordsViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MedicalRecordsViewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MedicalRecordsViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
