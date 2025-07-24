import { Component, OnInit } from '@angular/core';
import { ApiService } from '../../core/api.service';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';

@Component({
  selector: 'app-billing',
  standalone: true,
  imports: [MatCardModule, MatListModule],
  templateUrl: './billing.component.html',
  styleUrls: ['./billing.component.scss']
})
export class BillingComponent implements OnInit {
  invoices: any[] = [];

  constructor(private apiService: ApiService) {}

  ngOnInit() {
    this.apiService.getInvoices().subscribe(
      data => this.invoices = data.data,
      error => console.error(error)
    );
  }
}