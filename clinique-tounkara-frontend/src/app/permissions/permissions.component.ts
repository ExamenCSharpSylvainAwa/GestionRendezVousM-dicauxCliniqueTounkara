
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { CommonModule } from '@angular/common';
import { ApiService, Permission, Role } from '../services/api.service';
import { FormBuilder, FormGroup, Validators, FormArray, ReactiveFormsModule } from '@angular/forms';
import { MatTableDataSource } from '@angular/material/table';
import { MatIcon } from '@angular/material/icon';

@Component({
  selector: 'app-permissions',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatCheckboxModule,
    MatButtonModule,
    MatDialogModule,
    MatInputModule,
    MatSnackBarModule,
    ReactiveFormsModule,
    MatIcon
  ],
  templateUrl: './permissions.component.html',
  styleUrls: ['./permissions.component.scss']
})
export class PermissionsComponent implements OnInit {
  roles: Role[] = [];
  dataSource = new MatTableDataSource<Role>(this.roles);
  displayedColumns: string[] = ['name', 'permissions', 'actions'];
  availablePermissions: Permission[] = [
    { id: 1, name: 'create_user', description: 'Créer un utilisateur' },
    { id: 2, name: 'read_user', description: 'Lire les utilisateurs' },
    { id: 3, name: 'update_user', description: 'Mettre à jour un utilisateur' },
    { id: 4, name: 'delete_user', description: 'Supprimer un utilisateur' }
  ];
  roleForm: FormGroup;

  constructor(
    private apiService: ApiService,
    private snackBar: MatSnackBar,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef
  ) {
    this.roleForm = this.fb.group({
      name: ['', Validators.required],
      permissions: this.fb.array([])
    });
    this.initializePermissions();
  }

  ngOnInit() {
    this.loadRoles();
  }

  initializePermissions() {
    const permissionsArray = this.roleForm.get('permissions') as FormArray;
    permissionsArray.clear();
    this.availablePermissions.forEach(() => {
      permissionsArray.push(this.fb.control(false));
    });
  }

  loadRoles() {
    this.apiService.getRoles().subscribe({
      next: (response: { data: Role[] }) => {
        console.log('Réponse complète de l\'API:', response);
        this.roles = response.data || [];
        this.dataSource.data = this.roles;
      },
      error: (error) => {
        console.error('Erreur lors du chargement des rôles:', error);
        this.snackBar.open('Erreur lors du chargement des rôles', 'Fermer', { duration: 3000 });
      }
    });
  }

  openRoleDialog(role?: Role) {
    const permissionsArray = this.roleForm.get('permissions') as FormArray;
    permissionsArray.clear();

    // Extraire les ids des permissions sélectionnées (number[])
    const selectedPermissionIds: number[] = role
      ? (role.permissions?.map(p => p.id) || [])
      : [];

    this.roleForm.patchValue({ name: role?.name || '' });

    this.availablePermissions.forEach((perm) => {
      permissionsArray.push(this.fb.control(selectedPermissionIds.includes(perm.id)));
    });
  }

  saveRole() {
    if (this.roleForm.valid) {
      const permissionsArray = this.roleForm.get('permissions') as FormArray;
      const selectedPermissions = this.availablePermissions.filter((_, index) => permissionsArray.at(index)?.value);

      const roleData: Omit<Role, 'id'> = {
        name: this.roleForm.value.name,
        permissions: selectedPermissions
      };

      if (this.roleForm.value.id) {
        this.apiService.updateRole(this.roleForm.value.id, roleData).subscribe({
          next: (updatedResponse: { data: Role }) => {
            const index = this.roles.findIndex(r => r.id === updatedResponse.data.id);
            if (index !== -1) this.roles[index] = updatedResponse.data;
            this.dataSource.data = [...this.roles];
            this.snackBar.open('Rôle mis à jour avec succès', 'Fermer', { duration: 3000 });
            this.roleForm.reset();
            this.initializePermissions();
            this.cdr.detectChanges();
          },
          error: (error) => {
            console.error('Erreur mise à jour rôle:', error);
            this.snackBar.open('Erreur mise à jour rôle', 'Fermer', { duration: 3000 });
          }
        });
      } else {
        this.apiService.createRole(roleData).subscribe({
          next: (newRoleResponse: { data: Role }) => {
            console.log('Nouveau rôle reçu:', newRoleResponse);
            if (newRoleResponse.data && newRoleResponse.data.id) {
              this.roles.push(newRoleResponse.data);
              this.dataSource.data = [...this.roles];
              this.snackBar.open('Rôle créé avec succès', 'Fermer', { duration: 3000 });
            } else {
              this.snackBar.open('Erreur: Données du rôle invalides', 'Fermer', { duration: 3000 });
            }
            this.roleForm.reset();
            this.initializePermissions();
            this.cdr.detectChanges();
          },
          error: (error) => {
            console.error('Erreur création rôle:', error);
            this.snackBar.open('Erreur création rôle', 'Fermer', { duration: 3000 });
          }
        });
      }
    }
  }

  deleteRole(roleId: number) {
    this.apiService.deleteRole(roleId).subscribe({
      next: () => {
        this.roles = this.roles.filter(r => r.id !== roleId);
        this.dataSource.data = [...this.roles];
        this.snackBar.open('Rôle supprimé avec succès', 'Fermer', { duration: 2000 });
      },
      error: (error) => {
        console.error('Erreur suppression rôle:', error);
        this.snackBar.open('Erreur suppression rôle', 'Fermer', { duration: 3000 });
      }
    });
  }

  getPermissionList(permissions: Permission[]): string {
    return permissions.map(p => p.name).join(', ');
  }
}