import { Component, Inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule, DateAdapter, MAT_DATE_LOCALE, MAT_DATE_FORMATS, NativeDateAdapter } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { UserFormData, ApiService } from '../services/api.service';

// Custom date formats for Angular Material
export const MY_DATE_FORMATS = {
  parse: {
    dateInput: 'DD/MM/YYYY',
  },
  display: {
    dateInput: 'DD/MM/YYYY',
    monthYearLabel: 'MMM YYYY',
    dateA11yLabel: 'LL',
    monthYearA11yLabel: 'MMMM YYYY',
  },
};

@Component({
  selector: 'app-user-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatIconModule,
    MatSlideToggleModule
  ],
  templateUrl: './user-dialog.component.html',
  styleUrls: ['./user-dialog.component.scss'],
  providers: [
    { provide: MAT_DATE_LOCALE, useValue: 'fr-FR' },
    { provide: MAT_DATE_FORMATS, useValue: MY_DATE_FORMATS },
    { provide: DateAdapter, useClass: NativeDateAdapter }
  ]
})
export class UserDialogComponent implements OnInit {
  user: Partial<UserFormData>;
  isEditMode: boolean;
  hidePassword = true;
  isAdmin: boolean = false;
  roles: Array<{value: string, label: string}> = [];
  
  // Rôles de base (toujours disponibles)
  private baseRoles: Array<{value: string, label: string}> = [
    { value: 'patient', label: 'Patient' },
    { value: 'medecin', label: 'Médecin' }
  ];

  // Rôles administratifs (seulement pour les admins)
  private adminRoles: Array<{value: string, label: string}> = [
    { value: 'personnel', label: 'Personnel' },
    { value: 'administrateur', label: 'Administrateur' }
  ];

  dateNaissance: Date | null = null;
  adresse: string = '';

  sexeOptions: Array<{value: string, label: string}> = [
    { value: 'M', label: 'Masculin' },
    { value: 'F', label: 'Féminin' },
   
  ];

  groupesSanguins: string[] = [
    'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'
  ];

  specialties: string[] = [
    'Cardiologie', 'Dermatologie', 'Médecine Générale', 'Gynécologie', 'Pédiatrie',
    'Ophtalmologie', 'Orthopédie', 'ORL', 'Neurologie', 'Psychiatrie', 'Radiologie',
    'Urologie', 'Gastro-entérologie', 'Endocrinologie', 'Pneumologie', 'Rhumatologie',
    'Anesthésiologie', 'Chirurgie Générale', 'Néphrologie', 'Oncologie', 'Infectiologie'
  ];

  constructor(
    public dialogRef: MatDialogRef<UserDialogComponent, UserFormData>,
    @Inject(MAT_DIALOG_DATA) public data: Partial<UserFormData>,
    private dateAdapter: DateAdapter<Date>,
    private apiService: ApiService,
    private cdr: ChangeDetectorRef
  ) {
    this.dateAdapter.setLocale('fr-FR');
    this.user = { ...data };

    // Initialiser les rôles avec les rôles de base par défaut
    this.roles = [...this.baseRoles];

    // Récupérer le profil de l'utilisateur connecté pour déterminer ses permissions
    this.loadUserProfile();

    // Initialiser les données du formulaire
    if (this.user.date_naissance) {
      this.dateNaissance = new Date(this.user.date_naissance);
    }
    this.adresse = this.user.adresse || '';
    this.isEditMode = !!data.id;

    // Ajouter la spécialité personnalisée si nécessaire
    if (this.isEditMode && this.user.role === 'medecin' && this.user.specialite &&
        !this.specialties.includes(this.user.specialite)) {
      this.specialties.push(this.user.specialite);
    }
  }

  ngOnInit(): void {
    if (!this.isEditMode) {
      if (!this.user.role) {
        this.user.role = 'patient';
      }
      if (this.user.actif === undefined) {
        this.user.actif = true;
      }
    }
  }

