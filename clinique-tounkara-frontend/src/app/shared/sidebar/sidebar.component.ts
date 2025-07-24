import { Component, Input, ViewChild, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { RouterModule } from '@angular/router';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    MatSidenavModule,
    MatListModule,
    MatIconModule,
    CommonModule,
    MatButtonModule,
    RouterModule
  ],
  template: `
    <mat-sidenav-container class="sidenav-container">
      <mat-sidenav #sidenav 
                   mode="side" 
                   [opened]="getSidenavOpenState()"
                   [fixedInViewport]="false"
                   [fixedTopGap]="0"
                   [fixedBottomGap]="0">
        <!-- En-tête avec nom et prénom de l'utilisateur -->
        <div class="sidebar-header">
          <h2>Clinique TOUNKARA</h2>
          <div class="user-info">
            <mat-icon>account_circle</mat-icon>
            <span>{{ getUserFullName() }}</span>
          </div>
        </div>

        <mat-nav-list>
          <!-- Options communes à tous les rôles -->
          <a mat-list-item routerLink="/dashboard" routerLinkActive="active">
            <mat-icon>dashboard</mat-icon>
            Tableau de bord
          </a>

          <!-- Lien pour modifier le profil -->
          <a mat-list-item routerLink="/profile-edit" routerLinkActive="active">
            <mat-icon>edit</mat-icon>
            Modifier mon profil
          </a>

          <!-- Rôle : Patient -->
          @if (getUserRole() === 'patient') {
            <a mat-list-item routerLink="/appointments" routerLinkActive="active">
              <mat-icon>event</mat-icon>
              Prendre rendez-vous
            </a>
            <a mat-list-item routerLink="/medical-records" routerLinkActive="active">
              <mat-icon>folder</mat-icon>
              Consulter dossier médical
            </a>
            <a mat-list-item routerLink="/prescriptions" routerLinkActive="active">
              <mat-icon>description</mat-icon>
              Consulter prescriptions
            </a>
            <a mat-list-item routerLink="/payments" routerLinkActive="active">
              <mat-icon>payment</mat-icon>
              Consulter paiements
            </a>
          }

          <!-- Rôle : Médecin -->
          @if (getUserRole() === 'medecin') {
            <a mat-list-item routerLink="/view-schedule" routerLinkActive="active">
              <mat-icon>calendar_today</mat-icon>
              Consulter planning
            </a>
            <a mat-list-item routerLink="/doctor-appointments" routerLinkActive="active">
              <mat-icon>event_note</mat-icon>
              Liste des rendez-vous
            </a>
            <a mat-list-item routerLink="/medical-records" routerLinkActive="active">
              <mat-icon>folder</mat-icon>
              Gérer dossiers médicaux
            </a>
            <a mat-list-item routerLink="/prescriptions" routerLinkActive="active">
              <mat-icon>description</mat-icon>
              Émettre prescriptions
            </a>
              <a mat-list-item routerLink="/consultations" routerLinkActive="active">
                <mat-icon>consultations</mat-icon>
                Émettre consultations
              </a>
            <a mat-list-item routerLink="/schedule/edit" routerLinkActive="active">
              <mat-icon>edit_calendar</mat-icon>
              Modifier horaires
            </a>
          }

          <!-- Rôle : Personnel -->
          @if (getUserRole() === 'personnel') {
            <a mat-list-item routerLink="/patients" routerLinkActive="active">
              <mat-icon>people</mat-icon>
              Créer comptes patients
            </a>
            <a mat-list-item routerLink="/doctors" routerLinkActive="active">
              <mat-icon>person</mat-icon>
              Créer comptes médecins
            </a>
            <a mat-list-item routerLink="/appointments/manage" routerLinkActive="active">
              <mat-icon>event</mat-icon>
              Gérer rendez-vous
            </a>
            <a mat-list-item routerLink="/billing" routerLinkActive="active">
              <mat-icon>receipt</mat-icon>
              Enregistrer factures/paiements
            </a>
            <a mat-list-item routerLink="/billing/manage" routerLinkActive="active">
              <mat-icon>calculate</mat-icon>
              Gérer facturation
            </a>
          }

          <!-- Rôle : Administrateur -->
          @if (getUserRole() === 'administrateur') {
            <a mat-list-item routerLink="/users" routerLinkActive="active">
              <mat-icon>people</mat-icon>
              Gérer utilisateurs
            </a>
            <a mat-list-item routerLink="/permissions" routerLinkActive="active">
              <mat-icon>lock</mat-icon>
              Définir rôles/permissions
            </a>
            <a mat-list-item routerLink="/reports" routerLinkActive="active">
              <mat-icon>assessment</mat-icon>
              Générer rapports
            </a>
          }

          <!-- Déconnexion pour tous les rôles -->
          <a mat-list-item (click)="logout()">
            <mat-icon>exit_to_app</mat-icon>
            Déconnexion
          </a>
        </mat-nav-list>
      </mat-sidenav>
      
      <mat-sidenav-content>
        @if (isHandset) {
          <button mat-icon-button (click)="toggleSidenav()" class="menu-button">
            <mat-icon>menu</mat-icon>
          </button>
        }
        <router-outlet></router-outlet>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent implements OnInit, OnDestroy {
  @ViewChild('sidenav') sidenav!: MatSidenav;
  @Input() isHandset: boolean = false;
  
  private subscriptions = new Subscription();

  constructor(
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    // S'abonner aux changements de route pour maintenir l'état de la sidebar
    this.subscriptions.add(
      this.router.events
        .pipe(filter(event => event instanceof NavigationEnd))
        .subscribe(() => {
          // Forcer la détection des changements après navigation
          setTimeout(() => {
            this.cdr.detectChanges();
          }, 0);
        })
    );
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  getSidenavOpenState(): boolean {
    // Vérifier s'il y a un état sauvegardé dans localStorage
    const savedState = localStorage.getItem('sidebar-state');
    
    if (savedState !== null) {
      return JSON.parse(savedState);
    }
    
    // Par défaut, ouverte sur desktop, fermée sur mobile
    return !this.isHandset;
  }

  toggleSidenav() {
    if (this.sidenav) {
      this.sidenav.toggle();
      // Sauvegarder l'état dans localStorage
      setTimeout(() => {
        localStorage.setItem('sidebar-state', JSON.stringify(this.sidenav.opened));
      }, 300); // Attendre la fin de l'animation
    }
  }

  getUserRole(): string {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user.role || '';
  }

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('sidebar-state'); // Nettoyer l'état de la sidebar
    this.router.navigate(['/login']);
  }

  getUserFullName(): string {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return `${user.prenom || 'Utilisateur'} ${user.nom || ''}`.trim();
  }
}