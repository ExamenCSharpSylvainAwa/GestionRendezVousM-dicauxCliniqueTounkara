import { Component } from '@angular/core';
import { ApiService } from '../../core/api.service';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule } from '@angular/forms';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { MatIcon } from "@angular/material/icon"; // Nécessaire pour les directives comme @if

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    FormsModule,
    MatProgressSpinnerModule,
    CommonModule // Ajout de CommonModule
    ,
    MatIcon
],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  credentials = { email: '', password: '' };
  errorMessage: string = '';
  isLoading: boolean = false; // Indicateur de chargement

  constructor(private apiService: ApiService, private router: Router) {}

  onSubmit() {
    this.errorMessage = ''; // Réinitialiser le message d'erreur à chaque tentative
    this.isLoading = true; // Démarrer le chargement

    // --- Validation côté client améliorée ---
    if (!this.credentials.email.trim()) {
      this.errorMessage = 'L\'adresse email est requise.';
      this.isLoading = false;
      return;
    }
    if (!this.isValidEmail(this.credentials.email)) {
      this.errorMessage = 'Veuillez entrer une adresse email valide.';
      this.isLoading = false;
      return;
    }
    if (!this.credentials.password.trim()) {
      this.errorMessage = 'Le mot de passe est requis.';
      this.isLoading = false;
      return;
    }
    // Exemple de validation de longueur minimale pour le mot de passe
    if (this.credentials.password.length < 6) {
      this.errorMessage = 'Le mot de passe doit contenir au moins 6 caractères.';
      this.isLoading = false;
      return;
    }
    // --- Fin de la validation côté client ---

    this.apiService.login(this.credentials).subscribe(
      (response) => {
        this.isLoading = false; // Arrêter le chargement
        localStorage.setItem('token', response.access_token);
        localStorage.setItem('user', JSON.stringify(response.user));
        console.log('Connexion réussie', response);
        this.router.navigate(['/dashboard']);
      },
      (error: HttpErrorResponse) => {
        this.isLoading = false; // Arrêter le chargement en cas d'erreur
        console.error('Erreur API :', error);
        switch (error.status) {
          case 401:
            this.errorMessage = 'Identifiants invalides. Veuillez vérifier votre email et votre mot de passe.';
            break;
          case 403:
            this.errorMessage = 'Votre compte est désactivé. Veuillez contacter l\'administrateur.';
            break;
          case 400: // Souvent utilisé pour les erreurs de validation du backend
            if (error.error && error.error.message) {
                this.errorMessage = error.error.message; // Utilise le message du backend si disponible
            } else {
                this.errorMessage = 'Requête invalide. Veuillez vérifier les données soumises.';
            }
            break;
          case 500:
            this.errorMessage = 'Erreur serveur interne. Veuillez réessayer plus tard.';
            break;
          default:
            this.errorMessage = 'Une erreur inattendue est survenue. Veuillez réessayer.';
        }
      }
    );
  }

  goToRegister() {
    console.log('Navigating to register...');
    this.router.navigate(['/register']).then(success => {
      if (!success) {
        console.error('Navigation to /register failed');
      }
    }).catch(err => {
      console.error('Navigation error:', err);
      this.errorMessage = 'Impossible de rediriger vers l\'inscription.';
    });
  }

  // Validation simple d'email
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
