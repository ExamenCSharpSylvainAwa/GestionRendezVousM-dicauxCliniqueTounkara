import { Component, OnInit } from '@angular/core';
import { ApiService } from '../../core/api.service';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [MatCardModule],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.scss']
})
export class AdminComponent implements OnInit {
  users: any[] = [];

  constructor(private apiService: ApiService) {}

  ngOnInit() {
    // À implémenter : Récupérer la liste des utilisateurs
  }
}