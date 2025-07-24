
import { Component } from '@angular/core';
import { ApiService } from '../../core/api.service';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { FormsModule } from '@angular/forms';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSelectModule,
    FormsModule,
    MatDatepickerModule,
    MatNativeDateModule
  ],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss']
})
export class RegisterComponent {
  userData = {
    nom: '',
    prenom: '',
    email: '',
    password: '',
    password_confirmation: '',
    telephone: '',
    adresse: '',
    role: 'patient',
    date_naissance: null as Date | null, // Type initial : Date ou null
    sexe: '',
    groupe_sanguin: ''
  };
  errorMessage: string = '';

  constructor(private apiService: ApiService, private router: Router) {}

  onRoleChange() {
    if (this.userData.role !== 'patient') {
      this.userData.date_naissance = null;
      this.userData.sexe = '';
      this.userData.groupe_sanguin = '';
    }
  }

  onSubmit() {
    // Validation côté client
    if (!this.userData.nom || !this.userData.prenom || !this.userData.email || !this.userData.password ||
        !this.userData.password_confirmation || !this.userData.telephone || !this.userData.adresse || !this.userData.role) {
      this.errorMessage = 'Veuillez remplir tous les champs obligatoires.';
      return;
    }
    if (this.userData.password !== this.userData.password_confirmation) {
      this.errorMessage = 'Les mots de passe ne correspondent pas.';
      return;
    }
    if (this.userData.role === 'patient' && (!this.userData.date_naissance || !this.userData.sexe)) {
      this.errorMessage = 'Pour un patient, la date de naissance et le sexe sont obligatoires.';
      return;
    }

    // Préparer les données pour l'envoi avec type explicite pour date_naissance
    const submitData = {
      ...this.userData,
      date_naissance: this.userData.date_naissance instanceof Date && !isNaN(this.userData.date_naissance.getTime())
        ? this.userData.date_naissance.toISOString().split('T')[0] // Format YYYY-MM-DD
        : null
    } as {
      nom: string;
      prenom: string;
      email: string;
      password: string;
      password_confirmation: string;
      telephone: string;
      adresse: string;
      role: string;
      date_naissance: string | null;
      sexe: string;
      groupe_sanguin: string;
    };

    this.apiService.register(submitData).subscribe(
      (response) => {
        this.errorMessage = '';
        console.log('Inscription réussie', response);
        this.router.navigate(['/login']);
      },
      (error) => {
        console.error('Erreur API : ', error);
        if (error.status === 422) {
          this.errorMessage = error.error?.errors
            ? Object.values(error.error.errors).flat().join(', ')
            : 'Erreur de validation. Vérifiez les champs.';
        } else if (error.status === 500) {
          this.errorMessage = 'Erreur serveur. Vérifiez les logs backend ou réessayez plus tard.';
        } else {
          this.errorMessage = error.error?.message || 'Erreur inconnue lors de l\'inscription.';
        }
      }
    );
  }

  onCancel() {
    this.router.navigate(['/login']);
  }
}