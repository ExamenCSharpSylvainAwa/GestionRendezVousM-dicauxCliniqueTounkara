import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { RegisterComponent } from './components/register/register.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { AppointmentsComponent } from './components/appointments/appointments.component';
import { MedicalRecordsComponent } from './components/medical-records/medical-records.component';
import { BillingComponent } from './components/billing/billing.component';
import { AdminComponent } from './components/admin/admin.component';
import { ProfileComponent } from './components/profile/profile.component';
import { AuthGuard } from './core/auth.guard';
import { ScheduleComponent } from './schedule/schedule.component';
import { PrescriptionsComponent } from './prescriptions/prescriptions.component';
import { PatientsComponent } from './patients/patients.component';
import { DoctorsComponent } from './doctors/doctors.component';
import { ManageAppointmentsComponent } from './manage-appointments/manage-appointments.component';
import { UsersComponent } from './users/users.component';
import { ReportsComponent } from './reports/reports.component';
import { PaymentsComponent } from './payments/payments.component';
import { ViewScheduleComponent } from './view-schedule/view-schedule.component';
import { DoctorAppointmentsComponent } from './doctor-appointments/doctor-appointments.component';
import { ProfileEditComponent } from './profile-edit/profile-edit.component';
import { ConsultationsComponent } from './consultations/consultations.component';
import { MedicalRecordsViewComponent } from './medical-records-view/medical-records-view.component';

export const routes: Routes = [
  // Routes publiques (sans authentification)
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  
  // Routes protégées (avec authentification)
  { 
    path: 'dashboard', 
    component: DashboardComponent, 
    canActivate: [AuthGuard] 
  },
  { 
    path: 'appointments', 
    component: AppointmentsComponent, 
    canActivate: [AuthGuard] 
  },
   { 
    path: 'doctor-appointments', 
    component: DoctorAppointmentsComponent, 
    canActivate: [AuthGuard] 
  },
  { 
    path: 'medical-records', 
    component: MedicalRecordsComponent, 
    canActivate: [AuthGuard] 
  },
  { 
    path: 'medical-records-view', 
    component: MedicalRecordsViewComponent, 
    canActivate: [AuthGuard] 
  },
  { 
    path: 'billing', 
    component: BillingComponent, 
    canActivate: [AuthGuard] 
  },
    { 
      path: 'profile-edit',
      component: ProfileEditComponent ,
      canActivate: [AuthGuard] 
    },
  { 
    path: 'profile', 
    component: ProfileComponent, 
    canActivate: [AuthGuard] 
  },
  { 
    path: 'admin', 
    component: AdminComponent, 
    canActivate: [AuthGuard] 
  },
  { 
    path: 'schedule', 
    component: ScheduleComponent, 
    canActivate: [AuthGuard] 
  },
  { 
    path: 'view-schedule', 
    component: ViewScheduleComponent, // Nouvelle route pour consulter le planning
    canActivate: [AuthGuard] 
  },
  { 
    path: 'schedule/edit', 
    component: ScheduleComponent, // Réutilisation pour modifier horaires
    canActivate: [AuthGuard] 
  },
  { 
    path: 'prescriptions', 
    component: PrescriptionsComponent, 
    canActivate: [AuthGuard] 
  },
 
   { 
    path: 'consultations', 
    component: ConsultationsComponent, 
    canActivate: [AuthGuard] 
  },
  { 
    path: 'patients', 
    component: PatientsComponent, 
    canActivate: [AuthGuard] 
  },
  { 
    path: 'doctors', 
    component: DoctorsComponent, 
    canActivate: [AuthGuard] 
  },
  { 
    path: 'appointments/manage', 
    component: ManageAppointmentsComponent, 
    canActivate: [AuthGuard] 
  },
  
  { 
    path: 'users', 
    component: UsersComponent, 
    canActivate: [AuthGuard] 
  },
 
  { 
    path: 'reports', 
    component: ReportsComponent, 
    canActivate: [AuthGuard] 
  },
  { 
    path: 'payments', 
    component: PaymentsComponent, 
    canActivate: [AuthGuard] 
  },
  
  // Redirection par défaut vers login
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  
  // Route wildcard pour les pages non trouvées
  { path: '**', redirectTo: '/login' }
];