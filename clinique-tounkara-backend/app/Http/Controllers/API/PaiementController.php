<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Paiement;
use App\Models\RendezVous;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Paydunya\Setup;
use Paydunya\Checkout\Store;
use Paydunya\Checkout\CheckoutInvoice;
use Carbon\Carbon; // Assurez-vous d'importer Carbon

// Importez la classe de notification de paiement
use App\Notifications\PaiementEffectueNotification;
// Renommez votre modèle Notification pour éviter le conflit avec Illuminate\Notifications\Notification
use App\Models\Notification as AppNotification;
// Assurez-vous d'importer FactureController si elle est utilisée
use App\Http\Controllers\API\FactureController;


class PaiementController extends Controller
{
    public function __construct()
    {
        try {
            // Configuration PayDunya avec gestion d'erreurs améliorée
            $masterKey = config('services.paydunya.master_key');
            $publicKey = config('services.paydunya.public_key');
            $privateKey = config('services.paydunya.private_key');
            $token = config('services.paydunya.token');
            // Utilise le mode défini dans .env, par défaut 'test'
            $mode = config('services.paydunya.mode', 'test');

            // Validation des clés obligatoires (ajusté pour être moins strict en dev)
            // En production, vous voudriez peut-être une validation plus forte ici
            if (empty($masterKey) || empty($publicKey) || empty($privateKey) || empty($token)) {
                Log::warning('Configuration PayDunya incomplète. Certaines clés API sont manquantes.', [
                    'master_key_set' => !empty($masterKey),
                    'public_key_set' => !empty($publicKey),
                    'private_key_set' => !empty($privateKey),
                    'token_set' => !empty($token),
                    'mode' => $mode
                ]);
                // En mode local/test, on peut continuer pour permettre le débogage
                if (config('app.env') === 'production' && $mode === 'live') {
                    throw new \Exception('Configuration PayDunya incomplète pour le mode LIVE.');
                }
            }

            // Configuration PayDunya
            Setup::setMasterKey($masterKey);
            Setup::setPublicKey($publicKey);
            Setup::setPrivateKey($privateKey);
            Setup::setToken($token);
            Setup::setMode($mode);

            // Configuration du Store avec des valeurs réalistes
            Store::setName('Clinique Tounkara'); // Nom mis à jour
            Store::setTagline('Votre santé, notre priorité');
            Store::setPhoneNumber('+221701234567'); // Numéro sénégalais valide
            Store::setPostalAddress('Rue 10, Keur Massar, Dakar, Sénégal');
            Store::setWebsiteUrl(config('app.url'));
            Store::setLogoUrl(config('app.url') . '/assets/logo.png'); // Assurez-vous que le logo existe

            // URLs de callback - CRITIQUES pour le mode production
            $frontendUrl = config('app.frontend_url', 'http://localhost:4200');
            Store::setCallbackUrl(config('app.url') . '/api/paiements/callback');
            Store::setReturnUrl($frontendUrl . '/payments?payment_return=true');
            Store::setCancelUrl($frontendUrl . '/payments?payment_cancel=true');

            // Log détaillé pour diagnostic
            Log::info('PayDunya configuré', [
                'mode' => $mode,
                'public_key_prefix' => substr($publicKey, 0, 15),
                'master_key_set' => !empty($masterKey),
                'store_name' => Store::getName(),
                'callback_url' => Store::getCallbackUrl(),
                'return_url' => Store::getReturnUrl(),
                'cancel_url' => Store::getCancelUrl()
            ]);

            // Validation spécifique au mode production
            if ($mode === 'live') {
                $this->validateProductionConfig($publicKey, $privateKey, $masterKey);
            }

        } catch (\Exception $e) {
            Log::error('Erreur configuration PayDunya : ' . $e->getMessage(), [
                'mode' => config('services.paydunya.mode'),
                'env' => config('app.env'),
                'trace' => $e->getTraceAsString()
            ]);

            // En production, on ne peut pas continuer sans configuration valide
            if (config('app.env') === 'production' && $mode === 'live') {
                throw $e;
            }
        }
    }

    /**
     * Validation stricte pour le mode production
     */
    private function validateProductionConfig($publicKey, $privateKey, $masterKey)
    {
        // Vérifier le format des clés live
        if (!str_starts_with($publicKey, 'live_public_')) {
            Log::warning('Clé publique non-live détectée en mode production', [
                'key_prefix' => substr($publicKey, 0, 20)
            ]);
        }

        if (!str_starts_with($privateKey, 'live_private_')) {
            Log::warning('Clé privée non-live détectée en mode production', [
                'key_prefix' => substr($privateKey, 0, 20)
            ]);
        }

        // Vérifier que les URLs sont accessibles depuis l'internet
        $appUrl = config('app.url');
        if (str_contains($appUrl, 'localhost') || str_contains($appUrl, '127.0.0.1')) {
            Log::warning('URL localhost détectée en mode production. PayDunya ne pourra pas accéder aux callbacks.', [
                'app_url' => $appUrl
            ]);
        }

        Log::info('Configuration production validée', [
            'public_key_format' => str_starts_with($publicKey, 'live_public_') ? 'LIVE' : 'NON-LIVE',
            'private_key_format' => str_starts_with($privateKey, 'live_private_') ? 'LIVE' : 'NON-LIVE',
            'app_url' => $appUrl
        ]);
    }

