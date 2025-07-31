import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PrescriptionsViewComponent } from './prescriptions-view.component';

describe('PrescriptionsViewComponent', () => {
  let component: PrescriptionsViewComponent;
  let fixture: ComponentFixture<PrescriptionsViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PrescriptionsViewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PrescriptionsViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
