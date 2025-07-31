import { Component, OnInit, Inject } from '@angular/core';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, User, ApiError, UserFormData } from '../services/api.service';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ConfirmationDialogComponent } from '../components/confirmation-dialog/confirmation-dialog.component';
import { UserDialogComponent } from '../user-dialog/user-dialog.component';
import { MatCard, MatCardTitle, MatCardHeader, MatCardContent } from "@angular/material/card";
import { MatTooltipModule } from '@angular/material/tooltip'; // <--- Add this import


@Component({
  selector: 'app-users',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatSlideToggleModule,
    MatSnackBarModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatChipsModule,
    MatCard,
    MatCardTitle,
    MatCardHeader,
    MatCardContent,
    MatTooltipModule // <--- Add MatTooltipModule here
],
  templateUrl: './users.component.html',
  styleUrls: ['./users.component.scss']
})
export class UsersComponent implements OnInit {
  displayedColumns: string[] = ['prenom', 'nom', 'email', 'role', 'actif', 'actions'];
  dataSource = new MatTableDataSource<User>([]);
  users: User[] = [];

  // Propriétés de filtrage
  searchTerm: string = '';
  selectedRole: string = '';
  selectedStatus: string = '';
  
  roles = [
    { value: '', label: 'Tous les rôles' },
    { value: 'patient', label: 'Patient' },
    { value: 'medecin', label: 'Médecin' },
    { value: 'personnel', label: 'Personnel' },
    { value: 'administrateur', label: 'Administrateur' }
  ];

  statusOptions = [
    { value: '', label: 'Tous les statuts' },
    { value: 'true', label: 'Actif' },
    { value: 'false', label: 'Inactif' }
  ];

