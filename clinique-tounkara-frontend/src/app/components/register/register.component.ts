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
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatIconModule } from "@angular/material/icon";
import { CommonModule } from '@angular/common';

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
    MatNativeDateModule,
    MatProgressSpinnerModule,
    MatIconModule,
    CommonModule
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
    role: 'patient', // <-- Défini par défaut sur 'patient'
    date_naissance: null as Date | null,
    sexe: '',
    groupe_sanguin: ''
  };
  errorMessage: string = '';
  isLoading: boolean = false;
  maxDate: Date;

  constructor(private apiService: ApiService, private router: Router) {
    this.maxDate = new Date();
  }

  // onRoleChange() est supprimé car le rôle est fixe
  // onRoleChange() {
  //   if (this.userData.role !== 'patient') {
  //     this.userData.date_naissance = null;
  //     this.userData.sexe = '';
  //     this.userData.groupe_sanguin = '';
  //   }
  // }

  onSubmit() {
    this.errorMessage = '';
    this.isLoading = true;

    // Validation côté client
    // La validation du rôle n'est plus nécessaire ici car il est fixe.
    if (!this.userData.nom || !this.userData.prenom || !this.userData.email || !this.userData.password ||
        !this.userData.password_confirmation || !this.userData.telephone || !this.userData.adresse) { // Rôle retiré de cette ligne
      this.errorMessage = 'Veuillez remplir tous les champs obligatoires.';
      this.isLoading = false;
      return;
    }
    if (this.userData.password !== this.userData.password_confirmation) {
      this.errorMessage = 'Les mots de passe ne correspondent pas.';
      this.isLoading = false;
      return;
    }
    if (this.userData.password.length < 6) {
        this.errorMessage = 'Le mot de passe doit contenir au moins 6 caractères.';
        this.isLoading = false;
        return;
    }
    if (!this.isValidEmail(this.userData.email)) {
        this.errorMessage = 'Veuillez entrer une adresse email valide.';
        this.isLoading = false;
        return;
    }

    // Les validations spécifiques au patient sont maintenant toujours actives
    if (!this.userData.date_naissance || !this.userData.sexe) {
      this.errorMessage = 'La date de naissance et le sexe sont obligatoires.';
      this.isLoading = false;
      return;
    }
    if (this.userData.date_naissance && this.userData.date_naissance > this.maxDate) {
      this.errorMessage = 'La date de naissance ne peut pas être une date future.';
      this.isLoading = false;
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
        this.isLoading = false;
        this.errorMessage = '';
        console.log('Inscription réussie', response);
        this.router.navigate(['/login']);
      },
      (error) => {
        this.isLoading = false;
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

  // Validation simple d'email
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
