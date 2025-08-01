<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Facture;
use App\Models\Paiement;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Barryvdh\DomPDF\Facade\Pdf as PDF; // Assurez-vous que ce package est installé (composer require barryvdh/laravel-dompdf)
use Carbon\Carbon; // Importez Carbon

class FactureController extends Controller
{
    /**
     * Récupérer la liste des factures avec les relations nécessaires.
     */
    public function index(Request $request)
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

            // Construire la requête pour récupérer les factures
            $query = Facture::query();

            // Filtrer par utilisateur si patient
            if ($user->role === 'patient') {
                $patient = $user->patient;
                if (!$patient) {
                    return response()->json([
                        'type' => 'PATIENT_NOT_FOUND',
                        'message' => 'Aucun patient associé à cet utilisateur.',
                        'errors' => ['patient' => ['Patient non trouvé']],
                    ], 404);
                }
                $query->whereHas('paiement.rendez_vous', function ($q) use ($patient) {
                    $q->where('patient_id', $patient->id);
                });
            }

            // Inclure les relations nécessaires
            $query->with([
                'paiement.rendez_vous.patient.user',
                'paiement.rendez_vous.medecin.user',
                'paiement.rendez_vous.medecin',
            ]);

            // Gérer le paramètre include
            $includes = $request->query('include');
            if ($includes) {
                $relations = explode(',', $includes);
                $allowedRelations = [
                    'paiement.rendez_vous.patient.user',
                    'paiement.rendez_vous.medecin.user',
                    'paiement.rendez_vous.medecin',
                ];
                $query->with(array_intersect($allowedRelations, $relations));
            }

            // Récupérer les factures avec pagination
            $factures = $query->orderBy('date_emission', 'desc')->paginate(10);

            // Formater la réponse pour inclure les informations du médecin
            $formattedFactures = $factures->getCollection()->map(function ($facture) {
                return [
                    'id' => $facture->id,
                    'numero' => $facture->numero,
                    'date_emission' => $facture->date_emission,
                    'date_echeance' => $facture->date_echeance,
                    'montant_total' => floatval($facture->montant_total),
                    'tva' => floatval($facture->tva),
                    'statut' => $facture->statut,
                    'paiement' => $facture->paiement ? [
                        'id' => $facture->paiement->id,
                        'statut' => $facture->paiement->statut,
                        'rendez_vous' => $facture->paiement->rendez_vous ? [
                            'id' => $facture->paiement->rendez_vous->id,
                            'patient' => $facture->paiement->rendez_vous->patient ? [
                                'user' => [
                                    'nom' => $facture->paiement->rendez_vous->patient->user->nom ?? '',
                                    'prenom' => $facture->paiement->rendez_vous->patient->user->prenom ?? '',
                                ],
                            ] : null,
                            'medecin' => $facture->paiement->rendez_vous->medecin ? [
                                'user' => [
                                    'nom' => $facture->paiement->rendez_vous->medecin->user->nom ?? '',
                                    'prenom' => $facture->paiement->rendez_vous->medecin->user->prenom ?? '',
                                ],
                                'specialite' => $facture->paiement->rendez_vous->medecin->specialite ?? '',
                            ] : null,
                            'date_heure' => $facture->paiement->rendez_vous->date_heure,
                            'motif' => $facture->paiement->rendez_vous->motif,
                            'tarif' => floatval($facture->paiement->rendez_vous->tarif),
                            'statut' => $facture->paiement->rendez_vous->statut,
                        ] : null,
                        'montant' => floatval($facture->paiement->montant),
                        'reference' => $facture->paiement->reference,
                        'paydunya_token' => $facture->paiement->paydunya_token,
                    ] : null,
                ];
            });

            Log::info('Factures récupérées avec succès', [
                'user_id' => Auth::id(),
                'total' => $factures->total(),
                'current_page' => $factures->currentPage(),
                'last_page' => $factures->lastPage(),
                'per_page' => $factures->perPage(),
                'total' => $factures->total(),
                'message' => 'Factures récupérées avec succès.',
            ], 200);

