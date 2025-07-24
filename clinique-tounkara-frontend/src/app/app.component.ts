import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Observable, Subscription } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';
import { Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { AsyncPipe } from '@angular/common';
import { SidebarComponent } from './shared/sidebar/sidebar.component';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    SidebarComponent,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    RouterOutlet,
    AsyncPipe
  ],
  template: `
    <div class="app-container">
      @if (isAuthenticated()) {
        <app-sidebar [isHandset]="(isHandset$ | async) || false"></app-sidebar>
      } @else {
        <router-outlet></router-outlet>
      }
    </div>
  `,
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
  private subscriptions = new Subscription();
  
  isHandset$: Observable<boolean> = this.breakpointObserver.observe(Breakpoints.Handset)
    .pipe(
      map(result => result.matches),
      shareReplay()
    );

  constructor(
    private breakpointObserver: BreakpointObserver,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    // S'abonner aux changements de route pour détecter les redirections
    this.subscriptions.add(
      this.router.events.subscribe(event => {
        if (event instanceof NavigationEnd) {
          console.log('Navigation to:', event.url);
          this.cdr.detectChanges();
        }
      })
    );
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('sidebar-state');
    this.router.navigate(['/login']);
  }

  isAuthenticated(): boolean {
    console.log('Token exists:', !!localStorage.getItem('token')); // Débogage
    const currentUrl = this.router.url;
    const publicRoutes = ['/login', '/register', '/forgot-password'];
    
    return !!localStorage.getItem('token') && !publicRoutes.some(route => currentUrl.includes(route));
  }
}