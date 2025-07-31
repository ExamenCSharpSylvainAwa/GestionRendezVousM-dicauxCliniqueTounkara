import { HttpInterceptorFn } from '@angular/common/http';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { inject } from '@angular/core';
import { Router } from '@angular/router';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router); // Injecte le Router pour la redirection
  const token = localStorage.getItem('token');

  if (token) {
    const cloned = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
    return next(cloned).pipe(
      catchError((error) => {
        if (error.status === 401) {
          localStorage.removeItem('token'); // Supprime le jeton invalide
          router.navigate(['/login']); // Redirige vers la page de connexion
        }
        return throwError(() => error);
      })
    );
  }
  return next(req);
};