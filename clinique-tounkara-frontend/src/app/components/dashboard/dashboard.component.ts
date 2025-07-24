import { Component, OnInit } from '@angular/core';
import { ApiService } from '../../core/api.service';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { DatePipe, CommonModule } from '@angular/common'; // Ajout de CommonModule pour *ngFor
import { MatIconModule } from '@angular/material/icon'; // Ajout pour les icônes

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [MatCardModule, MatListModule, CommonModule, MatIconModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  welcomeMessage: string = 'Bienvenue à la Clinique Tounkara';
  services = [
    { title: 'Consultations Générales', icon: 'local_hospital', description: 'Prenez rendez-vous avec nos experts.' },
    { title: 'Examens Spécialisés', icon: 'medical_services', description: 'Diagnostics avancés disponibles.' },
    { title: 'Urgences 24/7', icon: 'emergency', description: 'Service d’urgence constant.' }
  ];
  testimonials = [
    { name: 'Marie Dupont', text: 'Service exceptionnel et équipe professionnelle !', rating: 5 },
    { name: 'Jean Martin', text: 'Prise en charge rapide et efficace.', rating: 4 }
  ];

  constructor(private apiService: ApiService) {}

  ngOnInit() {
    // Simulation de données (remplacez par des appels API si nécessaire)
  }
}