            return response()->json([
                'data' => $formattedFactures,
                'current_page' => $factures->currentPage(),
                'last_page' => $factures->lastPage(),
                'per_page' => $factures->perPage(),
                'total' => $factures->total(),
                'message' => 'Factures récupérées avec succès.',
            ], 200);

        } catch (\Exception $e) {
            Log::error('Erreur lors de la récupération des factures : ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
                'user_id' => Auth::id(),
            ]);

            return response()->json([
                'type' => 'HTTP_ERROR',
                'message' => 'Erreur interne du serveur',
                'errors' => ['server' => ['Une erreur est survenue lors de la récupération des factures']],
            ], 500);
        }
    }

    /**
     * Afficher une facture spécifique.
     */
    public function show(string $id)
    {
        try {
            $facture = Facture::with([
                'paiement.rendez_vous.patient.user',
                'paiement.rendez_vous.medecin.user',
                'paiement.rendez_vous.medecin',
            ])->findOrFail($id);

            $user = Auth::user();
            if (!$user) {
                return response()->json([
                    'type' => 'UNAUTHORIZED',
                    'message' => 'Utilisateur non authentifié.',
                    'errors' => ['auth' => ['Authentification requise']],
                ], 401);
            }

            if ($user->role === 'patient' && $facture->paiement->rendez_vous->patient_id !== $user->patient->id) {
                return response()->json([
                    'type' => 'FORBIDDEN',
                    'message' => 'Accès non autorisé à cette facture.',
                    'errors' => ['auth' => ['Accès interdit']],
                ], 403);
            }

            return response()->json([
                'data' => [
                    'id' => $facture->id,
                    'numero' => $facture->numero,
                    'date_emission' => $facture->date_emission,
                    'date_echeance' => $facture->date_echeance,
                    'montant_total' => floatval($facture->montant_total),
                    'tva' => floatval($facture->tva),
                    'statut' => $facture->statut,
                    'paiement' => $facture->paiement ? [
                        'id' => $facture->paiement->id,
                        'statut' => $facture->paiement->statut,
                        'rendez_vous' => $facture->paiement->rendez_vous ? [
                            'id' => $facture->paiement->rendez_vous->id,
                            'patient' => $facture->paiement->rendez_vous->patient ? [
                                'user' => [
                                    'nom' => $facture->paiement->rendez_vous->patient->user->nom ?? '',
                                    'prenom' => $facture->paiement->rendez_vous->patient->user->prenom ?? '',
                                ],
                            ] : null,
                            'medecin' => $facture->paiement->rendez_vous->medecin ? [
                                'user' => [
                                    'nom' => $facture->paiement->rendez_vous->medecin->user->nom ?? '',
                                    'prenom' => $facture->paiement->rendez_vous->medecin->user->prenom ?? '',
                                ],
                                'specialite' => $facture->paiement->rendez_vous->medecin->specialite ?? '',
                            ] : null,
                            'date_heure' => $facture->paiement->rendez_vous->date_heure,
                            'motif' => $facture->paiement->rendez_vous->motif,
                            'tarif' => floatval($facture->paiement->rendez_vous->tarif),
                            'statut' => $facture->paiement->rendez_vous->statut,
                        ] : null,
                        'montant' => floatval($facture->paiement->montant),
                        'reference' => $facture->paiement->reference,
                        'paydunya_token' => $facture->paiement->paydunya_token,
                    ] : null,
                ],
                'message' => 'Facture récupérée avec succès.',
            ], 200);

        } catch (\Exception $e) {
            Log::error('Erreur lors de la récupération de la facture : ' . $e->getMessage(), [
                'facture_id' => $id,
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json([
                'type' => 'HTTP_ERROR',
                'message' => 'Erreur interne du serveur',
                'errors' => ['server' => ['Erreur lors de la récupération de la facture']],
            ], 500);
        }
    }

    /**
     * Créer une facture à partir d'un paiement.
     */
    public function createFromPayment(Paiement $paiement, string $statut = 'payee')
    {
        try {
            $rendezVous = $paiement->rendez_vous;
            if (!$rendezVous) {
                Log::error('Rendez-vous non trouvé pour le paiement', [
                    'paiement_id' => $paiement->id,
                ]);
                return null;
            }

            // Préparer les détails de la facture
            $detailsFacture = [
                'rendez_vous_id' => $rendezVous->id,
                'patient' => $rendezVous->patient ? [
                    'nom' => $rendezVous->patient->user->nom ?? '',
                    'prenom' => $rendezVous->patient->user->prenom ?? '',
                    'email' => $rendezVous->patient->user->email ?? '',
                ] : null,
                'medecin' => $rendezVous->medecin ? [
                    'nom' => $rendezVous->medecin->user->nom ?? '',
                    'prenom' => $rendezVous->medecin->user->prenom ?? '',
                    'specialite' => $rendezVous->medecin->specialite ?? '',
                ] : null,
                'date_heure' => $rendezVous->date_heure,
                'motif' => $rendezVous->motif,
                'montant' => $paiement->montant,
                'statut_paiement' => $paiement->statut,
            ];

            $facture = Facture::create([
                'numero' => 'FACT-' . now()->format('Ymd') . '-' . Str::upper(Str::random(8)),
                'date_emission' => now()->toDateString(),
                'date_echeance' => now()->addDays(30)->toDateString(),
                'montant_total' => $paiement->montant,
                'tva' => 0, // Ajustez selon vos besoins
                'statut' => $statut,
                'paiement_id' => $paiement->id,
                'details_facture' => json_encode($detailsFacture), // Ajouter les détails
            ]);

            Log::info('Facture créée avec succès', [
                'facture_id' => $facture->id,
                'paiement_id' => $paiement->id,
                'statut' => $statut,
            ]);

            return $facture;

        } catch (\Exception $e) {
            Log::error('Erreur lors de la création de la facture : ' . $e->getMessage(), [
                'paiement_id' => $paiement->id,
                'trace' => $e->getTraceAsString(),
            ]);
            return null;
        }
    }

    /**
     * Mettre à jour le statut d'une facture en fonction d'un paiement.
     */
    public function updateStatusFromPayment(Paiement $paiement)
    {
        try {
            $facture = Facture::where('paiement_id', $paiement->id)->first();
            if (!$facture) {
                Log::warning('Aucune facture trouvée pour le paiement', [
                    'paiement_id' => $paiement->id,
                ]);
                return null;
            }

            $newStatus = $paiement->statut === 'paye' ? 'payee' : ($paiement->statut === 'annule' ? 'annulee' : 'en_attente');
            $facture->update(['statut' => $newStatus]);

            Log::info('Statut de facture mis à jour', [
                'facture_id' => $facture->id,
                'paiement_id' => $paiement->id,
                'nouveau_statut' => $newStatus,
            ]);

            return $facture;

        } catch (\Exception $e) {
            Log::error('Erreur lors de la mise à jour du statut de la facture : ' . $e->getMessage(), [
                'paiement_id' => $paiement->id,
                'trace' => $e->getTraceAsString(),
            ]);
            return null;
        }
    }

    /**
     * Créer une nouvelle facture manuellement.
     */
    public function store(Request $request)
    {
        try {
            $user = Auth::user();
            if (!$user || $user->role !== 'admin') {
                return response()->json([
                    'type' => 'FORBIDDEN',
                    'message' => 'Seuls les administrateurs peuvent créer des factures manuellement.',
                    'errors' => ['auth' => ['Accès interdit']],
                ], 403);
            }

            $validated = $request->validate([
                'paiement_id' => 'required|exists:paiements,id',
                'montant_total' => 'required|numeric|min:0',
                'tva' => 'nullable|numeric|min:0',
                'statut' => 'required|in:brouillon,envoyee,payee,annulee',
                'details_facture' => 'nullable|array', // Permettre la saisie de détails personnalisés
            ]);

            // Récupérer le paiement pour les détails
            $paiement = Paiement::with('rendez_vous.patient.user', 'rendez_vous.medecin.user')
                ->findOrFail($validated['paiement_id']);

            // Préparer les détails par défaut si non fournis
            $detailsFacture = $validated['details_facture'] ?? [
                'rendez_vous_id' => $paiement->rendez_vous->id ?? null,
                'patient' => $paiement->rendez_vous->patient ? [
                    'nom' => $paiement->rendez_vous->patient->user->nom ?? '',
                    'prenom' => $paiement->rendez_vous->patient->user->prenom ?? '',
                ] : null,
                'medecin' => $paiement->rendez_vous->medecin ? [
                    'nom' => $paiement->rendez_vous->medecin->user->nom ?? '',
                    'prenom' => $paiement->rendez_vous->medecin->user->prenom ?? '',
                    'specialite' => $paiement->rendez_vous->medecin->specialite ?? '',
                ] : null,
                'montant' => $validated['montant_total'],
            ];

            $facture = Facture::create([
                'numero' => 'INV-' . Str::upper(Str::random(8)),
                'date_emission' => now()->toDateString(),
                'date_echeance' => now()->addDays(30)->toDateString(),
                'montant_total' => $validated['montant_total'],
                'tva' => $validated['tva'] ?? 0,
                'statut' => $validated['statut'],
                'paiement_id' => $validated['paiement_id'],
                'details_facture' => json_encode($detailsFacture),
            ]);

            Log::info('Facture créée manuellement avec succès', [
                'facture_id' => $facture->id,
                'paiement_id' => $facture->paiement_id,
            ]);

            return response()->json([
                'data' => $facture->load([
                    'paiement.rendez_vous.patient.user',
                    'paiement.rendez_vous.medecin.user',
                    'paiement.rendez_vous.medecin',
                ]),
                'message' => 'Facture créée avec succès.',
            ], 201);

        } catch (\Exception $e) {
            Log::error('Erreur lors de la création manuelle de la facture : ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json([
                'type' => 'HTTP_ERROR',
                'message' => 'Erreur interne du serveur',
                'errors' => ['server' => ['Erreur lors de la création de la facture']],
            ], 500);
        }
    }

    /**
     * Mettre à jour une facture.
     */
    public function update(Request $request, string $id)
    {
        try {
            $user = Auth::user();
            if (!$user || $user->role !== 'admin') {
                return response()->json([
                    'type' => 'FORBIDDEN',
                    'message' => 'Seuls les administrateurs peuvent modifier des factures.',
                    'errors' => ['auth' => ['Accès interdit']],
                ], 403);
            }

            $facture = Facture::findOrFail($id);

            $validated = $request->validate([
                'montant_total' => 'sometimes|numeric|min:0',
                'tva' => 'sometimes|numeric|min:0',
                'statut' => 'sometimes|in:brouillon,envoyee,payee,annulee',
                'date_emission' => 'sometimes|date',
                'date_echeance' => 'sometimes|date|after_or_equal:date_emission',
                'details_facture' => 'sometimes|array',
            ]);

            // Si details_facture est fourni, l'encoder en JSON
            if (isset($validated['details_facture'])) {
                $validated['details_facture'] = json_encode($validated['details_facture']);
            }

            $facture->update($validated);

            Log::info('Facture mise à jour avec succès', [
                'facture_id' => $facture->id,
                'changements' => $validated,
            ]);

            return response()->json([
                'data' => $facture->load([
                    'paiement.rendez_vous.patient.user',
                    'paiement.rendez_vous.medecin.user',
                    'paiement.rendez_vous.medecin',
                ]),
                'message' => 'Facture mise à jour avec succès.',
            ], 200);

        } catch (\Exception $e) {
            Log::error('Erreur lors de la mise à jour de la facture : ' . $e->getMessage(), [
                'facture_id' => $id,
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json([
                'type' => 'HTTP_ERROR',
                'message' => 'Erreur interne du serveur',
                'errors' => ['server' => ['Erreur lors de la mise à jour de la facture']],
            ], 500);
        }
    }

    /**
     * Supprimer une facture.
     */
    public function destroy(string $id)
    {
        try {
            $user = Auth::user();
            if (!$user || $user->role !== 'admin') {
                return response()->json([
                    'type' => 'FORBIDDEN',
                    'message' => 'Seuls les administrateurs peuvent supprimer des factures.',
                    'errors' => ['auth' => ['Accès interdit']],
                ], 403);
            }

            $facture = Facture::findOrFail($id);
            $facture->delete();

            Log::info('Facture supprimée avec succès', [
                'facture_id' => $id,
            ]);

            return response()->json([
                'message' => 'Facture supprimée avec succès.',
            ], 200);

        } catch (\Exception $e) {
            Log::error('Erreur lors de la suppression de la facture : ' . $e->getMessage(), [
                'facture_id' => $id,
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json([
                'type' => 'HTTP_ERROR',
                'message' => 'Erreur interne du serveur',
                'errors' => ['server' => ['Erreur lors de la suppression de la facture']],
            ], 500);
        }
    }

    /**
     * Génère une facture PDF pour un paiement donné.
     *
     * @param string $id L'ID de la facture à générer en PDF.
     * @return \Illuminate\Http\Response|\Illuminate\Http\JsonResponse
     */
    public function generatePDF($id)
    {
        try {
            Log::info("Tentative de génération PDF pour facture ID: $id", ['user_id' => auth()->id()]);

            // 1. Récupérer la facture avec toutes les relations nécessaires
            $facture = Facture::with([
                'paiement',
                'paiement.rendez_vous',
                'paiement.rendez_vous.patient',
                'paiement.rendez_vous.patient.user',
                'paiement.rendez_vous.medecin',
                'paiement.rendez_vous.medecin.user'
            ])->find($id);

            // 2. Vérifier que la facture existe
            if (!$facture) {
                Log::error("Facture non trouvée: ID $id", ['user_id' => auth()->id()]);
                return response()->json([
                    'error' => 'Facture non trouvée',
                    'message' => "La facture avec l'ID $id n'existe pas."
                ], 404);
            }

            Log::info("Facture trouvée: " . $facture->numero, [
                'user_id' => auth()->id(),
                'facture_id' => $facture->id,
                'statut' => $facture->statut
            ]);

            // 3. Vérifier les données nécessaires pour le PDF
            if (!$facture->paiement) {
                Log::error("Paiement manquant pour facture $id", ['user_id' => auth()->id()]);
                return response()->json([
                    'error' => 'Données incomplètes',
                    'message' => 'Aucun paiement associé à cette facture. Impossible de générer le PDF.'
                ], 400);
            }

            if (!$facture->paiement->rendez_vous) {
                Log::error("Rendez-vous manquant pour facture $id", ['user_id' => auth()->id()]);
                return response()->json([
                    'error' => 'Données incomplètes',
                    'message' => 'Aucun rendez-vous associé au paiement. Impossible de générer le PDF.'
                ], 400);
            }

            $rendezVous = $facture->paiement->rendez_vous;

            if (!$rendezVous->patient || !$rendezVous->patient->user) {
                Log::error("Patient manquant pour facture $id", ['user_id' => auth()->id()]);
                return response()->json([
                    'error' => 'Données incomplètes',
                    'message' => 'Les informations du patient sont manquantes pour cette facture. Impossible de générer le PDF.'
                ], 400);
            }

            if (!$rendezVous->medecin || !$rendezVous->medecin->user) {
                Log::error("Médecin manquant pour facture $id", ['user_id' => auth()->id()]);
                return response()->json([
                    'error' => 'Données incomplètes',
                    'message' => 'Les informations du médecin sont manquantes pour cette facture. Impossible de générer le PDF.'
                ], 400);
            }

            // Données à passer à la vue Blade pour le PDF
            $data = [
                'facture' => $facture,
                'paiement' => $facture->paiement,
                'rendezVous' => $rendezVous,
                'patientUser' => $rendezVous->patient->user,
                'medecinUser' => $rendezVous->medecin->user,
                'cliniqueName' => config('app.name', 'Clinique Tounkara'),
                'cliniqueAddress' => 'Rue 10, Keur Massar, Dakar, Sénégal',
                'cliniquePhone' => '+221701234567',
                'cliniqueEmail' => 'contact@cliniquetounkara.com',
                'logoUrl' => public_path('assets/logo.png'), // Chemin vers votre logo
            ];

            // Charger la vue Blade et la convertir en PDF
            $pdf = PDF::loadView('pdf.facture', $data); // Vous devrez créer cette vue Blade

            // Configuration du PDF (options par défaut si non spécifiées)
            $pdf->setPaper('A4', 'portrait');
            $pdf->setOptions([
                'dpi' => 150,
                'defaultFont' => 'Arial', // Assurez-vous que cette police est disponible ou utilisez 'DejaVu Sans'
                'isHtml5ParserEnabled' => true,
                'isPhpEnabled' => true
            ]);

            Log::info("PDF généré avec succès pour facture: " . $facture->numero, ['facture_id' => $facture->id]);

            // Retourner le PDF en téléchargement
            return $pdf->download('facture-' . $facture->numero . '.pdf');

        } catch (\Exception $e) {
            Log::error('Erreur lors de la génération du PDF de la facture : ' . $e->getMessage(), [
                'facture_id' => $id,
                'trace' => $e->getTraceAsString(),
                'line' => $e->getLine(),
                'file' => $e->getFile()
            ]);
            return response()->json([
                'error' => 'Erreur de génération PDF',
                'message' => 'Une erreur est survenue lors de la génération de la facture PDF.'
            ], 500);
        }
    }
}