  /**
   * Charge le profil de l'utilisateur connecté via getProfile()
   */
  private loadUserProfile(): void {
    console.log('UserDialog: Chargement du profil utilisateur...');
    
    this.apiService.getProfile().subscribe({
      next: (response) => {
        console.log('=== PROFIL UTILISATEUR CONNECTÉ ===');
        console.log('Réponse complète:', response);
        console.log('Type de la réponse:', typeof response);
        console.log('Clés de la réponse:', Object.keys(response || {}));
        
        // Détecter la structure de la réponse
        let currentUser: any = null;
        
        // Cas 1: Réponse directe avec les propriétés user
        if (response && response.role) {
          currentUser = response;
          console.log('Structure détectée: Réponse directe');
        }
        // Cas 2: Réponse wrappée dans une propriété 'user'
        else if (response && (response as any).user) {
          currentUser = (response as any).user;
          console.log('Structure détectée: Réponse wrappée dans .user');
        }
        // Cas 3: Réponse wrappée dans une propriété 'data'
        else if (response && (response as any).data) {
          currentUser = (response as any).data;
          console.log('Structure détectée: Réponse wrappée dans .data');
        }
        // Cas 4: La réponse pourrait être un tableau
        else if (Array.isArray(response) && response.length > 0) {
          currentUser = response[0];
          console.log('Structure détectée: Tableau, prendre le premier élément');
        }
        // Cas 5: Vérifier s'il y a une seule propriété dans l'objet
        else if (response && typeof response === 'object') {
          const keys = Object.keys(response);
          if (keys.length === 1) {
            currentUser = (response as any)[keys[0]];
            console.log(`Structure détectée: Propriété unique '${keys[0]}'`);
          }
        }
        
        console.log('Données utilisateur extraites:', currentUser);
        console.log('Rôle détecté:', currentUser?.role);
        console.log('Type du rôle:', typeof currentUser?.role);
        
        if (currentUser?.role) {
          const userRole = currentUser.role.trim().toLowerCase();
          this.isAdmin = userRole === 'administrateur';
          
          console.log('Rôle normalisé:', userRole);
          console.log('Est administrateur:', this.isAdmin);
          
          // Construire la liste des rôles selon les permissions
          if (this.isAdmin) {
            this.roles = [...this.baseRoles, ...this.adminRoles];
            console.log('Rôles disponibles (admin):', this.roles);
          } else {
            this.roles = [...this.baseRoles];
            console.log('Rôles disponibles (utilisateur standard):', this.roles);
          }
        } else {
          console.warn('Aucun rôle trouvé dans le profil utilisateur');
          console.log('Toutes les propriétés de currentUser:', currentUser ? Object.keys(currentUser) : 'currentUser est null/undefined');
          
          // Debug supplémentaire pour identifier la structure
          if (response) {
            console.log('=== DEBUG STRUCTURE COMPLÈTE ===');
            console.log('Réponse JSON stringify:', JSON.stringify(response, null, 2));
            this.debugObject(response, 'response', 0);
          }
          
          this.isAdmin = false;
          this.roles = [...this.baseRoles];
        }
        
        console.log('=================================');
        
        // Forcer la détection des changements
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Erreur lors de la récupération du profil utilisateur:', error);
        this.isAdmin = false;
        this.roles = [...this.baseRoles];
        console.log('Rôles par défaut (erreur):', this.roles);
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * Fonction utilitaire pour debugger la structure d'un objet
   */
  private debugObject(obj: any, name: string, depth: number): void {
    if (depth > 3) return; // Éviter la récursion infinie
    
    const indent = '  '.repeat(depth);
    console.log(`${indent}${name}:`, typeof obj);
    
    if (obj && typeof obj === 'object') {
      if (Array.isArray(obj)) {
        console.log(`${indent}  [Array de longueur ${obj.length}]`);
        obj.forEach((item, index) => {
          if (index < 3) { // Limiter à 3 éléments pour éviter le spam
            this.debugObject(item, `[${index}]`, depth + 1);
          }
        });
      } else {
        Object.keys(obj).forEach(key => {
          this.debugObject(obj[key], key, depth + 1);
        });
      }
    } else {
      console.log(`${indent}  Valeur:`, obj);
    }
  }

  onRoleChange(): void {
    console.log('Changement de rôle vers:', this.user.role);

    // Nettoyer les champs selon le rôle sélectionné
    if (this.user.role !== 'patient') {
      this.dateNaissance = null;
      this.adresse = '';
      delete this.user.date_naissance;
      delete this.user.adresse;
      delete this.user.numero_assurance;
      delete this.user.sexe;
      delete this.user.groupe_sanguin;
    } else {
      this.adresse = this.user.adresse || '';
    }

    if (this.user.role !== 'medecin') {
      delete this.user.specialite;
      delete this.user.numero_ordre;
      delete this.user.tarif_consultation;
      delete this.user.medecin;
    }

    if (this.user.role !== 'personnel' && this.user.role !== 'administrateur') {
      delete this.user.poste;
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onConfirm(): void {
    if (!this.user.prenom?.trim()) {
      this.showError('Le prénom est obligatoire.');
      return;
    }

    if (!this.user.nom?.trim()) {
      this.showError('Le nom est obligatoire.');
      return;
    }

    if (!this.user.email?.trim()) {
      this.showError('L\'email est obligatoire.');
      return;
    }

    if (!this.isValidEmail(this.user.email)) {
      this.showError('Format d\'email invalide.');
      return;
    }

    if (!this.user.role) {
      this.showError('Le rôle est obligatoire.');
      return;
    }

    if (!this.isEditMode && !this.user.password?.trim()) {
      this.showError('Le mot de passe est obligatoire pour la création.');
      return;
    }

    if (!this.isEditMode && this.user.password && this.user.password.length < 8) {
      this.showError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }

    if (!this.validateRoleSpecificFields()) {
      return;
    }

    this.prepareDataForSubmission();
    console.log('Données du formulaire validées:', this.user);
    this.dialogRef.close(this.user as UserFormData);
  }

  private validateRoleSpecificFields(): boolean {
    switch (this.user.role) {
      case 'patient':
        if (!this.dateNaissance) {
          this.showError('La date de naissance est obligatoire pour un patient.');
          return false;
        }
        if (!this.adresse?.trim()) {
          this.showError('L\'adresse est obligatoire pour un patient.');
          return false;
        }
        if (!this.user.sexe) {
          this.showError('Le sexe est obligatoire pour un patient.');
          return false;
        }
        break;

      case 'medecin':
        if (!this.user.specialite?.trim()) {
          this.showError('La spécialité est obligatoire pour un médecin.');
          return false;
        }
        if (!this.user.numero_ordre?.trim()) {
          this.showError('Le numéro d\'ordre est obligatoire pour un médecin.');
          return false;
        }

        const tarif = Number(this.user.tarif_consultation);
        if (isNaN(tarif) || tarif <= 0) {
          this.showError('Le tarif de consultation est obligatoire et doit être un nombre positif.');
          return false;
        }
        this.user.tarif_consultation = tarif;
        break;

      case 'personnel':
        if (!this.user.poste?.trim()) {
          this.showError('Le poste est obligatoire pour un personnel.');
          return false;
        }
        break;

      case 'administrateur':
        if (!this.user.poste?.trim()) {
          this.showError('Le poste est obligatoire pour un administrateur.');
          return false;
        }
        break;
    }
    return true;
  }

  private prepareDataForSubmission(): void {
    if (this.user.role === 'patient') {
      if (this.dateNaissance) {
        this.user.date_naissance = this.dateNaissance.toISOString().split('T')[0];
      }
      this.user.adresse = this.adresse?.trim();
      delete this.user.specialite;
      delete this.user.numero_ordre;
      delete this.user.tarif_consultation;
      delete this.user.medecin;
      delete this.user.poste;
    } else if (this.user.role === 'medecin') {
      if (this.user.tarif_consultation !== undefined && this.user.tarif_consultation !== null) {
        this.user.tarif_consultation = Number(this.user.tarif_consultation);
        if (isNaN(this.user.tarif_consultation) || this.user.tarif_consultation <= 0) {
          this.user.tarif_consultation = 0;
        }
      } else {
        this.user.tarif_consultation = 0;
      }

      this.user.medecin = {
        specialite: this.user.specialite?.trim() || '',
        numero_ordre: this.user.numero_ordre?.trim() || '',
        tarif_consultation: this.user.tarif_consultation,
        horaire_consultation: { lundi: { debut: '08:00', fin: '17:00' } },
        disponible: true
      };

      delete this.user.date_naissance;
      delete this.user.adresse;
      delete this.user.numero_assurance;
      delete this.user.sexe;
      delete this.user.groupe_sanguin;
      delete this.user.poste;
    } else if (this.user.role === 'personnel' || this.user.role === 'administrateur') {
      this.user.poste = this.user.poste?.trim();
      delete this.user.date_naissance;
      delete this.user.adresse;
      delete this.user.numero_assurance;
      delete this.user.sexe;
      delete this.user.groupe_sanguin;
      delete this.user.specialite;
      delete this.user.numero_ordre;
      delete this.user.tarif_consultation;
      delete this.user.medecin;
    }

    // Nettoyer les valeurs vides
    Object.keys(this.user).forEach(key => {
      const value = (this.user as any)[key];
      if (key !== 'tarif_consultation' && key !== 'actif' && key !== 'medecin' && key !== 'poste') {
        if (value === '' || value === null || value === undefined) {
          delete (this.user as any)[key];
        }
      }
    });
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private showError(message: string): void {
    alert(message);
  }

  dateFilter = (d: Date | null): boolean => {
    if (!d) return false;
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return d.getTime() <= today.getTime();
  };

  onNumberInput(event: any, field: 'tarif_consultation'): void {
    const value = event.target.value;
    const numValue = Number(value);

    if (value === '' || value === null) {
      (this.user as any)[field] = 0;
    } else if (!isNaN(numValue) && numValue >= 0) {
      (this.user as any)[field] = numValue;
    } else {
      event.target.value = (this.user as any)[field] || 0;
    }
  }
}