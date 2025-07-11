import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatSidenavModule,
    MatListModule,
    MatIconModule
  ],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent {
  constructor(private router: Router) {}

  isAdmin(): boolean {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user.role === 'administrateur';
  }

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user'); // Supprimez aussi les données utilisateur
    this.router.navigate(['/login']);
  }
}