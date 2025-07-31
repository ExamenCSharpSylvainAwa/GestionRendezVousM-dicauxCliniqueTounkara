import { Component, OnInit } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSelectModule } from '@angular/material/select';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { MatIcon } from "@angular/material/icon";

interface User {
  id?: number;
  prenom: string;
  nom: string;
  email: string;
  telephone?: string;
  role: string;
  patient?: {
    numero_assurance?: string;
    adresse?: string;
    date_naissance?: string;
    sexe?: string;
    groupe_sanguin?: string;
    antecedent_medicaux?: string;
  };
  medecin?: {
    specialite?: string;
    numero_ordre?: string;
    horaire_consultation?: string; // Ajout explicite
    tarif_consultation?: number;
    disponible?: boolean;
  };
  personnel?: { poste?: string };
  administrateur?: { niveau?: string; permissions?: string };
}

@Component({
  selector: 'app-profile-edit',
  standalone: true,
  imports: [
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    FormsModule,
    CommonModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatProgressSpinnerModule,
    MatCheckboxModule,
    MatSelectModule,
    MatIcon
],
  templateUrl: './profile-edit.component.html',
  styleUrls: ['./profile-edit.component.scss']
})
export class ProfileEditComponent implements OnInit {
  user: User = { prenom: '', nom: '', email: '', role: '' };
  editedUser: User = { prenom: '', nom: '', email: '', role: '' };
  errorMessage: string = '';
  isLoading: boolean = false;

  constructor(private http: HttpClient, private router: Router) {}

  ngOnInit() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user && user.id) {
      this.user = { ...user };
      this.editedUser = { ...user };
      this.initializeNestedObjects();
    } else {
      this.errorMessage = 'Utilisateur non trouvé';
    }
  }

  private initializeNestedObjects() {
    switch (this.editedUser.role) {
      case 'patient':
        this.editedUser.patient = this.editedUser.patient || {};
        break;
      case 'medecin':
        this.editedUser.medecin = this.editedUser.medecin || { horaire_consultation: '09:00-17:00' }; // Valeur par défaut
        break;
      case 'personnel':
        this.editedUser.personnel = this.editedUser.personnel || {};
        break;
      case 'administrateur':
        this.editedUser.administrateur = this.editedUser.administrateur || {};
        break;
    }
  }

  get patientData() { return this.editedUser.patient || {}; }
  get medecinData() { return this.editedUser.medecin || {}; }
  get personnelData() { return this.editedUser.personnel || {}; }
  get administrateurData() { return this.editedUser.administrateur || {}; }

  updatePatientField(field: string, value: any) {
    if (!this.editedUser.patient) this.editedUser.patient = {};
    (this.editedUser.patient as any)[field] = value;
  }

  updateMedecinField(field: string, value: any) {
    if (!this.editedUser.medecin) this.editedUser.medecin = { horaire_consultation: '09:00-17:00' }; // Valeur par défaut
    (this.editedUser.medecin as any)[field] = value;
  }

  updatePersonnelField(field: string, value: any) {
    if (!this.editedUser.personnel) this.editedUser.personnel = {};
    (this.editedUser.personnel as any)[field] = value;
  }

  updateAdministrateurField(field: string, value: any) {
    if (!this.editedUser.administrateur) this.editedUser.administrateur = {};
    (this.editedUser.administrateur as any)[field] = value;
  }

  onSubmit() {
    if (!this.validateForm()) return;

    this.isLoading = true;
    this.errorMessage = '';

    const url = `http://localhost:8000/api/users/${this.editedUser.id}`;
    console.log('Données envoyées:', this.editedUser);
    this.http.put(url, this.editedUser, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    }).subscribe({
      next: (response: any) => {
        console.log('Réponse du serveur:', response);
        localStorage.setItem('user', JSON.stringify(this.editedUser));
        this.isLoading = false;
        this.router.navigate(['/dashboard']);
      },
      error: (error) => {
        console.error('Erreur détaillée:', error);
        this.errorMessage = `Erreur: ${error.status} - ${error.error?.message || error.message || 'Aucune description'}`;
        this.isLoading = false;
      }
    });
  }

  private validateForm(): boolean {
    if (!this.editedUser.prenom.trim() || !this.editedUser.nom.trim() || !this.editedUser.email.trim()) {
      this.errorMessage = 'Les champs prénom, nom et email sont requis';
      return false;
    }

   if (this.editedUser.role === 'patient' && this.editedUser.patient && this.editedUser.patient.numero_assurance) {
    console.log('Valeur de numero_assurance:', this.editedUser.patient.numero_assurance);
    if (!/^ASS\d{6,}$/.test(this.editedUser.patient.numero_assurance)) {
      this.errorMessage = 'Numéro d\'assurance invalide. Il doit commencer par "ASS" suivi d\'au moins 6 chiffres.';
      return false;
    }
  }
    if (this.editedUser.role === 'medecin' && this.editedUser.medecin) {
      if (!this.editedUser.medecin.specialite) {
        this.errorMessage = 'La spécialité est requise';
        return false;
      }
      
    }
    return true;
  }

  getUserRole(): string {
    return this.user.role || '';
  }
}