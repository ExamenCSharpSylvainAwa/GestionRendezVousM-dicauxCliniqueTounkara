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
  templateUrl: './sidebar.component.html',
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

  // Méthode pour obtenir l'avatar de l'utilisateur (initiales)
  getUserInitials(): string {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const prenom = user.prenom || 'U';
    const nom = user.nom || '';
    return `${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase();
  }

  // Méthode pour obtenir une couleur d'avatar basée sur le nom
  getAvatarColor(): string {
    const colors = ['#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#00bcd4', '#009688', '#4caf50', '#8bc34a', '#cddc39', '#ffc107', '#ff9800', '#ff5722'];
    const name = this.getUserFullName();
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  }
}