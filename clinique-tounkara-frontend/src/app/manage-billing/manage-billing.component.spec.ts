import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ManageBillingComponent } from './manage-billing.component';

describe('ManageBillingComponent', () => {
  let component: ManageBillingComponent;
  let fixture: ComponentFixture<ManageBillingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ManageBillingComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ManageBillingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
