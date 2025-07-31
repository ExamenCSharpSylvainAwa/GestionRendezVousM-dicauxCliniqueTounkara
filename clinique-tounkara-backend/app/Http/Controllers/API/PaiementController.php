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


class PaiementController extends Controller
{
    public function __construct()
    {
        try {
            // Configurer PayDunya avec vos vraies clés
            Setup::setMasterKey(config('services.paydunya.master_key'));
            Setup::setPublicKey(config('services.paydunya.public_key'));
            Setup::setPrivateKey(config('services.paydunya.private_key'));
            Setup::setToken(config('services.paydunya.token'));
            Setup::setMode(config('services.paydunya.mode', 'test'));

            // Configuration du Store
            Store::setName('Clinique Médicale');
            Store::setTagline('Votre santé, notre priorité');
            Store::setPhoneNumber('+221123456789');
            Store::setPostalAddress('Keur Massar, Dakar, Sénégal');
            Store::setWebsiteUrl(config('app.url'));
            Store::setLogoUrl(config('app.url') . '/logo.png');

            // URLs de callback
            $frontendUrl = config('app.frontend_url', 'http://localhost:4200');
            Store::setCallbackUrl(config('app.url') . '/api/paiements/callback');
            Store::setReturnUrl($frontendUrl . '/payments?payment_return=true');
            Store::setCancelUrl($frontendUrl . '/payments?payment_cancel=true');

        } catch (\Exception $e) {
            Log::error('Erreur lors de la configuration PayDunya : ' . $e->getMessage());
        }
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
                ->with(['medecin.user'])
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

                // Ajouter l'item à la facture
                $invoice->addItem(
                    'Consultation médicale', // nom
                    1, // quantité
                    floatval($rendezVous->tarif), // prix unitaire
                    floatval($rendezVous->tarif), // prix total
                    'Consultation avec Dr. ' . $rendezVous->medecin->user->nom . ' ' . $rendezVous->medecin->user->prenom
                );

                // Définir le montant total
                $invoice->setTotalAmount(floatval($rendezVous->tarif));

                // Description de la facture
                $invoice->setDescription('Paiement pour rendez-vous médical #' . $rendezVous->id);

                // Ajouter des données personnalisées pour le suivi
                $invoice->addCustomData('rendez_vous_id', $rendezVous->id);
                $invoice->addCustomData('patient_id', $patient->id);
                $invoice->addCustomData('user_id', $user->id);
                $invoice->addCustomData('customer_name', $user->nom . ' ' . $user->prenom);
                $invoice->addCustomData('customer_email', $user->email);
                $invoice->addCustomData('customer_phone', $user->telephone ?? '+221000000000');

                // Log pour debug
                Log::info('Tentative de création de facture PayDunya', [
                    'rendez_vous_id' => $rendezVous->id,
                    'montant' => $rendezVous->tarif,
                    'customer' => $user->nom . ' ' . $user->prenom,
                    'mode' => config('services.paydunya.mode')
                ]);

                // Créer la facture PayDunya
                if ($invoice->create()) {
                    // Utiliser les bonnes propriétés
                    $token = $invoice->token;
                    $invoiceUrl = $invoice->invoice_url;

                    Log::info('Facture PayDunya créée avec succès', [
                        'token' => $token,
                        'url' => $invoiceUrl,
                        'status' => $invoice->status ?? 'N/A'
                    ]);

                    // MODIFICATION: Créer un enregistrement de paiement avec statut 'en_attente' temporairement
                    $paiement = Paiement::create([
                        'rendez_vous_id' => $rendezVous->id,
                        'date' => now()->toDateString(),
                        'montant' => $rendezVous->tarif,
                        'statut' => 'en_attente', // Temporaire
                        'reference' => $token,
                        'paydunya_token' => $token,
                    ]);

                    Log::info('Paiement créé avec succès dans la base de données', [
                        'paiement_id' => $paiement->id,
                        'rendez_vous_id' => $rendezVous->id,
                        'montant' => $paiement->montant,
                        'statut' => $paiement->statut
                    ]);

                    // MODIFICATION CRUCIALE : Créer immédiatement la facture et mettre le paiement à 'paye'
                    try {
                        $factureController = new FactureController();
                        $facture = $factureController->createFromPayment($paiement, 'payee'); // Statut payée directement

                        if ($facture) {
                            // METTRE LE PAIEMENT À 'PAYE' DÈS QUE LA FACTURE EST CRÉÉE
                            $paiement->update(['statut' => 'paye']);

                            Log::info('Paiement et facture créés avec succès - Statut paiement mis à "payé"', [
                                'facture_id' => $facture->id,
                                'facture_numero' => $facture->numero,
                                'paiement_id' => $paiement->id,
                                'nouveau_statut_paiement' => 'paye',
                                'statut_facture' => $facture->statut
                            ]);

                            return response()->json([
                                'data' => [
                                    'paiement_id' => $paiement->id,
                                    'paydunya_url' => $invoiceUrl,
                                    'paydunya_token' => $token,
                                    'montant' => floatval($rendezVous->tarif),
                                    'facture_id' => $facture->id,
                                    'facture_numero' => $facture->numero,
                                    'statut_paiement' => 'paye', // Confirmé comme payé
                                ],
                                'message' => 'Paiement effectué et facture créée avec succès.',
                            ], 200);

                        } else {
                            Log::warning('Échec de la création de facture lors de l\'initiation du paiement', [
                                'paiement_id' => $paiement->id
                            ]);

                            // Même si la facture échoue, on garde le paiement en attente
                            return response()->json([
                                'data' => [
                                    'paiement_id' => $paiement->id,
                                    'paydunya_url' => $invoiceUrl,
                                    'paydunya_token' => $token,
                                    'montant' => floatval($rendezVous->tarif),
                                    'facture_id' => null,
                                    'facture_numero' => null,
                                    'statut_paiement' => 'en_attente',
                                ],
                                'message' => 'Paiement créé avec succès. Facture en cours de génération.',
                            ], 200);
                        }

                    } catch (\Exception $factureException) {
                        Log::error('Erreur lors de la création de facture pendant l\'initiation du paiement', [
                            'paiement_id' => $paiement->id,
                            'error' => $factureException->getMessage(),
                            'trace' => $factureException->getTraceAsString(),
                            'line' => $factureException->getLine(),
                            'file' => $factureException->getFile()
                        ]);

                        // Continuer même si la facture échoue
                        return response()->json([
                            'data' => [
                                'paiement_id' => $paiement->id,
                                'paydunya_url' => $invoiceUrl,
                                'paydunya_token' => $token,
                                'montant' => floatval($rendezVous->tarif),
                                'facture_id' => null,
                                'facture_numero' => null,
                                'statut_paiement' => 'en_attente',
                            ],
                            'message' => 'Paiement créé avec succès. Facture sera générée ultérieurement.',
                        ], 200);
                    }

                } else {
                    Log::error('Erreur PayDunya lors de la création de la facture', [
                        'response_code' => $invoice->response_code ?? 'N/A',
                        'response_text' => $invoice->response_text ?? 'N/A',
                        'status' => $invoice->status ?? 'N/A',
                        'rendez_vous_id' => $rendezVous->id,
                        'config_mode' => config('services.paydunya.mode'),
                        'master_key_set' => !empty(config('services.paydunya.master_key')),
                        'public_key_set' => !empty(config('services.paydunya.public_key')),
                        'private_key_set' => !empty(config('services.paydunya.private_key')),
                        'token_set' => !empty(config('services.paydunya.token'))
                    ]);

                    return response()->json([
                        'type' => 'PAYDUNYA_ERROR',
                        'message' => 'Erreur lors de la création de la facture PayDunya: ' . ($invoice->response_text ?? 'Erreur inconnue'),
                        'errors' => ['paydunya' => [$invoice->response_text ?? 'Erreur de communication avec PayDunya']],
                        'debug' => [
                            'response_code' => $invoice->response_code ?? 'N/A',
                            'response_text' => $invoice->response_text ?? 'N/A',
                            'mode' => config('services.paydunya.mode')
                        ]
                    ], 400);
                }
            } catch (\Exception $paydunyaException) {
                Log::error('Exception PayDunya : ' . $paydunyaException->getMessage(), [
                    'trace' => $paydunyaException->getTraceAsString(),
                    'rendez_vous_id' => $rendezVous->id ?? 'N/A',
                    'line' => $paydunyaException->getLine(),
                    'file' => $paydunyaException->getFile()
                ]);

                return response()->json([
                    'type' => 'PAYDUNYA_EXCEPTION',
                    'message' => 'Erreur de configuration PayDunya: ' . $paydunyaException->getMessage(),
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
            Log::error('Erreur lors de la création du paiement : ' . $e->getMessage(), [
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
                    // Mettre à jour le paiement
                    $paiement->update([
                        'statut' => 'paye',
                        'reference' => $invoice->receipt_number ?? $token,
                    ]);

                    Log::info('Paiement mis à jour', ['paiement_id' => $paiement->id, 'statut' => 'paye']);

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
                        $paiement->update(['statut' => 'paye']);

                        if ($facture) {
                            Log::info('Facture créée/mise à jour avec succès et paiement confirmé', [
                                'paiement_id' => $paiement->id,
                                'facture_id' => $facture->id,
                                'statut_facture' => $facture->statut,
                                'statut_paiement' => 'paye'
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

            if ($user->role === 'patient' && $paiement->rendezVous->patient_id !== $user->patient->id) {
                return response()->json([
                    'type' => 'FORBIDDEN',
                    'message' => 'Accès non autorisé à ce paiement.',
                    'errors' => ['auth' => ['Accès interdit']],
                ], 403);
            }

            if ($paiement->statut !== 'en_attente') {
                return response()->json([
                    'message' => 'Seuls les paiements en attente peuvent être annulés.',
                    'errors' => ['statut' => ['Paiement non annulable']],
                ], 400);
            }

            $paiement->update(['statut' => 'annule']);
            return response()->json([
                'message' => 'Paiement annulé avec succès.',
            ], 200);
        } catch (\Exception $e) {
            Log::error('Erreur lors de l\'annulation du paiement : ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return response()->json([
                'type' => 'HTTP_ERROR',
                'message' => 'Erreur interne du serveur',
                'errors' => ['server' => ['Erreur lors de l\'annulation du paiement']],
            ], 500);
        }
    }




// Ajouter cette méthode dans PaiementController

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


