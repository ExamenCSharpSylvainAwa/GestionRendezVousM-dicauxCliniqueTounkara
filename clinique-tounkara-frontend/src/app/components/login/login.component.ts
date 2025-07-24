
import { Component } from '@angular/core';
import { ApiService } from '../../core/api.service';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule } from '@angular/forms';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner'; // Import ajouté
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    FormsModule,
    MatProgressSpinnerModule // Ajouté ici
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
    // Validation côté client
    if (!this.credentials.email.trim() || !this.credentials.password.trim()) {
      this.errorMessage = 'Veuillez remplir tous les champs correctement.';
      return;
    }
    if (!this.isValidEmail(this.credentials.email)) {
      this.errorMessage = 'Veuillez entrer un email valide.';
      return;
    }

    this.isLoading = true; // Démarrer le chargement
    this.errorMessage = ''; // Réinitialiser le message d'erreur

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
            this.errorMessage = 'Identifiants invalides.';
            break;
          case 403:
            this.errorMessage = 'Compte désactivé.';
            break;
          case 500:
            this.errorMessage = 'Erreur serveur. Réessayez plus tard.';
            break;
          default:
            this.errorMessage = 'Échec de la connexion. Vérifiez vos identifiants ou le serveur.';
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