  constructor(
    public dialog: MatDialog,
    @Inject(ApiService) private apiService: ApiService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit() {
    console.log('UsersComponent: Initialisation du composant.');
    this.loadUsers();
    this.setupFiltering();
  }

  private setupFiltering(): void {
    // Configuration du filtrage personnalisé
    this.dataSource.filterPredicate = (data: User, filter: string) => {
      const filters = JSON.parse(filter);
      
      // Filtrage par terme de recherche (nom, prénom, email)
      const searchMatch = !filters.searchTerm || 
        data.prenom.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
        data.nom.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
        data.email.toLowerCase().includes(filters.searchTerm.toLowerCase());
      
      // Filtrage par rôle
      const roleMatch = !filters.role || data.role === filters.role;
      
      // Filtrage par statut
      const statusMatch = !filters.status || 
        (filters.status === 'true' && data.actif) ||
        (filters.status === 'false' && !data.actif);
      
      return searchMatch && roleMatch && statusMatch;
    };
  }

  applyFilter(): void {
    const filters = {
      searchTerm: this.searchTerm,
      role: this.selectedRole,
      status: this.selectedStatus
    };
    
    this.dataSource.filter = JSON.stringify(filters);
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.selectedRole = '';
    this.selectedStatus = '';
    this.applyFilter();
  }

  getFilteredCount(): number {
    return this.dataSource.filteredData.length;
  }

  getRoleIcon(role: string): string {
    const roleIcons: { [key: string]: string } = {
      'patient': 'personal_injury',
      'medecin': 'medical_services',
      'personnel': 'work',
      'administrateur': 'admin_panel_settings'
    };
    return roleIcons[role] || 'person';
  }

  getRoleLabel(role: string): string {
    const roleLabels: { [key: string]: string } = {
      'patient': 'Patient',
      'medecin': 'Médecin',
      'personnel': 'Personnel',
      'administrateur': 'Administrateur'
    };
    return roleLabels[role] || role;
  }

  loadUsers(): void {
    console.log('UsersComponent: Chargement des utilisateurs...');
    this.apiService.getUsers().subscribe({
      next: (response: { data: User[] }) => {
        console.log('UsersComponent: Utilisateurs chargés avec succès:', response);
        this.users = response.data || [];
        this.dataSource.data = this.users;
        console.log('UsersComponent: dataSource.data:', this.dataSource.data);
      },
      error: (error: ApiError) => {
        console.error('UsersComponent: Erreur lors du chargement des utilisateurs:', error);
        let errorMessage = 'Erreur lors du chargement des utilisateurs';
        if (error.type === 'HTTP_ERROR') {
          errorMessage = error.message || 'Erreur serveur lors du chargement des utilisateurs';
        }
        this.snackBar.open(errorMessage, 'Fermer', { duration: 3000 });

        // Données de test en cas d'erreur
        this.users = [
          { id: 1, prenom: 'Jean', nom: 'Dupont', email: 'jean.dupont@example.com', role: 'patient', actif: true },
          { id: 2, prenom: 'Marie', nom: 'Martin', email: 'marie.martin@example.com', role: 'medecin', actif: false },
          { id: 3, prenom: 'Pierre', nom: 'Lefevre', email: 'pierre.lefevre@example.com', role: 'personnel', actif: true },
        ];
        this.dataSource.data = this.users;
      }
    });
  }

  openDialog(user?: User): void {
    // Préparer les données pour le dialogue
    const dialogData: Partial<UserFormData> = user
      ? { 
          ...user, 
          password: undefined // Ne pas passer le mot de passe existant
        }
      : { 
          prenom: '', 
          nom: '', 
          email: '', 
          password: '', 
          role: 'patient', 
          actif: true, 
          telephone: '' 
        };

    const dialogRef = this.dialog.open(UserDialogComponent, {
      width: '500px',
      data: dialogData,
    });

    dialogRef.afterClosed().subscribe((result: UserFormData) => {
      console.log('UsersComponent: Dialogue fermé. Résultat:', result);
      if (result && result.role) {
        // Validation des champs obligatoires
        if (!result.prenom?.trim() || !result.nom?.trim() || !result.email?.trim()) {
          this.snackBar.open('Les champs nom, prénom et email sont obligatoires', 'Fermer', { duration: 3000 });
          return;
        }

        // Préparation des données nettoyées avec tous les champs obligatoires
        const cleanData: UserFormData = {
          id: user?.id,
          prenom: result.prenom.trim(),
          nom: result.nom.trim(),
          email: result.email.trim(),
          role: result.role,
          actif: result.actif ?? true,
          telephone: result.telephone?.trim() || undefined,
          password: result.password?.trim() || undefined
        };

        // Ajouter les données spécifiques au médecin si nécessaire
        if (result.role === 'medecin') {
          // Vérification des champs médecin au niveau racine
          const specialite = result.specialite?.trim();
          const numero_ordre = result.numero_ordre?.trim();
          const tarif_consultation = result.tarif_consultation;

          if (!specialite || !numero_ordre || tarif_consultation == null) {
            this.snackBar.open('Tous les champs spécifiques au médecin sont requis', 'Fermer', { duration: 3000 });
            return;
          }
          
          cleanData.medecin = {
            specialite: specialite,
            numero_ordre: numero_ordre,
            tarif_consultation: Number(tarif_consultation),
            horaire_consultation: result.horaire_consultation || { lundi: { debut: '09:00', fin: '17:00' } },
            disponible: result.disponible ?? true
          };
        }

        // Ajouter les données spécifiques au patient si nécessaire
        if (result.role === 'patient') {
          // Récupérer les données patient au niveau racine du result
          const adresse = result.adresse?.trim();
          const date_naissance = result.date_naissance;
          const sexe = result.sexe;
          const numero_assurance = result.numero_assurance?.trim();
          const groupe_sanguin = result.groupe_sanguin?.trim();
          const antecedent_medicaux = result.antecedent_medicaux?.trim();

          // Validation des champs obligatoires pour patient
          if (!adresse || !date_naissance || !sexe) {
            this.snackBar.open('L\'adresse, la date de naissance et le sexe sont obligatoires pour un patient', 'Fermer', { duration: 3000 });
            return;
          }

          cleanData.patient = {
            adresse: adresse,
            date_naissance: date_naissance,
            sexe: sexe,
            numero_assurance: numero_assurance,
            groupe_sanguin: groupe_sanguin,
            antecedent_medicaux: antecedent_medicaux
          };
        }

        // Ajouter les données spécifiques au personnel/administrateur si nécessaire
        if (result.role === 'personnel' || result.role === 'administrateur') {
          const poste = result.poste?.trim();
          if (!poste) {
            this.snackBar.open('Le poste est obligatoire pour le personnel et les administrateurs', 'Fermer', { duration: 3000 });
            return;
          }
          cleanData.poste = poste;
        }

        if (user && user.id) {
          // Mode modification
          console.log('UsersComponent: Mise à jour de l\'utilisateur:', user.id, cleanData);
          this.apiService.updateUser(user.id, cleanData).subscribe({
            next: (updatedUser: User) => {
              console.log('UsersComponent: Utilisateur mis à jour:', updatedUser);
              const index = this.users.findIndex(u => u.id === user.id);
              if (index !== -1) {
                this.users[index] = updatedUser;
                this.dataSource.data = [...this.users];
                this.snackBar.open('Utilisateur modifié avec succès', 'Fermer', { duration: 3000 });
              }
            },
            error: (error: ApiError) => {
              console.error('UsersComponent: Erreur lors de la mise à jour:', error);
              this.handleError(error, 'Erreur lors de la modification');
            }
          });
        } else {
          // Mode création
          if (!cleanData.password) {
            this.snackBar.open('Mot de passe requis pour la création', 'Fermer', { duration: 3000 });
            return;
          }
          
          console.log('UsersComponent: Création d\'un utilisateur:', cleanData);
          this.apiService.createUser(cleanData).subscribe({
            next: (newUser: { id: number; prenom: string; nom: string; email: string; role: string; actif: boolean; telephone?: string }) => {
              console.log('UsersComponent: Utilisateur créé:', newUser);
              this.loadUsers(); // Recharger la liste
              this.snackBar.open('Utilisateur créé avec succès', 'Fermer', { duration: 3000 });
            },
            error: (error: ApiError) => {
              console.error('UsersComponent: Erreur lors de la création:', error);
              this.handleError(error, 'Erreur lors de la création de l\'utilisateur');
            }
          });
        }
      }
    });
  }

  toggleActive(user: User): void {
    if (!user.id) {
      console.error('UsersComponent: ID utilisateur manquant:', user);
      this.snackBar.open('Erreur: ID utilisateur manquant', 'Fermer', { duration: 3000 });
      return;
    }

    const newActiveState = !user.actif;
    
    // Mise à jour optimiste de l'interface
    const index = this.users.findIndex(u => u.id === user.id);
    if (index !== -1) {
      this.users[index].actif = newActiveState;
      this.dataSource.data = [...this.users];
      console.log(`UsersComponent: Mise à jour locale de l'utilisateur ${user.id} vers ${newActiveState}`);
    }

    // Appel API
    this.apiService.updateUserStatus(user.id, newActiveState).subscribe({
      next: (updatedUser: User) => {
        console.log('UsersComponent: Statut mis à jour:', updatedUser);
        const index = this.users.findIndex(u => u.id === user.id);
        if (index !== -1) {
          this.users[index] = updatedUser;
          this.dataSource.data = [...this.users];
          this.snackBar.open(
            newActiveState ? 'Utilisateur activé' : 'Utilisateur désactivé', 
            'Fermer', 
            { duration: 2000 }
          );
        }
      },
      error: (error: ApiError) => {
        console.error('UsersComponent: Erreur lors de la mise à jour du statut:', error);
        
        // Revenir à l'état précédent en cas d'erreur
        const index = this.users.findIndex(u => u.id === user.id);
        if (index !== -1) {
          this.users[index].actif = !newActiveState;
          this.dataSource.data = [...this.users];
        }
        
        this.handleError(error, 'Erreur lors de la mise à jour du statut');
        
        // Recharger les données pour être sûr de la cohérence
        this.loadUsers();
      }
    });
  }

  deleteUser(user: User): void {
    if (!user.id) {
      console.error('UsersComponent: ID utilisateur manquant:', user);
      this.snackBar.open('Erreur: ID utilisateur manquant', 'Fermer', { duration: 3000 });
      return;
    }

    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      width: '400px',
      data: { 
        message: `Voulez-vous supprimer ${user.prenom} ${user.nom} ?`, 
        confirmText: 'Oui', 
        cancelText: 'Non' 
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result === true && user.id) {
        console.log('UsersComponent: Suppression de l\'utilisateur:', user.id);
        this.apiService.deleteUser(user.id).subscribe({
          next: () => {
            console.log('UsersComponent: Utilisateur supprimé avec succès.');
            // Mise à jour locale de la liste
            this.users = this.users.filter(u => u.id !== user.id);
            this.dataSource.data = [...this.users];
            this.snackBar.open('Supprimé avec succès', 'Fermer', { duration: 2000 });
          },
          error: (error: ApiError) => {
            console.error('UsersComponent: Erreur lors de la suppression:', error);
            this.handleError(error, 'Erreur lors de la suppression');
          }
        });
      }
    });
  }

  /**
   * Méthode utilitaire pour gérer les erreurs de manière centralisée
   */
  private handleError(error: ApiError, defaultMessage: string): void {
    let errorMessage = defaultMessage;
    
    if (error.type === 'VALIDATION_ERROR' && error.errors) {
      const validationDetails = Object.entries(error.errors)
        .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
        .join('; ');
      errorMessage = `Erreur de validation: ${validationDetails}`;
    } else if (error.type === 'HTTP_ERROR') {
      errorMessage = error.message || `${defaultMessage} - Erreur serveur`;
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    this.snackBar.open(errorMessage, 'Fermer', { 
      duration: error.type === 'VALIDATION_ERROR' ? 8000 : 5000 
    });
  }
}