    /**
     * Récupérer les rendez-vous confirmés pour le patient connecté.
     */
    public function index()
    {
        try {
            $user = Auth::user();
            if (!$user) {
                return response()->json([
                    'type' => 'UNAUTHORIZED',
                    'message' => 'Utilisateur non authentifié.',
                    'errors' => ['auth' => ['Authentification requise']],
                ], 401);
            }

            if ($user->role !== 'patient') {
                return response()->json([
                    'type' => 'FORBIDDEN',
                    'message' => 'Seuls les patients peuvent consulter leurs rendez-vous confirmés.',
                    'errors' => ['auth' => ['Accès interdit']],
                ], 403);
            }

            // Vérifier si l'utilisateur a un patient associé
            $patient = $user->patient;
            if (!$patient) {
                return response()->json([
                    'type' => 'PATIENT_NOT_FOUND',
                    'message' => 'Aucun patient associé à cet utilisateur.',
                    'errors' => ['patient' => ['Patient non trouvé']],
                ], 404);
            }

            // Récupérer les rendez-vous confirmés avec les paiements
            $rendezVous = RendezVous::where('patient_id', $patient->id)
                ->where('statut', 'confirme')
                ->with(['medecin.user', 'paiements.facture'])
                ->get()
                ->map(function ($rdv) {
                    // Récupérer le paiement actif (non annulé)
                    $paiement = $rdv->paiements()
                        ->where('statut', '!=', 'annule')
                        ->with('facture')
                        ->first();

                    return [
                        'id' => $rdv->id,
                        'medecin' => [
                            'id' => $rdv->medecin->id,
                            'nom' => $rdv->medecin->user->nom ?? '',
                            'prenom' => $rdv->medecin->user->prenom ?? '',
                            'specialite' => $rdv->medecin->specialite ?? '',
                        ],
                        'date_heure' => $rdv->date_heure,
                        'motif' => $rdv->motif,
                        'tarif' => $rdv->tarif,
                        'statut' => $rdv->statut,
                        'paiement' => $paiement ? [
                            'id' => $paiement->id,
                            'montant' => $paiement->montant,
                            'statut' => $paiement->statut,
                            'reference' => $paiement->reference,
                            'paydunya_token' => $paiement->paydunya_token,
                            'facture' => $paiement->facture ? [
                                'id' => $paiement->facture->id,
                                'numero' => $paiement->facture->numero,
                                'date_emission' => $paiement->facture->date_emission,
                                'montant_total' => $paiement->facture->montant_total,
                                'statut' => $paiement->facture->statut,
                            ] : null,
                        ] : null,
                    ];
                });

            return response()->json([
                'data' => $rendezVous,
                'message' => 'Rendez-vous confirmés récupérés avec succès.',
            ], 200);

        } catch (\Exception $e) {
            Log::error('Erreur lors de la récupération des rendez-vous confirmés : ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
                'user_id' => Auth::id(),
                'line' => $e->getLine(),
                'file' => $e->getFile()
            ]);

            return response()->json([
                'type' => 'HTTP_ERROR',
                'message' => 'Erreur interne du serveur',
                'errors' => ['server' => ['Une erreur est survenue lors de la récupération des données']],
            ], 500);
        }
    }

    /**
     * Créer une facture PayDunya pour un rendez-vous confirmé.
     */
    public function store(Request $request)
    {
        try {
            $user = Auth::user();
            if (!$user) {
                return response()->json([
                    'type' => 'UNAUTHORIZED',
                    'message' => 'Utilisateur non authentifié.',
                    'errors' => ['auth' => ['Authentification requise']],
                ], 401);
            }

            if ($user->role !== 'patient') {
                return response()->json([
                    'type' => 'FORBIDDEN',
                    'message' => 'Seuls les patients peuvent effectuer des paiements.',
                    'errors' => ['auth' => ['Accès interdit']],
                ], 403);
            }

            $patient = $user->patient;
            if (!$patient) {
                return response()->json([
                    'type' => 'PATIENT_NOT_FOUND',
                    'message' => 'Aucun patient associé à cet utilisateur.',
                    'errors' => ['patient' => ['Patient non trouvé']],
                ], 404);
            }

            // Validation de la requête
            $validatedData = $request->validate([
                'rendez_vous_id' => 'required|integer|exists:rendez_vous,id',
            ]);

            $rendezVous = RendezVous::where('id', $validatedData['rendez_vous_id'])
                ->where('patient_id', $patient->id)
                ->where('statut', 'confirme')
                ->with(['medecin.user']) // Chargez les relations nécessaires
                ->first();

            if (!$rendezVous) {
                return response()->json([
                    'type' => 'INVALID_APPOINTMENT',
                    'message' => 'Rendez-vous non trouvé ou non confirmé.',
                    'errors' => ['rendez_vous_id' => ['Rendez-vous non valide ou non confirmé']],
                ], 404);
            }

            // Vérifier si un paiement payé existe déjà
            $existingPaiement = Paiement::where('rendez_vous_id', $rendezVous->id)
                ->where('statut', 'paye')
                ->first();

            if ($existingPaiement) {
                return response()->json([
                    'type' => 'PAYMENT_ALREADY_COMPLETED',
                    'message' => 'Ce rendez-vous a déjà été payé.',
                    'errors' => ['paiement' => ['Paiement déjà effectué']],
                ], 400);
            }

            // Supprimer les anciens paiements en attente pour ce rendez-vous
            Paiement::where('rendez_vous_id', $rendezVous->id)
                ->where('statut', 'en_attente')
                ->delete();

            // Créer une facture PayDunya
            try {
                $invoice = new CheckoutInvoice();

                // Configuration des informations client
                $customerName = $user->nom . ' ' . $user->prenom;
                $customerEmail = $user->email;
                $customerPhone = $user->telephone ?? '+221700000000';

                // Ajouter l'item à la facture
                $consultationDescription = sprintf(
                    'Consultation médicale avec Dr. %s %s (%s)',
                    $rendezVous->medecin->user->nom,
                    $rendezVous->medecin->user->prenom,
                    $rendezVous->medecin->specialite
                );

                $invoice->addItem(
                    'Consultation médicale',
                    1,
                    floatval($rendezVous->tarif),
                    floatval($rendezVous->tarif),
                    $consultationDescription
                );

                // Définir le montant total
                $invoice->setTotalAmount(floatval($rendezVous->tarif));

                // Description détaillée
                $invoice->setDescription(sprintf(
                    'Paiement consultation #%d - %s - %s',
                    $rendezVous->id,
                    $customerName,
                    Carbon::parse($rendezVous->date_heure)->format('d/m/Y H:i')
                ));

                // Données personnalisées pour le suivi
                $invoice->addCustomData('rendez_vous_id', $rendezVous->id);
                $invoice->addCustomData('patient_id', $patient->id);
                $invoice->addCustomData('user_id', $user->id);
                $invoice->addCustomData('customer_name', $customerName);
                $invoice->addCustomData('customer_email', $customerEmail);
                $invoice->addCustomData('customer_phone', $customerPhone);
                $invoice->addCustomData('medecin_id', $rendezVous->medecin->id);
                $invoice->addCustomData('specialite', $rendezVous->medecin->specialite);

                // Log détaillé avant création
                Log::info('Création facture PayDunya', [
                    'rendez_vous_id' => $rendezVous->id,
                    'montant' => $rendezVous->tarif,
                    'customer' => $customerName,
                    'email' => $customerEmail,
                    'phone' => $customerPhone,
                    'mode' => config('services.paydunya.mode'),
                    'description' => $consultationDescription
                ]);

                // Créer la facture PayDunya
                if ($invoice->create()) {
                    $token = $invoice->token;
                    $invoiceUrl = $invoice->invoice_url;
                    $status = $invoice->status ?? 'pending';

                    Log::info('Facture PayDunya créée avec succès', [
                        'token' => $token,
                        'url' => $invoiceUrl,
                        'status' => $status,
                        'response_code' => $invoice->response_code ?? 'N/A'
                    ]);

                    // Créer l'enregistrement de paiement
                    $paiement = Paiement::create([
                        'rendez_vous_id' => $rendezVous->id,
                        'date' => now()->toDateString(),
                        'montant' => $rendezVous->tarif,
                        'statut' => 'en_attente',
                        'reference' => $token,
                        'paydunya_token' => $token,
                    ]);

                    Log::info('Paiement créé avec succès', [
                        'paiement_id' => $paiement->id,
                        'rendez_vous_id' => $rendezVous->id,
                        'montant' => $paiement->montant
                    ]);

                    // En mode test/développement, créer immédiatement la facture et notifier le médecin
                    if (config('app.env') === 'local' || config('services.paydunya.mode') === 'test') {
                        try {
                            $factureController = new FactureController();
                            $facture = $factureController->createFromPayment($paiement, 'payee');

                            if ($facture) {
                                $paiement->update(['statut' => 'paye']);

                                Log::info('Mode test: Paiement et facture créés automatiquement', [
                                    'paiement_id' => $paiement->id,
                                    'facture_id' => $facture->id
                                ]);

                                // --- NOUVEAU: Notification au médecin après paiement en mode test ---
                                try {
                                    $medecinUser = $rendezVous->medecin->user;
                                    if ($medecinUser) {
                                        $medecinUser->notify(new PaiementEffectueNotification($paiement, $medecinUser));
                                        Log::info('Notification email de paiement effectué envoyée au médecin (mode test).', [
                                            'paiement_id' => $paiement->id,
                                            'recipient_email' => $medecinUser->email
                                        ]);
                                        AppNotification::create([
                                            'type' => 'paiement_effectue_medecin',
                                            'contenu' => 'Le patient ' . $rendezVous->patient->user->nom . ' ' . $rendezVous->patient->user->prenom . ' a effectué le paiement de ' . number_format($paiement->montant, 0, ',', ' ') . ' F CFA pour le rendez-vous du ' . Carbon::parse($rendezVous->date_heure)->locale('fr')->isoFormat('DD/MM/YYYY HH:mm') . '.',
                                            'date_envoi' => now(),
                                            'envoye' => true,
                                            'statut' => 'envoye',
                                            'methode_envoi' => 'email',
                                            // 'rendez_vous_id' => $rendezVous->id, // Assurez-vous que cette colonne existe
                                            // 'paiement_id' => $paiement->id, // Assurez-vous que cette colonne existe
                                        ]);
                                    }
                                } catch (\Exception $notificationException) {
                                    Log::error('Échec de la notification de paiement effectué au médecin (mode test).', [
                                        'error' => $notificationException->getMessage(),
                                        'trace' => $notificationException->getTraceAsString(),
                                        'paiement_id' => $paiement->id ?? 'N/A'
                                    ]);
                                }
                                // --- FIN NOUVEAU ---

                                return response()->json([
                                    'data' => [
                                        'paiement_id' => $paiement->id,
                                        'paydunya_url' => $invoiceUrl,
                                        'paydunya_token' => $token,
                                        'montant' => floatval($rendezVous->tarif),
                                        'facture_id' => $facture->id,
                                        'facture_numero' => $facture->numero,
                                        'statut_paiement' => 'paye',
                                        'mode' => 'test_auto_paid'
                                    ],
                                    'message' => 'Paiement créé avec succès (mode test - auto-confirmé).',
                                ], 200);
                            }
                        } catch (\Exception $factureException) {
                            Log::warning('Échec création facture automatique en mode test', [
                                'error' => $factureException->getMessage()
                            ]);
                        }
                    }

                    // Retour standard pour mode production
                    return response()->json([
                        'data' => [
                            'paiement_id' => $paiement->id,
                            'paydunya_url' => $invoiceUrl,
                            'paydunya_token' => $token,
                            'montant' => floatval($rendezVous->tarif),
                            'statut_paiement' => 'en_attente'
                        ],
                        'message' => 'Paiement créé avec succès. Redirection vers PayDunya...',
                    ], 200);

                } else {
                    // Erreur PayDunya détaillée
                    $errorCode = $invoice->response_code ?? 'UNKNOWN';
                    $errorText = $invoice->response_text ?? 'Erreur inconnue';
                    $status = $invoice->status ?? 'FAILED';

                    Log::error('Erreur PayDunya lors de la création', [
                        'response_code' => $errorCode,
                        'response_text' => $errorText,
                        'status' => $status,
                        'rendez_vous_id' => $rendezVous->id,
                        'mode' => config('services.paydunya.mode'),
                        'public_key_prefix' => substr(config('services.paydunya.public_key'), 0, 15)
                    ]);

                    // Messages d'erreur spécifiques
                    $errorMessage = $errorText;
                    if (str_contains(strtolower($errorText), 'not enabled')) {
                        $errorMessage = 'Service de paiement non activé. Veuillez contacter l\'administrateur.';
                    } elseif (str_contains(strtolower($errorText), 'invalid')) {
                        $errorMessage = 'Configuration de paiement invalide. Veuillez réessayer.';
                    } elseif (str_contains(strtolower($errorText), 'authentication')) {
                        $errorMessage = 'Erreur d\'authentification avec le service de paiement.';
                    }

                    return response()->json([
                        'type' => 'PAYDUNYA_ERROR',
                        'message' => 'Erreur PayDunya: ' . $errorMessage,
                        'errors' => ['paydunya' => [$errorMessage]],
                        'debug' => [
                            'response_code' => $errorCode,
                            'response_text' => $errorText,
                            'status' => $status,
                            'mode' => config('services.paydunya.mode')
                        ]
                    ], 400);
                }

            } catch (\Exception $paydunyaException) {
                Log::error('Exception PayDunya', [
                    'error' => $paydunyaException->getMessage(),
                    'trace' => $paydunyaException->getTraceAsString(),
                    'rendez_vous_id' => $rendezVous->id,
                    'line' => $paydunyaException->getLine(),
                    'file' => $paydunyaException->getFile()
                ]);

                return response()->json([
                    'type' => 'PAYDUNYA_EXCEPTION',
                    'message' => 'Erreur technique PayDunya: ' . $paydunyaException->getMessage(),
                    'errors' => ['paydunya' => ['Service de paiement temporairement indisponible']],
                ], 500);
            }

        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'type' => 'VALIDATION_ERROR',
                'message' => 'Données de validation invalides',
                'errors' => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            Log::error('Erreur générale création paiement', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'user_id' => Auth::id(),
                'line' => $e->getLine(),
                'file' => $e->getFile()
            ]);

            return response()->json([
                'type' => 'HTTP_ERROR',
                'message' => 'Erreur interne du serveur',
                'errors' => ['server' => ['Une erreur est survenue lors de la création du paiement']],
            ], 500);
        }
    }

    /**
     * Callback PayDunya pour confirmer le paiement (API endpoint pour PayDunya).
     */
    public function callback(Request $request)
    {
        try {
            $token = $request->query('token');
            if (!$token) {
                Log::error('Token PayDunya manquant dans le callback');
                return redirect()->route('paydunya.error')->with('message', 'Token manquant');
            }

            Log::info('Callback PayDunya reçu', ['token' => $token]);

            $invoice = new CheckoutInvoice();
            if ($invoice->confirm($token)) {
                $status = $invoice->status;
                Log::info('Status PayDunya confirmé', ['status' => $status, 'token' => $token]);

                $paiement = Paiement::where('paydunya_token', $token)->first();

                if (!$paiement) {
                    Log::error('Paiement non trouvé pour le token : ' . $token);
                    return redirect()->route('paydunya.error')->with('message', 'Paiement non trouvé');
                }

                if ($status === 'completed') {
                    // Assurez-vous que le statut du paiement n'est pas déjà 'paye'
                    if ($paiement->statut !== 'paye') {
                        $paiement->update([
                            'statut' => 'paye',
                            'reference' => $invoice->receipt_number ?? $token,
                        ]);

                        Log::info('Paiement mis à jour', ['paiement_id' => $paiement->id, 'statut' => 'paye']);

                        // --- NOUVEAU: Notification au médecin après paiement réussi ---
                        try {
                            // Chargez la relation rendezVous avec patient.user et medecin.user
                            // pour que la notification ait toutes les infos nécessaires
                            $paiement->load('rendezVous.patient.user', 'rendezVous.medecin.user');
                            $medecinUser = $paiement->rendezVous->medecin->user;

                            if ($medecinUser) {
                                $medecinUser->notify(new PaiementEffectueNotification($paiement, $medecinUser));
                                Log::info('Notification email de paiement effectué envoyée au médecin (callback).', [
                                    'paiement_id' => $paiement->id,
                                    'recipient_email' => $medecinUser->email
                                ]);
                                AppNotification::create([
                                    'type' => 'paiement_effectue_medecin',
                                    'contenu' => 'Le patient ' . $paiement->rendezVous->patient->user->nom . ' ' . $paiement->rendezVous->patient->user->prenom . ' a effectué le paiement de ' . number_format($paiement->montant, 0, ',', ' ') . ' F CFA pour le rendez-vous du ' . Carbon::parse($paiement->rendezVous->date_heure)->locale('fr')->isoFormat('DD/MM/YYYY HH:mm') . '.',
                                    'date_envoi' => now(),
                                    'envoye' => true,
                                    'statut' => 'envoye',
                                    'methode_envoi' => 'email',
                                    // 'rendez_vous_id' => $paiement->rendezVous->id, // Assurez-vous que cette colonne existe
                                    // 'paiement_id' => $paiement->id, // Assurez-vous que cette colonne existe
                                ]);
                            }
                        } catch (\Exception $notificationException) {
                            Log::error('Échec de la notification de paiement effectué au médecin (callback).', [
                                'error' => $notificationException->getMessage(),
                                'trace' => $notificationException->getTraceAsString(),
                                'paiement_id' => $paiement->id ?? 'N/A'
                            ]);
                        }
                        // --- FIN NOUVEAU ---
                    }


                    // MODIFICATION: Créer ou mettre à jour la facture avec statut payée
                    try {
                        $factureController = new FactureController();

                        // Vérifier si une facture existe déjà
                        $facture = \App\Models\Facture::where('paiement_id', $paiement->id)->first();

                        if (!$facture) {
                            // Créer une nouvelle facture avec statut payée
                            $facture = $factureController->createFromPayment($paiement, 'payee');
                        } else {
                            // Mettre à jour le statut de la facture existante
                            $facture->update(['statut' => 'payee']);
                        }

                        if ($facture) {
                            Log::info('Facture créée/mise à jour avec succès et paiement confirmé', [
                                'paiement_id' => $paiement->id,
                                'facture_id' => $facture->id,
                                'statut_facture' => $facture->statut,
                                'statut_paiement' => $paiement->statut // Utiliser le statut actuel du paiement
                            ]);
                        }

                    } catch (\Exception $factureException) {
                        Log::error('Erreur lors de la gestion de la facture via callback', [
                            'paiement_id' => $paiement->id,
                            'error' => $factureException->getMessage(),
                            'trace' => $factureException->getTraceAsString()
                        ]);
                        // Continue même si la facture échoue
                    }

                    return redirect()->route('paydunya.success', [
                        'token' => $token,
                        'paiement_id' => $paiement->id
                    ]);

                } elseif ($status === 'cancelled') {
                    $paiement->update(['statut' => 'annule']);
                    Log::info('Paiement annulé', ['paiement_id' => $paiement->id]);

                    // Mettre à jour le statut de la facture
                    try {
                        $factureController = new FactureController();
                        $factureController->updateStatusFromPayment($paiement);
                    } catch (\Exception $factureException) {
                        Log::error('Erreur lors de la mise à jour de la facture (annulation)', [
                            'paiement_id' => $paiement->id,
                            'error' => $factureException->getMessage()
                        ]);
                    }

                    return redirect()->route('paydunya.cancel', ['token' => $token]);

                } else {
                    Log::info('Paiement en attente', ['paiement_id' => $paiement->id, 'status' => $status]);
                    return redirect()->route('paydunya.error')->with('message', 'Paiement en attente');
                }
            } else {
                Log::error('Erreur de vérification PayDunya', [
                    'token' => $token,
                    'response_text' => $invoice->response_text ?? 'N/A'
                ]);

                return redirect()->route('paydunya.error')->with('message', 'Erreur de vérification');
            }
        } catch (\Exception $e) {
            Log::error('Erreur lors du callback PayDunya : ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
                'token' => $token ?? 'N/A'
            ]);
            return redirect()->route('paydunya.error')->with('message', 'Erreur serveur');
        }
    }

    /**
     * IPN (Instant Payment Notification) pour les paiements non instantanés.
     */
    public function ipn(Request $request)
    {
        try {
            $data = $request->input('data');
            $token = $data['token'] ?? null;
            $status = $data['status'] ?? null;

            if (!$token || !$status) {
                return response()->json([
                    'type' => 'INVALID_IPN',
                    'message' => 'Données IPN invalides.',
                    'errors' => ['ipn' => ['Token ou statut manquant']],
                ], 400);
            }

            $paiement = Paiement::where('paydunya_token', $token)->first();
            if (!$paiement) {
                return response()->json([
                    'type' => 'PAYMENT_NOT_FOUND',
                    'message' => 'Paiement non trouvé.',
                    'errors' => ['paiement' => ['Paiement non trouvé']],
                ], 404);
            }

            if ($status === 'completed') {
                // Assurez-vous que le statut du paiement n'est pas déjà 'paye'
                if ($paiement->statut !== 'paye') {
                    // MODIFICATION: Créer ou mettre à jour la facture avec statut payée
                    try {
                        $factureController = new FactureController();

                        // Vérifier si une facture existe déjà
                        $facture = \App\Models\Facture::where('paiement_id', $paiement->id)->first();

                        if (!$facture) {
                            // Créer une nouvelle facture avec statut payée
                            $facture = $factureController->createFromPayment($paiement, 'payee');
                        } else {
                            // Mettre à jour le statut de la facture existante
                            $facture->update(['statut' => 'payee']);
                        }

                        // METTRE LE PAIEMENT À 'PAYE' DÈS QUE LA FACTURE EST SAUVEGARDÉE
                        $paiement->update([
                            'statut' => 'paye',
                            'reference' => $data['receipt_number'] ?? $token,
                        ]);

                        if ($facture) {
                            Log::info('Facture créée/mise à jour avec succès via IPN et paiement confirmé', [
                                'paiement_id' => $paiement->id,
                                'facture_id' => $facture->id,
                                'statut_facture' => $facture->statut,
                                'statut_paiement' => 'paye'
                            ]);
                        }

                        // --- NOUVEAU: Notification au médecin après paiement réussi via IPN ---
                        try {
                            // Chargez la relation rendezVous avec patient.user et medecin.user
                            $paiement->load('rendezVous.patient.user', 'rendezVous.medecin.user');
                            $medecinUser = $paiement->rendezVous->medecin->user;

                            if ($medecinUser) {
                                $medecinUser->notify(new PaiementEffectueNotification($paiement, $medecinUser));
                                Log::info('Notification email de paiement effectué envoyée au médecin (IPN).', [
                                    'paiement_id' => $paiement->id,
                                    'recipient_email' => $medecinUser->email
                                ]);
                                AppNotification::create([
                                    'type' => 'paiement_effectue_medecin',
                                    'contenu' => 'Le patient ' . $paiement->rendezVous->patient->user->nom . ' ' . $paiement->rendezVous->patient->user->prenom . ' a effectué le paiement de ' . number_format($paiement->montant, 0, ',', ' ') . ' F CFA pour le rendez-vous du ' . Carbon::parse($paiement->rendezVous->date_heure)->locale('fr')->isoFormat('DD/MM/YYYY HH:mm') . '.',
                                    'date_envoi' => now(),
                                    'envoye' => true,
                                    'statut' => 'envoye',
                                    'methode_envoi' => 'email',
                                    // 'rendez_vous_id' => $paiement->rendezVous->id,
                                    // 'paiement_id' => $paiement->id,
                                ]);
                            }
                        } catch (\Exception $notificationException) {
                            Log::error('Échec de la notification de paiement effectué au médecin (IPN).', [
                                'error' => $notificationException->getMessage(),
                                'trace' => $notificationException->getTraceAsString(),
                                'paiement_id' => $paiement->id ?? 'N/A'
                            ]);
                        }
                        // --- FIN NOUVEAU ---
                    } catch (\Exception $factureException) {
                        Log::error('Erreur lors de la gestion de la facture via IPN', [
                            'paiement_id' => $paiement->id,
                            'error' => $factureException->getMessage()
                        ]);

                        // Même si la facture échoue, on met à jour le paiement
                        $paiement->update([
                            'statut' => 'paye',
                            'reference' => $data['receipt_number'] ?? $token,
                        ]);
                    }
                }

                return response()->json([
                    'message' => 'IPN processed successfully',
                    'paiement_id' => $paiement->id,
                    'statut' => $paiement->statut
                ], 200);

            } elseif ($status === 'cancelled') {
                $paiement->update(['statut' => 'annule']);

                // Mettre à jour le statut de la facture
                try {
                    $factureController = new FactureController();
                    $factureController->updateStatusFromPayment($paiement);
                } catch (\Exception $factureException) {
                    Log::error('Erreur lors de la mise à jour de la facture (IPN annulation)', [
                        'paiement_id' => $paiement->id,
                        'error' => $factureException->getMessage()
                    ]);
                }
            }

            return response()->json([
                'message' => 'IPN traité avec succès.',
                'data' => ['paiement_id' => $paiement->id, 'status' => $status],
            ], 200);
        } catch (\Exception $e) {
            Log::error('Erreur lors du traitement IPN : ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return response()->json([
                'type' => 'HTTP_ERROR',
                'message' => 'Erreur interne du serveur',
                'errors' => ['server' => ['Erreur lors du traitement IPN']],
            ], 500);
        }
    }


    /**
     * Afficher un paiement spécifique.
     */
    public function show(string $id)
    {
        try {
            $paiement = Paiement::with(['rendezVous.medecin.user', 'facture'])->findOrFail($id);
            $user = Auth::user();

            if (!$user) {
                return response()->json([
                    'type' => 'UNAUTHORIZED',
                    'message' => 'Utilisateur non authentifié.',
                    'errors' => ['auth' => ['Authentification requise']],
                ], 401);
            }

            if ($user->role === 'patient' && $paiement->rendezVous->patient_id !== $user->patient->id) {
                return response()->json([
                    'type' => 'FORBIDDEN',
                    'message' => 'Accès non autorisé à ce paiement.',
                    'errors' => ['auth' => ['Accès interdit']],
                ], 403);
            }

            return response()->json([
                'data' => [
                    'id' => $paiement->id,
                    'rendez_vous_id' => $paiement->rendez_vous_id,
                    'date' => $paiement->date,
                    'montant' => $paiement->montant,
                    'statut' => $paiement->statut,
                    'reference' => $paiement->reference,
                    'paydunya_token' => $paiement->paydunya_token,
                    'rendez_vous' => [
                        'id' => $paiement->rendezVous->id,
                        'medecin' => [
                            'nom' => $paiement->rendezVous->medecin->user->nom,
                            'prenom' => $paiement->rendezVous->medecin->user->prenom,
                            'specialite' => $paiement->rendezVous->medecin->specialite,
                        ],
                        'date_heure' => $paiement->rendezVous->date_heure,
                        'motif' => $paiement->rendezVous->motif,
                        'tarif' => $paiement->rendezVous->tarif,
                    ],
                    'facture' => $paiement->facture ? [
                        'id' => $paiement->facture->id,
                        'numero' => $paiement->facture->numero,
                        'date_emission' => $paiement->facture->date_emission,
                        'date_echeance' => $paiement->facture->date_echeance,
                        'montant_total' => $paiement->facture->montant_total,
                        'tva' => $paiement->facture->tva,
                        'statut' => $paiement->facture->statut,
                        'details_facture' => $paiement->facture->details_facture,
                    ] : null,
                ],
                'message' => 'Paiement récupéré avec succès.',
            ], 200);
        } catch (\Exception $e) {
            Log::error('Erreur lors de la récupération du paiement : ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return response()->json([
                'type' => 'HTTP_ERROR',
                'message' => 'Erreur interne du serveur',
                'errors' => ['server' => ['Erreur lors de la récupération du paiement']],
            ], 500);
        }
    }

    /**
     * Annuler un paiement (si en attente).
     */
    public function destroy(string $id)
    {
        try {
            $paiement = Paiement::with('rendezVous')->findOrFail($id);
            $user = Auth::user();

            if (!$user) {
                return response()->json([
                    'type' => 'UNAUTHORIZED',
                    'message' => 'Utilisateur non authentifié.',
                    'errors' => ['auth' => ['Authentification requise']],
                ], 401);
            }

            // Seul le patient qui a initié le paiement ou un administrateur peut l'annuler
            $isPatientOwner = ($user->role === 'patient' && $paiement->rendezVous->patient_id === $user->patient->id);
            $isAdmin = $user->role === 'administrateur';

            if (!$isPatientOwner && !$isAdmin) {
                return response()->json([
                    'type' => 'FORBIDDEN',
                    'message' => 'Accès non autorisé pour annuler ce paiement.',
                    'errors' => ['auth' => ['Accès interdit']],
                ], 403);
            }

            // Vérifier le statut du paiement avant annulation
            if ($paiement->statut === 'paye') {
                return response()->json([
                    'type' => 'PAYMENT_ALREADY_PAID',
                    'message' => 'Ce paiement a déjà été effectué et ne peut pas être annulé.',
                    'errors' => ['paiement' => ['Paiement déjà payé']],
                ], 400);
            }

            if ($paiement->statut === 'annule') {
                return response()->json([
                    'type' => 'PAYMENT_ALREADY_CANCELLED',
                    'message' => 'Ce paiement est déjà annulé.',
                    'errors' => ['paiement' => ['Paiement déjà annulé']],
                ], 400);
            }

            // La logique de votre code original était correcte ici pour vérifier 'en_attente'
            if ($paiement->statut !== 'en_attente') {
                return response()->json([
                    'message' => 'Seuls les paiements en attente peuvent être annulés.',
                    'errors' => ['statut' => ['Paiement non annulable']],
                ], 400);
            }


            // Mettre à jour le statut du paiement à 'annule'
            $paiement->update(['statut' => 'annule']);

            Log::info('Paiement annulé avec succès', [
                'paiement_id' => $paiement->id,
                'user_id' => $user->id,
                'role' => $user->role
            ]);

            // Optionnel : Mettre à jour le statut du rendez-vous si le paiement était le seul en attente
            // et si le rendez-vous n'est pas déjà annulé ou terminé
            if ($paiement->rendezVous && $paiement->rendezVous->statut === 'en_attente') {
                $paiement->rendezVous->update(['statut' => 'annule']);
                Log::info('Statut du rendez-vous mis à "annulé" suite à l\'annulation du paiement.', [
                    'rendez_vous_id' => $paiement->rendezVous->id
                ]);
            }

            // Mettre à jour le statut de la facture associée (si elle existe)
            try {
                $factureController = new FactureController();
                $factureController->updateStatusFromPayment($paiement);
            } catch (\Exception $factureException) {
                Log::error('Erreur lors de la mise à jour de la facture (annulation paiement)', [
                    'paiement_id' => $paiement->id,
                    'error' => $factureException->getMessage()
                ]);
            }

            return response()->json(['message' => 'Paiement annulé avec succès.'], 200);

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'type' => 'NOT_FOUND',
                'message' => 'Paiement non trouvé.',
                'errors' => ['paiement' => ['Le paiement spécifié n\'existe pas.']],
            ], 404);
        } catch (\Exception $e) {
            Log::error('Erreur lors de l\'annulation du paiement : ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
                'paiement_id' => $id,
                'user_id' => Auth::id(),
            ]);
            return response()->json([
                'type' => 'HTTP_ERROR',
                'message' => 'Erreur interne du serveur',
                'errors' => ['server' => ['Une erreur est survenue lors de l\'annulation du paiement']],
            ], 500);
        }
    }


    /**
     * Vérifier le statut d'un paiement en consultant la table facture
     */
    public function verifyPaymentStatus(Request $request, string $id)
    {
        try {
            $user = Auth::user();
            if (!$user) {
                return response()->json([
                    'type' => 'UNAUTHORIZED',
                    'message' => 'Utilisateur non authentifié.',
                    'errors' => ['auth' => ['Authentification requise']],
                ], 401);
            }

            if ($user->role !== 'patient') {
                return response()->json([
                    'type' => 'FORBIDDEN',
                    'message' => 'Seuls les patients peuvent vérifier leurs paiements.',
                    'errors' => ['auth' => ['Accès interdit']],
                ], 403);
            }

            $patient = $user->patient;
            if (!$patient) {
                return response()->json([
                    'type' => 'PATIENT_NOT_FOUND',
                    'message' => 'Aucun patient associé à cet utilisateur.',
                    'errors' => ['patient' => ['Patient non trouvé']],
                ], 404);
            }

            // Récupérer le rendez-vous avec paiement
            $rendezVous = RendezVous::where('id', $id)
                ->where('patient_id', $patient->id)
                ->where('statut', 'confirme')
                ->with(['paiements' => function ($query) {
                    $query->where('statut', '!=', 'annule')
                        ->with('facture');
                }])
                ->first();

            if (!$rendezVous) {
                return response()->json([
                    'type' => 'INVALID_APPOINTMENT',
                    'message' => 'Rendez-vous non trouvé ou non confirmé.',
                    'errors' => ['rendez_vous_id' => ['Rendez-vous non valide']],
                ], 404);
            }

            $paiement = $rendezVous->paiements->first();

            if (!$paiement) {
                return response()->json([
                    'type' => 'PAYMENT_NOT_FOUND',
                    'message' => 'Aucun paiement trouvé pour ce rendez-vous.',
                    'errors' => ['paiement' => ['Paiement non trouvé']],
                ], 404);
            }

            // LOGIQUE DE VÉRIFICATION PRINCIPALE
            // Vérifier si une facture existe pour ce paiement
            $facture = \App\Models\Facture::where('paiement_id', $paiement->id)->first();

            $statusChanged = false;
            $previousStatus = $paiement->statut;

            if ($facture) {
                // Si une facture existe, le paiement doit être marqué comme "payé"
                if ($paiement->statut !== 'paye') {
                    $paiement->update(['statut' => 'paye']);
                    $statusChanged = true;

                    Log::info('Statut de paiement mis à jour suite à vérification de facture', [
                        'paiement_id' => $paiement->id,
                        'rendez_vous_id' => $rendezVous->id,
                        'ancien_statut' => $previousStatus,
                        'nouveau_statut' => 'paye',
                        'facture_id' => $facture->id,
                        'facture_numero' => $facture->numero
                    ]);
                }

                // S'assurer que la facture a le bon statut
                if ($facture->statut !== 'payee') {
                    $facture->update(['statut' => 'payee']);

                    Log::info('Statut de facture mis à jour', [
                        'facture_id' => $facture->id,
                        'nouveau_statut' => 'payee'
                    ]);
                }
            }

            // Recharger le paiement avec la facture pour avoir les données à jour
            $paiement = $paiement->fresh(['facture']);

            return response()->json([
                'data' => [
                    'paiement_id' => $paiement->id,
                    'statut' => $paiement->statut,
                    'reference' => $paiement->reference,
                    'paydunya_token' => $paiement->paydunya_token,
                    'status_changed' => $statusChanged,
                    'previous_status' => $previousStatus,
                    'facture' => $paiement->facture ? [
                        'id' => $paiement->facture->id,
                        'numero' => $paiement->facture->numero,
                        'date_emission' => $paiement->facture->date_emission,
                        'montant_total' => $paiement->facture->montant_total,
                        'statut' => $paiement->facture->statut,
                    ] : null,
                ],
                'message' => $statusChanged
                    ? 'Statut du paiement mis à jour avec succès.'
                    : 'Statut du paiement vérifié - aucun changement nécessaire.',
            ], 200);

        } catch (\Exception $e) {
            Log::error('Erreur lors de la vérification du statut de paiement : ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
                'user_id' => Auth::id(),
                'rendez_vous_id' => $id ?? 'N/A',
                'line' => $e->getLine(),
                'file' => $e->getFile()
            ]);

            return response()->json([
                'type' => 'HTTP_ERROR',
                'message' => 'Erreur interne du serveur',
                'errors' => ['server' => ['Une erreur est survenue lors de la vérification']],
            ], 500);
        }
    }


    public function syncPendingPayments()
    {
        try {
            $user = Auth::user();
            if (!$user || $user->role !== 'patient') {
                return response()->json([
                    'type' => 'UNAUTHORIZED',
                    'message' => 'Accès non autorisé.',
                ], 401);
            }

            $patient = $user->patient;
            if (!$patient) {
                return response()->json([
                    'type' => 'PATIENT_NOT_FOUND',
                    'message' => 'Patient non trouvé.',
                ], 404);
            }

            // Récupérer tous les paiements en attente du patient
            $paiementsEnAttente = Paiement::whereHas('rendezVous', function($query) use ($patient) {
                $query->where('patient_id', $patient->id);
            })
                ->where('statut', 'en_attente')
                ->with('facture')
                ->get();

            $updatedPayments = [];

            foreach ($paiementsEnAttente as $paiement) {
                // Vérifier si une facture existe
                $facture = \App\Models\Facture::where('paiement_id', $paiement->id)->first();

                if ($facture) {
                    // Mettre à jour le paiement vers "payé"
                    $paiement->update(['statut' => 'paye']);

                    // S'assurer que la facture a le bon statut
                    if ($facture->statut !== 'payee') {
                        $facture->update(['statut' => 'payee']);
                    }

                    $updatedPayments[] = [
                        'paiement_id' => $paiement->id,
                        'rendez_vous_id' => $paiement->rendez_vous_id,
                        'ancien_statut' => 'en_attente',
                        'nouveau_statut' => 'paye',
                        'facture_id' => $facture->id
                    ];

                    Log::info('Paiement synchronisé automatiquement', [
                        'paiement_id' => $paiement->id,
                        'facture_id' => $facture->id
                    ]);
                }
            }

            return response()->json([
                'data' => [
                    'updated_payments_count' => count($updatedPayments),
                    'updated_payments' => $updatedPayments
                ],
                'message' => count($updatedPayments) > 0
                    ? count($updatedPayments) . ' paiement(s) synchronisé(s) avec succès.'
                    : 'Aucun paiement à synchroniser.',
            ], 200);

        } catch (\Exception $e) {
            Log::error('Erreur lors de la synchronisation des paiements : ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
                'user_id' => Auth::id()
            ]);

            return response()->json([
                'type' => 'HTTP_ERROR',
                'message' => 'Erreur interne du serveur',
                'errors' => ['server' => ['Erreur lors de la synchronisation']],
            ], 500);
        }
    }

}
