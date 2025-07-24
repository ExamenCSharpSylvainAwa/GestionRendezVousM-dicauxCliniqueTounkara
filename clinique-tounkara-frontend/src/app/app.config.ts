import { ApplicationConfig, LOCALE_ID, DEFAULT_CURRENCY_CODE } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient } from '@angular/common/http';

import { routes } from './app.routes';

// Importez et enregistrez les données de localisation pour le français
import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';

registerLocaleData(localeFr, 'fr'); // Enregistrez les données de locale pour 'fr'

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideAnimationsAsync(),
    provideHttpClient(),
    // Fournissez les tokens pour la localisation et la devise par défaut
    { provide: LOCALE_ID, useValue: 'fr' }, // Indique à Angular d'utiliser 'fr' comme locale par défaut
    { provide: DEFAULT_CURRENCY_CODE, useValue: 'XOF' } // Définit le Franc CFA comme devise par défaut
  ]
};
