// app/services/statistics.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class StatisticsService {
  private apiUrl = `${environment.apiUrl}/api/statistics`;

  constructor(private http: HttpClient) {}

  private buildParams(
    period?: string, 
    startDate?: string, 
    endDate?: string, 
    filters?: any
  ): HttpParams {
    let params = new HttpParams();
    
    if (period) {
      params = params.set('period', period);
    }
    if (startDate) {
      params = params.set('start_date', startDate);
    }
    if (endDate) {
      params = params.set('end_date', endDate);
    }
    
    // Ajouter les filtres si ils existent
    if (filters) {
      Object.keys(filters).forEach(key => {
        if (filters[key] !== null && filters[key] !== undefined && filters[key] !== '') {
          params = params.set(key, filters[key]);
        }
      });
    }
    
    return params;
  }

  getGeneralStatistics(period?: string, startDate?: string, endDate?: string): Observable<any> {
    const params = this.buildParams(period, startDate, endDate);
    return this.http.get(`${this.apiUrl}/general`, { params });
  }

  getPatientStatistics(period?: string, startDate?: string, endDate?: string): Observable<any> {
    const params = this.buildParams(period, startDate, endDate);
    return this.http.get(`${this.apiUrl}/patients`, { params });
  }

  getMedecinStatistics(period?: string, startDate?: string, endDate?: string): Observable<any> {
    const params = this.buildParams(period, startDate, endDate);
    return this.http.get(`${this.apiUrl}/medecins`, { params });
  }

  getRendezVousStatistics(
    period?: string, 
    startDate?: string, 
    endDate?: string, 
    filters?: any
  ): Observable<any> {
    const params = this.buildParams(period, startDate, endDate, filters);
    return this.http.get(`${this.apiUrl}/rendezvous`, { params });
  }

  getPaiementStatistics(
    period?: string, 
    startDate?: string, 
    endDate?: string, 
    filters?: any
  ): Observable<any> {
    const params = this.buildParams(period, startDate, endDate, filters);
    return this.http.get(`${this.apiUrl}/paiements`, { params });
  }

  downloadPdfReport(
    reportType: string, 
    period?: string, 
    startDate?: string, 
    endDate?: string, 
    filters?: any
  ): Observable<Blob> {
    const params = this.buildParams(period, startDate, endDate, filters);
    return this.http.get(`${this.apiUrl}/download/pdf/${reportType}`, { 
      params, 
      responseType: 'blob' 
    });
  }

  downloadExcelReport(
    reportType: string, 
    period?: string, 
    startDate?: string, 
    endDate?: string, 
    filters?: any
  ): Observable<Blob> {
    const params = this.buildParams(period, startDate, endDate, filters);
    return this.http.get(`${this.apiUrl}/download/excel/${reportType}`, { 
      params, 
      responseType: 'blob' 
    });
  }
}